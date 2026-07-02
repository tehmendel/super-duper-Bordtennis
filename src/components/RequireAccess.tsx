import type { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { PageKey } from '@/lib/types'

export function RequireAccess({ page, children }: { page: PageKey; children: ReactNode }) {
  const { hasAccess } = useAuth()
  if (!hasAccess(page)) {
    return <p className="text-slate-500 dark:text-slate-400">Du har ikke tilgang til denne siden.</p>
  }
  return <>{children}</>
}
