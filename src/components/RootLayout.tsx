import { Outlet } from 'react-router';
import { InstallBanner } from './InstallBanner';

/**
 * Pathless layout so anything global can see the current route.
 *
 * The install banner lives here rather than in App.tsx, where it sat outside the
 * router and so had no way to tell which screen it was covering — which is why
 * it could not be kept off the signup screen or out of the middle of onboarding.
 */
export function RootLayout() {
  return (
    <>
      <Outlet />
      <InstallBanner />
    </>
  );
}
