-- ============================================================================
-- Alyne — M2 migration 0007: the /admin overview
--
-- Three lists, per the TODOs Salomeh left in Admin.tsx:
--   1. flagged  — active pairs where either person has been silent 3+ days
--   2. active   — all active pairings
--   3. queue    — people waiting, in FIFO order
--
-- One function rather than three client queries. `matches` has two foreign keys
-- to `profiles` (user_a and user_b), which makes PostgREST embeds need explicit
-- constraint naming and read badly; and embedded joins have a habit of
-- returning stale values right after a write, which matters here because
-- ending a match re-reads the list immediately.
--
-- security definer with an explicit is_admin() guard rather than relying on the
-- RLS policies. The policies would in fact permit an admin to read all of this,
-- but a single guarded entry point means there is exactly one place to audit.
-- ============================================================================

begin;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  with pairs as (
    select
      m.id,
      m.goal::text as goal,
      m.created_at,
      a.display_name as a_name,
      a.current_streak as a_streak,
      a.last_check_in_date as a_last,
      b.display_name as b_name,
      b.current_streak as b_streak,
      b.last_check_in_date as b_last,
      -- Silence measured against each user's OWN local today, since a streak
      -- day is local. Never checked in counts as silent since the pairing began.
      greatest(
        coalesce(((now() at time zone coalesce(nullif(a.timezone,''),'UTC'))::date - a.last_check_in_date),
                 ((now() at time zone coalesce(nullif(a.timezone,''),'UTC'))::date - m.created_at::date)),
        coalesce(((now() at time zone coalesce(nullif(b.timezone,''),'UTC'))::date - b.last_check_in_date),
                 ((now() at time zone coalesce(nullif(b.timezone,''),'UTC'))::date - m.created_at::date))
      ) as days_silent
    from public.matches m
    join public.profiles a on a.id = m.user_a
    join public.profiles b on b.id = m.user_b
    where m.status = 'active'
  )
  select jsonb_build_object(
    'flagged', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.days_silent desc)
      from pairs p where p.days_silent >= 3
    ), '[]'::jsonb),
    'active', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at desc)
      from pairs p where p.days_silent < 3
    ), '[]'::jsonb),
    'queue', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.priority desc, q.enqueued_at)
      from (
        select mq.id,
               pr.display_name as name,
               mq.goal::text as goal,
               mq.priority,
               mq.enqueued_at
        from public.match_queue mq
        join public.profiles pr on pr.id = mq.user_id
        where mq.status = 'waiting'
      ) q
    ), '[]'::jsonb),
    'counts', jsonb_build_object(
      'active', (select count(*) from pairs),
      'flagged', (select count(*) from pairs where days_silent >= 3),
      'waiting', (select count(*) from public.match_queue where status = 'waiting')
    )
  ) into result;

  return result;
end;
$$;

comment on function public.admin_overview() is
  'Flagged pairs, active pairs and the FIFO queue for /admin. Admin only.';

revoke all on function public.admin_overview() from public;
grant execute on function public.admin_overview() to authenticated;

commit;
