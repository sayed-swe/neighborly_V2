'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Copy, Flag, Link2, MessageCircle, MoreHorizontal, Pencil, Repeat2, Share2, Trash2 } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { applyReaction, topReactions } from '@/lib/reactions';
import { CATEGORIES, formatPrice } from '@/lib/categories';
import { timeAgo } from '@/lib/format';
import { Avatar, Button, useToast } from '@/components/ui';
import Modal from '@/components/Modal';
import ImageGrid from './ImageGrid';
import ReactionButton from './ReactionButton';
import Comments from './Comments';
import ReportModal from './ReportModal';

const ROLE_TAG = { provider: 'Service provider', moderator: 'Moderator', admin: 'Admin' };

function Byline({ post, link = true }) {
  const cat = CATEGORIES[post.category];
  const a = post.author;
  const dist = post.distanceKm == null ? null : post.distanceKm < 0.1 ? 'Nearby' : `${post.distanceKm} km away`;
  return (
    <div className="post-head-main">
      <div className="post-name">
        <strong>{a.name}</strong>
        {a.role !== 'resident' && <span className="role-tag" title={ROLE_TAG[a.role]}><BadgeCheck size={14} /> {a.business ?? ROLE_TAG[a.role]}</span>}
      </div>
      <div className="post-meta tiny muted">
        {link ? <Link href={`/post/${post.id}`} title={new Date(post.createdAt).toLocaleString()}>{timeAgo(post.createdAt)}</Link> : <span>{timeAgo(post.createdAt)}</span>}
        {post.editedAt && <span> · Edited</span>}
        {post.areaName && <span> · {post.areaName}</span>}
        {dist && <span> · {dist}</span>}
        {cat && post.category !== 'general' && <span className={`badge ${cat.badge}`}>{cat.short}</span>}
      </div>
    </div>
  );
}

function PostBody({ post, expandable = true }) {
  const [open, setOpen] = useState(false);
  const long = expandable && (post.text.length > 320 || post.text.split('\n').length > 6);
  return (
    <>
      {post.text && <p className={`post-text ${long && !open ? 'is-clamped' : ''}`}>{post.text}</p>}
      {long && <button className="link small" onClick={() => setOpen(!open)}>{open ? 'See less' : 'See more'}</button>}
      {post.category === 'sale' && post.price != null && <div className="post-price">{formatPrice(post.price)}</div>}
      <ImageGrid images={post.images} />
    </>
  );
}

function SharedEmbed({ shared }) {
  if (shared.unavailable) return <div className="embed embed-gone">This content isn’t available any more. It may have been removed.</div>;
  return (
    <div className="embed">
      <div className="post-head">
        <Avatar user={shared.author} size={36} />
        <Byline post={shared} link={false} />
      </div>
      <PostBody post={shared} />
      <Link href={`/post/${shared.id}`} className="link tiny">View original post</Link>
    </div>
  );
}

