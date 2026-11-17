'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Clock, MapPin, Pencil, Trash2, Wrench } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { can } from '@/lib/permissions';
import { label } from '@/lib/categories';
import { SERVICE_CATEGORIES } from '@/lib/schemas';
import { timeAgo } from '@/lib/format';
import { Alert, Avatar, Button, Spinner, useToast } from '@/components/ui';
import { Stars, StarInput } from '@/components/Stars';
import { ServiceForm } from '@/components/services';
import { MessageButton } from '@/components/feed/ItemDetails';

export default function ServiceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [details, setDetails] = useState('');
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    api.get(`/services/${id}`).then(({ data: d }) => {
      setData(d);
      const mine = d.reviews.find((r) => r.mine);
      if (mine) { setRating(mine.rating); setReview(mine.text); }
    }).catch((e) => setError(parseError(e).message));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <div className="fpage"><Alert kind="error">{error}</Alert><Link href="/services" className="btn">Back to services</Link></div>;
  if (!data) return <div className="page-loader"><Spinner size={26} /></div>;
  const s = data.service;
  const myReview = data.reviews.find((r) => r.mine);

  async function sendReview() {
    setBusy('review');
    try { await api.post(`/services/${id}/reviews`, { rating, text: review.trim() }); toast(myReview ? 'Review updated' : 'Thanks for your review'); load(); }
    catch (e) { toast(parseError(e).message, 'error'); }
    setBusy('');
  }
  async function sendRequest() {
    setBusy('request');
    try {
      await api.post(`/services/${id}/requests`, { details: details.trim(), ...(when.trim() && { preferredTime: when.trim() }) });
      toast(`Request sent to ${s.provider?.name}`); setDetails(''); setWhen('');
    } catch (e) { const p = parseError(e); toast(p.fields?.details ?? p.message, 'error'); }
    setBusy('');
  }
  async function removeReview(rid) {
    if (!window.confirm('Delete this review?')) return;
    try { await api.delete(`/services/${id}/reviews/${rid}`); load(); } catch (e) { toast(parseError(e).message, 'error'); }
  }
  async function toggleActive() {
    try { await api.patch(`/services/${id}`, { active: !s.active }); load(); } catch (e) { toast(parseError(e).message, 'error'); }
  }
  async function remove() {
    if (!window.confirm('Delete this service and its reviews?')) return;
    try { await api.delete(`/services/${id}`); toast('Service deleted'); router.replace('/services'); } catch (e) { toast(parseError(e).message, 'error'); }
  }

  return (
    <div className="fpage svc-detail">
      <Link href="/services" className="btn btn-ghost btn-sm" style={{ justifySelf: 'start', marginLeft: -10 }}><ArrowLeft size={16} /> All services</Link>
      <section className="card card-pad svc-hero">
        <div className="svc-top">
          <Avatar user={s.provider} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>{s.name} {s.verified && <BadgeCheck size={22} className="verified" aria-label="Verified provider" />}</h1>
            <p className="muted small">
              <Link href={`/u/${s.provider?.id}`} className="link">{s.provider?.business || s.provider?.name}</Link> · {label(SERVICE_CATEGORIES, s.category)}
            </p>
            <p className="svc-rating">{s.ratingCount ? <><Stars value={s.rating} size={16} /> <strong>{s.rating}</strong> <span className="muted small">from {s.ratingCount} review{s.ratingCount === 1 ? '' : 's'}</span></> : <span className="muted small">No reviews yet</span>}</p>
          </div>
          <div className="svc-actions">
            {s.mine ? (
              <>
                <button className="btn btn-sm" onClick={() => setEditing(true)}><Pencil size={15} /> Edit</button>
                <button className="btn btn-sm" onClick={toggleActive}>{s.active ? 'Pause' : 'Resume'}</button>
                <button className="btn btn-danger btn-sm" onClick={remove}><Trash2 size={15} /></button>
              </>
            ) : s.provider && <MessageButton userId={s.provider.id} label="Message provider" />}
            {!s.mine && can(user, 'content:moderate') && <button className="btn btn-danger btn-sm" onClick={remove}><Trash2 size={15} /> Remove</button>}
          </div>
        </div>
        {!s.active && <Alert kind="warn">This service is paused and hidden from the directory.</Alert>}
        <p className="svc-long">{s.description || 'No description yet.'}</p>
        <ul className="svc-facts small">
          {s.priceInfo && <li><Wrench size={15} /> {s.priceInfo}</li>}
          {s.hours && <li><Clock size={15} /> {s.hours}</li>}
          <li><MapPin size={15} /> {s.areaName}{s.distanceKm != null ? ` · ${s.distanceKm} km from you` : ''}</li>
        </ul>
      </section>

      <div className="svc-cols">
        {!s.mine && s.active && (
          <section className="card card-pad">
            <h2 className="card-title">Request this service</h2>
            <p className="small muted" style={{ margin: '4px 0 12px' }}>{s.provider?.name} gets a notification and can accept or decline.</p>
            <label className="label" htmlFor="rq">What do you need?</label>
            <textarea id="rq" className="textarea" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="e.g. The ceiling fan in the bedroom makes a grinding noise." style={{ marginTop: 6 }} />
            <label className="label" htmlFor="rw" style={{ marginTop: 12 }}>When suits you? <span className="tiny muted">optional</span></label>
            <input id="rw" className="input" maxLength={120} value={when} onChange={(e) => setWhen(e.target.value)} placeholder="e.g. Tomorrow after 6 PM" style={{ marginTop: 6 }} />
            <div className="settings-actions"><Button loading={busy === 'request'} disabled={details.trim().length < 5} onClick={sendRequest}>Send request</Button></div>
          </section>
        )}

        <section className="card card-pad" id="review">
          <h2 className="card-title">Reviews</h2>
          {!s.mine && (
            <div className="review-form">
              <p className="small muted">{myReview ? 'Update your review' : 'Used this service? Rate it for your neighbours.'}</p>
              <StarInput value={rating} onChange={setRating} />
              <textarea className="textarea" maxLength={1000} value={review} onChange={(e) => setReview(e.target.value)} placeholder="What went well? What could be better?" aria-label="Review text" />
              <div className="settings-actions" style={{ marginTop: 8 }}><Button loading={busy === 'review'} disabled={!rating} onClick={sendReview}>{myReview ? 'Update review' : 'Post review'}</Button></div>
            </div>
          )}
          {data.reviews.length === 0 ? <p className="small muted" style={{ marginTop: 12 }}>No reviews yet.</p> : (
            <ul className="reviews">
              {data.reviews.map((r) => (
                <li key={r.id}>
                  <Avatar user={r.author} size={34} />
                  <div style={{ flex: 1 }}>
                    <strong className="small">{r.author?.name}</strong> <Stars value={r.rating} size={12} /> <span className="tiny muted">{timeAgo(r.createdAt)}</span>
                    {r.text && <p className="small">{r.text}</p>}
                  </div>
                  {(r.mine || can(user, 'content:moderate')) && <button className="icon-btn" aria-label="Delete review" onClick={() => removeReview(r.id)}><Trash2 size={15} /></button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {editing && <ServiceForm initial={{ id: s.id, name: s.name, category: s.category, description: s.description, priceInfo: s.priceInfo ?? '', hours: s.hours ?? '' }} onClose={() => setEditing(false)} onSaved={load} />}
    </div>
  );
}
