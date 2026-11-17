import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, CalendarDays, Flag, HandHeart, Heart, MessageCircle, MessageSquare, Newspaper, PackageSearch,
  Repeat2, Tag, Users, Wrench,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { adminStats } from '../lib/api'
import { labelize, timeAgo } from '../lib/format'
import { Avatar, Spinner, StatusPill } from '../components/ui'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [reports, setReports] = useState([])
  const [posts, setPosts] = useState([])

  useEffect(() => {
    adminStats().then(setStats).catch((e) => setError(e.message))
    supabase.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(full_name)').in('status', ['pending', 'under_review'])
      .order('created_at', { ascending: false }).limit(6).then(({ data }) => setReports(data || []))
    supabase.from('feed_posts').select('id, body, title, author_name, author_avatar, created_at, reaction_count, comment_count, status')
      .order('created_at', { ascending: false }).limit(6).then(({ data }) => setPosts(data || []))
  }, [])

  if (error) return <div className="error-text">{error}</div>
  if (!stats) return <Spinner />

  const cards = [
    { label: 'Users', value: stats.users, foot: `${stats.banned_users} suspended / banned`, icon: Users, to: '/admin/users' },
    { label: 'Pending reports', value: stats.reports_pending, foot: 'Need a moderator', icon: Flag, to: '/admin/reports', hot: stats.reports_pending > 0 },
    { label: 'Posts', value: stats.posts, foot: `${stats.hidden_posts} hidden`, icon: Newspaper, to: '/admin/posts' },
    { label: 'Comments', value: stats.comments, icon: MessageSquare, to: '/admin/comments' },
    { label: 'Reactions', value: stats.reactions, icon: Heart },
    { label: 'Shares', value: stats.shares, icon: Repeat2 },
    { label: 'Listings', value: stats.listings, icon: Tag, to: '/admin/listings' },
    { label: 'Lost & found', value: stats.lost_found, icon: PackageSearch, to: '/admin/lost_found' },
    { label: 'Events', value: stats.events, icon: CalendarDays, to: '/admin/events' },
    { label: 'Services', value: stats.services, icon: Wrench, to: '/admin/services' },
    { label: 'Help requests', value: stats.help_requests, icon: HandHeart, to: '/admin/help' },
    { label: 'Active alerts', value: stats.alerts_active, icon: AlertTriangle, to: '/admin/alerts' },
    { label: 'Messages sent', value: stats.messages, icon: MessageCircle },
  ]

  return (
    <>
      <div className="page-head"><div><h2>Overview</h2><p>Everything happening on Neighborly across {stats.neighborhoods} neighborhoods.</p></div></div>
      <div className="stat-grid">
        {cards.map((c) => {
          const Inner = (
            <div className="card stat" style={c.hot ? { borderColor: 'var(--accent)' } : undefined}>
              <div className="label"><c.icon size={16} /> {c.label}</div>
              <div className="value">{Number(c.value).toLocaleString()}</div>
              {c.foot && <div className="foot">{c.foot}</div>}
            </div>
          )
          return c.to ? <Link key={c.label} to={c.to}>{Inner}</Link> : <div key={c.label}>{Inner}</div>
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 16 }}>
        <BarChart title="New posts · last 14 days" rows={stats.posts_by_day} valueKey="posts" unit="posts" />
        <BarChart title="New members · last 14 days" rows={stats.signups_by_day} valueKey="users" unit="sign-ups" />
        <div className="card card-pad">
          <div className="card-title mb-12">Members by neighborhood</div>
          {stats.users_by_neighborhood.map((r) => {
            const max = Math.max(...stats.users_by_neighborhood.map((x) => x.users), 1)
            return (
              <div key={r.name} className="hbar">
                <span className="name" title={r.name}>{r.name}</span>
                <span className="track"><span className="fill" style={{ width: `${(r.users / max) * 100}%`, display: 'block' }} /></span>
                <span className="num">{r.users}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
        <div className="card card-pad">
          <div className="card-head"><div className="card-title"><Flag size={18} /> Reports waiting</div><Link to="/admin/reports">Open queue</Link></div>
          {reports.length === 0 ? <p className="muted small">Queue is empty 🎉</p> : (
            <div className="mini-list">
              {reports.map((r) => (
                <Link key={r.id} to="/admin/reports" className="mini-item">
                  <div className="icon-tile" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}><Flag size={18} /></div>
                  <div style={{ flex: 1 }}>
                    <div className="t">{labelize(r.reason)} · {labelize(r.target_type)} #{String(r.target_id).slice(0, 8)}</div>
                    <div className="s">by {r.reporter?.full_name} · {timeAgo(r.created_at)}</div>
                  </div>
                  <StatusPill value={r.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="card card-pad">
          <div className="card-head"><div className="card-title"><Newspaper size={18} /> Latest posts</div><Link to="/admin/posts">All posts</Link></div>
          <div className="mini-list">
            {posts.map((p) => (
              <Link key={p.id} to={`/post/${p.id}`} className="mini-item">
                <Avatar src={p.author_avatar} name={p.author_name} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t clamp-2">{p.title || p.body || '(shared post)'}</div>
                  <div className="s">{p.author_name} · {timeAgo(p.created_at)} · {p.reaction_count} reactions · {p.comment_count} comments</div>
                </div>
                <StatusPill value={p.status} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function BarChart({ title, rows = [], valueKey, unit }) {
  const max = Math.max(...rows.map((r) => r[valueKey]), 1)
  const total = rows.reduce((s, r) => s + r[valueKey], 0)
  const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return (
    <div className="card card-pad">
      <div className="card-head"><div className="card-title">{title}</div><span className="bold">{total}</span></div>
      <div className="bars" role="img" aria-label={`${title}: ${total} total`}>
        {rows.map((r) => (
          <div key={r.day} className="bar-col">
            <span className="tip">{fmt(r.day)}: {r[valueKey]} {unit}</span>
            <div className="bar" style={{ height: `${(r[valueKey] / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="chart-axis"><span>{rows[0] && fmt(rows[0].day)}</span><span>Today</span></div>
    </div>
  )
}
