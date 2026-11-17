'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, Flag, MessageSquare, Newspaper, Repeat2, ThumbsUp, UserPlus, Users } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { can, ROLE_LABELS } from '@/lib/permissions';
import { CATEGORIES } from '@/lib/categories';
import { AUDIT_LABELS, timeAgo } from '@/lib/format';
import { Alert, Spinner } from '@/components/ui';
import { BarList, ColumnChart } from '@/components/admin/charts';

function Kpi({ icon: Icon, label, value, sub, href, tone }) {
  const body = (
    <>
      <span className={`kpi-ico ${tone ?? ''}`}><Icon size={18} /></span>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value.toLocaleString()}</strong>
      {sub && <span className="tiny muted">{sub}</span>}
    </>
  );
  return href ? <Link href={href} className="kpi card kpi-link">{body}</Link> : <div className="kpi card">{body}</div>;
}

export default function Overview() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = can(user, 'admin:dashboard');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { if (!isAdmin) router.replace('/admin/reports'); }, [isAdmin, router]);
  useEffect(() => {
    if (!isAdmin) return;
    api.get('/admin/overview').then(({ data: d }) => setData(d)).catch((e) => setError(parseError(e).message));
  }, [isAdmin]);

  if (!isAdmin) return null;
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <div className="page-loader" style={{ minHeight: 300 }}><Spinner size={26} /></div>;
  const t = data.totals;

  return (
    <div className="admin-overview">
      <div className="kpi-grid">
        <Kpi icon={Users} label="Members" value={t.users} sub={`${t.verified} confirmed`} href="/admin/users" />
        <Kpi icon={UserPlus} label="New this week" value={t.newUsers} sub={t.suspended ? `${t.suspended} suspended` : 'none suspended'} />
        <Kpi icon={Newspaper} label="Posts" value={t.posts} sub={`${t.hiddenPosts} hidden or removed`} href="/admin/posts" />
        <Kpi icon={MessageSquare} label="Comments" value={t.comments} href="/admin/comments" />
        <Kpi icon={ThumbsUp} label="Reactions" value={t.reactions} sub={`${t.shares} shares`} />
        <Kpi icon={Flag} label="Open reports" value={t.openReports} sub={t.openReports ? 'Needs review' : 'All clear'} href="/admin/reports" tone={t.openReports ? 'is-alert' : ''} />
      </div>

      <div className="chart-grid">
        <ColumnChart title="New members" noun="members" data={data.series.signups} />
        <ColumnChart title="Posts" noun="posts" data={data.series.posts} />
        <ColumnChart title="Comments" noun="comments" data={data.series.comments} />
      </div>

      <div className="admin-cols">
        <BarList title="Active posts by type" items={data.byCategory.map((c) => ({ label: CATEGORIES[c.category]?.label ?? c.category, value: c.count }))} />
        <BarList title="Members by role" items={Object.entries(data.byRole).sort((a, b) => b[1] - a[1]).map(([r, n]) => ({ label: ROLE_LABELS[r] ?? r, value: n }))} />
        <BarList title="Busiest areas" items={data.topAreas.map((a) => ({ label: a.area, value: a.count }))} emptyText="No members have set an area yet" />
      </div>

      <section className="card card-pad">
        <div className="card-head"><h3 className="card-title">Recent activity</h3><Link href="/admin/activity" className="link small">Full log</Link></div>
        <ul className="activity">
          {data.recent.map((e) => (
            <li key={e.id}><span>{AUDIT_LABELS[e.type] ?? e.type.replaceAll('_', ' ')}{e.user ? ` · ${e.user}` : ''}{e.actor ? ` (by ${e.actor})` : ''}</span><span className="tiny muted">{timeAgo(e.createdAt)}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
