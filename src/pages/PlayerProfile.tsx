import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Pencil, Skull, Trophy, Swords, Sun, Moon, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/hooks/useTheme'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { FormPills } from '@/components/FormPills'
import { AchievementBadge } from '@/components/AchievementBadge'
import { MatchDetailModal } from '@/components/MatchDetailModal'
import { PlayerTradingCard } from '@/components/PlayerTradingCard'
import { StatsExplainerModal } from '@/components/StatsExplainerModal'
import { SharedDeviceAdminPanel } from '@/components/SharedDeviceAdminPanel'
import { Pagination } from '@/components/Pagination'
import { usePageSize } from '@/hooks/usePageSize'
import {
  averageSetMargin,
  clutchRate,
  comebackRate,
  countUpsets,
  deriveTitle,
  deuceRate,
  findNemesis,
  peakRating,
  ratingMomentum,
  ratingVolatility,
  signatureWin,
  winRateByWeekday,
  type MatchWithSets,
} from '@/lib/stats'
import type { AchievementDefinition, LeaderboardRow, Match, MatchSet, Player, PlayerAchievement, RatingHistoryEntry } from '@/lib/types'
import { WEEKDAY_NAMES } from '@/lib/constants'
import { formatDate } from '@/lib/date'

export function PlayerProfile() {
  const { id } = useParams<{ id: string }>()
  const { player: currentPlayer } = useAuth()
  const { theme, toggle: toggleTheme } = useTheme()
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [showStatsExplainer, setShowStatsExplainer] = useState(false)
  const [historyPage, setHistoryPage] = useState(0)
  const [historyPageSize, setHistoryPageSize] = usePageSize('playerProfileMatches', 50)
  const [challenging, setChallenging] = useState(false)
  const [challengeSent, setChallengeSent] = useState(false)
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
  const [allAchievementsEarned, setAllAchievementsEarned] = useState<Pick<PlayerAchievement, 'player_id' | 'achievement_id'>[]>([])
  const [achievementsTotal, setAchievementsTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const [{ data: p }, { data: board }, { data: hist }, { data: m }, { data: pa }, { data: defs }, { data: allP }, { data: allPa }, { data: achTotal }] = await Promise.all([
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
        supabase.from('player_achievements').select('player_id, achievement_id').returns<Pick<PlayerAchievement, 'player_id' | 'achievement_id'>[]>(),
        // achievement_definitions RLS hides secret ones a non-admin hasn't
        // earned yet, which would otherwise shrink the "X/Y" total shown on
        // the card — this RPC bypasses that just for the count, so Y is
        // always the true grand total.
        supabase.rpc('achievement_definitions_total'),
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
      setAllAchievementsEarned(allPa ?? [])
      setAchievementsTotal(achTotal ?? defs?.length ?? 0)

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

  useEffect(() => {
    setHistoryPage(0)
  }, [id, historyPageSize])

  useEffect(() => {
    if (!id || !currentPlayer || currentPlayer.id === id) return
    let cancelled = false
    supabase
      .from('challenges')
      .select('id')
      .eq('challenger_id', currentPlayer.id)
      .eq('challenged_id', id)
      .eq('status', 'pending')
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setChallengeSent(!!data)
      })
    return () => { cancelled = true }
  }, [id, currentPlayer])

  async function reloadPlayer() {
    if (!id) return
    const { data } = await supabase.from('players').select('*').eq('id', id).single()
    setPlayer(data ?? null)
  }

  if (loading) return <p className="text-slate-500">Laster...</p>
  if (!player) return <p className="text-slate-500">Fant ikke spilleren.</p>

  if (player.is_shared_device) {
    // Shared devices have no personal stats — non-admins see it as if it
    // doesn't exist, admins get an account-management view instead of the
    // normal (meaningless, all-zero) stats layout.
    if (!currentPlayer?.is_admin) return <p className="text-slate-500">Fant ikke spilleren.</p>
    return <SharedDeviceAdminPanel player={player} onUpdated={reloadPlayer} />
  }

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
  const signature = signatureWin(id!, matches, historyByMatch)
  const signatureOpponent = signature
    ? players.find((p) => p.id === (signature.match.winner_id === signature.match.player1_id ? signature.match.player2_id : signature.match.player1_id))
    : null

  const hasLegendarySlayer = earned.some((e) => e.achievement_id === 'legendary_slayer')
  const hasGiantSlayer = earned.some((e) => e.achievement_id === 'giant_slayer')

  const title = deriveTitle({
    clutch: clutch.rate,
    clutchSamples: clutch.samples,
    comeback: comeback.rate,
    comebackSamples: comeback.samples,
    deuce,
    hasLegendarySlayer,
    hasGiantSlayer,
    volatility,
    matchesPlayed: matches.length,
  })

  // Mirrors deriveTitle()'s conditions and priority order exactly, so the
  // explainer modal can show precisely why a given title is or isn't
  // showing — including "close but not quite" cases like a 24% deuce-rate
  // against a 30% requirement, which otherwise just looks like nothing
  // happened.
  const titleConditions = [
    {
      emoji: '🧊',
      label: 'Mr. Clutch',
      requirement: 'Clutch-rate ≥ 70 % (min. 3 avgjørende sett)',
      met: clutch.rate !== null && clutch.samples >= 3 && clutch.rate >= 0.7,
      progress: clutch.rate !== null ? `${Math.round(clutch.rate * 100)}% (${clutch.samples})` : '– (0)',
    },
    {
      emoji: '🔄',
      label: 'Comeback King',
      requirement: 'Comeback-rate ≥ 50 % (min. 3 forsøk)',
      met: comeback.rate !== null && comeback.samples >= 3 && comeback.rate >= 0.5,
      progress: comeback.rate !== null ? `${Math.round(comeback.rate * 100)}% (${comeback.samples})` : '– (0)',
    },
    {
      emoji: '⚡',
      label: 'Legende-jeger',
      requirement: 'Har prestasjonen «Legendarisk drap»',
      met: hasLegendarySlayer,
      progress: hasLegendarySlayer ? 'Oppnådd' : 'Ikke oppnådd',
    },
    {
      emoji: '🗡️',
      label: 'Giant Slayer',
      requirement: 'Har prestasjonen «Giant Slayer»',
      met: hasGiantSlayer,
      progress: hasGiantSlayer ? 'Oppnådd' : 'Ikke oppnådd',
    },
    {
      emoji: '♟️',
      label: 'Deuce-mesteren',
      requirement: 'Deuce-rate ≥ 30 % (min. 5 kamper)',
      met: deuce !== null && deuce >= 0.3 && matches.length >= 5,
      progress: deuce !== null ? `${Math.round(deuce * 100)}%` : '–',
    },
    {
      emoji: '🪨',
      label: 'Mr. Stabil',
      requirement: 'Rating-volatilitet mellom 0 og 15 (min. 5 kamper)',
      met: matches.length >= 5 && volatility > 0 && volatility < 15,
      progress: `${Math.round(volatility)}`,
    },
  ]

  const totalPlayerCount = players.length
  const rarityByAchievement: Record<string, number> = {}
  definitions.forEach((d) => {
    const earners = new Set(allAchievementsEarned.filter((e) => e.achievement_id === d.id).map((e) => e.player_id))
    rarityByAchievement[d.id] = totalPlayerCount > 0 ? earners.size / totalPlayerCount : 0
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <PlayerAvatar name={player.name} avatarUrl={player.avatar_url} size="lg" />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{player.name}</h1>
            {title && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                {title.emoji} {title.label}
              </span>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400">{rank ? `Plass #${rank} av ${total}` : 'Ingen rangering ennå'}</p>
        </div>
        {currentPlayer?.id === player.id ? (
          <div className="flex flex-col items-end gap-2">
            <Link to="/profile/edit" className="btn-secondary py-2 px-3 text-sm">
              <Pencil size={16} /> Rediger profil
            </Link>
            <button onClick={toggleTheme} className="btn-ghost py-1.5 px-2 text-xs">
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              {theme === 'dark' ? 'Lys modus' : 'Mørk modus'}
            </button>
          </div>
        ) : (
          currentPlayer && !currentPlayer.is_shared_device && (
            <button
              onClick={async () => {
                setChallenging(true)
                const { error } = await supabase.from('challenges').insert({ challenger_id: currentPlayer.id, challenged_id: player.id })
                setChallenging(false)
                if (!error || error.code === '23505') setChallengeSent(true)
              }}
              disabled={challenging || challengeSent}
              className="btn-secondary py-2 px-3 text-sm"
            >
              <Swords size={16} /> {challengeSent ? 'Utfordring sendt!' : 'Utfordre'}
            </button>
          )
        )}
      </div>

      <div className="flex justify-center">
        <PlayerTradingCard
          player={player}
          title={title}
          winRate={winRate}
          matchesPlayed={matches.length}
          peakRating={peak?.rating ?? null}
          achievementsEarned={new Set(earned.map((e) => e.achievement_id)).size}
          achievementsTotal={achievementsTotal}
          rank={rank}
          totalPlayers={total}
        />
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
        <div className="flex flex-col gap-1 mt-3">
          {matches.slice(0, 5).map((m) => {
            const won = m.winner_id === id
            const opponentId = m.player1_id === id ? m.player2_id : m.player1_id
            const opponent = players.find((p) => p.id === opponentId)
            const myScore = m.player1_id === id ? m.sets_won_player1 : m.sets_won_player2
            const oppScore = m.player1_id === id ? m.sets_won_player2 : m.sets_won_player1
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMatchId(m.id)}
                className="flex items-center gap-3 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg p-2 -mx-2"
              >
                {opponent && <PlayerAvatar name={opponent.name} avatarUrl={opponent.avatar_url} size="sm" />}
                <span className="flex-1 truncate">
                  mot <span className="font-medium">{opponent?.name ?? 'Ukjent spiller'}</span>
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
              </button>
            )
          })}
        </div>
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
        <div className="flex items-center gap-1.5 mb-3">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Avansert statistikk</p>
          <button
            onClick={() => setShowStatsExplainer(true)}
            className="btn-ghost p-1"
            title="Forklar spillerkortet og statistikken"
          >
            <Info size={14} />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-xs text-slate-500">Peak rating</p>
            <p className="text-xl font-bold">{peak ? Math.round(peak.rating) : '–'}</p>
            {peak && <p className="text-[11px] text-slate-400">{formatDate(peak.date)}</p>}
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
            <p className="text-xs text-slate-500">Sensasjonsseire (som underdog)</p>
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
            <p className="text-xl font-bold">{comeback.rate !== null ? `${Math.round(comeback.rate * 100)}%` : '–'}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500">Clutch-rate</p>
            <p className="text-xl font-bold">{clutch.rate !== null ? `${Math.round(clutch.rate * 100)}%` : '–'}</p>
          </div>
        </div>
      </div>

      {signature && signatureOpponent && (
        <div className="card p-5 flex items-center gap-3">
          <Trophy size={24} className="text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Signaturseier</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Beste seier: slo{' '}
              <Link to={`/players/${signatureOpponent.id}`} className="font-semibold text-amber-600 hover:underline">
                {signatureOpponent.name}
              </Link>{' '}
              som var ratet {Math.round(signature.margin)} poeng høyere
            </p>
          </div>
        </div>
      )}

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
            return (
              <AchievementBadge
                key={d.id}
                achievement={d}
                earned={!!e}
                earnedAt={e?.earned_at}
                rarity={rarityByAchievement[d.id]}
              />
            )
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Kamphistorikk</p>
        <div className="flex flex-col gap-2">
          {matches.slice(historyPage * historyPageSize, historyPage * historyPageSize + historyPageSize).map((m) => {
            const won = m.winner_id === id
            const opponentId = m.player1_id === id ? m.player2_id : m.player1_id
            const opponent = players.find((p) => p.id === opponentId)
            const myScore = m.player1_id === id ? m.sets_won_player1 : m.sets_won_player2
            const oppScore = m.player1_id === id ? m.sets_won_player2 : m.sets_won_player1
            const delta = historyByMatch[m.id]?.find((h) => h.player_id === id)
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMatchId(m.id)}
                className="card p-3 flex items-center gap-3 flex-wrap text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <span className="text-xs text-slate-400 w-20 shrink-0">
                  {formatDate(m.confirmed_at ?? m.created_at)}
                </span>
                <span className="flex items-center gap-2 flex-1 min-w-0">
                  {opponent && <PlayerAvatar name={opponent.name} avatarUrl={opponent.avatar_url} size="sm" />}
                  <span className="truncate text-sm">
                    mot <span className="font-medium">{opponent?.name ?? 'Ukjent spiller'}</span>
                  </span>
                </span>
                <span className="font-mono font-semibold shrink-0">{myScore}–{oppScore}</span>
                <span className="flex items-center gap-2 shrink-0">
                  {delta && (
                    <span className={`text-xs ${delta.delta >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {delta.delta >= 0 ? '+' : ''}{Math.round(delta.delta)}
                    </span>
                  )}
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      won
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400'
                    }`}
                  >
                    {won ? 'Seier' : 'Tap'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        {matches.length > 0 && (
          <Pagination
            page={historyPage}
            pageSize={historyPageSize}
            total={matches.length}
            onPageChange={setHistoryPage}
            onPageSizeChange={setHistoryPageSize}
          />
        )}
      </div>

      <MatchDetailModal matchId={selectedMatchId} onClose={() => setSelectedMatchId(null)} />
      {showStatsExplainer && (
        <StatsExplainerModal
          onClose={() => setShowStatsExplainer(false)}
          titleConditions={titleConditions}
          matchesPlayed={matches.length}
        />
      )}
    </div>
  )
}
