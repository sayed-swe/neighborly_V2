'use client';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { prepareImage } from '@/lib/images';
import { CATEGORIES, CATEGORY_KEYS, CONDITIONS, LISTING_KINDS } from '@/lib/categories';
import { Alert, Avatar, Button, Spinner } from '@/components/ui';
import Modal from '@/components/Modal';

const HelpIcon = CATEGORIES.help.icon;
const SaleIcon = CATEGORIES.sale.icon;

/** The “What’s on your mind?” bar on the feed. */
export function ComposerBar({ onOpen }) {
  const { user } = useAuth();
  const first = user.name.split(' ')[0];
  return (
    <section className="composer-bar card" aria-label="Create a post">
      <div className="composer-top">
        <Avatar user={user} size={42} />
        <button className="composer-fake" onClick={() => onOpen()}>What’s on your mind, {first}?</button>
      </div>
      <div className="composer-shortcuts">
        <button onClick={() => onOpen({ photos: true })}><ImagePlus size={19} style={{ color: '#3b8f5e' }} /> Photo</button>
        <button onClick={() => onOpen({ category: 'help' })}><HelpIcon size={19} style={{ color: 'var(--brick)' }} /> Ask for help</button>
        <button onClick={() => onOpen({ category: 'sale' })}><SaleIcon size={19} style={{ color: 'var(--plum)' }} /> Sell something</button>
      </div>
    </section>
  );
}

