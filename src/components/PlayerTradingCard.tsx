import { useState } from 'react'
import { Download, X } from 'lucide-react'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { useShareImage } from '@/hooks/useShareImage'
import type { Player } from '@/lib/types'

interface Title {
  emoji: string
  label: string
}

interface CardData {
  player: Player
  title: Title | null
  winRate: number
  matchesPlayed: number
  peakRating: number | null
  achievementsEarned: number
  achievementsTotal: number
  tier: ReturnType<typeof tierFor>
}

function CardFace({ data, size, innerRef }: { data: CardData; size: 'sm' | 'lg'; innerRef?: React.Ref<HTMLDivElement> }) {
  const { player, title, winRate, matchesPlayed, peakRating, achievementsEarned, achievementsTotal, tier } = data
  const sizeClasses = size === 'sm' ? 'w-64' : 'w-80 sm:w-96'
  return (
    <div
      ref={innerRef}
      className={`relative ${sizeClasses} aspect-[3/4] rounded-2xl bg-gradient-to-br ${tier.gradient} ${tier.text} p-4 flex flex-col items-center shadow-xl`}
    >
      <div className="absolute top-3 left-4 text-xs font-black tracking-widest opacity-70">{tier.name}</div>
      <div className="absolute top-3 right-4 text-3xl font-black">{Math.round(player.rating)}</div>

      <div className="mt-10 rounded-full ring-4 ring-white/60 overflow-hidden">
        <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} size="lg" />
      </div>

      <p className="mt-3 text-lg font-black text-center leading-tight">{player.name}</p>
      {title && (
        <p className="text-xs font-semibold opacity-80 text-center">
          {title.emoji} {title.label}
        </p>
      )}

      <div className="mt-4 w-full grid grid-cols-2 gap-2 text-center">
        <div className="bg-white/30 rounded-lg py-1.5">
          <p className="text-[10px] font-semibold opacity-70">SEIER%</p>
          <p className="text-base font-black">{winRate}%</p>
        </div>
        <div className="bg-white/30 rounded-lg py-1.5">
          <p className="text-[10px] font-semibold opacity-70">KAMPER</p>
          <p className="text-base font-black">{matchesPlayed}</p>
        </div>
        <div className="bg-white/30 rounded-lg py-1.5">
          <p className="text-[10px] font-semibold opacity-70">PEAK</p>
          <p className="text-base font-black">{peakRating ? Math.round(peakRating) : '–'}</p>
        </div>
        <div className="bg-white/30 rounded-lg py-1.5">
          <p className="text-[10px] font-semibold opacity-70">PRESTASJONER</p>
          <p className="text-base font-black">{achievementsEarned}/{achievementsTotal}</p>
        </div>
      </div>
    </div>
  )
}

// Tier is based on the player's rank percentile in the current pool rather than an
// absolute rating cutoff, since ratings reset to ~1000 every season.
function tierFor(rank: number | null, total: number) {
  const percentile = rank && total > 0 ? rank / total : 1
  if (percentile <= 0.15) return { name: 'LEGENDE', gradient: 'from-amber-400 via-yellow-300 to-amber-500', text: 'text-amber-950' }
  if (percentile <= 0.4) return { name: 'GULL', gradient: 'from-yellow-400 via-amber-300 to-yellow-500', text: 'text-yellow-950' }
  if (percentile <= 0.75) return { name: 'SØLV', gradient: 'from-slate-300 via-slate-100 to-slate-400', text: 'text-slate-900' }
  return { name: 'BRONSE', gradient: 'from-orange-400 via-orange-300 to-orange-600', text: 'text-orange-950' }
}

export function PlayerTradingCard({
  player,
  title,
  winRate,
  matchesPlayed,
  peakRating,
  achievementsEarned,
  achievementsTotal,
  rank,
  totalPlayers,
}: {
  player: Player
  title: Title | null
  winRate: number
  matchesPlayed: number
  peakRating: number | null
  achievementsEarned: number
  achievementsTotal: number
  rank: number | null
  totalPlayers: number
}) {
  const { ref, share } = useShareImage(`${player.name.replace(/\s+/g, '-').toLowerCase()}-spillerkort.png`)
  const tier = tierFor(rank, totalPlayers)
  const [expanded, setExpanded] = useState(false)

  const data: CardData = { player, title, winRate, matchesPlayed, peakRating, achievementsEarned, achievementsTotal, tier }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={() => setExpanded(true)}
        className="cursor-zoom-in rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label="Vis spillerkort i full størrelse"
      >
        <CardFace data={data} size="sm" innerRef={ref} />
      </button>

      <button onClick={share} className="btn-secondary text-sm">
        <Download size={16} /> Last ned spillerkort
      </button>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setExpanded(false)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setExpanded(false)}
              className="absolute -top-3 -right-3 bg-white dark:bg-slate-800 rounded-full p-1.5 shadow-lg z-10"
              aria-label="Lukk"
            >
              <X size={18} />
            </button>
            <CardFace data={data} size="lg" />
          </div>
        </div>
      )}
    </div>
  )
}
