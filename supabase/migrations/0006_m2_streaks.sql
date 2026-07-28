-- ============================================================================
-- Alyne — M2 migration 0006: streak accounting
--
-- Until now nothing incremented a streak. The columns existed and Home read
-- them, but the only function touching current_streak was enqueue_and_match,
-- which zeroes it. So every streak sat at 0 permanently and M1's
-- "reset on rematch" was a no-op you could not observe.
--
-- Per Salomeh's spec: current_streak is the number of consecutive local days
-- with a check-in. Miss a day and it resets.
--
-- Two halves, and both are needed:
--   1. A trigger, so checking in advances the streak immediately.
--   2. A nightly sweep, so a streak DECAYS for someone who stops checking in.
--      Without it a lapsed user keeps a stale number for ever, because nothing
--      they do would trigger the recalculation.
--
-- "Local day" means the user's own timezone, not UTC. A Vancouver user checking
-- in at 6pm is on today, but UTC already says tomorrow — get this wrong and
-- streaks break for everyone west of Greenwich, which is this whole user base.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Advance the streak on check-in
-- ---------------------------------------------------------------------------
create or replace function public.apply_check_in_to_streak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  previous date;
begin
  select last_check_in_date into previous
  from   public.profiles where id = new.user_id;

  update public.profiles
  set    current_streak =
           case
             -- Same local day: the one-per-day unique index should prevent
             -- this, but a no-op is the right answer if it ever happens.
             when previous = new.local_date then current_streak
             -- Consecutive day: extend the run.
             when previous = new.local_date - 1 then current_streak + 1
             -- First ever check-in, a gap, or a backdated row: this day is the
             -- run, so 1 rather than 0. A streak of 0 with a check-in today
             -- would be wrong.
             else 1
           end,
         last_check_in_date =
           -- Never move the date backwards. Inserting an older row as a
           -- correction must not make a current streak look lapsed.
           greatest(coalesce(previous, new.local_date), new.local_date),
         updated_at = now()
  where  id = new.user_id;

  return new;
end;
$$;

drop trigger if exists check_in_advances_streak on public.check_ins;
create trigger check_in_advances_streak
  after insert on public.check_ins
  for each row execute function public.apply_check_in_to_streak();


-- ---------------------------------------------------------------------------
-- 2. Nightly decay
--
-- Zero the streak of anyone whose last check-in is older than yesterday in
-- THEIR timezone. Yesterday is still allowed: their day is not over yet.
--
-- Runs hourly rather than once a day on purpose. A single nightly run happens
-- at one instant in UTC, which is the middle of the afternoon for some users;
-- hourly means each person's streak expires close to their own midnight. It is
-- also idempotent, so a missed hour costs nothing.
-- ---------------------------------------------------------------------------
create or replace function public.reset_stale_streaks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  with stale as (
    update public.profiles p
    set    current_streak = 0, updated_at = now()
    where  p.current_streak > 0
      and (
        p.last_check_in_date is null
        -- Their local today, minus one day.
        or p.last_check_in_date
             < ((now() at time zone coalesce(nullif(p.timezone, ''), 'UTC'))::date - 1)
      )
    returning 1
  )
  select count(*) into affected from stale;

  return affected;
end;
$$;

comment on function public.reset_stale_streaks() is
  'Zeroes streaks for users whose last check-in predates yesterday in their own '
  'timezone. Idempotent; scheduled hourly via pg_cron.';

-- Service role only: this writes to every profile.
revoke all on function public.reset_stale_streaks() from public;
revoke all on function public.reset_stale_streaks() from authenticated;


-- ---------------------------------------------------------------------------
-- 3. Schedule it
--
-- pg_cron inside Postgres rather than a Vercel cron: no HTTP hop, no endpoint
-- to secure, and it cannot be triggered by anyone on the internet. It also
-- sidesteps the Vercel cron quirk of issuing GET where handlers expect POST.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;

-- Unschedule first so re-running this migration does not stack duplicate jobs.
do $$ begin
  perform cron.unschedule('reset-stale-streaks');
exception when others then null;  -- not scheduled yet
end $$;

select cron.schedule(
  'reset-stale-streaks',
  '7 * * * *',  -- past the hour, away from the busy o'clock spike
  $$ select public.reset_stale_streaks(); $$
);

commit;
