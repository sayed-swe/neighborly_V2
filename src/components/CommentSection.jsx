import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SendHorizontal, Trash2 } from 'lucide-react'
import { addComment, deleteComment, getComments, setReaction } from '../lib/api'
import { timeAgo } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Avatar, Spinner } from './ui'
import { t } from '../lib/i18n'

// target: { post_id } | { listing_id } | { lost_found_id } | { event_id } | { help_request_id }
export default function CommentSection({ target, onCountChange, autoFocus, placeholder = 'Write a comment…' }) {
  const { profile, isAdmin } = useAuth()
  const toast = useToast()
  const [comments, setComments] = useState(null)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [sending, setSending] = useState(false)
  const inputRef = useRef(null)
  const key = JSON.stringify(target)

  useEffect(() => {
    let alive = true
    getComments(target).then((c) => alive && setComments(c)).catch((e) => toast(e.message, 'error'))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => { if (autoFocus) inputRef.current?.focus() }, [autoFocus])

  const tree = useMemo(() => {
    if (!comments) return []
    const top = comments.filter((c) => !c.parent_id)
    return top.map((c) => ({ ...c, replies: comments.filter((r) => r.parent_id === c.id) }))
  }, [comments])

  const submit = async (e) => {
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    setSending(true)
    try {
      const c = await addComment(target, content, replyTo?.id || null)
      setComments((list) => [...(list || []), c])
      onCountChange?.(1)
      setText(''); setReplyTo(null)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSending(false)
    }
  }

  const remove = async (c) => {
    if (!confirm(t('Delete this comment?'))) return
    try {
      await deleteComment(c.id)
      const removed = comments.filter((x) => x.id === c.id || x.parent_id === c.id).length
      setComments((list) => list.filter((x) => x.id !== c.id && x.parent_id !== c.id))
      onCountChange?.(-removed)
    } catch (err) { toast(err.message, 'error') }
  }

  const toggleLike = async (c) => {
    const liked = c.reactions?.some((r) => r.user_id === profile.id)
    setComments((list) => list.map((x) => x.id !== c.id ? x : {
      ...x, reactions: liked ? x.reactions.filter((r) => r.user_id !== profile.id) : [...(x.reactions || []), { user_id: profile.id }],
    }))
    try { await setReaction({ comment_id: c.id }, liked ? null : 'like') } catch (err) { toast(err.message, 'error') }
  }

  const startReply = (c) => {
    setReplyTo(c)
    setText(`@${c.author?.full_name?.split(' ')[0] || ''} `)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const renderComment = (c, isReply = false) => {
    const likes = c.reactions?.length || 0
    const liked = c.reactions?.some((r) => r.user_id === profile.id)
    const canDelete = c.user_id === profile.id || isAdmin
    return (
      <div key={c.id}>
        <div className="comment">
          <Link to={`/profile/${c.author?.username}`}><Avatar src={c.author?.avatar_url} name={c.author?.full_name} size={isReply ? 28 : 34} /></Link>
          <div style={{ minWidth: 0 }}>
            <div className="comment-bubble">
              <Link to={`/profile/${c.author?.username}`} className="who">{c.author?.full_name}</Link>
              <div className="text">{c.content}</div>
            </div>
            <div className="comment-tools">
              <span>{timeAgo(c.created_at)}</span>
              <button className={liked ? 'on' : ''} onClick={() => toggleLike(c)}>{t('Like')}</button>
              {!isReply && <button onClick={() => startReply(c)}>{t('Reply')}</button>}
              {isReply && <button onClick={() => startReply(tree.find((root) => root.id === c.parent_id) || c)}>{t('Reply')}</button>}
              {likes > 0 && <span>👍 {likes}</span>}
              {canDelete && <button onClick={() => remove(c)} aria-label={t('Delete comment')}><Trash2 size={12} /></button>}
            </div>
          </div>
        </div>
        {!isReply && c.replies?.length > 0 && (
          <div className="comment-replies">{c.replies.map((r) => renderComment(r, true))}</div>
        )}
      </div>
    )
  }

  return (
    <div className="comments">
      {comments === null ? <Spinner size={18} /> : tree.map((c) => renderComment(c))}
      {replyTo && (
        <div className="small muted mt-8">{t('Replying to')} <b>{replyTo.author?.full_name}</b> · <button className="link" onClick={() => { setReplyTo(null); setText('') }}>{t('Cancel')}</button></div>
      )}
      <form className="comment-form" onSubmit={submit}>
        <Avatar src={profile?.avatar_url} name={profile?.full_name} size={32} />
        <div className="comment-input">
          <input ref={inputRef} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
          <button type="submit" disabled={!text.trim() || sending} aria-label={t('Send')}><SendHorizontal size={18} /></button>
        </div>
      </form>
    </div>
  )
}
