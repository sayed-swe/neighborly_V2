'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthProvider';
import AppShell from '@/components/AppShell';
import { Spinner } from '@/components/ui';

/**
 * Client-side gate for every signed-in page. The Next proxy already redirects
 * visitors with no session hint; this handles expired sessions and onboarding.
 * The API independently rejects any request without a valid token.
 */
export default function AppLayout({ children }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'anonymous') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (status === 'authenticated' && !user.onboardingComplete && pathname !== '/onboarding') router.replace('/onboarding');
  }, [status, user, pathname, router]);

  if (status !== 'authenticated' || (!user.onboardingComplete && pathname !== '/onboarding')) {
    return <div className="page-loader" aria-live="polite"><Spinner size={28} /><span className="sr-only">Loading your neighbourhood…</span></div>;
  }
  if (pathname === '/onboarding') return children;
  return <AppShell>{children}</AppShell>;
}
