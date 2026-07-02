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
  return (
    <div
      title={earned && earnedAt ? `Oppnådd ${new Date(earnedAt).toLocaleDateString('no-NO')}` : 'Ikke oppnådd ennå'}
      className={`card flex flex-col items-center gap-1 p-4 text-center transition ${
        earned ? '' : 'opacity-35 grayscale'
      }`}
    >
      <span className="text-3xl">{achievement.icon}</span>
      <span className="text-sm font-semibold">{achievement.name}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{achievement.description}</span>
    </div>
  )
}
