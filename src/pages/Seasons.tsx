import { useCallback, useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { LeaderboardRow, Player, Season, SeasonStanding } from '@/lib/types'

const MEDALS = ['🥇', '🥈', '🥉']

interface StandingRow {
  id: string
  name: string
  avatar_url: string | null
  rating: number
  matches_played: number
  wins: number
  losses: number
}

export function Seasons() {
  const { player } = useAuth()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [rows, setRows] = useState<StandingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [newSeasonName, setNewSeasonName] = useState('')
  const [targetEndDate, setTargetEndDate] = useState('')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSeasons = useCallback(async () => {
    const { data } = await supabase.from('seasons').select('*').order('started_at', { ascending: false }).returns<Season[]>()
    setSeasons(data ?? [])
    const active = data?.find((s) => s.is_active)
    setSelectedId(active?.id ?? data?.[0]?.id ?? '')
  }, [])

  useEffect(() => {
    loadSeasons()
  }, [loadSeasons])

  useEffect(() => {
    if (!selectedId) return
    const season = seasons.find((s) => s.id === selectedId)
    if (!season) return

    setLoading(true)
    if (season.is_active) {
      supabase
        .from('leaderboard')
        .select('*')
        .order('rating', { ascending: false })
        .returns<LeaderboardRow[]>()
        .then(({ data }) => {
          setRows(data ?? [])
          setLoading(false)
        })
    } else {
      supabase
        .from('season_standings')
        .select('*, player:players(*)')
        .eq('season_id', selectedId)
        .order('final_rating', { ascending: false })
        .returns<(SeasonStanding & { player: Player })[]>()
        .then(({ data }) => {
          setRows(
            (data ?? []).map((s) => ({
              id: s.player_id,
              name: s.player.name,
              avatar_url: s.player.avatar_url,
              rating: s.final_rating,
              matches_played: s.matches_played,
              wins: s.wins,
              losses: s.losses,
            })),
          )
          setLoading(false)
        })
    }
  }, [selectedId, seasons])

  async function handleStartNewSeason() {
    if (!newSeasonName.trim()) return
    setStarting(true)
    setError(null)
    const { error } = await supabase.rpc('start_new_season', {
      p_name: newSeasonName.trim(),
      p_target_end_date: targetEndDate ? new Date(targetEndDate).toISOString() : null,
    })
    setStarting(false)
    if (error) {
      setError(error.message)
      return
    }
    setNewSeasonName('')
    setTargetEndDate('')
    await loadSeasons()
  }

  const selectedSeason = seasons.find((s) => s.id === selectedId)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Sesonger</h1>

      <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="input w-auto">
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} {s.is_active ? '(pågår)' : ''}
          </option>
        ))}
      </select>

      {selectedSeason?.target_end_date && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {Math.max(0, Math.ceil((new Date(selectedSeason.target_end_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))} dager igjen
          (slutter {new Date(selectedSeason.target_end_date).toLocaleDateString('no-NO')})
        </p>
      )}

      {loading ? (
        <p className="text-slate-500">Laster...</p>
      ) : (
        <div className="card divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((r, i) => {
            const winRate = r.matches_played > 0 ? Math.round((r.wins / r.matches_played) * 100) : 0
            return (
              <div key={r.id} className="flex items-center gap-3 p-4">
                <span className="w-8 text-center font-bold text-slate-500">{MEDALS[i] ?? i + 1}</span>
                <PlayerAvatar name={r.name} avatarUrl={r.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{r.matches_played} kamper · {winRate}% seiere</p>
                </div>
                <span className="font-bold text-lg">{Math.round(r.rating)}</span>
              </div>
            )
          })}
        </div>
      )}

      {player?.is_admin && selectedSeason?.is_active && (
        <div className="card p-5 flex flex-col gap-3">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Trophy size={16} /> Start ny sesong
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Låser inneværende sesong sine plasseringer og nullstiller alle til 1000 i rating.
          </p>
          <div className="flex gap-2">
            <input
              value={newSeasonName}
              onChange={(e) => setNewSeasonName(e.target.value)}
              placeholder="F.eks. Sesong 2"
              className="input"
            />
            <button onClick={handleStartNewSeason} disabled={starting} className="btn-primary shrink-0">
              {starting ? 'Starter...' : 'Start'}
            </button>
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Planlagt sluttdato (valgfritt, viser nedtelling på dashboard)</label>
            <input type="date" value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} className="input" />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
