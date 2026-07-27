-- ============================================================================
-- Alyne — M1 migration 0004: column-level privileges on profiles
--
-- Closes a privilege-escalation hole opened by 0002.
--
-- The "profiles: update own" policy allows a user to update their own row.
-- RLS is row-level only — it has nothing to say about WHICH columns — so that
-- policy permitted:
--
--   update profiles set is_admin = true    where id = auth.uid();  -- full admin
--   update profiles set plan = 'paid'      where id = auth.uid();  -- free paid tier
--   update profiles set current_streak=999 where id = auth.uid();  -- fake streak
--
-- Verified against the live database: a signed-in user really could make
-- themselves an admin, which under 0002's policies means reading every profile
-- and ending anyone's match.
--
-- Column-level GRANTs are the fix. They compose with RLS: the policy decides
-- which ROWS, the grant decides which COLUMNS. A write to any other column is
-- rejected outright rather than silently dropped.
--
-- The protected columns all have a legitimate writer already:
--   plan, stripe_*, subscription_status, current_period_end
--                       -> the Stripe webhook (M3), service role
--   current_streak, last_check_in_date
--                       -> the check-in and nightly streak jobs (M2), and
--                          enqueue_and_match(), all security definer
--   is_admin            -> set by hand in the dashboard. Never by the app.
-- ============================================================================

begin;

-- Start from nothing rather than trying to subtract, so a column added later
-- is inaccessible by default instead of accidentally writable.
revoke insert, update on public.profiles from authenticated;

-- What a user legitimately owns about themselves.
grant insert (id, email, display_name, avatar_url, timezone, current_goal)
  on public.profiles to authenticated;

grant update (email, display_name, avatar_url, timezone, current_goal, updated_at)
  on public.profiles to authenticated;

-- SELECT stays whole-row: the RLS policy from 0002 already restricts it to
-- self, an active partner, or an admin. Note this means a partner can see
-- plan and is_admin. Neither is sensitive, and hiding them would need a view.

commit;

-- ---------------------------------------------------------------------------
-- Consequence worth knowing: upsert no longer works on this table.
--
-- Postgres requires TABLE-level UPDATE privilege for `ON CONFLICT DO UPDATE`;
-- column-level grants do not satisfy it, so a PostgREST upsert fails with
-- 42501 permission denied. `ON CONFLICT DO NOTHING` needs only INSERT and is
-- unaffected.
--
-- ensureProfile() in src/lib/supabase.ts is therefore written as an
-- ignoreDuplicates insert followed by a plain update. If a future upsert
-- against `profiles` starts throwing 42501, this is why — split it rather than
-- granting table-level UPDATE back, which would reopen the escalation.
-- ---------------------------------------------------------------------------
