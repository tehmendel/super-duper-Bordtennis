import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Award } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { startOfWeek } from '@/lib/week'
import type { Match, Player } from '@/lib/types'

function bestWinner(matches: Match[]) {
  const winsByPlayer = new Map<string, number>()
  matches.forEach((m) => {
    if (m.winner_id) winsByPlayer.set(m.winner_id, (winsByPlayer.get(m.winner_id) ?? 0) + 1)
  })
  let bestId: string | null = null
  let bestWins = 0
  for (const [id, wins] of winsByPlayer.entries()) {
    if (wins > bestWins) {
      bestWins = wins
      bestId = id
    }
  }
  return bestId && bestWins >= 2 ? { id: bestId, wins: bestWins } : null
}

export function PlayerOfTheWeek() {
  const [winner, setWinner] = useState<{ player: Player; wins: number; isPreviousWeek: boolean } | null>(null)

  const load = useCallback(async () => {
    const thisWeekStart = startOfWeek()
    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)

    const { data: thisWeek } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'confirmed')
      .gte('confirmed_at', thisWeekStart.toISOString())
      .returns<Match[]>()

    let best = thisWeek ? bestWinner(thisWeek) : null
    let isPreviousWeek = false

    if (!best) {
      const { data: lastWeek } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'confirmed')
        .gte('confirmed_at', lastWeekStart.toISOString())
        .lt('confirmed_at', thisWeekStart.toISOString())
        .returns<Match[]>()
      best = lastWeek ? bestWinner(lastWeek) : null
      isPreviousWeek = true
    }

    if (!best) {
      setWinner(null)
      return
    }
    const { data: p } = await supabase.from('players').select('*').eq('id', best.id).single()
    if (p) setWinner({ player: p, wins: best.wins, isPreviousWeek })
  }, [])

  useEffect(() => {
    load()

    function onFocus() {
      load()
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') load()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    // Unfiltered — this needs to know about everyone's matches, not just the
    // viewer's own, so a focus/visibility-only refresh isn't enough while
    // the tab stays open and someone else confirms a match.
    const channel = supabase
      .channel('player-of-the-week-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => load())
      .subscribe()

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      supabase.removeChannel(channel)
    }
  }, [load])

  if (!winner) return null

  return (
    <div className="card p-5 flex items-center gap-3 bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/20">
      <Award size={24} className="text-amber-500 shrink-0" />
      <PlayerAvatar name={winner.player.name} avatarUrl={winner.player.avatar_url} />
      <div className="flex-1">
        <p className="text-sm font-semibold">{winner.isPreviousWeek ? 'Forrige ukes spiller' : 'Ukens spiller'}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <Link to={`/players/${winner.player.id}`} className="font-semibold text-amber-600 hover:underline">
            {winner.player.name}
          </Link>{' '}
          med {winner.wins} seire {winner.isPreviousWeek ? 'forrige uke' : 'denne uken'} 🏆
        </p>
      </div>
    </div>
  )
}
