import { useCallback, useEffect, useRef, useState } from 'react'
import { Newspaper } from 'lucide-react'
import { getFeed, PAGE_SIZE } from '../lib/api'
import { useToast } from '../context/ToastContext'
import PostCard from './PostCard'
import { Empty, Spinner } from './ui'
import { t } from '../lib/i18n'

// Paged, auto-loading list of posts. Change `filters` or `reloadKey` to refresh.
export default function FeedList({ filters = {}, reloadKey = 0, emptyText }) {
  const toast = useToast()
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(0)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const sentinel = useRef(null)
  const filterKey = JSON.stringify(filters)

  const load = useCallback(async (p, replace) => {
    setLoading(true)
    try {
      const rows = await getFeed({ ...filters, page: p })
      setPosts((prev) => (replace ? rows : [...prev, ...rows.filter((r) => !prev.some((x) => x.id === r.id))]))
      setDone(rows.length < PAGE_SIZE)
      setPage(p)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey])

  useEffect(() => { load(0, true) }, [load, reloadKey])

  useEffect(() => {
    if (done || loading || !sentinel.current) return
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && load(page + 1), { rootMargin: '600px' })
    io.observe(sentinel.current)
    return () => io.disconnect()
  }, [done, loading, page, load])

  if (loading && posts.length === 0) return <Spinner />
  if (!loading && posts.length === 0) {
    return <div className="card"><Empty icon={Newspaper} title={t('Nothing here yet')} text={emptyText || t('Be the first to post something for your neighbors.')} /></div>
  }

  return (
    <>
      {posts.map((p) => (
        <PostCard key={`${p.id}-${p.updated_at}`} post={p}
          onDeleted={(id) => setPosts((list) => list.filter((x) => x.id !== id && x.shared_post_id !== id))}
          onChanged={() => load(0, true)} />
      ))}
      <div ref={sentinel} />
      {loading && <Spinner />}
      {done && posts.length > 3 && <p className="muted small" style={{ textAlign: 'center', padding: 12 }}>{t('You\'re all caught up ✨')}</p>}
    </>
  )
}
