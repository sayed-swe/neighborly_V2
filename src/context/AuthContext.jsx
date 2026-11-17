import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getProfile } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return }
    try {
      // The profile row is created by a trigger right after sign-up; retry briefly.
      for (let i = 0; i < 4; i++) {
        const p = await getProfile(userId)
        if (p) { setProfile(p); return }
        await new Promise((r) => setTimeout(r, 400))
      }
      setProfile(null)
    } catch (e) {
      console.error(e)
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session?.user?.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      // defer: calling supabase inside this callback synchronously can deadlock
      setTimeout(() => loadProfile(s?.user?.id), 0)
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [loadProfile])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    isAdmin: profile?.role === 'admin' || profile?.role === 'moderator',
    refreshProfile: () => loadProfile(session?.user?.id),
    signOut: () => supabase.auth.signOut(),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
