// The app may be hosted at the domain root (Vercel, Netlify) or under a
// sub-path such as /neighborly/ (GitHub Pages). Vite exposes that as BASE_URL.
export const BASE = import.meta.env.BASE_URL || '/'

// Absolute URL for an in-app path, e.g. appUrl('/post/12')
export function appUrl(path = '/') {
  return window.location.origin + BASE.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`)
}
