/**
 * Checks a password against the Have I Been Pwned list of passwords leaked in
 * data breaches, using its k-anonymity range API: only the first 5 characters of
 * the password's SHA-1 hash are sent, never the password or its full hash.
 * If the service is slow or down we fail open, so sign-up never depends on it.
 */
import { createHash } from 'node:crypto';
import env from '../config/env.js';
import { errors } from './AppError.js';

export const PWNED_MESSAGE = 'This password has appeared in a data breach. Please choose a different one.';

/** Returns how many times the password appears in known breaches (0 if none or unknown). */
export async function pwnedCount(password) {
  const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'Neighborly-password-check' },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return 0;
    for (const line of (await res.text()).split('\n')) {
      const [s, n] = line.trim().split(':');
      if (s === suffix) return Number(n) || 0; // padding rows have a count of 0
    }
    return 0;
  } catch {
    return 0;
  }
}

/** Throws a field error if the password is known to be breached (when the check is enabled). */
export async function assertNotPwned(password, field = 'password') {
  if (!env.pwnedCheck) return;
  if ((await pwnedCount(password)) > 0) {
    throw errors.badRequest(PWNED_MESSAGE, 'VALIDATION_ERROR', { fields: { [field]: PWNED_MESSAGE } });
  }
}
