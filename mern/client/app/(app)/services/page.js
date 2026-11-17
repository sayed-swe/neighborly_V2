'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BadgeCheck, HandHelping, Inbox, MapPin, Plus, Search, Wrench } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { can } from '@/lib/permissions';
import { usePaged } from '@/lib/usePaged';
import { REQUEST_STATUS, label } from '@/lib/categories';
import { SERVICE_CATEGORIES } from '@/lib/schemas';
import { timeAgo } from '@/lib/format';
import { Alert, Avatar, Button, Field, Spinner, useToast } from '@/components/ui';
import { useDebounced } from '@/components/admin/bits';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import PostCard from '@/components/feed/PostCard';
import ComposerModal from '@/components/feed/Composer';
import { ServiceCard, ServiceForm } from '@/components/services';

function Directory() {
  const { user } = useAuth();
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [mine, setMine] = useState(false);
  const [verified, setVerified] = useState(false);
  const [sort, setSort] = useState('rating');
  const dq = useDebounced(q.trim(), 400);
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const isProvider = can(user, 'service:list');

  useEffect(() => {
    setList(null);
    api.get('/services', { params: { sort, ...(category && { category }), ...(dq.length >= 2 && { q: dq }), ...(mine && { mine: '1' }), ...(verified && { verified: '1' }) } })
      .then(({ data }) => setList(data.services)).catch((e) => { setError(parseError(e).message); setList([]); });
  }, [category, dq, mine, verified, sort]);

  return (
    <>
      <div className="toolbar">
        <div className="table-search"><Search size={17} aria-hidden="true" /><label className="sr-only" htmlFor="sq">Search services</label>
          <input id="sq" className="input" placeholder="Search electricians, tutors, cooks…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label className="sr-only" htmlFor="sc">Category</label>
        <select id="sc" className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>{SERVICE_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <label className="sr-only" htmlFor="ss">Sort</label>
        <select id="ss" className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="rating">Top rated</option><option value="distance">Nearest</option><option value="new">Newest</option>
        </select>
        <label className="check" style={{ alignItems: 'center' }}><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} /> Verified only</label>
        {isProvider && <label className="check" style={{ alignItems: 'center' }}><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> My services</label>}
        {isProvider && <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)} style={{ marginLeft: 'auto' }}><Plus size={16} /> List a service</button>}
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {!list ? <div className="page-loader" style={{ minHeight: 240 }}><Spinner size={24} /></div> : list.length === 0 ? (
        <div className="card empty-state"><Wrench size={30} /><h2>No services found</h2><p className="muted">{isProvider ? 'List your first service so neighbours can find you.' : 'Try another category or widen your radius in settings.'}</p></div>
      ) : <div className="svc-grid">{list.map((s) => <ServiceCard key={s.id} s={s} />)}</div>}
      {adding && <ServiceForm onClose={() => setAdding(false)} onSaved={(s) => setList((cur) => [s, ...(cur ?? [])])} />}
    </>
  );
}

function HelpRequests() {
  const [open, setOpen] = useState(true);
  const [composing, setComposing] = useState(false);
  const { items, setItems, next, loadMore, loadingMore, error } = usePaged('/posts', { category: 'help', limit: 10, ...(open && { state: 'open' }) });
  return (
    <>
      <div className="toolbar">
        <label className="check" style={{ alignItems: 'center' }}><input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> Still need help</label>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setComposing(true)}><Plus size={16} /> Ask for help</button>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      <div className="post-col">
        {!items ? <Spinner /> : items.length === 0 ? <div className="card empty-state"><HandHelping size={30} /><h2>No open requests</h2><p className="muted">Nobody nearby needs help right now.</p></div>
          : items.map((p) => <PostCard key={p.id} initial={p} onDeleted={(id) => setItems((c) => c.filter((x) => x.id !== id))} onShared={() => {}} />)}
        {next && <div className="fb-more"><button className="btn btn-sm" onClick={loadMore} disabled={loadingMore}>Load more</button></div>}
      </div>
      {composing && <ComposerModal preset={{ category: 'help' }} onClose={() => setComposing(false)} onPosted={(p) => setItems((c) => [p, ...(c ?? [])])} />}
    </>
  );
}

