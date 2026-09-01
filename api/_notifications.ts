// Notification copy and selection logic.
//
// Every string here is Salomeh's, taken verbatim from the Push Notification
// Spec, which she marked COPY LOCKED. Her stated principle is that a push must
// always be about the partner or the streak, never marketing, and never shaming
// — "Don't break your streak" is the hardest tone permitted. Do not soften or
// embellish these without asking her.

/**
 * "1 day", not "1 days". Salomeh caught this in a real push notification.
 * Zero stays plural, which is correct English: "0 days".
 */
export function pluraliseDays(count: number): string {
  return `${count} ${count === 1 ? 'day' : 'days'}`;
}

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
    body: `Their streak: ${pluraliseDays(partnerStreak)}. Your move.`,
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
        ? `${pluraliseDays(streak)} on the line — check in before the day ends.`
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
 * Whether a kind is held back during quiet hours (21:30 to 08:00 local).
 *
 * Salomeh's call, 1 September 2026, when the rule turned out never to have been
 * wired to the event senders: drop rather than hold until morning, because
 * "your partner checked in" at 8am about last night is stale and they will see
 * it on Home anyway. Being paired is the exception - worth waking up for - so
 * 'matched' sends whatever the hour.
 *
 * Dropping, not queueing: an event only stays inside the sender's lookback
 * window for 15 minutes, so there is nothing to deliver later even if we
 * wanted to, and no log row is written for something that was not sent.
 */
export function respectsQuietHours(kind: NotificationKind): boolean {
  return kind !== 'matched';
}

/**
 * Which of the two check-in notifications a check-in earns.
 *
 * Her spec: notification 4 for a partner returning after three or more silent
 * days, notification 1 otherwise, and never both for one check-in.
 *
 * Takes the PREVIOUS CHECK-IN's local date, not the profile's
 * `last_check_in_date`. The streak trigger moves that column to the new
 * check-in's own date as the row lands, so a job reading it afterwards always
 * measures a gap of zero — which is why notification 4 never fired in
 * production between the M4 release and 1 September 2026. A pure function so
 * the distinction is pinned by a test rather than by a comment.
 *
 * No previous check-in means a first check-in, which is not a return from
 * anywhere: notification 1.
 */
export function isReturnAfterSilence(
  previousLocalDate: string | null,
  currentLocalDate: string,
): boolean {
  if (!previousLocalDate) return false;
  const gapDays = Math.round(
    (Date.parse(currentLocalDate) - Date.parse(previousLocalDate)) / 86_400_000,
  );
  return gapDays >= 3;
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
