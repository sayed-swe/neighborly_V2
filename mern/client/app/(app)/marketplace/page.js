'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ImageIcon, Plus, Search, Tag } from 'lucide-react';
import { useAuth } from '@/lib/AuthProvider';
import { usePaged } from '@/lib/usePaged';
import { CONDITIONS, LISTING_KINDS, LISTING_STATUS, formatPrice, label } from '@/lib/categories';
import { timeAgo } from '@/lib/format';
import { Alert, Spinner } from '@/components/ui';
import { useDebounced } from '@/components/admin/bits';
import PageHeader from '@/components/PageHeader';
import ComposerModal from '@/components/feed/Composer';

function ListingCard({ p }) {
  const l = p.listing ?? { kind: 'sell', status: 'available' };
  const [cls, st] = LISTING_STATUS[l.status] ?? ['', ''];
  return (
    <Link href={`/post/${p.id}`} className={`listing card ${l.status === 'sold' ? 'is-sold' : ''}`}>
      <div className="listing-img">
        {p.images[0] ? <img src={p.images[0]} alt="" loading="lazy" /> : <span className="listing-ph"><Tag size={28} /></span>}
        {l.status !== 'available' && <span className={`badge ${cls} listing-status`}>{st}</span>}
        {p.images.length > 1 && <span className="listing-count"><ImageIcon size={12} /> {p.images.length}</span>}
      </div>
      <div className="listing-body">
        <strong className="listing-price">{l.kind === 'free' || p.price === 0 ? 'Free' : l.kind === 'wanted' ? 'Wanted' : p.price != null ? formatPrice(p.price) : 'Ask'}</strong>
        <span className="listing-title">{p.title || p.text}</span>
        <span className="tiny muted">{[l.condition && label(CONDITIONS, l.condition), p.distanceKm != null && `${p.distanceKm} km`, timeAgo(p.createdAt)].filter(Boolean).join(' · ')}</span>
      </div>
    </Link>
  );
}

export default function Marketplace() {
  const { user } = useAuth();
  const [kind, setKind] = useState('');
  const [state, setState] = useState('available');
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 400);
  const [composing, setComposing] = useState(false);
  const { items, setItems, next, loadMore, loadingMore, error } = usePaged('/posts', {
    category: 'sale', limit: 20, ...(kind && { kind }), ...(state && { state }), ...(dq.length >= 2 && { q: dq }),
  });

  return (
    <div className="fpage">
      <PageHeader icon={Tag} title="Buy & sell" subtitle={`Things for sale, wanted or free within ${user.location.radiusKm} km.`}
        action={<button className="btn btn-primary" onClick={() => setComposing(true)}><Plus size={17} /> Sell something</button>} />
      <div className="toolbar">
        <div className="table-search"><Search size={17} aria-hidden="true" /><label className="sr-only" htmlFor="mq">Search listings</label>
          <input id="mq" className="input" placeholder="Search listings" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="seg" role="tablist" aria-label="Listing type">
          {[['', 'All'], ...LISTING_KINDS].map(([v, l]) => <button key={v} role="tab" aria-selected={kind === v} className={kind === v ? 'is-active' : ''} onClick={() => setKind(v)}>{l}</button>)}
        </div>
        <label className="check" style={{ alignItems: 'center' }}><input type="checkbox" checked={state === 'available'} onChange={(e) => setState(e.target.checked ? 'available' : '')} /> Available only</label>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {!items ? <div className="page-loader" style={{ minHeight: 240 }}><Spinner size={24} /></div> : items.length === 0 ? (
        <div className="card empty-state"><Tag size={30} /><h2>No listings yet</h2><p className="muted">Nothing matches right now. Be the first to sell or give something away.</p></div>
      ) : (
        <div className="listing-grid">{items.map((p) => <ListingCard key={p.id} p={p} />)}</div>
      )}
      {next && <div className="fb-more"><button className="btn btn-sm" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</button></div>}
      {composing && <ComposerModal preset={{ category: 'sale' }} onClose={() => setComposing(false)} onPosted={(p) => setItems((cur) => [p, ...(cur ?? [])])} />}
    </div>
  );
}
