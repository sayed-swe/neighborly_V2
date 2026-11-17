import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Home, Wrench } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getNeighborhoods, getServiceCategories } from '../lib/api'
import { appUrl } from '../lib/url'
import { t } from '../lib/i18n'
import { CITY_CORPORATIONS } from '../lib/address'
import { ErrorText, Field } from '../components/ui'
import { LocationField } from '../components/FormBits'

// Two separate registrations: a resident (neighbor) or a service provider.
export default function Signup() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const type = params.get('type') === 'provider' ? 'service_provider' : 'resident'
  const isProvider = type === 'service_provider'

  const [form, setForm] = useState({
    full_name: '', username: '', email: '', phone: '', password: '', neighborhood_id: '',
    house: '', road: '', thana: '', city_corporation: '', postcode: '',
    service_category_id: '', service_name: '', service_description: '', price_info: '', contact_email: '',
  })
  const [loc, setLoc] = useState({ latitude: null, longitude: null, location_name: '' })
  const [showOnMap, setShowOnMap] = useState(false)
  const [neighborhoods, setNeighborhoods] = useState([])
  const [categories, setCategories] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    getNeighborhoods().then(setNeighborhoods).catch(() => {})
    getServiceCategories().then(setCategories).catch(() => {})
  }, [])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const username = form.username.trim().toLowerCase()
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) return setError(t('Username: 3–30 characters, letters, numbers, dot or underscore.'))
    if (form.password.length < 8) return setError(t('Password must be at least 8 characters.'))
    if (isProvider && (!form.phone.trim() || !form.service_category_id || !form.service_name.trim())) {
      return setError(t('Service providers must add a phone number, a service category and a service name.'))
    }
    setBusy(true)
    const hasPin = loc.latitude != null
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: appUrl('/'),
        data: {
          account_type: type,
          full_name: form.full_name.trim(),
          username,
          phone: form.phone.trim(),
          neighborhood_id: form.neighborhood_id || null,
          house: form.house.trim(), road: form.road.trim(), thana: form.thana.trim(), city_corporation: form.city_corporation, postcode: form.postcode.trim(),
          latitude: hasPin ? String(loc.latitude) : '', longitude: hasPin ? String(loc.longitude) : '',
          show_on_map: hasPin && (isProvider || showOnMap) ? 'true' : 'false',
          ...(isProvider ? {
            service_category_id: form.service_category_id, service_name: form.service_name.trim(),
            service_description: form.service_description.trim(), price_info: form.price_info.trim(),
            contact_email: (form.contact_email || form.email).trim(),
          } : {}),
        },
      },
    })
    setBusy(false)
    if (error) return setError(error.message)
    if (data.session) navigate(isProvider ? '/services?tab=incoming' : '/', { replace: true })
    else setDone(true) // email confirmation is switched on in Supabase
  }

  return (
    <div className="auth-page">
      {done ? (
        <div className="auth-card">
          <h2>{t('Check your email')}</h2>
          <p className="sub">{t('We sent a confirmation link to')} <b>{form.email}</b>. {t('Click it, then log in.')}</p>
          <Link to="/login" className="btn btn-primary btn-block">{t('Go to log in')}</Link>
        </div>
      ) : (
        <form className="auth-card wide" onSubmit={submit}>
          <h2>{t('Create your account')}</h2>
          <p className="sub">{t('Choose how you will use Neighborly.')}</p>

          <div className="seg mb-12" role="tablist">
            <button type="button" role="tab" aria-selected={!isProvider} className={`seg-btn ${!isProvider ? 'active' : ''}`} onClick={() => setParams({})}><Home size={18} /> {t('Resident')}</button>
            <button type="button" role="tab" aria-selected={isProvider} className={`seg-btn ${isProvider ? 'active' : ''}`} onClick={() => setParams({ type: 'provider' })}><Wrench size={18} /> {t('Service provider')}</button>
          </div>
          <p className="hint mb-12">{isProvider ? t('Offer a service (electrician, tutor, plumber…) and accept requests from neighbors.') : t('Post, buy and sell, ask for help and connect with people nearby.')}</p>

          <ErrorText error={error} />
          <div className="form-section">{t('Account')}</div>
          <Field label={isProvider ? t('Your name or business name') : t('Full name')}><input className="input" required maxLength={100} value={form.full_name} onChange={set('full_name')} /></Field>
          <div className="row">
            <Field label={t('Username')}><input className="input" required value={form.username} onChange={set('username')} placeholder={t('e.g. rahim')} /></Field>
            <Field label={isProvider ? t('Phone') : t('Phone (optional)')}><input className="input" type="tel" required={isProvider} value={form.phone} onChange={set('phone')} maxLength={20} /></Field>
          </div>
          <div className="row">
            <Field label={t('Email')}><input className="input" type="email" autoComplete="email" required value={form.email} onChange={set('email')} /></Field>
            <Field label={t('Password')} hint={t('At least 8 characters')}>
              <input className="input" type="password" autoComplete="new-password" required value={form.password} onChange={set('password')} />
            </Field>
          </div>

          {isProvider && (
            <>
              <div className="form-section">{t('Your service')}</div>
              <div className="row">
                <Field label={t('Service category')}>
                  <select className="select" required value={form.service_category_id} onChange={set('service_category_id')}>
                    <option value="">{t('Choose…')}</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label={t('Price info')}><input className="input" value={form.price_info} onChange={set('price_info')} maxLength={100} placeholder={t('From 300 BDT')} /></Field>
              </div>
              <Field label={t('Service name')}><input className="input" required value={form.service_name} onChange={set('service_name')} maxLength={150} placeholder={t('e.g. Home electrician')} /></Field>
              <Field label={t('Describe what you do')}><textarea className="textarea" value={form.service_description} onChange={set('service_description')} maxLength={3000} /></Field>
              <Field label={t('Contact email for customers')} hint={t('Leave empty to use your login email.')}><input className="input" type="email" value={form.contact_email} onChange={set('contact_email')} maxLength={120} /></Field>
            </>
          )}

          <div className="form-section">{isProvider ? t('Where you work') : t('Where you live')}</div>
          <Field label={t('Neighborhood')}>
            <select className="select" value={form.neighborhood_id} onChange={set('neighborhood_id')} required>
              <option value="">{t('Choose…')}</option>
              {neighborhoods.map((n) => <option key={n.id} value={n.id}>{n.name}{n.city ? `, ${n.city}` : ''}</option>)}
            </select>
          </Field>
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
          <LocationField value={loc} onChange={setLoc} nameLabel={t('Place name')} placeholder={t('e.g. near the mosque')} />
          {!isProvider && (
            <label className="flex gap-8 items-center mb-12" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={showOnMap} disabled={loc.latitude == null} onChange={(e) => setShowOnMap(e.target.checked)} />
              <span>{t('Show me on the neighborhood map so neighbors can connect with me')}</span>
            </label>
          )}

          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? t('Creating account…') : isProvider ? t('Register as service provider') : t('Create account')}</button>
          <div className="auth-switch">{t('Already a member?')} <Link to="/login">{t('Log in')}</Link></div>
        </form>
      )}
    </div>
  )
}
