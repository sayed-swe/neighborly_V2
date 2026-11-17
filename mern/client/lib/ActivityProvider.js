'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

const ActivityContext = createContext({ notifications: 0, messages: 0, alerts: [], refresh: () => {} });

/**
 * Unread notifications, unread messages and active emergency alerts, refreshed every 30 s
 * (and immediately when a page calls refresh()). Pauses while the tab is hidden.
 */
export function ActivityProvider({ children }) {
  const [state, setState] = useState({ notifications: 0, messages: 0, alerts: [] });

  const refresh = useCallback(async () => {
    const [n, m, a] = await Promise.allSettled([
      api.get('/notifications/unread-count'), api.get('/conversations/unread-count'), api.get('/alerts'),
    ]);
    setState((s) => ({
      notifications: n.status === 'fulfilled' ? n.value.data.count : s.notifications,
      messages: m.status === 'fulfilled' ? m.value.data.count : s.messages,
      alerts: a.status === 'fulfilled' ? a.value.data.alerts : s.alerts,
    }));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 30000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  return <ActivityContext.Provider value={{ ...state, refresh }}>{children}</ActivityContext.Provider>;
}

export const useActivity = () => useContext(ActivityContext);
