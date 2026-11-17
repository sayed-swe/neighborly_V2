import { z } from 'zod';

// Same rules as the server, so users get instant feedback. The server re-validates everything.
export const email = z.string().trim().toLowerCase().min(1, 'Enter your email').email('Enter a valid email address');
export const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use at most 128 characters')
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number');
export const name = z
  .string()
  .trim()
  .min(2, 'Name is too short')
  .max(60, 'Name is too long')
  .regex(/^[\p{L}\p{M}' .-]+$/u, 'Use letters, spaces, apostrophes or hyphens only');

export const SERVICE_CATEGORIES = [
  ['electrician', 'Electrician'], ['plumber', 'Plumber'], ['cleaning', 'Cleaning'], ['tutoring', 'Tutoring'],
  ['carpentry', 'Carpentry'], ['painting', 'Painting'], ['appliance-repair', 'Appliance repair'], ['beauty', 'Beauty & grooming'],
  ['catering', 'Catering'], ['moving', 'Moving & delivery'], ['it-support', 'IT support'], ['other', 'Other'],
];

/** Only allow same-site relative redirects (prevents open-redirect via ?next=). */
export function safeNext(next, fallback = '/home') {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}

/** 0–4 strength score with a hint, no heavy dependency. */
export function passwordStrength(pw = '') {
  if (!pw) return { score: 0, label: '', hint: '' };
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) score++;
  if (/^(.)\1+$/.test(pw) || /^(password|qwerty|123456|abc123)/i.test(pw)) score = 0;
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const hint = pw.length < 10 ? `${10 - pw.length} more character${pw.length === 9 ? '' : 's'}` : score < 3 ? 'Mix upper/lower case, numbers and symbols' : 'Nice';
  return { score: Math.min(score, 4), label: labels[Math.min(score, 4)], hint };
}
