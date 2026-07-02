import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { biggestUpsetEver, buildDominanceMatrix, closestRivalries } from '@/lib/stats'
import type { Match, Player, RatingHistoryEntry } from '@/lib/types'

export function Stats() {
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [history, setHistory] = useState<RatingHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('players').select('*').order('rating', { ascending: false }).returns<Player[]>(),
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

  const matrix = buildDominanceMatrix(players, matches)
  const rivalries = closestRivalries(matches).slice(0, 5)
  const historyByMatch: Record<string, RatingHistoryEntry[]> = {}
  history.forEach((h) => {
    historyByMatch[h.match_id] = [...(historyByMatch[h.match_id] ?? []), h]
  })
  const upset = biggestUpsetEver(matches, historyByMatch)
  const upsetWinner = upset ? players.find((p) => p.id === upset.match.winner_id) : null
  const upsetLoser = upset
    ? players.find((p) => p.id === (upset.match.winner_id === upset.match.player1_id ? upset.match.player2_id : upset.match.player1_id))
    : null

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold">Statistikk</h1>

      {upset && upsetWinner && upsetLoser && (
        <div className="card p-5 flex items-center gap-3">
          <Flame size={24} className="text-orange-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Størst upset noensinne</p>
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
      )}

      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Jevneste rivaliseringer</p>
        {rivalries.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">Ingen par med nok kamper ennå.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rivalries.map((r) => {
              const a = players.find((p) => p.id === r.playerAId)
              const b = players.find((p) => p.id === r.playerBId)
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

      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Dominansmatrise (seiersprosent)</p>
        <div className="card overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="p-2"></th>
                {players.map((p) => (
                  <th key={p.id} className="p-2 text-center font-medium w-16">
                    <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((rowPlayer) => (
                <tr key={rowPlayer.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="p-2 font-medium whitespace-nowrap">{rowPlayer.name}</td>
                  {players.map((colPlayer) => {
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
                        style={{
                          backgroundColor: `rgba(37, 99, 235, ${cell.winRate * 0.5})`,
                        }}
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
    </div>
  )
}
