export type MatchStatus = 'pending' | 'confirmed' | 'rejected'

export interface Player {
  id: string
  auth_user_id: string | null
  name: string
  username: string | null
  avatar_url: string | null
  rating: number
  is_admin: boolean
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
  hidden: boolean
}

export interface PlayerAchievement {
  id: string
  player_id: string
  achievement_id: string
  match_id: string | null
  earned_at: string
}

export type AccessLevel = 'read' | 'write'

export interface Role {
  id: string
  name: string
  is_default: boolean
  created_at: string
}

export interface RolePermission {
  id: string
  role_id: string
  page_key: string
  access_level: AccessLevel
}

export interface RoleAssignment {
  id: string
  role_id: string
  player_id: string
}

export const PAGE_KEYS = [
  'dashboard', 'new_match', 'pending', 'history', 'leaderboard', 'head_to_head',
  'tournaments', 'ladder', 'qr', 'players', 'profile_edit',
] as const

export type PageKey = (typeof PAGE_KEYS)[number]

export const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  new_match: 'Ny kamp',
  pending: 'Bekreftelser',
  history: 'Historikk',
  leaderboard: 'Toppliste',
  head_to_head: 'Head-to-head',
  tournaments: 'Turneringer',
  ladder: 'Stigespillet',
  qr: 'QR',
  players: 'Spillere',
  profile_edit: 'Rediger profil',
}

export interface LadderPosition {
  player_id: string
  position: number
  updated_at: string
}

export interface LadderChallengeLog {
  id: string
  match_id: string | null
  challenger_id: string
  defender_id: string
  challenger_position_before: number
  defender_position_before: number
  winner_id: string
  swapped: boolean
  created_at: string
}

export interface Challenge {
  id: string
  challenger_id: string
  challenged_id: string
  status: 'pending' | 'played' | 'dismissed'
  created_at: string
}

export interface AuditLogEntry {
  id: string
  table_name: string
  record_id: string | null
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  changed_by: string | null
  changed_by_name: string | null
  changed_by_email: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_fields: string[] | null
  created_at: string
}

export interface Season {
  id: string
  name: string
  started_at: string
  ended_at: string | null
  target_end_date: string | null
  is_active: boolean
}

export interface SeasonStanding {
  id: string
  season_id: string
  player_id: string
  final_rating: number
  matches_played: number
  wins: number
  losses: number
}

export interface Tournament {
  id: string
  name: string
  status: 'in_progress' | 'completed'
  created_by: string | null
  created_at: string
  completed_at: string | null
}

export interface TournamentParticipant {
  id: string
  tournament_id: string
  player_id: string
  seed: number
}

export interface TournamentMatch {
  id: string
  tournament_id: string
  round: number
  position: number
  player1_id: string | null
  player2_id: string | null
  player1_score: number | null
  player2_score: number | null
  winner_id: string | null
  next_match_id: string | null
  is_lucky_loser: boolean
  lucky_loser_source_match_id: string | null
}

export interface TournamentMatchSet {
  id: string
  tournament_match_id: string
  set_number: number
  player1_score: number
  player2_score: number
}

export interface TournamentCommentary {
  id: string
  tournament_id: string
  content: string
  created_at: string
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
