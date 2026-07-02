import { createContext, useContext, useState, type ReactNode } from 'react'

interface LayoutEditContextValue {
  editMode: boolean
  toggle: () => void
}

const LayoutEditContext = createContext<LayoutEditContextValue | undefined>(undefined)

export function LayoutEditProvider({ children }: { children: ReactNode }) {
  const [editMode, setEditMode] = useState(false)
  return (
    <LayoutEditContext.Provider value={{ editMode, toggle: () => setEditMode((v) => !v) }}>
      {children}
    </LayoutEditContext.Provider>
  )
}

export function useLayoutEdit() {
  const ctx = useContext(LayoutEditContext)
  if (!ctx) throw new Error('useLayoutEdit must be used within LayoutEditProvider')
  return ctx
}
