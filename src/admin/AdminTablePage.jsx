import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, ExternalLink, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { labelize } from '../lib/format'
import { useToast } from '../context/ToastContext'
import { Empty, Spinner, StatusPill } from '../components/ui'
import { AlertForm } from '../pages/Alerts'
import { ADMIN_TABLES } from './adminTables'

const PAGE = 25
const clean = (s) => s.replace(/[,()%*\\]/g, ' ').trim()

export default function AdminTablePage() {
  const { table: key } = useParams()
  const cfg = ADMIN_TABLES[key]
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [extra, setExtra] = useState({})
  const [creating, setCreating] = useState(false)

  useEffect(() => { setPage(0); setQ(''); setSearch(''); setStatus(''); setExtra({}) }, [key])

  const load = async () => {
    if (!cfg) return
    setRows(null)
    let query = supabase.from(cfg.table).select(cfg.select, { count: 'exact' })
    if (q && cfg.search) query = query.or(cfg.search.map((f) => `${f}.ilike.%${clean(q)}%`).join(','))
    if (status && cfg.statusField) query = query.eq(cfg.statusField, status)
    Object.entries(extra).forEach(([f, v]) => { if (v) query = query.eq(f, v) })
    const { data, error, count: c } = await query.order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) { toast(error.message, 'error'); setRows([]); return }
    setRows(data); setCount(c || 0)
  }
  useEffect(() => { load() }, [key, page, q, status, JSON.stringify(extra)]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!cfg) return <Navigate to="/admin" replace />

  const update = async (row, values) => {
    const { error } = await supabase.from(cfg.table).update(values).eq('id', row.id)
    if (error) return toast(error.message, 'error')
    setRows((list) => list.map((r) => (r.id === row.id ? { ...r, ...values } : r)))
    toast('Saved')
  }
  const remove = async (row) => {
    if (!confirm('Permanently delete this item? This cannot be undone.')) return
    const { error } = await supabase.from(cfg.table).delete().eq('id', row.id)
    if (error) return toast(error.message, 'error')
    setRows((list) => list.filter((r) => r.id !== row.id)); setCount((c) => c - 1)
    toast('Deleted')
  }

  const exportCsv = () => {
    if (!rows?.length) return
    const flat = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v === null || typeof v !== 'object')))
    const headers = Object.keys(flat[0])
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [headers.join(','), ...flat.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `neighborly-${key}-page${page + 1}.csv`
    a.click()
  }

  const pages = Math.max(1, Math.ceil(count / PAGE))

  return (
    <>
      <div className="page-head">
        <div><h2>{cfg.title}</h2><p>{count.toLocaleString()} total</p></div>
        <div className="flex gap-8">
          <button className="btn btn-outline" onClick={exportCsv}><Download size={17} /> Export CSV</button>
          {cfg.canCreateAlert && <button className="btn btn-danger" onClick={() => setCreating(true)}><Plus size={17} /> New alert</button>}
        </div>
      </div>

      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setPage(0); setQ(search.trim()) }}>
        {cfg.search && <div className="search"><Search size={17} color="var(--muted)" /><input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>}
        {cfg.statuses && (
          <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => { setPage(0); setStatus(e.target.value) }}>
            <option value="">All statuses</option>
            {cfg.statuses.map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
          </select>
        )}
        {cfg.filters?.map((f) => (
          <select key={f.field} className="select" style={{ width: 'auto' }} value={extra[f.field] || ''} onChange={(e) => { setPage(0); setExtra((x) => ({ ...x, [f.field]: e.target.value })) }}>
            <option value="">All {f.label.toLowerCase()}s</option>
            {f.options.map((o) => <option key={o} value={o}>{labelize(o)}</option>)}
          </select>
        ))}
      </form>

      <div className="card">
        {rows === null ? <Spinner /> : rows.length === 0 ? <Empty title="No records" text="Nothing matches these filters." /> : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>#</th>
                  {cfg.columns.map((c) => <th key={c.label}>{c.label}</th>)}
                  {cfg.statusField && <th>Status</th>}
                  {cfg.toggles?.map((t) => <th key={t.field}>{t.label}</th>)}
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="muted small">{r.id}</td>
                    {cfg.columns.map((c) => <td key={c.label} style={{ maxWidth: 360 }}>{c.render(r)}</td>)}
                    {cfg.statusField && (
                      <td>
                        <div className="flex items-center gap-6">
                          <StatusPill value={r[cfg.statusField]} />
                          <select value={r[cfg.statusField]} onChange={(e) => update(r, { [cfg.statusField]: e.target.value })} aria-label="Change status">
                            {cfg.statuses.map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
                          </select>
                        </div>
                      </td>
                    )}
                    {cfg.toggles?.map((t) => (
                      <td key={t.field}><input type="checkbox" checked={Boolean(r[t.field])} onChange={(e) => update(r, { [t.field]: e.target.checked })} /></td>
                    ))}
                    <td>
                      <div className="row-actions">
                        {cfg.link?.(r) && <Link to={cfg.link(r)} className="icon-btn ghost" title="Open" target="_blank"><ExternalLink size={16} /></Link>}
                        <button className="icon-btn ghost" title="Delete" onClick={() => remove(r)}><Trash2 size={16} color="var(--red)" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pager">
          <span>Page {page + 1} of {pages}</span>
          <div className="flex gap-6">
            <button className="btn btn-outline btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={16} /> Prev</button>
            <button className="btn btn-outline btn-sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {creating && <AlertForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load() }} />}
    </>
  )
}
