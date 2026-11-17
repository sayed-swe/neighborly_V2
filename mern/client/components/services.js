'use client';
import { useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, MapPin } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { label } from '@/lib/categories';
import { SERVICE_CATEGORIES } from '@/lib/schemas';
import { Avatar, Button, Field, useToast } from '@/components/ui';
import Modal from '@/components/Modal';
import { Stars } from '@/components/Stars';

export function ServiceForm({ initial, onClose, onSaved }) {
  const toast = useToast();
  const [v, setV] = useState({ name: '', category: '', description: '', priceInfo: '', hours: '', ...initial });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  async function save() {
    setBusy(true); setErrors({});
    const body = { name: v.name.trim(), category: v.category, description: v.description.trim(), ...(v.priceInfo.trim() && { priceInfo: v.priceInfo.trim() }), ...(v.hours.trim() && { hours: v.hours.trim() }) };
    try {
      const { data } = initial?.id ? await api.patch(`/services/${initial.id}`, body) : await api.post('/services', body);
      toast(initial?.id ? 'Service updated' : 'Service listed'); onSaved(data.service); onClose();
    } catch (e) { const p = parseError(e); setErrors(p.fields); if (!Object.keys(p.fields).length) toast(p.message, 'error'); setBusy(false); }
  }
  return (
    <Modal title={initial?.id ? 'Edit service' : 'List a service'} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><Button loading={busy} onClick={save} disabled={!v.name.trim() || !v.category}>Save</Button></>}>
      <Field label="Service name" value={v.name} onChange={set('name')} maxLength={100} placeholder="e.g. Electrical repairs & wiring" error={errors.name} data-autofocus />
      <Field as="select" label="Category" value={v.category} onChange={set('category')} error={errors.category}>
        <option value="" disabled>Choose…</option>{SERVICE_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </Field>
      <Field as="textarea" label="What you offer" value={v.description} onChange={set('description')} maxLength={1500} placeholder="Services, areas you cover, anything neighbours should know." error={errors.description} />
      <div className="field-row">
        <Field label="Price" value={v.priceInfo} onChange={set('priceInfo')} maxLength={120} placeholder="e.g. Visit ৳300" />
        <Field label="Hours" value={v.hours} onChange={set('hours')} maxLength={120} placeholder="e.g. 9 AM – 9 PM daily" />
      </div>
    </Modal>
  );
}

export function ServiceCard({ s }) {
  return (
    <Link href={`/services/${s.id}`} className="svc card">
      <div className="svc-top">
        <Avatar user={s.provider} size={44} />
        <div style={{ minWidth: 0 }}>
          <strong className="svc-name">{s.name} {s.verified && <BadgeCheck size={16} className="verified" aria-label="Verified" />}</strong>
          <span className="tiny muted">{s.provider?.business || s.provider?.name} · {label(SERVICE_CATEGORIES, s.category)}</span>
        </div>
      </div>
      <p className="svc-desc small">{s.description || 'No description yet.'}</p>
      <div className="svc-foot tiny">
        {s.ratingCount ? <span><Stars value={s.rating} size={13} /> <strong>{s.rating}</strong> <span className="muted">({s.ratingCount})</span></span> : <span className="muted">No reviews yet</span>}
        {s.priceInfo && <span className="muted">{s.priceInfo}</span>}
        {s.distanceKm != null && <span className="muted"><MapPin size={12} /> {s.distanceKm} km</span>}
        {!s.active && <span className="badge">Paused</span>}
      </div>
    </Link>
  );
}

