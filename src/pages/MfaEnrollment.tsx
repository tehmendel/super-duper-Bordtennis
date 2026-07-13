import { useEffect, useState, type FormEvent } from 'react'
import { ShieldCheck, Copy, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export function MfaEnrollment() {
  const { refreshMfaStatus, signOut } = useAuth()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function enroll() {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
      if (cancelled) return
      if (error || !data) {
        // A leftover unverified factor from a previous abandoned attempt
        // (e.g. the page was refreshed mid-enrollment) blocks a fresh
        // enroll call until it expires on its own; not otherwise visible
        // or removable from the client.
        setError(
          error?.message.includes('already exists')
            ? 'Du har allerede en påbegynt registrering. Vent noen minutter og prøv igjen.'
            : 'Kunne ikke starte MFA-registrering. Prøv å laste siden på nytt.',
        )
        setLoading(false)
        return
      }
      setFactorId(data.id)
      // GoTrue returns raw SVG markup here, not a data URI or a rendered
      // PNG — wrap it so it works as a plain <img src>, avoiding the need
      // for dangerouslySetInnerHTML.
      setQrCode(`data:image/svg+xml;utf8,${encodeURIComponent(data.totp.qr_code)}`)
      setSecret(data.totp.secret)
      setLoading(false)
    }
    enroll()
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
      setError('Feil kode. Sjekk at klokken på telefonen er riktig og prøv igjen.')
      return
    }
    await refreshMfaStatus()
  }

  async function copySecret() {
    if (!secret) return
    await navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8 text-center">
        <ShieldCheck size={40} className="mx-auto mb-2 text-brand-600" />
        <h1 className="text-xl font-bold mb-1">Sett opp topartsinnlogging</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Bordtennisportalen krever nå en autentiseringsapp (f.eks. Google Authenticator, Authy eller 1Password) i tillegg til passord.
          Dette må settes opp før du kan fortsette.
        </p>

        {loading ? (
          <p className="text-slate-500">Laster...</p>
        ) : qrCode ? (
          <div className="flex flex-col gap-4">
            <div className="bg-white p-3 rounded-xl mx-auto w-fit">
              <img src={qrCode} alt="QR-kode for autentiseringsapp" className="w-40 h-40" />
            </div>

            {secret && (
              <button
                type="button"
                onClick={copySecret}
                className="btn-secondary text-xs font-mono justify-center"
                title="Kopier nøkkel for manuell registrering"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {secret}
              </button>
            )}

            <form onSubmit={handleVerify} className="flex flex-col gap-3">
              <input
                required
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
                {verifying ? 'Bekrefter...' : 'Bekreft og aktiver'}
              </button>
            </form>
          </div>
        ) : (
          error && <p className="text-sm text-rose-600">{error}</p>
        )}

        <button onClick={signOut} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mt-6">
          Logg ut og gjør dette senere
        </button>
      </div>
    </div>
  )
}
