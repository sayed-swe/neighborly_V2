'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, Laptop, LogOut, MapPin, Palette, Shield, Smartphone, Trash2, User } from 'lucide-react';
import { api, parseError, setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { applyFieldErrors } from '@/lib/useApplyFieldErrors';
import { name, password, SERVICE_CATEGORIES } from '@/lib/schemas';
import { ROLE_LABELS } from '@/lib/permissions';
import { AUDIT_LABELS, describeDevice, timeAgo } from '@/lib/format';
import { Alert, Avatar, Button, Field, PasswordField, Spinner, useToast } from '@/components/ui';
import LocationPicker from '@/components/LocationPicker';
import { THEME_OPTIONS, getThemePref, setThemePref } from '@/lib/theme';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'location', label: 'Home area', icon: MapPin },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'account', label: 'Account', icon: Trash2 },
];

/* ---------------- Profile ---------------- */
function ProfileTab() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const isProvider = user.role === 'provider';
  const schema = z.object({
    name,
    bio: z.string().trim().max(280, 'Keep it under 280 characters'),
    ...(isProvider && {
      businessName: z.string().trim().min(2, 'Enter your business name').max(80),
      category: z.string().min(1, 'Pick a category'),
      description: z.string().trim().max(500, 'Keep it under 500 characters'),
    }),
  });
  const { register, handleSubmit, watch, setError, formState: { errors, isSubmitting, isDirty }, reset } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user.name, bio: user.bio ?? '',
      ...(isProvider && { businessName: user.provider?.businessName ?? '', category: user.provider?.category ?? '', description: user.provider?.description ?? '' }),
    },
  });

  async function onSubmit(v) {
    const body = { name: v.name, bio: v.bio, ...(isProvider && { provider: { businessName: v.businessName, category: v.category, description: v.description } }) };
    try {
      const { data } = await api.patch('/users/me', body);
      setUser(data.user);
      reset(v);
      toast('Profile saved');
    } catch (err) {
      const e = parseError(err);
      if (!applyFieldErrors(e.fields, setError, ['name', 'bio'])) toast(e.message, 'error');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="settings-section">
      <div className="profile-head">
        <Avatar user={user} size={64} />
        <div>
          <strong>{user.name}</strong>
          <p className="small muted">{user.email} · <span className="badge badge-green">{ROLE_LABELS[user.role]}</span></p>
          <p className="tiny muted" style={{ marginTop: 4 }}>Profile photos arrive with the next release.</p>
        </div>
      </div>
      <Field label="Display name" autoComplete="name" error={errors.name?.message} {...register('name')} />
      <Field as="textarea" label="Bio" aside={<span className="tiny muted">{watch('bio')?.length ?? 0}/280</span>} placeholder="A line or two about you, e.g. ‘Teacher, cat person, happy to lend tools.’" error={errors.bio?.message} {...register('bio')} />
      {isProvider && (
        <fieldset className="settings-fieldset">
          <legend>Business profile</legend>
          <div className="field-row" style={{ marginTop: 0 }}>
            <Field label="Business name" error={errors.businessName?.message} {...register('businessName')} />
            <Field as="select" label="Category" error={errors.category?.message} {...register('category')}>
              <option value="" disabled>Choose…</option>
              {SERVICE_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Field>
          </div>
          <Field as="textarea" label="What you offer" aside={<span className="tiny muted">{watch('description')?.length ?? 0}/500</span>} placeholder="Services, hours, areas you cover, typical prices…" error={errors.description?.message} {...register('description')} />
        </fieldset>
      )}
      <div className="settings-actions"><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save changes</Button></div>
    </form>
  );
}

/* ---------------- Security ---------------- */
const pwSchema = z.object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: password, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords don’t match' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Choose a different password' });

