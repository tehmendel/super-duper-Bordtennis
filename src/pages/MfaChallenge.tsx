import { useEffect, useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export function MfaChallenge() {
  const { refreshMfaStatus, signOut } = useAuth()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (cancelled) return
      const factor = data?.totp[0]
      if (error || !factor) {
        setError('Fant ingen registrert autentisering. Kontakt en administrator.')
        setLoading(false)
        return
      }
      setFactorId(factor.id)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setVerifying(true)
    setError(null)

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeError || !challenge) {
      setVerifying(false)
      setError('Noe gikk galt. Prøv igjen.')
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    })
    setVerifying(false)
    if (verifyError) {
      setCode('')
      setError('Feil kode. Prøv igjen.')
      return
    }
    await refreshMfaStatus()
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8 text-center">
        <ShieldCheck size={40} className="mx-auto mb-2 text-brand-600" />
        <h1 className="text-xl font-bold mb-1">Bekreft innlogging</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Åpne autentiseringsappen din og skriv inn koden.
        </p>

        {loading ? (
          <p className="text-slate-500">Laster...</p>
        ) : factorId ? (
          <form onSubmit={handleVerify} className="flex flex-col gap-3">
            <input
              required
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-sifret kode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="input text-center tracking-widest text-lg"
              maxLength={6}
            />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button type="submit" disabled={verifying || code.length < 6} className="btn-primary">
              {verifying ? 'Bekrefter...' : 'Bekreft'}
            </button>
          </form>
        ) : (
          error && <p className="text-sm text-rose-600">{error}</p>
        )}

        <button onClick={signOut} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mt-6">
          Logg ut
        </button>
      </div>
    </div>
  )
}
