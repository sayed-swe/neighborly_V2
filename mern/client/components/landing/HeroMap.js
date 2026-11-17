import { AlertTriangle, HandHelping, PackageSearch, Star, Tag } from 'lucide-react';

/** Illustrated neighborhood map with radius rings and live-looking post chips. */
export default function HeroMap() {
  return (
    <div className="hero-map" aria-hidden="true">
      <svg viewBox="0 0 560 520" className="hero-map-svg">
        <defs>
          <pattern id="blocks" width="56" height="56" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
            <rect width="56" height="56" fill="#efe6d6" />
            <rect x="6" y="6" width="44" height="44" rx="5" fill="#f7f1e6" />
          </pattern>
          <radialGradient id="fade" cx="50%" cy="50%" r="55%">
            <stop offset="80%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#f6f1e8" stopOpacity=".7" />
          </radialGradient>
        </defs>
        <rect width="560" height="520" fill="url(#blocks)" />
        {/* river */}
        <path d="M-10 410 C 120 360, 170 470, 300 430 S 470 330, 580 360" fill="none" stroke="#bcd3ea" strokeWidth="26" strokeLinecap="round" />
        {/* main roads */}
        <path d="M-10 190 L 580 120" stroke="#fff" strokeWidth="14" />
        <path d="M200 -10 L 250 540" stroke="#fff" strokeWidth="12" />
        <path d="M380 -10 C 360 200, 420 300, 400 540" stroke="#fff" strokeWidth="9" />
        {/* parks */}
        <rect x="300" y="180" width="70" height="58" rx="10" fill="#cfe2d3" transform="rotate(-8 335 209)" />
        <circle cx="120" cy="300" r="30" fill="#cfe2d3" />
        {/* radius rings */}
        <g className="rings">
          <circle cx="280" cy="260" r="200" fill="#1f4d3a" fillOpacity=".04" stroke="#1f4d3a" strokeOpacity=".25" strokeDasharray="4 6" />
          <circle cx="280" cy="260" r="128" fill="#1f4d3a" fillOpacity=".06" stroke="#1f4d3a" strokeOpacity=".35" strokeDasharray="4 6" />
          <circle cx="280" cy="260" r="60" fill="#1f4d3a" fillOpacity=".09" stroke="#1f4d3a" strokeOpacity=".5" />
        </g>
        <g fontFamily="inherit" fontSize="12" fontWeight="600" fill="#1f4d3a" fillOpacity=".75">
          <text x="345" y="258">1 km</text>
          <text x="412" y="250">3 km</text>
          <text x="484" y="242">5 km</text>
        </g>
        {/* home */}
        <circle className="pulse" cx="280" cy="260" r="14" fill="#c8553a" />
        <circle cx="280" cy="260" r="11" fill="#c8553a" stroke="#fff" strokeWidth="3" />
        {/* pins */}
        <g stroke="#fff" strokeWidth="2.5">
          <circle cx="214" cy="200" r="7" fill="#e9a93a" />
          <circle cx="360" cy="330" r="7" fill="#4f7fb8" />
          <circle cx="170" cy="330" r="7" fill="#7a4f86" />
          <circle cx="330" cy="150" r="7" fill="#1f4d3a" />
          <circle cx="440" cy="390" r="6" fill="#b4382e" />
          <circle cx="120" cy="150" r="5" fill="#9aa29d" />
          <circle cx="470" cy="160" r="5" fill="#9aa29d" />
        </g>
        <rect width="560" height="520" fill="url(#fade)" />
      </svg>

      <div className="chip chip-1"><span className="chip-ico" style={{ background: 'var(--sun-100)', color: '#8a5d0c' }}><PackageSearch size={16} /></span>
        <div><strong>Lost: grey cat, red collar</strong><span>Road 12 · 400 m away</span></div></div>
      <div className="chip chip-2"><span className="chip-ico" style={{ background: 'var(--sky-100)', color: 'var(--sky)' }}><Star size={16} /></span>
        <div><strong>Karim, electrician</strong><span>4.9 ★ · 38 neighbour reviews</span></div></div>
      <div className="chip chip-3"><span className="chip-ico" style={{ background: 'var(--danger-100)', color: 'var(--danger)' }}><AlertTriangle size={16} /></span>
        <div><strong>Water off 10:00–14:00</strong><span>Block B · Verified notice</span></div></div>
      <div className="chip chip-4"><span className="chip-ico" style={{ background: 'var(--plum-100)', color: 'var(--plum)' }}><Tag size={16} /></span>
        <div><strong>Bicycle, ৳4,500</strong><span>1.2 km · posted 1h ago</span></div></div>
      <div className="chip chip-5"><span className="chip-ico" style={{ background: 'var(--green-100)', color: 'var(--green)' }}><HandHelping size={16} /></span>
        <div><strong>Need a ride to the clinic</strong><span>3 neighbours offered help</span></div></div>
    </div>
  );
}
