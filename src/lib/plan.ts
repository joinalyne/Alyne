import { shortDate } from './dates';

/**
 * How the Membership row describes someone's plan.
 *
 * Extracted from Settings so the branches can be tested without rendering, the
 * same reason the date helpers live in dates.ts. There are four states and three
 * of them were reachable in production while only two were handled.
 */
export type PlanFields = {
  plan?: string | null;
  cancel_at_period_end?: boolean | null;
  current_period_end?: string | null;
};

export function planLabel(profile: PlanFields | null | undefined): string {
  if (!profile || profile.plan !== 'paid') return 'Free';

  if (!profile.cancel_at_period_end) return 'Paid';

  // Salomeh's request: a scheduled cancellation must be visible next to "Paid",
  // because someone who cancels and sees no acknowledgement assumes it failed.
  // Access really does continue until this date, so it states a fact rather than
  // a warning.
  const cancelsOn = shortDate(profile.current_period_end ?? null);

  // The date is Stripe's and has been absent before now, so the cancellation is
  // still acknowledged without it. Falling back to a bare "Paid" here is exactly
  // what made a real cancellation look as though it had not registered.
  return cancelsOn ? `Paid — cancels ${cancelsOn}` : 'Paid — cancelling';
}
