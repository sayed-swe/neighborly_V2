'use client';
import { useMemo, useState } from 'react';

// Deterministic pseudo-random points spread over a 10 km radius (illustrative only).
function makePoints(n = 140) {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => {
    const d = 10 * Math.sqrt(rand()) * (0.25 + 0.75 * rand());
    const a = rand() * Math.PI * 2;
    // Rounded so server and browser render identical attributes (no hydration mismatch)
    const r2 = (n) => Math.round(n * 100) / 100;
    return { d, x: r2(Math.cos(a) * d), y: r2(Math.sin(a) * d), kind: Math.floor(rand() * 5) };
  });
}
const COLORS = ['var(--sun)', 'var(--sky)', 'var(--plum)', 'var(--green)', 'var(--brick)'];

export default function RadiusDemo() {
  const [km, setKm] = useState(3);
  const points = useMemo(() => makePoints(), []);
  const inRange = points.filter((p) => p.d <= km).length;
  const scale = 15; // px per km

  return (
    <div className="radius-demo card">
      <svg viewBox="-160 -160 320 320" className="radius-demo-svg" role="img" aria-label={`Illustration: ${inRange} posts within ${km} kilometres`}>
        <circle r="150" fill="var(--paper-2)" />
        {[2, 4, 6, 8, 10].map((r) => <circle key={r} r={r * scale} fill="none" stroke="var(--line-strong)" strokeDasharray="2 5" />)}
        <circle r={km * scale} fill="var(--green)" fillOpacity=".1" stroke="var(--green)" strokeWidth="2" style={{ transition: 'r .3s var(--ease)' }} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x * scale} cy={p.y * scale} r={p.d <= km ? 3.6 : 2.4}
            fill={p.d <= km ? COLORS[p.kind] : 'var(--line-strong)'} style={{ transition: 'fill .3s, r .3s' }} />
        ))}
        <circle r="7" fill="var(--brick)" stroke="#fff" strokeWidth="2.5" />
      </svg>
      <div className="radius-demo-ctl">
        <label htmlFor="demo-radius" className="label">Your radius <output htmlFor="demo-radius" className="radius-value">{km} km</output></label>
        <input id="demo-radius" type="range" min="1" max="10" step="1" value={km} onChange={(e) => setKm(Number(e.target.value))} className="range" />
        <div className="radius-scale tiny muted"><span>1 km · your block</span><span>10 km · your side of town</span></div>
        <p className="radius-stat"><strong>{inRange}</strong> posts in range <span className="muted tiny">(sample data)</span></p>
      </div>
    </div>
  );
}
