/**
 * The subtitle shown on Home once someone has checked in.
 *
 * Salomeh's seven variants. Two of them assume a history and must not appear to
 * someone on their first ever check-in, and one names the partner, so the pool is
 * filtered before choosing rather than filtered afterwards.
 *
 * Selection is DETERMINISTIC for a given person and day. Picking at random on
 * each render would change the message when they navigate away and back, which
 * reads as a glitch rather than as variety. Seeding on the local date means it is
 * stable all day and different tomorrow.
 */

type Variant = {
  /** `{partner}` is substituted when a partner name is known. */
  text: string;
  /** Needs an established streak, so it cannot greet a first-timer. */
  requiresHistory?: boolean;
  /** Needs the partner's name. */
  requiresPartner?: boolean;
};

const VARIANTS: Variant[] = [
  { text: "You've shown up today. Nice." },
  { text: "Showed up again. That's how this works.", requiresHistory: true },
  { text: 'Done for today — {partner} will see it.', requiresPartner: true },
  { text: 'That’s today, handled.' },
  { text: 'Consistency looks good on you.', requiresHistory: true },
  { text: 'One more day in the books.' },
  { text: 'Small step, real progress.' },
];

/**
 * A small stable hash. Not cryptographic; it only needs to spread a date and an
 * id across the pool without clustering.
 */
function hash(seed: string): number {
  let value = 0;
  for (let i = 0; i < seed.length; i += 1) {
    value = (value * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(value);
}

export function checkedInMessage(opts: {
  /** Their streak AFTER today's check-in, so 1 means this is the first. */
  streak: number;
  partnerName: string | null;
  /** Keeps the choice stable per person rather than per device. */
  userId?: string | null;
  /** Local date, so the message changes at the user's own midnight. */
  today?: string;
}): string {
  const { streak, partnerName } = opts;
  const today = opts.today ?? new Date().toLocaleDateString('en-CA');

  const eligible = VARIANTS.filter((v) => {
    // "Showed up again" and "Consistency looks good on you" would be absurd on a
    // first check-in, which is what Salomeh flagged.
    if (v.requiresHistory && streak < 2) return false;
    if (v.requiresPartner && !partnerName) return false;
    return true;
  });

  // The unconditional variants are always eligible, so this cannot be empty.
  const chosen = eligible[hash(`${today}:${opts.userId ?? ''}`) % eligible.length];
  return chosen.text.replace('{partner}', partnerName ?? 'your partner');
}

/** Exported for tests, so the pool cannot drift from the assertions. */
export const CHECKED_IN_VARIANT_COUNT = VARIANTS.length;
