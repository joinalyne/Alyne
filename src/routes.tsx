import { createBrowserRouter } from "react-router";
import Auth from "./pages/Auth";
import CheckEmail from "./pages/CheckEmail";
import ProfileSetup from "./pages/ProfileSetup";
import GoalSelection from "./pages/GoalSelection";
import FindingPartner from "./pages/FindingPartner";
import Matched from "./pages/Matched";
import Home from "./pages/Home";
import CheckIn from "./pages/CheckIn";
import Settings from "./pages/Settings";
import HomeEmpty from "./pages/HomeEmpty";
import Admin from "./pages/Admin";
import ResetPassword from "./pages/ResetPassword";
import Upgrade from "./pages/Upgrade";
import Install from "./pages/Install";
import { RequireAuth, RequireAdmin, RedirectIfSignedIn } from "./components/RequireAuth";

// `requireOnboarded={false}` on the onboarding screens themselves: the guard
// redirects an un-onboarded user *to* these routes, so demanding a completed
// profile here would loop.
export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <RedirectIfSignedIn>
        <Auth />
      </RedirectIfSignedIn>
    ),
  },
  {
    path: "/check-email",
    Component: CheckEmail,
  },
  {
    // Reached from an emailed recovery link, so it must stay public: the user
    // is not signed in when they arrive.
    path: "/reset-password",
    Component: ResetPassword,
  },
    {
    path: "/install",
    Component: Install,
  },
  {
    path: "/profile-setup",
    element: (
      <RequireAuth requireOnboarded={false}>
        <ProfileSetup />
      </RequireAuth>
    ),
  },
  {
    path: "/goal-selection",
    element: (
      <RequireAuth requireOnboarded={false}>
        <GoalSelection />
      </RequireAuth>
    ),
  },
  {
    path: "/finding-partner",
    element: (
      <RequireAuth>
        <FindingPartner />
      </RequireAuth>
    ),
  },
  {
    path: "/matched",
    element: (
      <RequireAuth>
        <Matched />
      </RequireAuth>
    ),
  },
  {
    path: "/home",
    element: (
      <RequireAuth>
        <Home />
      </RequireAuth>
    ),
  },
  {
    path: "/check-in",
    element: (
      <RequireAuth>
        <CheckIn />
      </RequireAuth>
    ),
  },
  {
    path: "/settings",
    element: (
      <RequireAuth>
        <Settings />
      </RequireAuth>
    ),
  },
  {
    path: "/home-empty",
    element: (
      <RequireAuth>
        <HomeEmpty />
      </RequireAuth>
    ),
  },
  {
    path: "/upgrade",
    element: (
      <RequireAuth>
        <Upgrade />
      </RequireAuth>
    ),
  },
  {
    path: "/admin",
    element: (
      <RequireAdmin>
        <Admin />
      </RequireAdmin>
    ),
  },
]);
