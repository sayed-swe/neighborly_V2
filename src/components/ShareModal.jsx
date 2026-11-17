import { useEffect, useState } from 'react'
import { Link2, Repeat2, Send } from 'lucide-react'
import { getConversations, sendMessage, sharePost } from '../lib/api'
import { appUrl } from '../lib/url'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Avatar, Modal } from './ui'
import { t } from '../lib/i18n'

export default function ShareModal({ post, onClose, onShared }) {
  const { profile } = useAuth()
  const toast = useToast()
  const original = post.shared_post?.id ? post.shared_post : post // share the original, like Facebook
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [convos, setConvos] = useState([])
  const [sentTo, setSentTo] = useState({})
  const link = appUrl(`/post/${original.id}`)

  useEffect(() => { getConversations().then(setConvos).catch(() => {}) }, [])

  const shareToFeed = async () => {
    setBusy(true)
    try {
      await sharePost(original.id, caption.trim(), profile.neighborhood_id)
      toast(t('Shared to your feed'))
      onShared?.()
      onClose()
    } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast(t('Link copied')) } catch { toast(link) }
  }

  const sendTo = async (c) => {
    try {
      await sendMessage(c.conversation_id, `${caption.trim() ? caption.trim() + '\n' : ''}${link}`)
      setSentTo((s) => ({ ...s, [c.conversation_id]: true }))
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <Modal title={t('Share')} onClose={onClose}>
      <div className="flex gap-12 items-center mb-12">
        <Avatar src={profile.avatar_url} name={profile.full_name} size={42} />
        <div>
          <div className="bold">{profile.full_name}</div>
          <div className="small muted">{t('Sharing to')} {profile.neighborhood?.name || t('your feed')}</div>
        </div>
      </div>
      <textarea className="composer-textarea" style={{ minHeight: 70, fontSize: 16 }} placeholder={t('Say something about this…')}
        value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={5000} />
      <div className="shared-box" style={{ margin: '6px 0 14px' }}>
        <div className="post-body" style={{ paddingTop: 10 }}>
          <div className="small bold">{original.author_name}</div>
          <div className="clamp-3">{original.body || original.title}</div>
        </div>
      </div>
      <div className="flex gap-8 wrap">
        <button className="btn btn-primary" onClick={shareToFeed} disabled={busy}><Repeat2 size={18} /> {t('Share now')}</button>
        <button className="btn btn-outline" onClick={copy}><Link2 size={18} /> {t('Copy link')}</button>
      </div>

      {convos.length > 0 && (
        <>
          <div className="divider" />
          <div className="bold mb-12">{t('Send in Messages')}</div>
          <div className="mini-list">
            {convos.slice(0, 6).map((c) => (
              <div key={c.conversation_id} className="mini-item">
                <Avatar src={c.other_avatar} name={c.other_name} size={36} />
                <div className="t" style={{ flex: 1 }}>{c.other_name}</div>
                <button className="btn btn-secondary btn-sm" disabled={sentTo[c.conversation_id]} onClick={() => sendTo(c)}>
                  <Send size={14} /> {sentTo[c.conversation_id] ? t('Sent') : t('Send')}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
