-- ============================================================================
-- Alyne — migration 0021: up to three check-ins per local day
--
-- Salomeh's decision (Oct 2026): a check-in becomes closer to a message, so a
-- user may send up to THREE per local day instead of one.
--
-- What changes:
--   1. The unique (user_id, local_date) constraint from 0001 is dropped.
--   2. A trigger caps each user at three rows per local day instead.
--
-- What deliberately does NOT change:
--   - The streak still counts DAYS, not messages. The trigger in 0006 already
--     treats a second row on the same local day as a no-op ("Same local day"
--     branch), so the 2nd and 3rd check-ins never inflate a streak.
--   - check_ins stays append-only (no update/delete policy in 0002), which is
--     what stops anyone rewriting history.
--   - The non-unique index check_ins_user_date from 0001 stays, and is what
--     the count below uses.
--
-- Why a trigger plus an advisory lock rather than "count, then insert" in the
-- app: two taps a moment apart would both count 2 and both insert, leaving
-- four. The lock makes the count and the insert happen one at a time per user
-- per day, so the cap holds even under a double tap.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Drop the one-per-day unique constraint.
--
-- Looked up by its columns rather than by name, because 0001 declared it
-- inline and let Postgres name it.
-- ---------------------------------------------------------------------------
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from   pg_constraint c
    where  c.conrelid = 'public.check_ins'::regclass
      and  c.contype = 'u'
      and  (
        select array_agg(a.attname::text order by a.attname)
        from   unnest(c.conkey) as k(attnum)
        join   pg_attribute a
               on a.attrelid = c.conrelid and a.attnum = k.attnum
      ) = array['local_date', 'user_id']
  loop
    execute format('alter table public.check_ins drop constraint %I', constraint_name);
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 2. Cap at three per user per local day.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_daily_check_in_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  daily_limit constant integer := 3;
  already     integer;
begin
  -- One insert at a time for this user on this day. Released automatically
  -- when the transaction ends.
  perform pg_advisory_xact_lock(
    hashtext('check_in_limit:' || new.user_id::text || ':' || new.local_date::text)
  );

  select count(*) into already
  from   public.check_ins
  where  user_id = new.user_id
    and  local_date = new.local_date;

  if already >= daily_limit then
    -- The app looks for this exact message to show a friendly "done for
    -- today" state instead of an error.
    raise exception 'daily_check_in_limit'
      using errcode = 'P0001',
            hint    = format('Up to %s check-ins per day.', daily_limit);
  end if;

  return new;
end;
$$;

comment on function public.enforce_daily_check_in_limit() is
  'Caps check_ins at three per user per local day. Replaces the one-per-day '
  'unique constraint from 0001. The streak still counts days (see 0006).';

drop trigger if exists check_in_daily_limit on public.check_ins;
create trigger check_in_daily_limit
  before insert on public.check_ins
  for each row execute function public.enforce_daily_check_in_limit();

commit;
