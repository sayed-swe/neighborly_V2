'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Map as MapIcon } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { Alert, Spinner } from '@/components/ui';
import PageHeader from '@/components/PageHeader';
import { KIND_STYLE } from '@/lib/mapKinds';

const NearbyMap = dynamic(() => import('@/components/map/NearbyMap'), { ssr: false, loading: () => <div className="area-map area-map-loading" style={{ height: 560 }}>Loading map…</div> });
const KINDS = Object.keys(KIND_STYLE);

export default function MapPage() {
  const [on, setOn] = useState(new Set(KINDS));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    api.get('/map').then(({ data: d }) => setData(d)).catch((e) => setError(parseError(e).message));
  }, []);

  const toggle = (k) => setOn((cur) => { const n = new Set(cur); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const items = data?.items.filter((i) => on.has(i.kind)) ?? [];
  const counts = Object.fromEntries(KINDS.map((k) => [k, data?.items.filter((i) => i.kind === k).length ?? 0]));

  return (
    <div className="fpage">
      <PageHeader icon={MapIcon} title="Map" subtitle={data ? `${data.items.length} things within ${data.radiusKm} km. Pins show approximate areas, never exact homes.` : 'Everything near you on one map.'} />
      <div className="map-filters" role="group" aria-label="Show on map">
        {KINDS.map((k) => (
          <button key={k} className={`map-chip ${on.has(k) ? 'is-on' : ''}`} aria-pressed={on.has(k)} onClick={() => toggle(k)}>
            <span className="map-dot" style={{ background: KIND_STYLE[k].color }} /> {KIND_STYLE[k].label} <span className="muted">{counts[k]}</span>
          </button>
        ))}
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {!data ? <div className="page-loader"><Spinner size={26} /></div> : (
        <div className="map-layout">
          <NearbyMap center={data.center} radiusKm={data.radiusKm} items={items} focus={focus} />
          <aside className="map-list card" aria-label="Nearest first">
            <h2 className="card-title" style={{ padding: '14px 16px 6px' }}>Nearest first</h2>
            {items.length === 0 ? <p className="small muted" style={{ padding: 16 }}>Nothing to show. Turn on more types above.</p> : (
              <ul>
                {items.map((it) => (
                  <li key={`${it.kind}-${it.id}`}>
                    <button onClick={() => setFocus(it)} className="map-row">
                      <span className="map-dot" style={{ background: KIND_STYLE[it.kind].color }} />
                      <span className="map-row-main"><strong>{it.title}</strong><span className="tiny muted">{KIND_STYLE[it.kind].label} · {it.distanceKm} km</span></span>
                    </button>
                    <Link href={it.link} className="link tiny">Open</Link>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
