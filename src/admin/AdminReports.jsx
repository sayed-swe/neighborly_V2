import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ban, CheckCircle2, EyeOff, Flag, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { labelize, timeAgo } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Avatar, Empty, Field, Modal, Spinner, StatusPill } from '../components/ui'

// Where each reported thing lives, and how to hide it
const TARGETS = {
  post: { table: 'posts', owner: 'user_id', hide: { status: 'hidden' }, link: (id) => `/post/${id}`, label: (r) => r.title || r.body },
  comment: { table: 'comments', owner: 'user_id', hide: { status: 'hidden' }, link: null, label: (r) => r.content },
  listing: { table: 'marketplace_listings', owner: 'user_id', hide: { status: 'closed' }, link: (id) => `/marketplace?item=${id}`, label: (r) => r.title },
  lost_found: { table: 'lost_found_items', owner: 'user_id', hide: { status: 'resolved' }, link: (id) => `/lost-found?item=${id}`, label: (r) => r.item_name },
  event: { table: 'events', owner: 'created_by', hide: { status: 'cancelled' }, link: (id) => `/events?item=${id}`, label: (r) => r.title },
  help_request: { table: 'help_requests', owner: 'user_id', hide: { status: 'closed' }, link: (id) => `/services?tab=help&item=${id}`, label: (r) => r.title },
  service: { table: 'services', owner: 'provider_id', hide: { is_active: false }, link: (id) => `/services?item=${id}`, label: (r) => r.service_name },
  user: { table: 'profiles', owner: 'id', hide: null, link: null, label: (r) => `${r.full_name} (@${r.username})` },
}

export default function AdminReports() {
  const [status, setStatus] = useState('open')
  const [reports, setReports] = useState(null)
  const [selected, setSelected] = useState(null)

  const load = async () => {
    setReports(null)
    let q = supabase.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(id, full_name, username, avatar_url), reviewer:profiles!reports_reviewed_by_fkey(full_name)')
    q = status === 'open' ? q.in('status', ['pending', 'under_review']) : q.in('status', ['resolved', 'dismissed'])
    const { data } = await q.order('created_at', { ascending: false }).limit(200)
    setReports(data || [])
  }
  useEffect(() => { load() }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="page-head"><div><h2>Reports</h2><p>Content and people flagged by the community.</p></div></div>
      <div className="tabs">
        <button className={`tab ${status === 'open' ? 'active' : ''}`} onClick={() => setStatus('open')}>Open</button>
        <button className={`tab ${status === 'closed' ? 'active' : ''}`} onClick={() => setStatus('closed')}>Closed</button>
      </div>
      <div className="card">
        {reports === null ? <Spinner /> : reports.length === 0 ? <Empty icon={Flag} title="No reports here" text={status === 'open' ? 'The queue is empty. Nice.' : ''} /> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>#</th><th>Reported</th><th>Reason</th><th>Reporter</th><th>When</th><th>Status</th><th>Action</th><th /></tr></thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td className="muted small">{r.id}</td>
                    <td><div className="cell-main">{labelize(r.target_type)} #{String(r.target_id).slice(0, 8)}</div>{r.details && <div className="cell-sub">{r.details}</div>}</td>
                    <td><span className="pill red">{labelize(r.reason)}</span></td>
                    <td><div className="flex items-center gap-8"><Avatar src={r.reporter?.avatar_url} name={r.reporter?.full_name} size={26} /><span className="small">{r.reporter?.full_name}</span></div></td>
                    <td className="small muted">{timeAgo(r.created_at)}</td>
                    <td><StatusPill value={r.status} /></td>
                    <td className="small">{r.action_taken !== 'none' ? labelize(r.action_taken) : '—'}{r.reviewer && <div className="cell-sub">by {r.reviewer.full_name}</div>}</td>
                    <td><button className="btn btn-primary btn-sm" onClick={() => setSelected(r)}>Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && <ReviewModal report={selected} onClose={() => setSelected(null)} onDone={() => { setSelected(null); load() }} />}
    </>
  )
}

