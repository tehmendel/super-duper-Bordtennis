import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { FormPills } from '@/components/FormPills'
import type { LeaderboardRow, Match, Player } from '@/lib/types'

interface MatchOfWeek {
  match: Match
  player1: Player
  player2: Player
  delta: number
}

export function Dashboard() {
  const { player } = useAuth()
  const [rank, setRank] = useState<number | null>(null)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [form, setForm] = useState<('W' | 'L')[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [matchOfWeek, setMatchOfWeek] = useState<MatchOfWeek | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!player) return
    let cancelled = false

    async function load() {
      const { data: board } = await supabase
        .from('leaderboard')
        .select('*')
        .order('rating', { ascending: false })
        .returns<LeaderboardRow[]>()

      if (board) {
        const idx = board.findIndex((r) => r.id === player!.id)
        if (!cancelled) {
          setRank(idx >= 0 ? idx + 1 : null)
          setTotalPlayers(board.length)
        }
      }

      const { data: recent } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'confirmed')
        .or(`player1_id.eq.${player!.id},player2_id.eq.${player!.id}`)
        .order('confirmed_at', { ascending: false })
        .limit(5)
        .returns<Match[]>()

      if (recent && !cancelled) {
        setForm(recent.map((m) => (m.winner_id === player!.id ? 'W' : 'L')))
      }

      const { count } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .or(`player1_id.eq.${player!.id},player2_id.eq.${player!.id}`)
        .neq('submitted_by', player!.id)

      if (!cancelled) setPendingCount(count ?? 0)

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: history } = await supabase
        .from('ratings_history')
        .select('*, match:matches(*)')
        .gte('created_at', weekAgo)
        .order('delta', { ascending: false })

      if (history && history.length > 0 && !cancelled) {
        const top = [...history].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]
        const match = top.match as Match
        const [{ data: p1 }, { data: p2 }] = await Promise.all([
          supabase.from('players').select('*').eq('id', match.player1_id).single(),
          supabase.from('players').select('*').eq('id', match.player2_id).single(),
        ])
        if (p1 && p2 && !cancelled) {
          setMatchOfWeek({ match, player1: p1, player2: p2, delta: top.delta })
        }
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [player])

  if (!player) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} size="lg" />
        <div>
          <h1 className="text-2xl font-bold">Hei, {player.name.split(' ')[0]}!</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {loading ? 'Laster...' : rank ? `Plass #${rank} av ${totalPlayers}` : 'Ingen rangering ennå'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Rating</p>
          <p className="text-3xl font-bold">{Math.round(player.rating)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Siste kamper</p>
          <FormPills results={form} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/matches/new" className="btn-primary py-4 text-base">
          <PlusCircle size={20} /> Registrer kamp
        </Link>
        <Link to="/matches/pending" className="btn-secondary py-4 text-base relative">
          <CheckCircle2 size={20} /> Bekreft kamper
          {pendingCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </Link>
      </div>

      {matchOfWeek && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">🌟 Ukens kamp</p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PlayerAvatar name={matchOfWeek.player1.name} avatarUrl={matchOfWeek.player1.avatar_url} size="sm" />
              <span className={matchOfWeek.match.winner_id === matchOfWeek.player1.id ? 'font-bold' : 'text-slate-500'}>
                {matchOfWeek.player1.name}
              </span>
            </div>
            <span className="text-sm font-mono text-slate-500">
              {matchOfWeek.match.sets_won_player1}–{matchOfWeek.match.sets_won_player2}
            </span>
            <div className="flex items-center gap-2">
              <span className={matchOfWeek.match.winner_id === matchOfWeek.player2.id ? 'font-bold' : 'text-slate-500'}>
                {matchOfWeek.player2.name}
              </span>
              <PlayerAvatar name={matchOfWeek.player2.name} avatarUrl={matchOfWeek.player2.avatar_url} size="sm" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            {matchOfWeek.delta > 0 ? <TrendingUp size={16} className="text-emerald-500" /> : <TrendingDown size={16} className="text-rose-500" />}
            Størst rating-endring denne uken ({matchOfWeek.delta > 0 ? '+' : ''}{Math.round(matchOfWeek.delta)})
          </div>
        </div>
      )}
    </div>
  )
}
