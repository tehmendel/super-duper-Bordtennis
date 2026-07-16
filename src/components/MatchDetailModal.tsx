import { useEffect, useState } from 'react'
import { X, Swords, Share2, ChevronDown } from 'lucide-react'
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

// Reconstructs the exact Elo math from apply_confirmed_match() in the
// database. rating_before/delta are stored verbatim from that calculation,
// so the K-factor (48 for a player's first 10 confirmed matches in the
// season, else 32) can be derived exactly rather than re-queried.
function eloBreakdown(ownBefore: number, opponentBefore: number, won: boolean, delta: number) {
  const expected = 1 / (1 + Math.pow(10, (opponentBefore - ownBefore) / 400))
  const actual = won ? 1 : 0
  const k = Math.round(delta / (actual - expected))
  return { expected, actual, k }
}

export function MatchDetailModal({ matchId, onClose }: { matchId: string | null; onClose: () => void }) {
  const { player: currentPlayer } = useAuth()
  const [details, setDetails] = useState<Details | null>(null)
  const [loading, setLoading] = useState(false)
  const [rematchSent, setRematchSent] = useState(false)
  const [rematchBusy, setRematchBusy] = useState(false)
  const [showEloExplain, setShowEloExplain] = useState(false)
  const { ref: shareRef, share } = useShareImage(`kamp-${matchId ?? 'resultat'}.png`)

  useEffect(() => {
    if (!matchId) {
      setDetails(null)
      setRematchSent(false)
      setShowEloExplain(false)
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

  const iLost = !!(details && currentPlayer && details.match.winner_id && details.match.winner_id !== currentPlayer.id &&
    (details.match.player1_id === currentPlayer.id || details.match.player2_id === currentPlayer.id))
  const winnerId = details?.match.winner_id

  useEffect(() => {
    if (!iLost || !currentPlayer || !winnerId) return
    let cancelled = false
    supabase
      .from('challenges')
      .select('id')
      .eq('challenger_id', currentPlayer.id)
      .eq('challenged_id', winnerId)
      .eq('status', 'pending')
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setRematchSent(!!data)
      })
    return () => { cancelled = true }
  }, [iLost, currentPlayer, winnerId])

  if (!matchId) return null

  const d1 = details?.deltas.find((d) => d.player_id === details.match.player1_id)
  const d2 = details?.deltas.find((d) => d.player_id === details.match.player2_id)

  const p1Won = !!(details && details.match.winner_id === details.player1.id)
  const eloExplain =
    d1 && d2
      ? {
          p1: eloBreakdown(d1.rating_before, d2.rating_before, p1Won, d1.delta),
          p2: eloBreakdown(d2.rating_before, d1.rating_before, !p1Won, d2.delta),
        }
      : null

  // sets_won_* is only computed when a match is confirmed — fall back to
  // counting the sets directly so a match still shows a score instead of a
  // blank dash in the rare case it isn't confirmed yet (e.g. mid-submission).
  const setsWon1 = details?.match.sets_won_player1 ?? details?.sets.filter((s) => s.player1_score > s.player2_score).length ?? null
  const setsWon2 = details?.match.sets_won_player2 ?? details?.sets.filter((s) => s.player2_score > s.player1_score).length ?? null

  async function handleRematch() {
    if (!details || !currentPlayer || !details.match.winner_id) return
    setRematchBusy(true)
    const { error } = await supabase.from('challenges').insert({ challenger_id: currentPlayer.id, challenged_id: details.match.winner_id })
    setRematchBusy(false)
    if (!error || error.code === '23505') setRematchSent(true)
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
                  : (() => {
                      const d = new Date(details.match.confirmed_at ?? details.match.created_at)
                      const date = d.toLocaleDateString('no-NO', { weekday: 'long', day: 'numeric', month: 'long' })
                      const time = d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
                      return `${date}, kl. ${time}`
                    })()}
              </div>
            </div>

            {eloExplain && (
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <button
                  onClick={() => setShowEloExplain((v) => !v)}
                  className="text-xs font-medium text-brand-600 dark:text-brand-400 flex items-center gap-1"
                >
                  {showEloExplain ? 'Skjul' : 'Vis'} hvordan ratingen ble beregnet
                  <ChevronDown size={14} className={showEloExplain ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
                {showEloExplain && (
                  <div className="mt-2 flex flex-col gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <p>
                      Forventet vinnersjanse regnes ut fra ratingforskjellen før kampen. Den som var høyest ratet hadde
                      størst forventet sjanse til å vinne — men får da også mindre å hente ved seier, og mister mer ved tap.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { p: details.player1, won: p1Won, d: d1!, e: eloExplain.p1 },
                        { p: details.player2, won: !p1Won, d: d2!, e: eloExplain.p2 },
                      ].map(({ p, won, d, e }) => {
                        // Rounded independently, "rating før" + "endring" can be
                        // one point off from a separately-rounded "rating etter"
                        // (e.g. 1084 + 10 = 1094, but the real value rounds to
                        // 1095) — so derive the shown "etter" from the shown
                        // "før" and "endring" instead, so the equation a reader
                        // checks by hand always balances exactly.
                        const before = Math.round(d.rating_before)
                        const roundedDelta = Math.round(d.delta)
                        // Uses the same 2-decimal "forventet" shown just above,
                        // so this step of the arithmetic reproduces too — marked
                        // "≈" since it's built from already-rounded display
                        // numbers, not the raw underlying values.
                        const expectedRounded = Math.round(e.expected * 100) / 100
                        const diff = Math.abs(e.actual - expectedRounded)
                        return (
                          <div key={p.id} className="flex flex-col gap-0.5">
                            <p className="font-semibold text-slate-700 dark:text-slate-300">{p.name}</p>
                            <p>Rating før: {before}</p>
                            <p>Forventet sjanse: {Math.round(e.expected * 100)}%</p>
                            <p>Faktisk utfall: {won ? 'Seier (1,0)' : 'Tap (0,0)'}</p>
                            <p>K-faktor: {e.k}</p>
                            <p className="font-mono text-[11px] text-slate-400">
                              {e.k} × |{e.actual.toFixed(1)} − {expectedRounded.toFixed(2)}| = {e.k} × {diff.toFixed(2)} ≈ {roundedDelta >= 0 ? '+' : '−'}{Math.abs(roundedDelta)}
                            </p>
                            <p className="font-mono text-[11px] text-slate-400">
                              {before} {roundedDelta >= 0 ? '+' : '−'} {Math.abs(roundedDelta)} = {before + roundedDelta}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                    <p className="italic">
                      K-faktoren er 48 for en spillers 10 første kamper i sesongen (raskere justering mens ratingen er
                      usikker), deretter 32.
                    </p>
                  </div>
                )}
              </div>
            )}

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
