import type { Match, MatchSet } from '@/lib/types'

// Deterministic pick so the same match always shows the same line, not a
// new random one on every render.
function pick<T>(items: T[], seed: string): T {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return items[hash % items.length]
}

const BLOWOUT_LINES = [
  (winner: string, loser: string) => `${winner} rullet ${loser} ut av bordtennishallen. Nådeløst. 🧹`,
  (winner: string, loser: string) => `${loser} kom, så, og ble jevnet med gulvet av ${winner}.`,
  (winner: string, loser: string) => `${winner} sørget for at ${loser} husker denne kampen lenge.`,
]

const CLOSE_LINES = [
  (winner: string, loser: string) => `${winner} vant med et nødskrik mot ${loser} — hjertet banket nok fort.`,
  (winner: string, loser: string) => `${loser} var centimeter unna å snu kampen mot ${winner}. Så nære!`,
  (winner: string, loser: string) => `En thriller mellom ${winner} og ${loser} — avgjort på marginer.`,
]

const NORMAL_LINES = [
  (winner: string, loser: string) => `${winner} tok en solid seier over ${loser} i dag.`,
  (winner: string, loser: string) => `${loser} fikk kjørt seg av ${winner} denne runden.`,
  (winner: string, loser: string) => `Nok en dag på jobben for ${winner}, som slo ${loser}.`,
]

export function generateRoast(match: Match, sets: MatchSet[], winnerName: string, loserName: string): string {
  const isP1Winner = match.winner_id === match.player1_id
  const totalMargin = sets.reduce((sum, s) => {
    const winnerScore = isP1Winner ? s.player1_score : s.player2_score
    const loserScore = isP1Winner ? s.player2_score : s.player1_score
    return sum + (winnerScore - loserScore)
  }, 0)
  const avgMargin = sets.length > 0 ? totalMargin / sets.length : 0

  const pool = avgMargin >= 6 ? BLOWOUT_LINES : avgMargin <= 2 ? CLOSE_LINES : NORMAL_LINES
  const template = pick(pool, match.id)
  return template(winnerName, loserName)
}
