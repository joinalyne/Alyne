import { describe, it, expect } from 'vitest';
import { periodEndSeconds } from '../../api/stripe-webhook';

/**
 * The root cause of the missing cancellation date.
 *
 * Stripe moved `current_period_end` off the subscription and onto each
 * subscription item in API version 2025-03-31.basil. On stripe-node v22
 * `Stripe.Subscription` has no such property, so `sub.current_period_end` was
 * always undefined and every profile stored NULL. The old code hid this behind
 * an `as unknown as { current_period_end?: number }` cast, so the compiler could
 * not object either.
 *
 * These fixtures are deliberately shaped like the real payloads rather than like
 * the helper's parameter type, because the whole bug was a mismatch between the
 * two.
 */

const SEP_6 = 1788652800; // 2026-09-06T00:00:00Z

describe('period end extraction', () => {
  it('reads the item period end, which is where Stripe now puts it', () => {
    const sub = {
      id: 'sub_1',
      status: 'active',
      cancel_at_period_end: false,
      items: { data: [{ id: 'si_1', current_period_end: SEP_6 }] },
    };
    expect(periodEndSeconds(sub)).toBe(SEP_6);
  });

  it('is undefined when nothing carries a period end, rather than NaN or 0', () => {
    expect(periodEndSeconds({ id: 'sub_1', items: { data: [] } })).toBeUndefined();
    expect(periodEndSeconds({ id: 'sub_1' })).toBeUndefined();
    expect(periodEndSeconds({})).toBeUndefined();
  });

  it('still reads the legacy top-level field, for an older pinned API version', () => {
    expect(periodEndSeconds({ current_period_end: SEP_6 })).toBe(SEP_6);
  });

  it('prefers the top-level field when both are present', () => {
    // Not arbitrary: if an account IS pinned to an older API version, the
    // top-level value is the one Stripe considers authoritative there.
    expect(
      periodEndSeconds({
        current_period_end: SEP_6,
        items: { data: [{ current_period_end: SEP_6 + 86400 }] },
      }),
    ).toBe(SEP_6);
  });

  it('takes the latest item end when items bill on different schedules', () => {
    // Access runs to the last one, so the earliest would cut someone off early.
    const sub = {
      items: {
        data: [
          { current_period_end: SEP_6 },
          { current_period_end: SEP_6 + 86400 * 30 },
          { current_period_end: SEP_6 - 86400 },
        ],
      },
    };
    expect(periodEndSeconds(sub)).toBe(SEP_6 + 86400 * 30);
  });

  it('ignores items that carry no period end at all', () => {
    const sub = {
      items: { data: [{ id: 'si_1' }, { id: 'si_2', current_period_end: SEP_6 }] },
    };
    expect(periodEndSeconds(sub)).toBe(SEP_6);
  });

  it('falls back to cancel_at, which equals the period end once cancelling', () => {
    const sub = { cancel_at: SEP_6, cancel_at_period_end: true, items: { data: [] } };
    expect(periodEndSeconds(sub)).toBe(SEP_6);
  });

  it('does not treat a null cancel_at as a date', () => {
    expect(periodEndSeconds({ cancel_at: null, items: { data: [] } })).toBeUndefined();
  });

  it('regression: the exact shape that stored NULL for every paid profile', () => {
    // A stripe-node v22 subscription object. Nothing at the top level, the date
    // only on the item. This returned undefined before the fix.
    const sub = {
      id: 'sub_1U1neDCLfANMKVJ7',
      object: 'subscription',
      status: 'active',
      cancel_at: null,
      cancel_at_period_end: false,
      items: {
        object: 'list',
        data: [
          {
            id: 'si_abc',
            object: 'subscription_item',
            current_period_start: SEP_6 - 86400 * 30,
            current_period_end: SEP_6,
          },
        ],
      },
    };
    expect(periodEndSeconds(sub)).toBe(SEP_6);
  });
});
