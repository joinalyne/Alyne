// ============================================================================
// Which Stripe MODE is this deployment in, and is it the right one?
//
// On 13 August the three production Stripe variables were all replaced within
// the same minute, with sandbox values. Nothing complained. Production carried
// on serving, and Checkout opened normally — against the sandbox account. The
// page said "Alyne sandbox", "WON'T BE CHARGED" and "US$0.00", so the only thing
// standing between a real customer and a subscription that grants nothing was
// whether they happened to read the badge.
//
// It was invisible for two days because every check we had was satisfied:
//   - the key was present, so the "is Stripe configured" guard passed
//   - the key was valid, so Stripe accepted every call
//   - the prices existed, so Checkout rendered a real 9.99
//   - a test card declined, which reads like proof of live mode but is not:
//     a test card number is refused in live mode too
//
// A secret cannot be read back out of Vercel, so "I set it correctly" is not
// verifiable after the fact. What IS verifiable is the mode the key operates in,
// because Stripe puts it in the key itself. So the deployment checks its own key
// against the environment it is running in, and refuses to transact when they
// disagree.
//
// Sandbox keys ARE test keys: a Stripe sandbox issues sk_test_..., so "test"
// below covers both sandbox and the older test mode.
// ============================================================================

export type StripeMode = 'live' | 'test';

/**
 * The mode a secret or restricted key operates in, or null if the shape is not
 * recognised. Unknown shapes are deliberately not treated as a fault: Stripe has
 * changed key prefixes before, and refusing to take money because a prefix was
 * unfamiliar would be a worse failure than the one being prevented.
 */
export function keyMode(key: string | undefined | null): StripeMode | null {
  const trimmed = key?.trim() ?? '';
  if (/^(sk|rk)_live_/.test(trimmed)) return 'live';
  if (/^(sk|rk)_test_/.test(trimmed)) return 'test';
  return null;
}

/**
 * The mode a deployment ought to be in.
 *
 * Preview expects test, and that direction matters as much as the other one: a
 * preview branch holding a live key can take real money from whoever is handed
 * the link. Local development gets no expectation, because the developer is the
 * one who put the key there and there is no shared consequence.
 */
export function expectedMode(vercelEnv: string | undefined): StripeMode | null {
  if (vercelEnv === 'production') return 'live';
  if (vercelEnv === 'preview') return 'test';
  return null;
}

/**
 * A sentence to log when the key and the environment disagree, or null when
 * there is nothing wrong. Written to be actionable on its own, because the
 * person who has to act on it is looking at a Vercel dashboard rather than this
 * file, and cannot read the current value back.
 */
export function stripeModeFault(
  key: string | undefined | null,
  vercelEnv: string | undefined,
): string | null {
  const actual = keyMode(key);
  const expected = expectedMode(vercelEnv);

  if (!actual || !expected || actual === expected) return null;

  if (expected === 'live') {
    return (
      'STRIPE_SECRET_KEY on production is a TEST/SANDBOX key. Production must ' +
      'hold the live secret key, and STRIPE_PRICE_MONTHLY and ' +
      'STRIPE_PRICE_ANNUAL must be the live price IDs, because sandbox prices ' +
      'do not exist in the live account. Set all three in Vercel scoped to ' +
      'Production only, then redeploy. Refusing to open Checkout until then: a ' +
      'sandbox subscription would grant the customer nothing.'
    );
  }

  return (
    'STRIPE_SECRET_KEY on preview is a LIVE key. A preview deployment must not ' +
    'be able to charge anyone. Set the sandbox key and sandbox price IDs on the ' +
    'Preview scope, then redeploy.'
  );
}

/**
 * Does a verified event come from the same account mode as the key we hold?
 *
 * The signature check cannot catch this. The webhook secret and the secret key
 * are separate values from separate places, so they can disagree — which is
 * exactly what happened here: production ended up with a sandbox key and the
 * live webhook secret, so sandbox events failed verification and vanished as
 * bare 400s while sandbox subscriptions piled up in Stripe with no counterpart
 * in the app.
 */
export function eventModeFault(
  livemode: boolean | undefined,
  key: string | undefined | null,
): string | null {
  const actual = keyMode(key);
  if (actual === null || livemode === undefined) return null;

  const eventMode: StripeMode = livemode ? 'live' : 'test';
  if (eventMode === actual) return null;

  return (
    `A ${eventMode}-mode event arrived at a deployment holding a ${actual}-mode ` +
    'key, so STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET belong to different ' +
    'modes. Reading the subscription back would hit the wrong account. Fix the ' +
    'pair so both are live, or both sandbox.'
  );
}