function ShareMenu({ post, onShared }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const root = post.shared && !post.shared.unavailable ? post.shared : post;

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  async function share(withText) {
    setBusy(true);
    try {
      const { data } = await api.post(`/posts/${post.id}/share`, { text: withText });
      onShared(data);
      toast('Shared to your feed');
      setWriting(false); setOpen(false); setText('');
    } catch (err) { toast(parseError(err).message, 'error'); }
    setBusy(false);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`); toast('Link copied'); }
    catch { toast('Couldn’t copy the link', 'error'); }
    setOpen(false);
  }

  return (
    <div className="share" ref={ref}>
      <button type="button" className="act" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><Share2 size={19} /> Share</button>
      {open && (
        <div className="menu card" role="menu">
          <button role="menuitem" disabled={busy} onClick={() => share('')}><Repeat2 size={18} /><span><strong>Share now</strong><small>Post it to your feed</small></span></button>
          <button role="menuitem" onClick={() => { setOpen(false); setWriting(true); }}><Pencil size={18} /><span><strong>Share with a message…</strong><small>Add your own words</small></span></button>
          <button role="menuitem" onClick={copy}><Link2 size={18} /><span><strong>Copy link</strong><small>Send it anywhere</small></span></button>
        </div>
      )}
      {writing && (
        <Modal title="Share to your feed" size="sm" onClose={() => setWriting(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setWriting(false)}>Cancel</button><Button loading={busy} onClick={() => share(text.trim())}>Share</Button></>}>
          <textarea data-autofocus className="textarea" placeholder="Say something about this…" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} aria-label="Your message" />
          <div className="embed" style={{ marginTop: 12 }}>
            <div className="post-head"><Avatar user={root.author} size={32} /><Byline post={root} link={false} /></div>
            <p className="post-text is-clamped">{root.text}</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function PostCard({ initial, onDeleted, onShared, startOpen = false, expandText = true }) {
  const { user } = useAuth();
  const toast = useToast();
  const [post, setPost] = useState(initial);
  const [showComments, setShowComments] = useState(startOpen);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [reporting, setReporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenu(false); };
    const esc = (e) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [menu]);

  async function react(type) {
    const before = post;
    setPost(applyReaction(post, type));
    try {
      const { data } = type ? await api.put(`/posts/${post.id}/reaction`, { type }) : await api.delete(`/posts/${post.id}/reaction`);
      setPost((p) => ({ ...p, ...data }));
    } catch (err) { setPost(before); toast(parseError(err).message, 'error'); }
  }

  async function saveEdit() {
    setBusy(true);
    try {
      const { data } = await api.patch(`/posts/${post.id}`, { text: draft.trim() });
      setPost(data.post); setEditing(false); toast('Post updated');
    } catch (err) { const e = parseError(err); toast(e.fields?.text ?? e.message, 'error'); }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    try { await api.delete(`/posts/${post.id}`); toast('Post deleted'); onDeleted?.(post.id); }
    catch (err) { toast(parseError(err).message, 'error'); setBusy(false); setDeleting(false); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`); toast('Link copied'); } catch { toast('Couldn’t copy the link', 'error'); }
    setMenu(false);
  }

  const tops = topReactions(post.reactions);
  const mine = post.author.id === user.id;
  const hidden = post.status !== 'active';

  return (
    <article className={`post card ${hidden ? 'is-hidden' : ''}`} aria-label={`Post by ${post.author.name}`}>
      {hidden && <div className="post-hidden-note">This post is {post.status} by a moderator and is only visible to you and moderators.</div>}
      <header className="post-head">
        <Avatar user={post.author} size={42} />
        <Byline post={post} />
        <div className="post-menu" ref={menuRef}>
          <button className="icon-btn" aria-label="Post options" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><MoreHorizontal size={20} /></button>
          {menu && (
            <div className="menu card" role="menu">
              <button role="menuitem" onClick={copyLink}><Copy size={17} /> Copy link</button>
              {post.canEdit && <button role="menuitem" onClick={() => { setDraft(post.text); setEditing(true); setMenu(false); }}><Pencil size={17} /> Edit post</button>}
              {post.canDelete && <button role="menuitem" className="danger" onClick={() => { setDeleting(true); setMenu(false); }}><Trash2 size={17} /> Delete post</button>}
              {!mine && <button role="menuitem" onClick={() => { setReporting(true); setMenu(false); }}><Flag size={17} /> Report post</button>}
            </div>
          )}
        </div>
      </header>

      {editing ? (
        <div className="post-edit">
          <textarea className="textarea" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} aria-label="Edit your post" autoFocus />
          <div className="post-edit-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            <Button className="btn btn-primary btn-sm" loading={busy} disabled={!draft.trim() && post.images.length === 0} onClick={saveEdit}>Save</Button>
          </div>
        </div>
      ) : <PostBody post={post} expandable={expandText} />}

      {post.shared && <SharedEmbed shared={post.shared} />}

      {(post.reactionTotal > 0 || post.commentCount > 0 || post.shareCount > 0) && (
        <div className="post-stats tiny">
          <span className="post-stats-react">
            {post.reactionTotal > 0 && <><span className="emoji-stack" aria-hidden="true">{tops.map((r) => <span key={r.type}>{r.emoji}</span>)}</span>{post.reactionTotal}</>}
          </span>
          <span className="post-stats-right">
            {post.commentCount > 0 && <button className="link-plain" onClick={() => setShowComments(true)}>{post.commentCount} comment{post.commentCount === 1 ? '' : 's'}</button>}
            {post.shareCount > 0 && <span>{post.shareCount} share{post.shareCount === 1 ? '' : 's'}</span>}
          </span>
        </div>
      )}

      {!hidden && (
        <div className="post-actions">
          <ReactionButton value={post.myReaction} onChange={react} />
          <button type="button" className="act" onClick={() => setShowComments((v) => !v)} aria-expanded={showComments}><MessageCircle size={19} /> Comment</button>
          <ShareMenu post={post} onShared={(data) => { setPost((p) => ({ ...p, shareCount: data.shareCount })); onShared?.(data.post); }} />
        </div>
      )}

      {showComments && !hidden && (
        <Comments postId={post.id} total={post.commentCount} autoFocus={!startOpen}
          onDelta={(n) => setPost((p) => ({ ...p, commentCount: Math.max(0, p.commentCount + n) }))} />
      )}

      {reporting && <ReportModal kind="post" id={post.id} onClose={() => setReporting(false)} />}
      {deleting && (
        <Modal title="Delete this post?" size="sm" onClose={() => setDeleting(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setDeleting(false)}>Cancel</button><Button className="btn btn-accent" loading={busy} onClick={remove}>Delete</Button></>}>
          <p className="muted">This removes the post, its comments and reactions. It can’t be undone.</p>
        </Modal>
      )}
    </article>
  );
}
