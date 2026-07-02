import { NavLink, Outlet } from 'react-router-dom'
import { Home, PlusCircle, CheckCircle2, History, Trophy, QrCode, Sun, Moon, LogOut, Swords, UserPlus, MoreHorizontal, UserCog, ShieldCheck, Calendar, Medal } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/hooks/useTheme'
import { PlayerAvatar } from '@/components/PlayerAvatar'

const PRIMARY_NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/matches/new', label: 'Ny kamp', icon: PlusCircle, end: false },
  { to: '/matches/pending', label: 'Bekreftelser', icon: CheckCircle2, end: false },
  { to: '/matches', label: 'Historikk', icon: History, end: true },
  { to: '/leaderboard', label: 'Toppliste', icon: Trophy, end: false },
]

const SECONDARY_NAV_ITEMS = [
  { to: '/profile/edit', label: 'Min profil', icon: UserCog, end: false },
  { to: '/head-to-head', label: 'Head-to-head', icon: Swords, end: false },
  { to: '/seasons', label: 'Sesonger', icon: Calendar, end: false },
  { to: '/tournaments', label: 'Turneringer', icon: Medal, end: false },
  { to: '/qr', label: 'QR', icon: QrCode, end: false },
  { to: '/invite', label: 'Inviter spiller', icon: UserPlus, end: false },
]

const MOBILE_NAV_ITEMS = [
  ...PRIMARY_NAV_ITEMS,
  { to: '/more', label: 'Mer', icon: MoreHorizontal, end: false },
]

export function Layout() {
  const { player, signOut } = useAuth()
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-slate-200 md:dark:border-slate-800 md:p-4 md:gap-2">
        <div className="px-2 py-3 text-lg font-bold">🏓 Super Duper Bordtennis</div>
        {PRIMARY_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition ${
                isActive ? 'bg-brand-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
        <hr className="my-2 border-slate-200 dark:border-slate-800" />
        {SECONDARY_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition ${
                isActive ? 'bg-brand-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
        {player?.is_admin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition ${
                isActive ? 'bg-brand-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <ShieldCheck size={18} />
            Admin
          </NavLink>
        )}
        <div className="mt-auto flex flex-col gap-2">
          {player && (
            <NavLink to={`/players/${player.id}`} className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800">
              <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} size="sm" />
              <span className="truncate text-sm font-medium">{player.name}</span>
            </NavLink>
          )}
          <button onClick={toggle} className="btn-ghost justify-start">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? 'Lys modus' : 'Mørk modus'}
          </button>
          <button onClick={signOut} className="btn-ghost justify-start text-rose-600 dark:text-rose-400">
            <LogOut size={18} />
            Logg ut
          </button>
        </div>
      </aside>

      <header className="flex items-center justify-between p-4 md:hidden border-b border-slate-200 dark:border-slate-800">
        <span className="text-lg font-bold">🏓 Super Duper Bordtennis</span>
        <div className="flex items-center gap-1">
          <button onClick={toggle} className="btn-ghost p-2">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={signOut} className="btn-ghost p-2 text-rose-600 dark:text-rose-400">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
        <div className="mx-auto max-w-4xl p-4 md:p-8">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 grid grid-cols-6 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur md:hidden">
        {MOBILE_NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
