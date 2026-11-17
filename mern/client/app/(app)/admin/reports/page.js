'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Flag, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { REPORT_REASONS } from '@/lib/categories';
import { timeAgo } from '@/lib/format';
import { Spinner, useToast } from '@/components/ui';
import { Pager, ReasonModal, StatusBadge } from '@/components/admin/bits';

const REASON = Object.fromEntries(REPORT_REASONS);
const TABS = [['open', 'Open'], ['actioned', 'Actioned'], ['dismissed', 'Dismissed'], ['all', 'All']];

export default function AdminReports() {
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [acting, setActing] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/reports', { params: { status, page, limit: 10 } }).then(({ data: d }) => setData(d)).catch((e) => toast(parseError(e).message, 'error'));
  }, [status, page, toast]);
  useEffect(() => { setData(null); load(); }, [load]);

  async function handle(report, action, note) {
    try {
      await api.patch(`/admin/reports/${report.id}`, { action, ...(note && { note }) });
      toast(action === 'remove' ? 'Content removed' : 'Report dismissed');
      load();
    } catch (e) { toast(parseError(e).message, 'error'); throw e; }
  }

  return (
    <div className="reports">
      <div className="seg" role="tablist" aria-label="Report status">
        {TABS.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={status === v} className={status === v ? 'is-active' : ''} onClick={() => { setStatus(v); setPage(1); }}>
            {l}{v === 'open' && data?.openCount > 0 && <span className="admin-badge">{data.openCount}</span>}
          </button>
        ))}
      </div>

      {!data ? <div className="page-loader" style={{ minHeight: 240 }}><Spinner size={24} /></div> : data.reports.length === 0 ? (
        <div className="card empty-state"><ShieldCheck size={30} style={{ color: 'var(--green)' }} /><h2>{status === 'open' ? 'Nothing to review' : 'No reports here'}</h2><p className="muted">{status === 'open' ? 'The queue is clear. Nice work.' : 'Reports will show up here once handled.'}</p></div>
      ) : (
        <div className="report-list">
          {data.reports.map((r) => (
            <article key={r.id} className="report card">
              <header>
                <span className="badge badge-brick"><Flag size={12} /> {REASON[r.reason] ?? r.reason}</span>
                <span className="badge">{r.targetType === 'post' ? 'Post' : 'Comment'}</span>
                <StatusBadge status={r.status} />
                <span className="tiny muted" style={{ marginLeft: 'auto' }}>{timeAgo(r.createdAt)}</span>
              </header>
              <blockquote className={r.target ? '' : 'is-gone'}>
                {r.target ? (<><p>{r.target.text || '(photo only)'}</p>
                  <footer className="tiny muted">by <strong>{r.target.author?.name ?? 'Deleted user'}</strong>{r.target.status && r.target.status !== 'active' ? ` · ${r.target.status}` : ''}</footer></>) : 'This content has been deleted.'}
              </blockquote>
              <p className="small muted">Reported by <strong className="text-ink">{r.reporter?.name ?? 'a member'}</strong>{r.details ? `: “${r.details}”` : ''}</p>
              {r.status !== 'open' && <p className="tiny muted">{r.status === 'actioned' ? 'Actioned' : 'Dismissed'} by {r.handledBy ?? 'a moderator'}{r.handledAt ? ` · ${timeAgo(r.handledAt)}` : ''}{r.note ? ` · ${r.note}` : ''}</p>}
              <footer className="report-actions">
                {r.postId && <Link href={`/post/${r.postId}`} className="btn btn-ghost btn-sm">View in context</Link>}
                {r.status === 'open' && r.target && (
                  <>
                    <button className="btn btn-sm" onClick={() => setActing({ r, action: 'dismiss' })}><XCircle size={15} /> Dismiss</button>
                    <button className="btn btn-accent btn-sm" onClick={() => setActing({ r, action: 'remove' })}><Trash2 size={15} /> Remove {r.targetType}</button>
                  </>
                )}
                {r.status === 'open' && !r.target && <button className="btn btn-sm" onClick={() => handle(r, 'dismiss').catch(() => {})}><CheckCircle2 size={15} /> Close</button>}
              </footer>
            </article>
          ))}
          <Pager page={data.page} pages={data.pages} total={data.total} noun="report" onPage={setPage} />
        </div>
      )}

      {acting && (
        <ReasonModal danger={acting.action === 'remove'}
          title={acting.action === 'remove' ? `Remove this ${acting.r.targetType}?` : 'Dismiss this report?'}
          body={acting.action === 'remove' ? 'It disappears for everyone. All open reports about it are closed together.' : 'The content stays up. All open reports about it are closed together.'}
          confirmLabel={acting.action === 'remove' ? 'Remove' : 'Dismiss'}
          onConfirm={(note) => handle(acting.r, acting.action, note)} onClose={() => setActing(null)} />
      )}
    </div>
  );
}
