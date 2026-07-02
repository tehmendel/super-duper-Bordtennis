import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { startOfMonth, startOfQuarter } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { LeaderboardRow } from '@/lib/types'

type Period = 'all' | 'month' | 'quarter'

const MEDALS = ['🥇', '🥈', '🥉']

interface Row extends LeaderboardRow {
  periodDelta: number
  periodWins: number
  periodLosses: number
}

export function Leaderboard() {
  const [period, setPeriod] = useState<Period>('all')
  const [rows, setRows] = useState<Row[]>([])
  const [seasonName, setSeasonName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('seasons').select('name').eq('is_active', true).maybeSingle().then(({ data }) => {
      if (data) setSeasonName(data.name)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: board } = await supabase
        .from('leaderboard')
        .select('*')
        .returns<LeaderboardRow[]>()
      if (!board) return setLoading(false)

      let enriched: Row[] = board.map((b) => ({ ...b, periodDelta: 0, periodWins: 0, periodLosses: 0 }))

      if (period !== 'all') {
        const start = (period === 'month' ? startOfMonth(new Date()) : startOfQuarter(new Date())).toISOString()

        const { data: history } = await supabase.from('ratings_history').select('*').gte('created_at', start)
        const { data: periodMatches } = await supabase
          .from('matches')
          .select('*')
          .eq('status', 'confirmed')
          .gte('confirmed_at', start)

        const deltaByPlayer: Record<string, number> = {}
        history?.forEach((h) => { deltaByPlayer[h.player_id] = (deltaByPlayer[h.player_id] ?? 0) + h.delta })

        const winsByPlayer: Record<string, number> = {}
        const lossesByPlayer: Record<string, number> = {}
        periodMatches?.forEach((m) => {
          if (!m.winner_id) return
          winsByPlayer[m.winner_id] = (winsByPlayer[m.winner_id] ?? 0) + 1
          const loser = m.winner_id === m.player1_id ? m.player2_id : m.player1_id
          lossesByPlayer[loser] = (lossesByPlayer[loser] ?? 0) + 1
        })

        enriched = enriched.map((r) => ({
          ...r,
          periodDelta: deltaByPlayer[r.id] ?? 0,
          periodWins: winsByPlayer[r.id] ?? 0,
          periodLosses: lossesByPlayer[r.id] ?? 0,
        }))
        enriched.sort((a, b) => b.periodDelta - a.periodDelta)
      } else {
        enriched.sort((a, b) => b.rating - a.rating)
      }

      if (!cancelled) {
        setRows(enriched)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [period])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Topplist</h1>
          {seasonName && <p className="text-sm text-slate-500 dark:text-slate-400">{seasonName}</p>}
        </div>
        <div className="flex gap-1">
          {(['all', 'month', 'quarter'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={period === p ? 'btn-primary py-1.5 px-3 text-sm' : 'btn-secondary py-1.5 px-3 text-sm'}
            >
              {p === 'all' ? 'Alle tider' : p === 'month' ? 'Denne måneden' : 'Dette kvartalet'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">Laster...</p>
      ) : (
        <div className="card divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((r, i) => {
            const winRate = r.matches_played > 0 ? Math.round((r.wins / r.matches_played) * 100) : 0
            return (
              <Link key={r.id} to={`/players/${r.id}`} className="flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <span className="w-8 text-center font-bold text-slate-500">{MEDALS[i] ?? i + 1}</span>
                <PlayerAvatar name={r.name} avatarUrl={r.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{r.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {r.matches_played} kamper · {winRate}% seiere
                  </p>
                </div>
                {period === 'all' ? (
                  <span className="font-bold text-lg">{Math.round(r.rating)}</span>
                ) : (
                  <div className="text-right">
                    <p className={`font-bold ${r.periodDelta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {r.periodDelta >= 0 ? '+' : ''}{Math.round(r.periodDelta)}
                    </p>
                    <p className="text-xs text-slate-500">{r.periodWins}S–{r.periodLosses}T</p>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
