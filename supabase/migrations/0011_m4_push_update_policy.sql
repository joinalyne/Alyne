-- ============================================================================
-- Alyne — M4 migration 0011: let a user refresh their own push subscription
--
-- 0010 gave push_subscriptions SELECT, INSERT and DELETE policies but no
-- UPDATE. Storing a subscription is an upsert on the endpoint, which compiles
-- to ON CONFLICT DO UPDATE, so re-registering the same device would have been
-- denied by RLS.
--
-- That is the failure mode that matters here: it would not appear on the first
-- subscribe, only later when a browser re-registers the same endpoint, and it
-- would look like push quietly ceasing to work rather than an error.
-- ============================================================================

begin;

create policy "push: update own"
  on public.push_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
