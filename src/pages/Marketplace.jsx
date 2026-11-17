import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Baby, BookOpen, Car, CookingPot, Dumbbell, Gift, MapPin, Package, Plus, Repeat2, Search, Shirt, Smartphone, Sofa, Store, Tag, Trash2,
} from 'lucide-react'
import { createListing, deleteListing, getListing, getListings, updateListing, uploadImage } from '../lib/api'
import { CONDITIONS, LISTING_CATEGORIES, LISTING_TYPES } from '../lib/constants'
import { formatPrice, labelize, timeAgo } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Empty, ErrorText, Field, Modal, Spinner, StatusPill } from '../components/ui'
import { ContactFields, ContactLinks, ImagePicker, LocationField } from '../components/FormBits'
import { t } from '../lib/i18n'
import CommentSection from '../components/CommentSection'
import OwnerBar from '../components/OwnerBar'

const TYPE_ICONS = { '': Store, sell: Tag, buy: Search, exchange: Repeat2, free: Gift }
const CATEGORY_ICONS = {
  Electronics: Smartphone, Furniture: Sofa, Vehicles: Car, Books: BookOpen, Clothing: Shirt,
  'Home & Kitchen': CookingPot, Kids: Baby, Sports: Dumbbell, Other: Package,
}

export default function Marketplace() {
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState(null)
  const [type, setType] = useState('')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const openId = params.get('item')

  const load = () => getListings({ type: type || undefined, category: category || undefined, search: q || undefined }).then(setItems).catch(() => setItems([]))
  useEffect(() => { setItems(null); load() }, [type, category, q]) // eslint-disable-line react-hooks/exhaustive-deps

  const typeLabel = { '': 'Browse all', sell: 'For sale', buy: 'Wanted', exchange: 'Exchange', free: 'Free stuff' }
  const heading = t(category || (type ? typeLabel[type] : "Today's picks"))

  return (
    <div className="mp-layout">
      <aside className="mp-side">
        <h2>{t('Buy & sell')}</h2>
        <form className="fb-search" onSubmit={(e) => { e.preventDefault(); setQ(search.trim()) }}>
          <Search size={16} color="var(--muted)" />
          <input placeholder={t('Search Marketplace')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        {Object.entries(typeLabel).map(([tp, label]) => {
          const Icon = TYPE_ICONS[tp]
          return (
            <button key={label} className={`mp-cat ${type === tp && !category ? 'active' : ''}`} onClick={() => { setType(tp); setCategory('') }}>
              <span className="ic"><Icon size={18} /></span>{t(label)}
            </button>
          )
        })}
        <div style={{ padding: '8px' }}>
          <button className="btn btn-primary btn-block" style={{ background: 'var(--green-100)', color: 'var(--green-700)' }} onClick={() => setCreating(true)}><Plus size={18} /> {t('Create new listing')}</button>
        </div>
        <div className="side-sep" />
        <div className="side-title">{t('Categories')}</div>
        {LISTING_CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICONS[c] || Package
          return (
            <button key={c} className={`mp-cat ${category === c ? 'active' : ''}`} onClick={() => { setCategory(category === c ? '' : c); setType('') }}>
              <span className="ic"><Icon size={18} /></span>{t(c)}
            </button>
          )
        })}
      </aside>

      <main className="mp-main">
        <div className="flex between items-center wrap gap-8" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{q ? `${t('Results for')} "${q}"` : heading}</h3>
          {(q || category || type) && <button className="btn btn-secondary btn-sm" onClick={() => { setQ(''); setSearch(''); setCategory(''); setType('') }}>{t('Clear filters')}</button>}
        </div>

        {items === null ? <Spinner /> : items.length === 0 ? (
          <div className="card"><Empty icon={Tag} title={t('No listings yet')} text={t('Selling something or giving it away? List it for your neighbors.')} action={<button className="btn btn-primary" onClick={() => setCreating(true)}>{t('Create listing')}</button>} /></div>
        ) : (
          <div className="grid-cards">
            {items.map((l) => (
              <div key={l.id} className="item-card" onClick={() => setParams({ item: l.id })}>
                <div className="item-thumb">
                  {l.image_url ? <img src={l.image_url} alt="" loading="lazy" /> : <Tag size={40} />}
                  {l.listing_type !== 'sell' && <span className="pill dark">{l.listing_type === 'buy' ? t('Wanted') : labelize(l.listing_type)}</span>}
                </div>
                <div className="item-info">
                  <div className="item-price">{formatPrice(l.price, l.listing_type)}</div>
                  <div className="item-title">{l.title}</div>
                  <div className="item-sub">{l.location_name || l.neighborhood?.name || t('Nearby')} · {timeAgo(l.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {creating && <ListingForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load() }} />}
      {openId && <ListingDetail id={Number(openId)} onClose={() => setParams({})} onChanged={load} />}
    </div>
  )
}

function ListingDetail({ id, onClose, onChanged }) {
  const { profile, isAdmin } = useAuth()
  const toast = useToast()
  const [item, setItem] = useState(undefined)
  const [editing, setEditing] = useState(false)
  const load = () => getListing(id).then(setItem).catch(() => setItem(null))
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (editing) return <ListingForm listing={item} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); onChanged() }} />

  const mine = item && item.user_id === profile.id
  const setStatus = async (status) => {
    try { await updateListing(id, { status }); toast(`Marked as ${status}`); load(); onChanged() } catch (e) { toast(e.message, 'error') }
  }
  const remove = async () => {
    if (!confirm(t('Delete this listing?'))) return
    try { await deleteListing(id); toast(t('Listing deleted')); onChanged(); onClose() } catch (e) { toast(e.message, 'error') }
  }

  return (
    <Modal title={t('Listing')} onClose={onClose} wide>
      {item === undefined ? <Spinner /> : item === null ? <Empty icon={Tag} title={t('Listing not found')} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 20 }} className="detail-grid">
          <div className="item-thumb" style={{ borderRadius: 12, aspectRatio: '1 / 1' }}>
            {item.image_url ? <img src={item.image_url} alt="" /> : <Tag size={48} />}
          </div>
          <div>
            <div className="flex gap-6 wrap mb-12"><StatusPill value={item.status} /><span className="pill">{item.listing_type === 'buy' ? t('Wanted') : labelize(item.listing_type)}</span>{item.category && <span className="pill blue">{t(item.category)}</span>}</div>
            <h3 style={{ fontSize: 22 }}>{item.title}</h3>
            <div className="item-price" style={{ fontSize: 24, margin: '6px 0' }}>{formatPrice(item.price, item.listing_type)}</div>
            {item.item_condition && <div className="small muted">{t('Condition:')} <b>{labelize(item.item_condition)}</b></div>}
            {(item.location_name || item.neighborhood) && <div className="small muted mt-8"><MapPin size={13} /> {item.location_name || item.neighborhood?.name}</div>}
            <p className="mt-12" style={{ whiteSpace: 'pre-wrap' }}>{item.description}</p>
            <div className="mt-12"><ContactLinks phone={item.contact_phone} email={item.contact_email} small={false} /></div>
            <div className="divider" />
            <OwnerBar person={item.author} createdAt={item.created_at} label={t('Seller')} reportType="listing" reportId={item.id} messageText="Message seller" />
            {(mine || isAdmin) && (
              <div className="flex gap-8 wrap mt-8">
                {mine && <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>{t('Edit')}</button>}
                {item.status !== 'sold' && <button className="btn btn-secondary btn-sm" onClick={() => setStatus('sold')}>{t('Mark sold')}</button>}
                {item.status === 'available' && <button className="btn btn-secondary btn-sm" onClick={() => setStatus('reserved')}>{t('Mark reserved')}</button>}
                {item.status !== 'available' && <button className="btn btn-secondary btn-sm" onClick={() => setStatus('available')}>{t('Mark available')}</button>}
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={remove}><Trash2 size={15} /> {t('Delete')}</button>
              </div>
            )}
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="bold mb-12">{t('Questions for the seller')}</div>
            <CommentSection target={{ listing_id: item.id }} placeholder={t('Ask a question…')} />
          </div>
        </div>
      )}
      <style>{`@media (max-width: 700px) { .detail-grid { grid-template-columns: 1fr !important; } }`}</style>
    </Modal>
  )
}