function ChangePassword({ onChanged }) {
  const toast = useToast();
  const { register, handleSubmit, watch, setError, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(pwSchema), mode: 'onTouched' });
  async function onSubmit({ currentPassword, newPassword }) {
    try {
      const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
      setAccessToken(data.accessToken);
      reset({ currentPassword: '', newPassword: '', confirm: '' });
      toast(data.message);
      onChanged();
    } catch (err) {
      const e = parseError(err);
      if (!applyFieldErrors(e.fields, setError, ['currentPassword', 'newPassword'])) toast(e.message, 'error');
    }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="card card-pad">
      <h3 className="card-title">Change password</h3>
      <p className="small muted" style={{ marginBottom: 16 }}>You’ll stay signed in here; every other device will be signed out.</p>
      <PasswordField label="Current password" autoComplete="current-password" value={watch('currentPassword')} error={errors.currentPassword?.message} {...register('currentPassword')} />
      <PasswordField label="New password" autoComplete="new-password" showStrength value={watch('newPassword')} error={errors.newPassword?.message} {...register('newPassword')} />
      <PasswordField label="Confirm new password" autoComplete="new-password" value={watch('confirm')} error={errors.confirm?.message} {...register('confirm')} />
      <div className="settings-actions"><Button type="submit" loading={isSubmitting}>Update password</Button></div>
    </form>
  );
}

function SetPassword() {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: user.email });
      toast(data.message);
    } catch (err) { toast(parseError(err).message, 'error'); }
    setBusy(false);
  }
  return (
    <section className="card card-pad">
      <h3 className="card-title">Password</h3>
      <p className="small muted" style={{ margin: '4px 0 16px' }}>You sign in with Google, so this account doesn’t have a password yet. Add one if you’d also like to sign in with your email.</p>
      <Button className="btn" onClick={send} loading={busy}>Email me a link to set a password</Button>
    </section>
  );
}

