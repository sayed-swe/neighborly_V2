'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { useActivity } from '@/lib/ActivityProvider';
import { timeAgo } from '@/lib/format';
import { Avatar, Spinner, useToast } from '@/components/ui';

const POLL_MS = 4000;

function Thread({ id, onSent }) {
  const toast = useToast();
  const { refresh } = useActivity();
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const endRef = useRef(null);
  const lastCursor = useRef(null);

  const markRead = useCallback(() => api.post(`/conversations/${id}/read`).then(refresh).catch(() => {}), [id, refresh]);

  useEffect(() => {
    let alive = true;
    setData(null); lastCursor.current = null;
    api.get(`/conversations/${id}/messages`).then(({ data: d }) => {
      if (!alive) return;
      setData(d); lastCursor.current = d.messages.at(-1)?.cursor ?? null; markRead();
      setTimeout(() => endRef.current?.scrollIntoView(), 0);
    }).catch((e) => toast(parseError(e).message, 'error'));
    // Poll for new messages while the conversation is open
    const t = setInterval(async () => {
      if (document.visibilityState !== 'visible' || !lastCursor.current) return;
      try {
        const { data: d } = await api.get(`/conversations/${id}/messages`, { params: { after: lastCursor.current } });
        if (alive) setData((cur) => (cur && cur.seenAt !== d.seenAt ? { ...cur, seenAt: d.seenAt } : cur));
        if (alive && d.messages.length) {
          setData((cur) => ({ ...cur, messages: [...cur.messages, ...d.messages.filter((m) => !cur.messages.some((x) => x.id === m.id))] }));
          lastCursor.current = d.messages.at(-1).cursor;
          markRead(); onSent?.();
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
        }
      } catch { /* try again next tick */ }
    }, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [id, toast, markRead, onSent]);

  async function older() {
    setLoadingOlder(true);
    try {
      const { data: d } = await api.get(`/conversations/${id}/messages`, { params: { before: data.messages[0].cursor } });
      setData((cur) => ({ ...cur, hasMore: d.hasMore, messages: [...d.messages, ...cur.messages] }));
    } catch (e) { toast(parseError(e).message, 'error'); }
    setLoadingOlder(false);
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const { data: d } = await api.post(`/conversations/${id}/messages`, { body });
      setData((cur) => ({ ...cur, messages: [...cur.messages, d.message] }));
      lastCursor.current = d.message.cursor; setText(''); onSent?.();
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
    } catch (e) { const err = parseError(e); toast(err.fields?.body ?? err.message, 'error'); }
    setSending(false);
  }

  if (!data) return <div className="page-loader"><Spinner size={24} /></div>;
  // "Seen" goes under my latest message the other member has read
  const seenId = data.seenAt && data.messages.findLast((m) => m.mine && new Date(m.createdAt) <= new Date(data.seenAt))?.id;
  const lastMine = data.messages.findLast((m) => m.mine)?.id;
  return (
    <div className="thread">
      <header className="thread-head">
        <Link href="/messages" className="icon-btn thread-back" aria-label="Back to conversations"><ArrowLeft size={18} /></Link>
        <Avatar user={data.with} size={38} />
        <div><Link href={`/u/${data.with.id}`} className="post-author">{data.with.name}</Link><span className="tiny muted" style={{ display: 'block' }}>{data.with.areaName}</span></div>
      </header>
      <div className="thread-body" aria-live="polite">
        {data.hasMore && <button className="link small thread-older" onClick={older} disabled={loadingOlder}>{loadingOlder ? 'Loading…' : 'Load earlier messages'}</button>}
        {data.messages.length === 0 && <p className="small muted thread-empty">Say hello to {data.with.name.split(' ')[0]}. Messages are private between the two of you.</p>}
        {data.messages.map((m, i) => {
          const prev = data.messages[i - 1];
          const gap = !prev || new Date(m.createdAt) - new Date(prev.createdAt) > 15 * 60e3;
          return (
            <div key={m.id}>
              {gap && <p className="thread-time tiny muted">{new Date(m.createdAt).toLocaleString('en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</p>}
              <div className={`bubble ${m.mine ? 'mine' : ''}`}>{m.body}</div>
              {m.id === seenId && <p className="bubble-receipt tiny muted">{m.id === lastMine ? 'Seen' : `Seen ${timeAgo(data.seenAt)}`}</p>}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="thread-compose">
        <label htmlFor="msg" className="sr-only">Message</label>
        <textarea id="msg" rows={1} maxLength={2000} value={text} placeholder="Write a message…" onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="btn btn-primary" onClick={send} disabled={!text.trim() || sending} aria-label="Send"><Send size={17} /></button>
      </div>
    </div>
  );
}

function Messages() {
  const params = useSearchParams();
  const active = params.get('c');
  const [list, setList] = useState(null);
  const loadList = useCallback(() => {
    api.get('/conversations').then(({ data }) => setList(data.conversations)).catch(() => setList([]));
  }, []);
  useEffect(() => {
    loadList();
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadList(); }, 15000);
    return () => clearInterval(t);
  }, [loadList]);

  return (
    <div className={`messages card ${active ? 'has-thread' : ''}`}>
      <aside className="convs" aria-label="Conversations">
        <h1 className="convs-h">Messages</h1>
        {!list ? <div className="page-loader" style={{ minHeight: 120 }}><Spinner /></div> : list.length === 0 ? (
          <p className="small muted" style={{ padding: '0 16px' }}>No conversations yet. Use “Message” on a listing, a service or someone’s profile to start one.</p>
        ) : (
          <ul>
            {list.map((c) => (
              <li key={c.id}>
                <Link href={`/messages?c=${c.id}`} className={`conv ${active === String(c.id) ? 'is-active' : ''} ${c.unread ? 'is-unread' : ''}`}>
                  <Avatar user={c.with} size={44} />
                  <span className="conv-main">
                    <span className="conv-top"><strong>{c.with.name}</strong><span className="tiny muted">{c.lastMessage && timeAgo(c.lastMessage.at)}</span></span>
                    <span className="conv-last small">{c.lastMessage?.mine && 'You: '}{c.lastMessage?.text}</span>
                  </span>
                  {c.unread > 0 && <span className="dot-count static">{c.unread}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <section className="thread-pane">
        {active ? <Thread key={active} id={active} onSent={loadList} /> : (
          <div className="empty-state"><MessageCircle size={34} /><h2>Your messages</h2><p className="muted">Pick a conversation, or message a seller, a provider or a neighbour from their profile.</p></div>
        )}
      </section>
    </div>
  );
}

export default function MessagesPage() {
  return <Suspense><Messages /></Suspense>;
}
