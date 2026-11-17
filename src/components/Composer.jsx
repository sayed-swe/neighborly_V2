import { useState } from 'react'
import { ImagePlus, Megaphone } from 'lucide-react'
import { createPost, updatePost, uploadImage } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ErrorText, Modal } from './ui'
import { ImagePicker } from './FormBits'
import { t } from '../lib/i18n'

// Simple post box at the top of the feed: write, optionally add a photo, post.
// Posts always go to the writer's own community (their neighborhood).
export function ComposerBox({ onPosted }) {
  const { profile, isAdmin } = useAuth()
  const toast = useToast()
  const [body, setBody] = useState('')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)
  const [showPhoto, setShowPhoto] = useState(false)
  const [announcement, setAnnouncement] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canPost = (body.trim() || file) && !busy

  const submit = async (e) => {
    e.preventDefault()
    if (!canPost) return
    setBusy(true); setError('')
    try {
      const values = {
        body: body.trim(),
        image_url: file ? await uploadImage(file, 'post') : null,
        neighborhood_id: profile.neighborhood_id || null,
      }
      if (isAdmin && announcement) { values.post_type = 'announcement'; values.title = title.trim() || null }
      await createPost(values)
      toast(t('Posted to your community'))
      setBody(''); setTitle(''); setFile(null); setShowPhoto(false); setAnnouncement(false)
      onPosted?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card simple-composer" onSubmit={submit}>
      <ErrorText error={error} />
      {isAdmin && announcement && (
        <input className="input mb-8" placeholder={t('Announcement title')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      )}
      <textarea className="textarea" rows={2} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000}
        placeholder={t('Write something for your community…')} aria-label={t('Write something for your community…')} />
      {showPhoto && <div className="mt-8"><ImagePicker file={file} onChange={(f) => { setFile(f); if (!f) setShowPhoto(false) }} /></div>}
      <div className="simple-composer-bar">
        <div className="flex gap-8 items-center wrap">
          {!showPhoto && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPhoto(true)}>
              <ImagePlus size={16} /> {t('Photo')}
            </button>
          )}
          {isAdmin && (
            <label className="flex items-center gap-8 small" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={announcement} onChange={(e) => setAnnouncement(e.target.checked)} />
              <Megaphone size={14} /> {t('Official announcement')}
            </label>
          )}
        </div>
        <button className="btn btn-primary btn-sm" disabled={!canPost}>{busy ? t('Posting…') : t('Post')}</button>
      </div>
    </form>
  )
}

// Edit an existing post
export function PostModal({ post, onClose, onSaved }) {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [body, setBody] = useState(post?.body || '')
  const [title, setTitle] = useState(post?.title || '')
  const [file, setFile] = useState(null)
  const [keepImage, setKeepImage] = useState(post?.image_url || null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isAnnouncement = post?.post_type === 'announcement'

  const canSubmit = body.trim() || file || keepImage || post?.shared_post_id

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true); setError('')
    try {
      const image_url = file ? await uploadImage(file, 'post') : keepImage
      const values = { body: body.trim(), image_url: image_url || null }
      if (isAdmin && isAnnouncement) values.title = title.trim() || null
      await updatePost(post.id, values)
      toast(t('Post updated'))
      onSaved?.()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={t('Edit post')} onClose={onClose}
      footer={<button className="btn btn-primary btn-block" disabled={!canSubmit || busy} onClick={submit}>{busy ? t('Posting…') : t('Save')}</button>}>
      <ErrorText error={error} />
      {isAdmin && isAnnouncement && (
        <input className="input mb-12" placeholder={t('Announcement title')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      )}
      <textarea className="textarea" autoFocus rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000}
        placeholder={t('Write something for your community…')} />
      <div className="mt-12">
        <ImagePicker file={file} existingUrl={keepImage} onChange={(f) => { setFile(f); if (!f) setKeepImage(null) }} />
      </div>
    </Modal>
  )
}
