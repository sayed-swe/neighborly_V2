'use client';
import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { refreshSession } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { safeNext } from '@/lib/schemas';
import { Spinner } from '@/components/ui';

/** Google redirects here after the API has set the session cookie; pick up the session and move on. */
function Complete() {
  const router = useRouter();
  const params = useSearchParams();
  const { startSession } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    refreshSession()
      .then((data) => {
        startSession(data);
        router.replace(data.user.onboardingComplete ? safeNext(params.get('next')) : '/onboarding');
      })
      .catch(() => router.replace('/login?error=google_failed'));
  }, [router, params, startSession]);

  return <div className="page-loader"><Spinner size={28} /><span className="sr-only">Signing you in…</span></div>;
}

export default function OAuthCompletePage() {
  return <Suspense><Complete /></Suspense>;
}
