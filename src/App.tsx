import { RouterProvider } from 'react-router';
import { router } from './routes';
import { InstallBanner } from './components/InstallBanner';
import { AuthProvider } from './contexts/AuthProvider';

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <InstallBanner />
    </AuthProvider>
  );
}
