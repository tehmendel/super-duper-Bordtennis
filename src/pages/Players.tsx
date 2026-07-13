import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, X, KeyRound, Pencil, Trash2, CheckCircle2, Copy, ShieldOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { Player } from '@/lib/types'

interface NewCredentials {
  name: string
  username: string
  password: string
}

export function Players() {
  const { player, hasAccess } = useAuth()
  const canWrite = hasAccess('players', 'write')
  const isAdmin = !!player?.is_admin
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Player | null>(null)
  const [editingInfo, setEditingInfo] = useState<Player | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [resettingMfaId, setResettingMfaId] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [newCredentials, setNewCredentials] = useState<NewCredentials | null>(null)

  // Only the very first load should show the full-page "Laster..." state.
  // Refreshing after a mutation must not unmount the page (and any open
  // modal along with it) while it refetches.
  const load = useCallback(async () => {
    const { data } = await supabase.from('players').select('*').order('name').returns<Player[]>()
    setPlayers(data ?? [])
  }, [])

  useEffect(() => {
    load().then(() => setLoading(false))
  }, [load])

  useEffect(() => {
    if (!banner) return
    const timer = setTimeout(() => setBanner(null), 4000)
    return () => clearTimeout(timer)
  }, [banner])

  function handleSaved(message: string) {
    setBanner(message)
    setEditing(null)
    setEditingInfo(null)
    load()
  }

  function handleCreated(creds: NewCredentials) {
    setShowCreate(false)
    setNewCredentials(creds)
    load()
  }

  async function handleDelete(p: Player) {
    if (!confirm(`Slette ${p.name} permanent? Dette fjerner ogsa alle kamper, statistikk og prestasjoner for denne spilleren (ogsa fra motstandernes historikk). Kan ikke angres.`)) {
      return
    }
    setDeleteError(null)
    setDeletingId(p.id)
    const { data, error } = await supabase.functions.invoke('manage-player', {
      body: { action: 'delete', playerId: p.id },
    })
    setDeletingId(null)
    if (error || data?.error) {
      setDeleteError(data?.error ?? error?.message ?? 'Kunne ikke slette spilleren')
      return
    }
    setBanner(`${p.name} er slettet`)
    await load()
  }

  async function handleResetMfa(p: Player) {
    if (!confirm(`Nullstille topartsinnlogging for ${p.name}? Spilleren må sette opp en ny autentiseringsapp neste gang de logger inn.`)) {
      return
    }
    setDeleteError(null)
    setResettingMfaId(p.id)
    const { data, error } = await supabase.functions.invoke('manage-player', {
      body: { action: 'reset_mfa', playerId: p.id },
    })
    setResettingMfaId(null)
    if (error || data?.error) {
      setDeleteError(data?.error ?? error?.message ?? 'Kunne ikke nullstille topartsinnlogging')
      return
    }
    setBanner(`Topartsinnlogging for ${p.name} er nullstilt`)
  }

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

      {banner && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 px-4 py-3 text-sm">
          <CheckCircle2 size={16} className="shrink-0" />
          <span className="flex-1">{banner}</span>
          <button onClick={() => setBanner(null)} className="btn-ghost p-1">
            <X size={14} />
          </button>
        </div>
      )}
      {deleteError && <p className="text-sm text-rose-600">{deleteError}</p>}

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
            {isAdmin && (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setEditingInfo(p)} className="btn-ghost p-2" title="Rediger navn/bilde">
                  <Pencil size={16} />
                </button>
                <button onClick={() => setEditing(p)} className="btn-ghost p-2" title="Rediger påloggingsdetaljer">
                  <KeyRound size={16} />
                </button>
                <button
                  onClick={() => handleResetMfa(p)}
                  disabled={resettingMfaId === p.id}
                  className="btn-ghost p-2"
                  title="Nullstill topartsinnlogging (mistet telefon e.l.)"
                >
                  <ShieldOff size={16} />
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  disabled={deletingId === p.id}
                  className="btn-ghost p-2 text-rose-600"
                  title="Slett spiller"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showCreate && <CreatePlayerModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {newCredentials && <NewCredentialsModal creds={newCredentials} onClose={() => setNewCredentials(null)} />}
      {editing && (
        <EditCredentialsModal player={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
      {editingInfo && (
        <EditInfoModal player={editingInfo} onClose={() => setEditingInfo(null)} onSaved={() => handleSaved('Spilleren er oppdatert')} />
      )}
    </div>
  )
}

function EditInfoModal({ player, onClose, onSaved }: { player: Player; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(player.name)
  const [avatarUrl, setAvatarUrl] = useState(player.avatar_url ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    if (!name.trim()) {
      setError('Navn kan ikke være tomt')
      return
    }
    setSaving(true)
    const { error } = await supabase.rpc('admin_update_player', {
      p_player_id: player.id,
      p_name: name.trim(),
      p_avatar_url: avatarUrl.trim() || null,
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
      <div className="card w-full max-w-sm p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Rediger spiller</h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Navn</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Avatar-URL</label>
            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="input" placeholder="Valgfritt" />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Lagrer...' : 'Lagre'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreatePlayerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (creds: NewCredentials) => void }) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setError(null)
    setSaving(true)
    const { data, error } = await supabase.functions.invoke('manage-player', {
      body: { action: 'create', name, username },
    })
    setSaving(false)
    if (error || data?.error) {
      setError(data?.error ?? error?.message ?? 'Kunne ikke opprette spiller')
      return
    }
    onCreated({ name, username: data.username, password: data.password })
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
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button onClick={handleCreate} disabled={saving} className="btn-primary">
            {saving ? 'Oppretter...' : 'Opprett spiller'}
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Et midlertidig passord blir generert automatisk – du får se det med en gang spilleren er opprettet.
          </p>
        </div>
      </div>
    </div>
  )
}

function NewCredentialsModal({ creds, onClose }: { creds: NewCredentials; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`Brukernavn: ${creds.username}\nPassord: ${creds.password}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API unavailable — user can still select the text manually
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 size={20} className="text-emerald-500" />
          <h2 className="text-lg font-bold">{creds.name} er lagt til</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Gi disse påloggingsdetaljene videre til spilleren. De vises kun denne ene gangen.
        </p>
        <div className="card bg-slate-50 dark:bg-slate-800/50 p-4 flex flex-col gap-2 font-mono text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500 dark:text-slate-400">Brukernavn</span>
            <span className="font-semibold">{creds.username}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500 dark:text-slate-400">Passord</span>
            <span className="font-semibold">{creds.password}</span>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={handleCopy} className="btn-secondary flex-1 text-sm">
            <Copy size={16} /> {copied ? 'Kopiert!' : 'Kopier'}
          </button>
          <button onClick={onClose} className="btn-primary flex-1 text-sm">
            Jeg har notert dette
          </button>
        </div>
      </div>
    </div>
  )
}

function EditCredentialsModal({ player, onClose, onSaved }: { player: Player; onClose: () => void; onSaved: (message: string) => void }) {
  const [username, setUsername] = useState(player.username ?? '')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    setSaving(true)

    const usernameChanged = username.trim() !== (player.username ?? '')
    if (usernameChanged) {
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
    const message =
      usernameChanged && password
        ? `Brukernavn og passord for ${player.name} er oppdatert`
        : password
          ? `Passordet for ${player.name} er byttet`
          : `Brukernavnet til ${player.name} er oppdatert`
    onSaved(message)
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
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Lagrer...' : 'Lagre'}
          </button>
        </div>
      </div>
    </div>
  )
}
