import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Swords, ListOrdered } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { useLadderEnabled } from '@/hooks/useLadderEnabled'
import type { LadderPosition, Player } from '@/lib/types'

interface Row extends LadderPosition {
  player: Player
}

export function Ladder() {
  const { player } = useAuth()
  const ladderEnabled = useLadderEnabled()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [challenging, setChallenging] = useState(false)
  const [challengeSent, setChallengeSent] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('ladder_positions')
      .select('*, player:players(*)')
      .order('position')
      .returns<Row[]>()
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!ladderEnabled) return <p className="text-slate-500 dark:text-slate-400">Ladder-funksjonen er slått av av admin.</p>
  if (loading) return <p className="text-slate-500">Laster...</p>

  const myRow = player ? rows.find((r) => r.player_id === player.id) : null
  const rivalAbove = myRow ? rows.find((r) => r.position === myRow.position - 1) : null

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
        <ListOrdered size={24} className="text-brand-600" />
        <h1 className="text-2xl font-bold">Ladder</h1>
      </div>

      {rows.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Ladderen er ikke satt opp ennå. Be en admin om å sette den opp under Admin → Ladder.</p>
      ) : (
        <>
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
    </div>
  )
}
