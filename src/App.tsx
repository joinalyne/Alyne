import { RouterProvider } from 'react-router';
import { router } from './routes';
import { InstallBanner } from './components/InstallBanner';
import { AuthProvider } from './contexts/AuthProvider';
import { useAuth } from './contexts/useAuth';
import { useAutoLogout } from './hooks/useAutoLogout';
import { useClearBadge } from './hooks/useClearBadge';

/**
 * Sits inside AuthProvider so it can see whether anyone is signed in. Renders
 * nothing; it exists only to own the idle timer.
 */
function SessionWatcher() {
  const { session } = useAuth();
  useAutoLogout(!!session);
  // The service worker sets the badge count on push; only the page can tell it
  // the app has been opened.
  useClearBadge(!!session);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <SessionWatcher />
      <RouterProvider router={router} />
      <InstallBanner />
    </AuthProvider>
  );
}
