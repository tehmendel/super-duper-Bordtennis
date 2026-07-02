import { ChevronUp, ChevronDown } from 'lucide-react'
import type { CardLayout } from '@/hooks/useCardLayout'

export function CardHeader({
  layout,
  cardId,
  className = 'text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3',
}: {
  layout: CardLayout
  cardId: string
  className?: string
}) {
  const idx = layout.orderedIds.indexOf(cardId)

  if (!layout.editMode) {
    const title = layout.getTitle(cardId)
    return title ? <p className={className}>{title}</p> : null
  }

  return (
    <div className="flex items-center gap-2 mb-3">
      <input
        value={layout.getTitle(cardId)}
        onChange={(e) => layout.setTitle(cardId, e.target.value)}
        className="input py-1 text-sm font-semibold flex-1"
      />
      <div className="flex gap-1 shrink-0">
        <button onClick={() => layout.moveUp(cardId)} disabled={idx <= 0} className="btn-ghost p-1.5">
          <ChevronUp size={14} />
        </button>
        <button onClick={() => layout.moveDown(cardId)} disabled={idx >= layout.orderedIds.length - 1} className="btn-ghost p-1.5">
          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  )
}
