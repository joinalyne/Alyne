import { describe, it, expect } from 'vitest';
import { checkedInMessage, CHECKED_IN_VARIANT_COUNT } from './checkedInMessage';

const days = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    new Date(Date.UTC(2026, 0, 1 + i)).toLocaleDateString('en-CA'),
  );

describe('checkedInMessage', () => {
  it('has all seven of her variants', () => {
    expect(CHECKED_IN_VARIANT_COUNT).toBe(7);
  });

  it('is stable for the same person on the same day', () => {
    // Random per render would change on every navigation, which reads as a
    // glitch rather than as variety.
    const args = { streak: 5, partnerName: 'Salomeh', userId: 'u1', today: '2026-03-04' };
    expect(checkedInMessage(args)).toBe(checkedInMessage(args));
  });

  it('rotates across days', () => {
    const seen = new Set(
      days(40).map((today) =>
        checkedInMessage({ streak: 5, partnerName: 'Salomeh', userId: 'u1', today }),
      ),
    );
    // Not asserting all seven, since a hash need not hit every bucket in 40
    // days, but it must genuinely vary rather than being fixed.
    expect(seen.size).toBeGreaterThan(3);
  });

  it('never greets a first-timer as a returner', () => {
    // Her note: "Showed up again" and "Consistency looks good on you" cannot be
    // shown to someone who has just joined.
    const forbidden = ['Showed up again', 'Consistency looks good on you'];
    for (const today of days(60)) {
      const message = checkedInMessage({ streak: 1, partnerName: 'Salomeh', userId: 'u1', today });
      for (const phrase of forbidden) expect(message).not.toContain(phrase);
    }
  });

  it('does allow those variants once there is a history', () => {
    const messages = new Set(
      days(60).map((today) =>
        checkedInMessage({ streak: 9, partnerName: 'Salomeh', userId: 'u1', today }),
      ),
    );
    const joined = [...messages].join(' | ');
    expect(joined).toContain('Showed up again');
  });

  it('uses the partner name in the personalised variant', () => {
    const messages = days(60).map((today) =>
      checkedInMessage({ streak: 4, partnerName: 'Salomeh', userId: 'u2', today }),
    );
    const personalised = messages.find((m) => m.includes('Done for today'));
    expect(personalised).toBe('Done for today — Salomeh will see it.');
  });

  it('never shows the personalised variant without a name to use', () => {
    for (const today of days(60)) {
      const message = checkedInMessage({ streak: 4, partnerName: null, userId: 'u1', today });
      expect(message).not.toContain('Done for today');
      // And never leaks the placeholder.
      expect(message).not.toContain('{partner}');
    }
  });

  it('always returns something, even for a first-timer with no partner', () => {
    for (const today of days(30)) {
      const message = checkedInMessage({ streak: 1, partnerName: null, userId: null, today });
      expect(message.length).toBeGreaterThan(5);
      expect(message).not.toContain('{partner}');
    }
  });

  it('differs between two people on the same day, so a pair does not see identical copy', () => {
    const a = days(20).map((today) => checkedInMessage({ streak: 4, partnerName: 'Bo', userId: 'aaa', today }));
    const b = days(20).map((today) => checkedInMessage({ streak: 4, partnerName: 'Ada', userId: 'zzz', today }));
    expect(a.join()).not.toBe(b.join());
  });
});
