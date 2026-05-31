import { createBrowserRouter } from 'react-router'
import Auth from './pages/Auth'
import CheckEmail from './pages/CheckEmail'
import CheckIn from './pages/CheckIn'
import FindingPartner from './pages/FindingPartner'
import GoalSelection from './pages/GoalSelection'
import Home from './pages/Home'
import Matched from './pages/Matched'
import ProfileSetup from './pages/ProfileSetup'

export const router = createBrowserRouter([
  { path: '/', Component: Auth },
  { path: '/auth', Component: Auth },
  { path: '/check-email', Component: CheckEmail },
  { path: '/profile-setup', Component: ProfileSetup },
  { path: '/goal-selection', Component: GoalSelection },
  { path: '/finding-partner', Component: FindingPartner },
  { path: '/matched', Component: Matched },
  { path: '/home', Component: Home },
  { path: '/check-in', Component: CheckIn },
])
