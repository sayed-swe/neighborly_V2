'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import AuthHeading from '@/components/AuthHeading';
import ResendVerification from '@/components/ResendVerification';

function CheckEmail() {
  const email = useSearchParams().get('email') ?? '';
  return (
    <div className="auth-state">
      <span className="auth-state-ico"><MailCheck size={30} /></span>
      <AuthHeading title="Check your inbox">
        We sent a confirmation link to {email ? <strong className="text-ink">{email}</strong> : 'your email'}. It expires in 24 hours.
      </AuthHeading>
      <ol className="auth-tips small">
        <li>Open the email from Neighborly and tap <strong>Confirm email</strong>.</li>
        <li>You’ll be signed in and asked to set your home area.</li>
        <li>Can’t find it? Check spam or promotions.</li>
      </ol>
      <p className="small"><ResendVerification email={email} /></p>
      <p className="auth-switch">Wrong address? <Link className="link" href="/register">Start again</Link></p>
    </div>
  );
}

export default function CheckEmailPage() {
  return <Suspense><CheckEmail /></Suspense>;
}
