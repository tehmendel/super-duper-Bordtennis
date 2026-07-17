import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { MatchDetailModal } from '@/components/MatchDetailModal'
import { Pagination } from '@/components/Pagination'
import { usePageSize } from '@/hooks/usePageSize'
import { formatDate } from '@/lib/date'
import type { Match, Player, RatingHistoryEntry } from '@/lib/types'

interface EnrichedMatch extends Match {
  player1: Player
  player2: Player
}

export function MatchHistory() {
  const [matches, setMatches] = useState<EnrichedMatch[]>([])
  const [total, setTotal] = useState(0)
  const [deltas, setDeltas] = useState<Record<string, RatingHistoryEntry[]>>({})
  const [players, setPlayers] = useState<Player[]>([])
  const [filterId, setFilterId] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = usePageSize('matchHistory', 50)
  const [loading, setLoading] = useState(true)
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('players').select('*').order('name').then(({ data }) => setPlayers(data ?? []))
  }, [])

  useEffect(() => {
    setPage(0)
  }, [filterId, pageSize])

  useEffect(() => {
    setLoading(true)
    let query = supabase
      .from('matches')
      .select('*, player1:players!matches_player1_id_fkey(*), player2:players!matches_player2_id_fkey(*)', { count: 'exact' })
      .eq('status', 'confirmed')
      .order('confirmed_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1)

    if (filterId) query = query.or(`player1_id.eq.${filterId},player2_id.eq.${filterId}`)

    query.returns<EnrichedMatch[]>().then(async ({ data, count }) => {
      setMatches(data ?? [])
      setTotal(count ?? 0)
      if (data && data.length > 0) {
        const { data: history } = await supabase
          .from('ratings_history')
          .select('*')
          .in('match_id', data.map((m) => m.id))
          .returns<RatingHistoryEntry[]>()
        const grouped: Record<string, RatingHistoryEntry[]> = {}
        history?.forEach((h) => {
          grouped[h.match_id] = [...(grouped[h.match_id] ?? []), h]
        })
        setDeltas(grouped)
      } else {
        setDeltas({})
      }
      setLoading(false)
    })
  }, [filterId, page, pageSize])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Kamphistorikk</h1>
        <select value={filterId} onChange={(e) => setFilterId(e.target.value)} className="input w-auto">
          <option value="">Alle spillere</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-slate-500">Laster...</p>
      ) : matches.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Ingen bekreftede kamper ennå.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {matches.map((m) => {
            const d1 = deltas[m.id]?.find((d) => d.player_id === m.player1_id)
            const d2 = deltas[m.id]?.find((d) => d.player_id === m.player2_id)
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMatchId(m.id)}
                className="card p-4 flex items-center gap-3 flex-wrap text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <span className="text-xs text-slate-400 w-20 shrink-0">
                  {formatDate(m.confirmed_at ?? m.created_at)}
                </span>
                <span className="flex items-center gap-2 flex-1 min-w-0">
                  <PlayerAvatar name={m.player1.name} avatarUrl={m.player1.avatar_url} size="sm" />
                  <span className={`truncate ${m.winner_id === m.player1_id ? 'font-bold' : ''}`}>{m.player1.name}</span>
                  {d1 && (
                    <span className={`text-xs ${d1.delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {d1.delta >= 0 ? '+' : ''}{Math.round(d1.delta)}
                    </span>
                  )}
                </span>
                <span className="font-mono font-semibold shrink-0">{m.sets_won_player1}–{m.sets_won_player2}</span>
                <span className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  {d2 && (
                    <span className={`text-xs ${d2.delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {d2.delta >= 0 ? '+' : ''}{Math.round(d2.delta)}
                    </span>
                  )}
                  <span className={`truncate ${m.winner_id === m.player2_id ? 'font-bold' : ''}`}>{m.player2.name}</span>
                  <PlayerAvatar name={m.player2.name} avatarUrl={m.player2.avatar_url} size="sm" />
                </span>
              </button>
            )
          })}
        </div>
      )}

      {!loading && total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}

      <MatchDetailModal matchId={selectedMatchId} onClose={() => setSelectedMatchId(null)} />
    </div>
  )
}
