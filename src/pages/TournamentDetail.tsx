import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trophy, X, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { Player, Tournament, TournamentMatch } from '@/lib/types'

interface EnrichedMatch extends TournamentMatch {
  player1: Player | null
  player2: Player | null
}

export function TournamentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { player } = useAuth()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<EnrichedMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EnrichedMatch | null>(null)
  const [score1, setScore1] = useState('')
  const [score2, setScore2] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).single(),
      supabase
        .from('tournament_matches')
        .select('*, player1:players!tournament_matches_player1_id_fkey(*), player2:players!tournament_matches_player2_id_fkey(*)')
        .eq('tournament_id', id)
        .order('round')
        .order('position')
        .returns<EnrichedMatch[]>(),
    ])
    setTournament(t ?? null)
    setMatches(m ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="text-slate-500">Laster...</p>
  if (!tournament) return <p className="text-slate-500">Fant ikke turneringen.</p>

  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b)
  const roundName = (round: number) => {
    const remaining = rounds.length - round + 1
    if (remaining === 1) return 'Finale'
    if (remaining === 2) return 'Semifinale'
    if (remaining === 3) return 'Kvartfinale'
    return `Runde ${round}`
  }

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

      <div className="flex gap-6 overflow-x-auto pb-4">
        {rounds.map((round) => (
          <div key={round} className="flex flex-col gap-4 justify-around shrink-0 w-56">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 text-center">{roundName(round)}</p>
            {matches
              .filter((m) => m.round === round)
              .map((m) => {
                const canEdit = player?.is_admin && m.player1_id && m.player2_id && m.player1_score === null
                return (
                  <div key={m.id} className="card p-3 flex flex-col gap-2">
                    {[m.player1, m.player2].map((p, i) => {
                      const score = i === 0 ? m.player1_score : m.player2_score
                      const isWinner = p && m.winner_id === p.id
                      return (
                        <div key={i} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isWinner ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
                          {p ? (
                            <>
                              <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                              <span className={`flex-1 text-sm truncate ${isWinner ? 'font-bold' : ''}`}>{p.name}</span>
                            </>
                          ) : (
                            <span className="flex-1 text-sm text-slate-400 italic">Venter...</span>
                          )}
                          {score !== null && <span className="font-mono text-sm">{score}</span>}
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
          </div>
        ))}
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
