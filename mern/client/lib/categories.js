import { CalendarDays, HandHelping, Megaphone, Newspaper, PackageSearch, Tag } from 'lucide-react';

export const CATEGORIES = {
  general: { label: 'General', short: 'General', icon: Megaphone, badge: '', placeholder: 'Share something with your neighbours…' },
  news: { label: 'News & notices', short: 'News', icon: Newspaper, badge: 'badge-green', placeholder: 'What should your neighbours know?' },
  help: { label: 'Help request', short: 'Help', icon: HandHelping, badge: 'badge-brick', placeholder: 'What do you need help with?' },
  sale: { label: 'Buy & sell', short: 'For sale', icon: Tag, badge: 'badge-plum', placeholder: 'What are you selling or giving away?' },
  'lost-found': { label: 'Lost & found', short: 'Lost & found', icon: PackageSearch, badge: 'badge-sun', placeholder: 'What did you lose or find, and where?' },
  event: { label: 'Event', short: 'Event', icon: CalendarDays, badge: 'badge-sky', placeholder: 'What’s happening, when and where?' },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);

export const formatPrice = (p) => (p === 0 ? 'Free' : `৳${Number(p).toLocaleString('en-IN')}`);

export const REPORT_REASONS = [
  ['spam', 'Spam or advertising'],
  ['scam', 'Scam or fraud'],
  ['harassment', 'Harassment or bullying'],
  ['false-info', 'False information'],
  ['inappropriate', 'Inappropriate content'],
  ['other', 'Something else'],
];

export const LISTING_KINDS = [['sell', 'For sale'], ['wanted', 'Wanted'], ['exchange', 'Exchange'], ['free', 'Free']];
export const CONDITIONS = [['new', 'New'], ['like-new', 'Like new'], ['good', 'Good'], ['fair', 'Fair'], ['for-parts', 'For parts']];
export const LISTING_STATUS = { available: ['badge-green', 'Available'], reserved: ['badge-sun', 'Reserved'], sold: ['badge-danger', 'Sold'] };
export const label = (pairs, v) => pairs.find(([k]) => k === v)?.[1] ?? v;
export const REQUEST_STATUS = { pending: ['badge-sun', 'Pending'], accepted: ['badge-green', 'Accepted'], declined: ['badge-danger', 'Declined'], done: ['badge-sky', 'Done'], cancelled: ['', 'Cancelled'] };
export const SEVERITY = { low: ['badge-sky', 'Low'], medium: ['badge-sun', 'Medium'], high: ['badge-brick', 'High'], critical: ['badge-danger', 'Critical'] };

export function fmtWhen(start, end) {
  const s = new Date(start);
  const day = s.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const t = (d) => d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day} · ${t(s)}${end ? ` – ${t(new Date(end))}` : ''}`;
}
