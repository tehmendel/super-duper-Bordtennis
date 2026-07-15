import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { Player } from '@/lib/types'

export function AdminImpersonate() {
  const { realPlayer, startImpersonation } = useAuth()
  const navigate = useNavigate()
  const [players, setPlayers] = useState<Player[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('players')
      .select('*')
      .order('name')
      .then(({ data }) => {
        setPlayers((data ?? []).filter((p) => p.id !== realPlayer?.id))
        setLoading(false)
      })
  }, [realPlayer])

  const filtered = players.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))

  function handlePick(target: Player) {
    startImpersonation(target)
    navigate('/')
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Velg en spiller for å se appen slik den ser ut for dem — meny, tilganger og innhold tilpasses den spilleren.
        Handlinger du utfører mens du ser som en annen bruker blir uansett registrert på din egen konto.
      </p>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søk etter spiller..."
          className="input pl-9"
        />
      </div>

      {loading ? (
        <p className="text-slate-500">Laster...</p>
      ) : (
        <div className="card divide-y divide-slate-200 dark:divide-slate-800">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePick(p)}
              className="flex items-center gap-3 p-3 w-full text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                {p.is_admin && <p className="text-xs text-amber-600 dark:text-amber-400">Admin</p>}
              </div>
              <Eye size={16} className="text-slate-400 shrink-0" />
            </button>
          ))}
          {filtered.length === 0 && <p className="p-3 text-sm text-slate-500 dark:text-slate-400">Ingen treff.</p>}
        </div>
      )}
    </div>
  )
}
