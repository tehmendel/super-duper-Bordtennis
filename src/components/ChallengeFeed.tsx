import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Swords, X, Hourglass } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { PlayerAvatar } from '@/components/PlayerAvatar'
import type { Challenge, Player } from '@/lib/types'

interface Incoming extends Challenge {
  challenger: Player
}

interface Outgoing extends Challenge {
  challenged: Player
}

export function ChallengeFeed() {
  const { player } = useAuth()
  const [incoming, setIncoming] = useState<Incoming[]>([])
  const [outgoing, setOutgoing] = useState<Outgoing[]>([])

  useEffect(() => {
    if (!player) return
    let cancelled = false

    async function load() {
      const [{ data: inc }, { data: out }] = await Promise.all([
        supabase
          .from('challenges')
          .select('*, challenger:players!challenges_challenger_id_fkey(*)')
          .eq('challenged_id', player!.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('challenges')
          .select('*, challenged:players!challenges_challenged_id_fkey(*)')
          .eq('challenger_id', player!.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ])
      if (!cancelled) {
        setIncoming((inc as Incoming[]) ?? [])
        setOutgoing((out as Outgoing[]) ?? [])
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [player])

  async function dismiss(id: string) {
    setIncoming((prev) => prev.filter((c) => c.id !== id))
    await supabase.from('challenges').update({ status: 'dismissed' }).eq('id', id)
  }

  if (incoming.length === 0 && outgoing.length === 0) return null

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
        <Swords size={16} /> Utfordringer
      </h3>
      <div className="flex flex-col gap-3">
        {incoming.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <PlayerAvatar name={c.challenger.name} avatarUrl={c.challenger.avatar_url} size="sm" />
              <p className="text-sm truncate">
                <strong>{c.challenger.name}</strong> har utfordret deg!
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Link to="/matches/new" className="btn-primary py-1.5 px-3 text-xs">
                Registrer kamp
              </Link>
              <button onClick={() => dismiss(c.id)} className="btn-ghost p-1.5" title="Avvis">
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
        {outgoing.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Hourglass size={14} className="shrink-0" />
            <PlayerAvatar name={c.challenged.name} avatarUrl={c.challenged.avatar_url} size="sm" />
            <p className="truncate">
              Venter på svar fra <strong>{c.challenged.name}</strong>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
