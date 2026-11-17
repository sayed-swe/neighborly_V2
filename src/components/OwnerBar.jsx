// Seller / poster row with Message + Report buttons, used in detail modals
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Flag, MessageCircle } from 'lucide-react'
import { startConversation } from '../lib/api'
import { timeAgo } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Avatar } from './ui'
import ReportModal from './ReportModal'
import { t } from '../lib/i18n'

export default function OwnerBar({ person, createdAt, label, reportType, reportId, messageText = 'Message' }) {
  const { profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [report, setReport] = useState(false)
  if (!person) return null
  const mine = person.id === profile.id

  const message = async () => {
    try { const id = await startConversation(person.id); navigate(`/messages/${id}`) } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div className="flex items-center gap-12" style={{ padding: '12px 0' }}>
      <Link to={`/profile/${person.username}`}><Avatar src={person.avatar_url} name={person.full_name} size={44} /></Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link to={`/profile/${person.username}`} className="bold">{person.full_name}</Link>
        <div className="small muted">{label}{createdAt ? ` · ${timeAgo(createdAt)}` : ''}</div>
      </div>
      {!mine && (
        <>
          <button className="btn btn-primary btn-sm" onClick={message}><MessageCircle size={15} /> {messageText}</button>
          {reportType && <button className="btn btn-secondary btn-sm" onClick={() => setReport(true)} aria-label={t('Report')}><Flag size={15} /></button>}
        </>
      )}
      {report && <ReportModal targetType={reportType} targetId={reportId} onClose={() => setReport(false)} />}
    </div>
  )
}
