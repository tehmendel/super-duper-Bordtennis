import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export function InvitePlayer() {
  const { hasAccess } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)
    const { data, error } = await supabase.functions.invoke('invite-player', { body: { email } })
    if (error || data?.error) {
      setStatus('error')
      setError(data?.error ?? error?.message ?? 'Kunne ikke sende invitasjon')
      return
    }
    setStatus('sent')
    setEmail('')
  }

  if (!hasAccess('invite', 'write')) {
    return <p className="text-slate-500 dark:text-slate-400">Du har kun lesetilgang og kan ikke sende invitasjoner.</p>
  }

  return (
    <div className="flex flex-col gap-6 max-w-sm">
      <h1 className="text-2xl font-bold">Inviter spiller</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Appen er kun tilgjengelig for inviterte. Skriv inn e-posten til kollegaen din, så sender vi en
        påloggingslenke. De oppretter selv navn og avatar første gang de logger inn.
      </p>

      <form onSubmit={handleSubmit} className="card p-5 flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="kollega@firma.no"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
        />
        {status === 'error' && <p className="text-sm text-rose-600">{error}</p>}
        {status === 'sent' && <p className="text-sm text-emerald-600">Invitasjon sendt! 🎉</p>}
        <button type="submit" disabled={status === 'sending'} className="btn-primary">
          {status === 'sending' ? 'Sender...' : 'Send invitasjon'}
        </button>
      </form>
    </div>
  )
}
