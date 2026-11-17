'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Check, MapPin, PackageSearch, Plus } from 'lucide-react';
import { usePaged } from '@/lib/usePaged';
import { timeAgo } from '@/lib/format';
import { Alert, Avatar, Spinner } from '@/components/ui';
import PageHeader from '@/components/PageHeader';
import ComposerModal from '@/components/feed/Composer';

export default function LostFound() {
  const [kind, setKind] = useState('');
  const [openOnly, setOpenOnly] = useState(true);
  const [composing, setComposing] = useState(false);
  const { items, setItems, next, loadMore, loadingMore, error } = usePaged('/posts', {
    category: 'lost-found', limit: 20, ...(kind && { kind }), ...(openOnly && { state: 'open' }),
  });

  return (
    <div className="fpage">
      <PageHeader icon={PackageSearch} title="Lost & found" subtitle="Lost something nearby, or found something that isn’t yours?"
        action={<button className="btn btn-primary" onClick={() => setComposing(true)}><Plus size={17} /> Report an item</button>} />
      <div className="toolbar">
        <div className="seg" role="tablist" aria-label="Type">
          {[['', 'All'], ['lost', 'Lost'], ['found', 'Found']].map(([v, l]) => <button key={v} role="tab" aria-selected={kind === v} className={kind === v ? 'is-active' : ''} onClick={() => setKind(v)}>{l}</button>)}
        </div>
        <label className="check" style={{ alignItems: 'center' }}><input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Hide reunited</label>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {!items ? <div className="page-loader" style={{ minHeight: 240 }}><Spinner size={24} /></div> : items.length === 0 ? (
        <div className="card empty-state"><PackageSearch size={30} /><h2>Nothing reported</h2><p className="muted">No {kind || 'lost or found'} items near you right now.</p></div>
      ) : (
        <div className="lf-list">
          {items.map((p) => (
            <Link key={p.id} href={`/post/${p.id}`} className={`lf card ${p.lost?.status === 'reunited' ? 'is-done' : ''}`}>
              <div className="lf-img">{p.images[0] ? <img src={p.images[0]} alt="" loading="lazy" /> : <PackageSearch size={26} />}</div>
              <div className="lf-body">
                <div className="item-tags">
                  <span className={`badge ${p.lost?.kind === 'lost' ? 'badge-brick' : 'badge-green'}`}>{p.lost?.kind === 'lost' ? 'Lost' : 'Found'}</span>
                  {p.lost?.status === 'reunited' && <span className="badge badge-sky"><Check size={12} /> Reunited</span>}
                </div>
                <strong>{p.title || p.text}</strong>
                {p.lost?.place && <span className="small muted"><MapPin size={13} style={{ verticalAlign: '-2px' }} /> {p.lost.place}{p.lost.date ? ` · ${new Date(p.lost.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</span>}
                <span className="tiny muted lf-by"><Avatar user={p.author} size={18} /> {p.author.name} · {timeAgo(p.createdAt)}{p.distanceKm != null ? ` · ${p.distanceKm} km` : ''}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {next && <div className="fb-more"><button className="btn btn-sm" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</button></div>}
      {composing && <ComposerModal preset={{ category: 'lost-found' }} onClose={() => setComposing(false)} onPosted={(p) => setItems((cur) => [p, ...(cur ?? [])])} />}
    </div>
  );
}
