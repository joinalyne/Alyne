-- ============================================================================
-- Alyne — M1 migration 0003: the matching engine
--
-- Also corrects a hole in 0001. That migration added two unique partial
-- indexes, one on matches.user_a and one on matches.user_b, intending to
-- guarantee "at most one active match per user". They do not: a user can be
-- user_a in one active match and user_b in another, and both indexes still
-- pass. A per-column index cannot express a constraint that spans two columns.
-- Replaced below with a trigger that checks both.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Correct the one-active-match guarantee
-- ---------------------------------------------------------------------------
drop index if exists public.one_active_match_per_user_a;
drop index if exists public.one_active_match_per_user_b;

create or replace function public.enforce_one_active_match()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;

  if exists (
    select 1 from public.matches m
    where m.status = 'active'
      and m.id <> new.id
      and (m.user_a in (new.user_a, new.user_b)
        or m.user_b in (new.user_a, new.user_b))
  ) then
    raise exception 'user already has an active match'
      using errcode = 'unique_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists one_active_match on public.matches;
create trigger one_active_match
  before insert or update on public.matches
  for each row execute function public.enforce_one_active_match();


-- ---------------------------------------------------------------------------
-- 2. enqueue_and_match — the engine
--
-- Security definer because it must write to matches and match_queue, which
-- carry no client insert policies (see 0002). Running as owner is what stops
-- a free user awarding themselves `priority`: the flag is derived here from
-- profiles.plan, never accepted from the caller.
--
-- Returns the match id if a partner was found, or null if the caller is now
-- waiting in the queue.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_and_match()
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  me           uuid := auth.uid();
  my_goal      goal;
  my_plan      text;
  is_priority  boolean;
  partner      uuid;
  partner_qrow uuid;
  new_match    uuid;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select p.current_goal, p.plan into my_goal, my_plan
  from public.profiles p where p.id = me;

  if my_goal is null then
    raise exception 'pick a goal before finding a partner' using errcode = '22023';
  end if;

  -- Already partnered? Hand back the existing match rather than double-pairing.
  select m.id into new_match
  from public.matches m
  where m.status = 'active' and (m.user_a = me or m.user_b = me)
  limit 1;
  if new_match is not null then
    return new_match;
  end if;

  -- Priority rematch is the paid launch feature.
  is_priority := (my_plan = 'paid');

  -- Take my place in the queue. The partial unique index
  -- one_active_queue_per_user makes this idempotent: enqueueing twice keeps
  -- one waiting row rather than stacking up duplicates.
  insert into public.match_queue (user_id, goal, priority)
  values (me, my_goal, is_priority)
  on conflict (user_id) where status = 'waiting'
  do update set priority = excluded.priority;

  -- Find the next waiting person on the same goal.
  --
  -- `for update skip locked` is the whole race-condition story: two users
  -- enqueueing in the same instant each lock a different candidate row rather
  -- than both reading the same one and pairing with it twice. Whoever loses
  -- the row simply skips it and takes the next, or waits.
  select q.user_id, q.id into partner, partner_qrow
  from public.match_queue q
  where q.status = 'waiting'
    and q.goal = my_goal
    and q.user_id <> me
    and not exists (
      select 1 from public.matches m
      where m.status = 'active'
        and (m.user_a = q.user_id or m.user_b = q.user_id)
    )
  order by q.priority desc, q.enqueued_at
  limit 1
  for update skip locked;

  if partner is null then
    return null;  -- nobody available; caller stays in the queue
  end if;

  insert into public.matches (goal, user_a, user_b)
  values (my_goal, me, partner)
  returning id into new_match;

  update public.match_queue
  set    status = 'matched'
  where  id = partner_qrow
     or (user_id = me and status = 'waiting');

  -- Streak resets to 0 on a new partnership, per Salomeh's locked decision.
  update public.profiles
  set    current_streak = 0, updated_at = now()
  where  id in (me, partner);

  return new_match;
end;
$$;

revoke all on function public.enqueue_and_match() from public;
grant execute on function public.enqueue_and_match() to authenticated;

comment on function public.enqueue_and_match() is
  'Join the queue and pair with the next waiting user on the same goal. '
  'Returns the match id, or null if still waiting.';


-- ---------------------------------------------------------------------------
-- 3. leave_queue — cancel a pending search
-- ---------------------------------------------------------------------------
create or replace function public.leave_queue()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.match_queue
  set    status = 'cancelled'
  where  user_id = auth.uid() and status = 'waiting';
$$;

revoke all on function public.leave_queue() from public;
grant execute on function public.leave_queue() to authenticated;


-- ---------------------------------------------------------------------------
-- 4. end_match — admin-controlled unmatch, driven from /admin
-- ---------------------------------------------------------------------------
create or replace function public.end_match(match_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  update public.matches
  set    status = 'ended', ended_at = now(), ended_by = 'admin'
  where  id = match_id and status = 'active';
end;
$$;

revoke all on function public.end_match(uuid) from public;
grant execute on function public.end_match(uuid) to authenticated;

commit;
