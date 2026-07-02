import { useCallback, useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Pencil, Trash2, Check, X as XIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { AdminMatchEditModal } from '@/components/AdminMatchEditModal'
import type { AchievementDefinition, Match, Player, PlayerAchievement } from '@/lib/types'

interface EnrichedMatch extends Match {
  player1: Player
  player2: Player
}

const DAY_NAMES = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør']

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
  const [tab, setTab] = useState<'matches' | 'activity' | 'achievements'>('matches')
  const [matches, setMatches] = useState<EnrichedMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [editingMatch, setEditingMatch] = useState<Match | null>(null)
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
  const dayBuckets = Array(7).fill(0)
  const hourBuckets = Array(24).fill(0)

  matches
    .filter((m) => m.status === 'confirmed')
    .forEach((m) => {
      const date = new Date(m.confirmed_at ?? m.created_at)
      dayBuckets[date.getDay()]++
      hourBuckets[date.getHours()]++
      for (const p of [m.player1, m.player2]) {
        const entry = activePlayers.get(p.id) ?? { name: p.name, avatar_url: p.avatar_url, count: 0 }
        entry.count++
        activePlayers.set(p.id, entry)
      }
    })

  const mostActive = [...activePlayers.values()].sort((a, b) => b.count - a.count)
  const dayData = DAY_NAMES.map((name, i) => ({ name, kamper: dayBuckets[i] }))
  const hourData = Array.from({ length: 24 }, (_, h) => ({ name: `${h}`, kamper: hourBuckets[h] }))

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
      </div>

      {loading ? (
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

          <div className="card p-4">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Populære ukedager</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dayData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip />
                <Bar dataKey="kamper" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-4">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Populære klokkeslett</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={hourData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip />
                <Bar dataKey="kamper" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="text-left font-medium p-3">Spiller</th>
                {hiddenDefs.map((d) => (
                  <th key={d.id} className="p-3 text-center" title={d.description}>
                    <span className="text-xl">{d.icon}</span>
                    <div className="text-xs font-normal text-slate-500 dark:text-slate-400">{d.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allPlayers.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                      <span className="truncate">{p.name}</span>
                    </div>
                  </td>
                  {hiddenDefs.map((d) => {
                    const earned = hiddenEarned.find((e) => e.player_id === p.id && e.achievement_id === d.id)
                    return (
                      <td key={d.id} className="p-3 text-center">
                        {earned ? (
                          <span title={new Date(earned.earned_at).toLocaleDateString('no-NO')}>✅</span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
