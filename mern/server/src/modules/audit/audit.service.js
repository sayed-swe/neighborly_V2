import { AuditEvent } from './audit.model.js';

/** Fire-and-forget security audit log. Never blocks or breaks the request. */
export function audit(req, type, { user, actor, meta } = {}) {
  AuditEvent.create({
    type,
    user,
    actor,
    meta,
    ip: req?.ip,
    userAgent: req?.get?.('user-agent')?.slice(0, 300),
  }).catch((err) => console.error('audit log failed', err.message));
}
