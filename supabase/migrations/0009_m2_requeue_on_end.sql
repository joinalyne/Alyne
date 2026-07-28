-- ============================================================================
-- Alyne — M2 migration 0009: requeue whoever is left when a pairing ends
--
-- Bug found by the change-goal tests. When a match ended, both queue rows had
-- already been flipped to 'matched', so the abandoned partner was left neither
-- matched nor waiting. The engine could not see them, and HomeEmpty showed them
-- "Finding your match" with no way to actually join the queue. They would have
-- waited for ever while the screen told them something was happening.
--
-- Two routes into this and both were affected: an admin unmatching a pair, and
-- a user changing goal and leaving their partner behind.
--
-- Fixed with a trigger rather than in each function, so any future path that
-- ends a match inherits the behaviour instead of reintroducing the bug.
--
-- This is a judgement call I am flagging to Salomeh: her spec says what
-- unmatching does but not what happens next, and the alternative to
-- auto-requeuing is a stranded user or a new "find me someone" button she has
-- not asked for. Requeuing keeps the product's promise with no new UI.
-- ============================================================================

begin;

create or replace function public.requeue_after_match_ends()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'ended' or old.status <> 'active' then
    return new;
  end if;

  insert into public.match_queue (user_id, goal, priority)
  select p.id,
         p.current_goal,
         -- Paid users keep their priority rematch, which is the feature M3
         -- actually sells: a shorter wait after a pairing ends.
         (p.plan = 'paid')
  from   public.profiles p
  where  p.id in (new.user_a, new.user_b)
    -- Someone mid-onboarding has no goal to queue against.
    and  p.current_goal is not null
    -- Never requeue anyone who is already in another active pairing.
    and  not exists (
      select 1 from public.matches m
      where m.status = 'active' and (m.user_a = p.id or m.user_b = p.id)
    )
  -- Matches the partial unique index on waiting rows. change_goal() queues the
  -- changer itself straight afterwards, so without this the two would collide.
  on conflict (user_id) where status = 'waiting' do nothing;

  return new;
end;
$$;

drop trigger if exists requeue_on_match_end on public.matches;
create trigger requeue_on_match_end
  after update on public.matches
  for each row execute function public.requeue_after_match_ends();

comment on function public.requeue_after_match_ends() is
  'Puts both participants back in the queue when a pairing ends, unless they are '
  'already matched or waiting. Without this an unmatched user is invisible to '
  'the engine and cannot rejoin.';

commit;
