import { describe, it, expect } from 'vitest';
import { todayLocalDate, relativeTime, streakIsCurrent, shortDate } from './dates';

describe('todayLocalDate', () => {
  it('formats as ISO YYYY-MM-DD', () => {
    expect(todayLocalDate(new Date('2026-07-27T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('agrees with the local calendar day, not the UTC one', () => {
    // REWRITTEN 2026-09-11, after Salomeh asked whether the day boundary was
    // tested behind UTC. It was not, in any way that ran.
    //
    // The previous version compared todayLocalDate's output against the same
    // toLocaleDateString call it makes internally, which is close to a
    // tautology, and then put the assertion that mattered behind
    // `if (evening.getTimezoneOffset() > 0)`. That offset is positive only in
    // zones BEHIND UTC: 420 in Vancouver, but -60 in London and 0 on CI. So the
    // one guard against a streak rolling over seven hours early executed on her
    // laptop and silently skipped itself everywhere Jerome or CI ran it.
    //
    // The zone is explicit now, so every assertion below runs the same on any
    // machine.
    const vancouverEvening = new Date('2026-07-28T06:30:00.000Z'); // 23:30 on the 27th there

    expect(todayLocalDate(vancouverEvening, 'America/Vancouver')).toBe('2026-07-27');
    expect(todayLocalDate(vancouverEvening, 'Europe/London')).toBe('2026-07-28');
  });

  it('never returns the UTC date for a zone behind UTC', () => {
    // The toISOString() regression stated directly. 03:30Z is the window where
    // UTC has already turned over and the whole continental North American
    // spread has not: Pacific is on 20:30 and Eastern on 23:30, both still the
    // 27th. Picking 06:30Z here first was my mistake — by then Denver, Chicago
    // and New York have all passed midnight and only Pacific still disagrees,
    // so three quarters of the loop asserted nothing.
    const instant = new Date('2026-07-28T03:30:00.000Z');
    const utcDate = instant.toISOString().slice(0, 10);

    for (const zone of [
      'America/Vancouver', 'America/Denver', 'America/Chicago', 'America/New_York',
    ]) {
      expect(todayLocalDate(instant, zone)).not.toBe(utcDate);
    }
  });

  it('turns the date over on the zone midnight, not the UTC one', () => {
    // 07:00Z is midnight in Vancouver, so the day changes between these two.
    expect(todayLocalDate(new Date('2026-07-28T06:59:00.000Z'), 'America/Vancouver'))
      .toBe('2026-07-27');
    expect(todayLocalDate(new Date('2026-07-28T07:01:00.000Z'), 'America/Vancouver'))
      .toBe('2026-07-28');
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

describe('shortDate', () => {
  // Salomeh's own argument for why the label is right and the fixture was wrong:
  // if access ends at midnight UTC on the 6th, a Pacific reader really does lose
  // it at 17:00 on the 5th, so telling them "Sep 6" overstates it by seven hours.
  const endOfPeriod = '2026-09-06T00:00:00.000Z';

  it('names the day in the reader\'s own zone, not in UTC', () => {
    expect(shortDate(endOfPeriod, 'America/Vancouver')).toMatch(/5/);
    expect(shortDate(endOfPeriod, 'Europe/London')).toMatch(/6/);
  });

  it('is null for no date, and for a date Stripe mangled', () => {
    expect(shortDate(null)).toBeNull();
    expect(shortDate('not a date')).toBeNull();
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

  // Salomeh's question, 2026-09-11: is the day boundary tested behind UTC? This
  // is the case where the answer genuinely differs, so it is the case worth
  // pinning. A streak that lapses an evening early is the one failure the whole
  // product rests on: the user checked in, and Alyne says they did not.
  it('keeps a streak alive that UTC would have declared broken', () => {
    // 06:30Z on the 28th. In Vancouver it is still the evening of the 27th, so
    // a check-in on the 26th was YESTERDAY and the streak stands. In London it
    // is already the 28th, so the same check-in is two days back and it is gone.
    const vancouverEvening = new Date('2026-07-28T06:30:00.000Z');

    expect(streakIsCurrent('2026-07-26', vancouverEvening, 'America/Vancouver')).toBe(true);
    expect(streakIsCurrent('2026-07-26', vancouverEvening, 'Europe/London')).toBe(false);
  });

  it('holds across the continental North American spread, not just Vancouver', () => {
    // Same instant, four zones, one rule: the check-in was their yesterday.
    // 03:30Z, so every zone below is still on the 27th. At 04:00Z, Eastern has
    // already tipped into the 28th and the 26th becomes two days back there,
    // which is a real behaviour rather than a bug, and not what this asserts.
    const instant = new Date('2026-07-28T03:30:00.000Z');
    for (const zone of [
      'America/Vancouver', 'America/Denver', 'America/Chicago', 'America/New_York',
    ]) {
      expect(streakIsCurrent('2026-07-26', instant, zone)).toBe(true);
    }
  });
});
