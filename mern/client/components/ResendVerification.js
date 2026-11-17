'use client';
import { useEffect, useState } from 'react';
import { api, parseError } from '@/lib/api';

/** Resend-link button with a cooldown so people (and bots) can't hammer it. */
export default function ResendVerification({ email, className = 'link' }) {
  const [cooldown, setCooldown] = useState(0);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    setMsg('');
    try {
      const { data } = await api.post('/auth/resend-verification', { email });
      setMsg(data.message);
      setCooldown(60);
    } catch (err) {
      setMsg(parseError(err).message);
    }
  }
  return (
    <span>
      <button type="button" className={className} onClick={resend} disabled={!email || cooldown > 0}>
        {cooldown ? `Resend in ${cooldown}s` : 'Resend the confirmation link'}
      </button>
      {msg && <span className="tiny muted" style={{ display: 'block', marginTop: 4 }} role="status">{msg}</span>}
    </span>
  );
}
