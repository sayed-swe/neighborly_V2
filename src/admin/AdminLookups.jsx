import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { Spinner } from '../components/ui'

const SECTIONS = [
  { table: 'neighborhoods', title: 'Neighborhoods', fields: [
    { key: 'name', label: 'Name', required: true }, { key: 'area', label: 'Area' }, { key: 'city', label: 'City' },
    { key: 'latitude', label: 'Lat', type: 'number' }, { key: 'longitude', label: 'Lng', type: 'number' },
  ] },
  { table: 'post_categories', title: 'Post categories', fields: [{ key: 'name', label: 'Name', required: true }, { key: 'icon', label: 'Icon (lucide name)' }] },
  { table: 'service_categories', title: 'Service categories', fields: [{ key: 'name', label: 'Name', required: true }, { key: 'icon', label: 'Icon (lucide name)' }] },
]

export default function AdminLookups() {
  return (
    <>
      <div className="page-head"><div><h2>Neighborhoods & categories</h2><p>The lists people pick from when they sign up and post.</p></div></div>
      <div className="list" style={{ gap: 20 }}>
        {SECTIONS.map((s) => <LookupTable key={s.table} {...s} />)}
      </div>
    </>
  )
}

function LookupTable({ table, title, fields }) {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const empty = Object.fromEntries(fields.map((f) => [f.key, '']))
  const [draft, setDraft] = useState(empty)

  const load = async () => {
    const { data, error } = await supabase.from(table).select('*').order('id')
    if (error) toast(error.message, 'error')
    setRows(data || [])
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const norm = (f, v) => (f.type === 'number' ? (v === '' || v === null ? null : Number(v)) : (v?.toString().trim() || null))

  const add = async (e) => {
    e.preventDefault()
    const values = Object.fromEntries(fields.map((f) => [f.key, norm(f, draft[f.key])]))
    if (fields.some((f) => f.required && !values[f.key])) return toast('Name is required', 'error')
    const { error } = await supabase.from(table).insert(values)
    if (error) return toast(error.message, 'error')
    setDraft(empty); load(); toast('Added')
  }
  const save = async (row, f, value) => {
    const v = norm(f, value)
    if (v === row[f.key] || (f.required && !v)) return
    const { error } = await supabase.from(table).update({ [f.key]: v }).eq('id', row.id)
    if (error) { toast(error.message, 'error'); load() } else toast('Saved')
  }
  const remove = async (row) => {
    if (!confirm(`Delete "${row.name}"? Items using it keep working but lose this label.`)) return
    const { error } = await supabase.from(table).delete().eq('id', row.id)
    if (error) return toast(error.message.includes('foreign key') ? 'Still in use — cannot delete.' : error.message, 'error')
    load()
  }

  return (
    <div className="card">
      <div className="card-pad"><div className="card-title">{title}</div></div>
      {rows === null ? <Spinner /> : (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>#</th>{fields.map((f) => <th key={f.key}>{f.label}</th>)}<th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="muted small">{r.id}</td>
                  {fields.map((f) => (
                    <td key={f.key}>
                      <input className="input" style={{ padding: '6px 8px' }} type={f.type || 'text'} step="any" defaultValue={r[f.key] ?? ''} onBlur={(e) => save(r, f, e.target.value)} />
                    </td>
                  ))}
                  <td><button className="icon-btn ghost" onClick={() => remove(r)} aria-label="Delete"><Trash2 size={16} color="var(--red)" /></button></td>
                </tr>
              ))}
              <tr>
                <td><Plus size={16} className="muted" /></td>
                {fields.map((f) => (
                  <td key={f.key}>
                    <input className="input" style={{ padding: '6px 8px' }} type={f.type || 'text'} step="any" placeholder={f.label} value={draft[f.key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && add(e)} />
                  </td>
                ))}
                <td><button className="btn btn-primary btn-sm" onClick={add}>Add</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
