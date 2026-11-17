'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Home, MapPin, PenLine, Search, ShieldCheck, Users, X } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { CATEGORIES, CATEGORY_KEYS } from '@/lib/categories';
import { Alert, Avatar, Spinner } from '@/components/ui';
import PostCard from '@/components/feed/PostCard';
import ComposerModal, { ComposerBar } from '@/components/feed/Composer';

function PostSkeleton() {
  return (
    <div className="post card skeleton" aria-hidden="true">
      <div className="post-head"><span className="sk sk-av" /><div style={{ flex: 1 }}><span className="sk sk-line" style={{ width: '38%' }} /><span className="sk sk-line" style={{ width: '24%', marginTop: 8 }} /></div></div>
      <span className="sk sk-line" style={{ width: '92%', marginTop: 18 }} /><span className="sk sk-line" style={{ width: '70%', marginTop: 10 }} />
      <span className="sk sk-block" />
    </div>
  );
}

function Feed() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const category = CATEGORY_KEYS.includes(params.get('category')) ? params.get('category') : '';
  const mine = params.get('mine') === '1';
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = params.get('q') ?? '';

  const [posts, setPosts] = useState(null);
  const [next, setNext] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [composer, setComposer] = useState(() => {
    const c = params.get('compose');
    return c ? { category: CATEGORY_KEYS.includes(c) ? c : 'general' } : null;
  });
  const [nearby, setNearby] = useState(null);
  const sentinel = useRef(null);
  const requestId = useRef(0);

  const query = useCallback((before) => ({
    ...(category && { category }), ...(mine && { mine: '1' }), ...(q.length >= 2 && { q }), ...(before && { before }),
  }), [category, mine, q]);

  useEffect(() => {
    const id = ++requestId.current;
    setPosts(null); setError('');
    api.get('/posts', { params: query() })
      .then(({ data }) => { if (id === requestId.current) { setPosts(data.posts); setNext(data.next); } })
      .catch((err) => { if (id === requestId.current) { setError(parseError(err).message); setPosts([]); } });
  }, [query]);

  useEffect(() => { api.get('/users/me/nearby-count').then(({ data }) => setNearby(data.count)).catch(() => {}); }, []);

  const loadMore = useCallback(async () => {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    const id = requestId.current;
    try {
      const { data } = await api.get('/posts', { params: query(next) });
      if (id === requestId.current) { setPosts((cur) => [...cur, ...data.posts.filter((p) => !cur.some((c) => c.id === p.id))]); setNext(data.next); }
    } catch (err) { setError(parseError(err).message); }
    setLoadingMore(false);
  }, [next, loadingMore, query]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next) return undefined;
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadMore(); }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [next, loadMore]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() === q) return;
      const sp = new URLSearchParams(params.toString());
      if (search.trim().length >= 2) sp.set('q', search.trim()); else sp.delete('q');
      router.replace(`/feed${sp.toString() ? `?${sp}` : ''}`, { scroll: false });
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setFilter(key, value) {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    const nextState = { category, mine: mine ? '1' : '', [key]: value };
    if (nextState.category) sp.set('category', nextState.category);
    if (nextState.mine) sp.set('mine', '1');
    router.replace(`/feed${sp.toString() ? `?${sp}` : ''}`, { scroll: false });
  }

  const activeLabel = mine ? 'Your posts' : category ? CATEGORIES[category].label : 'Everything nearby';
  const filters = [{ key: '', mine: false, label: 'Everything nearby', icon: Home }, ...CATEGORY_KEYS.map((k) => ({ key: k, label: CATEGORIES[k].label, icon: CATEGORIES[k].icon }))];

  return (
    <div className="fb">
      <aside className="fb-left" aria-label="Filters">
        <Link href="/settings?tab=profile" className="fb-me">
          <Avatar user={user} size={40} /><span><strong>{user.name}</strong><span className="tiny muted" style={{ display: 'block' }}>View profile settings</span></span>
        </Link>
        <nav className="fb-filters">
          {filters.map(({ key, label, icon: Icon }) => {
            const active = !mine && category === key;
            return <button key={label} className={active ? 'is-active' : ''} aria-current={active ? 'true' : undefined} onClick={() => setFilter('category', key)}><span className="fb-ico"><Icon size={18} /></span>{label}</button>;
          })}
          <button className={mine ? 'is-active' : ''} aria-current={mine ? 'true' : undefined} onClick={() => { const sp = new URLSearchParams(); sp.set('mine', '1'); router.replace(`/feed?${sp}`, { scroll: false }); }}><span className="fb-ico"><PenLine size={18} /></span>Your posts</button>
        </nav>
      </aside>

      <section className="fb-center" aria-label="Feed">
        <div className="fb-chips" role="tablist" aria-label="Filter posts">
          {filters.map(({ key, label }) => <button key={label} role="tab" aria-selected={!mine && category === key} className={!mine && category === key ? 'is-active' : ''} onClick={() => setFilter('category', key)}>{key ? CATEGORIES[key].short : 'All'}</button>)}
          <button role="tab" aria-selected={mine} className={mine ? 'is-active' : ''} onClick={() => setFilter('mine', '1')}>Mine</button>
        </div>

        <ComposerBar onOpen={(p = {}) => setComposer(p)} />

        <div className="fb-search">
          <Search size={17} aria-hidden="true" />
          <label className="sr-only" htmlFor="feed-search">Search posts</label>
          <input id="feed-search" className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search posts in your area" />
          {search && <button className="icon-btn" aria-label="Clear search" onClick={() => setSearch('')}><X size={16} /></button>}
        </div>

        {q.length >= 2 && <p className="small muted fb-result-note">Results for “{q}” · {activeLabel}</p>}
        {error && <Alert kind="error">{error}</Alert>}

        {posts === null && <><PostSkeleton /><PostSkeleton /></>}
        {posts?.length === 0 && !error && (
          <div className="card fb-empty">
            <MapPin size={28} />
            <h2>{q ? 'No posts match your search' : mine ? 'You haven’t posted yet' : 'Nothing here yet'}</h2>
            <p className="muted">{q ? 'Try different words or widen your radius in settings.' : 'Be the first to share something with your neighbours: a notice, a question, something to sell.'}</p>
            <button className="btn btn-primary" onClick={() => setComposer({})}>Create a post</button>
          </div>
        )}
        {posts?.map((p) => (
          <PostCard key={p.id} initial={p}
            onDeleted={(id) => setPosts((cur) => cur.filter((x) => x.id !== id))}
            onShared={(sp) => setPosts((cur) => [sp, ...cur])} />
        ))}
        {next && <div ref={sentinel} className="fb-more">{loadingMore ? <Spinner size={22} /> : <button className="btn btn-sm" onClick={loadMore}>Load more</button>}</div>}
        {posts?.length > 0 && !next && <p className="fb-end tiny muted">You’re all caught up. Nothing older within {user.location.radiusKm} km.</p>}
      </section>

      <aside className="fb-right" aria-label="About your area">
        <section className="card card-pad">
          <h2 className="card-title"><MapPin size={17} /> {user.location.areaName}</h2>
          <p className="small muted" style={{ margin: '6px 0 12px' }}>Showing posts within <strong className="text-ink">{user.location.radiusKm} km</strong> of home.</p>
          <div className="stat" style={{ borderRadius: 12 }}><Users size={18} /><span><strong>{nearby ?? '–'}</strong> verified neighbour{nearby === 1 ? '' : 's'} in range</span></div>
          <Link href="/settings?tab=location" className="link small" style={{ display: 'inline-block', marginTop: 12 }}>Change area or radius</Link>
        </section>
        <section className="card card-pad">
          <h2 className="card-title"><ShieldCheck size={17} /> Community guidelines</h2>
          <ul className="guidelines small">
            <li>Be kind and keep it local.</li>
            <li>No spam, scams or adverts without a business profile.</li>
            <li>Never share anyone’s private details.</li>
            <li>See something wrong? Use ⋯ → Report.</li>
          </ul>
        </section>
      </aside>

      {composer && <ComposerModal preset={composer} onClose={() => setComposer(null)} onPosted={(p) => { setPosts((cur) => [p, ...(cur ?? [])]); if (category && category !== p.category) setFilter('category', ''); }} />}
    </div>
  );
}

export default function FeedPage() {
  return <Suspense><Feed /></Suspense>;
}
