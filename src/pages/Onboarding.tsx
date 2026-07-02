import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export function Onboarding() {
  const { session, refreshPlayer } = useAuth()
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setLoading(true)
    setError(null)
    const { error } = await supabase.from('players').insert({
      auth_user_id: session.user.id,
      name: name.trim(),
      avatar_url: avatarUrl.trim() || null,
    })
    setLoading(false)
    if (error) setError(error.message)
    else await refreshPlayer()
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="text-4xl mb-2 text-center">🏓</div>
        <h1 className="text-xl font-bold mb-1 text-center">Opprett spillerprofil</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 text-center">
          Bli med i ligaen! Alle starter på 1000 i rating.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            required
            placeholder="Fullt navn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
          <input
            placeholder="Avatar-URL (valgfritt)"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            className="input"
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Oppretter...' : 'Bli med i ligaen'}
          </button>
        </form>
      </div>
    </div>
  )
}
