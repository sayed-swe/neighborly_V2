'use client';
/** Maps server-side field errors onto react-hook-form fields. Returns true if any were applied. */
export function applyFieldErrors(fields, setError, known) {
  let applied = false;
  for (const [key, message] of Object.entries(fields ?? {})) {
    if (!known || known.includes(key)) { setError(key, { type: 'server', message }); applied = true; }
  }
  return applied;
}
