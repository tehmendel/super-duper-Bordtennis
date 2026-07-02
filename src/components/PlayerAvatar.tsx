const PALETTE = [
  'bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-lime-500',
  'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500',
  'bg-indigo-500', 'bg-violet-500', 'bg-fuchsia-500', 'bg-pink-500',
]

function colorFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

const SIZES = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-16 h-16 text-xl' }

export function PlayerAvatar({
  name,
  avatarUrl,
  size = 'md',
}: {
  name: string
  avatarUrl?: string | null
  size?: keyof typeof SIZES
}) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${SIZES[size]} rounded-full object-cover shrink-0`} />
  }
  return (
    <div
      className={`${SIZES[size]} ${colorFor(name)} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}
    >
      {initials(name)}
    </div>
  )
}
