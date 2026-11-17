'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui';

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function Pager({ page, pages, total, noun = 'item', onPage }) {
  return (
    <div className="table-foot">
      <span className="small muted">{total} {noun}{total === 1 ? '' : 's'}</span>
      <div className="pager">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
        <span className="small">Page {page} of {pages}</span>
        <button className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

/** Asks a moderator for an optional reason before a destructive action. */
export function ReasonModal({ title, confirmLabel, body, danger, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} size="sm" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <Button className={`btn ${danger ? 'btn-accent' : 'btn-primary'}`} loading={busy} onClick={async () => { setBusy(true); try { await onConfirm(reason.trim()); onClose(); } catch { setBusy(false); } }}>{confirmLabel}</Button></>}>
      {body && <p className="muted" style={{ marginBottom: 12 }}>{body}</p>}
      <label className="label" htmlFor="reason">Reason <span className="tiny muted">optional, recorded in the activity log</span></label>
      <textarea id="reason" data-autofocus className="textarea" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginTop: 6, minHeight: 80 }} />
    </Modal>
  );
}

export const StatusBadge = ({ status }) => {
  const map = { active: ['badge-green', 'Live'], hidden: ['badge-sun', 'Hidden'], removed: ['badge-danger', 'Removed'], open: ['badge-sun', 'Open'], actioned: ['badge-green', 'Actioned'], dismissed: ['', 'Dismissed'] };
  const [cls, label] = map[status] ?? ['', status];
  return <span className={`badge ${cls}`}>{label}</span>;
};