function SecurityTab() {
  const { user, endSession } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [sessions, setSessions] = useState(null);
  const [events, setEvents] = useState(null);

  const load = useCallback(() => {
    api.get('/auth/sessions').then(({ data }) => setSessions(data.sessions)).catch(() => setSessions([]));
    api.get('/users/me/activity').then(({ data }) => setEvents(data.events)).catch(() => setEvents([]));
  }, []);
  useEffect(load, [load]);

  async function revoke(id) {
    try {
      await api.delete(`/auth/sessions/${id}`);
      setSessions((s) => s.filter((x) => x.id !== id));
      toast('Device signed out');
    } catch (err) { toast(parseError(err).message, 'error'); }
  }
  async function logoutAll() {
    if (!window.confirm('Sign out of Neighborly on every device, including this one?')) return;
    try {
      await api.post('/auth/logout-all');
      endSession();
      router.replace('/login');
    } catch (err) { toast(parseError(err).message, 'error'); }
  }

  return (
    <div className="settings-section">
      {user.hasPassword === false ? <SetPassword /> : <ChangePassword onChanged={load} />}

      <section className="card card-pad">
        <div className="card-head">
          <h3 className="card-title">Where you’re signed in</h3>
          <button className="btn btn-danger btn-sm" onClick={logoutAll}><LogOut size={15} /> Sign out everywhere</button>
        </div>
        {!sessions ? <Spinner /> : (
          <ul className="session-list">
            {sessions.map((s) => {
              const mobile = /iPhone|Android|Mobile/.test(s.userAgent ?? '');
              return (
                <li key={s.id}>
                  <span className="session-ico">{mobile ? <Smartphone size={18} /> : <Laptop size={18} />}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{describeDevice(s.userAgent)}</strong> {s.current && <span className="badge badge-green">This device</span>}
                    <p className="tiny muted">Signed in {timeAgo(s.createdAt)}{s.ip ? ` · IP ${s.ip}` : ''}</p>
                  </div>
                  {!s.current && <button className="btn btn-ghost btn-sm" onClick={() => revoke(s.id)}>Sign out</button>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card card-pad">
        <h3 className="card-title">Recent security activity</h3>
        <p className="small muted" style={{ marginBottom: 12 }}>Don’t recognise something? Change your password and sign out everywhere.</p>
        {!events ? <Spinner /> : events.length === 0 ? <p className="small muted">Nothing yet.</p> : (
          <ul className="activity">
            {events.map((e) => (
              <li key={e.id} className={['login_failed', 'account_locked', 'refresh_reuse_detected'].includes(e.type) ? 'is-warn' : ''}>
                <span>{AUDIT_LABELS[e.type] ?? e.type}</span>
                <span className="tiny muted">{describeDevice(e.userAgent)} · {timeAgo(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ---------------- Account ---------------- */
function ExportData() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const { data, headers } = await api.get('/users/me/export', { responseType: 'blob' });
      const name = /filename="([^"]+)"/.exec(headers['content-disposition'] ?? '')?.[1] ?? 'neighborly-data.json';
      const url = URL.createObjectURL(data);
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      a.click();
      URL.revokeObjectURL(url);
      toast('Your data is downloading');
    } catch (err) {
      // With responseType 'blob' the JSON error body arrives as a Blob too
      if (err.response?.data instanceof Blob) {
        try { err.response.data = JSON.parse(await err.response.data.text()); } catch { /* not JSON */ }
      }
      toast(parseError(err).message, 'error');
    }
    setBusy(false);
  }

  return (
    <section className="card card-pad">
      <h3 className="card-title">Download your data</h3>
      <p className="small muted" style={{ marginBottom: 16 }}>One JSON file with your profile, posts, comments, reviews, messages you sent, devices and security activity. Your exact home pin isn’t included; it never leaves our server.</p>
      <Button type="button" className="btn btn-ghost" loading={busy} onClick={download}><Download size={16} /> Download my data</Button>
    </section>
  );
}

function AccountTab() {
  const { endSession } = useAuth();
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function del(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.delete('/users/me', { data: { password: pw } });
      endSession();
      router.replace('/?deleted=1');
    } catch (err) {
      const p = parseError(err);
      setError(p.fields?.password ?? p.message);
      setBusy(false);
    }
  }

  return (
    <div className="settings-section">
      <ExportData />
      <form className="card card-pad danger-zone" onSubmit={del}>
        <h3 className="card-title">Delete account</h3>
        <p className="small muted" style={{ marginBottom: 16 }}>This permanently removes your profile, your home location and every signed-in session. It can’t be undone.</p>
        {error && <Alert kind="error">{error}</Alert>}
        <PasswordField label="Confirm with your password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Field label={<>Type <strong>DELETE</strong> to confirm</>} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        <div className="settings-actions">
          <Button type="submit" className="btn btn-danger" loading={busy} disabled={!pw || confirm !== 'DELETE'}><Trash2 size={16} /> Delete my account</Button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- Appearance ---------------- */
function AppearanceTab() {
  const [pref, setPref] = useState('system');
  useEffect(() => setPref(getThemePref()), []); // localStorage is only readable after mount

  function choose(v) {
    setPref(v);
    setThemePref(v);
  }

  return (
    <section className="settings-section card card-pad">
      <h3 className="card-title">Theme</h3>
      <p className="small muted" style={{ marginBottom: 16 }}>System follows your device’s light or dark setting. Saved on this device only.</p>
      <div className="seg" role="radiogroup" aria-label="Theme">
        {THEME_OPTIONS.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={pref === v} className={pref === v ? 'is-active' : ''} onClick={() => choose(v)}>{l}</button>
        ))}
      </div>
    </section>
  );
}

function Settings() {
  const params = useSearchParams();
  const router = useRouter();
  const { setUser } = useAuth();
  const toast = useToast();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'profile';

  return (
    <div className="settings">
      <header className="page-head">
        <h1>Settings</h1>
        <p className="muted">Your profile, home area, appearance and account security.</p>
      </header>
      <div className="settings-layout">
        <nav className="settings-tabs" role="tablist" aria-label="Settings sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => router.replace(`/settings?tab=${id}`, { scroll: false })}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </nav>
        <div role="tabpanel">
          {tab === 'profile' && <ProfileTab />}
          {tab === 'location' && (
            <div className="settings-section card card-pad">
              <h3 className="card-title">Home area</h3>
              <p className="small muted" style={{ marginBottom: 16 }}>Moved? Update your pin. Your feed will follow.</p>
              <LocationPicker onSaved={(u) => { setUser(u); toast('Home area updated'); }} />
            </div>
          )}
          {tab === 'security' && <SecurityTab />}
          {tab === 'appearance' && <AppearanceTab />}
          {tab === 'account' && <AccountTab />}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return <Suspense><Settings /></Suspense>;
}
