import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../contexts/useAuth';

/**
 * Client-side route guard.
 *
 * Every page was publicly reachable before M1 — /home, /admin and the rest all
 * rendered signed-out against mock data. RLS meant no real data leaked, but the
 * screens were still reachable.
 *
 * Guards are deliberately client-side only. This is a static SPA, so there is
 * no server to redirect from, and that is the safer shape anyway: RLS is the
 * actual security boundary, and these guards are navigation, not enforcement.
 */
export function RequireAuth({
  children,
  requireOnboarded = true,
}: {
  children: ReactNode;
  /** Set false on the onboarding screens themselves, or they redirect to themselves. */
  requireOnboarded?: boolean;
}) {
  const { session, profile, loading } = useAuth();

  // Render nothing rather than a spinner: the session usually resolves from
  // local storage within a frame, and a flashed loader looks like a bug.
  if (loading) return null;

  if (!session) return <Navigate to="/" replace />;

  if (requireOnboarded) {
    if (!profile?.display_name) return <Navigate to="/profile-setup" replace />;
    if (!profile.current_goal) return <Navigate to="/goal-selection" replace />;
  }

  return <>{children}</>;
}

/** /admin is Salomeh's. Backed by profiles.is_admin and enforced in RLS. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading) return null;
  if (!session) return <Navigate to="/" replace />;
  if (!profile?.is_admin) return <Navigate to="/home" replace />;

  return <>{children}</>;
}

/**
 * The inverse: keep a signed-in user off the sign-up screen. Without this,
 * returning to "/" from a bookmark shows the logged-out form to someone who is
 * already logged in.
 */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();

  if (loading) return null;
  if (!session) return <>{children}</>;

  if (!profile?.display_name) return <Navigate to="/profile-setup" replace />;
  if (!profile.current_goal) return <Navigate to="/goal-selection" replace />;
  return <Navigate to="/home" replace />;
}
