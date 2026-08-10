import type { CSSProperties } from 'react';

/**
 * The main Check In button's appearance, in both states.
 *
 * Extracted and tested because the checked-in state has now been misdiagnosed
 * once. Salomeh reported "a weird darker band across the top" of the button on
 * her iPhone. It looked like an iOS rendering quirk, so the first fix reset
 * -webkit-appearance on every button. It was not iOS.
 *
 * The cause is ordinary CSS: the partner card above has a 24px bottom margin and
 * a `0 6px 20px` shadow, which reaches about 26px down and so lands on the top of
 * this button. Making the button translucent — `disabled:opacity-60` in the
 * checked-in state — let that shadow show THROUGH it, as a dark band across the
 * top, fading downward. It appeared only when checked in because that is the only
 * state that was translucent.
 *
 * So the rule this encodes: express the inactive state with a solid colour, never
 * with opacity. #6B8989 is exactly what #104241 at 60% looked like over the
 * #F4F4F4 page, so the button keeps the appearance already signed off while no
 * longer revealing anything behind it.
 */
export const ACTIVE_GREEN = '#104241';

/** #104241 at 60% over #F4F4F4, flattened. Same look, fully opaque. */
export const CHECKED_IN_GREEN = '#6B8989';

export function checkInButtonStyle(checkedIn: boolean): CSSProperties {
  return {
    backgroundColor: checkedIn ? CHECKED_IN_GREEN : ACTIVE_GREEN,
    color: '#FFFFFF',
    borderRadius: '1.25rem',
    padding: '18px',
    fontSize: '1.1rem',
    fontWeight: 700,
    // Softened rather than dropped when checked in. The opacity that used to fade
    // this shadow has gone, so at full strength it would make the inactive button
    // heavier than the active one.
    boxShadow: checkedIn
      ? '0 4px 20px rgba(16,66,65,0.15)'
      : '0 4px 20px rgba(16,66,65,0.25)',
  };
}
