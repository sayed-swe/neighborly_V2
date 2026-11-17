'use client';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { prepareImage } from '@/lib/images';
import { CATEGORIES, CATEGORY_KEYS } from '@/lib/categories';
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
  const [images, setImages] = useState([]); // { url, uploading?, error? }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const uploading = images.some((i) => i.uploading);
  const canPost = (text.trim() || images.some((i) => i.url)) && !uploading && !busy;

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
      if (category === 'sale' && price !== '') body.price = Number(price);
      const { data } = await api.post('/posts', body);
      onPosted(data.post);
      onClose();
    } catch (err) {
      const e = parseError(err);
      setError(e.fields?.text ?? e.fields?.price ?? e.message);
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

      <label htmlFor="composer-text" className="sr-only">Post text</label>
      <textarea id="composer-text" data-autofocus className="composer-text" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={CATEGORIES[category].placeholder} />
      <div className="composer-count tiny muted">{text.length}/2000</div>

      {category === 'sale' && (
        <div className="field" style={{ marginTop: 8 }}>
          <label className="label" htmlFor="price">Price in ৳ <span className="tiny muted">0 = free</span></label>
          <input id="price" className="input" type="number" inputMode="numeric" min="0" max="100000000" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 4500" />
        </div>
      )}

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
