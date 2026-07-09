import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/hooks/useTheme'
import { Layout } from '@/components/Layout'
import { RequireAccess } from '@/components/RequireAccess'
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
import { Players } from '@/pages/Players'
import { MorePage } from '@/pages/MorePage'
import { EditProfile } from '@/pages/EditProfile'
import { Admin } from '@/pages/Admin'
import { LadderHistory } from '@/pages/LadderHistory'
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
        <Route path="/" element={<RequireAccess page="dashboard"><Dashboard /></RequireAccess>} />
        <Route path="/matches/new" element={<RequireAccess page="new_match"><NewMatch /></RequireAccess>} />
        <Route path="/matches/pending" element={<RequireAccess page="pending"><PendingConfirmations /></RequireAccess>} />
        <Route path="/matches" element={<RequireAccess page="history"><MatchHistory /></RequireAccess>} />
        <Route path="/leaderboard" element={<RequireAccess page="leaderboard"><Leaderboard /></RequireAccess>} />
        <Route path="/players" element={<RequireAccess page="players"><Players /></RequireAccess>} />
        <Route path="/players/:id" element={<PlayerProfile />} />
        <Route path="/head-to-head" element={<RequireAccess page="head_to_head"><HeadToHead /></RequireAccess>} />
        <Route path="/qr" element={<RequireAccess page="qr"><QrCodePage /></RequireAccess>} />
        <Route path="/more" element={<MorePage />} />
        <Route path="/profile/edit" element={<RequireAccess page="profile_edit"><EditProfile /></RequireAccess>} />
        <Route
          path="/admin"
          element={
            player.is_admin ? <Admin /> : <p className="text-slate-500 dark:text-slate-400">Du har ikke tilgang til denne siden.</p>
          }
        />
        <Route path="/tournaments" element={<RequireAccess page="tournaments"><Tournaments /></RequireAccess>} />
        <Route path="/tournaments/new" element={<RequireAccess page="tournaments"><NewTournament /></RequireAccess>} />
        <Route path="/tournaments/:id" element={<RequireAccess page="tournaments"><TournamentDetail /></RequireAccess>} />
        <Route path="/stigespillet" element={<RequireAccess page="ladder"><LadderHistory /></RequireAccess>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
