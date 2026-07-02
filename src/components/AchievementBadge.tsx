import type { AchievementDefinition } from '@/lib/types'

export function AchievementBadge({
  achievement,
  earned,
  earnedAt,
}: {
  achievement: AchievementDefinition
  earned: boolean
  earnedAt?: string | null
}) {
  const isMystery = achievement.hidden && !earned

  return (
    <div
      title={earned && earnedAt ? `Oppnådd ${new Date(earnedAt).toLocaleDateString('no-NO')}` : isMystery ? 'Skjult prestasjon' : 'Ikke oppnådd ennå'}
      className={`card flex flex-col items-center gap-1 p-4 text-center transition ${
        earned ? '' : 'opacity-35 grayscale'
      }`}
    >
      <span className="text-3xl">{isMystery ? '❓' : achievement.icon}</span>
      <span className="text-sm font-semibold">{isMystery ? '???' : achievement.name}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {isMystery ? 'Skjult prestasjon — lås den opp for å se hva den er' : achievement.description}
      </span>
    </div>
  )
}
