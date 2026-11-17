import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { User, ROLES } from '../users/user.model.js';
import { authenticate, requireVerified, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { revokeAllForUser } from '../auth/token.service.js';
import { audit } from '../audit/audit.service.js';
import { errors } from '../../utils/AppError.js';
import { Post, Comment, Reaction, Report, CATEGORIES, REPORT_REASONS } from '../posts/models.js';
import { removeComment } from '../posts/posts.routes.js';
import { AuditEvent, AUDIT_EVENTS } from '../audit/audit.model.js';

const r = Router();
r.use(authenticate, requireVerified);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const idParams = z.strictObject({ id: z.string().refine(mongoose.isValidObjectId, 'Invalid id') });

r.get('/stats', requirePermission('admin:dashboard'), async (_req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const [total, byRole, verified, suspended, newThisWeek] = await Promise.all([
    User.countDocuments(),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.countDocuments({ emailVerified: true }),
    User.countDocuments({ status: 'suspended' }),
    User.countDocuments({ createdAt: { $gte: weekAgo } }),
  ]);
  res.json({ total, verified, suspended, newThisWeek, byRole: Object.fromEntries(byRole.map((x) => [x._id, x.count])) });
});

const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

r.get('/users', requirePermission('users:read'), validate({ query: listQuery }), async (req, res) => {
  const { q, role, status, page, limit } = req.valid.query;
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i'); // escaped: no ReDoS / regex injection
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ users: users.map((u) => u.toJSON()), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

async function loadTarget(req) {
  const target = await User.findById(req.valid.params.id);
  if (!target) throw errors.notFound('User not found');
  if (target._id.equals(req.user._id)) throw errors.forbidden('You cannot change your own account here', 'SELF_ACTION');
  return target;
}

async function ensureNotLastAdmin(target) {
  if (target.role === 'admin' && (await User.countDocuments({ role: 'admin', status: 'active' })) <= 1) {
    throw errors.conflict('At least one active admin is required', 'LAST_ADMIN');
  }
}

r.patch('/users/:id/role', requirePermission('users:manage'),
  validate({ params: idParams, body: z.strictObject({ role: z.enum(ROLES) }) }),
  async (req, res) => {
    const target = await loadTarget(req);
    if (target.role === req.body.role) return res.json({ user: target.toJSON() });
    if (req.body.role !== 'admin') await ensureNotLastAdmin(target);
    const from = target.role;
    target.role = req.body.role;
    await User.updateOne({ _id: target._id }, { role: target.role, $inc: { tokenVersion: 1 } });
    audit(req, 'role_changed', { user: target._id, actor: req.user._id, meta: { from, to: target.role } });
    res.json({ user: target.toJSON() });
  });

r.patch('/users/:id/status', requirePermission('users:manage'),
  validate({ params: idParams, body: z.strictObject({ status: z.enum(['active', 'suspended']), reason: z.string().trim().max(200).optional() }) }),
  async (req, res) => {
    const target = await loadTarget(req);
    if (req.body.status === 'suspended') {
      await ensureNotLastAdmin(target);
      await revokeAllForUser(target._id, 'admin');
    }
    target.status = req.body.status;
    await User.updateOne({ _id: target._id }, { status: target.status, $inc: { tokenVersion: 1 } });
    audit(req, req.body.status === 'suspended' ? 'suspended' : 'unsuspended', {
      user: target._id, actor: req.user._id, meta: { reason: req.body.reason },
    });
    res.json({ user: target.toJSON() });
  });


/* ======================= content moderation & overview ======================= */
const page = (q) => ({ skip: (q.page - 1) * q.limit, limit: q.limit });
const pagination = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) });
const AUTHOR = 'name email avatarUrl role status';

