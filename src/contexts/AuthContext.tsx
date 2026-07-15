import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AccessLevel, Player, PageKey } from '@/lib/types'

export type MfaStatus = 'unenrolled' | 'unverified' | 'verified' | null

interface AuthContextValue {
  session: Session | null
  player: Player | null
  /** The actual logged-in account, regardless of impersonation. Writes that
   * need "my own identity" (profile edit, challenges, self-submitted
   * matches) must key off this, never `player` — the database only ever
   * authorizes actions as this real account anyway (RLS resolves identity
   * from the session's auth.uid(), not anything the client displays). */
  realPlayer: Player | null
  isImpersonating: boolean
  startImpersonation: (target: Player) => void
  stopImpersonation: () => void
  loading: boolean
  permissions: Partial<Record<PageKey, AccessLevel>>
  hasAccess: (page: PageKey, level?: AccessLevel) => boolean
  refreshPlayer: () => Promise<void>
  signOut: () => Promise<void>
  mfaStatus: MfaStatus
  refreshMfaStatus: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [realPlayer, setRealPlayer] = useState<Player | null>(null)
  // Deliberately plain React state, not persisted anywhere — a page refresh
  // exiting impersonation is a reasonable safety default for a feature
  // that's meant to be a temporary "view as" mode, not a standing setting.
  const [impersonatedPlayer, setImpersonatedPlayer] = useState<Player | null>(null)
  const [permissions, setPermissions] = useState<Partial<Record<PageKey, AccessLevel>>>({})
  const [mfaStatus, setMfaStatus] = useState<MfaStatus>(null)
  const [loading, setLoading] = useState(true)

  const player = impersonatedPlayer ?? realPlayer

  // 'unenrolled' = no TOTP factor at all yet (must set one up now).
  // 'unverified' = has a factor, but this session hasn't completed the code
  //   challenge yet (aal1 -> aal2 required).
  // 'verified' = fully authenticated this session (aal2).
  const refreshMfaStatus = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error || !data) {
      setMfaStatus(null)
      return
    }
    if (data.nextLevel !== 'aal2') setMfaStatus('unenrolled')
    else if (data.currentLevel === 'aal2') setMfaStatus('verified')
    else setMfaStatus('unverified')
  }, [])

  const loadPlayer = useCallback(async (userId: string) => {
    const { data } = await supabase.from('players').select('*').eq('auth_user_id', userId).maybeSingle()
    setRealPlayer(data ?? null)
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
        await refreshMfaStatus()
        const p = await loadPlayer(session.user.id)
        await loadPermissions(p)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) {
        await refreshMfaStatus()
        const p = await loadPlayer(session.user.id)
        await loadPermissions(p)
      } else {
        setRealPlayer(null)
        setImpersonatedPlayer(null)
        setPermissions({})
        setMfaStatus(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [loadPlayer, loadPermissions, refreshMfaStatus])

  const refreshPlayer = useCallback(async () => {
    if (session) {
      const p = await loadPlayer(session.user.id)
      await loadPermissions(impersonatedPlayer ?? p)
    }
  }, [session, loadPlayer, loadPermissions, impersonatedPlayer])

  const signOut = useCallback(async () => {
    setImpersonatedPlayer(null)
    await supabase.auth.signOut()
  }, [])

  // Only a genuine admin may start impersonating — checked against
  // realPlayer, never the currently-effective player, so an admin who is
  // themselves impersonating someone can't use this to "impersonate through"
  // to a third identity, and it can never be true for a non-admin no matter
  // what's being displayed.
  const startImpersonation = useCallback(
    (target: Player) => {
      if (!realPlayer?.is_admin) return
      setImpersonatedPlayer(target)
      loadPermissions(target)
    },
    [realPlayer, loadPermissions],
  )

  const stopImpersonation = useCallback(() => {
    setImpersonatedPlayer(null)
    loadPermissions(realPlayer)
  }, [realPlayer, loadPermissions])

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
    <AuthContext.Provider
      value={{
        session,
        player,
        realPlayer,
        isImpersonating: !!impersonatedPlayer,
        startImpersonation,
        stopImpersonation,
        loading,
        permissions,
        hasAccess,
        refreshPlayer,
        signOut,
        mfaStatus,
        refreshMfaStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
