import type { AchievementDefinition } from '@/lib/types'

export function AchievementToast({
  achievements,
  onDismiss,
}: {
  achievements: AchievementDefinition[]
  onDismiss: () => void
}) {
  if (achievements.length === 0) return null
  return (
    <div className="fixed inset-x-0 bottom-20 md:bottom-6 z-50 flex justify-center px-4">
      <div className="card animate-pop-in flex max-w-sm items-center gap-3 border-brand-500 p-4 shadow-lg">
        <div className="flex -space-x-2 text-2xl">
          {achievements.map((a) => (
            <span key={a.id}>{a.icon}</span>
          ))}
        </div>
        <div className="flex-1">
          <p className="font-semibold">Ny prestasjon!</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {achievements.map((a) => a.name).join(', ')}
          </p>
        </div>
        <button onClick={onDismiss} className="btn-ghost px-2 py-1 text-sm">
          Lukk
        </button>
      </div>
    </div>
  )
}
