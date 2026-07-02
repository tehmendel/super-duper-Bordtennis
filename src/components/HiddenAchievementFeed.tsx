import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { AchievementDefinition, Player, PlayerAchievement } from '@/lib/types'

interface FeedEntry extends PlayerAchievement {
  player: Player
  achievement: AchievementDefinition
}

const REVEAL_TEXT: Record<string, (name: string) => string> = {
  night_owl: (name) => `${name} spilte en kamp midt på natten og låste opp en skjult prestasjon 🦉`,
  shutout: (name) => `${name} rullet et sett uten å slippe til motstanderen og låste opp en skjult prestasjon 🥶`,
  weekend_warrior: (name) => `${name} spilte bordtennis i helgen og låste opp en skjult prestasjon 🏖️`,
  early_bird: (name) => `${name} rakk en kamp før frokost og låste opp en skjult prestasjon 🐦`,
  century_club: (name) => `${name} nådde 10 kamper og låste opp en skjult prestasjon 💯`,
  marathon: (name) => `${name} spilte en full femsettskamp og låste opp en skjult prestasjon 🏃`,
  revenge: (name) => `${name} tok revansje mot en gammel plage og låste opp en skjult prestasjon 🗡️`,
  hat_trick_day: (name) => `${name} vant 3 kamper på én dag og låste opp en skjult prestasjon 🎩`,
  deuce_master: (name) => `${name} vant en knallhard settavslutning og låste opp en skjult prestasjon ♟️`,
  busy_week: (name) => `${name} spilte 5 kamper på en uke og låste opp en skjult prestasjon 📅`,
  flawless: (name) => `${name} vant en kamp uten å slippe til ett eneste poeng og låste opp en skjult prestasjon 💎`,
  unstoppable_20: (name) => `${name} har vunnet 20 kamper på rad og låste opp en skjult prestasjon 👑`,
  legendary_slayer: (name) => `${name} slo en spiller med enorm ratingforskjell og låste opp en skjult prestasjon ⚡`,
  double_comeback: (name) => `${name} kom tilbake fra 0-2 i sett og låste opp en skjult prestasjon 🌊`,
  midnight_marathon: (name) => `${name} spilte en femsettskamp midt på natten og låste opp en skjult prestasjon 🌙`,
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 1) return 'akkurat nå'
  if (hours < 24) return `for ${hours}t siden`
  const days = Math.floor(hours / 24)
  return `for ${days}d siden`
}

export function HiddenAchievementFeed() {
  const [entries, setEntries] = useState<FeedEntry[]>([])

  useEffect(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    supabase
      .from('player_achievements')
      .select('*, player:players(*), achievement:achievement_definitions!inner(*)')
      .eq('achievement.hidden', true)
      .gte('earned_at', sevenDaysAgo)
      .order('earned_at', { ascending: false })
      .limit(3)
      .returns<FeedEntry[]>()
      .then(({ data }) => setEntries(data ?? []))
  }, [])

  if (entries.length === 0) return null

  return (
    <div className="card p-5">
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">🎉 Skjulte prestasjoner nylig</p>
      <div className="flex flex-col gap-3">
        {entries.map((e) => (
          <Link
            key={e.id}
            to={`/players/${e.player_id}`}
            className="flex items-center gap-3 rounded-xl p-2 -m-2 hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <PlayerAvatar name={e.player.name} avatarUrl={e.player.avatar_url} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm">{(REVEAL_TEXT[e.achievement_id] ?? ((n: string) => `${n} låste opp en skjult prestasjon`))(e.player.name)}</p>
              <p className="text-xs text-slate-400">{timeAgo(e.earned_at)}</p>
            </div>
            <span className="text-2xl">{e.achievement.icon}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
