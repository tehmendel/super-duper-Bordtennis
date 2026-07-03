import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trophy, Users, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { Player, Tournament, TournamentMatch } from '@/lib/types'

interface EnrichedTournament extends Tournament {
  participantCount: number
  champion: Player | null
}

export function Tournaments() {
  const { player } = useAuth()
  const [tournaments, setTournaments] = useState<EnrichedTournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false }).returns<Tournament[]>()
      const list = t ?? []
      const ids = list.map((x) => x.id)

      if (ids.length === 0) {
        setTournaments([])
        setLoading(false)
        return
      }

      const [{ data: participants }, { data: matches }] = await Promise.all([
        supabase.from('tournament_participants').select('tournament_id, player_id').in('tournament_id', ids),
        supabase
          .from('tournament_matches')
          .select('*, player1:players!tournament_matches_player1_id_fkey(*), player2:players!tournament_matches_player2_id_fkey(*)')
          .in('tournament_id', ids)
          .returns<(TournamentMatch & { player1: Player | null; player2: Player | null })[]>(),
      ])

      const enriched = list.map((tour) => {
        const participantCount = (participants ?? []).filter((p) => p.tournament_id === tour.id).length
        const tourMatches = (matches ?? []).filter((m) => m.tournament_id === tour.id)
        const maxRound = Math.max(0, ...tourMatches.map((m) => m.round))
        const finalMatch = tourMatches.find((m) => m.round === maxRound)
        const champion =
          tour.status === 'completed' && finalMatch?.winner_id
            ? [finalMatch.player1, finalMatch.player2].find((p) => p?.id === finalMatch.winner_id) ?? null
            : null
        return { ...tour, participantCount, champion }
      })

      setTournaments(enriched)
      setLoading(false)
    }
    load()
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              to={`/tournaments/${t.id}`}
              className="card p-4 flex flex-col gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <div className="flex items-center gap-2">
                <Trophy size={20} className="text-amber-500 shrink-0" />
                <p className="font-semibold truncate flex-1">{t.name}</p>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    t.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                  }`}
                >
                  {t.status === 'completed' ? 'Fullført' : 'Pågår'}
                </span>
              </div>

              {t.champion ? (
                <div className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/10 rounded-lg px-2 py-1.5">
                  <Trophy size={14} className="text-amber-500 shrink-0" />
                  <PlayerAvatar name={t.champion.name} avatarUrl={t.champion.avatar_url} size="sm" />
                  <span className="text-sm font-semibold truncate">{t.champion.name}</span>
                </div>
              ) : (
                <div className="h-8" />
              )}

              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Users size={14} /> {t.participantCount} spillere
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={14} /> {new Date(t.created_at).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
