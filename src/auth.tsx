import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { deviceId } from './lib/device'
import { authError, loginEmail, supabase, supabaseConfigured } from './lib/supabase'

const BUSY = 'Этот аккаунт уже открыт на другом устройстве'

export type Profile = {
  id: string
  username: string
  staff: string
  role: 'admin' | 'waiter'
}

type AuthApi = {
  configured: boolean
  loading: boolean
  deviceReady: boolean
  notice: string
  session: Session | null
  profile: Profile | null
  signIn: (login: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

function missingDeviceRpc(message: string) {
  return message.includes('claim_device') || message.includes('touch_device') || message.includes('release_device')
}

async function callDevice(fn: 'claim_device' | 'touch_device' | 'release_device') {
  if (!supabase) return null
  const { data, error } = await supabase.rpc(fn, { device: deviceId() })
  if (error) return missingDeviceRpc(error.message) ? null : 'Не удалось проверить устройство'
  if (typeof data === 'string' && data !== 'ok') return data
  return null
}

const AuthContext = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(supabaseConfigured)
  const [deviceReady, setDeviceReady] = useState(false)
  const [notice, setNotice] = useState('')
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
      setDeviceReady(false)
      return
    }
    const client = supabase
    let alive = true
    void callDevice('claim_device').then((message) => {
      if (!alive) return
      if (message) {
        setNotice(message)
        setDeviceReady(false)
        void client.auth.signOut()
        return
      }
      setNotice('')
      setDeviceReady(true)
    })
    return () => {
      alive = false
    }
  }, [session])

  useEffect(() => {
    if (!supabase || !session || !deviceReady) return
    const client = supabase
    const beat = () => {
      void callDevice('touch_device').then((message) => {
        if (message !== BUSY) return
        setNotice(BUSY)
        setDeviceReady(false)
        void client.auth.signOut()
      })
    }
    const timer = window.setInterval(beat, 60_000)
    return () => window.clearInterval(timer)
  }, [session, deviceReady])

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
      deviceReady,
      notice,
      session,
      profile,
      signIn: async (login, password) => {
        if (!supabase) return 'База ещё не подключена'
        setNotice('')
        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail(login),
          password,
        })
        return error ? authError(error.message) : null
      },
      signOut: async () => {
        await callDevice('release_device')
        await supabase?.auth.signOut()
      },
    }),
    [loading, deviceReady, notice, session, profile],
  )

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth вне провайдера')
  return value
}
