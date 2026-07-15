import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trophy, X, Trash2, Dices, Plus, GripVertical, UserCog, UserPlus, Maximize2, Minimize2, Timer, Users, Calendar, Swords, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import { TournamentMatchDetailModal } from '@/components/TournamentMatchDetailModal'
import { useFullscreen } from '@/hooks/useFullscreen'
import { eloWinProbability } from '@/lib/stats'
import { formatDate } from '@/lib/date'
import type { Player, Tournament, TournamentCommentary, TournamentMatch, TournamentMatchSet, TournamentParticipant } from '@/lib/types'

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}t ${minutes}min`
  if (minutes > 0) return `${minutes}min ${seconds}s`
  return `${seconds}s`
}

interface EnrichedMatch extends TournamentMatch {
  player1: Player | null
  player2: Player | null
}

type SetScore = { player1_score: string; player2_score: string }
type Slot = { matchId: string; slot: 1 | 2 }

function chunkPairs<T>(arr: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2))
  return out
}

function roundName(round: number, totalRounds: number) {
  const remaining = totalRounds - round + 1
  switch (remaining) {
    case 1: return 'Finale'
    case 2: return 'Semifinale'
    case 3: return 'Kvartfinale'
    case 4: return 'Åttedelsfinale'
    case 5: return 'Sekstendedelsfinale'
    default: return `Runde ${round}`
  }
}

export function TournamentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { player } = useAuth()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<EnrichedMatch[]>([])
  const [matchSets, setMatchSets] = useState<TournamentMatchSet[]>([])
  const [participants, setParticipants] = useState<TournamentParticipant[]>([])
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [commentary, setCommentary] = useState<TournamentCommentary[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EnrichedMatch | null>(null)
  const [sets, setSets] = useState<SetScore[]>([{ player1_score: '', player2_score: '' }])
  const [viewing, setViewing] = useState<EnrichedMatch | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [dragSource, setDragSource] = useState<Slot | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [slotEditor, setSlotEditor] = useState<Slot | null>(null)
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [addingParticipant, setAddingParticipant] = useState(false)
  const [addParticipantError, setAddParticipantError] = useState<string | null>(null)
  const [bracketError, setBracketError] = useState<string | null>(null)
  // Pointer-based drag (instead of native HTML5 drag-and-drop) so this also
  // works with touch on mobile, not just mouse.
  const dragStartPos = useRef<{ x: number; y: number } | null>(null)
  const suppressClickUntil = useRef(0)

  const { ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen<HTMLDivElement>()
  const [now, setNow] = useState(() => Date.now())

  // Connector lines between rounds are measured from actual DOM positions
  // (not CSS percentage guesses) so they line up correctly regardless of
  // card height differences — a bye match (no "Registrer resultat" button)
  // is shorter than a real match, which threw off the old fixed-offset lines.
  const bracketWrapRef = useRef<HTMLDivElement>(null)
  const matchCardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [connectorPaths, setConnectorPaths] = useState<{ id: string; d: string }[]>([])

  useEffect(() => {
    if (tournament?.status !== 'in_progress') return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [tournament?.status])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [{ data: t }, { data: m }, { data: p }, { data: allP }] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).single(),
      supabase
        .from('tournament_matches')
        .select('*, player1:players!tournament_matches_player1_id_fkey(*), player2:players!tournament_matches_player2_id_fkey(*)')
        .eq('tournament_id', id)
        .order('round')
        .order('position')
        .returns<EnrichedMatch[]>(),
      supabase.from('tournament_participants').select('*').eq('tournament_id', id).returns<TournamentParticipant[]>(),
      supabase.from('players').select('*').order('name').returns<Player[]>(),
    ])
    setTournament(t ?? null)
    setMatches(m ?? [])
    setParticipants(p ?? [])
    setAllPlayers(allP ?? [])

    const matchIds = (m ?? []).map((match) => match.id)
    if (matchIds.length > 0) {
      const { data: s } = await supabase
        .from('tournament_match_sets')
        .select('*')
        .in('tournament_match_id', matchIds)
        .order('set_number')
        .returns<TournamentMatchSet[]>()
      setMatchSets(s ?? [])
    }

    setLoading(false)
  }, [id])

  const loadCommentary = useCallback(async () => {
    if (!id) return
    const { data } = await supabase
      .from('tournament_commentary')
      .select('*')
      .eq('tournament_id', id)
      .order('created_at', { ascending: false })
      .returns<TournamentCommentary[]>()
    setCommentary(data ?? [])
  }, [id])

  useEffect(() => {
    load()
    loadCommentary()
  }, [load, loadCommentary])

  // AI commentary is generated asynchronously by a background trigger, so
  // poll for new lines while the tournament is still going instead of
  // requiring a manual refresh.
  useEffect(() => {
    if (tournament?.status !== 'in_progress') return
    const timer = setInterval(loadCommentary, 8000)
    return () => clearInterval(timer)
  }, [tournament?.status, loadCommentary])

  useLayoutEffect(() => {
    function recompute() {
      const container = bracketWrapRef.current
      if (!container) return
      const containerRect = container.getBoundingClientRect()
      const paths: { id: string; d: string }[] = []
      matches.forEach((m) => {
        if (!m.next_match_id) return
        const sourceEl = matchCardRefs.current.get(m.id)
        const targetEl = matchCardRefs.current.get(m.next_match_id)
        if (!sourceEl || !targetEl) return
        const sRect = sourceEl.getBoundingClientRect()
        const tRect = targetEl.getBoundingClientRect()
        const x1 = sRect.right - containerRect.left
        const y1 = sRect.top + sRect.height / 2 - containerRect.top
        const x2 = tRect.left - containerRect.left
        const y2 = tRect.top + tRect.height / 2 - containerRect.top
        const midX = x1 + (x2 - x1) / 2
        paths.push({ id: m.id, d: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}` })
      })
      setConnectorPaths(paths)
    }

    recompute()
    const ro = new ResizeObserver(recompute)
    if (bracketWrapRef.current) ro.observe(bracketWrapRef.current)
    window.addEventListener('resize', recompute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recompute)
    }
  }, [matches, isFullscreen])

  if (loading) return <p className="text-slate-500">Laster...</p>
  if (!tournament) return <p className="text-slate-500">Fant ikke turneringen.</p>

  const seedByPlayer = new Map(participants.map((p) => [p.player_id, p.seed]))
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b)
  const finalMatch = matches.find((m) => m.round === rounds[rounds.length - 1])
  const champion =
    tournament.status === 'completed' && finalMatch?.winner_id
      ? [finalMatch.player1, finalMatch.player2].find((p) => p?.id === finalMatch.winner_id) ?? null
      : null

  const canEditBracket = !!player?.is_admin
  const round1Matches = matches.filter((m) => m.round === 1)
  const seatedPlayerIds = new Set(round1Matches.flatMap((m) => [m.player1_id, m.player2_id]).filter((x): x is string => !!x))
  const openRound1Slots: Slot[] = round1Matches
    .sort((a, b) => a.position - b.position)
    .flatMap((m) => {
      const slots: Slot[] = []
      if (!m.player1_id) slots.push({ matchId: m.id, slot: 1 })
      if (!m.player2_id) slots.push({ matchId: m.id, slot: 2 })
      return slots
    })
  const unseatedPlayers = allPlayers.filter((p) => !seatedPlayerIds.has(p.id))

  // A round-2+ match fed by only one earlier-round match has exactly one
  // slot that will never be fed by a real match (only by a lucky-loser fill)
  // — the OTHER slot is normal, just waiting on that single feeder to
  // decide. Before that feeder resolves, both slots look empty, so which
  // specific slot number is the true bye has to be derived structurally
  // (from the feeder's position parity — see advance_tournament_winner),
  // not just from "this match currently has an empty slot".
  const feedersByNextMatch = new Map<string, EnrichedMatch[]>()
  matches.forEach((m) => {
    if (m.next_match_id) feedersByNextMatch.set(m.next_match_id, [...(feedersByNextMatch.get(m.next_match_id) ?? []), m])
  })
  const phantomBySlot = new Map<string, 1 | 2>()
  feedersByNextMatch.forEach((feeders, nextMatchId) => {
    if (feeders.length === 1) {
      const fedSlot = feeders[0].position % 2 === 0 ? 1 : 2
      phantomBySlot.set(nextMatchId, fedSlot === 1 ? 2 : 1)
    }
  })

  // Bracket sizing scales up on wider viewports, with an extra bump in
  // fullscreen mode (e.g. displaying on a TV/projector). The round gap and
  // its connector-line offset/width must stay exact halves of each other
  // (gap-N pairs with -right-(N/2) w-(N/2)) or the bracket lines visually
  // detach from the next round's column.
  const colWidthClass = isFullscreen ? 'w-64 sm:w-80 lg:w-96' : 'w-64 sm:w-72 lg:w-80'
  const cardPadClass = isFullscreen ? 'p-4 sm:p-5' : 'p-3 sm:p-4'
  const nameTextClass = isFullscreen ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
  const roundLabelClass = isFullscreen ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
  const bracketAvatarSize = isFullscreen ? 'md' : 'sm'
  const roundGapClass = 'gap-8 sm:gap-10 lg:gap-12'

  const matchesDecided = matches.filter((m) => m.winner_id !== null).length
  const currentRound = tournament.status === 'completed' ? rounds.length : (matches.find((m) => m.winner_id === null && m.player1_id && m.player2_id)?.round ?? rounds[0])
  const elapsedMs = tournament.completed_at
    ? new Date(tournament.completed_at).getTime() - new Date(tournament.created_at).getTime()
    : now - new Date(tournament.created_at).getTime()

  function openEdit(m: EnrichedMatch) {
    setEditing(m)
    const existing = matchSets.filter((s) => s.tournament_match_id === m.id)
    setSets(
      existing.length > 0
        ? existing.map((s) => ({ player1_score: String(s.player1_score), player2_score: String(s.player2_score) }))
        : [{ player1_score: '', player2_score: '' }, { player1_score: '', player2_score: '' }],
    )
    setError(null)
  }

  function updateSet(index: number, field: keyof SetScore, value: string) {
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  async function handleSave() {
    if (!editing) return
    setError(null)

    const parsedSets = sets
      .filter((s) => s.player1_score !== '' && s.player2_score !== '')
      .map((s, i) => ({
        set_number: i + 1,
        player1_score: Number(s.player1_score),
        player2_score: Number(s.player2_score),
      }))

    if (parsedSets.length === 0) return setError('Fyll inn minst ett sett')
    if (parsedSets.some((s) => s.player1_score === s.player2_score)) return setError('Et sett kan ikke ende uavgjort')

    setSaving(true)
    const { error } = await supabase.rpc('submit_tournament_match_result', {
      p_match_id: editing.id,
      p_sets: parsedSets,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setEditing(null)
    await load()
  }

  async function handleDelete() {
    if (!id || !confirm('Slette denne turneringen permanent?')) return
    await supabase.rpc('delete_tournament', { p_tournament_id: id })
    navigate('/tournaments')
  }

  async function handleDrop(target: Slot) {
    const source = dragSource
    setDragSource(null)
    setDragOverKey(null)
    if (!source) return
    if (source.matchId === target.matchId && source.slot === target.slot) return

    setBracketError(null)
    const { error } = await supabase.rpc('admin_swap_tournament_players', {
      p_match_a_id: source.matchId,
      p_slot_a: source.slot,
      p_match_b_id: target.matchId,
      p_slot_b: target.slot,
    })
    if (error) {
      setBracketError(error.message)
      return
    }
    await load()
  }

  function slotAtPoint(x: number, y: number): Slot | null {
    const el = document.elementFromPoint(x, y)?.closest('[data-slot-key]')
    const key = el?.getAttribute('data-slot-key')
    if (!key) return null
    const [matchId, slotStr] = key.split('::')
    return { matchId, slot: Number(slotStr) as 1 | 2 }
  }

  function handleSlotPointerDown(e: React.PointerEvent, slot: Slot) {
    if (!canEditBracket) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartPos.current = { x: e.clientX, y: e.clientY }
    setDragSource(slot)
  }

  function handleSlotPointerMove(e: React.PointerEvent) {
    if (!dragSource || !dragStartPos.current) return
    const dx = e.clientX - dragStartPos.current.x
    const dy = e.clientY - dragStartPos.current.y
    if (Math.hypot(dx, dy) < 6) return
    const target = slotAtPoint(e.clientX, e.clientY)
    setDragOverKey(target ? `${target.matchId}::${target.slot}` : null)
  }

  function handleSlotPointerUp(e: React.PointerEvent) {
    if (!dragSource || !dragStartPos.current) return
    const moved = Math.hypot(e.clientX - dragStartPos.current.x, e.clientY - dragStartPos.current.y) >= 6
    dragStartPos.current = null
    if (!moved) {
      // Just a tap/click, not a real drag — let the normal onClick (open
      // match details) run, and don't attempt a drop.
      setDragSource(null)
      setDragOverKey(null)
      return
    }
    suppressClickUntil.current = Date.now() + 300
    const target = slotAtPoint(e.clientX, e.clientY)
    if (target) handleDrop(target)
    else {
      setDragSource(null)
      setDragOverKey(null)
    }
  }

  async function handleAddParticipant(playerId: string) {
    setBracketError(null)
    setAddParticipantError(null)
    setAddingParticipant(true)

    const target = openRound1Slots[0]
    const { error } = target
      ? await supabase.rpc('admin_set_tournament_slot', { p_match_id: target.matchId, p_slot: target.slot, p_player_id: playerId })
      : await supabase.rpc('admin_add_tournament_participant', { p_tournament_id: id, p_player_id: playerId })

    setAddingParticipant(false)
    if (error) {
      setAddParticipantError(error.message)
      return
    }
    setShowAddParticipant(false)
    await load()
  }

  async function handleSetSlot(target: Slot, newPlayerId: string | null) {
    setBracketError(null)
    const { error } = await supabase.rpc('admin_set_tournament_slot', {
      p_match_id: target.matchId,
      p_slot: target.slot,
      p_player_id: newPlayerId,
    })
    if (error) {
      setBracketError(error.message)
      return
    }
    setSlotEditor(null)
    await load()
  }

  return (
    <div
      ref={fullscreenRef}
      className={isFullscreen ? 'flex flex-col gap-6 bg-white dark:bg-slate-950 min-h-screen p-6 overflow-y-auto' : 'flex flex-col gap-6'}
    >
      <div className="flex items-center gap-3">
        <Trophy size={24} className="text-amber-500" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {tournament.status === 'completed' ? 'Fullført 🏆' : `Pågår — ${roundName(currentRound, rounds.length)}`}
          </p>
        </div>
        <button onClick={toggleFullscreen} className="btn-ghost p-2" title={isFullscreen ? 'Avslutt fullskjerm' : 'Vis i fullskjerm'}>
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
        {canEditBracket && tournament.status !== 'completed' && (
          <button onClick={() => setShowAddParticipant(true)} className="btn-secondary py-2 px-3 text-sm">
            <UserPlus size={16} /> Legg til deltaker
          </button>
        )}
        {player?.is_admin && (
          <button onClick={handleDelete} className="btn-ghost p-2 text-rose-600" title="Slett turnering">
            <Trash2 size={18} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 flex items-center gap-2">
          <Users size={18} className="text-brand-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Deltakere</p>
            <p className="font-bold text-sm">{participants.length}</p>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-2">
          <Swords size={18} className="text-brand-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Kamper spilt</p>
            <p className="font-bold text-sm">{matchesDecided}/{matches.length}</p>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-2">
          <Calendar size={18} className="text-brand-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Startet</p>
            <p className="font-bold text-sm">{formatDate(tournament.created_at)}</p>
          </div>
        </div>
        <div className="card p-3 flex items-center gap-2">
          <Timer size={18} className="text-brand-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {tournament.status === 'completed' ? 'Varighet' : 'Pågått i'}
            </p>
            <p className="font-bold text-sm font-mono">{formatDuration(elapsedMs)}</p>
          </div>
        </div>
      </div>

      {commentary.length > 0 && (
        <div className="card p-4 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/10 border border-violet-200 dark:border-violet-900">
          <p className="text-xs font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Sparkles size={14} /> AI-kommentator
          </p>
          <div className="flex flex-col gap-2">
            {commentary.slice(0, 5).map((c, i) => (
              <p key={c.id} className={`text-sm ${i === 0 ? 'font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                {c.content}
              </p>
            ))}
          </div>
        </div>
      )}

      {canEditBracket && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Som admin kan du dra spillere mellom kampene i runde 1 for å endre kampoppsettet, eller bruke <UserCog size={12} className="inline" />-knappen for å bytte ut eller fjerne en deltaker.
        </p>
      )}
      {bracketError && <p className="text-sm text-rose-600">{bracketError}</p>}

      {champion && (
        <div className="card p-6 flex flex-col items-center gap-2 bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-950/40 dark:to-yellow-950/10 border-2 border-amber-300 dark:border-amber-700">
          <Trophy size={36} className="text-amber-500" />
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">Turneringsvinner</p>
          <div className="flex items-center gap-3">
            <PlayerAvatar name={champion.name} avatarUrl={champion.avatar_url} size="lg" />
            <p className="text-2xl font-black">{champion.name}</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto pb-4">
        <div ref={bracketWrapRef} className={`relative flex items-stretch ${roundGapClass}`}>
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
            {connectorPaths.map((p) => (
              <path key={p.id} d={p.d} fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-slate-300 dark:stroke-slate-700" />
            ))}
          </svg>
          {rounds.map((round) => {
          const roundMatches = matches.filter((m) => m.round === round).sort((a, b) => a.position - b.position)
          const pairs = chunkPairs(roundMatches)
          const draggableRound = canEditBracket && round === 1
          return (
            <div key={round} className={`flex flex-col shrink-0 ${colWidthClass}`}>
              <p className={`${roundLabelClass} font-semibold text-slate-500 dark:text-slate-400 text-center mb-4`}>
                {roundName(round, rounds.length)}
              </p>
              <div className="flex-1 flex flex-col justify-around gap-10">
                {pairs.map((pair, pairIdx) => (
                  <div key={pairIdx} className="relative flex flex-col justify-between gap-6">
                    {pair.map((m) => {
                      const canRegister = player?.is_admin && m.player1_id && m.player2_id && m.player1_score === null
                      const isDecided = m.winner_id !== null
                      const notPlayedYet = m.player1_id && m.player2_id && m.player1_score === null
                      const odds = notPlayedYet ? eloWinProbability(m.player1!.rating, m.player2!.rating) : null
                      // Structurally known from bracket creation — not a guess — even before
                      // any real match decides who the actual lucky loser will be.
                      const hasPendingByeSlot =
                        round === 1
                          ? (m.player1_id === null) !== (m.player2_id === null)
                          : phantomBySlot.has(m.id)
                      return (
                        <div
                          key={m.id}
                          ref={(el) => {
                            if (el) matchCardRefs.current.set(m.id, el)
                            else matchCardRefs.current.delete(m.id)
                          }}
                          onClick={() => {
                            if (Date.now() < suppressClickUntil.current) return
                            if (isDecided) setViewing(m)
                          }}
                          className={`card ${cardPadClass} flex flex-col gap-2 min-h-[92px] ${isDecided ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''} ${
                            notPlayedYet ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''
                          }`}
                        >
                          {(m.is_lucky_loser || hasPendingByeSlot) && (
                            <span className="inline-flex items-center gap-1 self-start text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                              <Dices size={10} /> Lucky loser
                            </span>
                          )}
                          {[m.player1, m.player2].map((p, i) => {
                            const slotNum = (i + 1) as 1 | 2
                            const slotKey = `${m.id}::${slotNum}`
                            const score = i === 0 ? m.player1_score : m.player2_score
                            const isWinner = p && m.winner_id === p.id
                            const oddsPct = odds !== null ? Math.round((i === 0 ? odds : 1 - odds) * 100) : null
                            const seed = p ? seedByPlayer.get(p.id) : null
                            return (
                              <div
                                key={i}
                                data-slot-key={slotKey}
                                onPointerDown={(e) => handleSlotPointerDown(e, { matchId: m.id, slot: slotNum })}
                                onPointerMove={handleSlotPointerMove}
                                onPointerUp={handleSlotPointerUp}
                                onPointerCancel={() => {
                                  dragStartPos.current = null
                                  setDragSource(null)
                                  setDragOverKey(null)
                                }}
                                style={draggableRound ? { touchAction: 'none' } : undefined}
                                className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isWinner ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''} ${
                                  dragOverKey === slotKey ? 'ring-2 ring-brand-500' : ''
                                } ${draggableRound ? 'cursor-grab active:cursor-grabbing select-none' : ''}`}
                              >
                                {draggableRound && <GripVertical size={12} className="text-slate-300 dark:text-slate-600 shrink-0" />}
                                {p ? (
                                  <>
                                    {round === 1 && seed !== undefined && seed !== null && (
                                      <span className="text-[10px] text-slate-400 font-mono w-4 text-right shrink-0">{seed}</span>
                                    )}
                                    <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size={bracketAvatarSize} />
                                    <span className={`flex-1 ${nameTextClass} truncate ${isWinner ? 'font-bold' : ''}`}>{p.name}</span>
                                  </>
                                ) : (
                                  (() => {
                                    const isByeSlot = round === 1 || phantomBySlot.get(m.id) === slotNum
                                    return (
                                      <span
                                        className={`flex-1 ${nameTextClass} text-slate-400 italic`}
                                        title={
                                          isByeSlot
                                            ? 'Denne plassen fylles automatisk av beste taper (lucky loser) når de andre kampene i runden er avgjort'
                                            : 'Venter på at forrige runde avgjøres'
                                        }
                                      >
                                        {isByeSlot ? 'Lucky loser' : 'Venter på vinner'}
                                      </span>
                                    )
                                  })()
                                )}
                                {score !== null && <span className="font-mono text-sm">{score}</span>}
                                {oddsPct !== null && <span className="text-xs text-slate-400 font-mono">{oddsPct}%</span>}
                                {draggableRound && (
                                  <button
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSlotEditor({ matchId: m.id, slot: slotNum })
                                    }}
                                    className="btn-ghost p-1 shrink-0"
                                    title="Bytt ut eller fjern deltaker"
                                  >
                                    <UserCog size={14} />
                                  </button>
                                )}
                              </div>
                            )
                          })}
                          {canRegister && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openEdit(m)
                              }}
                              className="btn-secondary text-xs py-1.5"
                            >
                              Registrer resultat
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )
          })}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <div className="card w-full max-w-sm p-6 animate-pop-in max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Registrer resultat</h2>
              <button onClick={() => setEditing(null)} className="btn-ghost p-1.5">
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <label className="text-sm font-medium mb-1 block -mb-2">
                Settscore ({editing.player1?.name} vs. {editing.player2?.name})
              </label>
              <div className="flex flex-col gap-2">
                {sets.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-14 text-sm text-slate-500">Sett {i + 1}</span>
                    <input
                      type="number"
                      min={0}
                      value={s.player1_score}
                      onChange={(e) => updateSet(i, 'player1_score', e.target.value)}
                      className="input text-center"
                      placeholder={editing.player1?.name}
                    />
                    <span className="text-slate-400">–</span>
                    <input
                      type="number"
                      min={0}
                      value={s.player2_score}
                      onChange={(e) => updateSet(i, 'player2_score', e.target.value)}
                      className="input text-center"
                      placeholder={editing.player2?.name}
                    />
                    {sets.length > 1 && (
                      <button type="button" onClick={() => setSets((prev) => prev.filter((_, idx) => idx !== i))} className="btn-ghost p-2 text-rose-500">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSets((prev) => [...prev, { player1_score: '', player2_score: '' }])}
                  className="btn-secondary self-start"
                >
                  <Plus size={16} /> Legg til sett
                </button>
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Lagrer...' : 'Lagre resultat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {slotEditor && (() => {
        const match = matches.find((m) => m.id === slotEditor.matchId)
        const currentPlayer = match ? (slotEditor.slot === 1 ? match.player1 : match.player2) : null
        const available = allPlayers.filter((p) => !seatedPlayerIds.has(p.id) || p.id === currentPlayer?.id)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSlotEditor(null)}>
            <div className="card w-full max-w-xs p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Bytt deltaker</h2>
                <button onClick={() => setSlotEditor(null)} className="btn-ghost p-1.5">
                  <X size={18} />
                </button>
              </div>
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {currentPlayer && (
                  <button
                    onClick={() => handleSetSlot(slotEditor, null)}
                    className="btn-secondary text-sm justify-start text-rose-600"
                  >
                    Fjern {currentPlayer.name} (ledig plass)
                  </button>
                )}
                {available
                  .filter((p) => p.id !== currentPlayer?.id)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSetSlot(slotEditor, p.id)}
                      className="btn-secondary text-sm justify-start"
                    >
                      <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" /> {p.name}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )
      })()}

      {showAddParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAddParticipant(false)}>
          <div className="card w-full max-w-xs p-6 animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Legg til deltaker</h2>
              <button onClick={() => setShowAddParticipant(false)} className="btn-ghost p-1.5">
                <X size={18} />
              </button>
            </div>
            {unseatedPlayers.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Alle spillere er allerede med i turneringen.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {openRound1Slots.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ingen ledige plasser akkurat nå — turneringen bygges om for å ta inn spilleren. Dette går bare hvis ingen kamper er spilt ennå.
                  </p>
                )}
                {addParticipantError && <p className="text-sm text-rose-600">{addParticipantError}</p>}
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {unseatedPlayers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleAddParticipant(p.id)}
                      disabled={addingParticipant}
                      className="btn-secondary text-sm justify-start"
                    >
                      <PlayerAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" /> {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <TournamentMatchDetailModal
        match={viewing}
        sets={viewing ? matchSets.filter((s) => s.tournament_match_id === viewing.id) : []}
        roundLabel={viewing ? roundName(viewing.round, rounds.length) : ''}
        onClose={() => setViewing(null)}
      />
    </div>
  )
}
