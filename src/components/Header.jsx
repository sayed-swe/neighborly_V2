import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, LogOut, MessageCircle, Moon, Settings as SettingsIcon, ShieldCheck, SquarePen, Sun, User } from 'lucide-react'
import { getConversations, getNotifications, markAllNotificationsRead, markNotificationRead } from '../lib/api'
import { timeAgo } from '../lib/format'
import { t } from '../lib/i18n'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { Avatar, Spinner } from './ui'

export const MAIN_NAV = [
  { to: '/', label: 'Home Feed', end: true },
  { to: '/services', label: 'Local Services' },
  { to: '/marketplace', label: 'Buy & Sell' },
  { to: '/lost-found', label: 'Lost & Found' },
  { to: '/events', label: 'Events' },
  { to: '/map', label: 'Map' },
]
const NOTIF_ICON = { emergency: '🚨', reaction: '👍', comment: '💬', share: '🔁', event: '📅', help_request: '🤝', service: '🛠️', message: '✉️', system: '📣', report: '🛡️' }

// One header for everyone: visitors get Login / Register, members get chats, notifications and their menu.
export default function Header({ counts = {}, refreshCounts }) {
  const { profile, isAdmin, signOut } = useAuth()
  const { resolved, setTheme, lang, setLang } = useSettings()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(null)
  const ref = useRef(null)
  const goingDark = resolved !== 'dark'   // the button shows the mode you will switch TO
  const ThemeIcon = goingDark ? Moon : Sun
  // Default is the device's mode. The button switches to the opposite mode; switching back to the
  // device's own mode returns to "follow the device" instead of pinning it.
  const toggleTheme = () => {
    const target = goingDark ? 'dark' : 'light'
    const device = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    setTheme(target === device ? 'system' : target)
  }

  useEffect(() => setOpen(null), [pathname])
  useEffect(() => {
    if (!open) return
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  const toggle = (name) => setOpen((o) => (o === name ? null : name))

  return (
    <header className="nb-header">
      <Link to="/" className="nb-brand"><b>Neighborly</b><span>Local Community Platform</span></Link>

      <nav className="nb-nav">
        {MAIN_NAV.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nb-link ${isActive ? 'active' : ''}`}>{t(label)}</NavLink>
        ))}
      </nav>

      <div className="nb-actions" ref={ref}>
        <button className="round-btn" onClick={() => setLang(lang === 'en' ? 'bn' : 'en')} title="Language / ভাষা" aria-label="Language" style={{ fontSize: 12.5, fontWeight: 800 }}>
          {lang === 'en' ? 'বাং' : 'EN'}
        </button>
        <button className="round-btn" onClick={toggleTheme} title={t(goingDark ? 'Switch to dark mode' : 'Switch to light mode')} aria-label={t(goingDark ? 'Switch to dark mode' : 'Switch to light mode')}>
          <ThemeIcon size={18} />
        </button>

        {!profile ? (
          <>
            <Link to="/login" className="btn btn-outline">Login</Link>
            <Link to="/signup" className="btn btn-primary">Register</Link>
          </>
        ) : (
          <>
            <div className="dropdown">
              <button className={`round-btn ${open === 'messages' ? 'on' : ''}`} onClick={() => toggle('messages')} aria-label="Messages" title="Messages">
                <MessageCircle size={19} />
                {counts.messages > 0 && <span className="dot-count">{counts.messages}</span>}
              </button>
              {open === 'messages' && <MessagesPanel me={profile.id} />}
            </div>
            <div className="dropdown">
              <button className={`round-btn ${open === 'notifications' ? 'on' : ''}`} onClick={() => toggle('notifications')} aria-label="Notifications" title="Notifications">
                <Bell size={19} />
                {counts.notifications > 0 && <span className="dot-count">{counts.notifications > 99 ? '99+' : counts.notifications}</span>}
              </button>
              {open === 'notifications' && <NotificationsPanel refreshCounts={refreshCounts} onNavigate={() => setOpen(null)} />}
            </div>
            <div className="dropdown">
              <button className="round-btn" onClick={() => toggle('account')} aria-label="Account" title="Account">
                <Avatar src={profile.avatar_url} name={profile.full_name} size={40} />
              </button>
              {open === 'account' && (
                <div className="panel" style={{ width: 300 }}>
                  <Link to={`/profile/${profile.username}`} className="panel-row">
                    <Avatar src={profile.avatar_url} name={profile.full_name} size={40} />
                    <div><div className="t bold">{profile.full_name}</div><div className="s">@{profile.username}</div></div>
                  </Link>
                  <div className="divider" />
                  <Link to={`/profile/${profile.username}`} className="panel-row"><User size={18} /><span className="t">My profile</span></Link>
                  <Link to="/alerts" className="panel-row"><Bell size={18} /><span className="t">Emergency alerts</span>{counts.alerts > 0 && <span className="nav-badge hot">{counts.alerts}</span>}</Link>
                  <Link to="/settings" className="panel-row"><SettingsIcon size={18} /><span className="t">Settings</span></Link>
                  {isAdmin && <Link to="/admin" className="panel-row"><ShieldCheck size={18} /><span className="t">Admin panel</span></Link>}
                  <button className="panel-row" onClick={signOut}><LogOut size={18} /><span className="t">Log out</span></button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  )
}

function MessagesPanel({ me }) {
  const [convos, setConvos] = useState(null)
  useEffect(() => { getConversations().then(setConvos).catch(() => setConvos([])) }, [])
  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Inbox</h3>
        <Link to="/messages" className="icon-btn ghost" title="New message"><SquarePen size={18} /></Link>
      </div>
      {convos === null ? <Spinner /> : convos.length === 0 ? <p className="muted" style={{ padding: 8 }}>No messages yet.</p> : convos.slice(0, 8).map((c) => (
        <Link key={c.conversation_id} to={`/messages/${c.conversation_id}`} className={`panel-row ${Number(c.unread_count) > 0 ? 'unread' : ''}`}>
          <Avatar src={c.other_avatar} name={c.other_name} size={48} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="t" style={{ fontWeight: Number(c.unread_count) > 0 ? 700 : 500 }}>{c.other_name}</div>
            <div className="s" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {c.last_sender_id === me ? `${t('You')}: ` : ''}{c.last_message || '👋'} · {timeAgo(c.last_message_at)}
            </div>
          </div>
          {Number(c.unread_count) > 0 && <span className="map-legend-dot" style={{ background: 'var(--green-700)', width: 12, height: 12 }} />}
        </Link>
      ))}
      <Link to="/messages" className="panel-foot">Open inbox</Link>
    </div>
  )
}

function NotificationsPanel({ refreshCounts, onNavigate }) {
  const navigate = useNavigate()
  const [items, setItems] = useState(null)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const load = () => getNotifications().then(setItems).catch(() => setItems([]))
  useEffect(() => { load() }, [])

  const openItem = async (n) => {
    if (!n.is_read) { await markNotificationRead(n.id).catch(() => {}); refreshCounts?.() }
    onNavigate()
    if (n.link) navigate(n.link)
  }
  const readAll = async () => { await markAllNotificationsRead().catch(() => {}); load(); refreshCounts?.() }
  const shown = (items || []).filter((n) => !unreadOnly || !n.is_read)

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>Notifications</h3>
        <button className="icon-btn ghost" onClick={readAll} title="Mark all as read"><CheckCheck size={18} /></button>
      </div>
      <div className="chips" style={{ padding: '4px 8px 8px' }}>
        <button className={`chip ${!unreadOnly ? 'active' : ''}`} onClick={() => setUnreadOnly(false)}>All</button>
        <button className={`chip ${unreadOnly ? 'active' : ''}`} onClick={() => setUnreadOnly(true)}>Unread</button>
      </div>
      {items === null ? <Spinner /> : shown.length === 0 ? <p className="muted" style={{ padding: 8 }}>You're all caught up.</p> : shown.slice(0, 15).map((n) => (
        <button key={n.id} className={`panel-row ${n.is_read ? '' : 'unread'}`} onClick={() => openItem(n)}>
          <div style={{ position: 'relative' }}>
            <Avatar src={n.actor?.avatar_url} name={n.actor?.full_name || 'Neighborly'} size={48} />
            <span style={{ position: 'absolute', right: -4, bottom: -2, fontSize: 16 }}>{NOTIF_ICON[n.type] || '🔔'}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div className="t" style={{ fontWeight: n.is_read ? 400 : 600 }}>{n.message}</div>
            <div className="s">{timeAgo(n.created_at)}</div>
          </div>
          {!n.is_read && <span className="map-legend-dot" style={{ background: 'var(--green-700)', width: 12, height: 12 }} />}
        </button>
      ))}
      <Link to="/alerts?tab=notifications" className="panel-foot">See all</Link>
    </div>
  )
}
