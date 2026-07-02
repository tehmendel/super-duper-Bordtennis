import { useEffect, useState } from 'react'
import { Zap, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { suggestedHandicap } from '@/lib/handicap'
import { eloWinProbability } from '@/lib/stats'
import type { Match, Player } from '@/lib/types'

export function HeadToHead() {
  const { player } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [aId, setAId] = useState('')
  const [bId, setBId] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('players').select('*').order('name').then(({ data }) => {
      setPlayers(data ?? [])
      if (player) setAId(player.id)
    })
  }, [player])

  useEffect(() => {
    if (!aId || !bId || aId === bId) {
      setMatches([])
      return
    }
    setLoading(true)
    supabase
      .from('matches')
      .select('*')
      .eq('status', 'confirmed')
      .or(`and(player1_id.eq.${aId},player2_id.eq.${bId}),and(player1_id.eq.${bId},player2_id.eq.${aId})`)
      .order('confirmed_at', { ascending: false })
      .returns<Match[]>()
      .then(({ data }) => {
        setMatches(data ?? [])
        setLoading(false)
      })
  }, [aId, bId])

  const a = players.find((p) => p.id === aId)
  const b = players.find((p) => p.id === bId)
  const aWins = matches.filter((m) => m.winner_id === aId).length
  const bWins = matches.filter((m) => m.winner_id === bId).length
  const aSets = matches.reduce((sum, m) => sum + (m.player1_id === aId ? (m.sets_won_player1 ?? 0) : (m.sets_won_player2 ?? 0)), 0)
  const bSets = matches.reduce((sum, m) => sum + (m.player1_id === bId ? (m.sets_won_player1 ?? 0) : (m.sets_won_player2 ?? 0)), 0)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Head-to-head</h1>

      <div className="flex items-center gap-3">
        <select value={aId} onChange={(e) => setAId(e.target.value)} className="input">
          <option value="">Velg spiller A...</option>
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="text-slate-400 font-bold">vs</span>
        <select value={bId} onChange={(e) => setBId(e.target.value)} className="input">
          <option value="">Velg spiller B...</option>
          {players.filter((p) => p.id !== aId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading && <p className="text-slate-500">Laster...</p>}

      {a && b && !loading && (
        <>
          <div className="card p-6 flex items-center justify-around text-center">
            <div className="flex flex-col items-center gap-2">
              <PlayerAvatar name={a.name} avatarUrl={a.avatar_url} size="lg" />
              <p className="font-semibold">{a.name}</p>
              <p className="text-3xl font-bold text-brand-600">{aWins}</p>
              <p className="text-xs text-slate-500">{aSets} sett</p>
            </div>
            <p className="text-slate-400 font-bold">–</p>
            <div className="flex flex-col items-center gap-2">
              <PlayerAvatar name={b.name} avatarUrl={b.avatar_url} size="lg" />
              <p className="font-semibold">{b.name}</p>
              <p className="text-3xl font-bold text-brand-600">{bWins}</p>
              <p className="text-xs text-slate-500">{bSets} sett</p>
            </div>
          </div>

          {matches.length > 0 && (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              {aWins === bWins
                ? 'Helt jevnt løp mellom dem 🤝'
                : `${aWins > bWins ? a.name : b.name} dominerer oppgjøret ${Math.max(aWins, bWins)}–${Math.min(aWins, bWins)} 🔥`}
            </p>
          )}

          <div className="card p-5 flex flex-col items-center gap-3">
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Sparkles size={16} className="text-violet-500" /> Hva om de møttes i dag?
            </p>
            <div className="flex items-center justify-around w-full">
              <div className="flex flex-col items-center gap-1">
                <span className="font-medium text-sm">{a.name}</span>
                <span className="text-2xl font-bold text-brand-600">{Math.round(eloWinProbability(a.rating, b.rating) * 100)}%</span>
              </div>
              <span className="text-slate-400 font-bold">vs</span>
              <div className="flex flex-col items-center gap-1">
                <span className="font-medium text-sm">{b.name}</span>
                <span className="text-2xl font-bold text-brand-600">{Math.round((1 - eloWinProbability(a.rating, b.rating)) * 100)}%</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Basert på Elo-rating ({Math.round(a.rating)} mot {Math.round(b.rating)})
            </p>
          </div>

          {a.rating !== b.rating && (
            <div className="card p-4 flex items-center gap-3">
              <Zap size={20} className="text-amber-500 shrink-0" />
              <p className="text-sm">
                Håndikapp-forslag for en jevnere uformell kamp: <strong>{a.rating > b.rating ? b.name : a.name}</strong> starter med{' '}
                <strong>{suggestedHandicap(a.rating, b.rating)} poeng</strong> forsprang i et vanlig 11-poengs sett
                <span className="text-slate-400"> (basert på ratingforskjell på {Math.round(Math.abs(a.rating - b.rating))})</span>.
              </p>
            </div>
          )}

          {matches.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400">Ingen kamper spilt mot hverandre ennå.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {matches.map((m) => {
                const aIsP1 = m.player1_id === aId
                return (
                  <div key={m.id} className="card p-3 flex items-center justify-between text-sm">
                    <span className={m.winner_id === aId ? 'font-bold text-emerald-500' : 'text-slate-500'}>{a.name}</span>
                    <span className="font-mono">{aIsP1 ? m.sets_won_player1 : m.sets_won_player2}–{aIsP1 ? m.sets_won_player2 : m.sets_won_player1}</span>
                    <span className={m.winner_id === bId ? 'font-bold text-emerald-500' : 'text-slate-500'}>{b.name}</span>
                    <span className="text-xs text-slate-400">{new Date(m.confirmed_at ?? m.created_at).toLocaleDateString('no-NO')}</span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
