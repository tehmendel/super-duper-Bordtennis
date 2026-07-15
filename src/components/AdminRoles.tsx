import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Star, ShieldCheck, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { PAGE_KEYS, PAGE_LABELS, type AccessLevel, type PageKey, type Player, type Role, type RoleAssignment, type RolePermission } from '@/lib/types'

const WRITE_ACCESS_EXPLANATION: Record<PageKey, string> = {
  dashboard: 'Ingen skrivehandlinger på Dashboard i dag – skriv gir samme tilgang som les.',
  new_match: 'Gir mulighet til å registrere nye kamper.',
  pending: 'Gir mulighet til å bekrefte eller avvise kamper som venter på bekreftelse.',
  history: 'Ingen skrivehandlinger på selve siden – skriv gir samme tilgang som les.',
  leaderboard: 'Ingen skrivehandlinger på Toppliste – skriv gir samme tilgang som les.',
  head_to_head: 'Ingen skrivehandlinger på Head-to-head – skriv gir samme tilgang som les.',
  tournaments: 'Gir mulighet til å opprette nye turneringer, avslutte pågående turneringer, registrere kampresultater og redigere deltakere/kampoppsett i en pågående turnering. Å slette en turnering er uansett forbeholdt admin.',
  ladder: 'Gir mulighet til å utfordre spilleren over deg på Stigespillet.',
  qr: 'Ingen skrivehandlinger på QR-siden – skriv gir samme tilgang som les.',
  players: 'Gir mulighet til å legge til nye spillere (får automatisk generert brukernavn/passord). Å redigere, tilbakestille passord for, eller slette eksisterende spillere er uansett forbeholdt admin, uavhengig av denne rollen.',
  profile_edit: 'Gir mulighet til å endre eget navn, profilbilde og passord.',
}

// Capabilities that don't live behind any PAGE_KEY at all -- is_admin alone
// gates them, everywhere in the app, regardless of any role's permissions.
const ADMIN_EXTRA_CAPABILITIES = [
  'Full tilgang til Admin-panelet: tvinge bekreft/avvis eller slette enhver kamp, redigere settscore i etterkant, se skjulte prestasjoner, administrere sesonger, administrere roller, administrere Stigespillet og se hele aktivitetsloggen.',
  'Spilleradministrasjon: redigere navn/bilde, endre brukernavn, tilbakestille passord og tilbakestille topartsinnlogging (MFA) for enhver spiller, samt slette spillere.',
  'Turneringsadministrasjon utover start/stopp/redigering: slette turneringer permanent.',
  'Tilpasse dashbord og sidevisninger for alle (redigeringsmodus for kort/titler).',
]

const ADMIN_PSEUDO_ID = '__admin__'

