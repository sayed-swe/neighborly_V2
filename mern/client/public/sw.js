/*
 * Neighborly service worker: lets the installed app open without a connection.
 * - Pages: network first; if offline, the last copy we saw, else the offline page.
 * - Next.js build assets (/_next/static/, content-hashed): cache first.
 * - API calls, auth and uploads are never cached, so private data never lands
 *   in the cache and nothing stale is shown as current.
 */
const VERSION = 'v1';
const STATIC = `nb-static-${VERSION}`;
const PAGES = `nb-pages-${VERSION}`;
const PRECACHE = ['/offline.html', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC, PAGES]);
    for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) (await caches.open(STATIC)).put(request, res.clone());
  return res;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    // Only keep plain successful pages; skip redirects (e.g. to /login).
    if (res.ok && res.type === 'basic' && !res.redirected) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) ?? (await caches.match('/offline.html'));
  }
}

// Signing out clears saved pages so the next person on this device can't see them.
self.addEventListener('message', (event) => {
  if (event.data === 'clear-pages') event.waitUntil(caches.delete(PAGES));
});
