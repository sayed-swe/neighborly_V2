import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, ExternalLink, Search, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { adminUsers } from '../lib/api'
import { formatDate, labelize, timeAgo } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Avatar, Empty, Field, Modal, Spinner, StatusPill } from '../components/ui'

const ROLES = ['resident', 'service_provider', 'moderator', 'admin']
const STATUSES = ['active', 'suspended', 'banned']

export default function AdminUsers() {
  const { profile } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState(null)
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [notify, setNotify] = useState(null)

  const load = () => adminUsers().then(setUsers).catch((e) => { toast(e.message, 'error'); setUsers([]) })
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => (users || []).filter((u) =>
    (!role || u.role === role) && (!status || u.status === status) &&
    (!q || [u.full_name, u.username, u.email, u.phone].some((v) => v?.toLowerCase().includes(q.toLowerCase())))), [users, q, role, status])

  const update = async (u, values) => {
    if (u.id === profile.id && (values.role && values.role !== 'admin' || values.status && values.status !== 'active')) {
      if (!confirm('You are changing your own account and may lose admin access. Continue?')) return
    }
    const { error } = await supabase.from('profiles').update(values).eq('id', u.id)
    if (error) return toast(error.message, 'error')
    setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, ...values } : x)))
    toast('User updated')
  }

  const exportCsv = () => {
    const headers = ['full_name', 'username', 'email', 'phone', 'role', 'status', 'neighborhood_name', 'post_count', 'report_count', 'created_at', 'last_sign_in_at']
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [headers.join(','), ...shown.map((u) => headers.map((h) => esc(u[h])).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'neighborly-users.csv'; a.click()
  }

  return (
    <>
      <div className="page-head">
        <div><h2>Users</h2><p>{users ? `${users.length} members` : 'Loading…'} · change roles, suspend or ban accounts.</p></div>
        <button className="btn btn-outline" onClick={exportCsv}><Download size={17} /> Export CSV</button>
      </div>
      <div className="toolbar">
        <div className="search"><Search size={17} color="var(--muted)" /><input placeholder="Name, username, email, phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="select" style={{ width: 'auto' }} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>{ROLES.map((r) => <option key={r} value={r}>{labelize(r)}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
        </select>
      </div>
      <div className="card">
        {users === null ? <Spinner /> : shown.length === 0 ? <Empty title="No users found" /> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>User</th><th>Email</th><th>Neighborhood</th><th>Posts</th><th>Reports</th><th>Joined</th><th>Last seen</th><th>Role</th><th>Status</th><th /></tr></thead>
              <tbody>
                {shown.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-8">
                        <Avatar src={u.avatar_url} name={u.full_name} size={34} />
                        <div style={{ minWidth: 0 }}><div className="cell-main">{u.full_name}</div><div className="cell-sub">@{u.username}{u.phone ? ` · ${u.phone}` : ''}</div></div>
                      </div>
                    </td>
                    <td className="small">{u.email}</td>
                    <td className="small">{u.neighborhood_name || '—'}</td>
                    <td>{u.post_count}</td>
                    <td>{Number(u.report_count) > 0 ? <span className="pill red">{u.report_count}</span> : 0}</td>
                    <td className="small muted">{formatDate(u.created_at)}</td>
                    <td className="small muted">{u.last_sign_in_at ? timeAgo(u.last_sign_in_at) : 'Never'}</td>
                    <td>
                      <select value={u.role} onChange={(e) => update(u, { role: e.target.value })} disabled={profile.role !== 'admin'}>
                        {ROLES.map((r) => <option key={r} value={r}>{labelize(r)}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="flex items-center gap-6">
                        <StatusPill value={u.status} />
                        <select value={u.status} onChange={(e) => update(u, { status: e.target.value })}>
                          {STATUSES.map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
                        </select>
                      </div>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn ghost" title="Send notification" onClick={() => setNotify(u)}><Send size={16} /></button>
                        <Link className="icon-btn ghost" to={`/profile/${u.username}`} target="_blank" title="View profile"><ExternalLink size={16} /></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {notify && <NotifyModal user={notify} onClose={() => setNotify(null)} />}
    </>
  )
}

function NotifyModal({ user, onClose }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [message, setMessage] = useState('')
  const send = async () => {
    if (!message.trim()) return
    const { error } = await supabase.from('notifications').insert({ user_id: user.id, actor_id: profile.id, type: 'system', message: message.trim().slice(0, 255) })
    if (error) return toast(error.message, 'error')
    toast('Notification sent'); onClose()
  }
  return (
    <Modal title={`Notify ${user.full_name}`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={send}>Send</button></>}>
      <Field label="Message" hint="Shows up in their notifications as a system notice (max 255 characters).">
        <textarea className="textarea" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={255} />
      </Field>
    </Modal>
  )
}
