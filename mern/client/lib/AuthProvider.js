'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, refreshSession, setAccessToken, setSessionEndHandler } from './api';
import { clearCachedPages } from '@/components/ServiceWorker';

const AuthContext = createContext(null);
const hasHint = () => typeof document !== 'undefined' && document.cookie.split('; ').includes('nb_session=1');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous
  const router = useRouter();

  const endSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
    clearCachedPages();
  }, []);

  useEffect(() => {
    setSessionEndHandler(endSession);
    if (!hasHint()) { setStatus('anonymous'); return; }
    refreshSession()
      .then((data) => { setUser(data.user); setStatus('authenticated'); })
      .catch(endSession);
  }, [endSession]);

  /** Called with an auth response ({ user, accessToken }) from login / verify. */
  const startSession = useCallback(({ user: u, accessToken }) => {
    setAccessToken(accessToken);
    setUser(u);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* cookie cleared server-side anyway */ }
    endSession();
    router.replace('/login');
  }, [endSession, router]);

  const value = useMemo(() => ({ user, status, setUser, startSession, logout, endSession }), [user, status, startSession, logout, endSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
