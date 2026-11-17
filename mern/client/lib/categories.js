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
