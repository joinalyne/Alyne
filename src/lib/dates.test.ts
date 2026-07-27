import { describe, it, expect } from 'vitest';
import { todayLocalDate, relativeTime, streakIsCurrent } from './dates';

describe('todayLocalDate', () => {
  it('formats as ISO YYYY-MM-DD', () => {
    expect(todayLocalDate(new Date('2026-07-27T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('agrees with the local calendar day, not the UTC one', () => {
    // The bug this guards: toISOString() on a Vancouver evening returns
    // tomorrow, rolling the streak over seven hours early.
    const evening = new Date('2026-07-27T23:30:00-07:00'); // 06:30Z on the 28th
    const local = todayLocalDate(evening);
    const utc = evening.toISOString().slice(0, 10);
    expect(local).toBe(
      evening.toLocaleDateString('en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit',
      }),
    );
    // In any timezone behind UTC they differ, which is the whole point.
    if (evening.getTimezoneOffset() > 0) expect(local).not.toBe(utc);
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-07-27T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it('reads "just now" under a minute', () => {
    expect(relativeTime(ago(30_000), now)).toBe('just now');
  });

  it('singularises one minute and one hour', () => {
    expect(relativeTime(ago(60_000), now)).toBe('1 minute ago');
    expect(relativeTime(ago(3_600_000), now)).toBe('1 hour ago');
  });

  it('pluralises everything else', () => {
    expect(relativeTime(ago(120_000), now)).toBe('2 minutes ago');
    expect(relativeTime(ago(7_200_000), now)).toBe('2 hours ago');
    expect(relativeTime(ago(2 * 86_400_000), now)).toBe('2 days ago');
  });

  it('switches unit exactly on the boundary, not one short', () => {
    expect(relativeTime(ago(59 * 60_000), now)).toBe('59 minutes ago');
    expect(relativeTime(ago(60 * 60_000), now)).toBe('1 hour ago');
    expect(relativeTime(ago(23 * 3_600_000), now)).toBe('23 hours ago');
    expect(relativeTime(ago(24 * 3_600_000), now)).toBe('1 day ago');
  });
});

describe('streakIsCurrent', () => {
  const now = new Date('2026-07-27T12:00:00Z');
  const today = todayLocalDate(now);
  const yesterday = todayLocalDate(new Date(now.getTime() - 86_400_000));

  it('stands when the last check-in was today', () => {
    expect(streakIsCurrent(today, now)).toBe(true);
  });

  it('still stands yesterday — the day is not over yet', () => {
    expect(streakIsCurrent(yesterday, now)).toBe(true);
  });

  it('is broken two days back', () => {
    const twoDays = todayLocalDate(new Date(now.getTime() - 2 * 86_400_000));
    expect(streakIsCurrent(twoDays, now)).toBe(false);
  });

  it('is false for someone who has never checked in', () => {
    expect(streakIsCurrent(null, now)).toBe(false);
  });
});
