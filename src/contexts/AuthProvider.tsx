import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, type Profile } from './auth-context'

const PROFILE_COLUMNS =
  'id, email, display_name, avatar_url, timezone, current_goal, plan, current_streak, last_check_in_date, is_admin'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  // Two separate flags, combined below.
  //
  // The first version tracked a single `loading` and cleared it inside
  // onAuthStateChange while the profile fetch ran unawaited. Guards then saw
  // `loading: false` with `profile: null` and read that as "signed in but not
  // onboarded" — so refreshing /home threw a fully onboarded user back into
  // profile setup. The fix is that loading must not end until BOTH the session
  // and the profile have settled. Awaiting inside onAuthStateChange is not an
  // option; the Supabase client deadlocks if you call it from its own callback.
  const [sessionResolved, setSessionResolved] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)

  const userId = session?.user.id ?? null

  const loadProfile = useCallback(async (id: string | null) => {
    if (!id) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    setProfileLoading(true)
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
    } else {
      setProfile((data as Profile) ?? null)
    }
    setProfileLoading(false)
  }, [])

  // Session only. The profile is handled by the effect below, keyed on user id,
  // so it cannot race with this one.
  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data: { session: current } }) => {
      if (!active) return
      setSession(current)
      setSessionResolved(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setSessionResolved(true)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!sessionResolved) return
    void loadProfile(userId)
  }, [sessionResolved, userId, loadProfile])

  const refreshProfile = useCallback(async () => {
    await loadProfile(userId)
  }, [loadProfile, userId])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading: !sessionResolved || profileLoading,
      refreshProfile,
    }),
    [session, profile, sessionResolved, profileLoading, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
