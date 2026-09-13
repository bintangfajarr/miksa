-- Miksa — streak tracking
--
-- One integer and a date. Boring, slightly manipulative, and the single most
-- effective retention mechanic ever built (SDD §9).
--
-- The only interesting part is the timezone. Postgres runs in UTC, but a
-- streak is about the learner's *day*, and a learner in Jakarta who chats at
-- 23:00 WIB is at 16:00 UTC — the same UTC day as their 08:00 session. Compute
-- in UTC and two different local days collapse into one, silently breaking the
-- streak the user can see they earned.
--
-- Everything below computes in Asia/Jakarta.

-- ---------------------------------------------------------------------------
-- touch_streak — record activity for today and return the current streak.
--
-- Called from the chat Edge Function after a successful turn, and idempotent
-- within a day: chatting twenty times does not advance the streak twenty days.
-- ---------------------------------------------------------------------------
create or replace function touch_streak(p_user_id uuid)
returns table (streak_days int, is_new_day boolean, is_milestone boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today   date;
  v_last    date;
  v_streak  int;
  v_new_day boolean := false;
begin
  v_today := (now() at time zone 'Asia/Jakarta')::date;

  select p.last_active_on, p.streak_days
    into v_last, v_streak
    from profiles p
   where p.id = p_user_id
   for update;

  if not found then
    return;
  end if;

  v_streak := coalesce(v_streak, 0);

  if v_last is null then
    -- First ever activity.
    v_streak := 1;
    v_new_day := true;
  elsif v_last = v_today then
    -- Already counted today. Leave the streak alone.
    v_new_day := false;
  elsif v_last = v_today - 1 then
    -- Consecutive day.
    v_streak := v_streak + 1;
    v_new_day := true;
  else
    -- Gap of two or more days: start over at one, not zero. Zero would be
    -- technically correct and motivationally wrong — today's session did
    -- happen, and showing "0" for it is the sort of thing that makes people
    -- stop opening the app.
    v_streak := 1;
    v_new_day := true;
  end if;

  update profiles
     set streak_days   = v_streak,
         last_active_on = v_today
   where id = p_user_id;

  return query select
    v_streak,
    v_new_day,
    -- Worth celebrating in the UI.
    v_streak in (3, 7, 14, 30, 50, 100, 365) and v_new_day;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_streak — read-only, with lazy expiry.
--
-- A streak that was last touched three days ago is already dead, but nothing
-- has written to the row since. Rather than run a nightly job to expire stale
-- streaks, report the truth at read time: if the last activity is older than
-- yesterday, the displayed streak is zero.
--
-- The stored value is left alone; touch_streak resets it on the next session.
-- ---------------------------------------------------------------------------
create or replace function get_streak()
returns table (streak_days int, last_active_on date, active_today boolean)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_today date;
  v_last  date;
  v_streak int;
begin
  v_today := (now() at time zone 'Asia/Jakarta')::date;

  select p.last_active_on, coalesce(p.streak_days, 0)
    into v_last, v_streak
    from profiles p
   where p.id = auth.uid();

  if v_last is null or v_last < v_today - 1 then
    return query select 0, v_last, false;
  else
    return query select v_streak, v_last, v_last = v_today;
  end if;
end;
$$;

revoke all on function touch_streak(uuid) from public, anon, authenticated;
grant execute on function get_streak() to authenticated;
