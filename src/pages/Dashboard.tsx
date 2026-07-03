import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, CheckCircle2, TrendingUp, TrendingDown, Hourglass, Target, Clock3, Shuffle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { FormPills } from '@/components/FormPills'
import { HiddenAchievementFeed } from '@/components/HiddenAchievementFeed'
import { ChallengeFeed } from '@/components/ChallengeFeed'
import { PlayerOfTheWeek } from '@/components/PlayerOfTheWeek'
import { CardHeader } from '@/components/CardHeader'
import { useCardLayout, type CardDef } from '@/hooks/useCardLayout'
import type { LeaderboardRow, Match, Player, Season } from '@/lib/types'

interface MatchOfWeek {
  match: Match
  player1: Player
  player2: Player
  delta: number
}

const MILESTONES = [10, 25, 50, 100, 250, 500]

const CARD_DEFS: CardDef[] = [
  { id: 'season_countdown', title: 'Sesong-nedtelling' },
  { id: 'milestone', title: 'Milepæl' },
  { id: 'inactivity', title: 'Ikke spilt på en stund' },
  { id: 'past_match', title: 'Kamp fra fortiden' },
  { id: 'match_of_week', title: '🌟 Ukens kamp' },
]

export function Dashboard() {
  const { player } = useAuth()
  const layout = useCardLayout('dashboard', CARD_DEFS)
  const [rank, setRank] = useState<number | null>(null)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [form, setForm] = useState<('W' | 'L')[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [matchOfWeek, setMatchOfWeek] = useState<MatchOfWeek | null>(null)
  const [loading, setLoading] = useState(true)
  const [season, setSeason] = useState<Season | null>(null)
  const [pointsBehindLeader, setPointsBehindLeader] = useState<{ name: string; points: number } | null>(null)
  const [totalMatchesPlayed, setTotalMatchesPlayed] = useState(0)
  const [daysSinceLastMatch, setDaysSinceLastMatch] = useState<number | null>(null)
  const [ownMatches, setOwnMatches] = useState<(Match & { opponent: Player })[]>([])
  const [pastMatchIndex, setPastMatchIndex] = useState(0)

  const load = useCallback(async () => {
    if (!player) return
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [
      { data: board },
      { data: seasonData },
      { data: recent },
      { count: totalCount },
      { data: allOwn },
      { count },
      { data: history },
    ] = await Promise.all([
      supabase.from('leaderboard').select('*').order('rating', { ascending: false }).returns<LeaderboardRow[]>(),
      supabase.from('seasons').select('*').eq('is_active', true).maybeSingle(),
      supabase
        .from('matches')
        .select('*')
        .eq('status', 'confirmed')
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
        .order('confirmed_at', { ascending: false })
        .limit(5)
        .returns<Match[]>(),
      supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`),
      supabase
        .from('matches')
        .select('*, p1:players!matches_player1_id_fkey(*), p2:players!matches_player2_id_fkey(*)')
        .eq('status', 'confirmed')
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`),
      supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`)
        .neq('submitted_by', player.id),
      supabase.from('ratings_history').select('*, match:matches(*)').gte('created_at', weekAgo),
    ])

    if (board) {
      const idx = board.findIndex((r) => r.id === player.id)
      setRank(idx >= 0 ? idx + 1 : null)
      setTotalPlayers(board.length)
      if (idx > 0) {
        setPointsBehindLeader({ name: board[0].name, points: Math.round(board[0].rating - board[idx].rating) })
      } else {
        setPointsBehindLeader(null)
      }
    }

    setSeason(seasonData ?? null)

    if (recent) {
      setForm(recent.map((m) => (m.winner_id === player.id ? 'W' : 'L')))
      if (recent.length > 0) {
        const lastDate = new Date(recent[0].confirmed_at ?? recent[0].created_at)
        setDaysSinceLastMatch(Math.floor((Date.now() - lastDate.getTime()) / (24 * 60 * 60 * 1000)))
      }
    }

    setTotalMatchesPlayed(totalCount ?? 0)

    if (allOwn) {
      const withOpponent = allOwn.map((m) => ({
        ...m,
        opponent: m.player1_id === player.id ? m.p2 : m.p1,
      }))
      setOwnMatches(withOpponent)
      setPastMatchIndex(withOpponent.length > 0 ? Math.floor(Math.random() * withOpponent.length) : 0)
    }

    setPendingCount(count ?? 0)

    if (history && history.length > 0) {
      const top = [...history].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]
      const match = top.match as Match
      const { data: matchPlayers } = await supabase
        .from('players')
        .select('*')
        .in('id', [match.player1_id, match.player2_id])
      const p1 = matchPlayers?.find((p) => p.id === match.player1_id)
      const p2 = matchPlayers?.find((p) => p.id === match.player2_id)
      if (p1 && p2) {
        setMatchOfWeek({ match, player1: p1, player2: p2, delta: top.delta })
      }
    } else {
      setMatchOfWeek(null)
    }

    setLoading(false)
  }, [player])

  useEffect(() => {
    load()
  }, [load])

  // Refetch whenever the tab regains focus/visibility — e.g. after
  // confirming a match on another device, or after the tab sat in the
  // background for a while — instead of only ever fetching once on mount.
  useEffect(() => {
    function onFocus() {
      load()
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') load()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [load])

  // Also refetch live via Realtime — the focus/visibility listeners above
  // don't fire when someone else confirms a match while this tab stays
  // open and focused the whole time.
  useEffect(() => {
    if (!player) return
    const channel = supabase
      .channel(`dashboard-matches-${player.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `player1_id=eq.${player.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `player2_id=eq.${player.id}` }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [player, load])

  if (!player) return null

  function renderCard(id: string) {
    switch (id) {
      case 'season_countdown':
        if (!season?.target_end_date) return null
        return (
          <div key={id} className="card p-5">
            <CardHeader layout={layout} cardId={id} className="hidden" />
            <div className="flex items-center gap-3">
              <Hourglass size={22} className="text-violet-500 shrink-0" />
              <p className="text-sm">
                <strong>{Math.max(0, Math.ceil((new Date(season.target_end_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))} dager</strong> igjen av {season.name}
                {pointsBehindLeader && (
                  <> — du er <strong>{pointsBehindLeader.points} poeng</strong> bak {pointsBehindLeader.name} på 1. plass!</>
                )}
              </p>
            </div>
          </div>
        )
      case 'milestone': {
        const nextMilestone = MILESTONES.find((m) => m - totalMatchesPlayed >= 1 && m - totalMatchesPlayed <= 2)
        if (!nextMilestone) return null
        const remaining = nextMilestone - totalMatchesPlayed
        return (
          <div key={id} className="card p-5">
            <CardHeader layout={layout} cardId={id} className="hidden" />
            <div className="flex items-center gap-3">
              <Target size={22} className="text-brand-600 shrink-0" />
              <p className="text-sm">
                Du er <strong>{remaining} kamp{remaining > 1 ? 'er' : ''}</strong> unna <strong>{nextMilestone} totalt</strong>! 🎯
              </p>
            </div>
          </div>
        )
      }
      case 'inactivity':
        if (daysSinceLastMatch === null || daysSinceLastMatch < 14) return null
        return (
          <div key={id} className="card p-5">
            <CardHeader layout={layout} cardId={id} className="hidden" />
            <div className="flex items-center gap-3">
              <Clock3 size={22} className="text-amber-500 shrink-0" />
              <p className="text-sm">
                Det er <strong>{daysSinceLastMatch} dager</strong> siden sist du spilte en kamp. På tide med en runde? 🏓
              </p>
            </div>
          </div>
        )
      case 'past_match': {
        if (ownMatches.length === 0 || !ownMatches[pastMatchIndex]) return null
        const m = ownMatches[pastMatchIndex]
        const won = m.winner_id === player!.id
        const isP1 = m.player1_id === player!.id
        const myScore = isP1 ? m.sets_won_player1 : m.sets_won_player2
        const oppScore = isP1 ? m.sets_won_player2 : m.sets_won_player1
        return (
          <div key={id} className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <CardHeader layout={layout} cardId={id} className="text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2" />
              {!layout.editMode && (
                <button
                  onClick={() => setPastMatchIndex(Math.floor(Math.random() * ownMatches.length))}
                  className="btn-ghost p-1.5"
                  title="Vis en annen"
                >
                  <Shuffle size={14} />
                </button>
              )}
            </div>
            <p className="text-sm">
              Den {new Date(m.confirmed_at ?? m.created_at).toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' })}{' '}
              {won ? 'slo du' : 'tapte du mot'}{' '}
              <Link to={`/players/${m.opponent.id}`} className="font-semibold text-brand-600 hover:underline">
                {m.opponent.name}
              </Link>{' '}
              {myScore}–{oppScore}
            </p>
          </div>
        )
      }
      case 'match_of_week':
        if (!matchOfWeek) return null
        return (
          <div key={id} className="card p-5">
            <CardHeader layout={layout} cardId={id} />
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
        )
      default:
        return null
    }
  }

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

      <PlayerOfTheWeek />

      <ChallengeFeed />

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

      {layout.orderedIds.map((id) => renderCard(id))}

      <HiddenAchievementFeed />
    </div>
  )
}
