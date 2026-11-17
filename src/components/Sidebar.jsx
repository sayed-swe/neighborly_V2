// Shared navigation config + brand mark (used by the header, left shortcuts,
// auth pages and the admin panel).
import { Link } from 'react-router-dom'
import {
  Bell, CalendarDays, HandHeart, Home, Map, MessageCircle, Newspaper, PackageSearch, Tag, Wrench,
} from 'lucide-react'

// colour = background of the round icon in the left shortcuts
export const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true, color: '#22774a' },
  { to: '/feed', label: 'Feed', icon: Newspaper, color: '#216fdb' },
  { to: '/map', label: 'Map', icon: Map, color: '#0f9d8a' },
  { to: '/marketplace', label: 'Buy & sell', icon: Tag, color: '#1b74e4' },
  { to: '/services', label: 'Services', icon: Wrench, color: '#7146c4' },
  { to: '/services?tab=help', label: 'Help requests', icon: HandHeart, color: '#e0663a', shortcutOnly: true },
  { to: '/lost-found', label: 'Lost & found', icon: PackageSearch, color: '#b26b00' },
  { to: '/events', label: 'Events', icon: CalendarDays, color: '#d93025' },
  { to: '/messages', label: 'Messages', icon: MessageCircle, count: 'messages', color: '#0a7cff' },
  { to: '/alerts', label: 'Alerts', icon: Bell, count: 'alerts', color: '#c2412d' },
]

// The five big icon tabs in the middle of the header
export const HEADER_TABS = ['/', '/map', '/marketplace', '/events', '/alerts']

export function Brand() {
  return (
    <Link to="/" className="brand">
      <div className="brand-mark"><span><Home size={20} strokeWidth={2.6} /></span></div>
      <div className="brand-name">Neighborly</div>
    </Link>
  )
}
