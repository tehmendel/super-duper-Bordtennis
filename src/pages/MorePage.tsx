import { Link } from 'react-router-dom'
import { Swords, QrCode, UserPlus, ChevronRight, ShieldCheck, Medal, ScrollText } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLadderEnabled } from '@/hooks/useLadderEnabled'
import type { PageKey } from '@/lib/types'

const ITEMS: { to: string; label: string; description: string; icon: typeof Swords; pageKey: PageKey; ladderOnly?: boolean }[] = [
  { to: '/head-to-head', label: 'Head-to-head', description: 'Sammenlign to spillere og se Elo-odds', icon: Swords, pageKey: 'head_to_head' },
  { to: '/tournaments', label: 'Turneringer', description: 'Se og delta i interne turneringer', icon: Medal, pageKey: 'tournaments' },
  { to: '/stigespillet', label: 'Stigespillet', description: 'Ladder-stige og historikk over utfordringer', icon: ScrollText, pageKey: 'ladder', ladderOnly: true },
  { to: '/qr', label: 'QR-kode', description: 'Heng opp ved bordet', icon: QrCode, pageKey: 'qr' },
  { to: '/invite', label: 'Inviter spiller', description: 'Send påloggingslenke til en kollega', icon: UserPlus, pageKey: 'invite' },
]

export function MorePage() {
  const { player, hasAccess } = useAuth()
  const ladderEnabled = useLadderEnabled()
  const visible = ITEMS.filter((item) => hasAccess(item.pageKey) && (!item.ladderOnly || ladderEnabled))
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
