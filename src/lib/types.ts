export type MatchStatus = 'pending' | 'confirmed' | 'rejected'

export interface Player {
  id: string
  auth_user_id: string | null
  name: string
  avatar_url: string | null
  rating: number
  created_at: string
}

export interface MatchSet {
  id: string
  match_id: string
  set_number: number
  player1_score: number
  player2_score: number
}

export interface Match {
  id: string
  player1_id: string
  player2_id: string
  best_of: 1 | 3 | 5
  sets_won_player1: number | null
  sets_won_player2: number | null
  winner_id: string | null
  status: MatchStatus
  submitted_by: string
  confirmed_by: string | null
  notes: string | null
  played_at: string
  created_at: string
  confirmed_at: string | null
}

export interface RatingHistoryEntry {
  id: string
  player_id: string
  match_id: string
  rating_before: number
  rating_after: number
  delta: number
  created_at: string
}

export interface AchievementDefinition {
  id: string
  name: string
  description: string
  icon: string
}

export interface PlayerAchievement {
  id: string
  player_id: string
  achievement_id: string
  match_id: string | null
  earned_at: string
}

export interface LeaderboardRow {
  id: string
  name: string
  avatar_url: string | null
  rating: number
  matches_played: number
  wins: number
  losses: number
}

// Minimal Database typing so supabase-js generics have something to bind to.
// Replace with `supabase gen types typescript` output for full type safety.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any
