import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

/** The columns the app actually reads. Mirrors public.profiles after 0001. */
export type Profile = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  timezone: string
  current_goal: string | null
  plan: 'free' | 'paid'
  current_streak: number
  last_check_in_date: string | null
  is_admin: boolean
}

export type AuthContextValue = {
  session: Session | null
  user: User | null
  /** Null while loading, and for a signed-in user who has not finished onboarding. */
  profile: Profile | null
  loading: boolean
  /** Re-read the profile after onboarding writes to it. */
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