/** 14-day daily counts, zero-filled so the charts have no gaps. */
async function dailySeries(Model, days = 14, match = {}) {
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
  const rows = await Model.aggregate([
    { $match: { createdAt: { $gte: start }, ...match } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
  ]);
  const map = new Map(rows.map((x) => [x._id, x.count]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const key = d.toLocaleDateString('en-CA');
    return { date: key, count: map.get(key) ?? 0 };
  });
}

r.get('/overview', requirePermission('admin:dashboard'), async (_req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const [users, verified, suspended, newUsers, postsByStatus, comments, reactions, shares, openReports, signups, postsPerDay, commentsPerDay,
    byRole, byCategory, topAreas, recent] = await Promise.all([
    User.countDocuments(), User.countDocuments({ emailVerified: true }), User.countDocuments({ status: 'suspended' }),
    User.countDocuments({ createdAt: { $gte: weekAgo } }),
    Post.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Comment.countDocuments(), Reaction.countDocuments(), Post.countDocuments({ sharedFrom: { $exists: true } }),
    Report.countDocuments({ status: 'open' }),
    dailySeries(User), dailySeries(Post), dailySeries(Comment),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Post.aggregate([{ $match: { status: 'active', sharedFrom: { $exists: false } } }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    User.aggregate([{ $match: { 'location.areaName': { $exists: true } } }, { $group: { _id: '$location.areaName', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 6 }]),
    AuditEvent.find({ type: { $nin: ['login', 'logout'] } }).sort({ createdAt: -1 }).limit(8).populate('user actor', 'name').lean(),
  ]);
  const status = Object.fromEntries(postsByStatus.map((x) => [x._id, x.count]));
  res.json({
    totals: { users, verified, suspended, newUsers, posts: (status.active ?? 0) + (status.hidden ?? 0) + (status.removed ?? 0), hiddenPosts: (status.hidden ?? 0) + (status.removed ?? 0), comments, reactions, shares, openReports },
    series: { signups, posts: postsPerDay, comments: commentsPerDay },
    byRole: Object.fromEntries(byRole.map((x) => [x._id, x.count])),
    byCategory: byCategory.map((x) => ({ category: x._id, count: x.count })),
    topAreas: topAreas.map((x) => ({ area: x._id, count: x.count })),
    recent: recent.map((e) => ({ id: e._id, type: e.type, user: e.user?.name, actor: e.actor?.name, createdAt: e.createdAt })),
  });
});

const postsQuery = pagination.extend({
  q: z.string().trim().max(80).optional(),
  category: z.enum(CATEGORIES).optional(),
  status: z.enum(['active', 'hidden', 'removed']).optional(),
});
r.get('/posts', requirePermission('content:moderate'), validate({ query: postsQuery }), async (req, res) => {
  const { q, category, status } = req.valid.query;
  const filter = {};
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (q) filter.text = new RegExp(escapeRegex(q), 'i');
  const [posts, total] = await Promise.all([
    Post.find(filter).sort({ createdAt: -1 }).skip(page(req.valid.query).skip).limit(req.valid.query.limit).populate('author', AUTHOR).populate('moderation.by', 'name').lean(),
    Post.countDocuments(filter),
  ]);
  res.json({
    posts: posts.map((p) => ({
      id: p._id, text: p.text, category: p.category, price: p.price, images: p.images, status: p.status, areaName: p.areaName,
      isShare: Boolean(p.sharedFrom), reactionTotal: p.reactionTotal, commentCount: p.commentCount, shareCount: p.shareCount, createdAt: p.createdAt,
      author: p.author ? { id: p.author._id, name: p.author.name, email: p.author.email, role: p.author.role, status: p.author.status } : null,
      moderation: p.moderation?.at ? { by: p.moderation.by?.name, reason: p.moderation.reason, at: p.moderation.at } : null,
    })),
    total, page: req.valid.query.page, pages: Math.max(1, Math.ceil(total / req.valid.query.limit)),
  });
});

r.patch('/posts/:id/status', requirePermission('content:moderate'),
  validate({ params: idParams, body: z.strictObject({ status: z.enum(['active', 'hidden', 'removed']), reason: z.string().trim().max(200).optional() }) }),
  async (req, res) => {
    const post = await Post.findById(req.valid.params.id);
    if (!post) throw errors.notFound('Post not found');
    post.status = req.body.status;
    post.moderation = req.body.status === 'active' ? undefined : { by: req.user._id, reason: req.body.reason, at: new Date() };
    await post.save();
    const type = { active: 'post_restored', hidden: 'post_hidden', removed: 'post_removed' }[req.body.status];
    audit(req, type, { user: post.author, actor: req.user._id, meta: { id: post._id.toString(), reason: req.body.reason } });
    res.json({ ok: true, status: post.status });
  });

r.get('/comments', requirePermission('content:moderate'), validate({ query: pagination.extend({ q: z.string().trim().max(80).optional() }) }), async (req, res) => {
  const { q } = req.valid.query;
  const filter = q ? { text: new RegExp(escapeRegex(q), 'i') } : {};
  const [comments, total] = await Promise.all([
    Comment.find(filter).sort({ createdAt: -1 }).skip(page(req.valid.query).skip).limit(req.valid.query.limit).populate('author', AUTHOR).populate('post', 'text author').lean(),
    Comment.countDocuments(filter),
  ]);
  res.json({
    comments: comments.map((c) => ({
      id: c._id, text: c.text, isReply: Boolean(c.parent), reactionTotal: c.reactionTotal, createdAt: c.createdAt,
      author: c.author ? { id: c.author._id, name: c.author.name, email: c.author.email } : null,
      post: c.post ? { id: c.post._id, snippet: c.post.text?.slice(0, 80) } : null,
    })),
    total, page: req.valid.query.page, pages: Math.max(1, Math.ceil(total / req.valid.query.limit)),
  });
});

r.delete('/comments/:id', requirePermission('content:moderate'), validate({ params: idParams }), async (req, res) => {
  const comment = await Comment.findById(req.valid.params.id);
  if (!comment) throw errors.notFound('Comment not found');
  const removed = await removeComment(comment);
  audit(req, 'comment_removed', { user: comment.author, actor: req.user._id, meta: { id: comment._id.toString() } });
  res.json({ removed });
});

r.get('/reports', requirePermission('content:moderate'),
  validate({ query: pagination.extend({ status: z.enum(['open', 'actioned', 'dismissed', 'all']).default('open'), reason: z.enum(REPORT_REASONS).optional() }) }),
  async (req, res) => {
    const { status, reason } = req.valid.query;
    const filter = {};
    if (status !== 'all') filter.status = status;
    if (reason) filter.reason = reason;
    const [reports, total, openCount] = await Promise.all([
      Report.find(filter).sort({ createdAt: -1 }).skip(page(req.valid.query).skip).limit(req.valid.query.limit)
        .populate('reporter', 'name email').populate('handledBy', 'name').lean(),
      Report.countDocuments(filter),
      Report.countDocuments({ status: 'open' }),
    ]);
    // Attach a preview of whatever was reported
    const postIds = reports.filter((x) => x.targetType === 'post').map((x) => x.target);
    const commentIds = reports.filter((x) => x.targetType === 'comment').map((x) => x.target);
    const [posts, comments] = await Promise.all([
      Post.find({ _id: { $in: postIds } }).populate('author', AUTHOR).lean(),
      Comment.find({ _id: { $in: commentIds } }).populate('author', AUTHOR).lean(),
    ]);
    const pMap = new Map(posts.map((x) => [x._id.toString(), x]));
    const cMap = new Map(comments.map((x) => [x._id.toString(), x]));
    res.json({
      reports: reports.map((x) => {
        const t = (x.targetType === 'post' ? pMap : cMap).get(x.target.toString());
        return {
          id: x._id, targetType: x.targetType, reason: x.reason, details: x.details, status: x.status, createdAt: x.createdAt,
          reporter: x.reporter ? { name: x.reporter.name, email: x.reporter.email } : null,
          handledBy: x.handledBy?.name, handledAt: x.handledAt, note: x.note,
          postId: x.post,
          target: t ? { text: t.text, status: t.status, author: t.author ? { id: t.author._id, name: t.author.name, email: t.author.email } : null } : null,
        };
      }),
      total, openCount, page: req.valid.query.page, pages: Math.max(1, Math.ceil(total / req.valid.query.limit)),
    });
  });

r.patch('/reports/:id', requirePermission('content:moderate'),
  validate({ params: idParams, body: z.strictObject({ action: z.enum(['dismiss', 'remove']), note: z.string().trim().max(200).optional() }) }),
  async (req, res) => {
    const report = await Report.findById(req.valid.params.id);
    if (!report) throw errors.notFound('Report not found');
    if (report.status !== 'open') throw errors.conflict('This report was already handled.', 'ALREADY_HANDLED');
    const now = new Date();

    if (req.body.action === 'remove') {
      if (report.targetType === 'post') {
        const post = await Post.findById(report.target);
        if (post) {
          post.status = 'removed';
          post.moderation = { by: req.user._id, reason: req.body.note ?? `Reported: ${report.reason}`, at: now };
          await post.save();
          audit(req, 'post_removed', { user: post.author, actor: req.user._id, meta: { id: post._id.toString(), report: report._id.toString() } });
        }
      } else {
        const comment = await Comment.findById(report.target);
        if (comment) { await removeComment(comment); audit(req, 'comment_removed', { user: comment.author, actor: req.user._id }); }
      }
    }
    // Resolve every open report about the same thing in one go
    await Report.updateMany(
      { targetType: report.targetType, target: report.target, status: 'open' },
      { status: req.body.action === 'remove' ? 'actioned' : 'dismissed', handledBy: req.user._id, handledAt: now, note: req.body.note },
    );
    audit(req, 'report_handled', { actor: req.user._id, meta: { id: report._id.toString(), action: req.body.action } });
    res.json({ ok: true });
  });

r.get('/audit', requirePermission('audit:read'), validate({ query: pagination.extend({ type: z.enum(AUDIT_EVENTS).optional() }) }), async (req, res) => {
  const filter = req.valid.query.type ? { type: req.valid.query.type } : {};
  const [events, total] = await Promise.all([
    AuditEvent.find(filter).sort({ createdAt: -1 }).skip(page(req.valid.query).skip).limit(req.valid.query.limit).populate('user actor', 'name email').lean(),
    AuditEvent.countDocuments(filter),
  ]);
  res.json({
    events: events.map((e) => ({
      id: e._id, type: e.type, createdAt: e.createdAt, ip: e.ip, userAgent: e.userAgent, meta: e.meta,
      user: e.user ? { name: e.user.name, email: e.user.email } : null,
      actor: e.actor ? { name: e.actor.name } : null,
    })),
    total, page: req.valid.query.page, pages: Math.max(1, Math.ceil(total / req.valid.query.limit)),
  });
});

export default r;
