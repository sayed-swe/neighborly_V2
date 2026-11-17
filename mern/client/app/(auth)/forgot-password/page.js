'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { email } from '@/lib/schemas';
import { Alert, Button, Field } from '@/components/ui';
import AuthHeading from '@/components/AuthHeading';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(null);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ email })) });

  async function onSubmit(values) {
    setError('');
    try {
      await api.post('/auth/forgot-password', values);
      setSent(values.email);
    } catch (err) {
      setError(parseError(err).message);
    }
  }

  if (sent) {
    return (
      <div className="auth-state">
        <span className="auth-state-ico"><MailCheck size={30} /></span>
        <AuthHeading title="Check your email">If an account exists for <strong className="text-ink">{sent}</strong>, a reset link is on its way. It works once and expires in an hour.</AuthHeading>
        <p className="auth-switch"><Link className="link" href="/login">Back to sign in</Link></p>
      </div>
    );
  }
  return (
    <>
      <AuthHeading title="Reset your password">Enter your account email and we’ll send you a secure link.</AuthHeading>
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="auth-fields">
        <Field label="Email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        <Button type="submit" className="btn btn-primary btn-lg btn-block" loading={isSubmitting}>Send reset link</Button>
      </form>
      <p className="auth-switch">Remembered it? <Link href="/login" className="link">Sign in</Link></p>
    </>
  );
}
