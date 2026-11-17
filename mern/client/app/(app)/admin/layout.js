'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, BarChart3, Flag, MessageSquare, Newspaper, ShieldAlert, Users, Wrench } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { can, ROLE_LABELS } from '@/lib/permissions';

const TABS = [
  { href: '/admin', label: 'Overview', icon: BarChart3, perm: 'admin:dashboard', exact: true },
  { href: '/admin/users', label: 'Members', icon: Users, perm: 'users:read' },
  { href: '/admin/posts', label: 'Posts', icon: Newspaper, perm: 'content:moderate' },
  { href: '/admin/comments', label: 'Comments', icon: MessageSquare, perm: 'content:moderate' },
  { href: '/admin/services', label: 'Services', icon: Wrench, perm: 'content:moderate' },
  { href: '/admin/reports', label: 'Reports', icon: Flag, perm: 'content:moderate', badge: true },
  { href: '/admin/activity', label: 'Activity log', icon: Activity, perm: 'audit:read' },
];

export default function AdminLayout({ children }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(0);
  const allowed = can(user, 'users:read');

  useEffect(() => {
    if (!can(user, 'content:moderate')) return;
    api.get('/admin/reports', { params: { status: 'open', limit: 1 } }).then(({ data }) => setOpen(data.openCount)).catch(() => {});
  }, [user, pathname]);

  if (!allowed) {
    return (
      <div className="empty-state card card-pad">
        <ShieldAlert size={30} />
        <h1>You don’t have access to this page</h1>
        <p className="muted">Admin tools are only available to moderators and admins.</p>
        <Link href="/home" className="btn btn-primary">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="admin">
      <header className="admin-head">
        <div><p className="eyebrow">{ROLE_LABELS[user.role]} console</p><h1>Community admin</h1></div>
      </header>
      <nav className="admin-tabs" aria-label="Admin sections">
        {TABS.filter((t) => can(user, t.perm)).map(({ href, label, icon: Icon, exact, badge }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined}>
              <Icon size={17} /> {label}
              {badge && open > 0 && <span className="admin-badge" aria-label={`${open} open reports`}>{open}</span>}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
