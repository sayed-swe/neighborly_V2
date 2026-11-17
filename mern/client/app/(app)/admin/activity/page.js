'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, parseError } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { can } from '@/lib/permissions';
import { AUDIT_LABELS, describeDevice, timeAgo } from '@/lib/format';
import { Spinner, useToast } from '@/components/ui';
import { Pager } from '@/components/admin/bits';

const TYPES = ['register', 'email_verified', 'login', 'login_failed', 'account_locked', 'password_reset', 'password_changed', 'role_changed', 'suspended', 'post_removed', 'post_hidden', 'comment_removed', 'report_handled', 'refresh_reuse_detected'];
const WARN = new Set(['login_failed', 'account_locked', 'refresh_reuse_detected', 'suspended', 'post_removed']);

export default function Activity() {
  const { user } = useAuth();
  const toast = useToast();
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const allowed = can(user, 'audit:read');

  const load = useCallback(() => {
    api.get('/admin/audit', { params: { ...(type && { type }), page } }).then(({ data: d }) => setData(d)).catch((e) => toast(parseError(e).message, 'error'));
  }, [type, page, toast]);
  useEffect(() => { if (allowed) { setData(null); load(); } }, [load, allowed]);

  if (!allowed) return <div className="card empty-state"><h2>Admins only</h2><p className="muted">The activity log is restricted to administrators.</p></div>;
  const detail = (m) => (m ? Object.entries(m).filter(([k, v]) => v && k !== 'id').map(([k, v]) => `${k}: ${v}`).join(' · ') : '');

  return (
    <div className="card">
      <div className="table-tools">
        <label className="sr-only" htmlFor="at">Event type</label>
        <select id="at" className="select" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All events</option>{TYPES.map((t) => <option key={t} value={t}>{AUDIT_LABELS[t] ?? t.replaceAll('_', ' ')}</option>)}
        </select>
        <span className="small muted" style={{ alignSelf: 'center' }}>Kept for 90 days</span>
      </div>
      {!data ? <div className="page-loader" style={{ minHeight: 240 }}><Spinner size={24} /></div> : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>Event</th><th>Member</th><th>By</th><th>Device</th><th>Details</th></tr></thead>
              <tbody>
                {data.events.map((e) => (
                  <tr key={e.id}>
                    <td className="small muted" title={new Date(e.createdAt).toLocaleString()} style={{ whiteSpace: 'nowrap' }}>{timeAgo(e.createdAt)}</td>
                    <td><span className={`badge ${WARN.has(e.type) ? 'badge-danger' : ''}`}>{AUDIT_LABELS[e.type] ?? e.type.replaceAll('_', ' ')}</span></td>
                    <td className="small">{e.user ? <><strong>{e.user.name}</strong><span className="tiny muted" style={{ display: 'block' }}>{e.user.email}</span></> : <span className="muted">–</span>}</td>
                    <td className="small">{e.actor?.name ?? <span className="muted">–</span>}</td>
                    <td className="tiny muted">{e.userAgent ? describeDevice(e.userAgent) : '–'}{e.ip ? <span style={{ display: 'block' }}>{e.ip}</span> : null}</td>
                    <td className="tiny muted" style={{ maxWidth: 240 }}>{detail(e.meta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} pages={data.pages} total={data.total} noun="event" onPage={setPage} />
        </>
      )}
    </div>
  );
}
