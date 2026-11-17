'use client';
import dynamic from 'next/dynamic';

// Leaflet touches `window`, so it only ever renders in the browser.
const AreaMap = dynamic(() => import('./AreaMap'), {
  ssr: false,
  loading: () => <div className="area-map area-map-loading" style={{ height: 320 }}>Loading map…</div>,
});
export default AreaMap;