function ReviewModal({ report, onClose, onDone }) {
  const { profile } = useAuth()
  const toast = useToast()
  const t = TARGETS[report.target_type]
  const [target, setTarget] = useState(undefined)
  const [owner, setOwner] = useState(null)
  const [note, setNote] = useState(report.admin_note || '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from(t.table).select('*').eq('id', report.target_id).maybeSingle()
      setTarget(data || null)
      const ownerId = data?.[t.owner]
      if (ownerId) {
        const { data: o } = await supabase.from('profiles').select('id, full_name, username, avatar_url, status').eq('id', ownerId).maybeSingle()
        setOwner(o)
      }
    })()
  }, [report, t])

  const close = async (reportStatus, action) => {
    setBusy(true)
    try {
      if (action === 'content_removed' && t.hide && target) {
        const { error } = await supabase.from(t.table).update(t.hide).eq('id', report.target_id)
        if (error) throw error
      }
      if ((action === 'user_suspended' || action === 'user_banned') && owner) {
        const { error } = await supabase.from('profiles').update({ status: action === 'user_banned' ? 'banned' : 'suspended' }).eq('id', owner.id)
        if (error) throw error
      }
      if (action === 'warning_sent' && owner) {
        await supabase.from('notifications').insert({ user_id: owner.id, actor_id: profile.id, type: 'report',
          message: `⚠️ A moderator reviewed a report about your ${labelize(report.target_type).toLowerCase()} (${labelize(report.reason)}). Please follow the community guidelines.` })
      }
      const { error } = await supabase.from('reports').update({
        status: reportStatus, action_taken: action, admin_note: note.trim() || null, reviewed_by: profile.id, reviewed_at: new Date().toISOString(),
      }).eq('id', report.id)
      if (error) throw error
      toast('Report closed')
      onDone()
    } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  return (
    <Modal title={`Report #${report.id}`} onClose={onClose} wide>
      <div className="flex gap-8 wrap mb-12">
        <span className="pill">{labelize(report.target_type)}</span><span className="pill red">{labelize(report.reason)}</span><StatusPill value={report.status} />
      </div>
      {report.details && <p className="mb-12">“{report.details}” <span className="muted small">— {report.reporter?.full_name}</span></p>}

      <div className="card card-pad mb-12" style={{ background: 'var(--surface-2)' }}>
        <div className="small bold muted mb-12">REPORTED CONTENT</div>
        {target === undefined ? <Spinner /> : target === null ? <p className="muted">This item no longer exists.</p> : (
          <>
            <p style={{ whiteSpace: 'pre-wrap' }}>{t.label(target) || '(no text)'}</p>
            {target.image_url && <img src={target.image_url} alt="" style={{ maxHeight: 220, borderRadius: 10, marginTop: 10 }} />}
            {target.status && <div className="mt-8"><StatusPill value={target.status} /></div>}
            {t.link && <Link to={t.link(report.target_id)} target="_blank" className="link small mt-8" style={{ display: 'inline-block' }}>Open in app ↗</Link>}
          </>
        )}
        {owner && (
          <div className="flex items-center gap-8 mt-12">
            <Avatar src={owner.avatar_url} name={owner.full_name} size={30} />
            <span>Posted by <Link to={`/profile/${owner.username}`} target="_blank" className="bold">{owner.full_name}</Link></span>
            <StatusPill value={owner.status} />
          </div>
        )}
      </div>

      <Field label="Moderator note (private)"><textarea className="textarea" style={{ minHeight: 60 }} value={note} onChange={(e) => setNote(e.target.value)} /></Field>

      <div className="flex gap-8 wrap">
        <button className="btn btn-secondary" disabled={busy} onClick={() => close('dismissed', 'none')}><XCircle size={17} /> Dismiss</button>
        {owner && <button className="btn btn-secondary" disabled={busy} onClick={() => close('resolved', 'warning_sent')}><Flag size={17} /> Warn user</button>}
        {t.hide && target && <button className="btn btn-primary" disabled={busy} onClick={() => close('resolved', 'content_removed')}><EyeOff size={17} /> Remove content</button>}
        {owner && <button className="btn btn-outline" disabled={busy} onClick={() => close('resolved', 'user_suspended')}><CheckCircle2 size={17} /> Suspend user</button>}
        {owner && <button className="btn btn-danger" disabled={busy} onClick={() => close('resolved', 'user_banned')}><Ban size={17} /> Ban user</button>}
      </div>
    </Modal>
  )
}
