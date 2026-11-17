'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, parseError } from '@/lib/api';
import { password } from '@/lib/schemas';
import { Alert, Button, PasswordField } from '@/components/ui';
import AuthHeading from '@/components/AuthHeading';

const schema = z.object({ password, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords don’t match' });

function ResetForm() {
  const token = useSearchParams().get('token');
  const router = useRouter();
  const [error, setError] = useState('');
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), mode: 'onTouched' });

  async function onSubmit({ password: pw }) {
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password: pw });
      router.replace('/login?reset=1');
    } catch (err) {
      const e = parseError(err);
      setError(e.fields?.password ?? e.message);
    }
  }

  if (!token) {
    return (
      <>
        <AuthHeading title="Link is incomplete">Open the reset link from your email again, or request a new one.</AuthHeading>
        <Link className="btn btn-primary btn-block" href="/forgot-password">Request a new link</Link>
      </>
    );
  }
  return (
    <>
      <AuthHeading title="Choose a new password">Signing in with the new password will sign you out everywhere else.</AuthHeading>
      {error && <Alert kind="error" actions={<Link className="link" href="/forgot-password">Request a new link</Link>}>{error}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="auth-fields">
        <PasswordField label="New password" autoComplete="new-password" autoFocus showStrength value={watch('password')} error={errors.password?.message} {...register('password')} />
        <PasswordField label="Confirm new password" autoComplete="new-password" value={watch('confirm')} error={errors.confirm?.message} {...register('confirm')} />
        <Button type="submit" className="btn btn-primary btn-lg btn-block" loading={isSubmitting}>Update password</Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>;
}
