import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Award } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { Match, Player } from '@/lib/types'

export function PlayerOfTheWeek() {
  const [winner, setWinner] = useState<{ player: Player; wins: number } | null>(null)

  useEffect(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    supabase
      .from('matches')
      .select('*')
      .eq('status', 'confirmed')
      .gte('confirmed_at', weekAgo)
      .returns<Match[]>()
      .then(async ({ data }) => {
        if (!data || data.length === 0) return
        const winsByPlayer = new Map<string, number>()
        data.forEach((m) => {
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
        if (!bestId || bestWins < 2) return
        const { data: p } = await supabase.from('players').select('*').eq('id', bestId).single()
        if (p) setWinner({ player: p, wins: bestWins })
      })
  }, [])

  if (!winner) return null

  return (
    <div className="card p-5 flex items-center gap-3 bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/20">
      <Award size={24} className="text-amber-500 shrink-0" />
      <PlayerAvatar name={winner.player.name} avatarUrl={winner.player.avatar_url} />
      <div className="flex-1">
        <p className="text-sm font-semibold">Ukens spiller</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <Link to={`/players/${winner.player.id}`} className="font-semibold text-amber-600 hover:underline">
            {winner.player.name}
          </Link>{' '}
          med {winner.wins} seire denne uken 🏆
        </p>
      </div>
    </div>
  )
}
