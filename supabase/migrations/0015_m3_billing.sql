-- ============================================================================
-- Alyne — M3 migration 0015: billing state and webhook idempotency
--
-- The billing columns already exist on profiles from 0001, and 0004 already
-- stops a user writing them. What is missing is the writer.
--
-- Two pieces here:
--
-- 1. stripe_events, so a redelivered webhook cannot be applied twice. Stripe
--    retries on any non-2xx and can deliver the same event more than once even
--    on success. Without this, a duplicated invoice.payment_failed could
--    downgrade someone who had already recovered.
--
-- 2. apply_subscription_state(), so the decision about what a Stripe status
--    MEANS lives in one place rather than being scattered through webhook
--    branches. It is also the reason M3 can be tested without Stripe
--    credentials at all: the mapping is exercised directly.
-- ============================================================================

begin;

create table if not exists public.stripe_events (
  id           text primary key,          -- Stripe's event id, evt_...
  type         text not null,
  processed_at timestamptz not null default now()
);

comment on table public.stripe_events is
  'Seen Stripe event ids. The primary key is the idempotency guarantee: a '
  'redelivered event fails to insert and is skipped.';

alter table public.stripe_events enable row level security;
-- No policies. Written only by the webhook under the service role, and there is
-- no reason for any user to read it.


-- ---------------------------------------------------------------------------
-- The single writer for billing columns.
--
-- `plan` is derived from status rather than passed in, so the rule lives in one
-- place. trialing counts as paid, deliberately: someone inside a 7 day trial
-- has full access, which is the point of offering one. past_due also stays paid,
-- because Stripe retries failed payments for days and cutting someone off on the
-- first failure would punish an expired card rather than a decision not to pay.
-- ---------------------------------------------------------------------------
create or replace function public.apply_subscription_state(
  p_user_id           uuid,
  p_customer_id       text,
  p_subscription_id   text,
  p_status            text,
  p_current_period_end timestamptz
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  new_plan text;
begin
  new_plan := case
    when p_status in ('trialing', 'active', 'past_due') then 'paid'
    else 'free'
  end;

  update public.profiles
  set    stripe_customer_id     = coalesce(p_customer_id, stripe_customer_id),
         stripe_subscription_id = p_subscription_id,
         subscription_status    = p_status,
         current_period_end     = p_current_period_end,
         plan                   = new_plan,
         updated_at             = now()
  where  id = p_user_id;

  if not found then
    raise warning 'apply_subscription_state: no profile for %', p_user_id;
  end if;
end;
$$;

comment on function public.apply_subscription_state is
  'Single writer for the billing columns. plan is derived from status here so '
  'the rule is not duplicated across webhook branches.';

-- Service role only. A user must never be able to grant themselves a plan; that
-- is the whole reason for the column grants in 0004.
revoke all on function public.apply_subscription_state(uuid, text, text, text, timestamptz)
  from public, authenticated, anon;


-- ---------------------------------------------------------------------------
-- Resolve a Stripe customer back to a user.
--
-- Subscription events carry the customer, not our user id, so the mapping has
-- to be stored. Written on the first checkout and read on every event after.
-- ---------------------------------------------------------------------------
create or replace function public.user_for_stripe_customer(p_customer_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles
  where stripe_customer_id = p_customer_id
  limit 1;
$$;

revoke all on function public.user_for_stripe_customer(text)
  from public, authenticated, anon;

commit;
