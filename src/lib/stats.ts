import type { Match, MatchSet, Player, RatingHistoryEntry } from '@/lib/types'

export interface MatchWithSets {
  match: Match
  sets: MatchSet[]
}

export function peakRating(history: RatingHistoryEntry[]) {
  if (history.length === 0) return null
  const peak = history.reduce((max, h) => (h.rating_after > max.rating_after ? h : max), history[0])
  return { rating: peak.rating_after, date: peak.created_at }
}

export function ratingVolatility(history: RatingHistoryEntry[]) {
  if (history.length < 2) return 0
  const deltas = history.map((h) => h.delta)
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length
  const variance = deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / deltas.length
  return Math.sqrt(variance)
}

export function ratingMomentum(history: RatingHistoryEntry[], recentCount = 5) {
  if (history.length === 0) return 0
  const recent = history.slice(-recentCount)
  const recentAvg = recent.reduce((a, h) => a + h.delta, 0) / recent.length
  const allAvg = history.reduce((a, h) => a + h.delta, 0) / history.length
  return recentAvg - allAvg
}

export function countUpsets(playerId: string, matches: Match[], historyByMatch: Record<string, RatingHistoryEntry[]>) {
  let upsets = 0
  for (const m of matches) {
    if (m.winner_id !== playerId) continue
    const entries = historyByMatch[m.id]
    if (!entries) continue
    const mine = entries.find((e) => e.player_id === playerId)
    const theirs = entries.find((e) => e.player_id !== playerId)
    if (mine && theirs && mine.rating_before < theirs.rating_before) upsets++
  }
  return upsets
}

export function averageSetMargin(playerId: string, matchesWithSets: MatchWithSets[]) {
  let total = 0
  let count = 0
  for (const { match, sets } of matchesWithSets) {
    const isP1 = match.player1_id === playerId
    for (const s of sets) {
      const mine = isP1 ? s.player1_score : s.player2_score
      const theirs = isP1 ? s.player2_score : s.player1_score
      total += Math.abs(mine - theirs)
      count++
    }
  }
  return count > 0 ? total / count : null
}

export function deuceRate(matchesWithSets: MatchWithSets[]) {
  let deuce = 0
  let total = 0
  for (const { sets } of matchesWithSets) {
    for (const s of sets) {
      total++
      if (s.player1_score >= 10 && s.player2_score >= 10) deuce++
    }
  }
  return total > 0 ? deuce / total : null
}

export function comebackRate(playerId: string, matchesWithSets: MatchWithSets[]) {
  let lostFirstSet = 0
  let comebacks = 0
  for (const { match, sets } of matchesWithSets) {
    const set1 = sets.find((s) => s.set_number === 1)
    if (!set1 || match.best_of === 1) continue
    const isP1 = match.player1_id === playerId
    const wonSet1 = isP1 ? set1.player1_score > set1.player2_score : set1.player2_score > set1.player1_score
    if (wonSet1) continue
    lostFirstSet++
    if (match.winner_id === playerId) comebacks++
  }
  return lostFirstSet > 0 ? comebacks / lostFirstSet : null
}

export function clutchRate(playerId: string, matchesWithSets: MatchWithSets[]) {
  let decidingSets = 0
  let wonDeciding = 0
  for (const { match, sets } of matchesWithSets) {
    if (sets.length !== match.best_of) continue
    const lastSet = sets[sets.length - 1]
    const isP1 = match.player1_id === playerId
    decidingSets++
    const wonLastSet = isP1 ? lastSet.player1_score > lastSet.player2_score : lastSet.player2_score > lastSet.player1_score
    if (wonLastSet) wonDeciding++
  }
  return decidingSets > 0 ? wonDeciding / decidingSets : null
}

export interface Nemesis {
  playerId: string
  winRate: number
  wins: number
  losses: number
}

export function findNemesis(playerId: string, matches: Match[]): Nemesis | null {
  const record = new Map<string, { wins: number; losses: number }>()
  for (const m of matches) {
    const oppId = m.player1_id === playerId ? m.player2_id : m.player1_id
    const r = record.get(oppId) ?? { wins: 0, losses: 0 }
    if (m.winner_id === playerId) r.wins++
    else r.losses++
    record.set(oppId, r)
  }
  let nemesis: Nemesis | null = null
  for (const [oppId, r] of record.entries()) {
    const total = r.wins + r.losses
    if (total < 2) continue
    const winRate = r.wins / total
    if (!nemesis || winRate < nemesis.winRate) nemesis = { playerId: oppId, winRate, wins: r.wins, losses: r.losses }
  }
  return nemesis
}

