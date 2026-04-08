import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/authStore'

import LoginPage from '@/pages/LoginPage'
import HomePage from '@/pages/HomePage'
import WritePage from '@/pages/WritePage'
import ImportPage from '@/pages/ImportPage'
import BiblePage from '@/pages/BiblePage'
import EntriesPage from '@/pages/EntriesPage'
import EntryDetailPage from '@/pages/EntryDetailPage'
import CampaignsPage from '@/pages/CampaignsPage'
import CampaignNewPage from '@/pages/CampaignNewPage'
import CampaignDetailPage from '@/pages/CampaignDetailPage'
import CampaignEditPage from '@/pages/CampaignEditPage'
import GroupsPage from '@/pages/GroupsPage'
import GroupDetailPage from '@/pages/GroupDetailPage'
import JoinPage from '@/pages/JoinPage'
import SettingsPage from '@/pages/SettingsPage'
import TemplatesPage from '@/pages/TemplatesPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  useAuth()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/join/:inviteCode" element={<JoinPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/write"
        element={
          <ProtectedRoute>
            <WritePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/write/:entryId"
        element={
          <ProtectedRoute>
            <WritePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/import"
        element={
          <ProtectedRoute>
            <ImportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bible"
        element={
          <ProtectedRoute>
            <BiblePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entries"
        element={
          <ProtectedRoute>
            <EntriesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entries/:entryId"
        element={
          <ProtectedRoute>
            <EntryDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns"
        element={
          <ProtectedRoute>
            <CampaignsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/new"
        element={
          <ProtectedRoute>
            <CampaignNewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/:campaignId"
        element={
          <ProtectedRoute>
            <CampaignDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/campaigns/:campaignId/edit"
        element={
          <ProtectedRoute>
            <CampaignEditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups"
        element={
          <ProtectedRoute>
            <GroupsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups/new"
        element={
          <ProtectedRoute>
            <GroupDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups/:id"
        element={
          <ProtectedRoute>
            <GroupDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/templates"
        element={
          <ProtectedRoute>
            <TemplatesPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
