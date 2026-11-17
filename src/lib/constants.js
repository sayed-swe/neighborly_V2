export const REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'care', emoji: '🥰', label: 'Care' },
  { type: 'haha', emoji: '😆', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'angry', emoji: '😡', label: 'Angry' },
]
export const reactionOf = (type) => REACTIONS.find((r) => r.type === type) || REACTIONS[0]

export const HELP_TYPES = ['medical', 'grocery', 'repair', 'transport', 'childcare', 'elderly_care', 'other']
export const LISTING_TYPES = ['sell', 'buy', 'exchange', 'free']
export const CONDITIONS = ['new', 'like_new', 'used', 'for_parts']
export const LISTING_CATEGORIES = ['Electronics', 'Furniture', 'Vehicles', 'Books', 'Clothing', 'Home & Kitchen', 'Kids', 'Sports', 'Other']
export const SEVERITIES = ['low', 'medium', 'high', 'critical']
export const REPORT_REASONS = ['spam', 'abuse', 'inappropriate', 'scam', 'false_info', 'harassment', 'other']

export const SEVERITY_PILL = { low: 'blue', medium: 'amber', high: 'red', critical: 'dark' }
export const STATUS_PILL = {
  published: 'green', hidden: 'amber', deleted: 'red', visible: 'green',
  active: 'green', suspended: 'amber', banned: 'red',
  available: 'green', reserved: 'amber', sold: 'dark', closed: 'dark',
  open: 'green', in_progress: 'blue', resolved: 'dark', expired: 'dark',
  upcoming: 'green', ongoing: 'blue', completed: 'dark', cancelled: 'red',
  pending: 'amber', under_review: 'blue', dismissed: 'dark', accepted: 'green', declined: 'red',
}

// Map marker colours per content kind
export const MAP_KINDS = {
  post: { label: 'Posts', color: '#2f5d45' },
  alert: { label: 'Alerts', color: '#c2412d' },
  help: { label: 'Help needed', color: '#e0663a' },
  lost_found: { label: 'Lost & found', color: '#6b4fa0' },
  listing: { label: 'Buy & sell', color: '#2f6db5' },
  event: { label: 'Events', color: '#b7791f' },
  service: { label: 'Services', color: '#3d7457' },
  neighbor: { label: 'Neighbors', color: '#0f766e' },
}

export const kindLink = (kind, id) => ({
  post: `/post/${id}`,
  listing: `/marketplace?item=${id}`,
  lost_found: `/lost-found?item=${id}`,
  event: `/events?item=${id}`,
  help: `/services?tab=help&item=${id}`,
  alert: '/alerts',
  service: `/services?item=${id}`,
  neighbor: `/profile/${id}`,
}[kind] || '/')
