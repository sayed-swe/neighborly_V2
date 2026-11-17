'use client';
import { useState } from 'react';
import Modal from '@/components/Modal';
import { Alert, Button, useToast } from '@/components/ui';
import { api, parseError } from '@/lib/api';
import { REPORT_REASONS } from '@/lib/categories';

export default function ReportModal({ kind = 'post', id, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!reason) { setError('Choose a reason.'); return; }
    setBusy(true); setError('');
    try {
      const { data } = await api.post(`/${kind === 'post' ? 'posts' : 'comments'}/${id}/report`, { reason, ...(details.trim() && { details: details.trim() }) });
      toast(data.message);
      onClose();
    } catch (err) { setError(parseError(err).message); setBusy(false); }
  }

  return (
    <Modal title={`Report this ${kind}`} onClose={onClose} size="sm"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><Button className="btn btn-primary" loading={busy} onClick={submit}>Send report</Button></>}>
      <p className="small muted" style={{ marginBottom: 12 }}>Your report is private. A moderator will review it, usually within a day.</p>
      {error && <Alert kind="error">{error}</Alert>}
      <fieldset className="report-reasons">
        <legend className="sr-only">Reason</legend>
        {REPORT_REASONS.map(([v, l]) => (
          <label key={v} className="check report-reason"><input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} /><span>{l}</span></label>
        ))}
      </fieldset>
      <label className="label" htmlFor="rep-details" style={{ marginTop: 14 }}>Anything else we should know? <span className="tiny muted">optional</span></label>
      <textarea id="rep-details" className="textarea" maxLength={300} value={details} onChange={(e) => setDetails(e.target.value)} style={{ marginTop: 6, minHeight: 72 }} />
    </Modal>
  );
}
