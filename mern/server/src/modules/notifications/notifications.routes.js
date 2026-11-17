import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Notification } from './notification.model.js';
import { authenticate, requireVerified } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

const r = Router();
r.use(authenticate, requireVerified);

r.get('/', validate({ query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), before: z.string().datetime().optional() }) }), async (req, res) => {
  const { limit, before } = req.valid.query;
  const filter = { user: req.user._id, ...(before && { createdAt: { $lt: new Date(before) } }) };
  const items = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit + 1).populate('actor', 'name avatarUrl').lean();
  const page = items.slice(0, limit);
  res.json({
    notifications: page.map((n) => ({ id: n._id, type: n.type, message: n.message, link: n.link, read: n.read, createdAt: n.updatedAt ?? n.createdAt, actor: n.actor ? { id: n.actor._id, name: n.actor.name, avatarUrl: n.actor.avatarUrl } : null })),
    next: items.length > limit ? page.at(-1).createdAt.toISOString() : null,
  });
});

r.get('/unread-count', async (req, res) => {
  res.json({ count: await Notification.countDocuments({ user: req.user._id, read: false }) });
});

r.post('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.status(204).end();
});

r.post('/:id/read', validate({ params: z.strictObject({ id: z.string().refine(mongoose.isValidObjectId) }) }), async (req, res) => {
  await Notification.updateOne({ _id: req.valid.params.id, user: req.user._id }, { read: true }); // scoped to the owner
  res.status(204).end();
});

export default r;
