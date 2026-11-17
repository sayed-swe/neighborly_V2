import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, MapPin, Plus, Siren } from 'lucide-react'
import { createAlert, getAlerts, getNotifications, markAllNotificationsRead, markNotificationRead, updateAlert } from '../lib/api'
import { SEVERITIES } from '../lib/constants'
import { labelize, timeAgo } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Avatar, Empty, ErrorText, Field, Modal, Spinner } from '../components/ui'
import { LocationField } from '../components/FormBits'
import { t } from '../lib/i18n'

const NOTIF_ICON = { emergency: '🚨', reaction: '👍', comment: '💬', share: '🔁', event: '📅', help_request: '🤝', message: '✉️', system: '📣', report: '🛡️' }

export default function Alerts() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'notifications' ? 'notifications' : 'alerts'
  return (
    <div className="page page-narrow">
      <div className="page-head"><div><h2>{t('Alerts')}</h2><p>{t('Emergency alerts for your area and your personal notifications.')}</p></div></div>
      <div className="tabs">
        <button className={`tab ${tab === 'alerts' ? 'active' : ''}`} onClick={() => setParams({})}><Siren size={16} /> {t('Emergency alerts')}</button>
        <button className={`tab ${tab === 'notifications' ? 'active' : ''}`} onClick={() => setParams({ tab: 'notifications' })}><Bell size={16} /> {t('Notifications')}</button>
      </div>
      {tab === 'alerts' ? <EmergencyAlerts /> : <Notifications />}
    </div>
  )
}

function EmergencyAlerts() {
  const { profile, isAdmin } = useAuth()
  const toast = useToast()
  const [status, setStatus] = useState('active')
  const [alerts, setAlerts] = useState(null)
  const [creating, setCreating] = useState(false)
  const load = () => getAlerts({ status }).then(setAlerts).catch(() => setAlerts([]))
  useEffect(() => { setAlerts(null); load() }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  const resolve = async (a) => { try { await updateAlert(a.id, { status: 'resolved' }); toast(t('Alert marked resolved')); load() } catch (e) { toast(e.message, 'error') } }

  return (
    <>
      <div className="toolbar">
        <div className="chips">
          <button className={`chip ${status === 'active' ? 'active' : ''}`} onClick={() => setStatus('active')}>{t('Active')}</button>
          <button className={`chip ${status === 'resolved' ? 'active' : ''}`} onClick={() => setStatus('resolved')}>{t('Resolved')}</button>
        </div>
        <button className="btn btn-danger" style={{ marginLeft: 'auto' }} onClick={() => setCreating(true)}><Plus size={18} /> {t('Raise an alert')}</button>
      </div>
      {alerts === null ? <Spinner /> : alerts.length === 0 ? (
        <div className="card"><Empty icon={CheckCircle2} title={status === 'active' ? t('All clear') : t('No resolved alerts')} text={status === 'active' ? t('No active emergencies in your area right now.') : ''} /></div>
      ) : (
        <div className="list">
          {alerts.map((a) => (
            <div key={a.id} className={`alert-card ${a.severity}`} style={{ padding: 16 }}>
              <div className="flex between gap-12 wrap">
                <h4 style={{ fontSize: 17 }}><AlertTriangle size={18} /> {a.title}</h4>
                <span className="pill dark">{labelize(a.severity)}</span>
              </div>
              <p style={{ fontSize: 15, marginTop: 6, whiteSpace: 'pre-wrap' }}>{a.message}</p>
              <div className="meta-row">
                {a.location_name && <span><MapPin size={13} /> {a.location_name}</span>}
                {a.neighborhood && <span>🏘️ {a.neighborhood.name}</span>}
                <span>{t('Raised by')} {a.author?.full_name} · {timeAgo(a.created_at)}</span>
              </div>
              {a.status === 'active' && (a.created_by === profile.id || isAdmin) && (
                <button className="btn btn-outline btn-sm mt-12" onClick={() => resolve(a)}><CheckCircle2 size={15} /> {t('Mark resolved')}</button>
              )}
            </div>
          ))}
        </div>
      )}
      {creating && <AlertForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load() }} />}
    </>
  )
}

