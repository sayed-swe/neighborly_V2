'use client';
import { useCallback, useEffect, useState } from 'react';
import { Ban, ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { can, ROLE_LABELS } from '@/lib/permissions';
import { timeAgo } from '@/lib/format';
import { Avatar, Spinner, useToast } from '@/components/ui';

const ROLE_BADGE = { resident: '', provider: 'badge-sky', moderator: 'badge-sun', admin: 'badge-plum' };

export default function MembersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = can(user, 'users:manage');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState({ q: '', role: '', status: '', page: 1 });
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const params = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== ''));
    try {
      const { data: d } = await api.get('/admin/users', { params });
      setData(d);
    } catch (err) { toast(parseError(err).message, 'error'); }
  }, [query, toast]);

  useEffect(() => { if (can(user, 'users:read')) load(); }, [load, user]);
  useEffect(() => {
    const t = setTimeout(() => setQuery((p) => (p.q === q ? p : { ...p, q, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [q]);

  async function update(target, path, body, msg) {
    setBusyId(target.id);
    try {
      const { data: d } = await api.patch(`/admin/users/${target.id}/${path}`, body);
      setData((prev) => ({ ...prev, users: prev.users.map((u) => (u.id === target.id ? d.user : u)) }));
      toast(msg);
    } catch (err) { toast(parseError(err).message, 'error'); }
    setBusyId(null);
  }

  function toggleSuspend(target) {
    const suspend = target.status === 'active';
    if (suspend && !window.confirm(`Suspend ${target.name}? They’ll be signed out everywhere immediately.`)) return;
    update(target, 'status', { status: suspend ? 'suspended' : 'active' }, suspend ? `${target.name} suspended` : `${target.name} restored`);
  }

  return (
    <div className="admin">
      <p className="muted admin-intro">{canManage ? 'Manage roles and access for everyone in the community.' : 'View community members. Only admins can change roles.'}</p>

      <div className="card">
        <div className="table-tools">
          <div className="table-search">
            <Search size={17} aria-hidden="true" />
            <label htmlFor="member-q" className="sr-only">Search members</label>
            <input id="member-q" className="input" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <label className="sr-only" htmlFor="f-role">Filter by role</label>
          <select id="f-role" className="select" value={query.role} onChange={(e) => setQuery((p) => ({ ...p, role: e.target.value, page: 1 }))}>
            <option value="">All roles</option>
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className="sr-only" htmlFor="f-status">Filter by status</label>
          <select id="f-status" className="select" value={query.status} onChange={(e) => setQuery((p) => ({ ...p, status: e.target.value, page: 1 }))}>
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {!data ? <div className="page-loader" style={{ minHeight: 200 }}><Spinner size={24} /></div> : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Member</th><th>Role</th><th>Area</th><th>Joined</th><th>Status</th>{canManage && <th><span className="sr-only">Actions</span></th>}</tr>
                </thead>
                <tbody>
                  {data.users.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 32 }}>No members match those filters.</td></tr>}
                  {data.users.map((u) => {
                    const self = u.id === user.id;
                    return (
                      <tr key={u.id} className={u.status === 'suspended' ? 'is-suspended' : ''}>
                        <td>
                          <div className="member">
                            <Avatar user={u} size={34} />
                            <div><strong>{u.name}{self && <span className="tiny muted"> (you)</span>}</strong><span className="tiny muted">{u.email}{!u.emailVerified && ' · unconfirmed'}</span></div>
                          </div>
                        </td>
                        <td>
                          {canManage && !self ? (
                            <select className="select select-sm" aria-label={`Role for ${u.name}`} value={u.role} disabled={busyId === u.id}
                              onChange={(e) => update(u, 'role', { role: e.target.value }, `${u.name} is now ${ROLE_LABELS[e.target.value]}`)}>
                              {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          ) : <span className={`badge ${ROLE_BADGE[u.role]}`}>{ROLE_LABELS[u.role]}</span>}
                        </td>
                        <td className="small">{u.location?.areaName ?? <span className="muted">Not set</span>}</td>
                        <td className="small muted">{timeAgo(u.createdAt)}</td>
                        <td><span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-danger'}`}>{u.status === 'active' ? 'Active' : 'Suspended'}</span></td>
                        {canManage && (
                          <td style={{ textAlign: 'right' }}>
                            {!self && (
                              <button className={`btn btn-sm ${u.status === 'active' ? 'btn-ghost' : ''}`} disabled={busyId === u.id} onClick={() => toggleSuspend(u)}>
                                {u.status === 'active' ? <><Ban size={15} /> Suspend</> : <><RotateCcw size={15} /> Restore</>}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-foot">
              <span className="small muted">{data.total} member{data.total === 1 ? '' : 's'}</span>
              <div className="pager">
                <button className="btn btn-sm" disabled={data.page <= 1} onClick={() => setQuery((p) => ({ ...p, page: p.page - 1 }))} aria-label="Previous page"><ChevronLeft size={16} /></button>
                <span className="small">Page {data.page} of {data.pages}</span>
                <button className="btn btn-sm" disabled={data.page >= data.pages} onClick={() => setQuery((p) => ({ ...p, page: p.page + 1 }))} aria-label="Next page"><ChevronRight size={16} /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
