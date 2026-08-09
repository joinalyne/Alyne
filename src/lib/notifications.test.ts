import { describe, it, expect } from 'vitest';
import {
  partnerCheckedIn, streakReminder, matched, partnerReturned,
} from '../../api/_notifications';

/**
 * Salomeh marked this copy LOCKED in her spec, so these tests are as much a
 * guard against well-meaning edits as against bugs. If one fails, the question
 * is whether she agreed to the change, not whether the assertion is stale.
 */

describe('partner checked in', () => {
  it('uses her exact wording', () => {
    const n = partnerCheckedIn('Bo', 12);
    expect(n.title).toBe('Bo just checked in');
    expect(n.body).toBe('Their streak: 12 days. Your move.');
  });

  it('collapses onto one tag so offline arrivals do not stack', () => {
    expect(partnerCheckedIn('Bo', 1).tag).toBe('partner-checkin');
  });
});

describe('streak reminder', () => {
  it('leads with the number once there is something to lose', () => {
    const n = streakReminder(7, 'Bo');
    expect(n.title).toBe("Your streak's waiting");
    expect(n.body).toBe('7 days on the line — check in before the day ends.');
  });

  it('switches to the softer line below three days', () => {
    // Leading with "2 days on the line" would be hollow, which is why her spec
    // branches at three.
    expect(streakReminder(2, 'Bo').body).toBe(
      'A quick check-in keeps you going. Bo will see it.',
    );
  });

  it('branches at exactly three, not above it', () => {
    expect(streakReminder(3, 'Bo').body).toContain('3 days on the line');
    expect(streakReminder(2, 'Bo').body).not.toContain('on the line');
  });

  it('never shames, per her stated principle', () => {
    for (const streak of [0, 1, 3, 30]) {
      const body = streakReminder(streak, 'Bo').body.toLowerCase();
      for (const word of ['failed', 'missed', 'lost', 'let down', 'disappoint']) {
        expect(body).not.toContain(word);
      }
    }
  });
});

describe('matched', () => {
  it('uses her wording and the goal LABEL', () => {
    const n = matched('Bo', 'Writing');
    expect(n.title).toBe("You've been matched! 🌱");
    expect(n.body).toBe(
      "Meet Bo — you're both working on Writing. Say hi with your first check-in.",
    );
  });

  it('is the only notification carrying an emoji, deliberately', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    expect(emoji.test(matched('Bo', 'Writing').title)).toBe(true);
    for (const n of [
      partnerCheckedIn('Bo', 3),
      streakReminder(5, 'Bo'),
      partnerReturned('Bo'),
    ]) {
      expect(emoji.test(n.title + n.body)).toBe(false);
    }
  });
});

describe('partner returned', () => {
  it('uses her wording', () => {
    const n = partnerReturned('Bo');
    expect(n.title).toBe('Bo is back');
    expect(n.body).toBe('They just checked in. Pick it back up together.');
  });

  it('shares the partner-checkin tag, so it replaces rather than stacks', () => {
    expect(partnerReturned('Bo').tag).toBe(partnerCheckedIn('Bo', 1).tag);
  });
});

describe('deep links', () => {
  it('every notification opens somewhere real in the app', () => {
    const routes = ['/home', '/check-in', '/matched'];
    for (const n of [
      partnerCheckedIn('Bo', 3),
      streakReminder(5, 'Bo'),
      matched('Bo', 'Writing'),
      partnerReturned('Bo'),
    ]) {
      expect(routes).toContain(n.url);
    }
  });

  it('never links to /app, which does not exist', () => {
    // Her spec predates the domain decision and says every notification opens
    // /app. The app lives at the root of app.joinalyne.com, so that path would
    // 404.
    for (const n of [
      partnerCheckedIn('Bo', 3),
      streakReminder(5, 'Bo'),
      matched('Bo', 'Writing'),
      partnerReturned('Bo'),
    ]) {
      expect(n.url).not.toBe('/app');
    }
  });
});

describe('day pluralisation', () => {
  it('says "1 day", not "1 days"', () => {
    // Salomeh caught this in a real notification: "Their streak: 1 days".
    expect(partnerCheckedIn('Bo', 1).body).toBe('Their streak: 1 day. Your move.');
  });

  it('keeps the plural for zero and above one', () => {
    expect(partnerCheckedIn('Bo', 0).body).toContain('0 days');
    expect(partnerCheckedIn('Bo', 2).body).toContain('2 days');
    expect(partnerCheckedIn('Bo', 21).body).toContain('21 days');
  });

  it('applies to the streak reminder too, not just the check-in notice', () => {
    // The reminder only shows a number at three or more, so it cannot say
    // "1 days", but the helper is shared so it stays correct if that changes.
    expect(streakReminder(3, 'Bo').body).toContain('3 days on the line');
  });
});
