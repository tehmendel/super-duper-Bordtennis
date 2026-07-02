import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { PAGE_KEYS, PAGE_LABELS, type AccessLevel, type Player, type Role, type RoleAssignment, type RolePermission } from '@/lib/types'

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

  async function togglePermission(roleId: string, pageKey: string, level: AccessLevel) {
    const current = permissions.find((p) => p.role_id === roleId && p.page_key === pageKey)
    const nextLevel: AccessLevel | null = current?.access_level === level ? null : level
    setError(null)
    const { error } = await supabase.rpc('set_role_permission', {
      p_role_id: roleId,
      p_page_key: pageKey,
      p_access_level: nextLevel,
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
      </div>

      <div className="flex gap-2">
        <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Ny rolle..." className="input" />
        <button onClick={handleCreateRole} className="btn-secondary shrink-0"><Plus size={16} /> Opprett</button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

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
                    <th className="p-3 text-center font-medium">Les</th>
                    <th className="p-3 text-center font-medium">Les + skriv</th>
                  </tr>
                </thead>
                <tbody>
                  {PAGE_KEYS.map((key) => {
                    const perm = rolePerms.find((p) => p.page_key === key)
                    return (
                      <tr key={key} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <td className="p-3">{PAGE_LABELS[key]}</td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!perm}
                            onChange={() => togglePermission(selectedRole.id, key, 'read')}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={perm?.access_level === 'write'}
                            onChange={() => togglePermission(selectedRole.id, key, 'write')}
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
