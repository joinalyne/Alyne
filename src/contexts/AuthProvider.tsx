import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, type Profile } from './auth-context'

// One literal, deliberately long. PostgREST infers the row type from the select
// string, so splitting it into a concatenation loses the inference and the result
// widens to an error type.
const PROFILE_COLUMNS =
  'id, email, display_name, avatar_url, timezone, current_goal, plan, cancel_at_period_end, current_period_end, current_streak, last_check_in_date, is_admin'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionResolved, setSessionResolved] = useState(false)
  const [loadedProfile, setLoadedProfile] = useState<Profile | null>(null)

  // Which user id `loadedProfile` belongs to. Undefined means nothing has been
  // fetched yet. This is what `loading` is derived from, rather than a separate
  // boolean that an effect has to set synchronously.
  const [loadedFor, setLoadedFor] = useState<string | undefined>(undefined)

  const userId = session?.user.id ?? null

  const loadProfile = useCallback(async (id: string) => {
    // maybeSingle, not single: a user who signed up but abandoned onboarding
    // has no profile row yet, and that is a valid state, not an error.
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[auth] could not load profile:', error.message)
      setLoadedProfile(null)
    } else {
      setLoadedProfile((data as Profile) ?? null)
    }
    // Last, and only after the await, so nothing in this function runs
    // synchronously during the effect that calls it.
    setLoadedFor(id)
  }, [])

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
    if (!sessionResolved || !userId) return
    // loadProfile awaits before it touches state, so nothing is set
    // synchronously during this effect. The rule traces setState calls
    // interprocedurally and cannot see past the await, so it flags every
    // fetch-on-mount; ResetPassword has the same shape. The alternative is a
    // data-fetching library, which is not worth adding for one query.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile(userId)
  }, [sessionResolved, userId, loadProfile])

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId)
  }, [loadProfile, userId])

  const value = useMemo(() => {
    // Derived rather than cleared by an effect: a signed-out user has no
    // profile by definition, and a profile belonging to a previous user must
    // never leak into the next session.
    const profile = userId && loadedFor === userId ? loadedProfile : null

    // Signed out is a settled state, so loading ends once the session resolves.
    // Signed in is not settled until that user's profile has been fetched —
    // ending loading early is what previously made guards read a fully
    // onboarded user as "not onboarded" and bounce them into profile setup.
    const profileSettled = userId === null || loadedFor === userId

    return {
      session,
      user: session?.user ?? null,
      profile,
      loading: !sessionResolved || !profileSettled,
      refreshProfile,
    }
  }, [session, userId, loadedProfile, loadedFor, sessionResolved, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
