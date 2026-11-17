'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Check, Home, Store } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { applyFieldErrors } from '@/lib/useApplyFieldErrors';
import { email, name, password, SERVICE_CATEGORIES } from '@/lib/schemas';
import { Alert, Button, Field, PasswordField } from '@/components/ui';
import AuthHeading from '@/components/AuthHeading';
import GoogleButton from '@/components/GoogleButton';

const schema = z
  .object({
    role: z.enum(['resident', 'provider']),
    name,
    email,
    password,
    businessName: z.string().trim().optional(),
    serviceCategory: z.string().optional(),
    acceptTerms: z.literal(true, { error: 'Please accept the community guidelines' }),
  })
  .superRefine((v, ctx) => {
    if (v.role !== 'provider') return;
    if (!v.businessName || v.businessName.length < 2) ctx.addIssue({ code: 'custom', path: ['businessName'], message: 'Enter your business or trade name' });
    if (!v.serviceCategory) ctx.addIssue({ code: 'custom', path: ['serviceCategory'], message: 'Pick what you do' });
  });

const ROLES = [
  { id: 'resident', icon: Home, title: 'Resident', body: 'Follow local news, ask for help, buy & sell, find trusted services.' },
  { id: 'provider', icon: Store, title: 'Service provider', body: 'Offer your skills to people nearby and collect neighbour reviews.' },
];

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialRole = params.get('role') === 'provider' ? 'provider' : 'resident';
  const [step, setStep] = useState(params.get('role') ? 2 : 1);
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { role: initialRole, acceptTerms: false },
  });
  const role = watch('role');

  async function onSubmit(values) {
    setServerError('');
    const body = { ...values };
    if (body.role !== 'provider') { delete body.businessName; delete body.serviceCategory; }
    try {
      await api.post('/auth/register', body);
      router.push(`/check-email?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      const e = parseError(err);
      const known = ['name', 'email', 'password', 'businessName', 'serviceCategory', 'acceptTerms'];
      if (!applyFieldErrors(e.fields, setError, known)) setServerError(e.message);
      if (e.fields?.role) setStep(1);
    }
  }

  if (step === 1) {
    return (
      <>
        <AuthHeading title="Join your neighbourhood">First, how will you use Neighborly?</AuthHeading>
        <div className="role-pick" role="radiogroup" aria-label="Account type">
          {ROLES.map(({ id, icon: Icon, title, body }) => (
            <button key={id} type="button" role="radio" aria-checked={role === id} className="role-option" onClick={() => setValue('role', id)}>
              <span className="role-option-ico"><Icon size={22} /></span>
              <span><strong>{title}</strong><span className="small muted">{body}</span></span>
              <span className="role-option-check" aria-hidden="true">{role === id && <Check size={14} />}</span>
            </button>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 12 }}>Moderator and admin roles are assigned by the Neighborly team, not chosen at sign-up.</p>
        <Button type="button" className="btn btn-primary btn-lg btn-block" style={{ marginTop: 20 }} onClick={() => setStep(2)}>Continue</Button>
        <p className="auth-switch">Already a member? <Link href="/login" className="link">Sign in</Link></p>
      </>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm auth-back" onClick={() => setStep(1)}><ArrowLeft size={16} /> {role === 'provider' ? 'Service provider' : 'Resident'} account</button>
      <AuthHeading title="Create your account">We’ll email you a link to confirm it’s really you.</AuthHeading>
      {serverError && <Alert kind="error">{serverError}</Alert>}
      {role === 'resident' && <div><GoogleButton label="Sign up with Google" /></div>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="auth-fields">
        <Field label="Full name" autoComplete="name" placeholder="e.g. Nusrat Jahan" error={errors.name?.message} {...register('name')} />
        <Field label="Email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        {role === 'provider' && (
          <div className="field-row">
            <Field label="Business or trade name" placeholder="e.g. Rafiq Plumbing" error={errors.businessName?.message} {...register('businessName')} />
            <Field as="select" label="What you do" error={errors.serviceCategory?.message} defaultValue="" {...register('serviceCategory')}>
              <option value="" disabled>Choose…</option>
              {SERVICE_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Field>
          </div>
        )}
        <PasswordField label="Password" autoComplete="new-password" showStrength value={watch('password')} error={errors.password?.message} {...register('password')} />
        <div className="field">
          <label className="check">
            <input type="checkbox" {...register('acceptTerms')} aria-invalid={errors.acceptTerms ? 'true' : undefined} />
            <span>I’ll be kind, keep posts local and honest, and follow the community guidelines.</span>
          </label>
          {errors.acceptTerms && <p className="field-error" role="alert">{errors.acceptTerms.message}</p>}
        </div>
        <Button type="submit" className="btn btn-primary btn-lg btn-block" loading={isSubmitting}>Create account</Button>
      </form>
      <p className="auth-switch">Already a member? <Link href="/login" className="link">Sign in</Link></p>
    </>
  );
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>;
}
