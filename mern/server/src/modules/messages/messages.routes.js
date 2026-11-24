import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { User } from '../users/user.model.js';
import { authenticate, requireVerified } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { commentLimiter } from '../../middleware/security.js';
import { errors } from '../../utils/AppError.js';
import { clean } from '../../utils/profanity.js';

const { Schema } = mongoose;

/* One conversation per pair of members. `unread` counts per member keep the badge query cheap. */
const conversationSchema = new Schema(
  {
    members: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], validate: (v) => v.length === 2 },
    key: { type: String, required: true, unique: true }, // sorted member ids: prevents duplicate threads
    lastMessage: { text: String, sender: Schema.Types.ObjectId, at: Date },
    unread: { type: Map, of: Number, default: {} },
  },
  { timestamps: true },
);
conversationSchema.index({ members: 1, 'lastMessage.at': -1 });
export const Conversation = mongoose.model('Conversation', conversationSchema);

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, trim: true, required: true, minlength: 1, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
messageSchema.index({ conversation: 1, createdAt: -1, _id: -1 });
export const Message = mongoose.model('Message', messageSchema);

const r = Router();
r.use(authenticate, requireVerified);
const oid = z.string().refine(mongoose.isValidObjectId, 'Invalid id');

const presentPerson = (u) => (u ? { id: u._id, name: u.name, avatarUrl: u.avatarUrl, role: u.role, areaName: u.location?.areaName } : { id: null, name: 'Deleted user' });

async function loadConversation(req) {
  const c = await Conversation.findOne({ _id: req.valid.params.id, members: req.user._id }); // members only
  if (!c) throw errors.notFound('Conversation not found');
  return c;
}

r.get('/', async (req, res) => {
  const rows = await Conversation.find({ members: req.user._id, 'lastMessage.at': { $exists: true } })
    .sort({ 'lastMessage.at': -1 }).limit(100).populate('members', 'name avatarUrl role location.areaName').lean();
  const me = String(req.user._id);
  res.json({
    conversations: rows.map((c) => ({
      id: c._id,
      with: presentPerson(c.members.find((m) => String(m._id) !== me)),
      lastMessage: c.lastMessage ? { text: c.lastMessage.text, mine: String(c.lastMessage.sender) === me, at: c.lastMessage.at } : null,
      unread: c.unread?.[me] ?? 0,
    })),
  });
});

r.get('/unread-count', async (req, res) => {
  const me = String(req.user._id);
  const [agg] = await Conversation.aggregate([
    { $match: { members: req.user._id } },
    { $group: { _id: null, n: { $sum: { $ifNull: [`$unread.${me}`, 0] } } } },
  ]);
  res.json({ count: agg?.n ?? 0 });
});

// Find or start a conversation with someone
r.post('/', validate({ body: z.strictObject({ userId: oid }) }), async (req, res) => {
  const other = await User.findById(req.body.userId).select('name avatarUrl role status emailVerified location.areaName');
  if (!other || !other.emailVerified) throw errors.notFound('That member can’t be found.');
  if (other._id.equals(req.user._id)) throw errors.badRequest('You can’t message yourself.', 'SELF_MESSAGE');
  if (other.status === 'suspended') throw errors.badRequest('This member is not available.', 'UNAVAILABLE');
  const key = [String(req.user._id), String(other._id)].sort().join(':');
  const c = await Conversation.findOneAndUpdate({ key }, { $setOnInsert: { key, members: [req.user._id, other._id] } }, { upsert: true, returnDocument: 'after' });
  res.status(201).json({ id: c._id, with: presentPerson(other) });
});

const cursor = z.string().regex(/^\d{10,14}_[a-f0-9]{24}$/);
r.get('/:id/messages', validate({ params: z.strictObject({ id: oid }), query: z.object({ before: cursor.optional(), after: cursor.optional() }) }), async (req, res) => {
  const c = await loadConversation(req);
  const { before, after } = req.valid.query;
  const filter = { conversation: c._id };
  const cut = (v, op) => { const [ms, id] = v.split('_'); const t = new Date(Number(ms)); return { $or: [{ createdAt: { [op]: t } }, { createdAt: t, _id: { [op]: new mongoose.Types.ObjectId(id) } }] }; };
  if (before) Object.assign(filter, cut(before, '$lt'));
  if (after) Object.assign(filter, cut(after, '$gt'));
  const rows = await Message.find(filter).sort({ createdAt: after ? 1 : -1, _id: after ? 1 : -1 }).limit(after ? 100 : 31).lean();
  const hasMore = !after && rows.length > 30;
  const page = (after ? rows : rows.slice(0, 30).reverse());
  const other = c.members.find((m) => !m.equals(req.user._id));
  const otherUser = await User.findById(other).select('name avatarUrl role location.areaName').lean();
  res.json({
    with: presentPerson(otherUser),
    messages: page.map((m) => ({ id: m._id, body: m.body, mine: m.sender.equals(req.user._id), createdAt: m.createdAt, cursor: `${m.createdAt.getTime()}_${m._id}` })),
    hasMore,
  });
});

r.post('/:id/messages', commentLimiter, validate({ params: z.strictObject({ id: oid }), body: z.strictObject({ body: clean(z.string().trim().min(1, 'Write a message').max(2000)) }) }), async (req, res) => {
  const c = await loadConversation(req);
  const other = c.members.find((m) => !m.equals(req.user._id));
  const otherUser = await User.findById(other).select('status');
  if (!otherUser || otherUser.status === 'suspended') throw errors.badRequest('This member is not available.', 'UNAVAILABLE');
  const m = await Message.create({ conversation: c._id, sender: req.user._id, body: req.body.body });
  await Conversation.updateOne({ _id: c._id }, {
    lastMessage: { text: m.body.slice(0, 140), sender: req.user._id, at: m.createdAt },
    $inc: { [`unread.${other}`]: 1 },
  });
  res.status(201).json({ message: { id: m._id, body: m.body, mine: true, createdAt: m.createdAt, cursor: `${m.createdAt.getTime()}_${m._id}` } });
});

r.post('/:id/read', validate({ params: z.strictObject({ id: oid }) }), async (req, res) => {
  const c = await loadConversation(req);
  await Conversation.updateOne({ _id: c._id }, { $set: { [`unread.${req.user._id}`]: 0 } });
  res.status(204).end();
});

export default r;
