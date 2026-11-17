'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BadgeCheck, CalendarDays, MapPin, Pencil, UserX } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/permissions';
import { label } from '@/lib/categories';
import { SERVICE_CATEGORIES } from '@/lib/schemas';
import { usePaged } from '@/lib/usePaged';
import { Alert, Avatar, Spinner } from '@/components/ui';
import PostCard from '@/components/feed/PostCard';
import { MessageButton } from '@/components/feed/ItemDetails';
import { ServiceCard } from '@/components/services';

function Posts({ id }) {
  const { items, setItems, next, loadMore, loadingMore } = usePaged('/posts', { author: id, limit: 10 });
  if (!items) return <Spinner />;
  if (!items.length) return <div className="card empty-state"><p className="muted">No posts yet.</p></div>;
  return (
    <div className="post-col">
      {items.map((p) => <PostCard key={p.id} initial={p} onDeleted={(pid) => setItems((c) => c.filter((x) => x.id !== pid))} onShared={() => {}} />)}
      {next && <div className="fb-more"><button className="btn btn-sm" onClick={loadMore} disabled={loadingMore}>Load more</button></div>}
    </div>
  );
}

function Services({ isMe }) {
  const [list, setList] = useState(null);
  const { id } = useParams();
  useEffect(() => {
    // The directory lists services near the viewer; a profile shows this provider's services
    api.get('/services', { params: isMe ? { mine: '1' } : {} }).then(({ data }) => setList(isMe ? data.services : data.services.filter((s) => String(s.provider?.id) === String(id)))).catch(() => setList([]));
  }, [id, isMe]);
  if (!list) return <Spinner />;
  if (!list.length) return <div className="card empty-state"><p className="muted">No services listed nearby.</p></div>;
  return <div className="svc-grid">{list.map((s) => <ServiceCard key={s.id} s={s} />)}</div>;
}

export default function Profile() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('posts');
  useEffect(() => { setP(null); api.get(`/users/${id}/profile`).then(({ data }) => setP(data.profile)).catch((e) => setError(parseError(e).message)); }, [id]);

  if (error) return <div className="fpage"><Alert kind="error">{error}</Alert></div>;
  if (!p) return <div className="page-loader"><Spinner size={26} /></div>;
  const tabs = [['posts', `Posts · ${p.stats.posts}`], ...(p.role === 'provider' ? [['services', `Services · ${p.stats.services}`]] : []), ['about', 'About']];

  return (
    <div className="fpage profile">
      <section className="card profile-card">
        <div className="profile-cover" aria-hidden="true" />
        <div className="profile-main">
          <Avatar user={p} size={112} />
          <div className="profile-id">
            <h1>{p.name} {p.role !== 'resident' && <span className="badge badge-green"><BadgeCheck size={13} /> {p.provider?.businessName ?? ROLE_LABELS[p.role]}</span>}</h1>
            <p className="muted small">
              {p.areaName && <><MapPin size={13} style={{ verticalAlign: '-2px' }} /> {p.areaName} · </>}
              <CalendarDays size={13} style={{ verticalAlign: '-2px' }} /> Joined {new Date(p.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </p>
            {p.bio && <p className="profile-bio">{p.bio}</p>}
          </div>
          <div className="profile-actions">
            {p.isMe ? <Link href="/settings?tab=profile" className="btn btn-sm"><Pencil size={15} /> Edit profile</Link> : !p.suspended && <MessageButton userId={p.id} />}
          </div>
        </div>
        {p.suspended && <div style={{ padding: '0 20px 16px' }}><Alert kind="warn"><UserX size={14} /> This account is suspended.</Alert></div>}
        <nav className="admin-tabs profile-tabs" aria-label="Profile sections">
          {tabs.map(([k, l]) => <button key={k} className={`tab-btn ${tab === k ? 'is-active' : ''}`} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>{l}</button>)}
        </nav>
      </section>
      {tab === 'posts' && <Posts id={p.id} />}
      {tab === 'services' && <Services isMe={p.isMe} />}
      {tab === 'about' && (
        <section className="card card-pad">
          <dl className="about">
            <dt>Role</dt><dd>{ROLE_LABELS[p.role]}</dd>
            {p.areaName && <><dt>Area</dt><dd>{p.areaName} (approximate)</dd></>}
            {p.provider && <><dt>Business</dt><dd>{p.provider.businessName} · {label(SERVICE_CATEGORIES, p.provider.category)}</dd>{p.provider.description && <><dt>Offers</dt><dd>{p.provider.description}</dd></>}</>}
            <dt>Bio</dt><dd>{p.bio || <span className="muted">No bio yet.</span>}</dd>
          </dl>
        </section>
      )}
    </div>
  );
}
