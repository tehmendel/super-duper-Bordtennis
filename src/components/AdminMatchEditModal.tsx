import { useEffect, useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Match, MatchSet } from '@/lib/types'

type SetScore = { player1_score: string; player2_score: string }

export function AdminMatchEditModal({
  match,
  onClose,
  onSaved,
}: {
  match: Match | null
  onClose: () => void
  onSaved: () => void
}) {
  const [sets, setSets] = useState<SetScore[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!match) return
    setLoading(true)
    setError(null)
    supabase
      .from('match_sets')
      .select('*')
      .eq('match_id', match.id)
      .order('set_number')
      .returns<MatchSet[]>()
      .then(({ data }) => {
        setSets(
          (data ?? []).map((s) => ({
            player1_score: String(s.player1_score),
            player2_score: String(s.player2_score),
          })),
        )
        setLoading(false)
      })
  }, [match])

  if (!match) return null

  async function handleSave() {
    setSaving(true)
    setError(null)

    const parsedSets = sets
      .filter((s) => s.player1_score !== '' && s.player2_score !== '')
      .map((s, i) => ({
        set_number: i + 1,
        player1_score: Number(s.player1_score),
        player2_score: Number(s.player2_score),
      }))

    if (parsedSets.length === 0) {
      setSaving(false)
      setError('Fyll inn minst ett sett')
      return
    }

    const { error } = await supabase.rpc('admin_update_match_sets', {
      p_match_id: match!.id,
      p_sets: parsedSets,
    })

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-6 animate-pop-in max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Rediger settscore</h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500">Laster...</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sets.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-14 text-sm text-slate-500">Sett {i + 1}</span>
                <input
                  type="number"
                  min={0}
                  value={s.player1_score}
                  onChange={(e) =>
                    setSets((prev) => prev.map((row, idx) => (idx === i ? { ...row, player1_score: e.target.value } : row)))
                  }
                  className="input text-center"
                />
                <span className="text-slate-400">–</span>
                <input
                  type="number"
                  min={0}
                  value={s.player2_score}
                  onChange={(e) =>
                    setSets((prev) => prev.map((row, idx) => (idx === i ? { ...row, player2_score: e.target.value } : row)))
                  }
                  className="input text-center"
                />
                {sets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSets((prev) => prev.filter((_, idx) => idx !== i))}
                    className="btn-ghost p-2 text-rose-500"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSets((prev) => [...prev, { player1_score: '', player2_score: '' }])}
              className="btn-secondary self-start"
            >
              <Plus size={16} /> Legg til sett
            </button>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Lagrer og gjenberegner rating...' : 'Lagre og gjenberegn rating'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
