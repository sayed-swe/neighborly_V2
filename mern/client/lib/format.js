export function timeAgo(date) {
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  const units = [[60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']];
  let v = s / 60;
  for (const [step, unit] of units) {
    if (v < step) { const n = Math.floor(v); return `${n} ${unit}${n === 1 ? '' : 's'} ago`; }
    v /= step;
  }
  return '';
}

export function describeDevice(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  return `${browser} on ${os}`;
}

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

export function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export const AUDIT_LABELS = {
  register: 'Account created', email_verified: 'Email confirmed', login: 'Signed in', login_failed: 'Failed sign-in attempt',
  account_locked: 'Account temporarily locked', logout: 'Signed out', logout_all: 'Signed out everywhere',
  password_reset_requested: 'Password reset requested', password_reset: 'Password reset', password_changed: 'Password changed',
  refresh_reuse_detected: 'Suspicious session reuse blocked', session_revoked: 'Device signed out', role_changed: 'Role changed',
  suspended: 'Account suspended', unsuspended: 'Account restored', location_updated: 'Home area updated', google_linked: 'Google account linked', data_exported: 'Data downloaded',
  post_created: 'Post created', post_hidden: 'Post hidden', post_removed: 'Post removed', post_restored: 'Post restored', comment_removed: 'Comment removed', report_handled: 'Report handled',
};
