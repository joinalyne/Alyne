-- ============================================================================
-- Alyne — 0013: create the profile row on signup, in the database
--
-- Salomeh could not get past goal selection on a fresh signup: choosing a goal
-- bounced her back to "Let's set up your profile". Reproduced exactly.
--
-- The chain:
--   1. Clicking the emailed confirmation link establishes a session from tokens
--      in the URL hash. signInWithPassword never runs.
--   2. ensureProfile() was only called after signInWithPassword, so no profile
--      row was ever created.
--   3. ProfileSetup then ran UPDATE profiles SET display_name WHERE id = ...,
--      which matched zero rows and returned NO ERROR, so the app reported
--      success and moved on.
--   4. Same for the goal.
--   5. The route guard read a missing display_name and bounced to profile setup,
--      for ever.
--
-- Every real signup hit this. My own tests did not, because they sign in with a
-- password, which is the one path that did call ensureProfile. Creating the row
-- in the database instead removes the dependency on the client taking any
-- particular route in.
--
-- The exception handler is not optional. A trigger on auth.users that raises
-- will fail the signup itself, locking users out of registering entirely, which
-- is far worse than a missing profile row.
-- ============================================================================

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, timezone)
  values (new.id, new.email, 'UTC')
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Never block a signup. A profile can be repaired later; a user who cannot
  -- register at all cannot be.
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
  'Creates the profiles row on signup so it exists regardless of how the user '
  'signs in. Timezone is corrected by the client on first load, which is the '
  'only place the browser zone is known.';

-- Repair anyone already affected: users created before this trigger who never
-- got a row, including whoever Salomeh signed up with while testing.
insert into public.profiles (id, email, timezone)
select u.id, u.email, 'UTC'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

commit;
