import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { Player } from '@/lib/types'

export function SharedDeviceAdminPanel({ player, onUpdated }: { player: Player; onUpdated: () => void }) {
  const [username, setUsername] = useState(player.username ?? '')
  const [password, setPassword] = useState('')
  const [credentialsSaving, setCredentialsSaving] = useState(false)
  const [credentialsError, setCredentialsError] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [pinSaving, setPinSaving] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSaveCredentials() {
    setCredentialsError(null)
    setCredentialsSaving(true)

    const usernameChanged = username.trim() !== (player.username ?? '')
    if (usernameChanged) {
      const { error } = await supabase.rpc('admin_set_player_username', {
        p_player_id: player.id,
        p_username: username.trim().toLowerCase(),
      })
      if (error) {
        setCredentialsSaving(false)
        setCredentialsError(error.message)
        return
      }
    }

    if (password) {
      const { data, error } = await supabase.functions.invoke('manage-player', {
        body: { action: 'reset_password', playerId: player.id, password },
      })
      if (error || data?.error) {
        setCredentialsSaving(false)
        setCredentialsError(data?.error ?? error?.message ?? 'Kunne ikke sette passord')
        return
      }
    }

    setCredentialsSaving(false)
    setPassword('')
    setMessage('Påloggingsdetaljene er oppdatert')
    onUpdated()
  }

  async function handleSetPin() {
    setPinError(null)
    if (!/^[0-9]{4,6}$/.test(pin)) {
      setPinError('PIN-koden må være 4-6 sifre')
      return
    }
    setPinSaving(true)
    const { error } = await supabase.rpc('admin_set_shared_device_pin', { p_player_id: player.id, p_pin: pin })
    setPinSaving(false)
    if (error) {
      setPinError(error.message)
      return
    }
    setPin('')
    setMessage('PIN-koden er oppdatert')
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div className="flex items-center gap-4">
        <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} size="lg" />
        <div>
          <h1 className="text-2xl font-bold">{player.name}</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Delt enhet — ingen egen spillerstatistikk. Administreres her i stedet for på vanlig spillerprofil.
          </p>
        </div>
      </div>

      {message && <p className="text-sm text-emerald-600">{message}</p>}

      <div className="card p-5 flex flex-col gap-3">
        <h2 className="font-semibold">Påloggingsdetaljer</h2>
        <div>
          <label className="text-sm font-medium mb-1 block">Brukernavn</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            className="input"
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
        </div>
        {credentialsError && <p className="text-sm text-rose-600">{credentialsError}</p>}
        <button onClick={handleSaveCredentials} disabled={credentialsSaving} className="btn-primary self-start">
          {credentialsSaving ? 'Lagrer...' : 'Lagre'}
        </button>
      </div>

      <div className="card p-5 flex flex-col gap-3">
        <h2 className="font-semibold">PIN-kode</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Brukes i stedet for topartsinnlogging siden denne kontoen ikke tilhører én bestemt person. 4-6 sifre.
          Den vises ikke igjen etter at den er satt.
        </p>
        <input
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="input"
          placeholder="Ny PIN-kode"
          maxLength={6}
        />
        {pinError && <p className="text-sm text-rose-600">{pinError}</p>}
        <button onClick={handleSetPin} disabled={pinSaving} className="btn-primary self-start">
          {pinSaving ? 'Lagrer...' : 'Sett PIN-kode'}
        </button>
      </div>
    </div>
  )
}
