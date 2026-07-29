-- ============================================================================
-- Alyne — M4 migration 0012: lock down in_quiet_hours()
--
-- 0010 revoked it from `public` but not from `authenticated`, and Supabase
-- grants EXECUTE on public-schema functions to `authenticated` by default. So
-- any signed-in user could call it for ANY user id.
--
-- It is security definer, so it answers regardless of RLS. The leak is small
-- but real: repeatedly probing a stranger's id across the day narrows down
-- their timezone, and by extension roughly where they live. That is not
-- something an accountability app should hand out.
--
-- Caught by the test asserting a normal user is refused, which is why that
-- assertion exists for every security-definer function rather than only the
-- obviously dangerous ones.
-- ============================================================================

begin;

revoke all on function public.in_quiet_hours(uuid) from authenticated, anon;

commit;
