import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'

export function EditProfile() {
  const { player, session, refreshPlayer } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(player?.name ?? '')
  const avatarUrl = player?.avatar_url ?? null
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!player || !session) return null

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

  return (
    <div className="flex flex-col gap-6 max-w-sm">
      <h1 className="text-2xl font-bold">Rediger profil</h1>

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
    </div>
  )
}
