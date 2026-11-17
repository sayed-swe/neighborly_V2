import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { appUrl } from '../lib/url'
import { ErrorText, Field } from '../components/ui'
import { t } from '../lib/i18n'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) return setError(error.message)
    navigate(location.state?.from?.pathname || '/', { replace: true })
  }

  const forgot = async () => {
    if (!email.trim()) return setError(t('Enter your email first, then click "Forgot password".'))
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl('/') })
    if (error) setError(error.message)
    else setInfo(t('Check your inbox for a password reset link.'))
  }

  return (
    <div className="auth-page">
      <div>
        <form className="auth-card" onSubmit={submit}>
          <h2>{t('Welcome back')}</h2>
          <p className="sub">{t("Log in to see what's happening around you.")}</p>
          <ErrorText error={error} />
          {info && <div className="pill green mb-12" style={{ padding: '8px 12px' }}>{info}</div>}
          <Field label={t('Email')}>
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={t('Password')}>
            <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? t('Logging in…') : t('Log in')}</button>
          <div className="auth-switch"><button type="button" className="link" onClick={forgot}>{t('Forgot password?')}</button></div>
          <div className="auth-switch">{t('New to Neighborly?')} <Link to="/signup">{t('Create an account')}</Link> · <Link to="/signup?type=provider">{t('Join as a service provider')}</Link></div>
        </form>
      </div>
    </div>
  )
}
