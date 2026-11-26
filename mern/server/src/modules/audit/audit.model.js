import mongoose from 'mongoose';

export const AUDIT_EVENTS = [
  'register', 'email_verified', 'login', 'login_failed', 'account_locked', 'logout', 'logout_all',
  'password_reset_requested', 'password_reset', 'password_changed', 'refresh_reuse_detected',
  'session_revoked', 'role_changed', 'suspended', 'unsuspended', 'location_updated', 'account_deleted', 'google_linked', 'data_exported',
  'post_created', 'post_hidden', 'post_removed', 'post_restored', 'comment_removed', 'report_handled', 'service_updated', 'alert_sent', 'alert_resolved',
];

const auditSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: AUDIT_EVENTS, required: true },
    ip: String,
    userAgent: String,
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // keep 90 days

export const AuditEvent = mongoose.model('AuditEvent', auditSchema);
