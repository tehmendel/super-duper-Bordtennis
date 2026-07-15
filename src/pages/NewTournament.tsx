import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { Player } from '@/lib/types'

export function NewTournament() {
  const { hasAccess } = useAuth()
  const navigate = useNavigate()
  const [players, setPlayers] = useState<Player[]>([])
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('players').select('*').order('rating', { ascending: false }).then(({ data }) => setPlayers(data ?? []))
  }, [])

  if (!hasAccess('tournaments', 'write')) {
    return <p className="text-slate-500 dark:text-slate-400">Du har ikke tilgang til å opprette turneringer.</p>
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleCreate() {
    setError(null)
    if (!name.trim()) return setError('Gi turneringen et navn')
    if (selected.size < 2) return setError('Velg minst 2 deltakere')

    setSaving(true)
    const { data, error } = await supabase.rpc('create_tournament', {
      p_name: name.trim(),
      p_participant_ids: [...selected],
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate(`/tournaments/${data}`)
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h1 className="text-2xl font-bold">Ny turnering</h1>

      <div className="card p-5 flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Navn</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="F.eks. Sommerturneringen 2026" className="input" />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Deltakere ({selected.size} valgt)</label>
          <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
            {players.map((p) => (
              <label key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="w-4 h-4" />
                <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
                <span className="flex-1 text-sm">{p.name}</span>
                <span className="text-xs text-slate-400">{Math.round(p.rating)}</span>
              </label>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Deltakerne sås etter nåværende rating (høyest rating møter lavest rangerte først). Bye brukes kun der det er
          nødvendig — er antallet spillere som skal parres oddetall i en runde, får den øverste sådde i stedet en
          "lucky loser"-kamp mot den beste taperen fra samme runde, så snart resten av runden er avgjort.
        </p>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <button onClick={handleCreate} disabled={saving} className="btn-primary">
          {saving ? 'Oppretter...' : 'Opprett turnering'}
        </button>
      </div>
    </div>
  )
}
