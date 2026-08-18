import { describe, it, expect } from 'vitest';
import { keyMode, expectedMode, stripeModeFault, eventModeFault } from '../../api/_stripe';

/**
 * Production spent two days opening sandbox Checkout sessions after the three
 * production Stripe variables were replaced with sandbox values on 13 August.
 * Every guard we had passed: the key was present, valid, and its prices existed,
 * so Checkout rendered a real 9.99 against an account that could not charge it.
 *
 * A Vercel secret cannot be read back, so no test can assert what is deployed.
 * What a test CAN pin is the rule that makes the deployment refuse, which is the
 * part that was missing rather than wrong.
 */
describe('stripe key mode', () => {
  it('reads the mode out of the key, secret or restricted', () => {
    expect(keyMode('sk_live_51abcDEF')).toBe('live');
    expect(keyMode('rk_live_51abcDEF')).toBe('live');
    expect(keyMode('sk_test_51abcDEF')).toBe('test');
    expect(keyMode('rk_test_51abcDEF')).toBe('test');
  });

  it('treats a sandbox key as test, because that is what Stripe issues', () => {
    // A Stripe sandbox does not have a prefix of its own. This is the exact
    // shape that was live on production for two days.
    expect(keyMode('sk_test_51SandboxKeyFromASandboxAccount')).toBe('test');
  });

  it('tolerates a newline, because a pasted secret usually carries one', () => {
    expect(keyMode('sk_live_51abcDEF\n')).toBe('live');
  });

  it('does not guess at an unfamiliar shape', () => {
    // Refusing to take money because a prefix was unrecognised would be a worse
    // failure than the one being prevented, so unknown means "no opinion".
    expect(keyMode('whsec_abc')).toBeNull();
    expect(keyMode('')).toBeNull();
    expect(keyMode(undefined)).toBeNull();
  });
});

describe('what each environment expects', () => {
  it('production must be live and preview must be test', () => {
    expect(expectedMode('production')).toBe('live');
    expect(expectedMode('preview')).toBe('test');
  });

  it('has no opinion locally', () => {
    expect(expectedMode('development')).toBeNull();
    expect(expectedMode(undefined)).toBeNull();
  });
});

describe('refusing to transact in the wrong mode', () => {
  it('catches the fault that actually happened: sandbox key on production', () => {
    const fault = stripeModeFault('sk_test_51Sandbox', 'production');
    expect(fault).toMatch(/production is a TEST\/SANDBOX key/);
    // The message has to be actionable by someone in a Vercel dashboard who
    // cannot read the current value back, so it names all three variables.
    expect(fault).toMatch(/STRIPE_PRICE_MONTHLY/);
    expect(fault).toMatch(/STRIPE_PRICE_ANNUAL/);
  });

  it('catches the more expensive reverse: a live key on a preview branch', () => {
    expect(stripeModeFault('sk_live_51Real', 'preview'))
      .toMatch(/preview is a LIVE key/);
  });

  it('passes both correct arrangements', () => {
    expect(stripeModeFault('sk_live_51Real', 'production')).toBeNull();
    expect(stripeModeFault('sk_test_51Sandbox', 'preview')).toBeNull();
  });

  it('never blocks local development', () => {
    expect(stripeModeFault('sk_test_51Sandbox', undefined)).toBeNull();
    expect(stripeModeFault('sk_live_51Real', 'development')).toBeNull();
  });
});

describe('key and webhook secret must be the same mode', () => {
  it('rejects a sandbox event on a deployment holding a live key', () => {
    // This is the shape production was in: sandbox key, live webhook secret.
    // Sandbox events failed the signature check and disappeared as bare 400s.
    expect(eventModeFault(false, 'sk_live_51Real'))
      .toMatch(/test-mode event arrived at a deployment holding a live-mode key/);
  });

  it('rejects a live event on a deployment holding a sandbox key', () => {
    expect(eventModeFault(true, 'sk_test_51Sandbox'))
      .toMatch(/live-mode event arrived at a deployment holding a test-mode key/);
  });

  it('accepts a matched pair in either mode', () => {
    expect(eventModeFault(true, 'sk_live_51Real')).toBeNull();
    expect(eventModeFault(false, 'sk_test_51Sandbox')).toBeNull();
  });

  it('says nothing when there is nothing to compare', () => {
    expect(eventModeFault(undefined, 'sk_live_51Real')).toBeNull();
    expect(eventModeFault(true, 'unknown_shape')).toBeNull();
  });
});
