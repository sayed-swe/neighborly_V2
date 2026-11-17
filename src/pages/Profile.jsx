import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Calendar, Camera, Flag, Home, MapPin, MessageCircle, Pencil, Phone, Tag, UserX, Wrench } from 'lucide-react'
import {
  getListings, getNeighborhoods, getProfileByUsername, startConversation, updateProfile, uploadImage,
} from '../lib/api'
import { formatDate, formatPrice, labelize } from '../lib/format'
import { t } from '../lib/i18n'
import { CITY_CORPORATIONS } from '../lib/address'
import { LocationField } from '../components/FormBits'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import FeedList from '../components/FeedList'
import { ComposerBox } from '../components/Composer'
import ReportModal from '../components/ReportModal'
import { Avatar, Empty, ErrorText, Field, Modal, Spinner } from '../components/ui'

export default function Profile() {
  const { username } = useParams()
  const { profile: me, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [person, setPerson] = useState(undefined)
  const [tab, setTab] = useState('posts')
  const [modal, setModal] = useState(null)
  const [listings, setListings] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const load = () => getProfileByUsername(username).then(setPerson).catch(() => setPerson(null))
  useEffect(() => { setPerson(undefined); setTab('posts'); load() }, [username]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (tab === 'listings' && person) getListings({ userId: person.id, status: null }).then(setListings).catch(() => setListings([]))
  }, [tab, person])

  if (person === undefined) return <Spinner />
  if (person === null) return <div className="page"><div className="card"><Empty icon={UserX} title={t('User not found')} /></div></div>

  const isMe = person.id === me.id
  const addressParts = [person.house, person.road, person.thana, person.city_corporation, person.postcode].filter(Boolean)

  const message = async () => {
    try { const id = await startConversation(person.id); navigate(`/messages/${id}`) } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div>
      <div className="profile-top">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="profile-cover">{person.cover_url && <img src={person.cover_url} alt="" />}</div>
          <div className="profile-head">
            <Avatar src={person.avatar_url} name={person.full_name} size={168} />
            <div className="grow">
              <h2>{person.full_name}</h2>
              <div className="muted bold">@{person.username}{person.neighborhood ? ` · ${person.neighborhood.name}` : ''}
                {person.role !== 'resident' && <span className={`pill ${person.role === 'admin' ? 'green' : 'blue'}`} style={{ marginLeft: 8 }}>{labelize(person.role)}</span>}
              </div>
            </div>
            <div className="profile-actions">
              {isMe ? (
                <>
                  <button className="btn btn-primary" onClick={() => setModal('edit')}><Pencil size={17} /> {t('Edit profile')}</button>
                </>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={message}><MessageCircle size={17} /> {t('Message')}</button>
                  <button className="btn btn-secondary" onClick={() => setModal('report')} aria-label={t('Report')}><Flag size={17} /></button>
                </>
              )}
            </div>
          </div>
          <div className="profile-tabs">
            <button className={`tab ${tab === 'posts' ? 'active' : ''}`} onClick={() => setTab('posts')}>{t('Posts')}</button>
            <button className={`tab ${tab === 'about' ? 'active' : ''}`} onClick={() => setTab('about')}>{t('About')}</button>
            <button className={`tab ${tab === 'listings' ? 'active' : ''}`} onClick={() => setTab('listings')}>{t('Listings')}</button>
          </div>
        </div>
      </div>

      <div className="page" style={{ paddingTop: 16, maxWidth: 1000 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }} className="profile-grid">
          <div className="card card-pad">
            <div className="card-title mb-12">{t('Intro')}</div>
            {person.bio && <p style={{ textAlign: 'center', marginBottom: 12 }}>{person.bio}</p>}
            <div className="list" style={{ gap: 10 }}>
              {person.neighborhood && <div className="flex gap-8 items-center"><Home size={18} className="muted" /> {t('Lives in')} <b>{person.neighborhood.name}</b></div>}
              {addressParts.length > 0 && <div className="flex gap-8 items-center"><MapPin size={18} className="muted" /> {addressParts.join(', ')}</div>}
              {person.address && <div className="flex gap-8 items-center"><MapPin size={18} className="muted" /> {person.address}</div>}
              {person.show_on_map && person.latitude != null && <div className="flex gap-8 items-center"><MapPin size={18} color="var(--green-700)" /> <Link to={`/map?lat=${person.latitude}&lng=${person.longitude}`} className="link">{t('See on map')}</Link></div>}
              {person.role === 'service_provider' && <div className="flex gap-8 items-center"><Wrench size={18} className="muted" /> <Link to="/services" className="link">{t('Service provider')}</Link></div>}
              {person.phone && <div className="flex gap-8 items-center"><Phone size={18} className="muted" /> {person.phone}</div>}
              <div className="flex gap-8 items-center"><Calendar size={18} className="muted" /> {t('Joined')} {formatDate(person.created_at, { day: undefined })}</div>
            </div>
            {isMe && <button className="btn btn-secondary btn-block mt-16" onClick={() => setModal('edit')}>{t('Edit details')}</button>}
          </div>

          <div className="flex" style={{ flexDirection: 'column', gap: 16 }}>
            {tab === 'posts' && (
              <>
                {isMe && <ComposerBox onPosted={() => setReloadKey((k) => k + 1)} />}
                <FeedList filters={{ userId: person.id }} reloadKey={reloadKey} emptyText={isMe ? t('Share your first post with the neighborhood.') : t('No posts yet.')} />
              </>
            )}
            {tab === 'listings' && (
              listings === null ? <Spinner /> : listings.length === 0 ? <div className="card"><Empty icon={Tag} title={t('No listings')} /></div> : (
                <div className="grid-cards">
                  {listings.map((l) => (
                    <Link key={l.id} to={`/marketplace?item=${l.id}`} className="card item-card">
                      <div className="item-thumb">{l.image_url ? <img src={l.image_url} alt="" /> : <Tag size={30} />}</div>
                      <div className="item-info"><div className="item-price">{formatPrice(l.price, l.listing_type)}</div><div className="item-title">{l.title}</div><div className="item-sub">{labelize(l.status)}</div></div>
                    </Link>
                  ))}
                </div>
              )
            )}
            {tab === 'about' && (
              <div className="card card-pad">
                <div className="list" style={{ gap: 12 }}>
                  <div><div className="small muted">{t('Full name')}</div><div className="bold">{person.full_name}</div></div>
                  <div><div className="small muted">{t('Neighborhood')}</div><div className="bold">{person.neighborhood?.name || '—'}</div></div>
                  <div><div className="small muted">{t('Bio')}</div><div>{person.bio || '—'}</div></div>
                  {person.gender && <div><div className="small muted">{t('Gender')}</div><div>{labelize(person.gender)}</div></div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {modal === 'edit' && <EditProfileModal person={person} onClose={() => setModal(null)} onSaved={(p) => { setModal(null); refreshProfile(); if (p.username !== username) navigate(`/profile/${p.username}`, { replace: true }); else load() }} />}
      {modal === 'report' && <ReportModal targetType="user" targetId={person.id} onClose={() => setModal(null)} />}
      <style>{`@media (max-width: 900px) { .profile-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}

function EditProfileModal({ person, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: person.full_name || '', username: person.username || '', bio: person.bio || '', phone: person.phone || '',
    address: person.address || '', house: person.house || '', road: person.road || '', thana: person.thana || '', city_corporation: person.city_corporation || '', postcode: person.postcode || '', neighborhood_id: person.neighborhood_id || '', gender: person.gender || '', date_of_birth: person.date_of_birth || '',
  })
  const [loc, setLoc] = useState({ latitude: person.latitude ?? null, longitude: person.longitude ?? null, location_name: '' })
  const [showOnMap, setShowOnMap] = useState(!!person.show_on_map)
  const [avatar, setAvatar] = useState(null)
  const [cover, setCover] = useState(null)
  const [neighborhoods, setNeighborhoods] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { getNeighborhoods().then(setNeighborhoods).catch(() => {}) }, [])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setBusy(true); setError('')
    try {
      const values = {
        full_name: form.full_name.trim(), username: form.username.trim().toLowerCase(), bio: form.bio.trim() || null,
        phone: form.phone.trim() || null, address: form.address.trim() || null,
        neighborhood_id: form.neighborhood_id ? Number(form.neighborhood_id) : null,
        gender: form.gender || null, date_of_birth: form.date_of_birth || null,
        house: form.house.trim() || null, road: form.road.trim() || null, thana: form.thana.trim() || null, city_corporation: form.city_corporation || null, postcode: form.postcode.trim() || null,
        latitude: loc.latitude, longitude: loc.longitude, show_on_map: showOnMap && loc.latitude != null,
      }
      if (showOnMap && loc.latitude == null) throw new Error(t('Press "Use my location" to pin your home on the map, or switch the map option off.'))
      if (avatar) values.avatar_url = await uploadImage(avatar, 'avatar')
      if (cover) values.cover_url = await uploadImage(cover, 'cover')
      const p = await updateProfile(person.id, values)
      onSaved(p)
    } catch (e) {
      setError(e.message.includes('profiles_username_key') ? t('That username is taken.') : e.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title={t('Edit profile')} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>{t('Cancel')}</button><button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? t('Saving…') : t('Save')}</button></>}>
      <ErrorText error={error} />
      <div className="row">
        <Field label={t('Profile photo')}>
          <label className="btn btn-outline"><Camera size={17} /> {avatar ? avatar.name.slice(0, 18) : t('Choose photo')}
            <input type="file" accept="image/*" hidden onChange={(e) => setAvatar(e.target.files?.[0] || null)} /></label>
        </Field>
        <Field label={t('Cover photo')}>
          <label className="btn btn-outline"><Camera size={17} /> {cover ? cover.name.slice(0, 18) : t('Choose cover')}
            <input type="file" accept="image/*" hidden onChange={(e) => setCover(e.target.files?.[0] || null)} /></label>
        </Field>
      </div>
      <div className="row">
        <Field label={t('Full name')}><input className="input" value={form.full_name} onChange={set('full_name')} maxLength={100} /></Field>
        <Field label={t('Username')}><input className="input" value={form.username} onChange={set('username')} maxLength={30} /></Field>
      </div>
      <Field label={t('Bio')}><textarea className="textarea" style={{ minHeight: 70 }} value={form.bio} onChange={set('bio')} maxLength={500} /></Field>
      <Field label={t('Neighborhood')}>
        <select className="select" value={form.neighborhood_id} onChange={set('neighborhood_id')}>
          <option value="">{t('Not set')}</option>
          {neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.name}{n.city ? `, ${n.city}` : ''}</option>)}
        </select>
      </Field>
      <Field label={t('Phone')}><input className="input" value={form.phone} onChange={set('phone')} maxLength={20} /></Field>
      <div className="form-section">{t('My address')}</div>
      <div className="row">
        <Field label={t('House / holding no.')}><input className="input" value={form.house} onChange={set('house')} maxLength={60} /></Field>
        <Field label={t('Road')}><input className="input" value={form.road} onChange={set('road')} maxLength={120} /></Field>
      </div>
      <div className="row">
        <Field label={t('Thana')}><input className="input" value={form.thana} onChange={set('thana')} maxLength={80} /></Field>
        <Field label={t('Post code')}><input className="input" inputMode="numeric" value={form.postcode} onChange={set('postcode')} maxLength={10} /></Field>
      </div>
      <Field label={t('City corporation')}>
        <select className="select" value={form.city_corporation} onChange={set('city_corporation')}>
          <option value="">{t('Not in a city corporation')}</option>
          {CITY_CORPORATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label={t('More address details')}><input className="input" value={form.address} onChange={set('address')} maxLength={255} /></Field>
      <div className="form-section">{t('Map location')}</div>
      <LocationField value={loc} onChange={setLoc} nameLabel={t('Place name')} placeholder={t('e.g. near the mosque')} />
      <label className="flex gap-8 items-center mt-8" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={showOnMap} onChange={(e) => setShowOnMap(e.target.checked)} />
        <span>{t('Show me on the neighborhood map so neighbors can connect with me')}</span>
      </label>
      <div className="row">
        <Field label={t('Gender')}>
          <select className="select" value={form.gender} onChange={set('gender')}>
            <option value="">{t('Prefer not to say')}</option><option value="male">{t('Male')}</option><option value="female">{t('Female')}</option><option value="other">{t('Other')}</option>
          </select>
        </Field>
        <Field label={t('Date of birth')}><input className="input" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} /></Field>
      </div>
    </Modal>
  )
}
