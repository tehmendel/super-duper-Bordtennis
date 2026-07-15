import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { pushSupported, getExistingSubscription, enablePushNotifications, disablePushNotifications } from '@/lib/push'

export function EditProfile() {
  const { player, session, refreshPlayer, hasAccess, isImpersonating } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(player?.name ?? '')
  const avatarUrl = player?.avatar_url ?? null
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSaved, setPasswordSaved] = useState(false)

  useEffect(() => {
    getExistingSubscription().then((sub) => setPushEnabled(!!sub))
  }, [])

  async function togglePush() {
    if (!player) return
    setPushBusy(true)
    setPushError(null)
    try {
      if (pushEnabled) {
        await disablePushNotifications()
        setPushEnabled(false)
      } else {
        await enablePushNotifications(player.id)
        setPushEnabled(true)
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Noe gikk galt')
    }
    setPushBusy(false)
  }

  if (!player || !session) return null

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    setPasswordBusy(true)
    setPasswordError(null)
    setPasswordSaved(false)
    if (newPassword.length < 8) {
      setPasswordBusy(false)
      setPasswordError('Passordet må være minst 8 tegn')
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordBusy(false)
    if (error) {
      setPasswordError(error.message)
      return
    }
    setPasswordSaved(true)
    setNewPassword('')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    let newAvatarUrl = avatarUrl

    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop() ?? 'jpg'
      const path = `${session!.user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, avatarFile, {
        cacheControl: '3600',
        upsert: true,
      })
      if (uploadError) {
        setSaving(false)
        setError(uploadError.message)
        return
      }
      newAvatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
    }

    const { error: updateError } = await supabase
      .from('players')
      .update({ name: name.trim(), avatar_url: newAvatarUrl })
      .eq('id', player!.id)

    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }

    await refreshPlayer()
    navigate(`/players/${player!.id}`)
  }

  const canEdit = hasAccess('profile_edit', 'write')

  return (
    <div className="flex flex-col gap-6 max-w-sm">
      <h1 className="text-2xl font-bold">Rediger profil</h1>

      {isImpersonating ? (
        <div className="card p-5 flex items-center gap-3">
          <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Profilredigering er slått av mens du ser som en annen bruker — endringer ville uansett blitt lagret på din
            egen konto, ikke {player.name}s. Avslutt visningen for å redigere din egen profil.
          </p>
        </div>
      ) : canEdit ? (
        <>
          <form onSubmit={handleSubmit} className="card p-5 flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3">
              {preview || avatarUrl ? (
                <img src={preview ?? avatarUrl ?? ''} alt={name} className="w-24 h-24 rounded-full object-cover" />
              ) : (
                <PlayerAvatar name={name || player.name} avatarUrl={null} size="lg" />
              )}
              <label className="btn-secondary cursor-pointer text-sm">
                Velg bilde
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Navn</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Lagrer...' : 'Lagre endringer'}
            </button>
          </form>

          <form onSubmit={handlePasswordChange} className="card p-5 flex flex-col gap-3">
            <p className="text-sm font-semibold">Passord</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Bytt passordet du logger inn med.</p>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nytt passord (minst 8 tegn)"
              className="input"
            />
            {passwordError && <p className="text-sm text-rose-600">{passwordError}</p>}
            {passwordSaved && <p className="text-sm text-emerald-600">Passordet er oppdatert.</p>}
            <button type="submit" disabled={passwordBusy} className="btn-secondary self-start">
              {passwordBusy ? 'Lagrer...' : 'Oppdater passord'}
            </button>
          </form>
        </>
      ) : (
        <div className="card p-5 flex items-center gap-3">
          <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Du har kun lesetilgang og kan ikke endre navn, bilde eller passord.
          </p>
        </div>
      )}

      {pushSupported() && (
        <div className="card p-5 flex flex-col gap-2">
          <p className="text-sm font-semibold">Push-varsler</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Få et varsel på mobilen/PC-en når noen registrerer en kamp du må bekrefte.
          </p>
          {pushError && <p className="text-sm text-rose-600">{pushError}</p>}
          <button onClick={togglePush} disabled={pushBusy} className={pushEnabled ? 'btn-secondary' : 'btn-primary'}>
            {pushEnabled ? <BellOff size={16} /> : <Bell size={16} />}
            {pushBusy ? 'Vent...' : pushEnabled ? 'Skru av varsler' : 'Skru på varsler'}
          </button>
        </div>
      )}
    </div>
  )
}
