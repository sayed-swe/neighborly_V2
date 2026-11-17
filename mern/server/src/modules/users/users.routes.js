import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { User, SERVICE_CATEGORIES } from './user.model.js';
import { Session } from '../auth/session.model.js';
import { AuditEvent } from '../audit/audit.model.js';
import { audit } from '../audit/audit.service.js';
import { authenticate, requireVerified, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { name } from '../auth/auth.schemas.js';
import { approximate, point } from '../../utils/geo.js';
import { errors } from '../../utils/AppError.js';
import { clearRefreshCookie } from '../auth/token.service.js';

const r = Router();
r.use(authenticate, requireVerified);

const profileSchema = z.strictObject({
  name: name.optional(),
  bio: z.string().trim().max(280).optional(),
  provider: z
    .strictObject({
      businessName: z.string().trim().min(2).max(80),
      category: z.enum(SERVICE_CATEGORIES),
      description: z.string().trim().max(500).optional(),
    })
    .optional(),
});

r.patch('/me', requirePermission('profile:update'), validate({ body: profileSchema }), async (req, res) => {
  const { provider, ...rest } = req.body;
  if (provider && req.user.role !== 'provider') throw errors.forbidden('Only service providers have a business profile');
  Object.assign(req.user, rest);
  if (provider) req.user.provider = provider;
  await req.user.save();
  res.json({ user: req.user.toJSON() });
});

const locationSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  areaName: z.string().trim().min(2).max(120),
  radiusKm: z.number().int().min(1).max(10),
});

r.put('/me/location', validate({ body: locationSchema }), async (req, res) => {
  const { lat, lng, areaName, radiusKm } = req.body;
  req.user.location = {
    home: point([lng, lat]),
    approx: point(approximate([lng, lat])),
    areaName,
    radiusKm,
  };
  req.user.onboardingComplete = true;
  await req.user.save();
  audit(req, 'location_updated', { user: req.user._id });
  res.json({ user: req.user.toJSON() });
});

r.patch('/me/radius', validate({ body: z.strictObject({ radiusKm: z.number().int().min(1).max(10) }) }), async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { 'location.radiusKm': req.body.radiusKm });
  const user = await User.findById(req.user._id);
  res.json({ user: user.toJSON() });
});

/** How many verified neighbours are within the user's radius (counted from exact homes, never exposed). */
r.get('/me/nearby-count', async (req, res) => {
  const me = await User.findById(req.user._id).select('+location.home');
  if (!me.location?.home) return res.json({ count: 0 });
  const count = await User.countDocuments({
    _id: { $ne: me._id },
    emailVerified: true,
    status: 'active',
    'location.home': { $geoWithin: { $centerSphere: [me.location.home.coordinates, me.location.radiusKm / 6378.1] } },
  });
  res.json({ count, radiusKm: me.location.radiusKm });
});

/** Public profile: what other members may see. Never the email or the exact home. */
r.get('/:id/profile', validate({ params: z.strictObject({ id: z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id') }) }), async (req, res) => {
  const u = await User.findOne({ _id: req.valid.params.id, emailVerified: true }).lean();
  if (!u) throw errors.notFound('Member not found');
  const { Post } = await import('../posts/models.js');
  const { Service } = await import('../services/models.js');
  const [posts, services] = await Promise.all([
    Post.countDocuments({ author: u._id, status: 'active' }),
    Service.countDocuments({ provider: u._id, active: true }),
  ]);
  res.json({
    profile: {
      id: u._id, name: u.name, avatarUrl: u.avatarUrl, role: u.role, bio: u.bio, areaName: u.location?.areaName,
      joinedAt: u.createdAt, suspended: u.status === 'suspended',
      provider: u.role === 'provider' ? { businessName: u.provider?.businessName, category: u.provider?.category, description: u.provider?.description } : undefined,
      stats: { posts, services }, isMe: String(u._id) === String(req.user._id),
    },
  });
});

r.get('/me/activity', async (req, res) => {
  const events = await AuditEvent.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20).select('type ip userAgent createdAt').lean();
  res.json({ events: events.map(({ _id, ...e }) => ({ id: _id, ...e })) });
});

r.delete('/me', validate({ body: z.strictObject({ password: z.string().min(1).max(128) }) }), async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(req.body.password, user.passwordHash))) {
    throw errors.badRequest('Password is incorrect', 'VALIDATION_ERROR', { fields: { password: 'Password is incorrect' } });
  }
  if (user.role === 'admin' && (await User.countDocuments({ role: 'admin', status: 'active' })) <= 1) {
    throw errors.conflict('You are the last admin. Promote someone else first.', 'LAST_ADMIN');
  }
  await Session.deleteMany({ user: user._id });
  await User.deleteOne({ _id: user._id });
  audit(req, 'account_deleted', { meta: { userId: user._id.toString() } });
  clearRefreshCookie(res);
  res.status(204).end();
});

export default r;
