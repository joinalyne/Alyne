-- ============================================================================
-- Alyne — M3 migration 0018: surface a pending cancellation
--
-- Salomeh cancelled her test subscription. Stripe correctly scheduled it to end
-- on 6 September, but Settings still said only "Paid", with no acknowledgement
-- that the cancellation had registered. Her point stands: someone who cancels
-- and sees no confirmation will assume it failed, and either cancel again or
-- ask for help.
--
-- Nothing was wrong with the plan itself. A subscription set to cancel stays
-- `active` in Stripe until the period ends, so `plan` remaining 'paid' is
-- correct and access should continue to the last paid day. The only thing
-- missing was the pending state, which was never stored.
--
-- `current_period_end` already holds the date; when a cancellation is pending,
-- that date IS the cancellation date. So this only needs the flag.
-- ============================================================================

begin;

alter table public.profiles
  add column if not exists cancel_at_period_end boolean not null default false;

comment on column public.profiles.cancel_at_period_end is
  'True when Stripe has a cancellation scheduled. Access continues until '
  'current_period_end, which is then the cancellation date.';

-- Deliberately NOT added to the column grants in 0004. Like plan and the other
-- stripe_* fields, this is the webhook''s to write and the app''s to read only.

drop function if exists public.apply_subscription_state(uuid, text, text, text, timestamptz);

create or replace function public.apply_subscription_state(
  p_user_id            uuid,
  p_customer_id        text,
  p_subscription_id    text,
  p_status             text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean default false
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
  -- trialing and active are obviously paid. past_due stays paid because Stripe
  -- retries a failed card for days, and cutting someone off on the first failure
  -- punishes an expired card rather than a decision not to pay.
  new_plan := case
    when p_status in ('trialing', 'active', 'past_due') then 'paid'
    else 'free'
  end;

  update public.profiles
  set    stripe_customer_id     = coalesce(p_customer_id, stripe_customer_id),
         stripe_subscription_id = p_subscription_id,
         subscription_status    = p_status,
         current_period_end     = p_current_period_end,
         -- Cleared whenever the plan lapses, so a past cancellation cannot
         -- linger on a profile that has since resubscribed.
         cancel_at_period_end   = case when new_plan = 'paid'
                                       then coalesce(p_cancel_at_period_end, false)
                                       else false end,
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

revoke all on function
  public.apply_subscription_state(uuid, text, text, text, timestamptz, boolean)
  from public, authenticated, anon;

commit;
