import { Link } from 'react-router-dom'
import { Swords, QrCode, UserPlus, ChevronRight, UserCog, ShieldCheck, Calendar, Medal, BarChart3, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const ITEMS = [
  { to: '/profile/edit', label: 'Min profil', description: 'Endre navn og profilbilde', icon: UserCog },
  { to: '/head-to-head', label: 'Head-to-head', description: 'Sammenlign to spillere', icon: Swords },
  { to: '/stats', label: 'Statistikk', description: 'Dominansmatrise, rivaliseringer og upsets', icon: BarChart3 },
  { to: '/what-if', label: 'Hva om?', description: 'Simuler en hypotetisk kamp mellom to spillere', icon: Sparkles },
  { to: '/seasons', label: 'Sesonger', description: 'Se tidligere sesonger og plasseringer', icon: Calendar },
  { to: '/tournaments', label: 'Turneringer', description: 'Se og delta i interne turneringer', icon: Medal },
  { to: '/qr', label: 'QR-kode', description: 'Heng opp ved bordet', icon: QrCode },
  { to: '/invite', label: 'Inviter spiller', description: 'Send påloggingslenke til en kollega', icon: UserPlus },
]

export function MorePage() {
  const { player } = useAuth()
  const items = player?.is_admin
    ? [...ITEMS, { to: '/admin', label: 'Admin', description: 'Rediger kamper og se aktivitetsstatistikk', icon: ShieldCheck }]
    : ITEMS

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
