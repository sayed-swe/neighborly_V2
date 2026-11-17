import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Service, Review, ServiceRequest, REQUEST_STATUS } from './models.js';
import { SERVICE_CATEGORIES, User } from '../users/user.model.js';
import { authenticate, requireVerified, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { postLimiter, commentLimiter } from '../../middleware/security.js';
import { errors } from '../../utils/AppError.js';
import { distanceKm } from '../../utils/geo.js';
import { can } from '../../config/permissions.js';
import { audit } from '../audit/audit.service.js';
import { notify, clip } from '../notifications/notify.js';

const r = Router();
r.use(authenticate, requireVerified);
const oid = z.string().refine(mongoose.isValidObjectId, 'Invalid id');
const idParams = z.strictObject({ id: oid });
const PROVIDER = 'name avatarUrl role provider.businessName';

function present(s, viewer) {
  const here = viewer.location?.approx?.coordinates;
  return {
    id: s._id, name: s.name, category: s.category, description: s.description, priceInfo: s.priceInfo, hours: s.hours,
    areaName: s.areaName, verified: s.verified, active: s.active,
    rating: Math.round(s.ratingAvg * 10) / 10, ratingCount: s.ratingCount, createdAt: s.createdAt,
    distanceKm: here ? Math.round(distanceKm(here, s.location.coordinates) * 10) / 10 : null,
    provider: s.provider?._id ? { id: s.provider._id, name: s.provider.name, avatarUrl: s.provider.avatarUrl, business: s.provider.provider?.businessName } : null,
    mine: String(s.provider?._id ?? s.provider) === String(viewer._id),
  };
}

async function recomputeRating(serviceId) {
  const [agg] = await Review.aggregate([{ $match: { service: serviceId } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  await Service.updateOne({ _id: serviceId }, { ratingAvg: agg?.avg ?? 0, ratingCount: agg?.n ?? 0 });
}

/* ------------------------------ directory ---------------------------- */
const listQuery = z.object({
  category: z.enum(SERVICE_CATEGORIES).optional(),
  q: z.string().trim().min(2).max(80).optional(),
  verified: z.enum(['1']).optional(),
  mine: z.enum(['1']).optional(),
  sort: z.enum(['rating', 'distance', 'new']).default('rating'),
});

r.get('/', validate({ query: listQuery }), async (req, res) => {
  const { category, q, verified, mine, sort } = req.valid.query;
  const approx = req.user.location?.approx?.coordinates;
  const filter = mine ? { provider: req.user._id } : { active: true };
  if (!mine) {
    if (!approx) throw errors.badRequest('Set your home area first.', 'NO_LOCATION');
    // Providers travel further than residents walk, so look a bit beyond the feed radius
    filter.location = { $geoWithin: { $centerSphere: [approx, Math.max(5, req.user.location.radiusKm * 2) / 6378.1] } };
    filter.provider = { $nin: await User.find({ status: 'suspended' }).distinct('_id') };
  }
  if (category) filter.category = category;
  if (verified) filter.verified = true;
  if (q) filter.$text = { $search: q };
  const rows = await Service.find(filter).limit(100).populate('provider', PROVIDER).lean();
  const out = rows.map((s) => present(s, req.user));
  const sorters = {
    rating: (a, b) => b.verified - a.verified || b.rating - a.rating || b.ratingCount - a.ratingCount,
    distance: (a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0),
    new: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  };
  res.json({ services: out.sort(sorters[sort]) });
});

const serviceBody = z.strictObject({
  name: z.string().trim().min(2, 'Name your service').max(100),
  category: z.enum(SERVICE_CATEGORIES),
  description: z.string().trim().max(1500).default(''),
  priceInfo: z.string().trim().max(120).optional(),
  hours: z.string().trim().max(120).optional(),
});

r.post('/', postLimiter, requirePermission('service:list'), validate({ body: serviceBody }), async (req, res) => {
  const { approx, areaName } = req.user.location ?? {};
  if (!approx) throw errors.badRequest('Set your home area first.', 'NO_LOCATION');
  if ((await Service.countDocuments({ provider: req.user._id })) >= 10) throw errors.badRequest('You can list up to 10 services.', 'LIMIT');
  const s = await Service.create({ ...req.body, provider: req.user._id, location: approx, areaName });
  res.status(201).json({ service: present(await Service.findById(s._id).populate('provider', PROVIDER).lean(), req.user) });
});

r.get('/requests', validate({ query: z.object({ box: z.enum(['incoming', 'outgoing']).default('outgoing') }) }), async (req, res) => {
  const box = req.valid.query.box;
  const rows = await ServiceRequest.find({ [box === 'incoming' ? 'provider' : 'requester']: req.user._id })
    .sort({ updatedAt: -1 }).limit(100).populate('service', 'name category').populate('requester provider', 'name avatarUrl').lean();
  res.json({
    requests: rows.map((x) => ({
      id: x._id, details: x.details, preferredTime: x.preferredTime, status: x.status, providerNote: x.providerNote, createdAt: x.createdAt, updatedAt: x.updatedAt,
      service: x.service ? { id: x.service._id, name: x.service.name, category: x.service.category } : null,
      requester: x.requester && { id: x.requester._id, name: x.requester.name, avatarUrl: x.requester.avatarUrl },
      provider: x.provider && { id: x.provider._id, name: x.provider.name, avatarUrl: x.provider.avatarUrl },
    })),
  });
});

r.patch('/requests/:id', validate({ params: idParams, body: z.strictObject({ status: z.enum(REQUEST_STATUS), note: z.string().trim().max(500).optional() }) }), async (req, res) => {
  const x = await ServiceRequest.findById(req.valid.params.id).populate('service', 'name');
  if (!x) throw errors.notFound('Request not found');
  const isProvider = x.provider.equals(req.user._id);
  const isRequester = x.requester.equals(req.user._id);
  const { status, note } = req.body;
  // Who may move a request where
  const allowed = (isProvider && ((x.status === 'pending' && ['accepted', 'declined'].includes(status)) || (x.status === 'accepted' && status === 'done')))
    || (isRequester && ['pending', 'accepted'].includes(x.status) && status === 'cancelled');
  if (!isProvider && !isRequester) throw errors.notFound('Request not found');
  if (!allowed) throw errors.badRequest('That change isn’t possible for this request.', 'BAD_TRANSITION');
  x.status = status;
  if (isProvider && note !== undefined) x.providerNote = note;
  await x.save();
  const words = { accepted: 'accepted', declined: 'declined', done: 'marked as done', cancelled: 'cancelled' }[status];
  notify({ user: isProvider ? x.requester : x.provider, actor: req.user._id, type: 'request_update', ref: x._id, link: '/services?tab=requests',
    message: `${req.user.name} ${words} the request for “${clip(x.service?.name ?? 'a service')}”` });
  res.json({ ok: true, status: x.status });
});

r.get('/:id', validate({ params: idParams }), async (req, res) => {
  const s = await Service.findById(req.valid.params.id).populate('provider', PROVIDER).lean();
  if (!s || (!s.active && !s.provider?._id.equals(req.user._id) && !can(req.user.role, 'content:moderate'))) throw errors.notFound('Service not found');
  const reviews = await Review.find({ service: s._id }).sort({ createdAt: -1 }).limit(50).populate('author', 'name avatarUrl').lean();
  res.json({
    service: present(s, req.user),
    reviews: reviews.map((v) => ({ id: v._id, rating: v.rating, text: v.text, createdAt: v.createdAt, mine: v.author?._id.equals(req.user._id), author: v.author ? { id: v.author._id, name: v.author.name, avatarUrl: v.author.avatarUrl } : null })),
  });
});

r.patch('/:id', validate({ params: idParams, body: serviceBody.partial().extend({ active: z.boolean().optional() }) }), async (req, res) => {
  const s = await Service.findById(req.valid.params.id);
  if (!s) throw errors.notFound('Service not found');
  if (!s.provider.equals(req.user._id)) throw errors.forbidden('Only the provider can edit this service.');
  Object.assign(s, req.body);
  await s.save();
  res.json({ service: present(await Service.findById(s._id).populate('provider', PROVIDER).lean(), req.user) });
});

r.delete('/:id', validate({ params: idParams }), async (req, res) => {
  const s = await Service.findById(req.valid.params.id);
  if (!s) throw errors.notFound('Service not found');
  if (!s.provider.equals(req.user._id) && !can(req.user.role, 'content:moderate')) throw errors.forbidden();
  await Promise.all([Review.deleteMany({ service: s._id }), ServiceRequest.deleteMany({ service: s._id, status: 'pending' }), s.deleteOne()]);
  res.status(204).end();
});

/* ------------------------------- reviews ----------------------------- */
r.post('/:id/reviews', commentLimiter, validate({ params: idParams, body: z.strictObject({ rating: z.number().int().min(1).max(5), text: z.string().trim().max(1000).default('') }) }), async (req, res) => {
  const s = await Service.findById(req.valid.params.id);
  if (!s || !s.active) throw errors.notFound('Service not found');
  if (s.provider.equals(req.user._id)) throw errors.badRequest('You can’t review your own service.', 'SELF_REVIEW');
  // Reviews are upserted: a member has one review per service and can update it
  await Review.updateOne({ service: s._id, author: req.user._id }, { rating: req.body.rating, text: req.body.text }, { upsert: true });
  await recomputeRating(s._id);
  notify({ user: s.provider, actor: req.user._id, type: 'review', ref: s._id, link: `/services/${s._id}`, dedupe: true,
    message: `${req.user.name} rated “${clip(s.name)}” ${'★'.repeat(req.body.rating)}` });
  const fresh = await Service.findById(s._id).lean();
  res.status(201).json({ rating: Math.round(fresh.ratingAvg * 10) / 10, ratingCount: fresh.ratingCount });
});

r.delete('/:id/reviews/:reviewId', validate({ params: z.strictObject({ id: oid, reviewId: oid }) }), async (req, res) => {
  const v = await Review.findOne({ _id: req.valid.params.reviewId, service: req.valid.params.id });
  if (!v) throw errors.notFound('Review not found');
  if (!v.author.equals(req.user._id) && !can(req.user.role, 'content:moderate')) throw errors.forbidden();
  await v.deleteOne();
  await recomputeRating(v.service);
  res.status(204).end();
});

/* ------------------------------- requests ---------------------------- */
r.post('/:id/requests', postLimiter, validate({ params: idParams, body: z.strictObject({ details: z.string().trim().min(5, 'Describe what you need').max(1000), preferredTime: z.string().trim().max(120).optional() }) }), async (req, res) => {
  const s = await Service.findById(req.valid.params.id);
  if (!s || !s.active) throw errors.notFound('Service not found');
  if (s.provider.equals(req.user._id)) throw errors.badRequest('You can’t request your own service.', 'SELF_REQUEST');
  if (await ServiceRequest.exists({ service: s._id, requester: req.user._id, status: 'pending' })) throw errors.conflict('You already have a pending request for this service.', 'ALREADY_REQUESTED');
  const x = await ServiceRequest.create({ service: s._id, requester: req.user._id, provider: s.provider, ...req.body });
  notify({ user: s.provider, actor: req.user._id, type: 'service_request', ref: x._id, link: '/services?tab=requests',
    message: `${req.user.name} requested “${clip(s.name)}”: “${clip(req.body.details)}”` });
  res.status(201).json({ id: x._id, status: x.status });
});

/* ------------------------------ admin ------------------------------- */
export const adminServices = Router();
adminServices.use(authenticate, requireVerified, requirePermission('content:moderate'));
adminServices.get('/', validate({ query: z.object({ q: z.string().trim().max(80).optional(), page: z.coerce.number().int().min(1).max(1000).default(1) }) }), async (req, res) => {
  const { q, page } = req.valid.query;
  const filter = q ? { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } : {};
  const [rows, total] = await Promise.all([
    Service.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 20).limit(20).populate('provider', 'name email status').lean(),
    Service.countDocuments(filter),
  ]);
  res.json({
    services: rows.map((s) => ({ id: s._id, name: s.name, category: s.category, areaName: s.areaName, verified: s.verified, active: s.active, rating: Math.round(s.ratingAvg * 10) / 10, ratingCount: s.ratingCount, createdAt: s.createdAt,
      provider: s.provider ? { id: s.provider._id, name: s.provider.name, email: s.provider.email, status: s.provider.status } : null })),
    total, page, pages: Math.max(1, Math.ceil(total / 20)),
  });
});
adminServices.patch('/:id', validate({ params: idParams, body: z.strictObject({ verified: z.boolean().optional(), active: z.boolean().optional() }) }), async (req, res) => {
  if (req.body.verified !== undefined && !can(req.user.role, 'users:manage')) throw errors.forbidden('Only admins can verify providers.');
  const s = await Service.findByIdAndUpdate(req.valid.params.id, req.body, { returnDocument: 'after' });
  if (!s) throw errors.notFound('Service not found');
  audit(req, 'service_updated', { user: s.provider, actor: req.user._id, meta: { id: s._id.toString(), ...req.body } });
  res.json({ ok: true, verified: s.verified, active: s.active });
});

export default r;
