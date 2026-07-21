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
  canRegisterForOthers: boolean
  refreshPlayer: () => Promise<void>
  signOut: () => Promise<void>
  mfaStatus: MfaStatus
  refreshMfaStatus: () => Promise<void>
  /** Only meaningful for is_shared_device accounts — gates the app behind a
   * PIN screen instead of MFA. Deliberately plain React state, not persisted:
   * a fresh page load re-locks the device, same reasoning as impersonation. */
  pinVerified: boolean
  verifyPin: (pin: string) => Promise<boolean>
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
  const [canRegisterForOthers, setCanRegisterForOthers] = useState(false)
  const [mfaStatus, setMfaStatus] = useState<MfaStatus>(null)
  const [pinVerified, setPinVerified] = useState(false)
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
      setCanRegisterForOthers(false)
      return
    }
    if (currentPlayer.is_admin) {
      setPermissions({}) // is_admin bypasses permission checks entirely (see hasAccess)
      setCanRegisterForOthers(true)
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
      setCanRegisterForOthers(false)
      return
    }
    const [{ data: perms, error: permsError }, { data: roles }] = await Promise.all([
      supabase.from('role_permissions').select('*').in('role_id', roleIds),
      supabase.from('roles').select('can_register_for_others').in('id', roleIds),
    ])
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
    setCanRegisterForOthers((roles ?? []).some((r) => r.can_register_for_others))
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setPinVerified(false)
      if (session) {
        await refreshMfaStatus()
        const p = await loadPlayer(session.user.id)
        await loadPermissions(p)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setPinVerified(false)
      if (session) {
        await refreshMfaStatus()
        const p = await loadPlayer(session.user.id)
        await loadPermissions(p)
      } else {
        setRealPlayer(null)
        setImpersonatedPlayer(null)
        setPermissions({})
        setCanRegisterForOthers(false)
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

  const verifyPin = useCallback(async (pin: string) => {
    const { data, error } = await supabase.rpc('verify_shared_device_pin', { p_pin: pin })
    if (error || !data) return false
    setPinVerified(true)
    return true
  }, [])

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
        canRegisterForOthers,
        refreshPlayer,
        signOut,
        mfaStatus,
        refreshMfaStatus,
        pinVerified,
        verifyPin,
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