export function AlertForm({ onClose, onSaved }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ title: '', message: '', severity: 'medium' })
  const [loc, setLoc] = useState({ latitude: null, longitude: null, location_name: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (!form.title.trim() || !form.message.trim()) return setError(t('Title and message are required.'))
    setBusy(true); setError('')
    try {
      await createAlert({ ...form, title: form.title.trim(), message: form.message.trim(), location_name: loc.location_name?.trim() || null,
        latitude: loc.latitude, longitude: loc.longitude, neighborhood_id: profile.neighborhood_id })
      toast(t('Alert sent to your neighborhood'))
      onSaved()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal title={t('Raise an emergency alert')} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>{t('Cancel')}</button><button className="btn btn-danger" onClick={save} disabled={busy}>{busy ? t('Sending…') : t('Send alert')}</button></>}>
      <ErrorText error={error} />
      <p className="small muted mb-16">{t('Alerts notify everyone in your neighborhood. Use them for real safety issues — fire, gas leak, flooding, missing person. For life-threatening emergencies call')} <b>999</b> {t('first.')}</p>
      <Field label={t('Severity')}>
        <div className="chips">{SEVERITIES.map((s) => <button key={s} type="button" className={`chip ${form.severity === s ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, severity: s }))}>{labelize(s)}</button>)}</div>
      </Field>
      <Field label={t('Title')}><input className="input" value={form.title} onChange={set('title')} maxLength={200} placeholder={t('e.g. Gas leak on Road 3')} /></Field>
      <Field label={t('What\'s happening?')}><textarea className="textarea" value={form.message} onChange={set('message')} maxLength={3000} /></Field>
      <LocationField value={loc} onChange={setLoc} nameLabel={t('Location')} />
    </Modal>
  )
}

function Notifications() {
  const navigate = useNavigate()
  const { refreshCounts } = useOutletContext() || {}
  const [items, setItems] = useState(null)
  const load = () => getNotifications().then(setItems).catch(() => setItems([]))
  useEffect(() => { load() }, [])

  const open = async (n) => {
    if (!n.is_read) { await markNotificationRead(n.id).catch(() => {}); refreshCounts?.() }
    if (n.link) navigate(n.link)
    else load()
  }
  const readAll = async () => { await markAllNotificationsRead().catch(() => {}); load(); refreshCounts?.() }

  if (items === null) return <Spinner />
  return (
    <div className="card">
      <div className="flex between items-center card-pad" style={{ borderBottom: '1px solid var(--line)' }}>
        <span className="bold">{items.filter((n) => !n.is_read).length} {t('unread')}</span>
        <button className="btn btn-ghost btn-sm" onClick={readAll}><CheckCheck size={16} /> {t('Mark all as read')}</button>
      </div>
      {items.length === 0 ? <Empty icon={Bell} title={t('No notifications yet')} text={t('Likes, comments and alerts will show up here.')} /> : (
        <div className="mini-list" style={{ padding: 8 }}>
          {items.map((n) => (
            <button key={n.id} className="mini-item" style={{ border: 0, background: n.is_read ? 'transparent' : 'var(--green-50)', textAlign: 'left', cursor: 'pointer', width: '100%' }} onClick={() => open(n)}>
              <div style={{ position: 'relative' }}>
                <Avatar src={n.actor?.avatar_url} name={n.actor?.full_name || 'Neighborly'} size={46} />
                <span style={{ position: 'absolute', right: -4, bottom: -4, fontSize: 16 }}>{NOTIF_ICON[n.type] || '🔔'}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div className="t" style={{ fontWeight: n.is_read ? 500 : 700 }}>{n.message}</div>
                <div className="s" style={{ color: n.is_read ? undefined : 'var(--green-700)' }}>{timeAgo(n.created_at)}</div>
              </div>
              {!n.is_read && <span className="map-legend-dot" style={{ background: 'var(--green-700)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
