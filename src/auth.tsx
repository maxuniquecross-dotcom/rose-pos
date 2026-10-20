import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { authError, loginEmail, supabase, supabaseConfigured } from './lib/supabase'

export type Profile = {
  id: string
  username: string
  staff: string
  role: 'admin' | 'waiter'
}

type AuthApi = {
  configured: boolean
  loading: boolean
  session: Session | null
  profile: Profile | null
  signIn: (login: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(supabaseConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    if (!supabase) return
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session) {
      setProfile(null)
      return
    }
    let alive = true
    supabase
      .from('profiles')
      .select('id, username, staff, role')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setProfile((data as Profile | null) ?? null)
      })
    return () => {
      alive = false
    }
  }, [session])

  const api = useMemo<AuthApi>(
    () => ({
      configured: supabaseConfigured,
      loading,
      session,
      profile,
      signIn: async (login, password) => {
        if (!supabase) return 'База ещё не подключена'
        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail(login),
          password,
        })
        return error ? authError(error.message) : null
      },
      signOut: async () => {
        await supabase?.auth.signOut()
      },
    }),
    [loading, session, profile],
  )

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth вне провайдера')
  return value
}
