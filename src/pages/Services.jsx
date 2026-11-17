import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  BadgeCheck, CheckCircle2, ClipboardList, HandHeart, Inbox, MapPin, MessageCircle, Plus, Search, Send, Trash2, Wrench, XCircle,
} from 'lucide-react'
import {
  createHelpRequest, createService, createServiceRequest, deleteHelpRequest, deleteService, getHelpRequests, getServiceCategories,
  getServiceRequests, getServices, respondToHelp, startConversation, updateHelpRequest, updateServiceRequest, uploadImage,
} from '../lib/api'
import { t } from '../lib/i18n'
import { addressLine } from '../lib/address'
import { HELP_TYPES } from '../lib/constants'
import { labelize, timeAgo } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Avatar, Empty, ErrorText, Field, Modal, Spinner, StatusPill } from '../components/ui'
import { ContactFields, ContactLinks, ImagePicker, LocationField } from '../components/FormBits'
import ReportModal from '../components/ReportModal'

export default function Services() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab = ['help', 'requests', 'incoming'].includes(tabParam) ? tabParam : 'services'
  const isProvider = profile.role === 'service_provider'
  const go = (name) => setParams(name === 'services' ? {} : { tab: name })
  return (
    <div className="page">
      <div className="page-head">
        <div><h2>{t('Services & help')}</h2><p>{t('Trusted local pros, and neighbors helping neighbors.')}</p></div>
      </div>
      <div className="tabs">
        <button className={`tab ${tab === 'services' ? 'active' : ''}`} onClick={() => go('services')}><Wrench size={16} /> {t('Local services')}</button>
        <button className={`tab ${tab === 'help' ? 'active' : ''}`} onClick={() => go('help')}><HandHeart size={16} /> {t('Help requests')}</button>
        <button className={`tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => go('requests')}><ClipboardList size={16} /> {t('My requests')}</button>
        {(isProvider || tab === 'incoming') && <button className={`tab ${tab === 'incoming' ? 'active' : ''}`} onClick={() => go('incoming')}><Inbox size={16} /> {t('Requests for me')}</button>}
      </div>
      {tab === 'services' && <ServiceDirectory highlight={params.get('item')} />}
      {tab === 'help' && <HelpBoard highlight={params.get('item')} />}
      {tab === 'requests' && <RequestList side="requester" />}
      {tab === 'incoming' && <RequestList side="provider" />}
    </div>
  )
}

/* ------------------------- Service directory ------------------------- */
function ServiceDirectory({ highlight }) {
  const { profile, isAdmin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [items, setItems] = useState(null)
  const [creating, setCreating] = useState(false)
  const [report, setReport] = useState(null)
  const [requesting, setRequesting] = useState(null)

  useEffect(() => { getServiceCategories().then(setCategories).catch(() => {}) }, [])
  const load = () => getServices({ categoryId: categoryId || undefined, search: q || undefined }).then(setItems).catch(() => setItems([]))
  useEffect(() => { setItems(null); load() }, [categoryId, q]) // eslint-disable-line react-hooks/exhaustive-deps

  const message = async (userId) => {
    try { const id = await startConversation(userId); navigate(`/messages/${id}`) } catch (e) { toast(e.message, 'error') }
  }
  const remove = async (s) => {
    if (!confirm(t('Remove this service?'))) return
    try { await deleteService(s.id); load() } catch (e) { toast(e.message, 'error') }
  }

  return (
    <>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setQ(search.trim()) }}>
        <div className="search"><Search size={18} color="var(--muted)" /><input placeholder={t('Electrician, tutor, plumber…')} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <button type="button" className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setCreating(true)}><Plus size={18} /> {t('List your service')}</button>
      </form>
      <div className="chips mb-16">
        <button className={`chip ${!categoryId ? 'active' : ''}`} onClick={() => setCategoryId('')}>{t('All')}</button>
        {categories.map((c) => <button key={c.id} className={`chip ${String(categoryId) === String(c.id) ? 'active' : ''}`} onClick={() => setCategoryId(c.id)}>{c.name}</button>)}
      </div>

      {items === null ? <Spinner /> : items.length === 0 ? (
        <div className="card"><Empty icon={Wrench} title={t('No services listed yet')} text={t('Are you a plumber, tutor or mechanic? List your service for neighbors.')} /></div>
      ) : (
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {items.map((s) => (
            <div key={s.id} className="card card-pad" style={String(s.id) === highlight ? { borderColor: 'var(--green-600)', boxShadow: '0 0 0 3px rgba(61,116,87,.15)' } : undefined}>
              <div className="flex gap-12">
                {s.image_url ? <img src={s.image_url} alt="" className="thumb-sq" style={{ width: 56, height: 56 }} /> : <div className="icon-tile" style={{ width: 56, height: 56 }}><Wrench size={24} /></div>}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="flex gap-6 items-center wrap">
                    <span className="pill">{s.category?.name}</span>
                    {s.is_verified && <span className="pill green"><BadgeCheck size={12} /> {t('Verified')}</span>}
                  </div>
                  <h4 className="mt-8">{s.service_name}</h4>
                  <Link to={`/profile/${s.provider?.username}`} className="small muted">{t('by')} {s.provider?.full_name}</Link>
                </div>
              </div>
              <p className="small mt-12 clamp-3">{s.description}</p>
              <div className="meta-row">
                {s.price_info && <span className="bold" style={{ color: 'var(--ink)' }}>{s.price_info}</span>}
                {s.neighborhood && <span><MapPin size={13} /> {s.neighborhood.name}</span>}
              </div>
              <div className="flex gap-8 mt-12 wrap">
                {s.provider_id !== profile.id && <button className="btn btn-primary btn-sm" onClick={() => setRequesting(s)}><Send size={15} /> {t('Request service')}</button>}
                <ContactLinks phone={s.contact_phone} email={s.contact_email} />
                {s.provider_id !== profile.id && <button className="btn btn-secondary btn-sm" onClick={() => message(s.provider_id)}><MessageCircle size={15} /> {t('Message')}</button>}
                {s.provider_id !== profile.id && <button className="btn btn-ghost btn-sm" onClick={() => setReport(s.id)}>{t('Report')}</button>}
                {(s.provider_id === profile.id || isAdmin) && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => remove(s)}><Trash2 size={15} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {creating && <ServiceForm categories={categories} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load() }} />}
      {report && <ReportModal targetType="service" targetId={report} onClose={() => setReport(null)} />}
      {requesting && <RequestForm service={requesting} onClose={() => setRequesting(null)} />}
    </>
  )
}

// A resident asks a provider for help; the provider accepts or declines under "Requests for me".
function RequestForm({ service, onClose }) {
  const { profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const place = addressLine(profile)
  const [form, setForm] = useState({ details: '', preferred_time: '', address: place, contact_phone: profile.phone || '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const send = async () => {
    if (!form.details.trim()) return setError(t('Tell the provider what you need.'))
    if (!form.contact_phone.trim()) return setError(t('Add a phone number so the provider can reach you.'))
    setBusy(true); setError('')
    try {
      await createServiceRequest({
        service_id: service.id, details: form.details.trim(), preferred_time: form.preferred_time.trim() || null,
        address: form.address.trim() || null, contact_phone: form.contact_phone.trim(),
      })
      toast(t('Request sent. You will be notified when the provider answers.'))
      onClose(); navigate('/services?tab=requests')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal title={`${t('Request service')}: ${service.service_name}`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>{t('Cancel')}</button><button className="btn btn-primary" onClick={send} disabled={busy}>{busy ? t('Sending…') : t('Send request')}</button></>}>
      <ErrorText error={error} />
      <p className="small muted mb-12">{t('To')}: <b>{service.provider?.full_name}</b></p>
      <Field label={t('What do you need?')}><textarea className="textarea" value={form.details} onChange={set('details')} maxLength={2000} placeholder={t('e.g. Ceiling fan is not working, need someone tomorrow')} /></Field>
      <div className="row">
        <Field label={t('Preferred time')}><input className="input" value={form.preferred_time} onChange={set('preferred_time')} maxLength={120} placeholder={t('e.g. Tomorrow 5 PM')} /></Field>
        <Field label={t('Your phone')}><input className="input" type="tel" value={form.contact_phone} onChange={set('contact_phone')} maxLength={20} /></Field>
      </div>
      <Field label={t('Address (house, road, thana, city corporation)')}><input className="input" value={form.address} onChange={set('address')} maxLength={255} /></Field>
    </Modal>
  )
}

function RequestList({ side }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)
  const [notes, setNotes] = useState({})
  const asProvider = side === 'provider'
  const load = () => getServiceRequests(side).then(setRows).catch(() => setRows([]))
  useEffect(() => { setRows(null); load() }, [side]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (r, status) => {
    try {
      await updateServiceRequest(r.id, asProvider ? { status, provider_note: (notes[r.id] || '').trim() || null } : { status })
      toast(t('Updated')); load()
    } catch (e) { toast(e.message, 'error') }
  }
  const message = async (userId) => {
    try { const id = await startConversation(userId); navigate(`/messages/${id}`) } catch (e) { toast(e.message, 'error') }
  }

  if (rows === null) return <Spinner />
  if (rows.length === 0) return (
    <div className="card"><Empty icon={asProvider ? Inbox : ClipboardList} title={asProvider ? t('No requests yet') : t('You have not requested any service')}
      text={asProvider ? t('When a neighbor requests one of your services it appears here.') : t('Open Local services and press Request service.')} /></div>
  )
  return (
    <div className="list">
      {rows.map((r) => {
        const other = asProvider ? r.requester : r.provider
        const open = r.status === 'pending'
        return (
          <div key={r.id} className="card card-pad">
            <div className="flex gap-12">
              <Link to={`/profile/${other?.username}`}><Avatar src={other?.avatar_url} name={other?.full_name} size={44} /></Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex gap-6 items-center wrap">
                  <span className="bold">{other?.full_name}</span>
                  <span className="small muted">· {timeAgo(r.created_at)}</span>
                  <StatusPill value={r.status} />
                </div>
                <div className="small muted mt-8">{t('Service')}: <b>{r.service?.service_name}</b></div>
                <p className="mt-8" style={{ whiteSpace: 'pre-wrap' }}>{r.details}</p>
                <div className="meta-row">
                  {r.preferred_time && <span>🕒 {r.preferred_time}</span>}
                  {r.address && <span><MapPin size={13} /> {r.address}</span>}
                </div>
                {r.provider_note && <p className="small mt-8"><b>{t('Provider note')}:</b> {r.provider_note}</p>}
                {asProvider
                  ? <div className="mt-8"><ContactLinks phone={r.contact_phone || other?.phone} /></div>
                  : r.status === 'accepted' && <div className="mt-8"><ContactLinks phone={r.service?.contact_phone} email={r.service?.contact_email} /></div>}
              </div>
            </div>
            <div className="flex gap-8 mt-12 wrap" style={{ marginLeft: 56 }}>
              {asProvider && open && (
                <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder={t('Note for the neighbor (optional)')} value={notes[r.id] || ''} maxLength={1000}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
              )}
              {asProvider && open && <button className="btn btn-primary btn-sm" onClick={() => act(r, 'accepted')}><CheckCircle2 size={15} /> {t('Accept')}</button>}
              {asProvider && open && <button className="btn btn-outline btn-sm" onClick={() => act(r, 'declined')}><XCircle size={15} /> {t('Decline')}</button>}
              {asProvider && r.status === 'accepted' && <button className="btn btn-primary btn-sm" onClick={() => act(r, 'completed')}><CheckCircle2 size={15} /> {t('Mark completed')}</button>}
              {!asProvider && (r.status === 'pending' || r.status === 'accepted') && <button className="btn btn-outline btn-sm" onClick={() => act(r, 'cancelled')}>{t('Cancel request')}</button>}
              <button className="btn btn-secondary btn-sm" onClick={() => message(other?.id)}><MessageCircle size={15} /> {t('Message')}</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ServiceForm({ categories, onClose, onSaved }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ service_category_id: categories[0]?.id || '', service_name: '', description: '', contact_phone: profile.phone || '', contact_email: '', price_info: '' })
  const [loc, setLoc] = useState({ latitude: null, longitude: null, location_name: '' })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (!form.service_name.trim() || !form.description.trim() || !form.contact_phone.trim() || !form.service_category_id) return setError(t('Name, category, description and phone are required.'))
    setBusy(true); setError('')
    try {
      const image_url = file ? await uploadImage(file, 'service') : null
      await createService({
        service_category_id: Number(form.service_category_id), service_name: form.service_name.trim(), description: form.description.trim(),
        contact_phone: form.contact_phone.trim(), contact_email: form.contact_email.trim() || null, price_info: form.price_info.trim() || null,
        image_url, latitude: loc.latitude, longitude: loc.longitude, neighborhood_id: profile.neighborhood_id,
      })
      toast(t('Service listed. An admin can verify it.'))
      onSaved()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal title={t('List your service')} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>{t('Cancel')}</button><button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? t('Saving…') : t('Publish')}</button></>}>
      <ErrorText error={error} />
      <div className="row">
        <Field label={t('Category')}>
          <select className="select" value={form.service_category_id} onChange={set('service_category_id')}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </Field>
        <Field label={t('Price info')}><input className="input" value={form.price_info} onChange={set('price_info')} placeholder={t('From 300 BDT')} maxLength={100} /></Field>
      </div>
      <Field label={t('Service name')}><input className="input" value={form.service_name} onChange={set('service_name')} maxLength={150} /></Field>
      <Field label={t('Description')}><textarea className="textarea" value={form.description} onChange={set('description')} maxLength={3000} /></Field>
      <div className="row">
        <Field label={t('Phone')}><input className="input" value={form.contact_phone} onChange={set('contact_phone')} maxLength={20} /></Field>
        <Field label={t('Email (optional)')}><input className="input" type="email" value={form.contact_email} onChange={set('contact_email')} /></Field>
      </div>
      <Field label={t('Photo / logo')}><ImagePicker file={file} onChange={setFile} /></Field>
      <LocationField value={loc} onChange={setLoc} nameLabel={t('Service area (optional)')} placeholder={t('e.g. Ashulia & Savar')} />
    </Modal>
  )
}

/* ------------------------- Help requests ------------------------- */
function HelpBoard({ highlight }) {
  const { profile, isAdmin } = useAuth()
  const toast = useToast()
  const [status, setStatus] = useState('active')
  const [items, setItems] = useState(null)
  const [creating, setCreating] = useState(false)
  const [replies, setReplies] = useState({})

  const load = () => getHelpRequests({ status }).then(setItems).catch(() => setItems([]))
  useEffect(() => { setItems(null); load() }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  const offer = async (h) => {
    const msg = (replies[h.id] || '').trim()
    if (!msg) return
    try { await respondToHelp(h.id, msg); setReplies((r) => ({ ...r, [h.id]: '' })); toast(t('Thanks for helping! 💚')); load() } catch (e) { toast(e.message, 'error') }
  }
  const setHelpStatus = async (h, s) => { try { await updateHelpRequest(h.id, { status: s }); load() } catch (e) { toast(e.message, 'error') } }
  const remove = async (h) => {
    if (!confirm(t('Delete this request?'))) return
    try { await deleteHelpRequest(h.id); load() } catch (e) { toast(e.message, 'error') }
  }

  return (
    <>
      <div className="toolbar">
        <div className="chips">
          <button className={`chip ${status === 'active' ? 'active' : ''}`} onClick={() => setStatus('active')}>{t('Needs help')}</button>
          <button className={`chip ${status === 'resolved' ? 'active' : ''}`} onClick={() => setStatus('resolved')}>{t('Resolved')}</button>
        </div>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setCreating(true)}><Plus size={18} /> {t('Ask for help')}</button>
      </div>
      {items === null ? <Spinner /> : items.length === 0 ? (
        <div className="card"><Empty icon={HandHeart} title={t('No requests right now')} text={t('Need groceries, a ride or a hand with repairs? Ask your neighbors.')} /></div>
      ) : (
        <div className="list">
          {items.map((h) => {
            const mine = h.user_id === profile.id
            return (
              <div key={h.id} className="card card-pad" style={String(h.id) === highlight ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px rgba(224,102,58,.15)' } : undefined}>
                <div className="flex gap-12">
                  <Link to={`/profile/${h.author?.username}`}><Avatar src={h.author?.avatar_url} name={h.author?.full_name} size={44} /></Link>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex gap-6 items-center wrap">
                      <span className="bold">{h.author?.full_name}</span>
                      <span className="small muted">· {timeAgo(h.created_at)}</span>
                      <span className="pill amber">{labelize(h.help_type)}</span>
                      <StatusPill value={h.status} />
                    </div>
                    <h4 className="mt-8">{h.title}</h4>
                    <p className="small mt-8" style={{ whiteSpace: 'pre-wrap' }}>{h.details}</p>
                    <div className="mt-8"><ContactLinks phone={h.contact_phone} email={h.contact_email} /></div>
                  </div>
                </div>

                {h.help_responses?.length > 0 && (
                  <div className="mt-12" style={{ marginLeft: 56 }}>
                    {h.help_responses.map((r) => (
                      <div key={r.id} className="comment" style={{ marginTop: 6 }}>
                        <Avatar src={r.responder?.avatar_url} name={r.responder?.full_name} size={28} />
                        <div className="comment-bubble"><div className="who">{r.responder?.full_name} <span className="muted" style={{ fontWeight: 400 }}>{t('offered help ·')} {timeAgo(r.created_at)}</span></div><div className="text">{r.message}</div></div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-8 mt-12 wrap" style={{ marginLeft: 56 }}>
                  {!mine && h.status !== 'resolved' && h.status !== 'closed' && (
                    <form className="comment-input" style={{ flex: 1, minWidth: 220 }} onSubmit={(e) => { e.preventDefault(); offer(h) }}>
                      <input placeholder={t('I can help — write a message…')} value={replies[h.id] || ''} onChange={(e) => setReplies((r) => ({ ...r, [h.id]: e.target.value }))} maxLength={2000} />
                      <button type="submit" disabled={!(replies[h.id] || '').trim()}><HandHeart size={18} /></button>
                    </form>
                  )}
                  {(mine || isAdmin) && h.status !== 'resolved' && <button className="btn btn-secondary btn-sm" onClick={() => setHelpStatus(h, 'resolved')}><CheckCircle2 size={15} /> {t('Mark resolved')}</button>}
                  {(mine || isAdmin) && h.status === 'resolved' && <button className="btn btn-secondary btn-sm" onClick={() => setHelpStatus(h, 'open')}>{t('Reopen')}</button>}
                  {(mine || isAdmin) && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => remove(h)}><Trash2 size={15} /></button>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {creating && <HelpForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load() }} />}
    </>
  )
}

function HelpForm({ onClose, onSaved }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ help_type: 'grocery', title: '', details: '', contact_phone: profile.phone || '', contact_email: '' })
  const [loc, setLoc] = useState({ latitude: null, longitude: null, location_name: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (!form.title.trim() || !form.details.trim()) return setError(t('Add a title and details.'))
    if (!form.contact_phone.trim()) return setError(t('Add a contact phone number.'))
    setBusy(true); setError('')
    try {
      await createHelpRequest({ ...form, title: form.title.trim(), details: form.details.trim(), contact_phone: form.contact_phone.trim(), contact_email: form.contact_email.trim() || null, latitude: loc.latitude, longitude: loc.longitude, neighborhood_id: profile.neighborhood_id })
      toast(t('Your neighbors have been asked for help'))
      onSaved()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal title={t('Ask your neighbors for help')} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>{t('Cancel')}</button><button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? t('Posting…') : t('Post request')}</button></>}>
      <ErrorText error={error} />
      <Field label={t('What kind of help?')}>
        <div className="chips">{HELP_TYPES.map((h) => <button key={h} type="button" className={`chip ${form.help_type === h ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, help_type: h }))}>{labelize(h)}</button>)}</div>
      </Field>
      <Field label={t('Title')}><input className="input" value={form.title} onChange={set('title')} maxLength={200} placeholder={t('e.g. Need a ride to the hospital tomorrow')} /></Field>
      <Field label={t('Details')}><textarea className="textarea" value={form.details} onChange={set('details')} maxLength={5000} /></Field>
      <ContactFields value={form} onChange={setForm} />
      <LocationField value={loc} onChange={setLoc} nameLabel={t('Where (optional)')} />
    </Modal>
  )
}
