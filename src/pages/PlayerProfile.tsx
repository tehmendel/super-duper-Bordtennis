import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Pencil, Skull } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { FormPills } from '@/components/FormPills'
import { AchievementBadge } from '@/components/AchievementBadge'
import { MatchDetailModal } from '@/components/MatchDetailModal'
import {
  averageSetMargin,
  clutchRate,
  comebackRate,
  countUpsets,
  deuceRate,
  findNemesis,
  peakRating,
  ratingMomentum,
  ratingVolatility,
  winRateByWeekday,
  type MatchWithSets,
} from '@/lib/stats'
import type { AchievementDefinition, LeaderboardRow, Match, MatchSet, Player, PlayerAchievement, RatingHistoryEntry } from '@/lib/types'

const WEEKDAY_NAMES = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør']

export function PlayerProfile() {
  const { id } = useParams<{ id: string }>()
  const { player: currentPlayer } = useAuth()
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [rank, setRank] = useState<number | null>(null)
  const [total, setTotal] = useState(0)
  const [history, setHistory] = useState<RatingHistoryEntry[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [matchSets, setMatchSets] = useState<MatchSet[]>([])
  const [allHistory, setAllHistory] = useState<RatingHistoryEntry[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [earned, setEarned] = useState<PlayerAchievement[]>([])
  const [definitions, setDefinitions] = useState<AchievementDefinition[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const [{ data: p }, { data: board }, { data: hist }, { data: m }, { data: pa }, { data: defs }, { data: allP }] = await Promise.all([
        supabase.from('players').select('*').eq('id', id).single(),
        supabase.from('leaderboard').select('*').order('rating', { ascending: false }).returns<LeaderboardRow[]>(),
        supabase.from('ratings_history').select('*').eq('player_id', id).order('created_at').returns<RatingHistoryEntry[]>(),
        supabase
          .from('matches')
          .select('*')
          .eq('status', 'confirmed')
          .or(`player1_id.eq.${id},player2_id.eq.${id}`)
          .order('confirmed_at', { ascending: false })
          .returns<Match[]>(),
        supabase.from('player_achievements').select('*').eq('player_id', id).returns<PlayerAchievement[]>(),
        supabase.from('achievement_definitions').select('*').returns<AchievementDefinition[]>(),
        supabase.from('players').select('*').returns<Player[]>(),
      ])

      if (cancelled) return
      setPlayer(p ?? null)
      if (board) {
        const idx = board.findIndex((r) => r.id === id)
        setRank(idx >= 0 ? idx + 1 : null)
        setTotal(board.length)
      }
      setHistory(hist ?? [])
      setMatches(m ?? [])
      setEarned(pa ?? [])
      setDefinitions(defs ?? [])
      setPlayers(allP ?? [])

      const matchIds = (m ?? []).map((match) => match.id)
      if (matchIds.length > 0) {
        const [{ data: sets }, { data: hAll }] = await Promise.all([
          supabase.from('match_sets').select('*').in('match_id', matchIds).returns<MatchSet[]>(),
          supabase.from('ratings_history').select('*').in('match_id', matchIds).returns<RatingHistoryEntry[]>(),
        ])
        if (!cancelled) {
          setMatchSets(sets ?? [])
          setAllHistory(hAll ?? [])
        }
      }

      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (loading) return <p className="text-slate-500">Laster...</p>
  if (!player) return <p className="text-slate-500">Fant ikke spilleren.</p>

  const wins = matches.filter((m) => m.winner_id === id).length
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0

  let streak = 0
  let streakType: 'W' | 'L' | null = null
  for (const m of matches) {
    const result: 'W' | 'L' = m.winner_id === id ? 'W' : 'L'
    if (streakType === null) { streakType = result; streak = 1 }
    else if (result === streakType) streak++
    else break
  }

  const form = matches.slice(0, 5).map((m) => (m.winner_id === id ? 'W' : 'L') as 'W' | 'L')
  const chartData = history.map((h) => ({
    date: new Date(h.created_at).toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' }),
    rating: Math.round(h.rating_after),
  }))

  const matchesWithSets: MatchWithSets[] = matches.map((match) => ({
    match,
    sets: matchSets.filter((s) => s.match_id === match.id),
  }))
  const historyByMatch: Record<string, RatingHistoryEntry[]> = {}
  allHistory.forEach((h) => {
    historyByMatch[h.match_id] = [...(historyByMatch[h.match_id] ?? []), h]
  })

  const peak = peakRating(history)
  const volatility = ratingVolatility(history)
  const momentum = ratingMomentum(history)
  const upsets = countUpsets(id!, matches, historyByMatch)
  const avgMargin = averageSetMargin(id!, matchesWithSets)
  const deuce = deuceRate(matchesWithSets)
  const comeback = comebackRate(id!, matchesWithSets)
  const clutch = clutchRate(id!, matchesWithSets)
  const nemesis = findNemesis(id!, matches)
  const nemesisPlayer = nemesis ? players.find((p) => p.id === nemesis.playerId) : null
  const weekdayForm = winRateByWeekday(id!, matches)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} size="lg" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{player.name}</h1>
          <p className="text-slate-500 dark:text-slate-400">{rank ? `Plass #${rank} av ${total}` : 'Ingen rangering ennå'}</p>
        </div>
        {currentPlayer?.id === player.id && (
          <Link to="/profile/edit" className="btn-secondary py-2 px-3 text-sm">
            <Pencil size={16} /> Rediger
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-xs text-slate-500">Rating</p><p className="text-xl font-bold">{Math.round(player.rating)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Kamper</p><p className="text-xl font-bold">{matches.length}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Seiersprosent</p><p className="text-xl font-bold">{winRate}%</p></div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Rekke</p>
          <p className={`text-xl font-bold ${streakType === 'W' ? 'text-emerald-500' : streakType === 'L' ? 'text-rose-500' : ''}`}>
            {streak > 0 ? `${streak}${streakType}` : '–'}
          </p>
        </div>
      </div>

      <div className="card p-4">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">Siste kamper</p>
        <FormPills results={form} />
      </div>

      {chartData.length > 1 && (
        <div className="card p-4">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">Rating over tid</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={['dataMin - 20', 'dataMax + 20']} tick={{ fontSize: 11 }} width={40} />
              <Tooltip />
              <Line type="monotone" dataKey="rating" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Avansert statistikk</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-xs text-slate-500">Peak rating</p>
            <p className="text-xl font-bold">{peak ? Math.round(peak.rating) : '–'}</p>
            {peak && <p className="text-[11px] text-slate-400">{new Date(peak.date).toLocaleDateString('no-NO')}</p>}
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500">Rating-volatilitet</p>
            <p className="text-xl font-bold">{Math.round(volatility)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500">Momentum (5)</p>
            <p className={`text-xl font-bold ${momentum >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {momentum >= 0 ? '+' : ''}{Math.round(momentum)}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500">Upsets vunnet</p>
            <p className="text-xl font-bold">{upsets}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500">Snitt poengmargin</p>
            <p className="text-xl font-bold">{avgMargin !== null ? avgMargin.toFixed(1) : '–'}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500">Deuce-rate</p>
            <p className="text-xl font-bold">{deuce !== null ? `${Math.round(deuce * 100)}%` : '–'}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500">Comeback-rate</p>
            <p className="text-xl font-bold">{comeback !== null ? `${Math.round(comeback * 100)}%` : '–'}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500">Clutch-rate</p>
            <p className="text-xl font-bold">{clutch !== null ? `${Math.round(clutch * 100)}%` : '–'}</p>
          </div>
        </div>
      </div>

      {nemesis && nemesisPlayer && (
        <div className="card p-5 flex items-center gap-3">
          <Skull size={24} className="text-rose-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Nemesis</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <Link to={`/players/${nemesisPlayer.id}`} className="font-semibold text-rose-500 hover:underline">
                {nemesisPlayer.name}
              </Link>{' '}
              dominerer med {nemesis.wins}–{nemesis.losses} ({Math.round((1 - nemesis.winRate) * 100)}% seiere mot deg)
            </p>
          </div>
        </div>
      )}

      <div className="card p-4">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Form per ukedag</p>
        <div className="flex justify-between gap-1">
          {weekdayForm.map((d, i) => {
            const pct = d.total > 0 ? Math.round((d.wins / d.total) * 100) : null
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full h-16 flex items-end bg-slate-100 dark:bg-slate-800 rounded">
                  {pct !== null && (
                    <div
                      className="w-full bg-brand-600 rounded"
                      style={{ height: `${pct}%` }}
                      title={`${pct}% (${d.wins}/${d.total})`}
                    />
                  )}
                </div>
                <span className="text-[10px] text-slate-400">{WEEKDAY_NAMES[i]}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Prestasjoner</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {definitions.map((d) => {
            const e = earned.find((pa) => pa.achievement_id === d.id)
            return <AchievementBadge key={d.id} achievement={d} earned={!!e} earnedAt={e?.earned_at} />
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Kamphistorikk</p>
        <div className="flex flex-col gap-2">
          {matches.slice(0, 15).map((m) => {
            const won = m.winner_id === id
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMatchId(m.id)}
                className="card p-3 flex items-center justify-between text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <span className={won ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>{won ? 'Seier' : 'Tap'}</span>
                <span className="font-mono">{m.sets_won_player1}–{m.sets_won_player2}</span>
                <span className="text-slate-400 text-xs">{new Date(m.confirmed_at ?? m.created_at).toLocaleDateString('no-NO')}</span>
              </button>
            )
          })}
        </div>
      </div>

      <MatchDetailModal matchId={selectedMatchId} onClose={() => setSelectedMatchId(null)} />
    </div>
  )
}
