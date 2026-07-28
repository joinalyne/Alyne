-- ============================================================================
-- Alyne — M2 migration 0008: changing goal ends the pairing and requeues
--
-- Salomeh's decision, 2026-07-28: "end the pairing and requeue for the new
-- goal, but with a clear warning first. Streak resets on rematch as usual."
--
-- Note what this changes about unmatching. Until now it was admin-only by
-- design, with no self-serve route. A user can now end their own pairing
-- indirectly by changing goal. That is intentional and warned about in the UI,
-- but it means "unmatch is admin-controlled" is no longer strictly true, and
-- the attribution reflects that: ended_by = 'system', not 'admin'. An admin
-- looking at history can tell the two apart.
--
-- Streaks are deliberately NOT reset here. The reset belongs to the new
-- pairing, per spec, and happens inside enqueue_and_match(). Someone who
-- changes goal and waits keeps their number until they are actually matched.
-- ============================================================================

begin;

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

  -- Same goal is a no-op. Without this, tapping the goal you already have would
  -- destroy a perfectly good pairing for no reason.
  if old_goal is not distinct from p_goal then
    return (
      select m.id from public.matches m
      where m.status = 'active' and (m.user_a = me or m.user_b = me)
      limit 1
    );
  end if;

  update public.matches
  set    status = 'ended', ended_at = now(), ended_by = 'system'
  where  status = 'active'
    and  (user_a = me or user_b = me);

  update public.profiles
  set    current_goal = p_goal, updated_at = now()
  where  id = me;

  -- Drop any pending search for the old goal before queueing for the new one,
  -- or the partial unique index on waiting rows would reject the insert.
  update public.match_queue
  set    status = 'cancelled'
  where  user_id = me and status = 'waiting';

  -- Reuse the engine rather than duplicating the FIFO and locking logic.
  return public.enqueue_and_match();
end;
$$;

comment on function public.change_goal(goal) is
  'Ends the current pairing, switches goal, and requeues. Returns the new match '
  'id if someone was already waiting, or null. Warn the user before calling.';

revoke all on function public.change_goal(goal) from public;
grant execute on function public.change_goal(goal) to authenticated;

commit;
