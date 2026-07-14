import { useCallback, useEffect, useState } from 'react'
import { Check, X, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { AchievementToast } from '@/components/AchievementToast'
import { MatchDetailModal } from '@/components/MatchDetailModal'
import { formatDate } from '@/lib/date'
import type { AchievementDefinition, Match, MatchSet, Player } from '@/lib/types'

interface EnrichedMatch extends Match {
  player1: Player
  player2: Player
}

export function PendingConfirmations() {
  const { player, hasAccess } = useAuth()
  const [awaitingMe, setAwaitingMe] = useState<EnrichedMatch[]>([])
  const [awaitingOthers, setAwaitingOthers] = useState<EnrichedMatch[]>([])
  const [recentConfirmed, setRecentConfirmed] = useState<EnrichedMatch[]>([])
  const [setsByMatch, setSetsByMatch] = useState<Record<string, MatchSet[]>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newAchievements, setNewAchievements] = useState<AchievementDefinition[]>([])
  const [viewingMatchId, setViewingMatchId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!player) return
    setLoading(true)
    const [{ data }, { data: confirmed }] = await Promise.all([
      supabase
        .from('matches')
        .select('*, player1:players!matches_player1_id_fkey(*), player2:players!matches_player2_id_fkey(*)')
        .eq('status', 'pending')
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
        .order('created_at', { ascending: false })
        .returns<EnrichedMatch[]>(),
      supabase
        .from('matches')
        .select('*, player1:players!matches_player1_id_fkey(*), player2:players!matches_player2_id_fkey(*)')
        .eq('status', 'confirmed')
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
        .order('confirmed_at', { ascending: false })
        .limit(10)
        .returns<EnrichedMatch[]>(),
    ])

    setRecentConfirmed(confirmed ?? [])

    if (data) {
      setAwaitingMe(data.filter((m) => m.submitted_by !== player.id))
      setAwaitingOthers(data.filter((m) => m.submitted_by === player.id))

      const matchIds = data.map((m) => m.id)
      if (matchIds.length > 0) {
        const { data: sets } = await supabase.from('match_sets').select('*').in('match_id', matchIds).returns<MatchSet[]>()
        const grouped: Record<string, MatchSet[]> = {}
        ;(sets ?? []).forEach((s) => {
          grouped[s.match_id] = [...(grouped[s.match_id] ?? []), s]
        })
        setSetsByMatch(grouped)
      } else {
        setSetsByMatch({})
      }
    }
    setLoading(false)
  }, [player])

  function scoreFor(m: EnrichedMatch) {
    const sets = setsByMatch[m.id] ?? []
    const setsWon1 = sets.filter((s) => s.player1_score > s.player2_score).length
    const setsWon2 = sets.filter((s) => s.player2_score > s.player1_score).length
    return { setsWon1, setsWon2 }
  }

  useEffect(() => {
    load()
  }, [load])

  async function respond(matchId: string, status: 'confirmed' | 'rejected') {
    if (!player) return
    setBusyId(matchId)
    const { error } = await supabase.from('matches').update({ status }).eq('id', matchId)
    if (!error && status === 'confirmed') {
      const { data: earned } = await supabase
        .from('player_achievements')
        .select('*, achievement:achievement_definitions(*)')
        .eq('match_id', matchId)
        .eq('player_id', player.id)
      if (earned && earned.length > 0) {
        setNewAchievements(
          earned
            .map((e) => e.achievement as AchievementDefinition | null)
            .filter((a): a is AchievementDefinition => a !== null),
        )
      }
    }
    setBusyId(null)
    await load()
  }

  if (loading) return <p className="text-slate-500">Laster...</p>

  return (
    <div className="flex flex-col gap-8">
      <AchievementToast achievements={newAchievements} onDismiss={() => setNewAchievements([])} />

      <div>
        <h1 className="text-2xl font-bold mb-4">Venter på din bekreftelse</h1>
        {awaitingMe.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">Ingen kamper å bekrefte akkurat nå.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {awaitingMe.map((m) => {
              const { setsWon1, setsWon2 } = scoreFor(m)
              return (
              <div
                key={m.id}
                onClick={() => setViewingMatchId(m.id)}
                className="card p-4 flex items-center justify-between gap-3 flex-wrap cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex items-center gap-3">
                  <PlayerAvatar name={m.player1.name} avatarUrl={m.player1.avatar_url} size="sm" />
                  <span className="font-medium">{m.player1.name}</span>
                  <span className="font-mono text-slate-500">
                    {setsWon1}–{setsWon2}
                  </span>
                  <span className="font-medium">{m.player2.name}</span>
                  <PlayerAvatar name={m.player2.name} avatarUrl={m.player2.avatar_url} size="sm" />
                  <Info size={16} className="text-slate-400" />
                </div>
                {hasAccess('pending', 'write') ? (
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      disabled={busyId === m.id}
                      onClick={() => respond(m.id, 'confirmed')}
                      className="btn-primary py-2 px-3 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Check size={16} /> Bekreft
                    </button>
                    <button
                      disabled={busyId === m.id}
                      onClick={() => respond(m.id, 'rejected')}
                      className="btn-secondary py-2 px-3 text-rose-600"
                    >
                      <X size={16} /> Avvis
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Du har kun lesetilgang</p>
                )}
              </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Venter på motstander</h2>
        {awaitingOthers.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">Ingenting her.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {awaitingOthers.map((m) => {
              const { setsWon1, setsWon2 } = scoreFor(m)
              return (
              <div
                key={m.id}
                onClick={() => setViewingMatchId(m.id)}
                className="card p-3 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <span>{m.player1.name} vs {m.player2.name}</span>
                <span className="font-mono">{setsWon1}–{setsWon2}</span>
                <span className="ml-auto italic">Venter...</span>
              </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Nylig bekreftet</h2>
        {recentConfirmed.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">Ingen bekreftede kamper ennå.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentConfirmed.map((m) => {
              const isP1 = m.player1_id === player!.id
              const opponent = isP1 ? m.player2 : m.player1
              const myScore = isP1 ? m.sets_won_player1 : m.sets_won_player2
              const oppScore = isP1 ? m.sets_won_player2 : m.sets_won_player1
              const won = m.winner_id === player!.id
              return (
                <div
                  key={m.id}
                  onClick={() => setViewingMatchId(m.id)}
                  className="card p-3 flex items-center gap-3 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <PlayerAvatar name={opponent.name} avatarUrl={opponent.avatar_url} size="sm" />
                  <span className="flex-1 truncate">
                    mot <span className="font-medium">{opponent.name}</span>
                  </span>
                  <span className="font-mono text-slate-400">{myScore}–{oppScore}</span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      won
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'
                    }`}
                  >
                    {won ? 'Seier' : 'Tap'}
                  </span>
                  <span className="text-slate-400 text-xs shrink-0">
                    {formatDate(m.confirmed_at ?? m.created_at)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <MatchDetailModal matchId={viewingMatchId} onClose={() => setViewingMatchId(null)} />
    </div>
  )
}
