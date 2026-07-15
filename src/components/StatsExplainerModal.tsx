import { X, Check } from 'lucide-react'

interface TitleCondition {
  emoji: string
  label: string
  requirement: string
  met: boolean
  progress: string
}

export function StatsExplainerModal({
  onClose,
  titleConditions,
  matchesPlayed,
}: {
  onClose: () => void
  titleConditions: TitleCondition[]
  matchesPlayed: number
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-lg p-6 animate-pop-in max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Om spillerkortet og statistikken</h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-6 text-sm">
          <div>
            <p className="font-semibold mb-1">Nivå (LEGENDE / GULL / SØLV / BRONSE)</p>
            <p className="text-slate-500 dark:text-slate-400">
              Basert på hvor du ligger an på topplisten akkurat nå, ikke en fast ratinggrense (siden ratingen
              nullstilles hver sesong). Topp 15% er LEGENDE, topp 40% er GULL, topp 75% er SØLV, resten er BRONSE.
            </p>
          </div>

          <div>
            <p className="font-semibold mb-1">Tittel</p>
            <p className="text-slate-500 dark:text-slate-400 mb-3">
              Beregnes automatisk fra statistikken din — ingen varsel å svare på, ingen egne valg. Listen under
              sjekkes ovenfra og ned, og den første betingelsen du oppfyller blir vist på kortet ditt (så selv om du
              oppfyller flere, vises kun den øverste).
            </p>
            <div className="flex flex-col gap-2">
              {titleConditions.map((t) => (
                <div
                  key={t.label}
                  className={`flex items-center gap-3 rounded-lg p-2.5 ${
                    t.met ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-slate-50 dark:bg-slate-800/50'
                  }`}
                >
                  <span
                    className={`flex items-center justify-center w-5 h-5 rounded-full shrink-0 text-xs ${
                      t.met ? 'bg-emerald-500 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {t.met ? <Check size={12} /> : ''}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {t.emoji} {t.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.requirement}</p>
                  </div>
                  <span className={`text-xs font-mono shrink-0 ${t.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {t.progress}
                  </span>
                </div>
              ))}
            </div>
            {matchesPlayed < 5 && (
              <p className="text-xs text-slate-400 mt-2 italic">
                De fleste titlene krever minst 5 spilte kamper — du har spilt {matchesPlayed} så langt.
              </p>
            )}
          </div>

          <div>
            <p className="font-semibold mb-2">Avansert statistikk</p>
            <div className="flex flex-col gap-3 text-slate-500 dark:text-slate-400">
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Peak rating</p>
                <p>Den høyeste ratingen du noensinne har hatt, og datoen du nådde den.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Rating-volatilitet</p>
                <p>
                  Hvor mye rating-endringene dine svinger fra kamp til kamp (standardavviket til alle
                  rating-endringene). Lav verdi betyr jevne resultater, høy verdi betyr store svingninger opp og ned.
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Momentum (5)</p>
                <p>
                  Snittendringen din i de 5 siste kampene, sammenlignet med snittendringen over hele karrieren. Positiv
                  betyr at du er i bedre form nå enn vanlig.
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Sensasjonsseire (som underdog)</p>
                <p>Antall kamper du har vunnet der du var lavere ratet enn motstanderen før kampen.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Snitt poengmargin</p>
                <p>Gjennomsnittlig poengforskjell per sett du har spilt (uansett om du vant eller tapte settet).</p>
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Deuce-rate</p>
                <p>Andelen av settene dine som gikk til minst 10-10 (tett kamp helt til slutten).</p>
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Comeback-rate</p>
                <p>
                  Av kampene der du tapte første sett: hvor stor andel vant du likevel (kun kamper med mer enn ett
                  sett).
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">Clutch-rate</p>
                <p>Av kampene som gikk helt til avgjørende sett: hvor stor andel av de avgjørende settene du vant.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
