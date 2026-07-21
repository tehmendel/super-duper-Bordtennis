import { useCallback, useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { Pagination } from '@/components/Pagination'
import { usePageSize } from '@/hooks/usePageSize'
import { WEEKDAY_NAMES as DAY_NAMES } from '@/lib/constants'
import { formatDate } from '@/lib/date'
import type { Match, Player, RatingHistoryEntry, Role, RoleAssignment } from '@/lib/types'

interface EnrichedMatch extends Match {
  player1: Player
  player2: Player
}

export function AdminSharedDevice() {
  const [players, setPlayers] = useState<Player[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [assignments, setAssignments] = useState<RoleAssignment[]>([])
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [pagedMatches, setPagedMatches] = useState<EnrichedMatch[]>([])
  const [pagedTotal, setPagedTotal] = useState(0)
  const [deltas, setDeltas] = useState<Record<string, RatingHistoryEntry[]>>({})
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = usePageSize('adminSharedDeviceMatches', 50)
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [promoteId, setPromoteId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loadStatic = useCallback(async () => {
    setLoading(true)
    const [{ data: pl }, { data: r }, { data: ra }, { data: m }] = await Promise.all([
      supabase.from('players').select('*').order('name').returns<Player[]>(),
      supabase.from('roles').select('*').returns<Role[]>(),
      supabase.from('role_assignments').select('*').returns<RoleAssignment[]>(),
      supabase.from('matches').select('*').eq('status', 'confirmed').returns<Match[]>(),
    ])
    setPlayers(pl ?? [])
    setRoles(r ?? [])
    setAssignments(ra ?? [])
    setAllMatches(m ?? [])
    setLoading(false)
  }, [])

  const loadMatchesPage = useCallback(async () => {
    const sharedDeviceIds = players.filter((p) => p.is_shared_device).map((p) => p.id)
    if (sharedDeviceIds.length === 0) {
      setPagedMatches([])
      setPagedTotal(0)
      return
    }
    const from = page * pageSize
    const to = from + pageSize - 1
    const { data, count } = await supabase
      .from('matches')
      .select('*, player1:players!matches_player1_id_fkey(*), player2:players!matches_player2_id_fkey(*)', { count: 'exact' })
      .in('submitted_by', sharedDeviceIds)
      .order('created_at', { ascending: false })
      .range(from, to)
      .returns<EnrichedMatch[]>()
    setPagedMatches(data ?? [])
    setPagedTotal(count ?? 0)
    if (data && data.length > 0) {
      const { data: history } = await supabase
        .from('ratings_history')
        .select('*')
        .in('match_id', data.map((mm) => mm.id))
        .returns<RatingHistoryEntry[]>()
      const grouped: Record<string, RatingHistoryEntry[]> = {}
      history?.forEach((h) => {
        grouped[h.match_id] = [...(grouped[h.match_id] ?? []), h]
      })
      setDeltas(grouped)
    } else {
      setDeltas({})
    }
  }, [players, page, pageSize])

  useEffect(() => {
    loadStatic()
  }, [loadStatic])

  useEffect(() => {
    loadMatchesPage()
  }, [loadMatchesPage])

  useEffect(() => {
    setPage(0)
  }, [pageSize])

  async function togglePromote(playerId: string, next: boolean) {
    setError(null)
    setTogglingId(playerId)
    const { error } = await supabase.rpc('admin_set_shared_device', { p_player_id: playerId, p_is_shared_device: next })
    setTogglingId(null)
    if (error) {
      setError(error.message)
      return
    }
    if (next) setPromoteId('')
    await loadStatic()
  }

  if (loading) return <p className="text-slate-500">Laster...</p>

  const sharedDevicePlayers = players.filter((p) => p.is_shared_device)
  const sharedDeviceIds = new Set(sharedDevicePlayers.map((p) => p.id))
  const sharedMatches = allMatches.filter((m) => sharedDeviceIds.has(m.submitted_by))

  const now = Date.now()
  const daysAgo = (n: number) => now - n * 24 * 60 * 60 * 1000
  const last7 = sharedMatches.filter((m) => new Date(m.confirmed_at ?? m.created_at).getTime() >= daysAgo(7)).length
  const last30 = sharedMatches.filter((m) => new Date(m.confirmed_at ?? m.created_at).getTime() >= daysAgo(30)).length

  const monthBuckets = new Map<string, number>()
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  sharedMatches.forEach((m) => {
    const date = new Date(m.confirmed_at ?? m.created_at)
    heatmap[date.getDay()][date.getHours()]++
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + 1)
  })
  const maxHeat = Math.max(1, ...heatmap.flat())
  const monthData = [...monthBuckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, kamper: count }))

  // Usage per role, held at role level (not per-user), normalized per member
  // account so a single shared device is compared fairly against 7-8
  // individual Standard accounts rather than raw totals.
  const cutoff30 = daysAgo(30)
  const matchesByPlayer = new Map<string, number>()
  allMatches.forEach((m) => {
    if (new Date(m.confirmed_at ?? m.created_at).getTime() < cutoff30) return
    matchesByPlayer.set(m.submitted_by, (matchesByPlayer.get(m.submitted_by) ?? 0) + 1)
  })

  const roleUsage = roles
    .map((role) => {
      const memberIds = assignments.filter((a) => a.role_id === role.id).map((a) => a.player_id)
      const totalMatches = memberIds.reduce((sum, pid) => sum + (matchesByPlayer.get(pid) ?? 0), 0)
      return {
        role,
        memberCount: memberIds.length,
        totalMatches,
        perAccount: memberIds.length > 0 ? totalMatches / memberIds.length : 0,
      }
    })
    .filter((r) => r.memberCount > 0)

  const nonSharedPlayers = players.filter((p) => !p.is_shared_device && !p.is_admin)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-xs text-slate-500">Kamper totalt</p><p className="text-xl font-bold">{sharedMatches.length}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Siste 7 dager</p><p className="text-xl font-bold">{last7}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Siste 30 dager</p><p className="text-xl font-bold">{last30}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Delte enheter</p><p className="text-xl font-bold">{sharedDevicePlayers.length}</p></div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Delte enheter</p>
        {sharedDevicePlayers.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Ingen spillere er satt som delt enhet ennå.</p>
        ) : (
          <div className="card divide-y divide-slate-200 dark:divide-slate-800">
            {sharedDevicePlayers.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 flex-wrap">
                <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                <span className="text-sm flex-1 min-w-0 truncate">
                  {p.name} {p.username && <span className="text-slate-400">@{p.username}</span>}
                </span>
                <Link to={`/players/${p.id}`} className="btn-secondary text-xs py-1.5 px-3 shrink-0">Administrer konto</Link>
                <button
                  onClick={() => togglePromote(p.id, false)}
                  disabled={togglingId === p.id}
                  className="btn-ghost py-1.5 px-2 text-rose-600 text-xs shrink-0"
                  title="Fjern fellesbruker-status"
                >
                  Fjern
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-3 flex-wrap">
          <select value={promoteId} onChange={(e) => setPromoteId(e.target.value)} className="input flex-1 min-w-[12rem]">
            <option value="">Gjør en eksisterende spiller til fellesbruker...</option>
            {nonSharedPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            onClick={() => promoteId && togglePromote(promoteId, true)}
            disabled={!promoteId || togglingId === promoteId}
            className="btn-primary shrink-0"
          >
            Gjør til fellesbruker
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Opprett kontoen først under Spillere, gjør den så om til fellesbruker her. Rolletildeling ("Fellesbrukere") gjøres under Roller.
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Bruk per rolle (siste 30 dager, kamper per konto)</p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="text-left font-medium p-3">Rolle</th>
                <th className="p-3 text-center font-medium">Kontoer</th>
                <th className="p-3 text-center font-medium">Kamper totalt</th>
                <th className="p-3 text-center font-medium">Per konto</th>
              </tr>
            </thead>
            <tbody>
              {roleUsage.map(({ role, memberCount, totalMatches, perAccount }) => (
                <tr key={role.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="p-3 font-medium">
                    {role.name}
                    {role.can_register_for_others && <span className="ml-1.5 text-xs text-slate-400">(fellesbruker-rolle)</span>}
                  </td>
                  <td className="p-3 text-center">{memberCount}</td>
                  <td className="p-3 text-center">{totalMatches}</td>
                  <td className="p-3 text-center font-semibold">{perAccount.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Kamper registrert av delte enheter per måned</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthData}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
            <Tooltip />
            <Bar dataKey="kamper" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-4 overflow-x-auto">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Aktivitetsheatmap (ukedag × klokkeslett)</p>
        <table className="text-xs">
          <thead>
            <tr>
              <th className="p-1"></th>
              {Array.from({ length: 24 }, (_, h) => (
                <th key={h} className="p-0.5 font-normal text-slate-400" style={{ minWidth: 18 }}>
                  {h % 3 === 0 ? h : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAY_NAMES.map((name, day) => (
              <tr key={day}>
                <td className="p-1 pr-2 font-medium text-slate-500">{name}</td>
                {heatmap[day].map((count, hour) => (
                  <td key={hour} className="p-0.5">
                    <div
                      title={`${name} kl. ${hour}: ${count} kamper`}
                      className="w-4 h-4 rounded-sm"
                      style={{ backgroundColor: count === 0 ? 'transparent' : `rgba(37, 99, 235, ${0.15 + (count / maxHeat) * 0.85})`, border: count === 0 ? '1px solid rgb(226 232 240)' : 'none' }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Kamper registrert av delte enheter</p>
        <div className="flex flex-col gap-2">
          {pagedMatches.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Ingen kamper registrert av delte enheter ennå.</p>
          ) : (
            pagedMatches.map((m) => {
              const d1 = deltas[m.id]?.find((d) => d.player_id === m.player1_id)
              const d2 = deltas[m.id]?.find((d) => d.player_id === m.player2_id)
              return (
                <div key={m.id} className="card p-3 flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-slate-400 w-20 shrink-0">{formatDate(m.confirmed_at ?? m.created_at)}</span>
                  <span className="flex items-center gap-2 flex-1 min-w-0">
                    <PlayerAvatar name={m.player1.name} avatarUrl={m.player1.avatar_url} size="sm" />
                    <span className={`truncate text-sm ${m.winner_id === m.player1_id ? 'font-bold' : ''}`}>{m.player1.name}</span>
                    {d1 && (
                      <span className={`text-xs ${d1.delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {d1.delta >= 0 ? '+' : ''}{Math.round(d1.delta)}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-sm shrink-0">{m.sets_won_player1}–{m.sets_won_player2}</span>
                  <span className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                    {d2 && (
                      <span className={`text-xs ${d2.delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {d2.delta >= 0 ? '+' : ''}{Math.round(d2.delta)}
                      </span>
                    )}
                    <span className={`truncate text-sm ${m.winner_id === m.player2_id ? 'font-bold' : ''}`}>{m.player2.name}</span>
                    <PlayerAvatar name={m.player2.name} avatarUrl={m.player2.avatar_url} size="sm" />
                  </span>
                </div>
              )
            })
          )}
          {pagedTotal > 0 && (
            <Pagination page={page} pageSize={pageSize} total={pagedTotal} onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </div>
      </div>
    </div>
  )
}
