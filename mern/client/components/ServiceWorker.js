'use client';
import { useEffect } from 'react';

/** Registers the service worker in production builds (dev keeps hot reload simple). */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  }, []);
  return null;
}

/** Drops cached pages, e.g. on sign-out on a shared device. */
export function clearCachedPages() {
  navigator.serviceWorker?.controller?.postMessage('clear-pages');
}
