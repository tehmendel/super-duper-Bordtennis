import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Crown, Flame, TrendingUp, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { CardHeader } from '@/components/CardHeader'
import { useCardLayout, type CardDef } from '@/hooks/useCardLayout'
import { biggestUpsetEver, longestWinStreakEver, mostMatchesInOneDay, peakRating } from '@/lib/stats'
import type { Match, Player, RatingHistoryEntry } from '@/lib/types'

interface HofRecord<T> {
  player: Player
  value: T
}

const CARD_DEFS: CardDef[] = [
  { id: 'upset', title: 'Størst upset noensinne' },
  { id: 'streak', title: 'Lengste seiersrekke noensinne' },
  { id: 'peak', title: 'Høyeste rating noensinne' },
  { id: 'one_day', title: 'Flest kamper på én dag' },
]

export function HallOfFame() {
  const layout = useCardLayout('hall_of_fame', CARD_DEFS)
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [history, setHistory] = useState<RatingHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('players').select('*').returns<Player[]>(),
      supabase.from('matches').select('*').eq('status', 'confirmed').returns<Match[]>(),
      supabase.from('ratings_history').select('*').returns<RatingHistoryEntry[]>(),
    ]).then(([{ data: p }, { data: m }, { data: h }]) => {
      setPlayers(p ?? [])
      setMatches(m ?? [])
      setHistory(h ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="text-slate-500">Laster...</p>

  const forPlayer = (playerId: string) => matches.filter((m) => m.player1_id === playerId || m.player2_id === playerId)

  let longestStreak: HofRecord<number> | null = null
  let mostInOneDay: HofRecord<{ count: number; day: string | null }> | null = null
  let highestPeak: HofRecord<{ rating: number; date: string }> | null = null

  for (const p of players) {
    const own = forPlayer(p.id)
    const streak = longestWinStreakEver(p.id, own)
    if (!longestStreak || streak > longestStreak.value) longestStreak = { player: p, value: streak }

    const oneDay = mostMatchesInOneDay(own)
    if (!mostInOneDay || oneDay.count > mostInOneDay.value.count) mostInOneDay = { player: p, value: oneDay }

    const peak = peakRating(history.filter((h) => h.player_id === p.id))
    if (peak && (!highestPeak || peak.rating > highestPeak.value.rating)) highestPeak = { player: p, value: peak }
  }

  const historyByMatch: Record<string, RatingHistoryEntry[]> = {}
  history.forEach((h) => {
    historyByMatch[h.match_id] = [...(historyByMatch[h.match_id] ?? []), h]
  })
  const upset = biggestUpsetEver(matches, historyByMatch)
  const upsetWinner = upset ? players.find((p) => p.id === upset.match.winner_id) : null

  const recordsById: Record<string, { icon: typeof Flame; color: string; player: Player; description: string } | null> = {
    streak: longestStreak && {
      icon: Flame,
      color: 'text-orange-500',
      player: longestStreak.player,
      description: `${longestStreak.value} seire på rad`,
    },
    peak: highestPeak && {
      icon: TrendingUp,
      color: 'text-emerald-500',
      player: highestPeak.player,
      description: `${Math.round(highestPeak.value.rating)} poeng (${new Date(highestPeak.value.date).toLocaleDateString('no-NO')})`,
    },
    one_day: mostInOneDay && {
      icon: CalendarDays,
      color: 'text-blue-500',
      player: mostInOneDay.player,
      description: `${mostInOneDay.value.count} kamper${mostInOneDay.value.day ? ` (${new Date(mostInOneDay.value.day).toLocaleDateString('no-NO')})` : ''}`,
    },
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Crown size={24} className="text-amber-500" />
        <h1 className="text-2xl font-bold">Hall of Fame</h1>
      </div>

      {layout.orderedIds.map((id) => {
        if (id === 'upset') {
          if (!upset || !upsetWinner) return null
          return (
            <div key={id} className="card p-5 flex items-center gap-3">
              <Flame size={22} className="text-rose-500 shrink-0" />
              <div className="flex-1">
                <CardHeader layout={layout} cardId={id} className="text-sm font-semibold mb-1" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  <Link to={`/players/${upsetWinner.id}`} className="font-semibold text-brand-600 hover:underline">
                    {upsetWinner.name}
                  </Link>{' '}
                  vant som underdog med {Math.round(upset.margin)} poengs ratingforskjell
                </p>
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
