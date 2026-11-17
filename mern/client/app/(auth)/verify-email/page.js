'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CircleCheck, CircleX } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { Spinner } from '@/components/ui';
import AuthHeading from '@/components/AuthHeading';

function Verify() {
  const token = useSearchParams().get('token');
  const router = useRouter();
  const { startSession } = useAuth();
  const [state, setState] = useState({ status: 'loading' });
  const started = useRef(false); // tokens are single-use: never send twice (React strict mode runs effects twice)

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) { setState({ status: 'error', message: 'This link is missing its token.' }); return; }
    api.post('/auth/verify-email', { token })
      .then(({ data }) => {
        startSession(data);
        setState({ status: 'ok' });
        setTimeout(() => router.replace(data.user.onboardingComplete ? '/home' : '/onboarding'), 1200);
      })
      .catch((err) => setState({ status: 'error', message: parseError(err).message }));
  }, [token, router, startSession]);

  if (state.status === 'loading') return <div className="auth-state"><Spinner size={28} /><AuthHeading title="Confirming your email…" /></div>;
  if (state.status === 'ok') {
    return (
      <div className="auth-state">
        <span className="auth-state-ico ok"><CircleCheck size={30} /></span>
        <AuthHeading title="Email confirmed">Welcome to Neighborly. Taking you to set up your home area…</AuthHeading>
      </div>
    );
  }
  return (
    <div className="auth-state">
      <span className="auth-state-ico bad"><CircleX size={30} /></span>
      <AuthHeading title="That link didn’t work">{state.message}</AuthHeading>
      <p className="auth-switch">Already confirmed? <Link className="link" href="/login">Sign in</Link>. Otherwise sign in and we’ll offer to resend it.</p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><Verify /></Suspense>;
}
