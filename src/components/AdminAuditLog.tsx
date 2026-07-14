import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/date'
import type { AuditLogEntry } from '@/lib/types'

const TABLE_LABELS: Record<string, string> = {
  players: 'Spillere',
  matches: 'Kamper',
  match_sets: 'Sett',
  ratings_history: 'Rating-historikk',
  achievement_definitions: 'Achievement-definisjoner',
  player_achievements: 'Oppnådde achievements',
  seasons: 'Sesonger',
  season_standings: 'Sesong-plasseringer',
  tournaments: 'Turneringer',
  tournament_participants: 'Turneringsdeltakere',
  tournament_matches: 'Turneringskamper',
  roles: 'Roller',
  role_permissions: 'Rolletilganger',
  role_assignments: 'Rolletildelinger',
  card_layout_overrides: 'Kort-rekkefølge',
  card_title_overrides: 'Korttitler',
  push_subscriptions: 'Push-abonnementer',
}

const OP_STYLES: Record<string, string> = {
  INSERT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  UPDATE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  DELETE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
}

const OP_LABELS: Record<string, string> = { INSERT: 'Opprettet', UPDATE: 'Endret', DELETE: 'Slettet' }

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '–'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export function AdminAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tableFilter, setTableFilter] = useState('')
  const [opFilter, setOpFilter] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(300)
    if (tableFilter) query = query.eq('table_name', tableFilter)
    if (opFilter) query = query.eq('operation', opFilter)
    const { data } = await query.returns<AuditLogEntry[]>()
    setEntries(data ?? [])
    setLoading(false)
  }, [tableFilter, opFilter])

  useEffect(() => {
    load()
  }, [load])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={tableFilter} onChange={(e) => setTableFilter(e.target.value)} className="input w-auto text-sm">
          <option value="">Alle tabeller</option>
          {Object.entries(TABLE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select value={opFilter} onChange={(e) => setOpFilter(e.target.value)} className="input w-auto text-sm">
          <option value="">Alle handlinger</option>
          <option value="INSERT">Opprettet</option>
          <option value="UPDATE">Endret</option>
          <option value="DELETE">Slettet</option>
        </select>
        <button onClick={load} className="btn-ghost p-2" title="Oppdater">
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500">Laster...</p>
      ) : entries.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Ingen logg-oppføringer ennå.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((e) => {
            const isOpen = expanded.has(e.id)
            return (
              <div key={e.id} className="card">
                <button onClick={() => toggle(e.id)} className="w-full flex items-center gap-3 p-3 text-left">
                  {isOpen ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${OP_STYLES[e.operation]}`}>
                    {OP_LABELS[e.operation]}
                  </span>
                  <span className="text-sm font-medium shrink-0">{TABLE_LABELS[e.table_name] ?? e.table_name}</span>
                  {e.changed_fields && e.changed_fields.length > 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">({e.changed_fields.join(', ')})</span>
                  )}
                  <span className="text-xs text-slate-400 ml-auto shrink-0">{e.changed_by_name ?? 'System'}</span>
                  <span className="text-xs text-slate-400 shrink-0">{formatDateTime(e.created_at)}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-200 dark:border-slate-800 p-3 text-xs">
                    <p className="text-slate-500 dark:text-slate-400 mb-2">
                      Element-ID: <span className="font-mono">{e.record_id ?? '–'}</span>
                      {e.changed_by_email && <> · Utført av: {e.changed_by_email}</>}
                    </p>

                    {e.operation === 'UPDATE' && e.old_data && e.new_data && (
                      <table className="w-full">
                        <thead>
                          <tr className="text-slate-400">
                            <th className="text-left font-medium py-1">Felt</th>
                            <th className="text-left font-medium py-1">Før</th>
                            <th className="text-left font-medium py-1">Etter</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(e.changed_fields ?? Object.keys(e.new_data)).map((field) => (
                            <tr key={field} className="border-t border-slate-100 dark:border-slate-800">
                              <td className="py-1 pr-2 font-medium">{field}</td>
                              <td className="py-1 pr-2 text-rose-500 font-mono break-all">{formatValue(e.old_data?.[field])}</td>
                              <td className="py-1 text-emerald-600 font-mono break-all">{formatValue(e.new_data?.[field])}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {e.operation === 'INSERT' && e.new_data && (
                      <table className="w-full">
                        <tbody>
                          {Object.entries(e.new_data).map(([field, value]) => (
                            <tr key={field} className="border-t border-slate-100 dark:border-slate-800">
                              <td className="py-1 pr-2 font-medium">{field}</td>
                              <td className="py-1 font-mono break-all">{formatValue(value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {e.operation === 'DELETE' && e.old_data && (
                      <table className="w-full">
                        <tbody>
                          {Object.entries(e.old_data).map(([field, value]) => (
                            <tr key={field} className="border-t border-slate-100 dark:border-slate-800">
                              <td className="py-1 pr-2 font-medium">{field}</td>
                              <td className="py-1 font-mono break-all text-rose-500">{formatValue(value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
