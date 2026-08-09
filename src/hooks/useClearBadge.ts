import { useEffect } from 'react';

/**
 * Clear the app icon badge whenever the app is opened or refocused.
 *
 * The service worker sets the count when a push arrives, but it cannot observe
 * whether anyone is looking at the app, so the page has to say so. Without this
 * a stale red count sits on the home screen icon after everything has been read,
 * which is worse than no badge at all: it trains people to ignore it.
 *
 * Cleared directly here as well as via the worker. On iOS the page has the
 * permission and the worker may not, and calling twice is harmless.
 */
export function useClearBadge(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn) return;

    const clear = () => {
      // Only when actually visible. Firing on a background tab would clear a
      // badge the user has not seen.
      if (document.visibilityState !== 'visible') return;

      const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
      if (nav.clearAppBadge) void nav.clearAppBadge().catch(() => {});

      // The worker also closes any notifications still sitting in the tray, so
      // the count and the tray agree.
      void navigator.serviceWorker?.ready
        .then((registration) => registration.active?.postMessage({ type: 'clear-badge' }))
        .catch(() => {});
    };

    clear();
    document.addEventListener('visibilitychange', clear);
    window.addEventListener('focus', clear);

    return () => {
      document.removeEventListener('visibilitychange', clear);
      window.removeEventListener('focus', clear);
    };
  }, [signedIn]);
}
