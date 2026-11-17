import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, Check, Clock, MapPin, Plus, Star, Trash2, Users } from 'lucide-react'
import { createEvent, deleteEvent, getEvent, getEvents, setRsvp, updateEvent, uploadImage } from '../lib/api'
import { formatDateTime, toLocalInput } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Avatar, Empty, ErrorText, Field, Modal, Spinner, StatusPill } from '../components/ui'
import { ImagePicker, LocationField } from '../components/FormBits'
import CommentSection from '../components/CommentSection'
import { t } from '../lib/i18n'

export default function Events() {
  const { profile } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [when, setWhen] = useState('upcoming')
  const [events, setEvents] = useState(null)
  const [creating, setCreating] = useState(false)
  const openId = params.get('item')

  const load = () => getEvents({ when }).then(setEvents).catch(() => setEvents([]))
  useEffect(() => { setEvents(null); load() }, [when]) // eslint-disable-line react-hooks/exhaustive-deps

  const rsvp = async (ev, value) => {
    const mineNow = ev.event_participants?.find((p) => p.user_id === profile.id)?.rsvp
    const next = mineNow === value ? null : value
    try { await setRsvp(ev.id, next); load() } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><h2>{t('Events')}</h2><p>{t('Clean-ups, meetups, prayers, games — what\'s on around you.')}</p></div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={18} /> {t('Create event')}</button>
      </div>
      <div className="tabs">
        <button className={`tab ${when === 'upcoming' ? 'active' : ''}`} onClick={() => setWhen('upcoming')}>{t('Upcoming')}</button>
        <button className={`tab ${when === 'past' ? 'active' : ''}`} onClick={() => setWhen('past')}>{t('Past')}</button>
      </div>

      {events === null ? <Spinner /> : events.length === 0 ? (
        <div className="card"><Empty icon={CalendarDays} title={when === 'upcoming' ? t('No upcoming events') : t('No past events')} text={t('Organise something for your neighbors.')} /></div>
      ) : (
        <div className="list">
          {events.map((ev) => {
            const d = new Date(ev.starts_at)
            const going = ev.event_participants?.filter((p) => p.rsvp === 'going').length || 0
            const interested = ev.event_participants?.filter((p) => p.rsvp === 'interested').length || 0
            const mine = ev.event_participants?.find((p) => p.user_id === profile.id)?.rsvp
            return (
              <div key={ev.id} className="card list-item">
                <div className="date-badge">
                  <div className="m">{d.toLocaleString(undefined, { month: 'short' })}</div>
                  <div className="d">{d.getDate()}</div>
                </div>
                <div className="grow" style={{ cursor: 'pointer' }} onClick={() => setParams({ item: ev.id })}>
                  <div className="flex gap-6 items-center">{ev.status !== 'upcoming' && <StatusPill value={ev.status} />}</div>
                  <h4>{ev.title}</h4>
                  <div className="meta-row">
                    <span><Clock size={13} /> {formatDateTime(ev.starts_at)}</span>
                    <span><MapPin size={13} /> {ev.location}</span>
                    <span><Users size={13} /> {going} {t('going ·')} {interested} {t('interested')}</span>
                  </div>
                  <p className="muted small clamp-2 mt-8">{ev.description}</p>
                </div>
                {when === 'upcoming' && (
                  <div className="flex gap-6" style={{ flexDirection: 'column', alignSelf: 'center' }}>
                    <button className={`btn btn-sm ${mine === 'going' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => rsvp(ev, 'going')}><Check size={15} /> {t('Going')}</button>
                    <button className={`btn btn-sm ${mine === 'interested' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => rsvp(ev, 'interested')}><Star size={15} /> {t('Interested')}</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {creating && <EventForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load() }} />}
      {openId && <EventDetail id={Number(openId)} onClose={() => setParams({})} onChanged={load} />}
    </div>
  )
}

function EventDetail({ id, onClose, onChanged }) {
  const { profile, isAdmin } = useAuth()
  const toast = useToast()
  const [ev, setEv] = useState(undefined)
  const [editing, setEditing] = useState(false)
  const load = () => getEvent(id).then(setEv).catch(() => setEv(null))
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (editing) return <EventForm event={ev} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); onChanged() }} />
  const mine = ev && ev.created_by === profile.id
  const my = ev?.event_participants?.find((p) => p.user_id === profile.id)?.rsvp

  const rsvp = async (value) => { try { await setRsvp(id, my === value ? null : value); load(); onChanged() } catch (e) { toast(e.message, 'error') } }
  const cancel = async () => { try { await updateEvent(id, { status: 'cancelled' }); load(); onChanged() } catch (e) { toast(e.message, 'error') } }
  const remove = async () => {
    if (!confirm(t('Delete this event?'))) return
    try { await deleteEvent(id); onChanged(); onClose() } catch (e) { toast(e.message, 'error') }
  }

  return (
    <Modal title={t('Event')} onClose={onClose} wide>
      {ev === undefined ? <Spinner /> : ev === null ? <Empty icon={CalendarDays} title={t('Event not found')} /> : (
        <>
          {ev.image_url && <img src={ev.image_url} alt="" style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 12, marginBottom: 14 }} />}
          <div className="small bold" style={{ color: 'var(--accent)', textTransform: 'uppercase' }}>{formatDateTime(ev.starts_at)}{ev.ends_at ? ` – ${formatDateTime(ev.ends_at)}` : ''}</div>
          <h3 style={{ fontSize: 24 }} className="mt-8">{ev.title}</h3>
          <div className="meta-row"><span><MapPin size={14} /> {ev.location}</span>{ev.neighborhood && <span>🏘️ {ev.neighborhood.name}</span>}<StatusPill value={ev.status} /></div>
          <div className="flex gap-8 mt-12 wrap">
            <button className={`btn ${my === 'going' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => rsvp('going')}><Check size={17} /> {t('Going')}</button>
            <button className={`btn ${my === 'interested' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => rsvp('interested')}><Star size={17} /> {t('Interested')}</button>
            {mine && <button className="btn btn-outline" onClick={() => setEditing(true)}>{t('Edit')}</button>}
            {mine && ev.status === 'upcoming' && <button className="btn btn-outline" onClick={cancel}>{t('Cancel event')}</button>}
            {(mine || isAdmin) && <button className="btn btn-ghost" style={{ color: 'var(--red)' }} onClick={remove}><Trash2 size={16} /> {t('Delete')}</button>}
          </div>
          <p className="mt-16" style={{ whiteSpace: 'pre-wrap' }}>{ev.description}</p>
          <div className="divider" />
          <div className="flex items-center gap-8 mb-12">
            <span className="bold">{t('Hosted by')}</span>
            <Link to={`/profile/${ev.creator?.username}`} className="flex items-center gap-8"><Avatar src={ev.creator?.avatar_url} name={ev.creator?.full_name} size={28} /> {ev.creator?.full_name}</Link>
          </div>
          {ev.event_participants?.length > 0 && (
            <>
              <div className="bold mb-12">{ev.event_participants.filter((p) => p.rsvp === 'going').length} {t('going')}{ev.max_participants ? ` (max ${ev.max_participants})` : ''}</div>
              <div className="flex gap-8 wrap mb-12">
                {ev.event_participants.map((p) => (
                  <span key={p.user_id} title={`${p.user?.full_name} · ${p.rsvp}`}><Avatar src={p.user?.avatar_url} name={p.user?.full_name} size={34} /></span>
                ))}
              </div>
            </>
          )}
          <div className="bold mt-12">{t('Discussion')}</div>
          <CommentSection target={{ event_id: ev.id }} placeholder={t('Ask the host or say you\'re coming…')} />
        </>
      )}
    </Modal>
  )
}

function EventForm({ event, onClose, onSaved }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({
    title: event?.title || '', description: event?.description || '',
    starts_at: toLocalInput(event?.starts_at || Date.now() + 86400000), ends_at: event?.ends_at ? toLocalInput(event.ends_at) : '',
    max_participants: event?.max_participants || '',
  })
  const [loc, setLoc] = useState({ latitude: event?.latitude ?? null, longitude: event?.longitude ?? null, location_name: event?.location || '' })
  const [file, setFile] = useState(null)
  const [keep, setKeep] = useState(event?.image_url || null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (!form.title.trim() || !form.description.trim() || !loc.location_name?.trim()) return setError(t('Title, description and location are required.'))
    setBusy(true); setError('')
    try {
      const image_url = file ? await uploadImage(file, 'event') : keep
      const values = {
        title: form.title.trim(), description: form.description.trim(),
        starts_at: new Date(form.starts_at).toISOString(), ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        max_participants: form.max_participants ? Number(form.max_participants) : null,
        location: loc.location_name.trim(), latitude: loc.latitude, longitude: loc.longitude, image_url,
        neighborhood_id: event?.neighborhood_id ?? profile.neighborhood_id,
      }
      if (event) await updateEvent(event.id, values)
      else await createEvent(values)
      toast(event ? t('Event updated') : t('Event created'))
      onSaved()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal title={event ? t('Edit event') : t('Create event')} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>{t('Cancel')}</button><button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? t('Saving…') : t('Save')}</button></>}>
      <ErrorText error={error} />
      <Field label={t('Cover photo')}><ImagePicker file={file} existingUrl={keep} onChange={(f) => { setFile(f); if (!f) setKeep(null) }} /></Field>
      <Field label={t('Event name')}><input className="input" value={form.title} onChange={set('title')} maxLength={200} /></Field>
      <div className="row">
        <Field label={t('Starts')}><input className="input" type="datetime-local" value={form.starts_at} onChange={set('starts_at')} /></Field>
        <Field label={t('Ends (optional)')}><input className="input" type="datetime-local" value={form.ends_at} onChange={set('ends_at')} /></Field>
      </div>
      <LocationField value={loc} onChange={setLoc} nameLabel={t('Location')} placeholder={t('e.g. Community hall')} />
      <Field label={t('Details')}><textarea className="textarea" value={form.description} onChange={set('description')} maxLength={5000} /></Field>
      <Field label={t('Max participants (optional)')}><input className="input" type="number" min="1" value={form.max_participants} onChange={set('max_participants')} /></Field>
    </Modal>
  )
}
