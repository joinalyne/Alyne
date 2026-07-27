import { RouterProvider } from 'react-router';
import { router } from './routes';
import { InstallBanner } from './components/InstallBanner';

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <InstallBanner />
    </>
  );
}
