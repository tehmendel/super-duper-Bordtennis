import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Swords, Crown, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { useLadderEnabled } from '@/hooks/useLadderEnabled'
import type { LadderChallengeLog, Player } from '@/lib/types'

interface LogRow extends LadderChallengeLog {
  challenger: Player
  defender: Player
}

export function LadderHistory() {
  const ladderEnabled = useLadderEnabled()
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('ladder_challenge_log')
      .select('*, challenger:players!ladder_challenge_log_challenger_id_fkey(*), defender:players!ladder_challenge_log_defender_id_fkey(*)')
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<LogRow[]>()
      .then(({ data }) => {
        setLogs(data ?? [])
        setLoading(false)
      })
  }, [])

  if (!ladderEnabled) {
    return <p className="text-slate-500 dark:text-slate-400">Ladder-funksjonen er slått av av admin.</p>
  }

  if (loading) return <p className="text-slate-500">Laster...</p>

  const successfulSteals = logs.filter((l) => l.swapped).length
  const challengerCounts = new Map<string, { player: Player; count: number }>()
  logs.forEach((l) => {
    const entry = challengerCounts.get(l.challenger_id) ?? { player: l.challenger, count: 0 }
    entry.count++
    challengerCounts.set(l.challenger_id, entry)
  })
  const mostActiveChallenger = [...challengerCounts.values()].sort((a, b) => b.count - a.count)[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Swords size={24} className="text-brand-600" />
        <h1 className="text-2xl font-bold">Stigespillet</h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-xs text-slate-500">Utfordringer spilt</p>
          <p className="text-xl font-bold">{logs.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Vellykkede kupp</p>
          <p className="text-xl font-bold">{successfulSteals}</p>
        </div>
      </div>

      {mostActiveChallenger && (
        <div className="card p-5 flex items-center gap-3">
          <TrendingUp size={22} className="text-emerald-500 shrink-0" />
          <p className="text-sm">
            Mest aktive utfordrer:{' '}
            <Link to={`/players/${mostActiveChallenger.player.id}`} className="font-semibold text-brand-600 hover:underline">
              {mostActiveChallenger.player.name}
            </Link>{' '}
            ({mostActiveChallenger.count} utfordringer)
          </p>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Historikk</p>
        {logs.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-sm">Ingen ladder-utfordringer registrert ennå.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {logs.map((l) => (
              <div key={l.id} className="card p-3 flex items-center gap-3 text-sm">
                {l.swapped ? <Crown size={18} className="text-amber-500 shrink-0" /> : <Swords size={18} className="text-slate-400 shrink-0" />}
                <PlayerAvatar name={l.challenger.name} avatarUrl={l.challenger.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="truncate">
                    <span className="font-semibold">{l.challenger.name}</span> (#{l.challenger_position_before}) utfordret{' '}
                    <span className="font-semibold">{l.defender.name}</span> (#{l.defender_position_before})
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {l.swapped
                      ? `${l.challenger.name} tok plassen! 🎉`
                      : `${l.defender.name} forsvarte plassen sin`}
                    {' · '}
                    {new Date(l.created_at).toLocaleDateString('no-NO')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
