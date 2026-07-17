import { useEffect, useState } from 'react'

// Persists the chosen page size per list (keyed) so it's remembered across
// visits, mirroring the localStorage pattern used by useTheme.
export function usePageSize(key: string, defaultSize = 50) {
  const storageKey = `pageSize:${key}`
  const [pageSize, setPageSize] = useState<number>(() => {
    const stored = localStorage.getItem(storageKey)
    const parsed = stored ? Number(stored) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultSize
  })

  useEffect(() => {
    localStorage.setItem(storageKey, String(pageSize))
  }, [pageSize, storageKey])

  return [pageSize, setPageSize] as const
}
