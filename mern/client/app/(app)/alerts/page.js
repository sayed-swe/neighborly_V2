'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCircle2, MapPin, Siren } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { useActivity } from '@/lib/ActivityProvider';
import { can } from '@/lib/permissions';
import { SEVERITY } from '@/lib/categories';
import { timeAgo } from '@/lib/format';
import { Alert, Avatar, Button, Field, Spinner, useToast } from '@/components/ui';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';

function SendAlert({ onClose, onSent }) {
  const toast = useToast();
  const [v, setV] = useState({ title: '', message: '', severity: 'high', place: '', radiusKm: 5, hours: 12 });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k, num) => (e) => setV({ ...v, [k]: num ? Number(e.target.value) : e.target.value });
  async function send() {
    setBusy(true); setErrors({});
    try {
      const { data } = await api.post('/alerts', { ...v, title: v.title.trim(), message: v.message.trim(), ...(v.place.trim() ? { place: v.place.trim() } : { place: undefined }) });
      toast(`Alert sent to ${data.alert.notified} neighbour${data.alert.notified === 1 ? '' : 's'}`); onSent(); onClose();
    } catch (e) { const p = parseError(e); setErrors(p.fields); if (!Object.keys(p.fields).length) toast(p.message, 'error'); setBusy(false); }
  }
  return (
    <Modal title="Send an emergency alert" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><Button className="btn btn-accent" loading={busy} disabled={v.title.trim().length < 2 || v.message.trim().length < 5} onClick={send}><Siren size={16} /> Send to everyone in range</Button></>}>
      <Alert kind="warn">Everyone whose home is within the radius gets notified right away. Use this only for real emergencies.</Alert>
      <Field label="Headline" value={v.title} onChange={set('title')} maxLength={150} placeholder="e.g. Fire at Road 4 market" error={errors.title} data-autofocus />
      <Field as="textarea" label="What’s happening and what should people do?" value={v.message} onChange={set('message')} maxLength={2000} error={errors.message} />
      <Field label="Where" value={v.place} onChange={set('place')} maxLength={200} placeholder="e.g. Road 4, near the market" />
      <div className="field-row">
        <Field as="select" label="Severity" value={v.severity} onChange={set('severity')}>{Object.entries(SEVERITY).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}</Field>
        <Field as="select" label="Reach" value={v.radiusKm} onChange={set('radiusKm', true)}>{[1, 2, 3, 5, 10, 20].map((k) => <option key={k} value={k}>{k} km around you</option>)}</Field>
      </div>
      <Field as="select" label="Show for" value={v.hours} onChange={set('hours', true)}>{[1, 3, 6, 12, 24, 48, 72].map((h) => <option key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</option>)}</Field>
    </Modal>
  );
}

export default function AlertsPage() {
  const { user } = useAuth();
  const { refresh } = useActivity();
  const router = useRouter();
  const toast = useToast();
  const [alerts, setAlerts] = useState(null);
  const [history, setHistory] = useState(false);
  const [notes, setNotes] = useState(null);
  const [next, setNext] = useState(null);
  const [sending, setSending] = useState(false);

  const loadAlerts = useCallback(() => {
    api.get('/alerts', { params: history ? { history: '1' } : {} }).then(({ data }) => setAlerts(data.alerts)).catch(() => setAlerts([]));
  }, [history]);
  useEffect(loadAlerts, [loadAlerts]);
  useEffect(() => {
    api.get('/notifications', { params: { limit: 20 } }).then(({ data }) => { setNotes(data.notifications); setNext(data.next); }).catch(() => setNotes([]));
  }, []);

  async function more() {
    const { data } = await api.get('/notifications', { params: { limit: 20, before: next } });
    setNotes((c) => [...c, ...data.notifications]); setNext(data.next);
  }
  async function readAll() {
    await api.post('/notifications/read-all'); setNotes((c) => c.map((n) => ({ ...n, read: true }))); refresh();
  }
  async function resolve(a) {
    try { await api.patch(`/alerts/${a.id}/resolve`); toast('Alert marked resolved'); loadAlerts(); refresh(); } catch (e) { toast(parseError(e).message, 'error'); }
  }
  function open(n) {
    if (!n.read) api.post(`/notifications/${n.id}/read`).then(refresh).catch(() => {});
    setNotes((c) => c.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    if (n.link && n.link !== '/alerts') router.push(n.link);
  }

  return (
    <div className="fpage">
      <PageHeader icon={Siren} title="Alerts" subtitle="Emergency alerts near you and your notifications."
        action={can(user, 'alert:broadcast') && <button className="btn btn-accent" onClick={() => setSending(true)}><Siren size={17} /> Send emergency alert</button>} />

      <section aria-labelledby="em-h">
        <div className="card-head"><h2 id="em-h" className="card-title">{history ? 'Alerts in the last 30 days' : 'Active emergency alerts'}</h2>
          <button className="link small" onClick={() => setHistory(!history)}>{history ? 'Show active only' : 'Show recent history'}</button></div>
        {!alerts ? <Spinner /> : alerts.length === 0 ? (
          <div className="card all-clear"><CheckCircle2 size={22} /><span><strong>All clear.</strong> No emergency alerts in your area right now.</span></div>
        ) : (
          <div className="em-list">
            {alerts.map((a) => (
              <article key={a.id} className={`em card sev-${a.severity} ${a.status !== 'active' ? 'is-done' : ''}`}>
                <header>
                  <span className={`badge ${SEVERITY[a.severity][0]}`}>{SEVERITY[a.severity][1]}</span>
                  {a.status !== 'active' && <span className="badge">Resolved</span>}
                  <span className="tiny muted" style={{ marginLeft: 'auto' }}>{timeAgo(a.createdAt)}</span>
                </header>
                <h3>{a.title}</h3>
                <p>{a.message}</p>
                <p className="small muted"><MapPin size={13} style={{ verticalAlign: '-2px' }} /> {a.place || a.areaName}{a.distanceKm != null ? ` · ${a.distanceKm} km from you` : ''} · sent by {a.createdBy?.name} ({a.createdBy?.role}) to {a.notified} neighbours</p>
                {a.canResolve && <div className="report-actions"><button className="btn btn-sm" onClick={() => resolve(a)}><CheckCircle2 size={15} /> Mark resolved</button></div>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="notifications" id="notifications" className="card">
        <div className="card-head" style={{ padding: '16px 18px 0' }}><h2 id="nt-h" className="card-title"><Bell size={17} /> Notifications</h2>
          {notes?.some((n) => !n.read) && <button className="link small" onClick={readAll}>Mark all read</button>}</div>
        {!notes ? <div style={{ padding: 18 }}><Spinner /></div> : notes.length === 0 ? <p className="small muted" style={{ padding: 18 }}>Nothing yet. Reactions, comments, RSVPs, offers and requests will show up here.</p> : (
          <ul className="note-list">
            {notes.map((n) => (
              <li key={n.id}><button className={n.read ? '' : 'is-unread'} onClick={() => open(n)}>
                {n.actor ? <Avatar user={n.actor} size={38} /> : <span className="bell-sys">⚠</span>}
                <span><span className="bell-msg">{n.message}</span><span className="tiny muted">{timeAgo(n.createdAt)}</span></span>
              </button></li>
            ))}
          </ul>
        )}
        {next && <div className="fb-more"><button className="btn btn-sm" onClick={more}>Load more</button></div>}
      </section>
      {sending && <SendAlert onClose={() => setSending(false)} onSent={() => { loadAlerts(); refresh(); }} />}
    </div>
  );
}
