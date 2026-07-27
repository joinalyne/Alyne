/**
 * Date helpers, extracted from Home so they can be tested without rendering.
 *
 * The `now` parameter exists purely for tests — production callers omit it.
 * Without it these are clock-dependent and only testable by mocking globals.
 */

/**
 * Today's date in the browser's timezone, as YYYY-MM-DD.
 *
 * en-CA because it formats as ISO. Deliberately local rather than UTC: it is
 * compared against check_ins.local_date, which is the user's local day. Using
 * toISOString() here would be a bug — for a Vancouver user at 6pm it returns
 * tomorrow's date, so their streak would roll over seven hours early.
 */
export function todayLocalDate(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA');
}

/** "2 hours ago" — coarse by design; the UI never needs seconds. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * A streak only stands if the last check-in was today or yesterday.
 * Mirrors the rule migration 0001 applies, and the nightly job in M2.
 */
export function streakIsCurrent(
  lastCheckInDate: string | null,
  now: Date = new Date(),
): boolean {
  if (!lastCheckInDate) return false;
  const today = todayLocalDate(now);
  const yesterday = todayLocalDate(new Date(now.getTime() - 86_400_000));
  return lastCheckInDate === today || lastCheckInDate === yesterday;
}
