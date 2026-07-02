import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLayoutEdit } from '@/contexts/LayoutEditContext'

export interface CardDef {
  id: string
  title: string
}

export function useCardLayout(pageKey: string, defs: CardDef[]) {
  const { editMode } = useLayoutEdit()
  const [positions, setPositions] = useState<Record<string, number>>({})
  const [titles, setTitles] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const [{ data: pos }, { data: tit }] = await Promise.all([
      supabase.from('card_layout_overrides').select('*').eq('page_key', pageKey),
      supabase.from('card_title_overrides').select('*').eq('page_key', pageKey),
    ])
    setPositions(Object.fromEntries((pos ?? []).map((p) => [p.card_id, p.position])))
    setTitles(Object.fromEntries((tit ?? []).map((t) => [t.card_id, t.title])))
  }, [pageKey])

  useEffect(() => {
    load()
  }, [load])

  const orderedIds = useMemo(() => {
    return [...defs]
      .map((d, i) => ({ id: d.id, pos: positions[d.id] ?? i }))
      .sort((a, b) => a.pos - b.pos)
      .map((d) => d.id)
  }, [defs, positions])

  function getTitle(id: string) {
    return titles[id] ?? defs.find((d) => d.id === id)?.title ?? ''
  }

  async function setTitle(id: string, title: string) {
    setTitles((prev) => ({ ...prev, [id]: title }))
    await supabase.rpc('set_card_title', { p_page_key: pageKey, p_card_id: id, p_title: title })
  }

  async function move(id: string, direction: -1 | 1) {
    const idx = orderedIds.indexOf(id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= orderedIds.length) return
    const otherId = orderedIds[swapIdx]
    const idPos = positions[id] ?? idx
    const otherPos = positions[otherId] ?? swapIdx
    setPositions((prev) => ({ ...prev, [id]: otherPos, [otherId]: idPos }))
    await Promise.all([
      supabase.rpc('set_card_position', { p_page_key: pageKey, p_card_id: id, p_position: otherPos }),
      supabase.rpc('set_card_position', { p_page_key: pageKey, p_card_id: otherId, p_position: idPos }),
    ])
  }

  return {
    editMode,
    orderedIds,
    getTitle,
    setTitle,
    moveUp: (id: string) => move(id, -1),
    moveDown: (id: string) => move(id, 1),
  }
}

export type CardLayout = ReturnType<typeof useCardLayout>
