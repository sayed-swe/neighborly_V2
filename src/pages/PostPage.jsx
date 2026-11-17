import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileX } from 'lucide-react'
import { getPost } from '../lib/api'
import PostCard from '../components/PostCard'
import { Empty, Spinner } from '../components/ui'
import { t } from '../lib/i18n'

export default function PostPage() {
  const { id } = useParams()
  const [post, setPost] = useState(undefined)
  useEffect(() => { setPost(undefined); getPost(Number(id)).then(setPost).catch(() => setPost(null)) }, [id])

  return (
    <div className="page page-narrow">
      <Link to="/" className="btn btn-ghost btn-sm mb-12"><ArrowLeft size={16} /> {t('Back to feed')}</Link>
      {post === undefined ? <Spinner /> : post === null ? (
        <div className="card"><Empty icon={FileX} title={t('This post isn\'t available')} text={t('It may have been removed or hidden by a moderator.')} /></div>
      ) : (
        <PostCard post={post} defaultComments onDeleted={() => window.history.back()} onChanged={() => getPost(Number(id)).then(setPost)} key={post.updated_at} />
      )}
    </div>
  )
}
