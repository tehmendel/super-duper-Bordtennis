import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from '@/contexts/AuthContext'
import { LayoutEditProvider } from '@/contexts/LayoutEditContext'
import App from './App'
import './index.css'

// registerType is 'autoUpdate': as soon as a new service worker activates,
// this reloads the page once so nobody is stuck looking at a stale,
// precached build (this is what previously let old cached versions of the
// app — e.g. the old email-based login — flash briefly before the current
// one took over).
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <LayoutEditProvider>
          <App />
        </LayoutEditProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
