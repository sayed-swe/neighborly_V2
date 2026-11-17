'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Eye, Search } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { can } from '@/lib/permissions';
import { label } from '@/lib/categories';
import { SERVICE_CATEGORIES } from '@/lib/schemas';
import { timeAgo } from '@/lib/format';
import { Spinner, useToast } from '@/components/ui';
import { Pager, useDebounced } from '@/components/admin/bits';

export default function AdminServices() {
  const { user } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const isAdmin = can(user, 'users:manage');

  const load = useCallback(() => {
    api.get('/admin/services', { params: { ...(dq && { q: dq }), page } }).then(({ data: d }) => setData(d)).catch((e) => toast(parseError(e).message, 'error'));
  }, [dq, page, toast]);
  useEffect(() => { setData(null); load(); }, [load]);
  useEffect(() => { setPage(1); }, [dq]);

  async function patch(s, body, msg) {
    try {
      const { data: d } = await api.patch(`/admin/services/${s.id}`, body);
      setData((cur) => ({ ...cur, services: cur.services.map((x) => (x.id === s.id ? { ...x, verified: d.verified, active: d.active } : x)) }));
      toast(msg);
    } catch (e) { toast(parseError(e).message, 'error'); }
  }

  return (
    <div className="card">
      <div className="table-tools">
        <div className="table-search"><Search size={17} aria-hidden="true" /><label className="sr-only" htmlFor="svq">Search services</label>
          <input id="svq" className="input" placeholder="Search service name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {!isAdmin && <span className="small muted" style={{ alignSelf: 'center' }}>Only admins can verify providers.</span>}
      </div>
      {!data ? <div className="page-loader" style={{ minHeight: 240 }}><Spinner size={24} /></div> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Service</th><th>Provider</th><th>Rating</th><th>Listed</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.services.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 32 }}>No services yet.</td></tr>}
                {data.services.map((s) => (
                  <tr key={s.id} className={!s.active ? 'is-suspended' : ''}>
                    <td><strong>{s.name}</strong> {s.verified && <BadgeCheck size={15} className="verified" />}<span className="tiny muted" style={{ display: 'block' }}>{label(SERVICE_CATEGORIES, s.category)} · {s.areaName}</span></td>
                    <td className="small">{s.provider?.name}<span className="tiny muted" style={{ display: 'block' }}>{s.provider?.email}</span></td>
                    <td className="small">{s.ratingCount ? `★ ${s.rating} (${s.ratingCount})` : <span className="muted">–</span>}</td>
                    <td className="small muted">{timeAgo(s.createdAt)}</td>
                    <td>{s.active ? <span className="badge badge-green">Live</span> : <span className="badge">Paused</span>}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Link href={`/services/${s.id}`} className="btn btn-ghost btn-sm" aria-label="View"><Eye size={15} /></Link>
                      {isAdmin && <button className="btn btn-sm" onClick={() => patch(s, { verified: !s.verified }, s.verified ? 'Verification removed' : 'Provider verified')}><BadgeCheck size={15} /> {s.verified ? 'Unverify' : 'Verify'}</button>}
                      <button className="btn btn-ghost btn-sm" onClick={() => patch(s, { active: !s.active }, s.active ? 'Service paused' : 'Service live')}>{s.active ? 'Pause' : 'Resume'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} pages={data.pages} total={data.total} noun="service" onPage={setPage} />
        </>
      )}
    </div>
  );
}