function Requests() {
  const { user } = useAuth();
  const toast = useToast();
  const isProvider = user.role === 'provider';
  const [box, setBox] = useState(isProvider ? 'incoming' : 'outgoing');
  const [list, setList] = useState(null);
  const [replying, setReplying] = useState(null);
  const load = useCallback(() => {
    setList(null);
    api.get('/services/requests', { params: { box } }).then(({ data }) => setList(data.requests)).catch((e) => { toast(parseError(e).message, 'error'); setList([]); });
  }, [box, toast]);
  useEffect(load, [load]);

  async function move(r, status, note) {
    try { await api.patch(`/services/requests/${r.id}`, { status, ...(note && { note }) }); toast('Request updated'); load(); }
    catch (e) { toast(parseError(e).message, 'error'); }
  }

  return (
    <>
      {isProvider && (
        <div className="seg" role="tablist" aria-label="Requests">
          {[['incoming', 'Received'], ['outgoing', 'Sent']].map(([v, l]) => <button key={v} role="tab" aria-selected={box === v} className={box === v ? 'is-active' : ''} onClick={() => setBox(v)}>{l}</button>)}
        </div>
      )}
      {!list ? <Spinner /> : list.length === 0 ? (
        <div className="card empty-state"><Inbox size={30} /><h2>No requests</h2><p className="muted">{box === 'incoming' ? 'When a neighbour books one of your services it shows up here.' : 'Request a service from the directory and track it here.'}</p></div>
      ) : (
        <div className="req-list">
          {list.map((r) => {
            const other = box === 'incoming' ? r.requester : r.provider;
            const [cls, st] = REQUEST_STATUS[r.status];
            return (
              <article key={r.id} className="card req">
                <header>
                  <Avatar user={other} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}><strong>{r.service?.name ?? 'Deleted service'}</strong><span className="tiny muted" style={{ display: 'block' }}>{box === 'incoming' ? 'From' : 'To'} {other?.name} · {timeAgo(r.createdAt)}</span></div>
                  <span className={`badge ${cls}`}>{st}</span>
                </header>
                <p>{r.details}</p>
                {r.preferredTime && <p className="small muted">Preferred time: {r.preferredTime}</p>}
                {r.providerNote && <p className="small req-note">“{r.providerNote}”</p>}
                <footer className="report-actions">
                  {box === 'incoming' && r.status === 'pending' && <><button className="btn btn-sm" onClick={() => setReplying({ r, status: 'declined' })}>Decline</button><button className="btn btn-primary btn-sm" onClick={() => setReplying({ r, status: 'accepted' })}>Accept</button></>}
                  {box === 'incoming' && r.status === 'accepted' && <button className="btn btn-primary btn-sm" onClick={() => move(r, 'done')}>Mark as done</button>}
                  {box === 'outgoing' && ['pending', 'accepted'].includes(r.status) && <button className="btn btn-ghost btn-sm" onClick={() => move(r, 'cancelled')}>Cancel request</button>}
                  {r.service && box === 'outgoing' && r.status === 'done' && <Link href={`/services/${r.service.id}#review`} className="btn btn-sm">Leave a review</Link>}
                </footer>
              </article>
            );
          })}
        </div>
      )}
      {replying && <ReplyModal {...replying} onClose={() => setReplying(null)} onSend={(note) => move(replying.r, replying.status, note)} />}
    </>
  );
}

function ReplyModal({ status, onClose, onSend }) {
  const [note, setNote] = useState('');
  return (
    <Modal title={status === 'accepted' ? 'Accept request' : 'Decline request'} size="sm" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className={`btn ${status === 'accepted' ? 'btn-primary' : 'btn-accent'}`} onClick={() => { onSend(note.trim()); onClose(); }}>{status === 'accepted' ? 'Accept' : 'Decline'}</button></>}>
      <label className="label" htmlFor="note">Note to the neighbour <span className="tiny muted">optional</span></label>
      <textarea id="note" data-autofocus className="textarea" maxLength={500} style={{ marginTop: 6 }} value={note} onChange={(e) => setNote(e.target.value)}
        placeholder={status === 'accepted' ? 'e.g. I can come tomorrow at 6 PM.' : 'e.g. Fully booked this week, sorry!'} />
    </Modal>
  );
}

function Services() {
  const params = useSearchParams();
  const router = useRouter();
  const tabs = [['directory', 'Directory', Wrench], ['help', 'Help requests', HandHelping], ['requests', 'Requests', Inbox]];
  const tab = tabs.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'directory';
  return (
    <div className="fpage">
      <PageHeader icon={Wrench} title="Services & help" subtitle="Trusted local providers, rated by neighbours, and neighbours who need a hand." />
      <nav className="admin-tabs" aria-label="Services sections">
        {tabs.map(([k, l, Icon]) => <button key={k} className={`tab-btn ${tab === k ? 'is-active' : ''}`} aria-current={tab === k ? 'page' : undefined} onClick={() => router.replace(`/services?tab=${k}`, { scroll: false })}><Icon size={17} /> {l}</button>)}
      </nav>
      {tab === 'directory' && <Directory />}
      {tab === 'help' && <HelpRequests />}
      {tab === 'requests' && <Requests />}
    </div>
  );
}

export default function ServicesPage() {
  return <Suspense><Services /></Suspense>;
}
