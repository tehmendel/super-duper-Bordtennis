import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, ArrowDown, Minus, Flame, TrendingUp, CalendarDays } from 'lucide-react'
import { startOfMonth, startOfQuarter } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { CardHeader } from '@/components/CardHeader'
import { useCardLayout, type CardDef } from '@/hooks/useCardLayout'
import {
  biggestUpsetEver,
  buildDominanceMatrix,
  closestRivalries,
  longestWinStreakEver,
  mostMatchesInOneDay,
  peakRating,
  previousRatingSnapshot,
} from '@/lib/stats'
import type { LeaderboardRow, Match, Player, RatingHistoryEntry, Season, SeasonStanding } from '@/lib/types'
import { MEDALS } from '@/lib/constants'
import { formatDate } from '@/lib/date'

type Period = 'all' | 'month' | 'quarter' | 'season'

interface Row extends LeaderboardRow {
  periodDelta: number
  periodWins: number
  periodLosses: number
  rankChange: number | null
}

interface HofRecord<T> {
  player: Player
  value: T
}

const CARD_DEFS: CardDef[] = [
  { id: 'upset', title: 'Størst sensasjon noensinne' },
  { id: 'streak', title: 'Lengste seiersrekke noensinne' },
  { id: 'peak', title: 'Høyeste rating noensinne' },
  { id: 'one_day', title: 'Flest kamper på én dag' },
  { id: 'rivalries', title: 'Jevneste rivaliseringer' },
  { id: 'matrix', title: 'Dominansmatrise (seiersprosent)' },
]

