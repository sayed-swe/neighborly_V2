import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2, MapPin, PackageSearch, Plus, Search, Trash2 } from 'lucide-react'
import { createLostFound, deleteLostFound, getLostFoundItem, getLostFound, updateLostFound, uploadImage } from '../lib/api'
import { formatDate, timeAgo } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Empty, ErrorText, Field, Modal, Spinner, StatusPill } from '../components/ui'
import { ContactFields, ContactLinks, ImagePicker, LocationField } from '../components/FormBits'
import { t } from '../lib/i18n'
import CommentSection from '../components/CommentSection'
import OwnerBar from '../components/OwnerBar'

export default function LostFound() {
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState(null)
  const [type, setType] = useState('')
  const [status, setStatus] = useState('open')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(null)
  const openId = params.get('item')

  const load = () => getLostFound({ type: type || undefined, status: status || undefined, search: q || undefined }).then(setItems).catch(() => setItems([]))
  useEffect(() => { setItems(null); load() }, [type, status, q]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page">
      <div className="page-head">
        <div><h2>{t('Lost & found')}</h2><p>{t('Lost something nearby, or found something that isn\'t yours? Post it here.')}</p></div>
        <div className="flex gap-8">
          <button className="btn btn-outline" onClick={() => setCreating('found')}><Plus size={18} /> {t('I found something')}</button>
          <button className="btn btn-primary" onClick={() => setCreating('lost')}><Plus size={18} /> {t('I lost something')}</button>
        </div>
      </div>
      <div className="tabs">
        {[['', 'All'], ['lost', 'Lost'], ['found', 'Found']].map(([v, l]) => (
          <button key={l} className={`tab ${type === v ? 'active' : ''}`} onClick={() => setType(v)}>{l}</button>
        ))}
      </div>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setQ(search.trim()) }}>
        <div className="search"><Search size={18} color="var(--muted)" /><input placeholder={t('Search items or places')} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="chips">
          <button type="button" className={`chip ${status === 'open' ? 'active' : ''}`} onClick={() => setStatus('open')}>{t('Still open')}</button>
          <button type="button" className={`chip ${status === 'resolved' ? 'active' : ''}`} onClick={() => setStatus('resolved')}>{t('Reunited ✓')}</button>
        </div>
      </form>

      {items === null ? <Spinner /> : items.length === 0 ? (
        <div className="card"><Empty icon={PackageSearch} title={t('Nothing reported')} text={t('Good news — or nobody has posted yet.')} /></div>
      ) : (
        <div className="list">
          {items.map((it) => (
            <div key={it.id} className="card list-item" style={{ cursor: 'pointer' }} onClick={() => setParams({ item: it.id })}>
              {it.image_url ? <img className="thumb-sq" src={it.image_url} alt="" /> : <div className="thumb-sq"><PackageSearch size={30} /></div>}
              <div className="grow">
                <div className="flex gap-6 items-center wrap">
                  <span className={`pill ${it.report_type === 'lost' ? 'red' : 'green'}`}>{it.report_type === 'lost' ? t('Lost') : t('Found')}</span>
                  {it.status === 'resolved' && <StatusPill value="resolved" />}
                </div>
                <h4 className="mt-8">{it.item_name}</h4>
                <p className="muted clamp-2 small">{it.description}</p>
                <div className="meta-row">
                  <span><MapPin size={13} /> {it.location}</span>
                  {it.date_occurred && <span><CalendarDays size={13} /> {formatDate(it.date_occurred)}</span>}
                  <span>{t('by')} {it.author?.full_name} · {timeAgo(it.created_at)}</span>
                </div>
                {(it.contact_phone || it.contact_email) && <div className="mt-8"><ContactLinks phone={it.contact_phone} email={it.contact_email} /></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && <LostFoundForm reportType={creating} onClose={() => setCreating(null)} onSaved={() => { setCreating(null); load() }} />}
      {openId && <LostFoundDetail id={Number(openId)} onClose={() => setParams({})} onChanged={load} />}
    </div>
  )
}

function LostFoundDetail({ id, onClose, onChanged }) {
  const { profile, isAdmin } = useAuth()
  const toast = useToast()
  const [item, setItem] = useState(undefined)
  const load = () => getLostFoundItem(id).then(setItem).catch(() => setItem(null))
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  const mine = item && item.user_id === profile.id

  const resolve = async () => {
    try { await updateLostFound(id, { status: item.status === 'open' ? 'resolved' : 'open' }); load(); onChanged() } catch (e) { toast(e.message, 'error') }
  }
  const remove = async () => {
    if (!confirm(t('Delete this report?'))) return
    try { await deleteLostFound(id); onChanged(); onClose() } catch (e) { toast(e.message, 'error') }
  }

  return (
    <Modal title={item ? (item.report_type === 'lost' ? t('Lost item') : t('Found item')) : t('Lost & found')} onClose={onClose} wide>
      {item === undefined ? <Spinner /> : item === null ? <Empty icon={PackageSearch} title={t('Not found')} /> : (
        <>
          {item.image_url && <img src={item.image_url} alt="" style={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 12 }} />}
          <div className="flex gap-6 mt-12"><span className={`pill ${item.report_type === 'lost' ? 'red' : 'green'}`}>{item.report_type === 'lost' ? t('Lost') : t('Found')}</span><StatusPill value={item.status} /></div>
          <h3 className="mt-8" style={{ fontSize: 22 }}>{item.item_name}</h3>
          <div className="meta-row">
            <span><MapPin size={14} /> {item.location}</span>
            {item.date_occurred && <span><CalendarDays size={14} /> {formatDate(item.date_occurred)}</span>}
          </div>
          <p className="mt-12" style={{ whiteSpace: 'pre-wrap' }}>{item.description}</p>
          <div className="mt-12"><ContactLinks phone={item.contact_phone} email={item.contact_email} small={false} /></div>
          <div className="divider" />
          <OwnerBar person={item.author} createdAt={item.created_at} label={item.report_type === 'lost' ? t('Owner') : t('Finder')} reportType="lost_found" reportId={item.id} />
          {(mine || isAdmin) && (
            <div className="flex gap-8">
              <button className="btn btn-secondary btn-sm" onClick={resolve}><CheckCircle2 size={15} /> {item.status === 'open' ? t('Mark as reunited') : t('Reopen')}</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={remove}><Trash2 size={15} /> {t('Delete')}</button>
            </div>
          )}
          <div className="bold mt-16">{t('Comments')}</div>
          <CommentSection target={{ lost_found_id: item.id }} placeholder={item.report_type === 'lost' ? t('Seen it? Let them know…') : t('Is it yours? Describe it…')} />
        </>
      )}
    </Modal>
  )
}

function LostFoundForm({ reportType, onClose, onSaved }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ report_type: reportType, item_name: '', description: '', date_occurred: new Date().toISOString().slice(0, 10), contact_phone: profile.phone || '', contact_email: '' })
  const [loc, setLoc] = useState({ latitude: null, longitude: null, location_name: '' })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (!form.item_name.trim() || !form.description.trim() || !loc.location_name?.trim()) return setError(t('Item, description and location are required.'))
    if (!form.contact_phone.trim()) return setError(t('Add a contact phone number.'))
    setBusy(true); setError('')
    try {
      const image_url = file ? await uploadImage(file, 'lostfound') : null
      await createLostFound({
        report_type: form.report_type, item_name: form.item_name.trim(), description: form.description.trim(),
        date_occurred: form.date_occurred || null, contact_phone: form.contact_phone.trim(), contact_email: form.contact_email.trim() || null, image_url,
        location: loc.location_name.trim(), latitude: loc.latitude, longitude: loc.longitude, neighborhood_id: profile.neighborhood_id,
      })
      toast(t('Posted — neighbors will see it'))
      onSaved()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal title={form.report_type === 'lost' ? t('Report a lost item') : t('Report a found item')} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>{t('Cancel')}</button><button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? t('Posting…') : t('Post')}</button></>}>
      <ErrorText error={error} />
      <div className="chips mb-16">
        <button type="button" className={`chip ${form.report_type === 'lost' ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, report_type: 'lost' }))}>{t('I lost something')}</button>
        <button type="button" className={`chip ${form.report_type === 'found' ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, report_type: 'found' }))}>{t('I found something')}</button>
      </div>
      <Field label={t('What is it?')}><input className="input" value={form.item_name} onChange={set('item_name')} maxLength={150} placeholder={t('e.g. Black wallet, house keys, cat')} /></Field>
      <Field label={t('Description')}><textarea className="textarea" value={form.description} onChange={set('description')} maxLength={3000} placeholder={t('Colour, brand, any marks…')} /></Field>
      <Field label={t('When?')}><input className="input" type="date" value={form.date_occurred} onChange={set('date_occurred')} /></Field>
      <ContactFields value={form} onChange={setForm} />
      <LocationField value={loc} onChange={setLoc} nameLabel={t('Where?')} placeholder={t('e.g. near the park gate')} />
      <Field label={t('Photo')}><ImagePicker file={file} onChange={setFile} /></Field>
    </Modal>
  )
}
