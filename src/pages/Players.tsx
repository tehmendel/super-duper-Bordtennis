import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, X, KeyRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { Player } from '@/lib/types'

export function Players() {
  const { hasAccess } = useAuth()
  const canWrite = hasAccess('players', 'write')
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Player | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('players').select('*').order('name').returns<Player[]>()
    setPlayers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="text-slate-500">Laster...</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Spillere</h1>
        {canWrite && (
          <button onClick={() => setShowCreate(true)} className="btn-primary py-2 px-3 text-sm">
            <Plus size={16} /> Legg til spiller
          </button>
        )}
      </div>

      <div className="card divide-y divide-slate-200 dark:divide-slate-800">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <Link to={`/players/${p.id}`} className="flex items-center gap-3 flex-1 min-w-0">
              <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
              <div className="min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {p.username ? `@${p.username}` : 'Ingen konto opprettet ennå'} · {Math.round(p.rating)}
                </p>
              </div>
            </Link>
            {canWrite && (
              <button onClick={() => setEditing(p)} className="btn-ghost p-2" title="Rediger påloggingsdetaljer">
                <KeyRound size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {showCreate && <CreatePlayerModal onClose={() => setShowCreate(false)} onDone={load} />}
      {editing && <EditCredentialsModal player={editing} onClose={() => setEditing(null)} onDone={load} />}
    </div>
  )
}

function CreatePlayerModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setError(null)
    setSaving(true)
    const { data, error } = await supabase.functions.invoke('manage-player', {
      body: { action: 'create', name, username, password },
    })
    setSaving(false)
    if (error || data?.error) {
      setError(data?.error ?? error?.message ?? 'Kunne ikke opprette spiller')
      return
    }
    onDone()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Legg til spiller</h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Fullt navn</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Kari Solberg" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Brukernavn</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              className="input"
              placeholder="kari"
              autoCapitalize="off"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Passord</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Minst 8 tegn"
            />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button onClick={handleCreate} disabled={saving} className="btn-primary">
            {saving ? 'Oppretter...' : 'Opprett spiller'}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Gi brukernavnet og passordet videre til spilleren slik at de kan logge inn.
          </p>
        </div>
      </div>
    </div>
  )
}

function EditCredentialsModal({ player, onClose, onDone }: { player: Player; onClose: () => void; onDone: () => void }) {
  const [username, setUsername] = useState(player.username ?? '')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSave() {
    setError(null)
    setSaving(true)

    if (username.trim() !== (player.username ?? '')) {
      const { error } = await supabase.rpc('admin_set_player_username', {
        p_player_id: player.id,
        p_username: username.trim().toLowerCase(),
      })
      if (error) {
        setSaving(false)
        setError(error.message)
        return
      }
    }

    if (password) {
      const { data, error } = await supabase.functions.invoke('manage-player', {
        body: { action: 'reset_password', playerId: player.id, password },
      })
      if (error || data?.error) {
        setSaving(false)
        setError(data?.error ?? error?.message ?? 'Kunne ikke sette passord')
        return
      }
    }

    setSaving(false)
    setDone(true)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Påloggingsdetaljer</h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X size={18} />
          </button>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} size="sm" />
          <p className="font-medium">{player.name}</p>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Brukernavn</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              className="input"
              placeholder="kari"
              autoCapitalize="off"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Nytt passord (valgfritt)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="La stå tom for å ikke endre"
            />
            {!player.auth_user_id && password && (
              <p className="text-xs text-amber-600 mt-1">
                Denne spilleren har ingen konto ennå – bruk "Legg til spiller" for å opprette en ny konto i stedet.
              </p>
            )}
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {done && <p className="text-sm text-emerald-600">Lagret!</p>}
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Lagrer...' : 'Lagre'}
          </button>
        </div>
      </div>
    </div>
  )
}
