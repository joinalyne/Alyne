import { describe, it, expect } from 'vitest';
import { checkInButtonStyle, ACTIVE_GREEN, CHECKED_IN_GREEN } from './checkInButton';

/**
 * Guards the fix for the band Salomeh reported twice. The first attempt reset
 * -webkit-appearance and shipped without fixing anything, so the point of these
 * is to fail if the translucent approach ever comes back.
 */

describe('check in button', () => {
  it('is never translucent in either state', () => {
    // The whole bug. Any opacity below 1 lets the partner card's drop shadow
    // show through the top of the button.
    for (const checkedIn of [true, false]) {
      const style = checkInButtonStyle(checkedIn);
      expect(style.opacity).toBeUndefined();
    }
  });

  it('shows the inactive state as a solid colour, not a faded one', () => {
    const style = checkInButtonStyle(true);
    expect(style.backgroundColor).toBe(CHECKED_IN_GREEN);
    expect(style.backgroundColor).not.toContain('rgba');
    expect(style.backgroundColor).not.toContain('transparent');
  });

  it('uses the full green when there is still a check-in to make', () => {
    expect(checkInButtonStyle(false).backgroundColor).toBe(ACTIVE_GREEN);
  });

  it('distinguishes the two states, so checked-in still reads as done', () => {
    expect(checkInButtonStyle(true).backgroundColor).not.toBe(
      checkInButtonStyle(false).backgroundColor,
    );
  });

  it('keeps the checked-in colour visually equivalent to the old 60% fade', () => {
    // #104241 at 60% over the #F4F4F4 page, computed channel by channel. This is
    // what makes the fix invisible to her: same appearance, no transparency.
    const blend = (fg: number, bg: number) => Math.round(0.6 * fg + 0.4 * bg);
    const expected =
      '#' +
      [
        [0x10, 0xf4],
        [0x42, 0xf4],
        [0x41, 0xf4],
      ]
        .map(([fg, bg]) => blend(fg, bg).toString(16).padStart(2, '0'))
        .join('');
    expect(CHECKED_IN_GREEN.toLowerCase()).toBe(expected);
  });

  it('does not let the inactive button carry more weight than the active one', () => {
    // Opacity used to fade the shadow too, so at full strength the checked-in
    // button would look heavier than the one asking to be pressed.
    const alpha = (shadow: string) => Number(shadow.match(/,([\d.]+)\)$/)?.[1]);
    expect(alpha(String(checkInButtonStyle(true).boxShadow))).toBeLessThan(
      alpha(String(checkInButtonStyle(false).boxShadow)),
    );
  });

  it('keeps white text, which both states were designed around', () => {
    for (const checkedIn of [true, false]) {
      expect(checkInButtonStyle(checkedIn).color).toBe('#FFFFFF');
    }
  });
});
