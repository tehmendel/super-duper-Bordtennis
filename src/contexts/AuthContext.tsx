import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AccessLevel, Player, PageKey } from '@/lib/types'

interface AuthContextValue {
  session: Session | null
  player: Player | null
  loading: boolean
  permissions: Partial<Record<PageKey, AccessLevel>>
  hasAccess: (page: PageKey, level?: AccessLevel) => boolean
  refreshPlayer: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [permissions, setPermissions] = useState<Partial<Record<PageKey, AccessLevel>>>({})
  const [loading, setLoading] = useState(true)

  const loadPlayer = useCallback(async (userId: string) => {
    const { data } = await supabase.from('players').select('*').eq('auth_user_id', userId).maybeSingle()
    setPlayer(data ?? null)
    return data ?? null
  }, [])

  const loadPermissions = useCallback(async (currentPlayer: Player | null) => {
    if (!currentPlayer) {
      setPermissions({})
      return
    }
    if (currentPlayer.is_admin) {
      setPermissions({}) // is_admin bypasses permission checks entirely (see hasAccess)
      return
    }
    const { data: assignments, error: assignmentsError } = await supabase
      .from('role_assignments')
      .select('role_id')
      .eq('player_id', currentPlayer.id)
    if (assignmentsError) {
      console.error('Kunne ikke laste rolletildelinger, beholder gjeldende tilganger', assignmentsError)
      return
    }
    const roleIds = (assignments ?? []).map((a) => a.role_id)
    if (roleIds.length === 0) {
      setPermissions({})
      return
    }
    const { data: perms, error: permsError } = await supabase.from('role_permissions').select('*').in('role_id', roleIds)
    if (permsError) {
      console.error('Kunne ikke laste rolletilganger, beholder gjeldende tilganger', permsError)
      return
    }
    const merged: Partial<Record<PageKey, AccessLevel>> = {}
    perms?.forEach((p) => {
      const key = p.page_key as PageKey
      if (merged[key] !== 'write') merged[key] = p.access_level
    })
    setPermissions(merged)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) {
        const p = await loadPlayer(session.user.id)
        await loadPermissions(p)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) {
        const p = await loadPlayer(session.user.id)
        await loadPermissions(p)
      } else {
        setPlayer(null)
        setPermissions({})
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [loadPlayer, loadPermissions])

  const refreshPlayer = useCallback(async () => {
    if (session) {
      const p = await loadPlayer(session.user.id)
      await loadPermissions(p)
    }
  }, [session, loadPlayer, loadPermissions])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const hasAccess = useCallback(
    (page: PageKey, level: AccessLevel = 'read') => {
      if (player?.is_admin) return true
      const granted = permissions[page]
      if (!granted) return false
      return level === 'read' ? true : granted === 'write'
    },
    [player, permissions],
  )

  return (
    <AuthContext.Provider value={{ session, player, loading, permissions, hasAccess, refreshPlayer, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
