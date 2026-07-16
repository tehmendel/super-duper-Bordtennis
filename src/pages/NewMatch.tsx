import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { AchievementToast } from '@/components/AchievementToast'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { AchievementDefinition, Player } from '@/lib/types'

type SetScore = { player1_score: string; player2_score: string }

const BEST_OF_OPTIONS = [1, 3, 5] as const
const EMPTY_SETS: SetScore[] = [{ player1_score: '', player2_score: '' }, { player1_score: '', player2_score: '' }]

interface SubmittedSummary {
  opponent: Player
  won: boolean
  setsWonSelf: number
  setsWonOpponent: number
}

export function NewMatch() {
  const { player, hasAccess } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [opponentId, setOpponentId] = useState('')
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(3)
  const [sets, setSets] = useState<SetScore[]>(EMPTY_SETS)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState<SubmittedSummary | null>(null)
  const [newAchievements, setNewAchievements] = useState<AchievementDefinition[]>([])

  useEffect(() => {
    if (!player) return
    supabase
      .from('players')
      .select('*')
      .neq('id', player.id)
      .order('name')
      .then(({ data }) => setPlayers(data ?? []))
  }, [player])

  function changeBestOf(value: 1 | 3 | 5) {
    setBestOf(value)
    const minSets = Math.ceil(value / 2)
    setSets(Array.from({ length: minSets }, () => ({ player1_score: '', player2_score: '' })))
  }

  function updateSet(index: number, field: keyof SetScore, value: string) {
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  function resetForm() {
    setSubmitted(null)
    setOpponentId('')
    setBestOf(3)
    setSets(EMPTY_SETS)
  }

  async function handleSubmit() {
    if (!player) return
    setError(null)
    if (!opponentId) return setError('Velg motstander')

    const parsedSets = sets
      .filter((s) => s.player1_score !== '' && s.player2_score !== '')
      .map((s, i) => ({
        set_number: i + 1,
        player1_score: Number(s.player1_score),
        player2_score: Number(s.player2_score),
      }))

    if (parsedSets.length === 0) return setError('Fyll inn minst ett sett')
    if (parsedSets.some((s) => s.player1_score === s.player2_score)) return setError('Et sett kan ikke ende uavgjort')

    setSaving(true)
    const { data: matchId, error: submitError } = await supabase.rpc('submit_match', {
      p_player2_id: opponentId,
      p_best_of: bestOf,
      p_sets: parsedSets,
    })

    setSaving(false)
    if (submitError) {
      setError(submitError.message)
      return
    }

    // Matches are accepted immediately (no opponent confirmation step), so
    // any achievements this match unlocked already exist right away.
    if (matchId) {
      const { data: earned } = await supabase
        .from('player_achievements')
        .select('*, achievement:achievement_definitions(*)')
        .eq('match_id', matchId)
        .eq('player_id', player.id)
      if (earned && earned.length > 0) {
        setNewAchievements(
          earned.map((e) => e.achievement as AchievementDefinition | null).filter((a): a is AchievementDefinition => a !== null),
        )
      }
    }

    const setsWonSelf = parsedSets.filter((s) => s.player1_score > s.player2_score).length
    const setsWonOpponent = parsedSets.length - setsWonSelf
    const opponent = players.find((p) => p.id === opponentId)
    if (opponent) {
      setSubmitted({ opponent, won: setsWonSelf > setsWonOpponent, setsWonSelf, setsWonOpponent })
    }
  }

  const opponent = players.find((p) => p.id === opponentId)

  if (!hasAccess('new_match', 'write')) {
    return <p className="text-slate-500 dark:text-slate-400">Du har kun lesetilgang og kan ikke registrere kamper.</p>
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h1 className="text-2xl font-bold">Registrer kamp</h1>

      <AchievementToast achievements={newAchievements} onDismiss={() => setNewAchievements([])} />

      {submitted ? (
        <div className="card p-6 flex flex-col items-center gap-3 text-center">
          <CheckCircle2 size={40} className="text-emerald-500" />
          <p className="font-semibold">Kamp registrert og godkjent!</p>
          <div className="flex items-center gap-3">
            <PlayerAvatar name={submitted.opponent.name} avatarUrl={submitted.opponent.avatar_url} />
            <span className="text-sm text-slate-500 dark:text-slate-400">
              mot <span className="font-medium text-slate-700 dark:text-slate-300">{submitted.opponent.name}</span>
            </span>
          </div>
          <p className="font-mono text-xl font-bold">
            {submitted.setsWonSelf}–{submitted.setsWonOpponent}
          </p>
          <p className={`text-sm font-semibold ${submitted.won ? 'text-emerald-500' : 'text-rose-500'}`}>
            {submitted.won ? 'Seier!' : 'Tap'}
          </p>
          <div className="flex gap-2 mt-2 w-full">
            <button onClick={resetForm} className="btn-secondary flex-1 text-sm">
              Registrer en til
            </button>
            <Link to="/matches" className="btn-primary flex-1 text-sm">
              Se kamphistorikk
            </Link>
          </div>
        </div>
      ) : (
        <div className="card p-5 flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Motstander</label>
            <select value={opponentId} onChange={(e) => setOpponentId(e.target.value)} className="input">
              <option value="">Velg spiller...</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Best av</label>
            <div className="flex gap-2">
              {BEST_OF_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => changeBestOf(n)}
                  className={bestOf === n ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Settscore (deg vs. {opponent?.name ?? 'motstander'})</label>
            <div className="flex flex-col gap-2">
              {sets.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-14 text-sm text-slate-500">Sett {i + 1}</span>
                  <input
                    type="number"
                    min={0}
                    value={s.player1_score}
                    onChange={(e) => updateSet(i, 'player1_score', e.target.value)}
                    className="input text-center"
                    placeholder="Deg"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="number"
                    min={0}
                    value={s.player2_score}
                    onChange={(e) => updateSet(i, 'player2_score', e.target.value)}
                    className="input text-center"
                    placeholder="Motst."
                  />
                  {sets.length > 1 && (
                    <button type="button" onClick={() => setSets((prev) => prev.filter((_, idx) => idx !== i))} className="btn-ghost p-2 text-rose-500">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              {sets.length < bestOf && (
                <button
                  type="button"
                  onClick={() => setSets((prev) => [...prev, { player1_score: '', player2_score: '' }])}
                  className="btn-secondary self-start"
                >
                  <Plus size={16} /> Legg til sett
                </button>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button onClick={handleSubmit} disabled={saving} className="btn-primary">
            {saving ? 'Lagrer...' : 'Registrer kamp'}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            Resultatet godkjennes automatisk med én gang – ingen bekreftelse fra motstanderen nødvendig.
          </p>
        </div>
      )}
    </div>
  )
}
