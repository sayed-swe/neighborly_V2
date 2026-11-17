import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { User } from '../users/user.model.js';
import { authenticate, requireVerified, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { postLimiter } from '../../middleware/security.js';
import { errors } from '../../utils/AppError.js';
import { distanceKm } from '../../utils/geo.js';
import { can } from '../../config/permissions.js';
import { audit } from '../audit/audit.service.js';
import { notifyMany } from '../notifications/notify.js';

const { Schema } = mongoose;
export const SEVERITIES = ['low', 'medium', 'high', 'critical'];

const alertSchema = new Schema(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, trim: true, required: true, minlength: 2, maxlength: 150 },
    message: { type: String, trim: true, required: true, maxlength: 2000 },
    severity: { type: String, enum: SEVERITIES, default: 'high' },
    place: { type: String, trim: true, maxlength: 200 },
    location: { type: { type: String, enum: ['Point'], required: true }, coordinates: { type: [Number], required: true } },
    areaName: String,
    radiusKm: { type: Number, min: 1, max: 20, default: 5 },
    status: { type: String, enum: ['active', 'resolved'], default: 'active', index: true },
    resolvedAt: Date,
    expiresAt: { type: Date, required: true },
    notified: { type: Number, default: 0 },
  },
  { timestamps: true },
);
alertSchema.index({ location: '2dsphere' });
export const Alert = mongoose.model('Alert', alertSchema);

const r = Router();
r.use(authenticate, requireVerified);
const idParams = z.strictObject({ id: z.string().refine(mongoose.isValidObjectId, 'Invalid id') });

function present(a, viewer) {
  const here = viewer.location?.approx?.coordinates;
  return {
    id: a._id, title: a.title, message: a.message, severity: a.severity, place: a.place, areaName: a.areaName, radiusKm: a.radiusKm,
    status: a.status, createdAt: a.createdAt, expiresAt: a.expiresAt, resolvedAt: a.resolvedAt, notified: a.notified,
    distanceKm: here ? Math.round(distanceKm(here, a.location.coordinates) * 10) / 10 : null,
    createdBy: a.createdBy?.name ? { id: a.createdBy._id, name: a.createdBy.name, role: a.createdBy.role } : null,
    canResolve: a.status === 'active' && (String(a.createdBy?._id ?? a.createdBy) === String(viewer._id) || can(viewer.role, 'alert:broadcast')),
  };
}

// Alerts that reach the viewer: active, not expired, and the viewer is inside the alert's radius
r.get('/', validate({ query: z.object({ history: z.enum(['1']).optional() }) }), async (req, res) => {
  const here = req.user.location?.approx?.coordinates;
  if (!here) return res.json({ alerts: [] });
  const now = new Date();
  const filter = req.valid.query.history ? { createdAt: { $gte: new Date(now - 30 * 864e5) } } : { status: 'active', expiresAt: { $gt: now } };
  filter.location = { $geoWithin: { $centerSphere: [here, 20 / 6378.1] } };
  const rows = await Alert.find(filter).sort({ createdAt: -1 }).limit(50).populate('createdBy', 'name role').lean();
  res.json({ alerts: rows.filter((a) => distanceKm(here, a.location.coordinates) <= a.radiusKm).map((a) => present(a, req.user)) });
});

r.post('/', postLimiter, requirePermission('alert:broadcast'), validate({
  body: z.strictObject({
    title: z.string().trim().min(2, 'Add a headline').max(150),
    message: z.string().trim().min(5, 'Say what is happening and what people should do').max(2000),
    severity: z.enum(SEVERITIES).default('high'),
    place: z.string().trim().max(200).optional(),
    radiusKm: z.number().int().min(1).max(20).default(5),
    hours: z.number().int().min(1).max(72).default(12),
  }),
}), async (req, res) => {
  const approx = req.user.location?.approx;
  if (!approx) throw errors.badRequest('Set your home area first.', 'NO_LOCATION');
  const { hours, ...body } = req.body;
  const alert = await Alert.create({ ...body, createdBy: req.user._id, location: approx, areaName: req.user.location.areaName, expiresAt: new Date(Date.now() + hours * 3600e3) });
  // Everyone whose home is inside the radius gets a notification (exact homes are used server-side only)
  const recipients = await User.find({
    status: 'active', emailVerified: true,
    'location.home': { $geoWithin: { $centerSphere: [approx.coordinates, body.radiusKm / 6378.1] } },
  }).distinct('_id');
  await notifyMany(recipients, { actor: req.user._id, type: 'alert', ref: alert._id, link: '/alerts', message: `⚠ ${body.title}` });
  alert.notified = recipients.filter((id) => !id.equals(req.user._id)).length;
  await alert.save();
  audit(req, 'alert_sent', { actor: req.user._id, meta: { id: alert._id.toString(), severity: alert.severity, notified: alert.notified } });
  res.status(201).json({ alert: present(await Alert.findById(alert._id).populate('createdBy', 'name role').lean(), req.user) });
});

r.patch('/:id/resolve', validate({ params: idParams }), async (req, res) => {
  const alert = await Alert.findById(req.valid.params.id);
  if (!alert) throw errors.notFound('Alert not found');
  if (!alert.createdBy.equals(req.user._id) && !can(req.user.role, 'alert:broadcast')) throw errors.forbidden();
  alert.status = 'resolved';
  alert.resolvedAt = new Date();
  await alert.save();
  audit(req, 'alert_resolved', { actor: req.user._id, meta: { id: alert._id.toString() } });
  res.json({ ok: true });
});

export default r;
