import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, type Profile } from './auth-context'

const PROFILE_COLUMNS =
  'id, email, display_name, avatar_url, timezone, current_goal, plan, current_streak, last_check_in_date, is_admin'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const userId = session?.user.id ?? null

  const loadProfile = useCallback(async (id: string | null) => {
    if (!id) {
      setProfile(null)
      return
    }
    // maybeSingle, not single: a user who signed up but abandoned onboarding
    // has no profile row yet, and that is a valid state, not an error.
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[auth] could not load profile:', error.message)
      setProfile(null)
      return
    }
    setProfile((data as Profile) ?? null)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data: { session: current } }) => {
      if (!active) return
      setSession(current)
      await loadProfile(current?.user.id ?? null)
      if (active) setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      // Deliberately not awaited: onAuthStateChange must not block, and the
      // Supabase client deadlocks if you await its own calls inside the callback.
      void loadProfile(nextSession?.user.id ?? null)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    await loadProfile(userId)
  }, [loadProfile, userId])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      refreshProfile,
    }),
    [session, profile, loading, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
