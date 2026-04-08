import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { TeamsPage } from './features/teams/TeamsPage'
import { TeamDetailPage } from './features/teams/TeamDetailPage'
import { MatchesPage } from './features/matches/MatchesPage'
import { MatchDetailPage } from './features/matches/MatchDetailPage'
import { EntryPage } from './features/entry/EntryPage'
import { PlayerDetailPage } from './features/players/PlayerDetailPage'
import { StatsPage } from './features/stats/StatsPage'
import { SeasonPage } from './features/seasons/SeasonPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { RecapPage } from './features/matches/RecapPage'
import { LoginPage } from './features/auth/LoginPage'
import { ProposalsPage } from './features/proposals/ProposalsPage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'teams', element: <TeamsPage /> },
      { path: 'teams/:teamId', element: <TeamDetailPage /> },
      { path: 'matches', element: <MatchesPage /> },
      { path: 'matches/:matchId', element: <MatchDetailPage /> },
      { path: 'matches/:matchId/recap', element: <RecapPage /> },
      { path: 'matches/:matchId/enter/:setId', element: <EntryPage /> },
      { path: 'players/:playerId', element: <PlayerDetailPage /> },
      { path: 'teams/:teamId/seasons/:seasonId', element: <SeasonPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'admin/proposals', element: <ProposalsPage /> },
    ],
  },
])
