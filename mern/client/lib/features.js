import { Bell, CalendarDays, Home, Map, MessageCircle, Newspaper, PackageSearch, Tag, Wrench } from 'lucide-react';

/** Product areas. `phase` drives the "coming soon" state until each one ships. */
export const FEATURES = {
  feed: { label: 'Feed', icon: Newspaper, live: true, href: '/feed', phase: 2, blurb: 'Posts from neighbours within your radius: news, notices, questions and recommendations, newest and nearest first.' },
  map: { label: 'Map', icon: Map, live: true, href: '/map', phase: 2, blurb: 'Everything in your area on one map, with approximate pins that protect people’s privacy.' },
  marketplace: { label: 'Buy & sell', icon: Tag, live: true, href: '/marketplace', phase: 2, blurb: 'Sell, swap or give away things to people you can walk to. Photos, prices and in-app chat.' },
  services: { label: 'Services', icon: Wrench, live: true, href: '/services', phase: 2, blurb: 'Find electricians, tutors, cleaners and more, rated only by verified neighbours.' },
  'lost-found': { label: 'Lost & found', icon: PackageSearch, live: true, href: '/lost-found', phase: 2, blurb: 'Report something lost or found with a photo and a rough location; nearby neighbours get notified.' },
  events: { label: 'Events', icon: CalendarDays, live: true, href: '/events', phase: 2, blurb: 'Cleanups, gatherings and games near you, with RSVPs and reminders.' },
  messages: { label: 'Messages', icon: MessageCircle, live: true, href: '/messages', phase: 3, blurb: 'Real-time private chat with neighbours and service providers, without sharing your phone number.' },
  alerts: { label: 'Alerts', icon: Bell, live: true, href: '/alerts', phase: 3, blurb: 'Emergency alerts and notifications in real time, in the app and as push notifications.' },
};

export const NAV = [
  { href: '/home', label: 'Home', icon: Home },
  ...Object.entries(FEATURES).map(([key, f]) => ({ href: f.href ?? `/soon/${key}`, label: f.label, icon: f.icon, soon: !f.live })),
];
