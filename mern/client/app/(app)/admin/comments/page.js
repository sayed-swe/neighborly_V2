'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, ThumbsUp, Trash2 } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { Spinner, useToast } from '@/components/ui';
import { Pager, useDebounced } from '@/components/admin/bits';

export default function AdminComments() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/comments', { params: { ...(dq && { q: dq }), page } }).then(({ data: d }) => setData(d)).catch((e) => toast(parseError(e).message, 'error'));
  }, [dq, page, toast]);
  useEffect(() => { setData(null); load(); }, [load]);
  useEffect(() => { setPage(1); }, [dq]);

  async function remove(c) {
    if (!window.confirm('Delete this comment (and any replies)?')) return;
    try { await api.delete(`/admin/comments/${c.id}`); toast('Comment deleted'); load(); } catch (e) { toast(parseError(e).message, 'error'); }
  }

  return (
    <div className="card">
      <div className="table-tools">
        <div className="table-search"><Search size={17} aria-hidden="true" /><label className="sr-only" htmlFor="cq">Search comments</label>
          <input id="cq" className="input" placeholder="Search comment text" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {!data ? <div className="page-loader" style={{ minHeight: 240 }}><Spinner size={24} /></div> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Comment</th><th>Author</th><th>On post</th><th>Likes</th><th>Posted</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.comments.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 32 }}>No comments found.</td></tr>}
                {data.comments.map((c) => (
                  <tr key={c.id}>
                    <td style={{ maxWidth: 340 }}><div className="cell-text">{c.isReply && <span className="badge" style={{ marginRight: 6 }}>Reply</span>}{c.text}</div></td>
                    <td><strong className="small">{c.author?.name ?? 'Deleted'}</strong><span className="tiny muted" style={{ display: 'block' }}>{c.author?.email}</span></td>
                    <td className="small">{c.post ? <Link href={`/post/${c.post.id}`} className="link">{c.post.snippet || '(photo post)'}…</Link> : <span className="muted">Deleted</span>}</td>
                    <td className="small"><span className="eng"><ThumbsUp size={13} /> {c.reactionTotal}</span></td>
                    <td className="small muted">{timeAgo(c.createdAt)}</td>
                    <td style={{ textAlign: 'right' }}><button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => remove(c)}><Trash2 size={15} /> Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} pages={data.pages} total={data.total} noun="comment" onPage={setPage} />
        </>
      )}
    </div>
  );
}
