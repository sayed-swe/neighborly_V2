'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Plus } from 'lucide-react';
import { usePaged } from '@/lib/usePaged';
import { Alert, Avatar, Spinner } from '@/components/ui';
import PageHeader from '@/components/PageHeader';
import ItemDetails from '@/components/feed/ItemDetails';
import ComposerModal from '@/components/feed/Composer';
import { useAuth } from '@/lib/AuthProvider';

export default function Events() {
  const { user } = useAuth();
  const [when, setWhen] = useState('upcoming');
  const [composing, setComposing] = useState(false);
  const { items, setItems, error } = usePaged('/posts', { category: 'event', when });

  const groups = useMemo(() => {
    const out = new Map();
    for (const p of items ?? []) {
      if (!p.event) continue;
      const k = new Date(p.event.startsAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      out.set(k, [...(out.get(k) ?? []), p]);
    }
    return [...out];
  }, [items]);
  const update = (np) => setItems((cur) => cur.map((x) => (x.id === np.id ? np : x)));

  return (
    <div className="fpage">
      <PageHeader icon={CalendarDays} title="Events" subtitle="What’s on near you: cleanups, games, meetups and more."
        action={<button className="btn btn-primary" onClick={() => setComposing(true)}><Plus size={17} /> Create event</button>} />
      <div className="toolbar">
        <div className="seg" role="tablist" aria-label="When">
          {[['upcoming', 'Upcoming'], ['past', 'Past']].map(([v, l]) => <button key={v} role="tab" aria-selected={when === v} className={when === v ? 'is-active' : ''} onClick={() => setWhen(v)}>{l}</button>)}
        </div>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {!items ? <div className="page-loader" style={{ minHeight: 240 }}><Spinner size={24} /></div> : groups.length === 0 ? (
        <div className="card empty-state"><CalendarDays size={30} /><h2>{when === 'upcoming' ? 'No upcoming events' : 'No past events'}</h2><p className="muted">Organise something: a cleanup, a game, a book swap.</p></div>
      ) : groups.map(([day, list]) => (
        <section key={day} className="ev-day">
          <h2 className="ev-day-h">{day}</h2>
          {list.map((p) => (
            <article key={p.id} className="card ev-card">
              <ItemDetails post={p} mine={p.author.id === user.id} onChange={update} />
              {p.text && <p className="ev-text">{p.text}</p>}
              <footer className="ev-foot tiny muted"><Avatar user={p.author} size={20} /> Hosted by {p.author.name} <Link href={`/post/${p.id}`} className="link" style={{ marginLeft: 'auto' }}>Details & discussion</Link></footer>
            </article>
          ))}
        </section>
      ))}
      {composing && <ComposerModal preset={{ category: 'event' }} onClose={() => setComposing(false)} onPosted={(p) => setItems((cur) => [...(cur ?? []), p].sort((a, b) => new Date(a.event?.startsAt) - new Date(b.event?.startsAt)))} />}
    </div>
  );
}
