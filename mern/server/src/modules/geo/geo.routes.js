import { Router } from 'express';
import { z } from 'zod';
import env from '../../config/env.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { geoLimiter } from '../../middleware/security.js';
import { errors } from '../../utils/AppError.js';

/**
 * Server-side proxy to OpenStreetMap Nominatim: hides users' IPs from the third party,
 * sets the identifying User-Agent their usage policy requires, and caches results.
 */
const r = Router();
r.use(authenticate, geoLimiter);

const cache = new Map();
const CACHE_MAX = 500;
let lastCall = 0;

async function nominatim(path, params) {
  const url = new URL(path, env.NOMINATIM_URL);
  for (const [k, v] of Object.entries({ format: 'jsonv2', 'accept-language': 'en', ...params })) url.searchParams.set(k, v);
  const key = url.toString();
  if (cache.has(key)) return cache.get(key);

  const wait = 1000 - (Date.now() - lastCall); // policy: max 1 request per second
  if (wait > 0) await new Promise((res) => setTimeout(res, wait));
  lastCall = Date.now();

  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Neighborly/0.1 (student capstone project)' },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!resp?.ok) throw errors.badRequest('Location lookup is unavailable right now. Drop a pin on the map instead.', 'GEOCODER_UNAVAILABLE');
  const data = await resp.json();
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, data);
  return data;
}

const shortName = (a = {}) =>
  [a.neighbourhood || a.suburb || a.quarter || a.residential || a.road, a.city_district || a.city || a.town || a.village || a.county]
    .filter(Boolean)
    .join(', ');

r.get('/search', validate({ query: z.object({ q: z.string().trim().min(3).max(120) }) }), async (req, res) => {
  const data = await nominatim('/search', { q: req.valid.query.q, limit: 5, addressdetails: 1 });
  res.json({
    results: data.map((d) => ({
      label: d.display_name,
      areaName: shortName(d.address) || d.display_name.split(',').slice(0, 2).join(','),
      lat: Number(d.lat),
      lng: Number(d.lon),
    })),
  });
});

r.get('/reverse', validate({ query: z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) }) }), async (req, res) => {
  const { lat, lng } = req.valid.query;
  const d = await nominatim('/reverse', { lat, lon: lng, zoom: 16, addressdetails: 1 });
  res.json({ areaName: shortName(d.address) || 'Pinned location', label: d.display_name ?? null });
});

export default r;
