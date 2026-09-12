-- Miksa — quota enforcement
--
-- The OpenRouter free tier allows 50 requests per day across the whole
-- account, shared between chat and the vocab job (SDD §7). This is an
-- availability limit, not a billing one: exceeding it takes the app down until
-- UTC midnight, so the cap has to be enforced before the call goes out, not
-- after.
--
-- Everything here is SECURITY DEFINER and revoked from anon/authenticated: a
-- client that could increment or reset its own counter would make the cap
-- decorative.

-- ---------------------------------------------------------------------------
-- consume_chat_quota — atomically reserve one chat call for today.
--
-- Returns (allowed, used, cap). The insert-on-conflict-with-guard pattern
-- means two concurrent requests cannot both see "39 used" and both proceed:
-- the second one's WHERE clause fails and it gets allowed = false.
--
-- Quota is reserved *before* the model call, so a failed call still costs a
-- request. That is deliberate — OpenRouter counts it too.
-- ---------------------------------------------------------------------------
create or replace function consume_chat_quota(p_user_id uuid)
returns table (allowed boolean, used int, cap int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap      int;
  v_enabled  boolean;
  v_used     int;
begin
  select (value #>> '{}')::int  into v_cap     from app_config where key = 'daily_chat_cap';
  select (value #>> '{}')::boolean into v_enabled from app_config where key = 'ai_enabled';

  v_cap := coalesce(v_cap, 40);

  -- Kill switch: flip app_config.ai_enabled to false from the dashboard and
  -- every call stops, without a deploy. See SDD §3.
  if coalesce(v_enabled, true) = false then
    select coalesce(u.chat_calls, 0) into v_used
      from usage_daily u
     where u.user_id = p_user_id and u.day = current_date;
    return query select false, coalesce(v_used, 0), v_cap;
    return;
  end if;

  insert into usage_daily (user_id, day, chat_calls)
  values (p_user_id, current_date, 1)
  on conflict (user_id, day) do update
    set chat_calls = usage_daily.chat_calls + 1
    where usage_daily.chat_calls < v_cap
  returning usage_daily.chat_calls into v_used;

  if v_used is null then
    -- The guarded update matched nothing: already at the cap.
    select u.chat_calls into v_used
      from usage_daily u
     where u.user_id = p_user_id and u.day = current_date;
    return query select false, coalesce(v_used, v_cap), v_cap;
    return;
  end if;

  return query select true, v_used, v_cap;
end;
$$;

-- ---------------------------------------------------------------------------
-- refund_chat_quota — give back a reservation the model never consumed.
--
-- Only for failures that happen before OpenRouter is reached (bad config,
-- network error on our side). Never call this after a 4xx/5xx from OpenRouter:
-- those requests were counted upstream and refunding would let the local
-- counter drift above the real platform limit.
-- ---------------------------------------------------------------------------
create or replace function refund_chat_quota(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update usage_daily
     set chat_calls = greatest(chat_calls - 1, 0)
   where user_id = p_user_id and day = current_date;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_chat_quota — read-only, for the UI.
--
-- The user needs to know they have 6 turns left *before* starting a long
-- conversation, not after being cut off (SDD §7).
-- ---------------------------------------------------------------------------
create or replace function get_chat_quota()
returns table (used int, cap int, enabled boolean)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(
      (select u.chat_calls from usage_daily u
        where u.user_id = auth.uid() and u.day = current_date),
      0
    ),
    coalesce((select (value #>> '{}')::int from app_config where key = 'daily_chat_cap'), 40),
    coalesce((select (value #>> '{}')::boolean from app_config where key = 'ai_enabled'), true);
$$;

-- The two mutating functions are service-role only; only the read is exposed.
revoke all on function consume_chat_quota(uuid) from public, anon, authenticated;
revoke all on function refund_chat_quota(uuid)  from public, anon, authenticated;
grant execute on function get_chat_quota() to authenticated;
