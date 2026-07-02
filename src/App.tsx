import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Layout } from '@/components/Layout'
import { Login } from '@/pages/Login'
import { Onboarding } from '@/pages/Onboarding'
import { Dashboard } from '@/pages/Dashboard'
import { NewMatch } from '@/pages/NewMatch'
import { PendingConfirmations } from '@/pages/PendingConfirmations'
import { MatchHistory } from '@/pages/MatchHistory'
import { Leaderboard } from '@/pages/Leaderboard'
import { PlayerProfile } from '@/pages/PlayerProfile'
import { HeadToHead } from '@/pages/HeadToHead'
import { QrCodePage } from '@/pages/QrCodePage'

function FullScreenSpinner() {
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  const { session, player, loading } = useAuth()

  if (loading) return <FullScreenSpinner />
  if (!session) return <Routes><Route path="*" element={<Login />} /></Routes>
  if (!player) return <Routes><Route path="*" element={<Onboarding />} /></Routes>

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/matches/new" element={<NewMatch />} />
        <Route path="/matches/pending" element={<PendingConfirmations />} />
        <Route path="/matches" element={<MatchHistory />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/players/:id" element={<PlayerProfile />} />
        <Route path="/head-to-head" element={<HeadToHead />} />
        <Route path="/qr" element={<QrCodePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
