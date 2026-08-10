import { describe, it, expect } from 'vitest';
import { planLabel } from './plan';

/**
 * Salomeh's acceptance run, 10 Aug: Stripe's portal said "Cancels Sep 6" while
 * Settings said only "Paid". These cover every state the Membership row can be
 * in, because three of the four were reachable in production and only two were
 * handled.
 */

describe('plan label', () => {
  it('says Free for a free plan', () => {
    expect(planLabel({ plan: 'free' })).toBe('Free');
  });

  it('says Free when there is no profile yet', () => {
    expect(planLabel(null)).toBe('Free');
    expect(planLabel(undefined)).toBe('Free');
  });

  it('says Paid for an ordinary paid plan', () => {
    expect(planLabel({ plan: 'paid', cancel_at_period_end: false })).toBe('Paid');
  });

  it('never leaks a cancellation date onto a plan that is not cancelling', () => {
    // current_period_end is also the RENEWAL date, so reading it unconditionally
    // would tell someone who is happily subscribed that they are leaving.
    expect(
      planLabel({
        plan: 'paid',
        cancel_at_period_end: false,
        current_period_end: '2026-09-06T00:00:00.000Z',
      }),
    ).toBe('Paid');
  });

  it('names the date when a cancellation is scheduled', () => {
    const label = planLabel({
      plan: 'paid',
      cancel_at_period_end: true,
      current_period_end: '2026-09-06T00:00:00.000Z',
    });
    // Locale-aware by design, so assert the parts rather than one fixed string:
    // a British reader sees "6 Sept" and Salomeh sees "Sep 6".
    expect(label).toContain('Paid');
    expect(label).toContain('cancels');
    expect(label).toMatch(/6/);
    expect(label).toMatch(/Sep/);
  });

  it('still acknowledges the cancellation when Stripe gave us no date', () => {
    // This is the case that shipped broken. cancel_at_period_end was true and
    // current_period_end was NULL, and the old code fell through to a bare
    // "Paid", so a cancellation that HAD registered looked as though it had not.
    expect(planLabel({ plan: 'paid', cancel_at_period_end: true })).toBe(
      'Paid — cancelling',
    );
    expect(
      planLabel({ plan: 'paid', cancel_at_period_end: true, current_period_end: null }),
    ).toBe('Paid — cancelling');
  });

  it('does not fall back to a bare Paid on an unparseable date', () => {
    const label = planLabel({
      plan: 'paid',
      cancel_at_period_end: true,
      current_period_end: 'not a date',
    });
    expect(label).toBe('Paid — cancelling');
  });

  it('treats a cancelling paid plan as still paid, never as Free', () => {
    // Access continues to the end of the period. Showing Free the moment someone
    // cancels would cut them off from something they have paid for.
    for (const end of ['2026-09-06T00:00:00.000Z', null]) {
      expect(
        planLabel({ plan: 'paid', cancel_at_period_end: true, current_period_end: end }),
      ).toContain('Paid');
    }
  });
});