export function winRateByWeekday(playerId: string, matches: Match[]) {
  const days = Array.from({ length: 7 }, () => ({ wins: 0, total: 0 }))
  for (const m of matches) {
    const day = new Date(m.confirmed_at ?? m.created_at).getDay()
    days[day].total++
    if (m.winner_id === playerId) days[day].wins++
  }
  return days
}

export function longestGapDays(matches: Match[]) {
  if (matches.length < 2) return null
  const dates = matches
    .map((m) => new Date(m.confirmed_at ?? m.created_at).getTime())
    .sort((a, b) => a - b)
  let maxGap = 0
  for (let i = 1; i < dates.length; i++) {
    maxGap = Math.max(maxGap, dates[i] - dates[i - 1])
  }
  return Math.round(maxGap / (24 * 60 * 60 * 1000))
}

export interface DominanceCell {
  wins: number
  losses: number
  winRate: number | null
}

export function buildDominanceMatrix(players: Player[], matches: Match[]) {
  const matrix = new Map<string, Map<string, DominanceCell>>()
  for (const p of players) matrix.set(p.id, new Map())

  for (const m of matches) {
    if (!m.winner_id) continue
    const loserId = m.winner_id === m.player1_id ? m.player2_id : m.player1_id

    const winnerRow = matrix.get(m.winner_id)
    if (winnerRow) {
      const cell = winnerRow.get(loserId) ?? { wins: 0, losses: 0, winRate: null }
      cell.wins++
      winnerRow.set(loserId, cell)
    }
    const loserRow = matrix.get(loserId)
    if (loserRow) {
      const cell = loserRow.get(m.winner_id) ?? { wins: 0, losses: 0, winRate: null }
      cell.losses++
      loserRow.set(m.winner_id, cell)
    }
  }

  for (const row of matrix.values()) {
    for (const cell of row.values()) {
      const total = cell.wins + cell.losses
      cell.winRate = total > 0 ? cell.wins / total : null
    }
  }

  return matrix
}

export interface Rivalry {
  playerAId: string
  playerBId: string
  winsA: number
  winsB: number
  total: number
}

export function closestRivalries(matches: Match[], minMatches = 3): Rivalry[] {
  const pairs = new Map<string, Rivalry>()
  for (const m of matches) {
    if (!m.winner_id) continue
    const [a, b] = [m.player1_id, m.player2_id].sort()
    const key = `${a}|${b}`
    const rivalry = pairs.get(key) ?? { playerAId: a, playerBId: b, winsA: 0, winsB: 0, total: 0 }
    rivalry.total++
    if (m.winner_id === a) rivalry.winsA++
    else rivalry.winsB++
    pairs.set(key, rivalry)
  }
  return [...pairs.values()]
    .filter((r) => r.total >= minMatches)
    .sort((x, y) => Math.abs(x.winsA - x.winsB) - Math.abs(y.winsA - y.winsB) || y.total - x.total)
}

export interface BiggestUpset {
  match: Match
  winnerRatingBefore: number
  loserRatingBefore: number
  margin: number
}

export function biggestUpsetEver(matches: Match[], historyByMatch: Record<string, RatingHistoryEntry[]>): BiggestUpset | null {
  let biggest: BiggestUpset | null = null
  for (const m of matches) {
    if (!m.winner_id) continue
    const entries = historyByMatch[m.id]
    if (!entries) continue
    const winnerEntry = entries.find((e) => e.player_id === m.winner_id)
    const loserEntry = entries.find((e) => e.player_id !== m.winner_id)
    if (!winnerEntry || !loserEntry) continue
    const margin = loserEntry.rating_before - winnerEntry.rating_before
    if (margin > 0 && (!biggest || margin > biggest.margin)) {
      biggest = { match: m, winnerRatingBefore: winnerEntry.rating_before, loserRatingBefore: loserEntry.rating_before, margin }
    }
  }
  return biggest
}
