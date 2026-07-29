// Notification copy and selection logic.
//
// Every string here is Salomeh's, taken verbatim from the Push Notification
// Spec, which she marked COPY LOCKED. Her stated principle is that a push must
// always be about the partner or the streak, never marketing, and never shaming
// — "Don't break your streak" is the hardest tone permitted. Do not soften or
// embellish these without asking her.

export type NotificationKind =
  | 'partner_checked_in'
  | 'streak_reminder'
  | 'matched'
  | 'partner_returned';

export type PushPayload = {
  title: string;
  body: string;
  /** Collapse key. Same tag replaces rather than stacks. */
  tag: string;
  url: string;
};

/**
 * Spec notification 1. Fires when the partner's check-in row is created.
 * Tagged 'partner-checkin' so several arriving while offline collapse to the
 * newest rather than stacking up.
 */
export function partnerCheckedIn(partner: string, partnerStreak: number): PushPayload {
  return {
    title: `${partner} just checked in`,
    body: `Their streak: ${partnerStreak} days. Your move.`,
    tag: 'partner-checkin',
    url: '/home',
  };
}

/**
 * Spec notification 2. 19:00 local, only if not yet checked in.
 * The copy branches on whether there is a streak worth protecting: below three
 * days there is nothing to lose, so leading with the number would be hollow.
 */
export function streakReminder(streak: number, partner: string): PushPayload {
  return {
    title: "Your streak's waiting",
    body:
      streak >= 3
        ? `${streak} days on the line — check in before the day ends.`
        : `A quick check-in keeps you going. ${partner} will see it.`,
    tag: 'streak-reminder',
    url: '/check-in',
  };
}

/** Spec notification 3. The only one carrying an emoji, deliberately. */
export function matched(partner: string, goalLabel: string): PushPayload {
  return {
    title: "You've been matched! 🌱",
    body: `Meet ${partner} — you're both working on ${goalLabel}. Say hi with your first check-in.`,
    tag: 'matched',
    url: '/matched',
  };
}

/** Spec notification 4. The partner returns after three or more silent days. */
export function partnerReturned(partner: string): PushPayload {
  return {
    title: `${partner} is back`,
    body: 'They just checked in. Pick it back up together.',
    tag: 'partner-checkin',
    url: '/home',
  };
}

/**
 * Her spec: "On rematch, #3 fires and any pending #2 for that day is
 * suppressed (the match moment is the day's touch)."
 *
 * So a reminder is dropped if the person was matched today. Being paired is
 * already the day's prompt, and following it with a nag would undo the moment.
 */
export function reminderSuppressedByMatch(
  matchedToday: boolean,
): boolean {
  return matchedToday;
}
