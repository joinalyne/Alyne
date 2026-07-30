-- ============================================================================
-- Alyne — 0014: tell the person left behind why they are back in the queue
--
-- Salomeh's UX gap: when a partner changes goal or an admin ends a pair, the
-- person left behind is silently requeued and it reads as a glitch. Her design
-- shows a one-time notice with copy that depends on WHY it happened.
--
-- `ended_by` already records what ended a pairing, 'admin' or 'system', but not
-- WHO. That distinction matters more than it first appears: change_goal sets
-- 'system' for both people, so without it the person who changed their own goal
-- would be told "your partner switched goals". They would be reading their own
-- action described as someone else's, which is worse than no notice at all.
--
-- So the initiator is now recorded, and the notice is shown only to the other
-- person.
-- ============================================================================

begin;

alter table public.matches
  add column if not exists ended_by_user uuid references public.profiles(id) on delete set null;

comment on column public.matches.ended_by_user is
  'Who ended it, when a user did. Null for an admin action. Used to avoid '
  'telling someone their own goal change was their partner''s.';

-- Record the initiator. Everything else about this function is unchanged.
create or replace function public.change_goal(p_goal goal)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  me        uuid := auth.uid();
  old_goal  goal;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select current_goal into old_goal from public.profiles where id = me;

  -- Same goal is a no-op, so tapping the goal you already have cannot destroy a
  -- perfectly good pairing.
  if old_goal is not distinct from p_goal then
    return (
      select m.id from public.matches m
      where m.status = 'active' and (m.user_a = me or m.user_b = me)
      limit 1
    );
  end if;

  update public.matches
  set    status = 'ended', ended_at = now(), ended_by = 'system',
         ended_by_user = me
  where  status = 'active'
    and  (user_a = me or user_b = me);

  update public.profiles
  set    current_goal = p_goal, updated_at = now()
  where  id = me;

  update public.match_queue
  set    status = 'cancelled'
  where  user_id = me and status = 'waiting';

  return public.enqueue_and_match();
end;
$$;

revoke all on function public.change_goal(goal) from public;
grant execute on function public.change_goal(goal) to authenticated;


-- ---------------------------------------------------------------------------
-- What notice, if any, should this user see?
--
-- Returns the reason and the match id. The id is what lets the client show it
-- exactly once: a different id means a different event, so a later requeue
-- notifies again rather than being suppressed by an old "seen" flag.
-- ---------------------------------------------------------------------------
create or replace function public.requeue_notice()
returns table (reason text, match_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when m.ended_by = 'admin' then 'admin'
      -- Someone else's goal change. Their own is deliberately excluded below.
      when m.ended_by = 'system' then 'goal_change'
    end as reason,
    m.id
  from public.matches m
  where (m.user_a = auth.uid() or m.user_b = auth.uid())
    and m.status = 'ended'
    -- Never explain a requeue to someone who caused it themselves.
    and (m.ended_by <> 'system' or m.ended_by_user is distinct from auth.uid())
    -- Only while actually waiting. Once matched again the notice is moot, which
    -- is what makes a new match clear it without any extra bookkeeping.
    and not exists (
      select 1 from public.matches a
      where a.status = 'active' and (a.user_a = auth.uid() or a.user_b = auth.uid())
    )
  order by m.ended_at desc nulls last
  limit 1;
$$;

comment on function public.requeue_notice() is
  'The one-time "A New Match Is Coming" notice for /home-empty. Null when the '
  'user caused the change themselves, or is already matched again.';

grant execute on function public.requeue_notice() to authenticated;

commit;
