'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, BadgeCheck, CalendarDays, Check, HandHelping, Megaphone, PackageSearch, PenLine, ShieldCheck,
  Siren, Store, Tag, Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { can, ROLE_LABELS } from '@/lib/permissions';
import { greeting, timeAgo } from '@/lib/format';
import { CATEGORIES } from '@/lib/categories';
import { SERVICE_CATEGORIES } from '@/lib/schemas';
import AreaMap from '@/components/map';
import InstallApp from '@/components/InstallApp';
import { Avatar, Spinner, useToast } from '@/components/ui';

const QUICK = [
  { icon: Megaphone, label: 'Share an update', href: '/feed?compose=general', tone: 'green' },
  { icon: HandHelping, label: 'Ask for help', href: '/feed?compose=help', tone: 'brick' },
  { icon: Tag, label: 'Sell or give away', href: '/marketplace', tone: 'plum' },
  { icon: PackageSearch, label: 'Lost & found', href: '/lost-found', tone: 'sun' },
  { icon: CalendarDays, label: 'Events near you', href: '/events', tone: 'sky' },
];

function RadiusControl() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [km, setKm] = useState(user.location.radiusKm);
  const timer = useRef();

  function change(v) {
    setKm(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const { data } = await api.patch('/users/me/radius', { radiusKm: v });
        setUser(data.user);
      } catch {
        toast('Couldn’t save your radius. Try again.', 'error');
        setKm(user.location.radiusKm);
      }
    }, 450);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  const approx = user.location.approx.coordinates;
  return (
    <>
      <AreaMap center={{ lat: approx[1], lng: approx[0] }} radiusKm={km} pin="approx" height={260} />
      <div className="field" style={{ marginTop: 16 }}>
        <label className="label" htmlFor="home-radius">Show me things within <output className="radius-value" htmlFor="home-radius">{km} km</output></label>
        <input id="home-radius" type="range" min="1" max="10" value={km} onChange={(e) => change(Number(e.target.value))} className="range" />
      </div>
    </>
  );
}

