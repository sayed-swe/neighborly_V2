'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, EyeOff, Search } from 'lucide-react';
import { api, parseError } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import AreaMap from '@/components/map';
import { Alert, Button, Spinner } from '@/components/ui';

const DHAKA = { lat: 23.8103, lng: 90.4125 };

export default function LocationPicker({ onSaved, submitLabel = 'Save home area' }) {
  const { user } = useAuth();
  const approx = user.location?.approx?.coordinates;
  const [pos, setPos] = useState(approx ? { lat: approx[1], lng: approx[0] } : DHAKA);
  const [hasPicked, setHasPicked] = useState(Boolean(approx));
  const [areaName, setAreaName] = useState(user.location?.areaName ?? '');
  const [radiusKm, setRadiusKm] = useState(user.location?.radiusKm ?? 3);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(''); // 'search' | 'locate' | 'save'
  const [error, setError] = useState('');
  const nameEdited = useRef(Boolean(user.location?.areaName));
  const reverseTimer = useRef();

  const pick = useCallback((p, name) => {
    setPos(p);
    setHasPicked(true);
    setError('');
    if (name) { setAreaName(name); nameEdited.current = false; return; }
    clearTimeout(reverseTimer.current);
    reverseTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/geo/reverse', { params: { lat: p.lat.toFixed(5), lng: p.lng.toFixed(5) } });
        if (!nameEdited.current && data.areaName) setAreaName(data.areaName);
      } catch { /* the user can type a name instead */ }
    }, 700);
  }, []);
  useEffect(() => () => clearTimeout(reverseTimer.current), []);

  async function search(e) {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setBusy('search'); setError(''); setResults(null);
    try {
      const { data } = await api.get('/geo/search', { params: { q: query.trim() } });
      setResults(data.results);
    } catch (err) {
      setError(parseError(err).message);
    } finally { setBusy(''); }
  }

  function locate() {
    if (!navigator.geolocation) { setError('Your browser can’t share location. Search or tap the map instead.'); return; }
    setBusy('locate'); setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { pick({ lat: coords.latitude, lng: coords.longitude }); setBusy(''); },
      (err) => { setError(err.code === 1 ? 'Location permission was denied. Search or tap the map instead.' : 'Couldn’t get your location. Search or tap the map instead.'); setBusy(''); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function save() {
    if (!hasPicked) { setError('Drop a pin on your home first.'); return; }
    if (areaName.trim().length < 2) { setError('Give your area a name, e.g. “Dhanmondi 27”.'); return; }
    setBusy('save'); setError('');
    try {
      const { data } = await api.put('/users/me/location', { lat: pos.lat, lng: pos.lng, areaName: areaName.trim(), radiusKm });
      onSaved?.(data.user);
    } catch (err) {
      setError(parseError(err).message);
      setBusy('');
    }
  }

  return (
    <div className="picker">
      <div className="picker-controls">
        <form className="picker-search" onSubmit={search} role="search">
          <label htmlFor="loc-q" className="sr-only">Search for your address or area</label>
          <Search size={18} className="picker-search-ico" aria-hidden="true" />
          <input id="loc-q" className="input" placeholder="Search an area, road or landmark" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
          <Button type="submit" className="btn btn-sm" loading={busy === 'search'} disabled={query.trim().length < 3}>Search</Button>
        </form>
        <Button type="button" className="btn btn-sm" onClick={locate} loading={busy === 'locate'}><Crosshair size={16} /> Use my location</Button>
      </div>

      {results && (
        <ul className="picker-results card" aria-label="Search results">
          {results.length === 0 && <li className="muted small" style={{ padding: 12 }}>No matches. Try a nearby landmark or tap the map.</li>}
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" onClick={() => { pick({ lat: r.lat, lng: r.lng }, r.areaName); setResults(null); }}>
                <strong>{r.areaName}</strong><span className="tiny muted">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="picker-map">
        <AreaMap center={pos} radiusKm={radiusKm} editable onPick={pick} pin={hasPicked ? 'exact' : 'none'} height={360} />
        <p className="picker-map-hint tiny">{hasPicked ? 'Drag the pin or tap the map to adjust.' : 'Tap the map where you live.'}</p>
      </div>

      <div className="picker-fields">
        <div className="field">
          <label className="label" htmlFor="area-name">Area name <span className="tiny muted">shown to neighbours</span></label>
          <input id="area-name" className="input" maxLength={120} placeholder="e.g. Dhanmondi 27, Dhaka" value={areaName}
            onChange={(e) => { setAreaName(e.target.value); nameEdited.current = true; }} />
        </div>
        <div className="field">
          <label className="label" htmlFor="radius">How far should we look? <output className="radius-value" htmlFor="radius">{radiusKm} km</output></label>
          <input id="radius" type="range" min="1" max="10" step="1" className="range" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} />
          <div className="radius-scale tiny muted"><span>1 km · your block</span><span>10 km · your side of town</span></div>
        </div>
      </div>

      <div className="picker-privacy">
        <EyeOff size={18} />
        <p className="small">Your exact pin is stored privately. Other people see an area about 500 m across, so nobody can find your door from your posts.</p>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      <Button className="btn btn-primary btn-lg picker-save" onClick={save} loading={busy === 'save'}>
        {busy === 'save' ? 'Saving…' : submitLabel}
      </Button>
      {busy === 'search' && <span className="sr-only" role="status"><Spinner /> Searching</span>}
    </div>
  );
}
