import { useCallback, useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Pencil, Trash2, Check, X as XIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { AdminMatchEditModal } from '@/components/AdminMatchEditModal'
import { AdminSeasons } from '@/components/AdminSeasons'
import { AdminRoles } from '@/components/AdminRoles'
import { AdminAuditLog } from '@/components/AdminAuditLog'
import { AdminLadder } from '@/components/AdminLadder'
import type { AchievementDefinition, Match, Player, PlayerAchievement } from '@/lib/types'
import { WEEKDAY_NAMES as DAY_NAMES } from '@/lib/constants'
import { formatDate } from '@/lib/date'

interface EnrichedMatch extends Match {
  player1: Player
  player2: Player
}

function StatusPill({ status }: { status: Match['status'] }) {
  const styles = {
    confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
  }
  const labels = { confirmed: 'Bekreftet', pending: 'Venter', rejected: 'Avvist' }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status]}`}>{labels[status]}</span>
}

export function Admin() {
  const { player } = useAuth()
  const [tab, setTab] = useState<'matches' | 'activity' | 'achievements' | 'seasons' | 'roles' | 'auditlog' | 'ladder'>('matches')
  const [matches, setMatches] = useState<EnrichedMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [editingMatch, setEditingMatch] = useState<EnrichedMatch | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [hiddenDefs, setHiddenDefs] = useState<AchievementDefinition[]>([])
  const [hiddenEarned, setHiddenEarned] = useState<PlayerAchievement[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('matches')
      .select('*, player1:players!matches_player1_id_fkey(*), player2:players!matches_player2_id_fkey(*)')
      .order('created_at', { ascending: false })
      .limit(200)
      .returns<EnrichedMatch[]>()
    setMatches(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    supabase.from('players').select('*').order('name').then(({ data }) => setAllPlayers(data ?? []))
    supabase
      .from('achievement_definitions')
      .select('*')
      .eq('hidden', true)
      .returns<AchievementDefinition[]>()
      .then(({ data }) => setHiddenDefs(data ?? []))
    supabase
      .from('player_achievements')
      .select('*, achievement:achievement_definitions!inner(*)')
      .eq('achievement.hidden', true)
      .returns<PlayerAchievement[]>()
      .then(({ data }) => setHiddenEarned(data ?? []))
  }, [])

  if (!player?.is_admin) {
    return <p className="text-slate-500 dark:text-slate-400">Du har ikke admin-tilgang.</p>
  }

  async function forceConfirm(id: string) {
    setBusyId(id)
    await supabase.rpc('admin_force_confirm_match', { p_match_id: id })
    setBusyId(null)
    await load()
  }

  async function forceReject(id: string) {
    setBusyId(id)
    await supabase.rpc('admin_reject_match', { p_match_id: id })
    setBusyId(null)
    await load()
  }

  async function deleteMatch(id: string) {
    if (!confirm('Slette denne kampen permanent? Rating blir gjenberegnet for alle.')) return
    setBusyId(id)
    await supabase.rpc('admin_delete_match', { p_match_id: id })
    setBusyId(null)
    await load()
  }

  const activePlayers = new Map<string, { name: string; avatar_url: string | null; count: number }>()
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  const monthBuckets = new Map<string, number>()

  matches
    .filter((m) => m.status === 'confirmed')
    .forEach((m) => {
      const date = new Date(m.confirmed_at ?? m.created_at)
      heatmap[date.getDay()][date.getHours()]++
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      monthBuckets.set(monthKey, (monthBuckets.get(monthKey) ?? 0) + 1)
      for (const p of [m.player1, m.player2]) {
        const entry = activePlayers.get(p.id) ?? { name: p.name, avatar_url: p.avatar_url, count: 0 }
        entry.count++
        activePlayers.set(p.id, entry)
      }
    })

  const mostActive = [...activePlayers.values()].sort((a, b) => b.count - a.count)
  const maxHeat = Math.max(1, ...heatmap.flat())
  const monthData = [...monthBuckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, kamper: count }))

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Admin</h1>

      <div className="flex gap-1">
        <button onClick={() => setTab('matches')} className={tab === 'matches' ? 'btn-primary py-1.5 px-3 text-sm' : 'btn-secondary py-1.5 px-3 text-sm'}>
          Kamper
        </button>
        <button onClick={() => setTab('activity')} className={tab === 'activity' ? 'btn-primary py-1.5 px-3 text-sm' : 'btn-secondary py-1.5 px-3 text-sm'}>
          Aktivitet
        </button>
        <button onClick={() => setTab('achievements')} className={tab === 'achievements' ? 'btn-primary py-1.5 px-3 text-sm' : 'btn-secondary py-1.5 px-3 text-sm'}>
          Skjulte achievements
        </button>
        <button onClick={() => setTab('seasons')} className={tab === 'seasons' ? 'btn-primary py-1.5 px-3 text-sm' : 'btn-secondary py-1.5 px-3 text-sm'}>
          Sesonger
        </button>
        <button onClick={() => setTab('roles')} className={tab === 'roles' ? 'btn-primary py-1.5 px-3 text-sm' : 'btn-secondary py-1.5 px-3 text-sm'}>
          Roller
        </button>
        <button onClick={() => setTab('ladder')} className={tab === 'ladder' ? 'btn-primary py-1.5 px-3 text-sm' : 'btn-secondary py-1.5 px-3 text-sm'}>
          Stigespillet
        </button>
        <button onClick={() => setTab('auditlog')} className={tab === 'auditlog' ? 'btn-primary py-1.5 px-3 text-sm' : 'btn-secondary py-1.5 px-3 text-sm'}>
          Aktivitetslogg
        </button>
      </div>

      {tab === 'seasons' && <AdminSeasons />}
      {tab === 'roles' && <AdminRoles />}
      {tab === 'ladder' && <AdminLadder />}
      {tab === 'auditlog' && <AdminAuditLog />}

      {(tab === 'matches' || tab === 'activity' || tab === 'achievements') && (loading ? (
        <p className="text-slate-500">Laster...</p>
      ) : tab === 'matches' ? (
        <div className="flex flex-col gap-2">
          {matches.map((m) => (
            <div key={m.id} className="card p-3 flex items-center gap-3 flex-wrap">
              <StatusPill status={m.status} />
              <span className="flex items-center gap-2 flex-1 min-w-0">
                <PlayerAvatar name={m.player1.name} avatarUrl={m.player1.avatar_url} size="sm" />
                <span className={`truncate text-sm ${m.winner_id === m.player1_id ? 'font-bold' : ''}`}>{m.player1.name}</span>
              </span>
              <span className="font-mono text-sm shrink-0">{m.sets_won_player1 ?? '?'}–{m.sets_won_player2 ?? '?'}</span>
              <span className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                <span className={`truncate text-sm ${m.winner_id === m.player2_id ? 'font-bold' : ''}`}>{m.player2.name}</span>
                <PlayerAvatar name={m.player2.name} avatarUrl={m.player2.avatar_url} size="sm" />
              </span>
              <div className="flex gap-1 shrink-0">
                {m.status === 'pending' && (
                  <>
                    <button disabled={busyId === m.id} onClick={() => forceConfirm(m.id)} className="btn-ghost p-2 text-emerald-600" title="Tving bekreft">
                      <Check size={16} />
                    </button>
                    <button disabled={busyId === m.id} onClick={() => forceReject(m.id)} className="btn-ghost p-2 text-rose-600" title="Avvis">
                      <XIcon size={16} />
                    </button>
                  </>
                )}
                <button disabled={busyId === m.id} onClick={() => setEditingMatch(m)} className="btn-ghost p-2" title="Rediger settscore">
                  <Pencil size={16} />
                </button>
                <button disabled={busyId === m.id} onClick={() => deleteMatch(m.id)} className="btn-ghost p-2 text-rose-600" title="Slett">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'activity' ? (
        <div className="flex flex-col gap-6">
          <div className="card p-4">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Mest aktive spillere</p>
            <div className="flex flex-col gap-2">
              {mostActive.map((p, i) => (
                <div key={p.name + i} className="flex items-center gap-3">
                  <span className="w-5 text-sm text-slate-400">{i + 1}</span>
                  <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                  <span className="flex-1 text-sm">{p.name}</span>
                  <span className="text-sm font-semibold">{p.count} kamper</span>
                </div>
              ))}
            </div>
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

          <div className="card p-4">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Kamper per måned</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthData}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip />
                <Bar dataKey="kamper" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {hiddenDefs.map((d) => {
            const earners = hiddenEarned.filter((e) => e.achievement_id === d.id)
            return (
              <div key={d.id} className="card p-4 flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <span className="text-2xl shrink-0">{d.icon}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{d.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{d.description}</p>
                  </div>
                  <span className="ml-auto text-xs font-medium text-slate-400 shrink-0">{earners.length}/{allPlayers.length}</span>
                </div>
                {earners.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Ingen har fått denne ennå</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {earners.map((e) => {
                      const p = allPlayers.find((pl) => pl.id === e.player_id)
                      if (!p) return null
                      return (
                        <div
                          key={e.id}
                          title={formatDate(e.earned_at)}
                          className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-full pl-1 pr-2.5 py-1"
                        >
                          <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{p.name}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}

      <AdminMatchEditModal
        match={editingMatch}
        onClose={() => setEditingMatch(null)}
        onSaved={() => {
          setEditingMatch(null)
          load()
        }}
      />
    </div>
  )
}