export function AdminRoles() {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<RolePermission[]>([])
  const [assignments, setAssignments] = useState<RoleAssignment[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [newRoleName, setNewRoleName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: r }, { data: p }, { data: a }, { data: pl }] = await Promise.all([
      supabase.from('roles').select('*').order('created_at').returns<Role[]>(),
      supabase.from('role_permissions').select('*').returns<RolePermission[]>(),
      supabase.from('role_assignments').select('*').returns<RoleAssignment[]>(),
      supabase.from('players').select('*').order('name').returns<Player[]>(),
    ])
    setRoles(r ?? [])
    setPermissions(p ?? [])
    setAssignments(a ?? [])
    setPlayers(pl ?? [])
    setSelectedRoleId((current) => current || r?.[0]?.id || '')
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreateRole() {
    if (!newRoleName.trim()) return
    setError(null)
    const { data, error } = await supabase.rpc('create_role', { p_name: newRoleName.trim() })
    if (error) return setError(error.message)
    setNewRoleName('')
    await load()
    if (data) setSelectedRoleId(data)
  }

  async function handleDeleteRole(roleId: string) {
    if (!confirm('Slette denne rollen? Medlemmer mister tilgangene den ga.')) return
    setError(null)
    const { error } = await supabase.rpc('delete_role', { p_role_id: roleId })
    if (error) return setError(error.message)
    await load()
  }

  async function handleSetDefault(roleId: string) {
    setError(null)
    const { error } = await supabase.rpc('set_default_role', { p_role_id: roleId })
    if (error) return setError(error.message)
    await load()
  }

  async function setPermission(roleId: string, pageKey: string, level: AccessLevel | null) {
    setError(null)
    const { error } = await supabase.rpc('set_role_permission', {
      p_role_id: roleId,
      p_page_key: pageKey,
      p_access_level: level,
    })
    if (error) return setError(error.message)
    await load()
  }

  async function toggleMember(roleId: string, playerId: string, assigned: boolean) {
    setError(null)
    const { error } = await supabase.rpc('set_role_assignment', {
      p_role_id: roleId,
      p_player_id: playerId,
      p_assigned: !assigned,
    })
    if (error) return setError(error.message)
    await load()
  }

  if (loading) return <p className="text-slate-500">Laster...</p>

  const selectedRole = roles.find((r) => r.id === selectedRoleId)
  const rolePerms = permissions.filter((p) => p.role_id === selectedRoleId)
  const roleMemberIds = new Set(assignments.filter((a) => a.role_id === selectedRoleId).map((a) => a.player_id))
  const showingAdmin = selectedRoleId === ADMIN_PSEUDO_ID
  const adminPlayers = players.filter((p) => p.is_admin)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedRoleId(r.id)}
            className={r.id === selectedRoleId ? 'btn-primary py-1.5 px-3 text-sm' : 'btn-secondary py-1.5 px-3 text-sm'}
          >
            {r.is_default && <Star size={12} className="inline mr-1" />}
            {r.name}
          </button>
        ))}
        <button
          onClick={() => setSelectedRoleId(ADMIN_PSEUDO_ID)}
          className={showingAdmin ? 'btn-primary py-1.5 px-3 text-sm' : 'btn-secondary py-1.5 px-3 text-sm'}
        >
          <ShieldCheck size={12} className="inline mr-1" />
          Admin
        </button>
      </div>

      <div className="flex gap-2">
        <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Ny rolle..." className="input" />
        <button onClick={handleCreateRole} className="btn-secondary shrink-0"><Plus size={16} /> Opprett</button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {showingAdmin && (
        <>
          <div className="card p-5">
            <p className="font-semibold flex items-center gap-2">
              <ShieldCheck size={16} className="text-brand-600 dark:text-brand-400" />
              Admin
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Innebygd rolle, styrt av "Administrator"-bryteren på hver spiller (ikke en rolle fra listen over, og kan ikke redigeres
              eller slettes her). Admin har alltid full tilgang til alt, uansett hva rollene deres ellers sier.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Tilgang per side</p>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left font-medium p-3">Side</th>
                    <th className="p-3 text-center font-medium">Tilgang</th>
                  </tr>
                </thead>
                <tbody>
                  {PAGE_KEYS.map((key) => (
                    <tr key={key} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <td className="p-3">{PAGE_LABELS[key]}</td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          <Check size={14} /> Les + skriv
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Utvidede rettigheter (utover sidetilganger)</p>
            <div className="card divide-y divide-slate-200 dark:divide-slate-800">
              {ADMIN_EXTRA_CAPABILITIES.map((text) => (
                <p key={text} className="text-sm p-3 flex items-start gap-2">
                  <ShieldCheck size={14} className="text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
                  {text}
                </p>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Medlemmer</p>
            {adminPlayers.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Ingen spillere har admin-tilgang.</p>
            ) : (
              <div className="card divide-y divide-slate-200 dark:divide-slate-800">
                {adminPlayers.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3">
                    <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                    <span className="text-sm flex-1">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Admin-tilgang gis og fjernes direkte i databasen, ikke herfra.
            </p>
          </div>
        </>
      )}

      {selectedRole && (
        <>
          <div className="card p-5 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-semibold flex items-center gap-2">
                {selectedRole.name}
                {selectedRole.is_default && <span className="text-xs text-amber-600 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-0.5 rounded-full">Standardrolle</span>}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Alle nye spillere meldes automatisk inn i standardrollen.</p>
            </div>
            <div className="flex gap-2">
              {!selectedRole.is_default && (
                <button onClick={() => handleSetDefault(selectedRole.id)} className="btn-secondary text-sm py-1.5 px-3">Gjør til standard</button>
              )}
              {!selectedRole.is_default && (
                <button onClick={() => handleDeleteRole(selectedRole.id)} className="btn-ghost p-2 text-rose-600"><Trash2 size={16} /></button>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Tilgang per side</p>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left font-medium p-3">Side</th>
                    <th className="p-3 text-center font-medium">Ingen</th>
                    <th className="p-3 text-center font-medium">Les</th>
                    <th className="p-3 text-center font-medium" title="Hold musepekeren over en radioknapp i denne kolonnen for å se hva skrivetilgang faktisk gir på den siden.">
                      Les + skriv
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PAGE_KEYS.map((key) => {
                    const perm = rolePerms.find((p) => p.page_key === key)
                    const level = perm?.access_level ?? null
                    return (
                      <tr key={key} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <td className="p-3">{PAGE_LABELS[key]}</td>
                        <td className="p-3 text-center">
                          <input
                            type="radio"
                            name={`access-${key}`}
                            checked={level === null}
                            onChange={() => setPermission(selectedRole.id, key, null)}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="radio"
                            name={`access-${key}`}
                            checked={level === 'read'}
                            onChange={() => setPermission(selectedRole.id, key, 'read')}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="p-3 text-center" title={WRITE_ACCESS_EXPLANATION[key]}>
                          <input
                            type="radio"
                            name={`access-${key}`}
                            checked={level === 'write'}
                            onChange={() => setPermission(selectedRole.id, key, 'write')}
                            className="w-4 h-4"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Medlemmer</p>
            <div className="card divide-y divide-slate-200 dark:divide-slate-800">
              {players.map((p) => {
                const isMember = roleMemberIds.has(p.id)
                return (
                  <label key={p.id} className="flex items-center gap-3 p-3 cursor-pointer">
                    <input type="checkbox" checked={isMember} onChange={() => toggleMember(selectedRole.id, p.id, isMember)} className="w-4 h-4" />
                    <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                    <span className="text-sm flex-1">{p.name}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
