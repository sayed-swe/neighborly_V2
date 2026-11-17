'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, ImageIcon, MessageSquare, RotateCcw, Search, ThumbsUp, Trash2 } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { CATEGORIES, CATEGORY_KEYS } from '@/lib/categories';
import { timeAgo } from '@/lib/format';
import { Avatar, Spinner, useToast } from '@/components/ui';
import { Pager, ReasonModal, StatusBadge, useDebounced } from '@/components/admin/bits';

export default function AdminPosts() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [filters, setFilters] = useState({ category: '', status: '', page: 1 });
  const [data, setData] = useState(null);
  const [action, setAction] = useState(null);

  const load = useCallback(() => {
    const params = { ...(dq && { q: dq }), ...(filters.category && { category: filters.category }), ...(filters.status && { status: filters.status }), page: filters.page };
    api.get('/admin/posts', { params }).then(({ data: d }) => setData(d)).catch((e) => toast(parseError(e).message, 'error'));
  }, [dq, filters, toast]);
  useEffect(() => { setData(null); load(); }, [load]);
  useEffect(() => { setFilters((f) => ({ ...f, page: 1 })); }, [dq]);

  async function setStatus(post, status, reason) {
    try {
      await api.patch(`/admin/posts/${post.id}/status`, { status, ...(reason && { reason }) });
      setData((d) => ({ ...d, posts: d.posts.map((p) => (p.id === post.id ? { ...p, status } : p)) }));
      toast(status === 'active' ? 'Post restored' : status === 'hidden' ? 'Post hidden' : 'Post removed');
    } catch (e) { toast(parseError(e).message, 'error'); throw e; }
  }

  return (
    <div className="card">
      <div className="table-tools">
        <div className="table-search"><Search size={17} aria-hidden="true" /><label className="sr-only" htmlFor="pq">Search posts</label>
          <input id="pq" className="input" placeholder="Search post text" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label className="sr-only" htmlFor="pc">Type</label>
        <select id="pc" className="select" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}>
          <option value="">All types</option>{CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
        </select>
        <label className="sr-only" htmlFor="ps">Status</label>
        <select id="ps" className="select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}>
          <option value="">Any status</option><option value="active">Live</option><option value="hidden">Hidden</option><option value="removed">Removed</option>
        </select>
      </div>
      {!data ? <div className="page-loader" style={{ minHeight: 240 }}><Spinner size={24} /></div> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Post</th><th>Author</th><th>Status</th><th>Engagement</th><th>Posted</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.posts.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 32 }}>No posts match those filters.</td></tr>}
                {data.posts.map((p) => (
                  <tr key={p.id} className={p.status !== 'active' ? 'is-suspended' : ''}>
                    <td style={{ maxWidth: 360 }}>
                      <div className="cell-text">{p.isShare && <span className="badge" style={{ marginRight: 6 }}>Share</span>}{p.text || <span className="muted">(photo only)</span>}</div>
                      <div className="tiny muted cell-sub">
                        <span className={`badge ${CATEGORIES[p.category]?.badge}`}>{CATEGORIES[p.category]?.short}</span>
                        {p.images.length > 0 && <span><ImageIcon size={12} /> {p.images.length}</span>}
                        {p.areaName && <span>{p.areaName}</span>}
                      </div>
                      {p.moderation && <div className="tiny" style={{ color: '#7a5410', marginTop: 4 }}>{p.moderation.by ?? 'Moderator'}: {p.moderation.reason || 'no reason given'}</div>}
                    </td>
                    <td><div className="member"><Avatar user={{ ...p.author, id: p.author?.id }} size={30} /><div><strong>{p.author?.name ?? 'Deleted'}</strong><span className="tiny muted">{p.author?.status === 'suspended' ? 'Suspended' : p.author?.role}</span></div></div></td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="small"><span className="eng"><ThumbsUp size={13} /> {p.reactionTotal}</span> <span className="eng"><MessageSquare size={13} /> {p.commentCount}</span></td>
                    <td className="small muted">{timeAgo(p.createdAt)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Link href={`/post/${p.id}`} className="btn btn-ghost btn-sm" aria-label="View post"><Eye size={15} /></Link>
                      {p.status === 'active' ? (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => setAction({ post: p, status: 'hidden' })}><EyeOff size={15} /> Hide</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setAction({ post: p, status: 'removed' })}><Trash2 size={15} /> Remove</button>
                        </>
                      ) : <button className="btn btn-sm" onClick={() => setStatus(p, 'active').catch(() => {})}><RotateCcw size={15} /> Restore</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} pages={data.pages} total={data.total} noun="post" onPage={(page) => setFilters({ ...filters, page })} />
        </>
      )}
      {action && (
        <ReasonModal danger={action.status === 'removed'} title={action.status === 'hidden' ? 'Hide this post?' : 'Remove this post?'}
          body={action.status === 'hidden' ? 'It disappears from everyone’s feed but can be restored later.' : 'It disappears from every feed and is marked removed. You can still restore it.'}
          confirmLabel={action.status === 'hidden' ? 'Hide post' : 'Remove post'}
          onConfirm={(reason) => setStatus(action.post, action.status, reason)} onClose={() => setAction(null)} />
      )}
    </div>
  );
}
