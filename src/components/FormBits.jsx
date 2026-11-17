// Reusable form inputs: photo picker and "use my location" field
import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, LocateFixed, Mail, MapPin, Phone, X } from 'lucide-react'
import { getCurrentPosition } from '../lib/geo'
import { t } from '../lib/i18n'

export function ImagePicker({ file, onChange, existingUrl, label = 'Add photo' }) {
  const ref = useRef(null)
  const [preview, setPreview] = useState(existingUrl || null)
  useEffect(() => {
    if (!file) { setPreview(existingUrl || null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file, existingUrl])

  return (
    <div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => onChange(e.target.files?.[0] || null)} />
      {preview ? (
        <div className="image-preview">
          <img src={preview} alt="" />
          <button type="button" className="icon-btn" onClick={() => { onChange(null); if (ref.current) ref.current.value = '' }} aria-label={t('Remove photo')}><X size={18} /></button>
        </div>
      ) : (
        <button type="button" className="btn btn-outline btn-block" onClick={() => ref.current?.click()}>
          <ImagePlus size={18} /> {label}
        </button>
      )}
    </div>
  )
}

// value: { latitude, longitude, location_name }
export function LocationField({ value, onChange, nameLabel = 'Place name', placeholder = 'e.g. Road 3, near the mosque' }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const hasCoords = value?.latitude != null && value?.longitude != null

  const locate = async () => {
    setBusy(true); setErr('')
    try {
      const [latitude, longitude] = await getCurrentPosition()
      onChange({ ...value, latitude, longitude })
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field">
      <label>{nameLabel}</label>
      <input className="input" placeholder={placeholder} value={value?.location_name || ''}
        onChange={(e) => onChange({ ...value, location_name: e.target.value })} />
      <div className="flex items-center gap-8 wrap">
        {hasCoords ? (
          <span className="pill green"><MapPin size={12} /> {t('Pinned on map (')}{value.latitude.toFixed(4)}, {value.longitude.toFixed(4)})
            <button type="button" className="link" style={{ marginLeft: 4 }} onClick={() => onChange({ ...value, latitude: null, longitude: null })}><X size={12} /></button>
          </span>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={locate} disabled={busy}>
            {busy ? <Loader2 size={15} className="spinner" /> : <LocateFixed size={15} />} {t('Use my current location')}
          </button>
        )}
        <span className="hint">{t('Pinned items show up on the Map for nearby neighbors.')}</span>
      </div>
      {err && <span className="hint" style={{ color: 'var(--red)' }}>{err}</span>}
    </div>
  )
}

// Phone + email inputs used on listings, lost & found and help requests
export function ContactFields({ value, onChange }) {
  return (
    <div className="row">
      <div className="field">
        <label>{t('Contact phone')}</label>
        <input className="input" type="tel" inputMode="tel" maxLength={20} placeholder="01XXXXXXXXX" value={value.contact_phone || ''}
          onChange={(e) => onChange({ ...value, contact_phone: e.target.value })} />
      </div>
      <div className="field">
        <label>{t('Contact email')}</label>
        <input className="input" type="email" maxLength={120} placeholder="name@example.com" value={value.contact_email || ''}
          onChange={(e) => onChange({ ...value, contact_email: e.target.value })} />
      </div>
    </div>
  )
}

// Call / email buttons shown wherever a contact was given
export function ContactLinks({ phone, email, small = true }) {
  if (!phone && !email) return null
  const cls = `btn btn-outline ${small ? 'btn-sm' : ''}`
  return (
    <div className="flex gap-8 wrap">
      {phone && <a className={cls} href={`tel:${phone}`} onClick={(e) => e.stopPropagation()}><Phone size={15} /> {phone}</a>}
      {email && <a className={cls} href={`mailto:${email}`} onClick={(e) => e.stopPropagation()}><Mail size={15} /> {email}</a>}
    </div>
  )
}
