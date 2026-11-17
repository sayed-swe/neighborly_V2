// Config for every content table in the admin panel.
// Each entry drives the generic AdminTablePage (search, filter, paging, status change, delete).
import { Link } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import { formatDateTime, formatPrice, labelize, timeAgo } from '../lib/format'
import { Avatar } from '../components/ui'
import { SEVERITY_PILL } from '../lib/constants'

const person = (p) => p ? (
  <Link to={`/profile/${p.username}`} className="flex items-center gap-8" style={{ minWidth: 0 }}>
    <Avatar src={p.avatar_url} name={p.full_name} size={28} />
    <span className="cell-main" style={{ fontWeight: 500 }}>{p.full_name}</span>
  </Link>
) : '—'
const when = (d) => <span title={formatDateTime(d)} className="muted small">{timeAgo(d)}</span>
const main = (title, sub) => (<><div className="cell-main" title={title}>{title}</div>{sub && <div className="cell-sub" title={sub}>{sub}</div>}</>)
const P = 'id, full_name, username, avatar_url'

export const ADMIN_TABLES = {
  posts: {
    title: 'Posts', table: 'posts', reportType: 'post',
    select: `id, title, body, image_url, post_type, status, created_at, shared_post_id, author:profiles(${P}), neighborhood:neighborhoods(name), category:post_categories(name), reactions(count), comments(count)`,
    search: ['body', 'title'],
    statusField: 'status', statuses: ['published', 'hidden', 'deleted'],
    filters: [{ field: 'post_type', label: 'Type', options: ['post', 'announcement'] }],
    link: (r) => `/post/${r.id}`,
    columns: [
      { label: 'Post', render: (r) => main(r.title || r.body || (r.shared_post_id ? '↪ Shared post' : '(photo)'), [r.category?.name, r.neighborhood?.name].filter(Boolean).join(' · ')) },
      { label: 'Author', render: (r) => person(r.author) },
      { label: 'Type', render: (r) => r.post_type === 'announcement' ? <span className="pill amber">Announcement</span> : <span className="pill">Post</span> },
      { label: 'Engagement', render: (r) => <span className="small">👍 {r.reactions?.[0]?.count ?? 0} · 💬 {r.comments?.[0]?.count ?? 0}</span> },
      { label: 'Created', render: (r) => when(r.created_at) },
    ],
  },
  comments: {
    title: 'Comments', table: 'comments', reportType: 'comment',
    select: `id, content, status, created_at, post_id, listing_id, event_id, lost_found_id, help_request_id, parent_id, author:profiles(${P})`,
    search: ['content'],
    statusField: 'status', statuses: ['visible', 'hidden', 'deleted'],
    link: (r) => r.post_id ? `/post/${r.post_id}` : r.listing_id ? `/marketplace?item=${r.listing_id}` : r.event_id ? `/events?item=${r.event_id}` : r.lost_found_id ? `/lost-found?item=${r.lost_found_id}` : null,
    columns: [
      { label: 'Comment', render: (r) => main(r.content, r.parent_id ? 'Reply' : null) },
      { label: 'Author', render: (r) => person(r.author) },
      { label: 'On', render: (r) => <span className="small">{r.post_id ? `Post #${r.post_id}` : r.listing_id ? `Listing #${r.listing_id}` : r.event_id ? `Event #${r.event_id}` : r.lost_found_id ? `Lost & found #${r.lost_found_id}` : `Help #${r.help_request_id}`}</span> },
      { label: 'Created', render: (r) => when(r.created_at) },
    ],
  },
  listings: {
    title: 'Buy & sell listings', table: 'marketplace_listings', reportType: 'listing',
    select: `*, author:profiles(${P}), neighborhood:neighborhoods(name)`,
    search: ['title', 'description'],
    statusField: 'status', statuses: ['available', 'reserved', 'sold', 'closed'],
    filters: [{ field: 'listing_type', label: 'Type', options: ['sell', 'buy', 'exchange', 'free'] }],
    link: (r) => `/marketplace?item=${r.id}`,
    columns: [
      { label: 'Item', render: (r) => (
        <div className="flex items-center gap-8">
          {r.image_url ? <img src={r.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} /> : null}
          <div style={{ minWidth: 0 }}>{main(r.title, [r.category, r.neighborhood?.name].filter(Boolean).join(' · '))}</div>
        </div>
      ) },
      { label: 'Price', render: (r) => <b>{formatPrice(r.price, r.listing_type)}</b> },
      { label: 'Seller', render: (r) => person(r.author) },
      { label: 'Type', render: (r) => <span className="pill">{labelize(r.listing_type)}</span> },
      { label: 'Created', render: (r) => when(r.created_at) },
    ],
  },
  lost_found: {
    title: 'Lost & found', table: 'lost_found_items', reportType: 'lost_found',
    select: `*, author:profiles(${P})`,
    search: ['item_name', 'description', 'location'],
    statusField: 'status', statuses: ['open', 'resolved'],
    filters: [{ field: 'report_type', label: 'Type', options: ['lost', 'found'] }],
    link: (r) => `/lost-found?item=${r.id}`,
    columns: [
      { label: 'Item', render: (r) => main(r.item_name, r.location) },
      { label: 'Type', render: (r) => <span className={`pill ${r.report_type === 'lost' ? 'red' : 'green'}`}>{labelize(r.report_type)}</span> },
      { label: 'Reported by', render: (r) => person(r.author) },
      { label: 'Created', render: (r) => when(r.created_at) },
    ],
  },
  events: {
    title: 'Events', table: 'events',
    select: `*, creator:profiles(${P}), event_participants(count)`,
    search: ['title', 'description', 'location'],
    statusField: 'status', statuses: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    link: (r) => `/events?item=${r.id}`,
    columns: [
      { label: 'Event', render: (r) => main(r.title, r.location) },
      { label: 'When', render: (r) => <span className="small">{formatDateTime(r.starts_at)}</span> },
      { label: 'RSVPs', render: (r) => r.event_participants?.[0]?.count ?? 0 },
      { label: 'Host', render: (r) => person(r.creator) },
    ],
  },
  services: {
    title: 'Local services', table: 'services', reportType: 'service',
    select: `*, provider:profiles(${P}), category:service_categories(name)`,
    search: ['service_name', 'description'],
    toggles: [{ field: 'is_verified', label: 'Verified' }, { field: 'is_active', label: 'Active' }],
    link: (r) => `/services?item=${r.id}`,
    columns: [
      { label: 'Service', render: (r) => main(<>{r.service_name} {r.is_verified && <BadgeCheck size={14} color="var(--green-700)" />}</>, r.category?.name) },
      { label: 'Provider', render: (r) => person(r.provider) },
      { label: 'Phone', render: (r) => <span className="small">{r.contact_phone}</span> },
      { label: 'Price', render: (r) => <span className="small">{r.price_info || '—'}</span> },
      { label: 'Created', render: (r) => when(r.created_at) },
    ],
  },
  help: {
    title: 'Help requests', table: 'help_requests',
    select: `*, author:profiles(${P}), help_responses(count)`,
    search: ['title', 'details'],
    statusField: 'status', statuses: ['open', 'in_progress', 'resolved', 'closed'],
    filters: [{ field: 'help_type', label: 'Type', options: ['medical', 'grocery', 'repair', 'transport', 'childcare', 'elderly_care', 'other'] }],
    link: (r) => `/services?tab=help&item=${r.id}`,
    columns: [
      { label: 'Request', render: (r) => main(r.title, r.details) },
      { label: 'Type', render: (r) => <span className="pill amber">{labelize(r.help_type)}</span> },
      { label: 'Offers', render: (r) => r.help_responses?.[0]?.count ?? 0 },
      { label: 'Asked by', render: (r) => person(r.author) },
      { label: 'Created', render: (r) => when(r.created_at) },
    ],
  },
  requests: {
    title: 'Service requests', table: 'service_requests',
    select: `*, service:services(service_name), requester:profiles!service_requests_requester_id_fkey(${P}), provider:profiles!service_requests_provider_id_fkey(${P})`,
    search: ['details'],
    statusField: 'status', statuses: ['pending', 'accepted', 'declined', 'completed', 'cancelled'],
    columns: [
      { label: 'Request', render: (r) => main(r.service?.service_name, r.details) },
      { label: 'Requested by', render: (r) => person(r.requester) },
      { label: 'Provider', render: (r) => person(r.provider) },
      { label: 'Phone', render: (r) => <span className="small">{r.contact_phone || '—'}</span> },
      { label: 'Created', render: (r) => when(r.created_at) },
    ],
  },
  alerts: {
    title: 'Emergency alerts', table: 'emergency_alerts', canCreateAlert: true,
    select: `*, author:profiles(${P}), neighborhood:neighborhoods(name)`,
    search: ['title', 'message'],
    statusField: 'status', statuses: ['active', 'resolved', 'expired'],
    filters: [{ field: 'severity', label: 'Severity', options: ['low', 'medium', 'high', 'critical'] }],
    link: () => '/alerts',
    columns: [
      { label: 'Alert', render: (r) => main(r.title, r.message) },
      { label: 'Severity', render: (r) => <span className={`pill ${SEVERITY_PILL[r.severity]}`}>{labelize(r.severity)}</span> },
      { label: 'Area', render: (r) => <span className="small">{r.neighborhood?.name || 'All'}</span> },
      { label: 'Raised by', render: (r) => person(r.author) },
      { label: 'Created', render: (r) => when(r.created_at) },
    ],
  },
}
