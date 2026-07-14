import { useCallback, useEffect, useState } from 'react'
import { Pencil, Trophy, Square } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/date'
import type { Season } from '@/lib/types'

export function AdminSeasons() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newTargetDate, setNewTargetDate] = useState('')
  const [editing, setEditing] = useState<Season | null>(null)
  const [editName, setEditName] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editTargetDate, setEditTargetDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('seasons').select('*').order('started_at', { ascending: false }).returns<Season[]>()
    setSeasons(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const activeSeason = seasons.find((s) => s.is_active)

  async function handleStartNew() {
    if (!newName.trim()) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('start_new_season', {
      p_name: newName.trim(),
      p_target_end_date: newTargetDate ? new Date(newTargetDate).toISOString() : null,
      p_started_at: newStartDate ? new Date(newStartDate).toISOString() : null,
    })
    setBusy(false)
    if (error) return setError(error.message)
    setNewName('')
    setNewStartDate('')
    setNewTargetDate('')
    await load()
  }

  async function handleEndCurrent() {
    if (!confirm('Avslutte inneværende sesong uten å starte en ny? Ratinger nullstilles ikke før neste sesong starter.')) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('end_current_season')
    setBusy(false)
    if (error) return setError(error.message)
    await load()
  }

  function openEdit(s: Season) {
    setEditing(s)
    setEditName(s.name)
    setEditStartDate(s.started_at.slice(0, 10))
    setEditTargetDate(s.target_end_date ? s.target_end_date.slice(0, 10) : '')
  }

  async function handleSaveEdit() {
    if (!editing) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('update_season', {
      p_season_id: editing.id,
      p_name: editName.trim(),
      p_target_end_date: editTargetDate ? new Date(editTargetDate).toISOString() : null,
      p_started_at: editStartDate ? new Date(editStartDate).toISOString() : null,
    })
    setBusy(false)
    if (error) return setError(error.message)
    setEditing(null)
    await load()
  }

  if (loading) return <p className="text-slate-500">Laster...</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {seasons.map((s) => (
          <div key={s.id} className="card p-3 flex items-center gap-3">
            <Trophy size={18} className={s.is_active ? 'text-amber-500' : 'text-slate-300'} />
            <div className="flex-1">
              <p className="font-medium text-sm">{s.name} {s.is_active && <span className="text-xs text-emerald-500">(pågår)</span>}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Startet {formatDate(s.started_at)}
                {s.ended_at && ` · Avsluttet ${formatDate(s.ended_at)}`}
                {s.target_end_date && ` · Planlagt slutt ${formatDate(s.target_end_date)}`}
              </p>
            </div>
            <button onClick={() => openEdit(s)} className="btn-ghost p-2" title="Rediger">
              <Pencil size={16} />
            </button>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="card p-5 flex flex-col gap-3">
        <p className="text-sm font-semibold">Start ny sesong</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Låser inneværende sesongs plasseringer og nullstiller alle til 1000.</p>
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Navn</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="F.eks. Sesong 2" className="input" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
            Startdato <span className="font-normal">(valgfritt – tomt betyr i dag)</span>
          </label>
          <input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} className="input" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
            Planlagt sluttdato <span className="font-normal">(valgfritt – vises som nedtelling)</span>
          </label>
          <input type="date" value={newTargetDate} onChange={(e) => setNewTargetDate(e.target.value)} className="input" />
        </div>
        <button onClick={handleStartNew} disabled={busy} className="btn-primary self-start">Start ny sesong</button>
      </div>

      {activeSeason && (
        <div className="card p-5 flex flex-col gap-2">
          <p className="text-sm font-semibold flex items-center gap-2"><Square size={14} /> Avslutt uten å starte ny</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Stenger {activeSeason.name} uten å nullstille rating eller starte en ny sesong ennå.</p>
          <button onClick={handleEndCurrent} disabled={busy} className="btn-secondary self-start text-rose-600">Avslutt {activeSeason.name}</button>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-bold mb-4">Rediger sesong</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Navn</label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Startdato</label>
                <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
                  Planlagt sluttdato <span className="font-normal">(valgfritt)</span>
                </label>
                <input type="date" value={editTargetDate} onChange={(e) => setEditTargetDate(e.target.value)} className="input" />
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <button onClick={handleSaveEdit} disabled={busy} className="btn-primary">Lagre</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
