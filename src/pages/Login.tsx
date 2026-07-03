import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: email, error: resolveError } = await supabase.rpc('resolve_username_to_email', {
      p_username: username.trim(),
    })

    if (resolveError || !email) {
      setLoading(false)
      setError('Feil brukernavn eller passord')
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInError) setError('Feil brukernavn eller passord')
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8 text-center">
        <div className="text-4xl mb-2">🏓</div>
        <h1 className="text-xl font-bold mb-1">Bordtennisportalen</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Logg inn med brukernavnet og passordet du har fått for å registrere kamper og se statistikk.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            required
            placeholder="Brukernavn"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="off"
            className="input"
          />
          <input
            type="password"
            required
            placeholder="Passord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Logger inn...' : 'Logg inn'}
          </button>
        </form>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-6">
          Har du ikke fått brukernavn og passord ennå? Spør en administrator.
        </p>
      </div>
    </div>
  )
}
