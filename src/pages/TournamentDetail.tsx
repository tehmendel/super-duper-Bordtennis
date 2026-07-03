import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trophy, X, Trash2, Dices } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { eloWinProbability } from '@/lib/stats'
import type { Player, Tournament, TournamentMatch, TournamentParticipant } from '@/lib/types'

interface EnrichedMatch extends TournamentMatch {
  player1: Player | null
  player2: Player | null
}

function chunkPairs<T>(arr: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2))
  return out
}

function roundName(round: number, totalRounds: number) {
  const remaining = totalRounds - round + 1
  switch (remaining) {
    case 1: return 'Finale'
    case 2: return 'Semifinale'
    case 3: return 'Kvartfinale'
    case 4: return 'Åttedelsfinale'
    case 5: return 'Sekstendedelsfinale'
    default: return `Runde ${round}`
  }
}

export function TournamentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { player } = useAuth()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<EnrichedMatch[]>([])
  const [participants, setParticipants] = useState<TournamentParticipant[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EnrichedMatch | null>(null)
  const [score1, setScore1] = useState('')
  const [score2, setScore2] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [{ data: t }, { data: m }, { data: p }] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).single(),
      supabase
        .from('tournament_matches')
        .select('*, player1:players!tournament_matches_player1_id_fkey(*), player2:players!tournament_matches_player2_id_fkey(*)')
        .eq('tournament_id', id)
        .order('round')
        .order('position')
        .returns<EnrichedMatch[]>(),
      supabase.from('tournament_participants').select('*').eq('tournament_id', id).returns<TournamentParticipant[]>(),
    ])
    setTournament(t ?? null)
    setMatches(m ?? [])
    setParticipants(p ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="text-slate-500">Laster...</p>
  if (!tournament) return <p className="text-slate-500">Fant ikke turneringen.</p>

  const seedByPlayer = new Map(participants.map((p) => [p.player_id, p.seed]))
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b)
  const finalMatch = matches.find((m) => m.round === rounds[rounds.length - 1])
  const champion =
    tournament.status === 'completed' && finalMatch?.winner_id
      ? [finalMatch.player1, finalMatch.player2].find((p) => p?.id === finalMatch.winner_id) ?? null
      : null

  function openEdit(m: EnrichedMatch) {
    setEditing(m)
    setScore1(m.player1_score !== null ? String(m.player1_score) : '')
    setScore2(m.player2_score !== null ? String(m.player2_score) : '')
    setError(null)
  }

  async function handleSave() {
    if (!editing) return
    setError(null)
    const p1 = Number(score1)
    const p2 = Number(score2)
    if (score1 === '' || score2 === '' || p1 === p2) {
      setError('Fyll inn to ulike tall')
      return
    }
    setSaving(true)
    const { error } = await supabase.rpc('submit_tournament_match_result', {
      p_match_id: editing.id,
      p_player1_score: p1,
      p_player2_score: p2,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setEditing(null)
    await load()
  }

  async function handleDelete() {
    if (!id || !confirm('Slette denne turneringen permanent?')) return
    await supabase.rpc('delete_tournament', { p_tournament_id: id })
    navigate('/tournaments')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Trophy size={24} className="text-amber-500" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {tournament.status === 'completed' ? 'Fullført 🏆' : 'Pågår'}
          </p>
        </div>
        {player?.is_admin && (
          <button onClick={handleDelete} className="btn-ghost p-2 text-rose-600" title="Slett turnering">
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {champion && (
        <div className="card p-6 flex flex-col items-center gap-2 bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-950/40 dark:to-yellow-950/10 border-2 border-amber-300 dark:border-amber-700">
          <Trophy size={36} className="text-amber-500" />
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">Turneringsvinner</p>
          <div className="flex items-center gap-3">
            <PlayerAvatar name={champion.name} avatarUrl={champion.avatar_url} size="lg" />
            <p className="text-2xl font-black">{champion.name}</p>
          </div>
        </div>
      )}

      <div className="flex items-stretch gap-10 overflow-x-auto pb-4">
        {rounds.map((round, roundIdx) => {
          const roundMatches = matches.filter((m) => m.round === round).sort((a, b) => a.position - b.position)
          const isLast = roundIdx === rounds.length - 1
          const pairs = chunkPairs(roundMatches)
          return (
            <div key={round} className="flex flex-col shrink-0 w-64">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 text-center mb-4">
                {roundName(round, rounds.length)}
              </p>
              <div className="flex-1 flex flex-col justify-around gap-10">
                {pairs.map((pair, pairIdx) => (
                  <div key={pairIdx} className="relative flex flex-col justify-between gap-6">
                    {pair.map((m) => {
                      const canEdit = player?.is_admin && m.player1_id && m.player2_id && m.player1_score === null
                      const notPlayedYet = m.player1_id && m.player2_id && m.player1_score === null
                      const odds = notPlayedYet ? eloWinProbability(m.player1!.rating, m.player2!.rating) : null
                      return (
                        <div key={m.id} className="card p-3 flex flex-col gap-2 min-h-[92px]">
                          {m.is_lucky_loser && (
                            <span className="inline-flex items-center gap-1 self-start text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                              <Dices size={10} /> Lucky loser
                            </span>
                          )}
                          {[m.player1, m.player2].map((p, i) => {
                            const score = i === 0 ? m.player1_score : m.player2_score
                            const isWinner = p && m.winner_id === p.id
                            const oddsPct = odds !== null ? Math.round((i === 0 ? odds : 1 - odds) * 100) : null
                            const seed = p ? seedByPlayer.get(p.id) : null
                            return (
                              <div key={i} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isWinner ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
                                {p ? (
                                  <>
                                    {round === 1 && seed !== undefined && seed !== null && (
                                      <span className="text-[10px] text-slate-400 font-mono w-4 text-right shrink-0">{seed}</span>
                                    )}
                                    <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                                    <span className={`flex-1 text-sm truncate ${isWinner ? 'font-bold' : ''}`}>{p.name}</span>
                                  </>
                                ) : (
                                  <span className="flex-1 text-sm text-slate-400 italic">Venter...</span>
                                )}
                                {score !== null && <span className="font-mono text-sm">{score}</span>}
                                {oddsPct !== null && <span className="text-xs text-slate-400 font-mono">{oddsPct}%</span>}
                              </div>
                            )
                          })}
                          {canEdit && (
                            <button onClick={() => openEdit(m)} className="btn-secondary text-xs py-1.5">
                              Registrer resultat
                            </button>
                          )}
                        </div>
                      )
                    })}
                    {!isLast && pair.length === 2 && (
                      <div className="absolute -right-5 top-[25%] bottom-[25%] w-5 border-r-2 border-t-2 border-b-2 border-slate-300 dark:border-slate-700 rounded-r-lg" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="card w-full max-w-xs p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Registrer resultat</h2>
              <button onClick={() => setEditing(null)} className="btn-ghost p-1.5">
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm truncate">{editing.player1?.name}</span>
                <input type="number" value={score1} onChange={(e) => setScore1(e.target.value)} className="input w-20 text-center" />
              </div>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm truncate">{editing.player2?.name}</span>
                <input type="number" value={score2} onChange={(e) => setScore2(e.target.value)} className="input w-20 text-center" />
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Lagrer...' : 'Lagre resultat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
