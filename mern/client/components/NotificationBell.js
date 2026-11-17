'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { useActivity } from '@/lib/ActivityProvider';
import { timeAgo } from '@/lib/format';
import { Avatar, Spinner } from './ui';

export default function NotificationBell() {
  const { notifications: unread, refresh } = useActivity();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setItems(null);
    api.get('/notifications', { params: { limit: 8 } }).then(({ data }) => setItems(data.notifications)).catch(() => setItems([]));
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  async function go(n) {
    setOpen(false);
    if (!n.read) api.post(`/notifications/${n.id}/read`).then(refresh).catch(() => {});
    if (n.link) router.push(n.link);
  }
  async function readAll() {
    await api.post('/notifications/read-all').catch(() => {});
    setItems((cur) => cur?.map((n) => ({ ...n, read: true })));
    refresh();
  }

  return (
    <div className="bell" ref={ref}>
      <button className="top-icon" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell size={20} />
        {unread > 0 && <span className="dot-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-pop card" role="dialog" aria-label="Notifications">
          <header><strong>Notifications</strong>{unread > 0 && <button className="link small" onClick={readAll}>Mark all read</button>}</header>
          {!items ? <div className="page-loader" style={{ minHeight: 120 }}><Spinner /></div> : items.length === 0 ? <p className="small muted" style={{ padding: 16 }}>You’re all caught up.</p> : (
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button className={n.read ? '' : 'is-unread'} onClick={() => go(n)}>
                    {n.actor ? <Avatar user={n.actor} size={36} /> : <span className="bell-sys">⚠</span>}
                    <span><span className="bell-msg">{n.message}</span><span className="tiny muted">{timeAgo(n.createdAt)}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link href="/alerts#notifications" className="bell-all" onClick={() => setOpen(false)}>See all notifications</Link>
        </div>
      )}
    </div>
  );
}
