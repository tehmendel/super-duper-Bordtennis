import { X, Dices } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { Player, TournamentMatch, TournamentMatchSet } from '@/lib/types'

interface Props {
  match: (TournamentMatch & { player1: Player | null; player2: Player | null }) | null
  sets: TournamentMatchSet[]
  roundLabel: string
  onClose: () => void
}

export function TournamentMatchDetailModal({ match, sets, roundLabel, onClose }: Props) {
  if (!match) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Kampdetaljer</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{roundLabel}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X size={18} />
          </button>
        </div>

        {match.is_lucky_loser && (
          <span className="inline-flex items-center gap-1 mb-3 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            <Dices size={10} /> Lucky loser-kamp
          </span>
        )}

        <div className="flex items-center justify-around text-center mb-4">
          {[match.player1, match.player2].map((p, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              {p ? (
                <>
                  <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} />
                  <span className={`text-sm font-medium ${match.winner_id === p.id ? 'font-bold' : ''}`}>{p.name}</span>
                </>
              ) : (
                <span className="text-sm text-slate-400 italic">Venter...</span>
              )}
            </div>
          ))}
        </div>

        {sets.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs">
                <th className="text-left font-medium py-1">Sett</th>
                <th className="text-right font-medium py-1">{match.player1?.name}</th>
                <th className="text-right font-medium py-1">{match.player2?.name}</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((s) => {
                const p1Won = s.player1_score > s.player2_score
                return (
                  <tr key={s.set_number} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1.5 text-slate-500">{s.set_number}</td>
                    <td className={`py-1.5 text-right font-mono ${p1Won ? 'font-bold' : ''}`}>{s.player1_score}</td>
                    <td className={`py-1.5 text-right font-mono ${!p1Won ? 'font-bold' : ''}`}>{s.player2_score}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Ingen resultat registrert ennå.</p>
        )}
      </div>
    </div>
  )
}
