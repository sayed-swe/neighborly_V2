'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, parseError } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { email, safeNext } from '@/lib/schemas';
import { Alert, Button, Field, PasswordField } from '@/components/ui';
import AuthHeading from '@/components/AuthHeading';
import ResendVerification from '@/components/ResendVerification';
import GoogleButton from '@/components/GoogleButton';

const OAUTH_ERRORS = {
  google_cancelled: 'Google sign-in was cancelled.',
  google_failed: 'Google sign-in didn’t work. Please try again.',
  google_state: 'That sign-in attempt expired. Please try again.',
  google_unverified: 'Your Google account’s email isn’t verified.',
  google_disabled: 'Google sign-in isn’t set up on this server.',
  suspended: 'This account is suspended. Contact support.',
};

const schema = z.object({ email, password: z.string().min(1, 'Enter your password') });

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { startSession } = useAuth();
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), mode: 'onTouched' });

  async function onSubmit(values) {
    setServerError(null);
    try {
      const { data } = await api.post('/auth/login', values);
      startSession(data);
      router.replace(data.user.onboardingComplete ? safeNext(params.get('next')) : '/onboarding');
    } catch (err) {
      setServerError(parseError(err));
    }
  }

  const e = serverError;
  return (
    <>
      <AuthHeading title="Welcome back">Sign in to see what’s happening near home.</AuthHeading>
      {params.get('reset') === '1' && <Alert kind="success">Password updated. Sign in with your new password.</Alert>}
      {params.get('expired') === '1' && <Alert kind="info">Your session ended. Please sign in again.</Alert>}
      {OAUTH_ERRORS[params.get('error')] && !e && <Alert kind="error">{OAUTH_ERRORS[params.get('error')]}</Alert>}
      {e && (
        <Alert kind={e.code === 'EMAIL_NOT_VERIFIED' ? 'warn' : 'error'} title={e.code === 'EMAIL_NOT_VERIFIED' ? 'Confirm your email first' : e.code === 'ACCOUNT_LOCKED' ? 'Account temporarily locked' : undefined}
          actions={e.code === 'EMAIL_NOT_VERIFIED' ? <ResendVerification email={watch('email')} /> : e.code === 'ACCOUNT_LOCKED' ? <Link className="link" href="/forgot-password">Reset your password</Link> : null}>
          {e.message}
        </Alert>
      )}
      <div>
        <GoogleButton next={params.get('next') ?? undefined} />
      </div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="auth-fields">
        <Field label="Email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        <PasswordField label="Password" autoComplete="current-password" error={errors.password?.message} value={watch('password')}
          aside={<Link href="/forgot-password" className="link small">Forgot password?</Link>} {...register('password')} />
        <Button type="submit" className="btn btn-primary btn-lg btn-block" loading={isSubmitting}>Sign in</Button>
      </form>
      <p className="auth-switch">New to Neighborly? <Link href="/register" className="link">Create an account</Link></p>
    </>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
