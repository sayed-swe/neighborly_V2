'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import Logo from '@/components/Logo';
import { useAuth } from '@/lib/AuthProvider';

const LINKS = [['#features', 'Features'], ['#how', 'How it works'], ['#safety', 'Safety'], ['#faq', 'FAQ']];

export default function LandingNav() {
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`lnav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="wrap lnav-inner">
        <Logo />
        <nav aria-label="Primary" className={`lnav-links ${open ? 'is-open' : ''}`}>
          {LINKS.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
          <div className="lnav-actions">
            {status === 'authenticated' ? (
              <Link href="/home" className="btn btn-primary btn-sm">Open Neighborly</Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
                <Link href="/register" className="btn btn-primary btn-sm">Join free</Link>
              </>
            )}
          </div>
        </nav>
        <button className="lnav-toggle btn btn-ghost btn-sm" aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  );
}
