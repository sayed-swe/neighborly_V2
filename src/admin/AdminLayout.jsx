import { useState, useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, CalendarDays, Flag, HandHeart, LayoutDashboard, ListTree, Menu, MessageSquare,
  Newspaper, PackageSearch, Tag, Users, Wrench,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Brand } from '../components/Sidebar'
import { Avatar } from '../components/ui'

export const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/reports', label: 'Reports', icon: Flag },
  { to: '/admin/users', label: 'Users', icon: Users },
  { section: 'Content' },
  { to: '/admin/posts', label: 'Posts', icon: Newspaper },
  { to: '/admin/comments', label: 'Comments', icon: MessageSquare },
  { to: '/admin/listings', label: 'Buy & sell', icon: Tag },
  { to: '/admin/lost_found', label: 'Lost & found', icon: PackageSearch },
  { to: '/admin/events', label: 'Events', icon: CalendarDays },
  { to: '/admin/services', label: 'Services', icon: Wrench },
  { to: '/admin/requests', label: 'Service requests', icon: HandHeart },
  { to: '/admin/help', label: 'Help requests', icon: HandHeart },
  { to: '/admin/alerts', label: 'Emergency alerts', icon: AlertTriangle },
  { section: 'Settings' },
  { to: '/admin/lookups', label: 'Neighborhoods & categories', icon: ListTree },
]

export default function AdminLayout() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])
  const current = ADMIN_NAV.find((n) => n.to && (n.end ? pathname === n.to : pathname.startsWith(n.to)))

  return (
    <div className="app-shell admin-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Brand />
        <div className="nav-label" style={{ marginTop: -8, marginBottom: 6 }}>Admin panel</div>
        <nav className="nav">
          {ADMIN_NAV.map((n, i) => n.section ? (
            <div key={i} className="nav-label" style={{ marginTop: 12 }}>{n.section}</div>
          ) : (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <n.icon size={20} strokeWidth={1.8} /> <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="nav-sep" />
          <Link to="/" className="nav-item"><ArrowLeft size={20} /> Back to Neighborly</Link>
        </div>
      </aside>
      <div className={`scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <div className="main-area">
        <header className="topbar">
          <button className="icon-btn ghost menu-toggle" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
          <h1>{current?.label || 'Admin'}</h1>
          <div className="topbar-actions">
            <span className="pill green">{profile.role}</span>
            <Avatar src={profile.avatar_url} name={profile.full_name} size={36} />
          </div>
        </header>
        <div className="page" style={{ maxWidth: 1320 }}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
