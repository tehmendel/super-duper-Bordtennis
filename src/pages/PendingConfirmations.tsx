import { useCallback, useEffect, useState } from 'react'
import { Check, X, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { AchievementToast } from '@/components/AchievementToast'
import { MatchDetailModal } from '@/components/MatchDetailModal'
import type { AchievementDefinition, Match, Player } from '@/lib/types'

interface EnrichedMatch extends Match {
  player1: Player
  player2: Player
}

export function PendingConfirmations() {
  const { player, hasAccess } = useAuth()
  const [awaitingMe, setAwaitingMe] = useState<EnrichedMatch[]>([])
  const [awaitingOthers, setAwaitingOthers] = useState<EnrichedMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newAchievements, setNewAchievements] = useState<AchievementDefinition[]>([])
  const [viewingMatchId, setViewingMatchId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!player) return
    setLoading(true)
    const { data } = await supabase
      .from('matches')
      .select('*, player1:players!matches_player1_id_fkey(*), player2:players!matches_player2_id_fkey(*)')
      .eq('status', 'pending')
      .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
      .order('created_at', { ascending: false })
      .returns<EnrichedMatch[]>()

    if (data) {
      setAwaitingMe(data.filter((m) => m.submitted_by !== player.id))
      setAwaitingOthers(data.filter((m) => m.submitted_by === player.id))
    }
    setLoading(false)
  }, [player])

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
            {awaitingMe.map((m) => (
              <div
                key={m.id}
                onClick={() => setViewingMatchId(m.id)}
                className="card p-4 flex items-center justify-between gap-3 flex-wrap cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex items-center gap-3">
                  <PlayerAvatar name={m.player1.name} avatarUrl={m.player1.avatar_url} size="sm" />
                  <span className="font-medium">{m.player1.name}</span>
                  <span className="font-mono text-slate-500">
                    {m.sets_won_player1 ?? '?'}–{m.sets_won_player2 ?? '?'}
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
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Venter på motstander</h2>
        {awaitingOthers.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">Ingenting her.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {awaitingOthers.map((m) => (
              <div
                key={m.id}
                onClick={() => setViewingMatchId(m.id)}
                className="card p-3 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <span>{m.player1.name} vs {m.player2.name}</span>
                <span className="font-mono">{m.sets_won_player1 ?? '?'}–{m.sets_won_player2 ?? '?'}</span>
                <span className="ml-auto italic">Venter...</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <MatchDetailModal matchId={viewingMatchId} onClose={() => setViewingMatchId(null)} />
    </div>
  )
}
