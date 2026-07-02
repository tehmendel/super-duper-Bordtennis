import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Tournament } from '@/lib/types'

export function Tournaments() {
  const { player } = useAuth()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })
      .returns<Tournament[]>()
      .then(({ data }) => {
        setTournaments(data ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Turneringer</h1>
        {player?.is_admin && (
          <Link to="/tournaments/new" className="btn-primary py-2 px-3 text-sm">
            <Plus size={16} /> Ny turnering
          </Link>
        )}
      </div>

      {loading ? (
        <p className="text-slate-500">Laster...</p>
      ) : tournaments.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Ingen turneringer ennå.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tournaments.map((t) => (
            <Link key={t.id} to={`/tournaments/${t.id}`} className="card p-4 flex items-center gap-3">
              <Trophy size={20} className="text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{t.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(t.created_at).toLocaleDateString('no-NO')}
                </p>
              </div>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  t.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                }`}
              >
                {t.status === 'completed' ? 'Fullført' : 'Pågår'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
