'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Check, HandHelping, MapPin, MessageCircle, Star, Users } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { startConversation } from '@/lib/messaging';
import { CONDITIONS, LISTING_KINDS, LISTING_STATUS, fmtWhen, formatPrice, label } from '@/lib/categories';
import { timeAgo } from '@/lib/format';
import { Avatar, Button, useToast } from '@/components/ui';
import Modal from '@/components/Modal';

function MessageButton({ userId, label: text = 'Message' }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button className="btn btn-sm" loading={busy} onClick={async () => {
      setBusy(true);
      try { router.push(`/messages?c=${await startConversation(userId)}`); } catch (e) { toast(parseError(e).message, 'error'); setBusy(false); }
    }}><MessageCircle size={15} /> {text}</Button>
  );
}

function StateSelect({ post, options, onChange }) {
  const toast = useToast();
  const current = post.listing?.status ?? post.lost?.status ?? post.help?.status;
  return (
    <label className="state-select">
      <span className="tiny muted">Status</span>
      <select className="select select-sm" value={current} onChange={async (e) => {
        try { const { data } = await api.patch(`/posts/${post.id}/state`, { state: e.target.value }); onChange(data.post); toast('Status updated'); }
        catch (err) { toast(parseError(err).message, 'error'); }
      }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Listing({ post, mine, onChange }) {
  const l = post.listing;
  const [cls, st] = LISTING_STATUS[l.status] ?? ['', l.status];
  return (
    <div className={`item item-sale ${l.status === 'sold' ? 'is-done' : ''}`}>
      <div className="item-main">
        <h3 className="item-title">{post.title}</h3>
        <div className="item-price">{l.kind === 'free' ? 'Free' : l.kind === 'wanted' ? 'Wanted' : post.price != null ? formatPrice(post.price) : 'Price on request'}</div>
        <div className="item-tags">
          <span className={`badge ${cls}`}>{st}</span>
          {l.kind !== 'sell' && l.kind !== 'free' && <span className="badge">{label(LISTING_KINDS, l.kind)}</span>}
          {l.condition && <span className="badge">{label(CONDITIONS, l.condition)}</span>}
        </div>
      </div>
      <div className="item-actions">
        {mine ? <StateSelect post={post} onChange={onChange} options={[['available', 'Available'], ['reserved', 'Reserved'], ['sold', 'Sold']]} />
          : l.status !== 'sold' && <MessageButton userId={post.author.id} label={l.kind === 'wanted' ? 'I have this' : 'Message seller'} />}
      </div>
    </div>
  );
}

function LostFound({ post, mine, onChange }) {
  const l = post.lost;
  const reunited = l.status === 'reunited';
  return (
    <div className={`item item-lost ${reunited ? 'is-done' : ''}`}>
      <div className="item-main">
        <div className="item-tags">
          <span className={`badge ${l.kind === 'lost' ? 'badge-brick' : 'badge-green'}`}>{l.kind === 'lost' ? 'Lost' : 'Found'}</span>
          {reunited && <span className="badge badge-sky"><Check size={12} /> Reunited</span>}
        </div>
        <h3 className="item-title">{post.title}</h3>
        <p className="item-line"><MapPin size={14} /> {l.place}{l.date && <> · {new Date(l.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</>}</p>
      </div>
      <div className="item-actions">
        {mine ? <StateSelect post={post} onChange={onChange} options={[['open', l.kind === 'lost' ? 'Still missing' : 'Waiting for owner'], ['reunited', 'Reunited']]} />
          : !reunited && <MessageButton userId={post.author.id} label={l.kind === 'lost' ? 'I’ve seen it' : 'It’s mine'} />}
      </div>
    </div>
  );
}

function Event({ post, onChange }) {
  const toast = useToast();
  const e = post.event;
  const [busy, setBusy] = useState(false);
  const [people, setPeople] = useState(null);
  const start = new Date(e.startsAt);
  const over = new Date(e.endsAt ?? start.getTime() + 3 * 3600e3) < new Date();
  const full = e.capacity && e.going >= e.capacity && post.myRsvp !== 'going';

  async function rsvp(status) {
    setBusy(true);
    try {
      const { data } = status === post.myRsvp ? await api.delete(`/posts/${post.id}/rsvp`) : await api.put(`/posts/${post.id}/rsvp`, { status });
      onChange({ ...post, myRsvp: data.myRsvp, event: { ...e, going: data.going, interested: data.interested } });
    } catch (err) { toast(parseError(err).message, 'error'); }
    setBusy(false);
  }
  async function showPeople() {
    try { const { data } = await api.get(`/posts/${post.id}/rsvps`); setPeople(data.people); } catch (err) { toast(parseError(err).message, 'error'); }
  }

  return (
    <div className={`item item-event ${over ? 'is-done' : ''}`}>
      <div className="date-chip" aria-hidden="true">
        <span>{start.toLocaleDateString('en-GB', { month: 'short' })}</span>
        <strong>{start.getDate()}</strong>
      </div>
      <div className="item-main">
        <h3 className="item-title">{post.title}</h3>
        <p className="item-line"><CalendarDays size={14} /> {fmtWhen(e.startsAt, e.endsAt)}</p>
        <p className="item-line"><MapPin size={14} /> {e.place}</p>
        <button className="link-plain item-line tiny" onClick={showPeople}><Users size={14} /> {e.going} going · {e.interested} interested{e.capacity ? ` · ${Math.max(0, e.capacity - e.going)} spots left` : ''}</button>
      </div>
      <div className="item-actions">
        {over ? <span className="badge">Event ended</span> : (
          <div className="rsvp" role="group" aria-label="RSVP">
            <button className={`btn btn-sm ${post.myRsvp === 'going' ? 'btn-primary' : ''}`} disabled={busy || full} aria-pressed={post.myRsvp === 'going'} onClick={() => rsvp('going')}>{full ? 'Full' : post.myRsvp === 'going' ? <><Check size={14} /> Going</> : 'Going'}</button>
            <button className={`btn btn-sm ${post.myRsvp === 'interested' ? 'btn-primary' : ''}`} disabled={busy} aria-pressed={post.myRsvp === 'interested'} onClick={() => rsvp('interested')}><Star size={14} /> Interested</button>
          </div>
        )}
      </div>
      {people && (
        <Modal title="Who’s coming" size="sm" onClose={() => setPeople(null)}>
          {people.length === 0 ? <p className="muted">No one has responded yet.</p> : (
            <ul className="people">{people.map((p) => <li key={p.id}><Avatar user={p} size={34} /><span>{p.name}</span><span className={`badge ${p.status === 'going' ? 'badge-green' : ''}`}>{p.status === 'going' ? 'Going' : 'Interested'}</span></li>)}</ul>
          )}
        </Modal>
      )}
    </div>
  );
}

function Help({ post, mine, onChange }) {
  const toast = useToast();
  const h = post.help;
  const [offering, setOffering] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [offers, setOffers] = useState(null);
  const resolved = h.status === 'resolved';

  async function offer() {
    setBusy(true);
    try {
      const { data } = await api.post(`/posts/${post.id}/offers`, { ...(msg.trim() && { message: msg.trim() }) });
      onChange({ ...post, myOffer: true, help: { ...h, offers: data.offers } });
      toast(`${post.author.name.split(' ')[0]} has been told you can help`); setOffering(false);
    } catch (err) { toast(parseError(err).message, 'error'); }
    setBusy(false);
  }
  async function showOffers() {
    try { const { data } = await api.get(`/posts/${post.id}/offers`); setOffers(data.offers); } catch (err) { toast(parseError(err).message, 'error'); }
  }

  return (
    <div className={`item item-help ${resolved ? 'is-done' : ''}`}>
      <div className="item-main">
        <div className="item-tags">
          <span className={`badge ${resolved ? 'badge-sky' : 'badge-brick'}`}>{resolved ? 'Resolved' : 'Needs help'}</span>
          <span className="tiny muted"><HandHelping size={13} style={{ verticalAlign: '-2px' }} /> {h.offers} neighbour{h.offers === 1 ? '' : 's'} offered</span>
        </div>
      </div>
      <div className="item-actions">
        {mine ? (
          <>
            {h.offers > 0 && <button className="btn btn-sm" onClick={showOffers}>See offers</button>}
            <StateSelect post={post} onChange={onChange} options={[['open', 'Still need help'], ['resolved', 'Resolved']]} />
          </>
        ) : resolved ? null : post.myOffer ? <span className="badge badge-green"><Check size={12} /> You offered</span>
          : <button className="btn btn-accent btn-sm" onClick={() => setOffering(true)}><HandHelping size={15} /> I can help</button>}
      </div>
      {offering && (
        <Modal title="Offer to help" size="sm" onClose={() => setOffering(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setOffering(false)}>Cancel</button><Button className="btn btn-accent" loading={busy} onClick={offer}>Send offer</Button></>}>
          <p className="muted small" style={{ marginBottom: 10 }}>{post.author.name} will get a notification. Add a note if it helps.</p>
          <textarea data-autofocus className="textarea" maxLength={500} placeholder="e.g. I have a ladder, I can bring it over after 6 PM." value={msg} onChange={(e) => setMsg(e.target.value)} />
        </Modal>
      )}
      {offers && (
        <Modal title="People who offered to help" size="sm" onClose={() => setOffers(null)}>
          <ul className="people">{offers.map((o) => (
            <li key={o.id}><Avatar user={o.user} size={34} /><span><strong>{o.user.name}</strong>{o.message && <span className="small muted" style={{ display: 'block' }}>“{o.message}”</span>}<span className="tiny muted">{timeAgo(o.createdAt)}</span></span><MessageButton userId={o.user.id} /></li>
          ))}</ul>
        </Modal>
      )}
    </div>
  );
}

/** Extra block shown on typed posts (marketplace, lost & found, events, help requests). */
export default function ItemDetails({ post, mine, onChange }) {
  if (post.listing) return <Listing post={post} mine={mine} onChange={onChange} />;
  if (post.lost) return <LostFound post={post} mine={mine} onChange={onChange} />;
  if (post.event) return <Event post={post} onChange={onChange} />;
  if (post.help) return <Help post={post} mine={mine} onChange={onChange} />;
  return null;
}

export { MessageButton };
