import { Link } from 'react-router-dom'
import { Swords, QrCode, UserPlus, ChevronRight, ShieldCheck, Calendar, Medal, BarChart3, Crown } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import type { PageKey } from '@/lib/types'

const ITEMS: { to: string; label: string; description: string; icon: typeof Swords; pageKey: PageKey }[] = [
  { to: '/head-to-head', label: 'Head-to-head', description: 'Sammenlign to spillere og se Elo-odds', icon: Swords, pageKey: 'head_to_head' },
  { to: '/stats', label: 'Statistikk', description: 'Dominansmatrise, rivaliseringer og upsets', icon: BarChart3, pageKey: 'stats' },
  { to: '/hall-of-fame', label: 'Hall of Fame', description: 'Rekorder gjennom tidene', icon: Crown, pageKey: 'hall_of_fame' },
  { to: '/seasons', label: 'Sesonger', description: 'Se tidligere sesonger og plasseringer', icon: Calendar, pageKey: 'seasons' },
  { to: '/tournaments', label: 'Turneringer', description: 'Se og delta i interne turneringer', icon: Medal, pageKey: 'tournaments' },
  { to: '/qr', label: 'QR-kode', description: 'Heng opp ved bordet', icon: QrCode, pageKey: 'qr' },
  { to: '/invite', label: 'Inviter spiller', description: 'Send påloggingslenke til en kollega', icon: UserPlus, pageKey: 'invite' },
]

export function MorePage() {
  const { player, hasAccess } = useAuth()
  const visible = ITEMS.filter((item) => hasAccess(item.pageKey))
  const items = player?.is_admin
    ? [...visible, { to: '/admin', label: 'Admin', description: 'Rediger kamper, sesonger, roller og statistikk', icon: ShieldCheck }]
    : visible

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Mer</h1>
      <div className="card divide-y divide-slate-200 dark:divide-slate-800">
        {items.map(({ to, label, description, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <Icon size={20} className="text-brand-600 dark:text-brand-400" />
            <div className="flex-1">
              <p className="font-medium">{label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
            </div>
            <ChevronRight size={18} className="text-slate-400" />
          </Link>
        ))}
      </div>
    </div>
  )
}
