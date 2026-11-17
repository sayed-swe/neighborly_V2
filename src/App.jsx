import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import AppLayout from './components/AppLayout'
import Header from './components/Header'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import MapPage from './pages/MapPage'
import Marketplace from './pages/Marketplace'
import Services from './pages/Services'
import LostFound from './pages/LostFound'
import Events from './pages/Events'
import Messages from './pages/Messages'
import Alerts from './pages/Alerts'
import Profile from './pages/Profile'
import PostPage from './pages/PostPage'
import Blocked from './pages/Blocked'
import Settings from './pages/Settings'
import AdminLayout from './admin/AdminLayout'
import AdminDashboard from './admin/AdminDashboard'
import AdminUsers from './admin/AdminUsers'
import AdminReports from './admin/AdminReports'
import AdminTablePage from './admin/AdminTablePage'
import AdminLookups from './admin/AdminLookups'

function FullLoader() {
  return <div className="center-load" style={{ minHeight: '100vh' }}><Loader2 className="spinner" size={28} /></div>
}

// Login and sign-up share the same top bar as the rest of the site
function PublicLayout({ children }) {
  return <div className="app-shell"><Header /><div className="app-body">{children}</div></div>
}

function RequireAuth({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (!profile) return <FullLoader />
  if (profile.status !== 'active') return <Blocked status={profile.status} />
  return children
}

function RequireAdmin({ children }) {
  const { isAdmin } = useAuth()
  return isAdmin ? children : <Navigate to="/" replace />
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <FullLoader />

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <PublicLayout><Login /></PublicLayout>} />
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <PublicLayout><Signup /></PublicLayout>} />

      <Route path="/admin" element={<RequireAuth><RequireAdmin><AdminLayout /></RequireAdmin></RequireAuth>}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="lookups" element={<AdminLookups />} />
        <Route path=":table" element={<AdminTablePage />} />
      </Route>

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Home />} />
        <Route path="feed" element={<Navigate to="/" replace />} />
        <Route path="settings" element={<Settings />} />
        <Route path="map" element={<MapPage />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="services" element={<Services />} />
        <Route path="lost-found" element={<LostFound />} />
        <Route path="events" element={<Events />} />
        <Route path="messages" element={<Messages />} />
        <Route path="messages/:id" element={<Messages />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="profile/:username" element={<Profile />} />
        <Route path="post/:id" element={<PostPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
