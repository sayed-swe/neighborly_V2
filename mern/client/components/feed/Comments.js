'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Trash2, Flag } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { applyReaction } from '@/lib/reactions';
import { timeAgo } from '@/lib/format';
import { Avatar, Spinner, useToast } from '@/components/ui';
import ReportModal from './ReportModal';

function CommentBox({ placeholder, onSubmit, autoFocus, compact }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try { await onSubmit(t); setText(''); } finally { setBusy(false); }
  }
  return (
    <div className={`cbox ${compact ? 'cbox-sm' : ''}`}>
      <Avatar user={user} size={compact ? 28 : 34} />
      <div className="cbox-field">
        <label className="sr-only" htmlFor={`c-${placeholder}`}>{placeholder}</label>
        <textarea ref={ref} id={`c-${placeholder}`} rows={1} value={text} maxLength={1000} placeholder={placeholder}
          onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`; }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button type="button" className="cbox-send" onClick={send} disabled={!text.trim() || busy} aria-label="Post comment">
          {busy ? <Spinner size={16} /> : <Send size={17} />}
        </button>
      </div>
    </div>
  );
}

function Comment({ c, onReply, onDelete, onChange, isReply }) {
  const toast = useToast();
  const [reporting, setReporting] = useState(false);
  const { user } = useAuth();

  async function like() {
    const next = c.myReaction ? null : 'like';
    onChange(applyReaction(c, next));
    try {
      const { data } = next ? await api.put(`/comments/${c.id}/reaction`, { type: 'like' }) : await api.delete(`/comments/${c.id}/reaction`);
      onChange({ ...applyReaction(c, next), ...data });
    } catch (err) { onChange(c); toast(parseError(err).message, 'error'); }
  }

  return (
    <li className="comment">
      <Avatar user={c.author} size={isReply ? 28 : 34} />
      <div className="comment-main">
        <div className="comment-bubble">
          <strong>{c.author.name}</strong>
          {c.author.role !== 'resident' && <span className="comment-role">{c.author.role === 'provider' ? 'Provider' : c.author.role === 'moderator' ? 'Moderator' : 'Admin'}</span>}
          <p>{c.text}</p>
          {c.reactionTotal > 0 && <span className="comment-likes" title={`${c.reactionTotal} like${c.reactionTotal === 1 ? '' : 's'}`}>👍 {c.reactionTotal}</span>}
        </div>
        <div className="comment-actions">
          <button className={c.myReaction ? 'is-on' : ''} onClick={like} aria-pressed={Boolean(c.myReaction)}>Like</button>
          <button onClick={onReply}>Reply</button>
          <span title={new Date(c.createdAt).toLocaleString()}>{timeAgo(c.createdAt)}</span>
          {c.canDelete && <button onClick={onDelete} aria-label="Delete comment"><Trash2 size={13} /> Delete</button>}
          {c.author.id !== user.id && <button onClick={() => setReporting(true)} aria-label="Report comment"><Flag size={13} /></button>}
        </div>
        {reporting && <ReportModal kind="comment" id={c.id} onClose={() => setReporting(false)} />}
      </div>
    </li>
  );
}

export default function Comments({ postId, total, onDelta, autoFocus }) {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [next, setNext] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  const load = useCallback(async (after) => {
    const { data } = await api.get(`/posts/${postId}/comments`, { params: after ? { after } : {} });
    return data;
  }, [postId]);

  useEffect(() => {
    let alive = true;
    load().then((d) => { if (alive) { setItems(d.comments); setNext(d.next); } }).catch((e) => { toast(parseError(e).message, 'error'); setItems([]); });
    return () => { alive = false; };
  }, [load, toast]);

  async function more() {
    setLoadingMore(true);
    try { const d = await load(next); setItems((cur) => [...cur, ...d.comments]); setNext(d.next); }
    catch (e) { toast(parseError(e).message, 'error'); }
    setLoadingMore(false);
  }

  async function add(text, parent) {
    try {
      const { data } = await api.post(`/posts/${postId}/comments`, { text, ...(parent ? { parent } : {}) });
      setItems((cur) => parent
        ? cur.map((c) => (c.id === parent ? { ...c, replies: [...c.replies, data.comment], replyCount: c.replyCount + 1 } : c))
        : [...cur, data.comment]);
      onDelta(1);
      setReplyTo(null);
    } catch (e) { toast(parseError(e).fields?.text ?? parseError(e).message, 'error'); throw e; }
  }

  async function remove(c, parentId) {
    if (!window.confirm('Delete this comment?')) return;
    try {
      const { data } = await api.delete(`/comments/${c.id}`);
      setItems((cur) => parentId
        ? cur.map((x) => (x.id === parentId ? { ...x, replies: x.replies.filter((r) => r.id !== c.id), replyCount: x.replyCount - 1 } : x))
        : cur.filter((x) => x.id !== c.id));
      onDelta(-data.removed);
    } catch (e) { toast(parseError(e).message, 'error'); }
  }

  const patch = (id, parentId, updated) => setItems((cur) => cur.map((c) => {
    if (!parentId) return c.id === id ? { ...c, ...updated, replies: c.replies } : c;
    return c.id === parentId ? { ...c, replies: c.replies.map((r) => (r.id === id ? { ...r, ...updated } : r)) } : c;
  }));

  return (
    <section className="comments" aria-label="Comments">
      {items === null ? <div className="comments-loading"><Spinner /> Loading comments…</div> : (
        <>
          {items.length === 0 && <p className="small muted comments-empty">No comments yet. Be the first to say something.</p>}
          <ul className="comment-list">
            {items.map((c) => (
              <li key={c.id} className="comment-thread">
                <ul>
                  <Comment c={c} onChange={(u) => patch(c.id, null, u)} onReply={() => setReplyTo(c.id)} onDelete={() => remove(c)} />
                  {c.replies.length > 0 && (
                    <li><ul className="reply-list">
                      {c.replies.map((r) => <Comment key={r.id} c={r} isReply onChange={(u) => patch(r.id, c.id, u)} onReply={() => setReplyTo(c.id)} onDelete={() => remove(r, c.id)} />)}
                    </ul></li>
                  )}
                  {replyTo === c.id && <li className="reply-box"><CommentBox compact autoFocus placeholder={`Reply to ${c.author.name.split(' ')[0]}…`} onSubmit={(t) => add(t, c.id)} /></li>}
                </ul>
              </li>
            ))}
          </ul>
          {next && <button className="link small comments-more" onClick={more} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'View more comments'}</button>}
        </>
      )}
      <CommentBox autoFocus={autoFocus} placeholder="Write a comment…" onSubmit={(t) => add(t)} />
    </section>
  );
}
