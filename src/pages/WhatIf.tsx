import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { eloWinProbability } from '@/lib/stats'
import type { Player } from '@/lib/types'

export function WhatIf() {
  const { player } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [aId, setAId] = useState('')
  const [bId, setBId] = useState('')

  useEffect(() => {
    supabase.from('players').select('*').order('name').then(({ data }) => {
      setPlayers(data ?? [])
      if (player) setAId(player.id)
    })
  }, [player])

  const a = players.find((p) => p.id === aId)
  const b = players.find((p) => p.id === bId)
  const probA = a && b ? eloWinProbability(a.rating, b.rating) : null

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <h1 className="text-2xl font-bold">Hva om?</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Velg to spillere og se hva Elo-modellen tror ville skjedd om de møttes i dag.
      </p>

      <div className="flex items-center gap-3">
        <select value={aId} onChange={(e) => setAId(e.target.value)} className="input">
          <option value="">Spiller A...</option>
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="text-slate-400 font-bold">vs</span>
        <select value={bId} onChange={(e) => setBId(e.target.value)} className="input">
          <option value="">Spiller B...</option>
          {players.filter((p) => p.id !== aId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {a && b && probA !== null && (
        <div className="card p-6 flex flex-col items-center gap-4">
          <Sparkles size={28} className="text-violet-500" />
          <div className="flex items-center justify-around w-full">
            <div className="flex flex-col items-center gap-2">
              <PlayerAvatar name={a.name} avatarUrl={a.avatar_url} size="lg" />
              <p className="font-semibold">{a.name}</p>
              <p className="text-2xl font-bold text-brand-600">{Math.round(probA * 100)}%</p>
            </div>
            <span className="text-slate-400 font-bold">vs</span>
            <div className="flex flex-col items-center gap-2">
              <PlayerAvatar name={b.name} avatarUrl={b.avatar_url} size="lg" />
              <p className="font-semibold">{b.name}</p>
              <p className="text-2xl font-bold text-brand-600">{Math.round((1 - probA) * 100)}%</p>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            {probA > 0.5
              ? `${a.name} er favoritt basert på ratingene (${Math.round(a.rating)} mot ${Math.round(b.rating)})`
              : probA < 0.5
                ? `${b.name} er favoritt basert på ratingene (${Math.round(b.rating)} mot ${Math.round(a.rating)})`
                : 'Helt jevnt basert på rating!'}
          </p>
        </div>
      )}
    </div>
  )
}
