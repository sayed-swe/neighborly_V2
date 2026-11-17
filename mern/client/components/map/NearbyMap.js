'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import Link from 'next/link';
import L from 'leaflet';
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';

import { KIND_STYLE } from '@/lib/mapKinds';


function Fit({ center, radiusKm }) {
  const map = useMap();
  useEffect(() => { map.fitBounds(L.latLng(center.lat, center.lng).toBounds(radiusKm * 2000 * 1.1)); }, [map, center.lat, center.lng, radiusKm]);
  return null;
}

function FocusOn({ item }) {
  const map = useMap();
  useEffect(() => { if (item) map.flyTo([item.lat, item.lng], Math.max(map.getZoom(), 15), { duration: 0.5 }); }, [map, item]);
  return null;
}

/** All pins are approximate (~500 m grid) locations; several items can share one spot, so pins are offset slightly. */
export default function NearbyMap({ center, radiusKm, items, focus, height = 560 }) {
  const seen = new Map();
  const placed = items.map((it) => {
    const k = `${it.lat},${it.lng}`;
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    const angle = n * 2.4; const r = n ? 0.0006 * Math.sqrt(n) : 0;
    return { ...it, plat: it.lat + Math.sin(angle) * r, plng: it.lng + Math.cos(angle) * r };
  });
  return (
    <div className="area-map" style={{ height }}>
      <MapContainer center={[center.lat, center.lng]} zoom={14} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' maxZoom={19} />
        <Circle center={[center.lat, center.lng]} radius={radiusKm * 1000} pathOptions={{ color: '#1f4d3a', weight: 1.5, fillOpacity: 0.04, dashArray: '6 6' }} />
        {placed.map((it) => {
          const st = KIND_STYLE[it.kind] ?? KIND_STYLE.news;
          return (
            <CircleMarker key={`${it.kind}-${it.id}`} center={[it.plat, it.plng]} radius={it.kind === 'alert' ? 11 : 8}
              pathOptions={{ color: '#fff', weight: 2, fillColor: st.color, fillOpacity: 1 }}>
              <Popup>
                <div className="map-pop">
                  <span className="map-pop-kind" style={{ color: st.color }}>{st.label}</span>
                  <strong>{it.title}</strong>
                  {it.subtitle && <span>{typeof it.subtitle === 'string' && !/^\d{4}-/.test(it.subtitle) ? it.subtitle : new Date(it.subtitle).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>}
                  <span>{it.distanceKm} km away</span>
                  <Link href={it.link}>Open</Link>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
        <Fit center={center} radiusKm={radiusKm} />
        <FocusOn item={focus} />
      </MapContainer>
    </div>
  );
}
