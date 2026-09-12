-- Miksa — initial schema
-- See SDD §5. Row-level security is enabled here, on day one, because adding
-- it to a working app later is a painful retrofit.

-- ---------------------------------------------------------------------------
-- profiles — every learner. Starts as an anonymous Supabase user.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  cefr_level    text    not null default 'B1'
                        check (cefr_level in ('A1','A2','B1','B2','C1','C2')),
  native_lang   text    not null default 'id',
  vocab_per_day int     not null default 5 check (vocab_per_day between 1 and 20),
  explain_in    text    not null default 'id' check (explain_in in ('id','en','mix')),
  streak_days   int     not null default 0 check (streak_days >= 0),
  last_active_on date,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- messages — one row per chat turn, user and assistant alike.
-- ---------------------------------------------------------------------------
create table if not exists messages (
  id         bigserial primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  -- {"id": 0.6, "en": 0.4} — collected now, used for the v2 level signal.
  lang_mix   jsonb,
  created_at timestamptz not null default now()
);
create index if not exists messages_user_created_idx
  on messages (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- grammar_rules — the canonical catalogue. SEEDED BY HAND, never by the model.
--
-- This table is the reason the whole product works. Free-form rule labels
-- would produce "Article usage", "Articles (a/an)" and "Missing article" as
-- three unlinkable rows for one rule, making progress impossible to measure.
-- A fixed enum makes "how often do I break this" a group by. See SDD §6.1.
--
-- Public read, no user column: it is a shared catalogue, not user data.
-- ---------------------------------------------------------------------------
create table if not exists grammar_rules (
  id             text primary key,
  title_en       text not null,
  title_id       text not null,
  cefr           text not null
                 check (cefr in ('A1','A2','B1','B2','C1','C2')),
  explanation_id text not null,
  example_wrong  text not null,
  example_right  text not null
);

-- ---------------------------------------------------------------------------
-- corrections — one row per correction the model made.
-- The product's real asset. Everything else exists to populate this.
-- ---------------------------------------------------------------------------
create table if not exists corrections (
  id         bigserial primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  message_id bigint references messages(id) on delete set null,
  -- null = uncatalogued. The escape hatch for genuinely novel errors;
  -- review monthly and promote recurring ones by hand. See SDD §6.1.
  rule_id    text references grammar_rules(id),
  original   text not null,
  corrected  text not null,
  note       text,
  dismissed  boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists corrections_user_rule_idx
  on corrections (user_id, rule_id);

-- ---------------------------------------------------------------------------
-- vocab_items — words served on a given day, with their teaching sentence.
-- ---------------------------------------------------------------------------
create table if not exists vocab_items (
  id         bigserial primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  word       text not null,
  meaning_id text not null,
  example_en text not null,
  served_on  date not null default current_date,
  saved      boolean not null default false,
  unique (user_id, word)
);

-- ---------------------------------------------------------------------------
-- usage_daily — quota tracking.
--
-- Not optional. The OpenRouter free tier allows 50 requests per day across the
-- whole account, shared between chat and the vocab job. Without a server-side
-- cap, one enthusiastic session at 10am leaves the app dead until UTC midnight
-- with a raw 429 as the only explanation. See SDD §7.
-- ---------------------------------------------------------------------------
create table if not exists usage_daily (
  user_id     uuid not null references profiles(id) on delete cascade,
  day         date not null default current_date,
  chat_calls  int  not null default 0,
  vocab_calls int  not null default 0,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- app_config — kill switch and runtime config, read before every AI call.
-- Public read so the client can show quota state; service-role write only.
-- ---------------------------------------------------------------------------
create table if not exists app_config (
  key   text primary key,
  value jsonb not null
);

insert into app_config (key, value) values
  ('ai_enabled',     'true'::jsonb),
  ('daily_chat_cap', '40'::jsonb),
  ('model',          '"nvidia/nemotron-3-super-120b-a12b:free"'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Auto-create a profile row whenever an auth user is created, so the client
-- never has to handle "signed in but has no profile".
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- NOTE: profiles keys on `id`; every other user table keys on `user_id`.
-- Copy-pasting `auth.uid() = user_id` onto profiles is a silent no-op that
-- locks the user out of their own row.
-- ---------------------------------------------------------------------------
alter table profiles      enable row level security;
alter table messages      enable row level security;
alter table corrections   enable row level security;
alter table vocab_items   enable row level security;
alter table usage_daily   enable row level security;
alter table grammar_rules enable row level security;
alter table app_config    enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own messages" on messages;
create policy "own messages" on messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own corrections" on corrections;
create policy "own corrections" on corrections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own vocab" on vocab_items;
create policy "own vocab" on vocab_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Read-only to the client: writes go through the Edge Function's service role,
-- so the quota counter cannot be reset from a phone.
drop policy if exists "own usage readable" on usage_daily;
create policy "own usage readable" on usage_daily
  for select using (auth.uid() = user_id);

-- Shared catalogues: readable by any signed-in user, writable by nobody
-- holding an anon key.
drop policy if exists "rules readable" on grammar_rules;
create policy "rules readable" on grammar_rules
  for select to authenticated using (true);

drop policy if exists "config readable" on app_config;
create policy "config readable" on app_config
  for select to authenticated using (true);
