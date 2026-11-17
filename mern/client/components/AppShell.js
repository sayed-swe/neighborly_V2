'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, LogOut, MapPin, Settings, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';
import { can, ROLE_LABELS } from '@/lib/permissions';
import { NAV } from '@/lib/features';
import Logo from './Logo';
import { Avatar } from './ui';

function NavLink({ href, label, icon: Icon, soon, active }) {
  return (
    <Link href={href} className={`side-link ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
      <Icon size={19} />
      <span>{label}</span>
      {soon && <span className="side-soon">Soon</span>}
    </Link>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, []);
  return (
    <div className="user-menu" ref={ref}>
      <button className="user-menu-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Avatar user={user} size={34} />
        <span className="user-menu-name">{user.name.split(' ')[0]}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="user-menu-pop card" role="menu">
          <div className="user-menu-head">
            <strong>{user.name}</strong>
            <span className="tiny muted">{user.email}</span>
            <span className="badge badge-green" style={{ marginTop: 6 }}>{ROLE_LABELS[user.role]}</span>
          </div>
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)}><Settings size={17} /> Settings</Link>
          {can(user, 'users:read') && <Link role="menuitem" href="/admin" onClick={() => setOpen(false)}><ShieldCheck size={17} /> Admin</Link>}
          <button role="menuitem" onClick={logout}><LogOut size={17} /> Sign out</button>
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);
  const mobileNav = [NAV[0], NAV[1], NAV[3], NAV[8], { href: '/settings', label: 'Settings', icon: Settings }];

  return (
    <div className="shell">
      <aside className="side" aria-label="Main navigation">
        <div className="side-logo"><Logo href="/home" /></div>
        <nav className="side-nav">
          {NAV.map((item) => <NavLink key={item.href} {...item} active={isActive(item.href)} />)}
        </nav>
        <div className="side-bottom">
          {can(user, 'users:read') && <NavLink href="/admin" label="Admin" icon={ShieldCheck} active={isActive('/admin')} />}
          <NavLink href="/settings" label="Settings" icon={Settings} active={isActive('/settings')} />
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <div className="topbar-mobile-logo"><Logo href="/home" /></div>
          <Link href="/settings?tab=location" className="area-pill" title="Change your home area">
            <MapPin size={16} />
            <span className="area-pill-name">{user.location?.areaName ?? 'Set your area'}</span>
            <span className="area-pill-r">{user.location?.radiusKm ?? 3} km</span>
          </Link>
          <UserMenu />
        </header>
        <main id="main" className="content">{children}</main>
      </div>

      <nav className="tabbar" aria-label="Main navigation">
        {mobileNav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={isActive(href) ? 'is-active' : ''} aria-current={isActive(href) ? 'page' : undefined}>
            <Icon size={21} /><span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
