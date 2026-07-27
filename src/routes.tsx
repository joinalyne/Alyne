import { createBrowserRouter } from "react-router";
import Auth from "./pages/Auth";
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

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Auth,
  },
  {
    path: "/profile-setup",
    Component: ProfileSetup,
  },
  {
    path: "/goal-selection",
    Component: GoalSelection,
  },
  {
    path: "/finding-partner",
    Component: FindingPartner,
  },
  {
    path: "/matched",
    Component: Matched,
  },
  {
    path: "/home",
    Component: Home,
  },
  {
    path: "/check-in",
    Component: CheckIn,
  },
  {
    path: "/settings",
    Component: Settings,
  },
  {
    path: "/home-empty",
    Component: HomeEmpty,
  },
  {
    path: "/admin",
    Component: Admin,
  },
  {
    path: "/reset-password",
    Component: ResetPassword,
  },
  {
    path: "/upgrade",
    Component: Upgrade,
  },
]);