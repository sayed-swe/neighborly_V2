import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Flag, Globe, Link2, MapPin, Megaphone, MessageSquare, MoreHorizontal, Pencil, Share2, ThumbsUp, Trash2,
} from 'lucide-react'
import { deletePost, getReactors, setReaction } from '../lib/api'
import { REACTIONS, reactionOf } from '../lib/constants'
import { compactNumber, formatDateTime, timeAgo } from '../lib/format'
import { appUrl } from '../lib/url'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Avatar, Dropdown, Modal, Spinner } from './ui'
import CommentSection from './CommentSection'
import ShareModal from './ShareModal'
import ReportModal from './ReportModal'
import { PostModal } from './Composer'
import { t } from '../lib/i18n'

export default function PostCard({ post: initial, onDeleted, onChanged, defaultComments = false }) {
  const { profile, isAdmin } = useAuth()
  const toast = useToast()
  const [post, setPost] = useState(initial)
  const [showComments, setShowComments] = useState(defaultComments)
  const [focusComment, setFocusComment] = useState(false)
  const [picker, setPicker] = useState(false)
  const [modal, setModal] = useState(null) // 'share' | 'report' | 'edit' | 'reactors'
  const hoverTimer = useRef(null)

  const mine = post.user_id === profile.id
  const my = post.my_reaction

  const react = async (type) => {
    setPicker(false)
    const next = my === type ? null : type
    const prev = post
    const top = new Set(post.top_reactions || [])
    if (next) top.add(next)
    setPost({
      ...post,
      my_reaction: next,
      reaction_count: post.reaction_count + (my ? 0 : 1) - (next ? 0 : 1),
      top_reactions: [...top].slice(0, 3),
    })
    try { await setReaction({ post_id: post.id }, next) } catch (e) { setPost(prev); toast(e.message, 'error') }
  }

  const onEnter = () => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setPicker(true), 450) }
  const onLeave = () => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setPicker(false), 300) }

  const remove = async () => {
    if (!confirm(t('Delete this post? This cannot be undone.'))) return
    try { await deletePost(post.id); toast(t('Post deleted')); onDeleted?.(post.id) } catch (e) { toast(e.message, 'error') }
  }

  const copyLink = async () => {
    const url = appUrl(`/post/${post.id}`)
    try { await navigator.clipboard.writeText(url); toast(t('Link copied')) } catch { toast(url) }
  }

  const openComments = () => { setShowComments(true); setFocusComment(true) }
  const current = my ? reactionOf(my) : null

  return (
    <article className="card post">
      <PostHeader post={post} menu={
        <Dropdown trigger={<button className="icon-btn ghost" aria-label={t('Post options')}><MoreHorizontal size={20} /></button>}>
          <button onClick={copyLink}><Link2 size={18} /> {t('Copy link')}</button>
          {mine && <button onClick={() => setModal('edit')}><Pencil size={18} /> {t('Edit post')}</button>}
          {(mine || isAdmin) && <button className="danger" onClick={remove}><Trash2 size={18} /> {t('Delete post')}</button>}
          {!mine && <button onClick={() => setModal('report')}><Flag size={18} /> {t('Report post')}</button>}
        </Dropdown>
      } />

      <PostContent post={post} />

      {post.shared_post_id && (
        post.shared_post ? (
          <div className="shared-box">
            <PostHeader post={{
              user_id: post.shared_post.user_id, author_name: post.shared_post.author_name,
              author_avatar: post.shared_post.author_avatar, created_at: post.shared_post.created_at, id: post.shared_post.id,
              author_username: post.shared_post.author_username,
            }} compact />
            <PostContent post={post.shared_post} inShare />
          </div>
        ) : (
          <div className="shared-box"><div className="post-body muted" style={{ paddingTop: 12 }}>{t('This content isn\'t available right now.')}</div></div>
        )
      )}

      {(post.reaction_count > 0 || post.comment_count > 0 || post.share_count > 0) && (
        <div className="post-stats">
          <button className="reaction-stack" onClick={() => post.reaction_count > 0 && setModal('reactors')}>
            {post.reaction_count > 0 && (
              <>
                <span className="emojis">{(post.top_reactions || []).map((rt) => <span key={rt}>{reactionOf(rt).emoji}</span>)}</span>
                {compactNumber(post.reaction_count)}
              </>
            )}
          </button>
          <div className="flex gap-12">
            {post.comment_count > 0 && <button onClick={() => setShowComments((s) => !s)}>{post.comment_count} {t('comment')}{post.comment_count > 1 ? 's' : ''}</button>}
            {post.share_count > 0 && <span>{post.share_count} {t('share')}{post.share_count > 1 ? 's' : ''}</span>}
          </div>
        </div>
      )}

      <div className="post-actions">
        <div style={{ flex: 1, position: 'relative' }} onMouseEnter={onEnter} onMouseLeave={onLeave}>
          {picker && (
            <div className="reaction-picker" onMouseEnter={() => clearTimeout(hoverTimer.current)}>
              {REACTIONS.map((r) => (
                <button key={r.type} title={t(r.label)} onClick={() => react(r.type)}>{r.emoji}</button>
              ))}
            </div>
          )}
          <button className={`post-action ${current ? `reacted r-${current.type}` : ''}`} style={{ width: '100%' }} onClick={() => react(my || 'like')}>
            {current ? <span style={{ fontSize: 18 }}>{current.emoji}</span> : <ThumbsUp size={19} />}
            {current ? t(current.label) : t('Like')}
          </button>
        </div>
        <button className="post-action" onClick={openComments}><MessageSquare size={19} /> {t('Comment')}</button>
        <button className="post-action" onClick={() => setModal('share')}><Share2 size={19} /> {t('Share')}</button>
      </div>

      {showComments && (
        <CommentSection target={{ post_id: post.id }} autoFocus={focusComment}
          onCountChange={(d) => setPost((p) => ({ ...p, comment_count: Math.max(0, p.comment_count + d) }))} />
      )}

      {modal === 'share' && <ShareModal post={post} onClose={() => setModal(null)} onShared={() => setPost((p) => ({ ...p, share_count: p.share_count + (p.shared_post_id ? 0 : 1) }))} />}
      {modal === 'report' && <ReportModal targetType="post" targetId={post.id} onClose={() => setModal(null)} />}
      {modal === 'edit' && <PostModal post={post} onClose={() => setModal(null)} onSaved={() => onChanged?.()} />}
      {modal === 'reactors' && <ReactorsModal postId={post.id} onClose={() => setModal(null)} />}
    </article>
  )
}