function Checklist() {
  const { user } = useAuth();
  const items = [
    { done: true, label: 'Create your account' },
    { done: user.emailVerified, label: 'Confirm your email' },
    { done: user.onboardingComplete, label: 'Set your home area' },
    { done: Boolean(user.bio), label: 'Introduce yourself with a short bio', href: '/settings?tab=profile' },
    ...(user.role === 'provider' ? [{ done: Boolean(user.provider?.description), label: 'Describe your services', href: '/settings?tab=profile' }] : []),
  ];
  const done = items.filter((i) => i.done).length;
  return (
    <section className="card card-pad" aria-labelledby="setup-h">
      <div className="card-head">
        <h2 id="setup-h" className="card-title">Get set up</h2>
        <span className="tiny muted">{done} of {items.length}</span>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={items.length}><span style={{ width: `${(done / items.length) * 100}%` }} /></div>
      <ul className="checklist">
        {items.map((i) => (
          <li key={i.label} className={i.done ? 'is-done' : ''}>
            <span className="checklist-dot">{i.done && <Check size={13} />}</span>
            {!i.done && i.href ? <Link href={i.href} className="link">{i.label}</Link> : <span>{i.label}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [nearby, setNearby] = useState(null);
  const [latest, setLatest] = useState(null);

  useEffect(() => {
    let alive = true;
    api.get('/users/me/nearby-count').then(({ data }) => alive && setNearby(data.count)).catch(() => {});
    return () => { alive = false; };
  }, [user.location?.radiusKm]);

  useEffect(() => {
    let alive = true;
    api.get('/posts', { params: { limit: 4 } }).then(({ data }) => alive && setLatest(data.posts)).catch(() => alive && setLatest([]));
    return () => { alive = false; };
  }, []);

  const first = user.name.split(' ')[0];
  const category = SERVICE_CATEGORIES.find(([v]) => v === user.provider?.category)?.[1];

  return (
    <div className="home">
      <section className="home-hero">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>{greeting()}, {first}.</h1>
          <p className="muted">Here’s your corner of <strong className="text-ink">{user.location.areaName}</strong>, everything within {user.location.radiusKm} km of home.</p>
        </div>
        <div className="home-hero-stats">
          <div className="stat"><Users size={18} /><span><strong>{nearby ?? '–'}</strong> verified neighbour{nearby === 1 ? '' : 's'} in range</span></div>
          <div className="stat"><BadgeCheck size={18} /><span>{ROLE_LABELS[user.role]} account</span></div>
        </div>
      </section>

      <section aria-labelledby="quick-h">
        <h2 id="quick-h" className="sr-only">Quick actions</h2>
        <div className="quick">
          {QUICK.map(({ icon: Icon, label, href, tone }) => (
            <Link key={label} href={href} className={`quick-item tone-${tone}`}>
              <span className="quick-ico"><Icon size={20} /></span>{label}
            </Link>
          ))}
          {can(user, 'alert:broadcast') && (
            <Link href="/alerts" className="quick-item quick-danger"><span className="quick-ico"><Siren size={20} /></span>Send emergency alert</Link>
          )}
        </div>
      </section>

      <div className="home-grid">
        <div className="home-col">
          <section className="card card-pad" aria-labelledby="feed-h">
            <div className="card-head">
              <h2 id="feed-h" className="card-title">Around you</h2>
              <Link href="/feed" className="link small">Open feed</Link>
            </div>
            {!latest ? <div className="page-loader" style={{ minHeight: 160 }}><Spinner size={22} /></div> : latest.length === 0 ? (
              <div className="feed-empty">
                <PenLine size={22} />
                <div><strong>Be the first to post</strong><p className="small muted">Nothing has been shared near you yet. Start the conversation.</p>
                  <Link href="/feed?compose=general" className="btn btn-primary btn-sm" style={{ marginTop: 10 }}>Create a post</Link></div>
              </div>
            ) : (
              <div className="latest">
                {latest.map((p) => (
                  <Link key={p.id} href={`/post/${p.id}`} className="latest-item">
                    <Avatar user={p.author} size={38} />
                    <div style={{ minWidth: 0 }}>
                      <strong>{p.author.name}</strong> {p.category !== 'general' && <span className={`badge ${CATEGORIES[p.category]?.badge}`}>{CATEGORIES[p.category]?.short}</span>}
                      <p>{p.text || (p.shared ? 'Shared a post' : 'Shared a photo')}</p>
                      <div className="latest-meta tiny muted"><span>{timeAgo(p.createdAt)}</span><span>👍 {p.reactionTotal}</span><span>💬 {p.commentCount}</span></div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {user.role === 'provider' && (
            <section className="card card-pad" aria-labelledby="biz-h">
              <div className="card-head">
                <h2 id="biz-h" className="card-title"><Store size={18} /> Your business</h2>
                <Link href="/settings?tab=profile" className="link small">Edit</Link>
              </div>
              <p><strong>{user.provider?.businessName}</strong> · {category}</p>
              <p className="small muted" style={{ marginTop: 6 }}>{user.provider?.description || 'Add a short description so neighbours know what you offer, your hours and your area.'}</p>
            </section>
          )}

          {can(user, 'users:read') && (
            <section className="card card-pad mod-card" aria-labelledby="mod-h">
              <ShieldCheck size={22} />
              <div style={{ flex: 1 }}>
                <h2 id="mod-h" className="card-title">{user.role === 'admin' ? 'Admin tools' : 'Moderator tools'}</h2>
                <p className="small muted">Manage members, roles and suspensions for the community.</p>
              </div>
              <Link href="/admin" className="btn btn-sm">Open <ArrowRight size={15} /></Link>
            </section>
          )}
        </div>

        <div className="home-col">
          <section className="card card-pad" aria-labelledby="area-h">
            <div className="card-head">
              <h2 id="area-h" className="card-title">Your area</h2>
              <Link href="/settings?tab=location" className="link small">Move home</Link>
            </div>
            <RadiusControl />
            <p className="tiny muted" style={{ marginTop: 8 }}>The shaded spot is the approximate area neighbours see, not your exact home.</p>
          </section>
          <InstallApp />
          <Checklist />
        </div>
      </div>
    </div>
  );
}
