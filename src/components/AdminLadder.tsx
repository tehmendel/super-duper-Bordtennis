import { useCallback, useEffect, useState } from 'react'
import { ChevronUp, ChevronDown, Plus, Trash2, ListOrdered } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { LadderPosition, Player } from '@/lib/types'

interface Row extends LadderPosition {
  player: Player
}

export function AdminLadder() {
  const [rows, setRows] = useState<Row[]>([])
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [addPlayerId, setAddPlayerId] = useState('')
  const [loading, setLoading] = useState(true)
  const [ladderEnabled, setLadderEnabled] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [filling, setFilling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: r }, { data: p }, { data: setting }] = await Promise.all([
      supabase.from('ladder_positions').select('*, player:players(*)').order('position').returns<Row[]>(),
      supabase.from('players').select('*').order('name').returns<Player[]>(),
      supabase.from('app_settings').select('value').eq('key', 'ladder_enabled').maybeSingle(),
    ])
    setRows(r ?? [])
    setAllPlayers(p ?? [])
    setLadderEnabled(setting?.value !== false)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggleLadder() {
    setToggling(true)
    await supabase.rpc('admin_set_app_setting', { p_key: 'ladder_enabled', p_value: !ladderEnabled })
    setToggling(false)
    await load()
  }

  async function move(row: Row, direction: -1 | 1) {
    const idx = rows.findIndex((r) => r.player_id === row.player_id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= rows.length) return
    const other = rows[swapIdx]
    await Promise.all([
      supabase.rpc('admin_set_ladder_position', { p_player_id: row.player_id, p_position: other.position }),
      supabase.rpc('admin_set_ladder_position', { p_player_id: other.player_id, p_position: row.position }),
    ])
    await load()
  }

  async function fillFromLeaderboard() {
    if (!confirm('Dette erstatter hele stigen med toppliste-rekkefølgen (høyest rating først). Fortsette?')) return
    setFilling(true)
    await supabase.rpc('admin_fill_ladder_from_leaderboard')
    setFilling(false)
    await load()
  }

  async function addToLadder() {
    if (!addPlayerId) return
    const nextPosition = rows.length > 0 ? Math.max(...rows.map((r) => r.position)) + 1 : 1
    await supabase.rpc('admin_set_ladder_position', { p_player_id: addPlayerId, p_position: nextPosition })
    setAddPlayerId('')
    await load()
  }

  async function remove(playerId: string) {
    if (!confirm('Fjerne denne spilleren fra ladderen?')) return
    await supabase.rpc('admin_remove_from_ladder', { p_player_id: playerId })
    await load()
  }

  if (loading) return <p className="text-slate-500">Laster...</p>

  const availablePlayers = allPlayers.filter((p) => !rows.some((r) => r.player_id === p.id))

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Ladder-systemet er {ladderEnabled ? 'aktivert' : 'deaktivert'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Når deaktivert skjules "Ladder" og "Stigespillet" fra menyen for alle, og posisjonsbytter stopper.
          </p>
        </div>
        <button onClick={toggleLadder} disabled={toggling} className={ladderEnabled ? 'btn-secondary shrink-0' : 'btn-primary shrink-0'}>
          {toggling ? 'Vent...' : ladderEnabled ? 'Slå av' : 'Slå på'}
        </button>
      </div>

      <div className="card p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Fyll stigen automatisk</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Legger til alle registrerte spillere i startrekkefølge basert på nåværende toppliste (høyest rating øverst).
            Erstatter hele stigen.
          </p>
        </div>
        <button onClick={fillFromLeaderboard} disabled={filling} className="btn-secondary shrink-0">
          <ListOrdered size={16} /> {filling ? 'Fyller...' : 'Fyll fra toppliste'}
        </button>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        Sett opp startrekkefølgen manuelt. Spillere bytter plass automatisk når de slår personen rett over seg.
      </p>

      <div className="card divide-y divide-slate-200 dark:divide-slate-800">
        {rows.map((r, i) => (
          <div key={r.player_id} className="flex items-center gap-3 p-3">
            <span className="w-8 text-center font-bold text-slate-500">#{r.position}</span>
            <PlayerAvatar name={r.player.name} avatarUrl={r.player.avatar_url} size="sm" />
            <span className="flex-1 text-sm font-medium truncate">{r.player.name}</span>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => move(r, -1)} disabled={i === 0} className="btn-ghost p-1.5">
                <ChevronUp size={14} />
              </button>
              <button onClick={() => move(r, 1)} disabled={i === rows.length - 1} className="btn-ghost p-1.5">
                <ChevronDown size={14} />
              </button>
              <button onClick={() => remove(r.player_id)} className="btn-ghost p-1.5 text-rose-600">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Ingen spillere på ladderen ennå.</p>}
      </div>

      <div className="flex gap-2">
        <select value={addPlayerId} onChange={(e) => setAddPlayerId(e.target.value)} className="input">
          <option value="">Legg til spiller...</option>
          {availablePlayers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button onClick={addToLadder} disabled={!addPlayerId} className="btn-primary shrink-0">
          <Plus size={16} /> Legg til
        </button>
      </div>
    </div>
  )
}