function PostHeader({ post, menu, compact }) {
  const profileLink = post.author_username ? `/profile/${post.author_username}` : null
  return (
    <div className="post-head" style={compact ? { padding: '12px 14px 6px' } : undefined}>
      <Avatar src={post.author_avatar} name={post.author_name} size={compact ? 36 : 42} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-6 wrap">
          {profileLink
            ? <Link to={profileLink} className="post-author">{post.author_name}</Link>
            : <span className="post-author">{post.author_name}</span>}
          {post.author_role === 'admin' && <span className="pill green">{t('Admin')}</span>}
          {post.author_role === 'service_provider' && <span className="pill blue">{t('Pro')}</span>}
          {post.shared_post_id && !compact && <span className="small muted">{t('shared a post')}</span>}
        </div>
        <div className="post-meta">
          <Link to={`/post/${post.id}`} title={formatDateTime(post.created_at)}>{timeAgo(post.created_at)}</Link>
          {post.neighborhood_name ? <>· <span>🏘️ {post.neighborhood_name}</span></> : !compact && <>· <Globe size={12} /></>}
          {post.category_name && <>· <span>{post.category_name}</span></>}
        </div>
      </div>
      {menu}
    </div>
  )
}

function PostContent({ post, inShare }) {
  return (
    <>
      {post.post_type === 'announcement' && !inShare && (
        <div style={{ padding: '0 16px 8px' }}><span className="pill amber"><Megaphone size={12} /> {t('Official announcement')}</span></div>
      )}
      {(post.title || post.body) && (
        <div className="post-body">
          {post.title && <h3>{post.title}</h3>}
          {post.body}
        </div>
      )}
      {post.location_name && (
        <Link to={post.latitude ? `/map?lat=${post.latitude}&lng=${post.longitude}` : '/map'} className="post-location"><MapPin size={13} /> {post.location_name}</Link>
      )}
      {!post.location_name && post.latitude && (
        <Link to={`/map?lat=${post.latitude}&lng=${post.longitude}`} className="post-location"><MapPin size={13} /> {t('View on map')}</Link>
      )}
      {post.image_url && <img className="post-image" src={post.image_url} alt="" loading="lazy" />}
    </>
  )
}

function ReactorsModal({ postId, onClose }) {
  const [list, setList] = useState(null)
  const [filter, setFilter] = useState('all')
  useEffect(() => { getReactors(postId).then(setList).catch(() => setList([])) }, [postId])
  const types = list ? [...new Set(list.map((r) => r.reaction_type))] : []
  const shown = list?.filter((r) => filter === 'all' || r.reaction_type === filter) || []
  return (
    <Modal title={t('Reactions')} onClose={onClose}>
      {!list ? <Spinner /> : (
        <>
          <div className="tabs">
            <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>{t('All')} {list.length}</button>
            {types.map((ty) => (
              <button key={ty} className={`tab ${filter === ty ? 'active' : ''}`} onClick={() => setFilter(ty)}>
                {reactionOf(ty).emoji} {list.filter((r) => r.reaction_type === ty).length}
              </button>
            ))}
          </div>
          <div className="mini-list">
            {shown.map((r) => (
              <Link key={r.user?.id} to={`/profile/${r.user?.username}`} className="mini-item" onClick={onClose}>
                <div style={{ position: 'relative' }}>
                  <Avatar src={r.user?.avatar_url} name={r.user?.full_name} size={40} />
                  <span style={{ position: 'absolute', right: -4, bottom: -4, fontSize: 14 }}>{reactionOf(r.reaction_type).emoji}</span>
                </div>
                <div className="t">{r.user?.full_name}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
