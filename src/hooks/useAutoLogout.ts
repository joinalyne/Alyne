import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/** Sign out after this long with no interaction. */
const IDLE_LIMIT_MS = 30 * 60 * 1000;

/** How often to compare the clock against the last interaction. */
const TICK_MS = 60 * 1000;

const ACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'touchstart',
  'visibilitychange',
] as const;

const LAST_ACTIVE_KEY = 'alyne:last-active';

/**
 * Sign a user out after a period of inactivity.
 *
 * Driven by a timestamp in localStorage rather than an in-memory timer, for two
 * reasons. A phone suspends background timers, so a tab left open overnight
 * would never fire one; comparing the clock on wake gets the right answer.
 * And the timestamp is shared across tabs, so activity in one keeps the others
 * alive instead of a background tab logging the user out from under them.
 *
 * Deliberately a soft measure, not a security control. The Supabase session is
 * what actually grants access, and RLS is what protects the data. This just
 * means a shared or forgotten device does not sit signed in indefinitely.
 */
export function useAutoLogout(enabled: boolean) {
  // Held in a ref so the effect does not re-subscribe on every interaction.
  const lastActive = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return;

    const stamp = () => {
      lastActive.current = Date.now();
      try {
        localStorage.setItem(LAST_ACTIVE_KEY, String(lastActive.current));
      } catch {
        // Private browsing can refuse writes. The in-memory value still works
        // for this tab, which is the common case.
      }
    };

    const readShared = (): number => {
      try {
        const stored = Number(localStorage.getItem(LAST_ACTIVE_KEY));
        // Trust whichever is later: another tab may be the active one.
        return Number.isFinite(stored) ? Math.max(stored, lastActive.current) : lastActive.current;
      } catch {
        return lastActive.current;
      }
    };

    stamp();
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, stamp, { passive: true }),
    );

    // Once we have signed out, stop. Without this the interval keeps firing
    // every minute and calls signOut again on each tick, because the stored
    // timestamp is still old.
    let signedOut = false;

    const interval = setInterval(() => {
      if (signedOut) return;
      if (Date.now() - readShared() < IDLE_LIMIT_MS) return;
      signedOut = true;
      clearInterval(interval);
      try {
        localStorage.removeItem(LAST_ACTIVE_KEY);
      } catch {
        // Nothing useful to do; signing out is the important part.
      }
      void supabase.auth.signOut();
    }, TICK_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, stamp));
      clearInterval(interval);
    };
  }, [enabled]);
}

export const AUTO_LOGOUT_IDLE_MS = IDLE_LIMIT_MS;
