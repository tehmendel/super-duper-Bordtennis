import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/hooks/useTheme'
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
import { InvitePlayer } from '@/pages/InvitePlayer'
import { MorePage } from '@/pages/MorePage'
import { EditProfile } from '@/pages/EditProfile'
import { Admin } from '@/pages/Admin'
import { Seasons } from '@/pages/Seasons'
import { Tournaments } from '@/pages/Tournaments'
import { NewTournament } from '@/pages/NewTournament'
import { TournamentDetail } from '@/pages/TournamentDetail'

function FullScreenSpinner() {
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  const { session, player, loading } = useAuth()
  useTheme()

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
        <Route path="/invite" element={<InvitePlayer />} />
        <Route path="/more" element={<MorePage />} />
        <Route path="/profile/edit" element={<EditProfile />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/seasons" element={<Seasons />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/tournaments/new" element={<NewTournament />} />
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
