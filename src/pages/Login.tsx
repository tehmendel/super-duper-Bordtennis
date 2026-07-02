import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8 text-center">
        <div className="text-4xl mb-2">🏓</div>
        <h1 className="text-xl font-bold mb-1">Ivolv Bordtennis</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Logg inn med jobb-e-posten din for å registrere kamper og se statistikk.
        </p>

        {sent ? (
          <p className="text-emerald-600 dark:text-emerald-400 text-sm">
            Sjekk innboksen din — vi har sendt deg en påloggingslenke til <strong>{email}</strong>.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="deg@firma.no"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Sender...' : 'Send påloggingslenke'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
