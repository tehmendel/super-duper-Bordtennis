import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Player } from '@/lib/types'

interface AuthContextValue {
  session: Session | null
  player: Player | null
  loading: boolean
  refreshPlayer: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)

  const loadPlayer = useCallback(async (userId: string) => {
    const { data } = await supabase.from('players').select('*').eq('auth_user_id', userId).maybeSingle()
    setPlayer(data ?? null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) await loadPlayer(session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) {
        await loadPlayer(session.user.id)
      } else {
        setPlayer(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [loadPlayer])

  const refreshPlayer = useCallback(async () => {
    if (session) await loadPlayer(session.user.id)
  }, [session, loadPlayer])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ session, player, loading, refreshPlayer, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
