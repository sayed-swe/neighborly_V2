import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireVerified } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { errors } from '../../utils/AppError.js';
import { distanceKm } from '../../utils/geo.js';
import { User } from '../users/user.model.js';
import { Post } from '../posts/models.js';
import { Service } from '../services/models.js';
import { Alert } from '../alerts/alerts.routes.js';

/**
 * Everything near you, as map pins. Every coordinate here is an approximate (~500 m grid)
 * point: exact homes are never used for pins.
 */
const r = Router();
r.use(authenticate, requireVerified);
const KINDS = ['news', 'help', 'sale', 'lost-found', 'event', 'service', 'alert'];

r.get('/', validate({ query: z.object({ kinds: z.string().max(100).optional() }) }), async (req, res) => {
  const here = req.user.location?.approx?.coordinates;
  if (!here) throw errors.badRequest('Set your home area first.', 'NO_LOCATION');
  const wanted = new Set((req.valid.query.kinds ?? KINDS.join(',')).split(',').filter((k) => KINDS.includes(k)));
  const radius = req.user.location.radiusKm;
  const within = { $geoWithin: { $centerSphere: [here, radius / 6378.1] } };
  const suspended = await User.find({ status: 'suspended' }).distinct('_id');
  const postKinds = [...wanted].filter((k) => !['service', 'alert'].includes(k));

  const [posts, services, alerts] = await Promise.all([
    postKinds.length ? Post.find({ status: 'active', sharedFrom: null, category: { $in: postKinds }, location: within, author: { $nin: suspended },
      $or: [{ category: { $ne: 'event' } }, { 'event.startsAt': { $gte: new Date(Date.now() - 3 * 3600e3) } }] })
      .sort({ createdAt: -1 }).limit(150).select('title text category price listing lost event help location areaName createdAt').lean() : [],
    wanted.has('service') ? Service.find({ active: true, location: within, provider: { $nin: suspended } }).limit(80).lean() : [],
    wanted.has('alert') ? Alert.find({ status: 'active', expiresAt: { $gt: new Date() }, location: within }).lean() : [],
  ]);
  const d = (c) => Math.round(distanceKm(here, c) * 10) / 10;
  const items = [
    ...posts.map((p) => ({
      kind: p.category, id: p._id, link: `/post/${p._id}`, lat: p.location.coordinates[1], lng: p.location.coordinates[0], distanceKm: d(p.location.coordinates),
      title: p.title || (p.text || '').slice(0, 80) || 'Photo post',
      subtitle: p.category === 'event' ? p.event?.startsAt : p.category === 'sale' ? (p.listing?.status === 'sold' ? 'Sold' : p.price != null ? `৳${p.price}` : '') : p.category === 'lost-found' ? `${p.lost?.kind === 'found' ? 'Found' : 'Lost'}${p.lost?.status === 'reunited' ? ' · reunited' : ''}` : p.areaName,
      at: p.createdAt,
    })),
    ...services.map((s) => ({ kind: 'service', id: s._id, link: `/services/${s._id}`, lat: s.location.coordinates[1], lng: s.location.coordinates[0], distanceKm: d(s.location.coordinates), title: s.name, subtitle: s.ratingCount ? `★ ${s.ratingAvg.toFixed(1)} (${s.ratingCount})` : 'No reviews yet', verified: s.verified })),
    ...alerts.map((a) => ({ kind: 'alert', id: a._id, link: '/alerts', lat: a.location.coordinates[1], lng: a.location.coordinates[0], distanceKm: d(a.location.coordinates), title: a.title, subtitle: a.severity })),
  ].sort((a, b) => a.distanceKm - b.distanceKm);
  res.json({ center: { lat: here[1], lng: here[0] }, radiusKm: radius, items });
});

export default r;
