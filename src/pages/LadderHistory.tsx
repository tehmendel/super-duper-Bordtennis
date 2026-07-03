import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Swords, Crown, TrendingUp, ListOrdered } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { useLadderEnabled } from '@/hooks/useLadderEnabled'
import type { LadderChallengeLog, LadderPosition, Player } from '@/lib/types'

interface PositionRow extends LadderPosition {
  player: Player
}

interface LogRow extends LadderChallengeLog {
  challenger: Player
  defender: Player
}

export function LadderHistory() {
  const { player } = useAuth()
  const ladderEnabled = useLadderEnabled()
  const [rows, setRows] = useState<PositionRow[]>([])
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [challenging, setChallenging] = useState(false)
  const [challengeSent, setChallengeSent] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: positions }, { data: logData }] = await Promise.all([
      supabase.from('ladder_positions').select('*, player:players(*)').order('position').returns<PositionRow[]>(),
      supabase
        .from('ladder_challenge_log')
        .select('*, challenger:players!ladder_challenge_log_challenger_id_fkey(*), defender:players!ladder_challenge_log_defender_id_fkey(*)')
        .order('created_at', { ascending: false })
        .limit(100)
        .returns<LogRow[]>(),
    ])
    setRows(positions ?? [])
    setLogs(logData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!ladderEnabled) {
    return <p className="text-slate-500 dark:text-slate-400">Ladder-funksjonen er slått av av admin.</p>
  }
  if (loading) return <p className="text-slate-500">Laster...</p>

  const myRow = player ? rows.find((r) => r.player_id === player.id) : null
  const rivalAbove = myRow ? rows.find((r) => r.position === myRow.position - 1) : null

  const successfulSteals = logs.filter((l) => l.swapped).length
  const challengerCounts = new Map<string, { player: Player; count: number }>()
  logs.forEach((l) => {
    const entry = challengerCounts.get(l.challenger_id) ?? { player: l.challenger, count: 0 }
    entry.count++
    challengerCounts.set(l.challenger_id, entry)
  })
  const mostActiveChallenger = [...challengerCounts.values()].sort((a, b) => b.count - a.count)[0]

  async function handleChallenge() {
    if (!player || !rivalAbove) return
    setChallenging(true)
    await supabase.from('challenges').insert({ challenger_id: player.id, challenged_id: rivalAbove.player_id })
    setChallenging(false)
    setChallengeSent(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Swords size={24} className="text-brand-600" />
        <h1 className="text-2xl font-bold">Stigespillet</h1>
      </div>

      {rows.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Ladderen er ikke satt opp ennå. Be en admin om å sette den opp under Admin → Ladder.</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <ListOrdered size={18} className="text-slate-400" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Nåværende stige</p>
          </div>

          {rivalAbove && (
            <div className="card p-5 flex items-center gap-3">
              <Swords size={22} className="text-rose-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm">
                  Du kan utfordre <strong>{rivalAbove.player.name}</strong> (plass {rivalAbove.position}) for å ta plassen deres!
                </p>
                {challengeSent && <p className="text-xs text-emerald-600 mt-1">Utfordring sendt! 🎉</p>}
              </div>
              <button onClick={handleChallenge} disabled={challenging} className="btn-primary text-sm py-2 px-3 shrink-0">
                {challenging ? 'Sender...' : 'Utfordre'}
              </button>
            </div>
          )}

          <div className="card divide-y divide-slate-200 dark:divide-slate-800">
            {rows.map((r) => (
              <Link
                key={r.player_id}
                to={`/players/${r.player_id}`}
                className={`flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                  player?.id === r.player_id ? 'bg-brand-50 dark:bg-brand-900/10' : ''
                }`}
              >
                <span className="w-8 text-center font-bold text-slate-500">#{r.position}</span>
                <PlayerAvatar name={r.player.name} avatarUrl={r.player.avatar_url} size="sm" />
                <span className="flex-1 font-medium truncate">{r.player.name}</span>
                <span className="text-sm text-slate-400">{Math.round(r.player.rating)}</span>
              </Link>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Slår du personen rett over deg, bytter dere plass automatisk når kampen bekreftes.
          </p>
        </>
      )}

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
