import { useEffect, useState } from 'react'
import { X, Swords, Share2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { useShareImage } from '@/hooks/useShareImage'
import { generateRoast } from '@/lib/roast'
import type { Match, MatchSet, Player, RatingHistoryEntry } from '@/lib/types'

interface Details {
  match: Match
  player1: Player
  player2: Player
  sets: MatchSet[]
  deltas: RatingHistoryEntry[]
}

export function MatchDetailModal({ matchId, onClose }: { matchId: string | null; onClose: () => void }) {
  const { player: currentPlayer } = useAuth()
  const [details, setDetails] = useState<Details | null>(null)
  const [loading, setLoading] = useState(false)
  const [rematchSent, setRematchSent] = useState(false)
  const [rematchBusy, setRematchBusy] = useState(false)
  const { ref: shareRef, share } = useShareImage(`kamp-${matchId ?? 'resultat'}.png`)

  useEffect(() => {
    if (!matchId) {
      setDetails(null)
      setRematchSent(false)
      return
    }
    let cancelled = false
    setLoading(true)
    async function load() {
      const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single()
      if (!match || cancelled) return

      const [{ data: matchPlayers }, { data: sets }, { data: deltas }] = await Promise.all([
        supabase.from('players').select('*').in('id', [match.player1_id, match.player2_id]),
        supabase.from('match_sets').select('*').eq('match_id', matchId).order('set_number').returns<MatchSet[]>(),
        supabase.from('ratings_history').select('*').eq('match_id', matchId).returns<RatingHistoryEntry[]>(),
      ])
      const player1 = matchPlayers?.find((p) => p.id === match.player1_id)
      const player2 = matchPlayers?.find((p) => p.id === match.player2_id)

      if (!cancelled && player1 && player2) {
        setDetails({ match, player1, player2, sets: sets ?? [], deltas: deltas ?? [] })
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [matchId])

  if (!matchId) return null

  const d1 = details?.deltas.find((d) => d.player_id === details.match.player1_id)
  const d2 = details?.deltas.find((d) => d.player_id === details.match.player2_id)

  // sets_won_* is only computed when a match is confirmed — fall back to
  // counting the sets directly so pending matches (viewed before approving)
  // still show a score instead of a blank dash.
  const setsWon1 = details?.match.sets_won_player1 ?? details?.sets.filter((s) => s.player1_score > s.player2_score).length ?? null
  const setsWon2 = details?.match.sets_won_player2 ?? details?.sets.filter((s) => s.player2_score > s.player1_score).length ?? null

  const iLost = details && currentPlayer && details.match.winner_id && details.match.winner_id !== currentPlayer.id &&
    (details.match.player1_id === currentPlayer.id || details.match.player2_id === currentPlayer.id)

  async function handleRematch() {
    if (!details || !currentPlayer || !details.match.winner_id) return
    setRematchBusy(true)
    await supabase.from('challenges').insert({ challenger_id: currentPlayer.id, challenged_id: details.match.winner_id })
    setRematchBusy(false)
    setRematchSent(true)
  }

  const roast =
    details && details.match.winner_id && details.sets.length > 0
      ? generateRoast(
          details.match,
          details.sets,
          details.match.winner_id === details.player1.id ? details.player1.name : details.player2.name,
          details.match.winner_id === details.player1.id ? details.player2.name : details.player1.name,
        )
      : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-sm p-6 animate-pop-in max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Kampdetaljer</h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X size={18} />
          </button>
        </div>

        {loading || !details ? (
          <p className="text-slate-500">Laster...</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div ref={shareRef} className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-2 rounded-xl">
              <div className="flex items-center justify-around text-center">
                <div className="flex flex-col items-center gap-1">
                  <PlayerAvatar name={details.player1.name} avatarUrl={details.player1.avatar_url} />
                  <span className={`text-sm font-medium ${details.match.winner_id === details.player1.id ? 'font-bold' : ''}`}>
                    {details.player1.name}
                  </span>
                  {d1 && (
                    <span className={`text-xs ${d1.delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {d1.delta >= 0 ? '+' : ''}{Math.round(d1.delta)}
                    </span>
                  )}
                </div>
                <span className="text-2xl font-bold text-slate-400">
                  {setsWon1 ?? '?'}–{setsWon2 ?? '?'}
                </span>
                <div className="flex flex-col items-center gap-1">
                  <PlayerAvatar name={details.player2.name} avatarUrl={details.player2.avatar_url} />
                  <span className={`text-sm font-medium ${details.match.winner_id === details.player2.id ? 'font-bold' : ''}`}>
                    {details.player2.name}
                  </span>
                  {d2 && (
                    <span className={`text-xs ${d2.delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {d2.delta >= 0 ? '+' : ''}{Math.round(d2.delta)}
                    </span>
                  )}
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs">
                    <th className="text-left font-medium py-1">Sett</th>
                    <th className="text-right font-medium py-1">{details.player1.name}</th>
                    <th className="text-right font-medium py-1">{details.player2.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {details.sets.map((s) => {
                    const p1Won = s.player1_score > s.player2_score
                    return (
                      <tr key={s.set_number} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="py-1.5 text-slate-500">{s.set_number}</td>
                        <td className={`py-1.5 text-right font-mono ${p1Won ? 'font-bold' : ''}`}>{s.player1_score}</td>
                        <td className={`py-1.5 text-right font-mono ${!p1Won ? 'font-bold' : ''}`}>{s.player2_score}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {roast && <p className="text-xs italic text-slate-500 dark:text-slate-400 text-center">"{roast}"</p>}

              <div className="text-xs text-slate-400 text-center">
                {details.match.status === 'pending'
                  ? 'Venter på bekreftelse'
                  : new Date(details.match.confirmed_at ?? details.match.created_at).toLocaleDateString('no-NO', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={share} className="btn-secondary flex-1 text-sm">
                <Share2 size={16} /> Del resultat
              </button>
              {iLost && (
                <button onClick={handleRematch} disabled={rematchBusy || rematchSent} className="btn-primary flex-1 text-sm">
                  <Swords size={16} /> {rematchSent ? 'Revansje krevd!' : 'Krev revansje'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