function ListingForm({ listing, onClose, onSaved }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({
    listing_type: listing?.listing_type || 'sell', title: listing?.title || '', description: listing?.description || '',
    category: listing?.category || '', item_condition: listing?.item_condition || 'used', price: listing?.price ?? '',
    contact_phone: listing?.contact_phone ?? profile.phone ?? '', contact_email: listing?.contact_email ?? '',
  })
  const [loc, setLoc] = useState({ latitude: listing?.latitude ?? null, longitude: listing?.longitude ?? null, location_name: listing?.location_name || '' })
  const [file, setFile] = useState(null)
  const [keep, setKeep] = useState(listing?.image_url || null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (!form.title.trim() || !form.description.trim()) return setError(t('Add a title and description.'))
    if (!form.contact_phone.trim()) return setError(t('Add a contact phone number so buyers can reach you.'))
    setBusy(true); setError('')
    try {
      const image_url = file ? await uploadImage(file, 'listing') : keep
      const values = {
        ...form, title: form.title.trim(), description: form.description.trim(),
        category: form.category || null, contact_phone: form.contact_phone.trim(), contact_email: form.contact_email.trim() || null,
        price: form.listing_type === 'free' || form.price === '' ? null : Number(form.price),
        item_condition: form.item_condition || null, image_url,
        location_name: loc.location_name?.trim() || null, latitude: loc.latitude, longitude: loc.longitude,
        neighborhood_id: listing?.neighborhood_id ?? profile.neighborhood_id,
      }
      if (listing) await updateListing(listing.id, values)
      else await createListing(values)
      toast(listing ? t('Listing updated') : t('Listing published'))
      onSaved()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal title={listing ? t('Edit listing') : t('Create listing')} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>{t('Cancel')}</button><button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? t('Saving…') : listing ? t('Save') : t('Publish')}</button></>}>
      <ErrorText error={error} />
      <Field label={t('Type')}>
        <div className="chips">
          {LISTING_TYPES.map((lt) => <button key={lt} type="button" className={`chip ${form.listing_type === lt ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, listing_type: lt }))}>{lt === 'buy' ? t('Looking to buy') : labelize(lt)}</button>)}
        </div>
      </Field>
      <Field label={t('Photo')}><ImagePicker file={file} existingUrl={keep} onChange={(f) => { setFile(f); if (!f) setKeep(null) }} /></Field>
      <Field label={t('Title')}><input className="input" value={form.title} onChange={set('title')} maxLength={200} placeholder={t('What are you selling?')} /></Field>
      <div className="row">
        {form.listing_type !== 'free' && <Field label={t('Price (৳)')}><input className="input" type="number" min="0" value={form.price} onChange={set('price')} /></Field>}
        <Field label={t('Category')}>
          <select className="select" value={form.category} onChange={set('category')}><option value="">{t('Choose…')}</option>{LISTING_CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select>
        </Field>
        <Field label={t('Condition')}>
          <select className="select" value={form.item_condition} onChange={set('item_condition')}>{CONDITIONS.map((c) => <option key={c} value={c}>{labelize(c)}</option>)}</select>
        </Field>
      </div>
      <Field label={t('Description')}><textarea className="textarea" value={form.description} onChange={set('description')} maxLength={5000} /></Field>
      <ContactFields value={form} onChange={setForm} />
      <LocationField value={loc} onChange={setLoc} nameLabel={t('Pick-up location')} />
    </Modal>
  )
}
