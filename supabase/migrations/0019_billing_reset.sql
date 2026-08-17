-- ============================================================================
-- Alyne — migration 0019: clear test billing state off a live profile
--
-- Salomeh subscribed through the SANDBOX Stripe account while we were proving
-- the flow, so her live profile carries sandbox billing state: plan 'paid',
-- a sandbox customer, a sandbox subscription, and the 6 September cancellation
-- that 0018 correctly surfaced. None of it corresponds to money.
--
-- This is not cosmetic. `create-checkout-session` deliberately reuses a stored
-- `stripe_customer_id` so a returning user does not accumulate duplicate
-- customers in Stripe. Customer ids do not cross the sandbox/live boundary, so
-- leaving a sandbox `cus_` on a live profile means her first REAL checkout is
-- handed a customer the live account has never heard of, and fails. The stale
-- 'paid' plan would block it even sooner: checkout 409s on an existing plan.
--
-- So the reset has to clear the identifiers, not just the plan.
--
-- Doing it as a function rather than an UPDATE is the same discipline as
-- `apply_subscription_state`: the billing columns have exactly two writers, both
-- named, both revoked from users, both testable. It is also needed again — the
-- remaining @demo.alyne profiles get the same treatment before launch.
--
-- Deliberately NOT folded into apply_subscription_state. When a real
-- subscription lapses, keeping the customer id is correct: it is how a returning
-- user resubscribes onto the same Stripe customer. Forgetting the customer is
-- only right when the customer was never real, which the webhook cannot know.
-- ============================================================================

begin;

create or replace function public.reset_billing_state(p_user_id uuid)
returns table (removed_customer_id text, removed_subscription_id text)
language sql
volatile
security definer
set search_path = public
as $$
  -- The old identifiers are captured before the update so the caller gets a
  -- record of what was detached. Postgres RETURNING yields the new row, and
  -- "we cleared it" is not evidence of what was there.
  with before as (
    select id, stripe_customer_id, stripe_subscription_id
    from   public.profiles
    where  id = p_user_id
  ),
  cleared as (
    update public.profiles
    set    plan                   = 'free',
           stripe_customer_id     = null,
           stripe_subscription_id = null,
           subscription_status    = null,
           current_period_end     = null,
           cancel_at_period_end   = false,
           updated_at             = now()
    where  id = p_user_id
    returning id
  )
  select b.stripe_customer_id, b.stripe_subscription_id
  from   before b
  join   cleared c on c.id = b.id;
$$;

comment on function public.reset_billing_state is
  'Detaches test billing state from a profile: plan back to free and the Stripe '
  'identifiers forgotten, so a later real checkout starts a fresh customer '
  'rather than reusing one from another Stripe account. Returns what it removed.';

-- Same rule as the rest of the billing columns: a user must never be able to
-- move their own plan, in either direction. Supabase grants EXECUTE on public
-- functions to authenticated by default, so revoking from public alone would
-- leave this callable.
revoke all on function public.reset_billing_state(uuid)
  from public, authenticated, anon;

commit;