export default function ComposerModal({ preset = {}, onClose, onPosted }) {
  const { user } = useAuth();
  const [category, setCategory] = useState(preset.category ?? 'general');
  const [text, setText] = useState('');
  const [price, setPrice] = useState('');
  const [title, setTitle] = useState('');
  const [listing, setListing] = useState({ kind: 'sell', condition: '' });
  const [lost, setLost] = useState({ kind: 'lost', place: '', date: '' });
  const [event, setEvent] = useState({ startsAt: '', endsAt: '', place: '', capacity: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const typed = ['sale', 'lost-found', 'event'].includes(category);
  const [images, setImages] = useState([]); // { url, uploading?, error? }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const uploading = images.some((i) => i.uploading);
  const hasContent = typed ? title.trim().length >= 2 : (text.trim() || images.some((i) => i.url));
  const canPost = hasContent && !uploading && !busy;

  async function addFiles(fileList) {
    const files = [...fileList].slice(0, 4 - images.length);
    for (const file of files) {
      const key = `${file.name}-${Math.random()}`;
      setImages((cur) => [...cur, { key, preview: URL.createObjectURL(file), uploading: true }]);
      try {
        const blob = await prepareImage(file);
        const form = new FormData();
        form.append('image', blob, 'photo.jpg');
        const { data } = await api.post('/uploads', form);
        setImages((cur) => cur.map((i) => (i.key === key ? { ...i, uploading: false, url: data.url } : i)));
      } catch (err) {
        setImages((cur) => cur.filter((i) => i.key !== key));
        setError(err.response ? parseError(err).message : err.message);
      }
    }
  }
  useEffect(() => { if (preset.photos) { const t = setTimeout(() => fileRef.current?.click(), 200); return () => clearTimeout(t); } return undefined; }, [preset.photos]);

  async function submit() {
    setBusy(true); setError('');
    try {
      const body = { text: text.trim(), category, images: images.filter((i) => i.url).map((i) => i.url) };
      if (typed) body.title = title.trim();
      if (category === 'sale') {
        body.listing = { kind: listing.kind, ...(listing.condition && { condition: listing.condition }) };
        if (listing.kind === 'free') body.price = 0;
        else if (price !== '' && listing.kind !== 'wanted') body.price = Number(price);
      }
      if (category === 'lost-found') body.lost = { kind: lost.kind, place: lost.place.trim(), ...(lost.date && { date: new Date(lost.date).toISOString() }) };
      if (category === 'event') {
        body.event = {
          startsAt: event.startsAt ? new Date(event.startsAt).toISOString() : '', place: event.place.trim(),
          ...(event.endsAt && { endsAt: new Date(event.endsAt).toISOString() }), ...(event.capacity && { capacity: Number(event.capacity) }),
        };
      }
      setFieldErrors({});
      const { data } = await api.post('/posts', body);
      onPosted(data.post);
      onClose();
    } catch (err) {
      const e = parseError(err);
      setFieldErrors(e.fields ?? {});
      const first = Object.values(e.fields ?? {})[0];
      setError(first ?? e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Create post" onClose={onClose} size="md"
      footer={<Button className="btn btn-primary btn-block btn-lg" loading={busy} disabled={!canPost} onClick={submit}>{uploading ? 'Uploading photo…' : 'Post'}</Button>}>
      <div className="composer-who">
        <Avatar user={user} size={44} />
        <div><strong>{user.name}</strong><span className="tiny muted" style={{ display: 'block' }}>Visible to neighbours within {user.location?.radiusKm ?? 3} km · {user.location?.areaName}</span></div>
      </div>

      <div className="cat-pills" role="radiogroup" aria-label="Post type">
        {CATEGORY_KEYS.map((k) => {
          const c = CATEGORIES[k]; const Icon = c.icon;
          return <button key={k} type="button" role="radio" aria-checked={category === k} className={`cat-pill ${category === k ? 'is-on' : ''}`} onClick={() => setCategory(k)}><Icon size={15} /> {c.short}</button>;
        })}
      </div>

      {typed && (
        <div className="typed-fields">
          <div className="field">
            <label className="label" htmlFor="c-title">{category === 'lost-found' ? 'What is the item?' : category === 'event' ? 'Event name' : 'What are you listing?'}</label>
            <input id="c-title" className="input" maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={fieldErrors.title ? 'true' : undefined}
              placeholder={category === 'lost-found' ? 'e.g. Grey cat with a red collar' : category === 'event' ? 'e.g. Lake cleanup' : 'e.g. Mountain bicycle, 21 gears'} />
          </div>

          {category === 'sale' && (
            <>
              <div className="seg seg-sm" role="radiogroup" aria-label="Listing type">
                {LISTING_KINDS.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={listing.kind === v} className={listing.kind === v ? 'is-active' : ''} onClick={() => setListing({ ...listing, kind: v })}>{l}</button>)}
              </div>
              <div className="field-row" style={{ marginTop: 0 }}>
                {listing.kind !== 'free' && listing.kind !== 'wanted' && (
                  <div className="field"><label className="label" htmlFor="price">Price in ৳</label>
                    <input id="price" className="input" type="number" inputMode="numeric" min="0" max="100000000" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 4500" /></div>
                )}
                <div className="field"><label className="label" htmlFor="cond">Condition</label>
                  <select id="cond" className="select" value={listing.condition} onChange={(e) => setListing({ ...listing, condition: e.target.value })}>
                    <option value="">Not specified</option>{CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select></div>
              </div>
            </>
          )}

          {category === 'lost-found' && (
            <>
              <div className="seg seg-sm" role="radiogroup" aria-label="Lost or found">
                {[['lost', 'I lost something'], ['found', 'I found something']].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={lost.kind === v} className={lost.kind === v ? 'is-active' : ''} onClick={() => setLost({ ...lost, kind: v })}>{l}</button>)}
              </div>
              <div className="field-row" style={{ marginTop: 0 }}>
                <div className="field"><label className="label" htmlFor="lf-place">Where?</label>
                  <input id="lf-place" className="input" maxLength={200} value={lost.place} onChange={(e) => setLost({ ...lost, place: e.target.value })} placeholder="e.g. Near the park gate" aria-invalid={fieldErrors.lost ? 'true' : undefined} /></div>
                <div className="field"><label className="label" htmlFor="lf-date">When?</label>
                  <input id="lf-date" className="input" type="date" max={new Date().toISOString().slice(0, 10)} value={lost.date} onChange={(e) => setLost({ ...lost, date: e.target.value })} /></div>
              </div>
            </>
          )}

          {category === 'event' && (
            <>
              <div className="field-row" style={{ marginTop: 0 }}>
                <div className="field"><label className="label" htmlFor="ev-start">Starts</label>
                  <input id="ev-start" className="input" type="datetime-local" value={event.startsAt} onChange={(e) => setEvent({ ...event, startsAt: e.target.value })} aria-invalid={fieldErrors.event ? 'true' : undefined} /></div>
                <div className="field"><label className="label" htmlFor="ev-end">Ends <span className="tiny muted">optional</span></label>
                  <input id="ev-end" className="input" type="datetime-local" min={event.startsAt} value={event.endsAt} onChange={(e) => setEvent({ ...event, endsAt: e.target.value })} /></div>
              </div>
              <div className="field-row" style={{ marginTop: 0 }}>
                <div className="field"><label className="label" htmlFor="ev-place">Where?</label>
                  <input id="ev-place" className="input" maxLength={200} value={event.place} onChange={(e) => setEvent({ ...event, place: e.target.value })} placeholder="e.g. Dhanmondi Lake, gate 2" /></div>
                <div className="field"><label className="label" htmlFor="ev-cap">Spots <span className="tiny muted">optional</span></label>
                  <input id="ev-cap" className="input" type="number" min="1" max="100000" value={event.capacity} onChange={(e) => setEvent({ ...event, capacity: e.target.value })} placeholder="No limit" /></div>
              </div>
            </>
          )}
        </div>
      )}

      <label htmlFor="composer-text" className="sr-only">Post text</label>
      <textarea id="composer-text" data-autofocus className="composer-text" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={typed ? 'Add details (optional)…' : CATEGORIES[category].placeholder} style={typed ? { minHeight: 80, fontSize: 16 } : undefined} />
      <div className="composer-count tiny muted">{text.length}/2000</div>


      {images.length > 0 && (
        <div className="composer-images">
          {images.map((i) => (
            <div key={i.key} className="composer-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.preview} alt="" />
              {i.uploading && <span className="composer-img-busy"><Spinner size={22} /></span>}
              <button type="button" aria-label="Remove photo" onClick={() => setImages((cur) => cur.filter((x) => x.key !== i.key))}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="composer-add">
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <button type="button" className="btn btn-sm" disabled={images.length >= 4} onClick={() => fileRef.current?.click()}><ImagePlus size={16} /> Add photos <span className="tiny muted">{images.length}/4</span></button>
        <span className="tiny muted">Location data is removed from photos automatically.</span>
      </div>
      {error && <div style={{ marginTop: 12 }}><Alert kind="error">{error}</Alert></div>}
    </Modal>
  );
}
