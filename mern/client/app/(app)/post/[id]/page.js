'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, SearchX } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import PostCard from '@/components/feed/PostCard';
import { Spinner } from '@/components/ui';

export default function PostPage() {
  const { id } = useParams();
  const router = useRouter();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    api.get(`/posts/${id}`)
      .then(({ data }) => alive && setState({ status: 'ok', post: data.post }))
      .catch((err) => alive && setState({ status: 'error', message: parseError(err).message, notFound: err.response?.status === 404 || err.response?.status === 400 }));
    return () => { alive = false; };
  }, [id]);

  return (
    <div className="post-page">
      <Link href="/feed" className="btn btn-ghost btn-sm" style={{ marginLeft: -10 }}><ArrowLeft size={16} /> Back to feed</Link>
      {state.status === 'loading' && <div className="page-loader" style={{ minHeight: 240 }}><Spinner size={26} /></div>}
      {state.status === 'error' && (
        <div className="empty-state card card-pad">
          <SearchX size={30} />
          <h1>{state.notFound ? 'This post isn’t available' : 'Couldn’t load this post'}</h1>
          <p className="muted">{state.notFound ? 'It may have been deleted or hidden by a moderator.' : state.message}</p>
          <Link href="/feed" className="btn btn-primary">Go to your feed</Link>
        </div>
      )}
      {state.status === 'ok' && <PostCard initial={state.post} startOpen expandText={false} onDeleted={() => router.replace('/feed')} onShared={() => {}} />}
    </div>
  );
}
