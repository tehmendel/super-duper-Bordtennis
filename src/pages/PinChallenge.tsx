import { useEffect, useState, type FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export function PinChallenge() {
  const { verifyPin, signOut } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [pinIsSet, setPinIsSet] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('shared_device_pin_is_set').then(({ data, error }) => {
      if (cancelled) return
      setPinIsSet(error ? true : !!data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    setVerifying(true)
    setError(null)
    try {
      const ok = await verifyPin(pin.trim())
      if (!ok) {
        setPin('')
        setError('Feil PIN-kode. Prøv igjen.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt. Prøv igjen.')
    }
    setVerifying(false)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8 text-center">
        <KeyRound size={40} className="mx-auto mb-2 text-brand-600" />
        <h1 className="text-xl font-bold mb-1">Skriv inn PIN-kode</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Denne enheten er delt og bruker en PIN-kode i stedet for topartsinnlogging.
        </p>

        {pinIsSet === false ? (
          <p className="text-sm text-rose-600">
            Ingen PIN-kode er satt opp for denne kontoen ennå. Be en administrator sette den opp under Admin → Fellesbruker.
          </p>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-3">
            <input
              required
              autoFocus
              inputMode="numeric"
              autoComplete="off"
              placeholder="PIN-kode"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="input text-center tracking-widest text-lg"
              maxLength={6}
            />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button type="submit" disabled={verifying || pin.length < 4} className="btn-primary">
              {verifying ? 'Sjekker...' : 'Lås opp'}
            </button>
          </form>
        )}

        <button onClick={signOut} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mt-6">
          Logg ut
        </button>
      </div>
    </div>
  )
}
