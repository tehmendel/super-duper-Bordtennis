import { NavLink, Outlet } from 'react-router-dom'
import { Home, PlusCircle, CheckCircle2, History, Trophy, QrCode, Sun, Moon, LogOut, Swords, Users, MoreHorizontal, ShieldCheck, Medal, LayoutGrid, Check, ScrollText } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/hooks/useTheme'
import { useLayoutEdit } from '@/contexts/LayoutEditContext'
import { useLadderEnabled } from '@/hooks/useLadderEnabled'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { PageKey } from '@/lib/types'

const PRIMARY_NAV_ITEMS: { to: string; label: string; icon: typeof Home; end: boolean; pageKey: PageKey }[] = [
  { to: '/', label: 'Dashboard', icon: Home, end: true, pageKey: 'dashboard' },
  { to: '/matches/new', label: 'Ny kamp', icon: PlusCircle, end: false, pageKey: 'new_match' },
  { to: '/matches/pending', label: 'Bekreftelser', icon: CheckCircle2, end: false, pageKey: 'pending' },
  { to: '/matches', label: 'Historikk', icon: History, end: true, pageKey: 'history' },
  { to: '/leaderboard', label: 'Toppliste', icon: Trophy, end: false, pageKey: 'leaderboard' },
]

const SECONDARY_NAV_ITEMS: { to: string; label: string; icon: typeof Home; end: boolean; pageKey: PageKey; ladderOnly?: boolean }[] = [
  { to: '/head-to-head', label: 'Head-to-head', icon: Swords, end: false, pageKey: 'head_to_head' },
  { to: '/tournaments', label: 'Turneringer', icon: Medal, end: false, pageKey: 'tournaments' },
  { to: '/stigespillet', label: 'Stigespillet', icon: ScrollText, end: false, pageKey: 'ladder', ladderOnly: true },
  { to: '/qr', label: 'QR', icon: QrCode, end: false, pageKey: 'qr' },
  { to: '/players', label: 'Spillere', icon: Users, end: false, pageKey: 'players' },
]

const MOBILE_EXTRA_ITEM = { to: '/more', label: 'Mer', icon: MoreHorizontal, end: false }

export function Layout() {
  const { player, signOut, hasAccess } = useAuth()
  const { theme, toggle } = useTheme()
  const { editMode, toggle: toggleEditMode } = useLayoutEdit()
  const ladderEnabled = useLadderEnabled()

  const visiblePrimary = PRIMARY_NAV_ITEMS.filter((item) => hasAccess(item.pageKey))
  const visibleSecondary = SECONDARY_NAV_ITEMS.filter((item) => hasAccess(item.pageKey) && (!item.ladderOnly || ladderEnabled))
  const mobileItems = [...visiblePrimary, MOBILE_EXTRA_ITEM]

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-slate-200 md:dark:border-slate-800 md:p-4 md:gap-2">
        <div className="px-2 py-3 text-lg font-bold">🏓 Bordtennisportalen</div>
        {visiblePrimary.map(({ to, label, icon: Icon, end }) => (
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
        {visibleSecondary.map(({ to, label, icon: Icon, end }) => (
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
        <span className="text-lg font-bold">🏓 Bordtennisportalen</span>
        <div className="flex items-center gap-1">
          {player && (
            <NavLink to={`/players/${player.id}`} className="btn-ghost p-1.5">
              <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} size="sm" />
            </NavLink>
          )}
          <button onClick={toggle} className="btn-ghost p-2">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={signOut} className="btn-ghost p-2 text-rose-600 dark:text-rose-400">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
        <div className="mx-auto max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl p-4 md:p-8">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 grid border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur md:hidden" style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}>
        {mobileItems.map(({ to, label, icon: Icon, end }) => (
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

      {player?.is_admin && (
        <button
          onClick={toggleEditMode}
          className={`fixed bottom-20 md:bottom-6 right-4 z-50 rounded-full p-3 shadow-lg ${
            editMode ? 'bg-emerald-600 text-white' : 'bg-brand-600 text-white'
          }`}
          title={editMode ? 'Avslutt redigering av sider' : 'Rediger kort og titler'}
        >
          {editMode ? <Check size={20} /> : <LayoutGrid size={20} />}
        </button>
      )}
    </div>
  )
}