export function Leaderboard() {
  const layout = useCardLayout('leaderboard', CARD_DEFS)
  const [period, setPeriod] = useState<Period>('season')
  const [rows, setRows] = useState<Row[]>([])
  const [seasonName, setSeasonName] = useState('')
  const [loading, setLoading] = useState(true)

  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')

  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [allHistory, setAllHistory] = useState<RatingHistoryEntry[]>([])

  useEffect(() => {
    supabase.from('seasons').select('*').order('started_at', { ascending: false }).returns<Season[]>().then(({ data }) => {
      setSeasons(data ?? [])
      const active = data?.find((s) => s.is_active)
      setSeasonName(active?.name ?? '')
      setSelectedSeasonId(active?.id ?? data?.[0]?.id ?? '')
    })
    Promise.all([
      supabase.from('players').select('*').returns<Player[]>(),
      supabase.from('matches').select('*').eq('status', 'confirmed').returns<Match[]>(),
      supabase.from('ratings_history').select('*').returns<RatingHistoryEntry[]>(),
    ]).then(([{ data: p }, { data: m }, { data: h }]) => {
      setAllPlayers(p ?? [])
      setAllMatches(m ?? [])
      setAllHistory(h ?? [])
    })
  }, [])

  useEffect(() => {
    if (period !== 'season') return
    let cancelled = false
    async function loadSeason() {
      if (!selectedSeasonId) return
      setLoading(true)
      const season = seasons.find((s) => s.id === selectedSeasonId)
      if (season?.is_active) {
        const { data: board } = await supabase.from('leaderboard').select('*').order('rating', { ascending: false }).returns<LeaderboardRow[]>()
        if (!cancelled) {
          setRows((board ?? []).map((b) => ({ ...b, periodDelta: 0, periodWins: 0, periodLosses: 0, rankChange: null })))
          setLoading(false)
        }
      } else {
        const { data } = await supabase
          .from('season_standings')
          .select('*, player:players(*)')
          .eq('season_id', selectedSeasonId)
          .order('final_rating', { ascending: false })
          .returns<(SeasonStanding & { player: Player })[]>()
        if (!cancelled) {
          setRows(
            (data ?? []).map((s) => ({
              id: s.player_id,
              name: s.player.name,
              avatar_url: s.player.avatar_url,
              rating: s.final_rating,
              matches_played: s.matches_played,
              wins: s.wins,
              losses: s.losses,
              periodDelta: 0,
              periodWins: 0,
              periodLosses: 0,
              rankChange: null,
            })),
          )
          setLoading(false)
        }
      }
    }
    loadSeason()
    return () => { cancelled = true }
  }, [period, selectedSeasonId, seasons])

  useEffect(() => {
    if (period === 'season') return
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: board } = await supabase
        .from('leaderboard')
        .select('*')
        .returns<LeaderboardRow[]>()
      if (!board) return setLoading(false)

      let enriched: Row[] = board.map((b) => ({ ...b, periodDelta: 0, periodWins: 0, periodLosses: 0, rankChange: null }))

      if (period === 'all') {
        if (allHistory.length > 0) {
          const previousOrder = [...board]
            .map((b) => ({ id: b.id, prevRating: previousRatingSnapshot(allHistory, b.id) }))
            .sort((a, b) => b.prevRating - a.prevRating)
          const previousRank = new Map(previousOrder.map((p, i) => [p.id, i + 1]))
          const currentSorted = [...board].sort((a, b) => b.rating - a.rating)
          enriched = enriched.map((r) => {
            const currentRank = currentSorted.findIndex((c) => c.id === r.id) + 1
            const prevRank = previousRank.get(r.id)
            return { ...r, rankChange: prevRank ? prevRank - currentRank : null }
          })
        }
      }

      if (period !== 'all') {
        const start = (period === 'month' ? startOfMonth(new Date()) : startOfQuarter(new Date())).toISOString()

        const history = allHistory.filter((h) => h.created_at >= start)
        const periodMatches = allMatches.filter((m) => (m.confirmed_at ?? '') >= start)

        const deltaByPlayer: Record<string, number> = {}
        history.forEach((h) => { deltaByPlayer[h.player_id] = (deltaByPlayer[h.player_id] ?? 0) + h.delta })

        const winsByPlayer: Record<string, number> = {}
        const lossesByPlayer: Record<string, number> = {}
        periodMatches.forEach((m) => {
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
  }, [period, allMatches, allHistory])

  const forPlayer = (playerId: string) => allMatches.filter((m) => m.player1_id === playerId || m.player2_id === playerId)

  let longestStreak: HofRecord<number> | null = null
  let mostInOneDay: HofRecord<{ count: number; day: string | null }> | null = null
  let highestPeak: HofRecord<{ rating: number; date: string }> | null = null

  for (const p of allPlayers) {
    const own = forPlayer(p.id)
    const streak = longestWinStreakEver(p.id, own)
    if (!longestStreak || streak > longestStreak.value) longestStreak = { player: p, value: streak }

    const oneDay = mostMatchesInOneDay(own)
    if (!mostInOneDay || oneDay.count > mostInOneDay.value.count) mostInOneDay = { player: p, value: oneDay }

    const peak = peakRating(allHistory.filter((h) => h.player_id === p.id))
    if (peak && (!highestPeak || peak.rating > highestPeak.value.rating)) highestPeak = { player: p, value: peak }
  }

  const historyByMatch: Record<string, RatingHistoryEntry[]> = {}
  allHistory.forEach((h) => {
    historyByMatch[h.match_id] = [...(historyByMatch[h.match_id] ?? []), h]
  })
  const upset = biggestUpsetEver(allMatches, historyByMatch)
  const upsetWinner = upset ? allPlayers.find((p) => p.id === upset.match.winner_id) : null
  const upsetLoser = upset
    ? allPlayers.find((p) => p.id === (upset.match.winner_id === upset.match.player1_id ? upset.match.player2_id : upset.match.player1_id))
    : null

  const matrix = buildDominanceMatrix(allPlayers, allMatches)
  const rivalries = closestRivalries(allMatches).slice(0, 5)

  const recordsById: Record<string, { icon: typeof Flame; color: string; player: Player; description: string } | null> = {
    streak: longestStreak && { icon: Flame, color: 'text-orange-500', player: longestStreak.player, description: `${longestStreak.value} seire på rad` },
    peak: highestPeak && {
      icon: TrendingUp,
      color: 'text-emerald-500',
      player: highestPeak.player,
      description: `${Math.round(highestPeak.value.rating)} poeng (${formatDate(highestPeak.value.date)})`,
    },
    one_day: mostInOneDay && {
      icon: CalendarDays,
      color: 'text-blue-500',
      player: mostInOneDay.player,
      description: `${mostInOneDay.value.count} kamper${mostInOneDay.value.day ? ` (${formatDate(mostInOneDay.value.day)})` : ''}`,
    },
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Toppliste</h1>
          {seasonName && <p className="text-sm text-slate-500 dark:text-slate-400">{seasonName}</p>}
        </div>
        <div className="flex gap-1 flex-wrap items-center">
          {(['season', 'all', 'month', 'quarter'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={period === p ? 'btn-primary py-1.5 px-3 text-sm' : 'btn-secondary py-1.5 px-3 text-sm'}
            >
              {p === 'all' ? 'Alle tider' : p === 'month' ? 'Denne måneden' : p === 'quarter' ? 'Dette kvartalet' : 'Sesong'}
            </button>
          ))}
          {period === 'season' && (
            <select value={selectedSeasonId} onChange={(e) => setSelectedSeasonId(e.target.value)} className="input w-auto text-sm py-1.5">
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>{s.name} {s.is_active ? '(pågår)' : ''}</option>
              ))}
            </select>
          )}
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
                  <p className="font-medium truncate flex items-center gap-1.5">
                    {r.name}
                    {period === 'all' && r.rankChange !== null && r.rankChange !== 0 && (
                      <span className={`inline-flex items-center text-xs font-semibold ${r.rankChange > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {r.rankChange > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        {Math.abs(r.rankChange)}
                      </span>
                    )}
                    {period === 'all' && r.rankChange === 0 && <Minus size={12} className="text-slate-300" />}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {r.matches_played} kamper · {winRate}% seiere
                  </p>
                </div>
                {period === 'all' || period === 'season' ? (
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

      {layout.orderedIds.map((id) => {
        if (id === 'upset') {
          if (!upset || !upsetWinner || !upsetLoser) return null
          return (
            <div key={id} className="card p-5 flex items-center gap-3">
              <Flame size={24} className="text-orange-500 shrink-0" />
              <div className="flex-1">
                <CardHeader layout={layout} cardId={id} className="text-sm font-semibold mb-1" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  <Link to={`/players/${upsetWinner.id}`} className="font-semibold text-brand-600 hover:underline">
                    {upsetWinner.name}
                  </Link>{' '}
                  (rating {Math.round(upset.winnerRatingBefore)}) slo{' '}
                  <Link to={`/players/${upsetLoser.id}`} className="font-semibold hover:underline">
                    {upsetLoser.name}
                  </Link>{' '}
                  (rating {Math.round(upset.loserRatingBefore)}) — en forskjell på {Math.round(upset.margin)} poeng
                </p>
              </div>
            </div>
          )
        }

        if (id === 'rivalries') {
          return (
            <div key={id}>
              <CardHeader layout={layout} cardId={id} />
              {rivalries.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-sm">Ingen par med nok kamper ennå.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {rivalries.map((r) => {
                    const a = allPlayers.find((p) => p.id === r.playerAId)
                    const b = allPlayers.find((p) => p.id === r.playerBId)
                    if (!a || !b) return null
                    return (
                      <div key={r.playerAId + r.playerBId} className="card p-3 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <PlayerAvatar name={a.name} avatarUrl={a.avatar_url} size="sm" />
                          {a.name}
                        </span>
                        <span className="font-mono font-semibold">{r.winsA}–{r.winsB}</span>
                        <span className="flex items-center gap-2">
                          {b.name}
                          <PlayerAvatar name={b.name} avatarUrl={b.avatar_url} size="sm" />
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        }

        if (id === 'matrix') {
          return (
            <div key={id}>
              <CardHeader layout={layout} cardId={id} />
              <div className="card overflow-x-auto">
                <table className="text-xs">
                  <thead>
                    <tr>
                      <th className="p-2"></th>
                      {allPlayers.map((p) => (
                        <th key={p.id} className="p-2 text-center font-medium w-16">
                          <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allPlayers.map((rowPlayer) => (
                      <tr key={rowPlayer.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="p-2 font-medium whitespace-nowrap">{rowPlayer.name}</td>
                        {allPlayers.map((colPlayer) => {
                          if (rowPlayer.id === colPlayer.id) {
                            return <td key={colPlayer.id} className="p-2 text-center text-slate-300 dark:text-slate-700">—</td>
                          }
                          const cell = matrix.get(rowPlayer.id)?.get(colPlayer.id)
                          if (!cell || cell.winRate === null) {
                            return <td key={colPlayer.id} className="p-2 text-center text-slate-300 dark:text-slate-700">·</td>
                          }
                          const pct = Math.round(cell.winRate * 100)
                          return (
                            <td
                              key={colPlayer.id}
                              className="p-2 text-center font-medium"
                              style={{ backgroundColor: `rgba(37, 99, 235, ${cell.winRate * 0.5})` }}
                              title={`${cell.wins}–${cell.losses}`}
                            >
                              {pct}%
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        }

        const r = recordsById[id]
        if (!r) return null
        return (
          <div key={id} className="card p-5 flex items-center gap-4">
            <r.icon size={28} className={`${r.color} shrink-0`} />
            <PlayerAvatar name={r.player.name} avatarUrl={r.player.avatar_url} />
            <div className="flex-1">
              <CardHeader layout={layout} cardId={id} className="text-sm font-semibold mb-1" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <Link to={`/players/${r.player.id}`} className="font-semibold text-brand-600 hover:underline">
                  {r.player.name}
                </Link>{' '}
                — {r.description}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
