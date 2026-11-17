import { Router } from 'express';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { User } from '../users/user.model.js';
import { Post, Comment, Reaction, Report, CATEGORIES, REACTION_TYPES, REPORT_REASONS } from './models.js';
import { authenticate, requireVerified, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { postLimiter, commentLimiter, reportLimiter } from '../../middleware/security.js';
import { errors } from '../../utils/AppError.js';
import { distanceKm } from '../../utils/geo.js';
import { can } from '../../config/permissions.js';
import { audit } from '../audit/audit.service.js';
import { IMAGE_URL, UPLOAD_DIR } from '../uploads/uploads.routes.js';

export const postsRouter = Router();
export const commentsRouter = Router();
postsRouter.use(authenticate, requireVerified);
commentsRouter.use(authenticate, requireVerified);

const oid = z.string().refine(mongoose.isValidObjectId, 'Invalid id');
const idParams = z.strictObject({ id: oid });
const cursor = z.string().regex(/^\d{10,14}_[a-f0-9]{24}$/);
const AUTHOR_FIELDS = 'name avatarUrl role status provider.businessName provider.category';

/* ------------------------------ helpers ------------------------------ */
const cursorOf = (d) => `${d.createdAt.getTime()}_${d._id}`;
function cursorFilter(c, dir) {
  const [ms, id] = c.split('_');
  const t = new Date(Number(ms));
  const op = dir === 'asc' ? '$gt' : '$lt';
  return { $or: [{ createdAt: { [op]: t } }, { createdAt: t, _id: { [op]: new mongoose.Types.ObjectId(id) } }] };
}

const presentAuthor = (a) => (a ? {
  id: a._id.toString(), name: a.name, avatarUrl: a.avatarUrl, role: a.role,
  business: a.role === 'provider' ? a.provider?.businessName : undefined,
} : { id: null, name: 'Deleted user', role: 'resident' });

async function myReactions(viewer, targetType, ids) {
  if (!ids.length) return new Map();
  const rows = await Reaction.find({ user: viewer._id, targetType, target: { $in: ids } }).select('target type').lean();
  return new Map(rows.map((x) => [x.target.toString(), x.type]));
}

/** Shapes posts for the API. Exact author location never appears; distance is from approximate points. */
async function presentPosts(docs, viewer) {
  const mine = await myReactions(viewer, 'post', docs.map((d) => d._id));
  const sharedIds = [...new Set(docs.filter((d) => d.sharedFrom).map((d) => d.sharedFrom.toString()))];
  const originals = sharedIds.length ? await Post.find({ _id: { $in: sharedIds }, status: 'active' }).populate('author', AUTHOR_FIELDS).lean() : [];
  const originalMap = new Map(originals.map((o) => [o._id.toString(), o]));
  const here = viewer.location?.approx?.coordinates;
  const isMod = can(viewer.role, 'content:moderate');

  const base = (d) => ({
    id: d._id.toString(),
    author: presentAuthor(d.author),
    text: d.text, category: d.category, price: d.price, images: d.images ?? [],
    areaName: d.areaName,
    distanceKm: here ? Math.round(distanceKm(here, d.location.coordinates) * 10) / 10 : null,
    createdAt: d.createdAt, editedAt: d.editedAt,
  });

  return docs.map((d) => {
    const out = {
      ...base(d),
      status: d.status,
      reactions: d.reactions, reactionTotal: d.reactionTotal, commentCount: d.commentCount, shareCount: d.shareCount,
      myReaction: mine.get(d._id.toString()) ?? null,
      canEdit: d.author?._id?.equals(viewer._id) && !d.sharedFrom,
      canDelete: Boolean(d.author?._id?.equals(viewer._id) || isMod),
    };
    if (d.sharedFrom) {
      const o = originalMap.get(d.sharedFrom.toString());
      out.shared = o ? base(o) : { unavailable: true };
    }
    return out;
  });
}

async function setReaction(Model, targetType, id, userId, type) {
  const key = { user: userId, targetType, target: id };
  let prev;
  try {
    prev = await Reaction.findOneAndUpdate(key, { type }, { upsert: true, returnDocument: 'before' });
  } catch (err) {
    if (err.code !== 11000) throw err;
    prev = await Reaction.findOneAndUpdate(key, { type }, { returnDocument: 'before' }); // lost an upsert race; just update
  }
  if (prev?.type === type) return;
  const inc = {};
  if (prev) inc[`reactions.${prev.type}`] = -1; else inc.reactionTotal = 1;
  inc[`reactions.${type}`] = (inc[`reactions.${type}`] ?? 0) + 1;
  await Model.updateOne({ _id: id }, { $inc: inc });
}

async function clearReaction(Model, targetType, id, userId) {
  const prev = await Reaction.findOneAndDelete({ user: userId, targetType, target: id });
  if (!prev) return;
  await Model.updateOne({ _id: id }, { $inc: { reactionTotal: -1, [`reactions.${prev.type}`]: -1 } });
}

async function loadVisiblePost(req, { allowOwnHidden = true } = {}) {
  const post = await Post.findById(req.valid.params.id);
  if (!post) throw errors.notFound('Post not found');
  const mine = post.author.equals(req.user._id);
  const isMod = can(req.user.role, 'content:moderate');
  if (post.status !== 'active' && !(isMod || (allowOwnHidden && mine))) throw errors.notFound('Post not found');
  return post;
}

const text = z.string().trim().max(2000, 'Keep posts under 2,000 characters').transform((v) => v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''));
const images = z.array(z.string().regex(IMAGE_URL, 'Invalid image')).max(4, 'Up to 4 photos');

const createSchema = z.strictObject({
  text: text.default(''),
  category: z.enum(CATEGORIES).default('general'),
  price: z.number().min(0).max(1e8).optional(),
  images: images.default([]),
}).superRefine((v, ctx) => {
  if (!v.text && v.images.length === 0) ctx.addIssue({ code: 'custom', path: ['text'], message: 'Write something or add a photo' });
  if (v.price != null && v.category !== 'sale') ctx.addIssue({ code: 'custom', path: ['price'], message: 'Price is only for items for sale' });
});

/* ------------------------------- feed -------------------------------- */
const feedQuery = z.object({
  category: z.enum(CATEGORIES).optional(),
  mine: z.enum(['1']).optional(),
  q: z.string().trim().min(2).max(80).optional(),
  before: cursor.optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

postsRouter.get('/', validate({ query: feedQuery }), async (req, res) => {
  const { category, mine, q, before, limit } = req.valid.query;
  const approx = req.user.location?.approx?.coordinates;
  if (!approx) throw errors.badRequest('Set your home area first.', 'NO_LOCATION');

  const filter = { status: 'active' };
  if (mine) filter.author = req.user._id;
  else {
    filter.author = { $nin: await User.find({ status: 'suspended' }).distinct('_id') }; // suspended members' content disappears
    filter.location = { $geoWithin: { $centerSphere: [approx, req.user.location.radiusKm / 6378.1] } };
  }
  if (category) filter.category = category;
  if (q) filter.$text = { $search: q };
  if (before) Object.assign(filter, cursorFilter(before, 'desc'));

  const docs = await Post.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).populate('author', AUTHOR_FIELDS).lean();
  const page = docs.slice(0, limit);
  res.json({ posts: await presentPosts(page, req.user), next: docs.length > limit ? cursorOf(page.at(-1)) : null });
});

postsRouter.post('/', postLimiter, validate({ body: createSchema }), async (req, res) => {
  const { approx, areaName } = req.user.location ?? {};
  if (!approx || !req.user.onboardingComplete) throw errors.badRequest('Set your home area before posting.', 'NO_LOCATION');
  await assertImagesExist(req.body.images);
  const post = await Post.create({ ...req.body, author: req.user._id, location: approx, areaName });
  audit(req, 'post_created', { user: req.user._id, meta: { id: post._id.toString(), category: post.category } });
  const [out] = await presentPosts([{ ...post.toObject(), author: req.user }], req.user);
  res.status(201).json({ post: out });
});

async function assertImagesExist(list) {
  for (const url of list) {
    try { await fs.promises.access(path.join(UPLOAD_DIR, path.basename(url))); }
    catch { throw errors.badRequest('One of the photos is no longer available. Upload it again.', 'BAD_IMAGE'); }
  }
}

postsRouter.get('/:id', validate({ params: idParams }), async (req, res) => {
  await loadVisiblePost(req);
  const doc = await Post.findById(req.valid.params.id).populate('author', AUTHOR_FIELDS).lean();
  res.json({ post: (await presentPosts([doc], req.user))[0] });
});

const editSchema = z.strictObject({
  text: text.optional(),
  category: z.enum(CATEGORIES).optional(),
  price: z.number().min(0).max(1e8).nullable().optional(),
});

postsRouter.patch('/:id', validate({ params: idParams, body: editSchema }), async (req, res) => {
  const post = await loadVisiblePost(req);
  if (!post.author.equals(req.user._id) || post.sharedFrom) throw errors.forbidden('You can only edit your own posts.');
  const { text: t, category, price } = req.body;
  if (t !== undefined) post.text = t;
  if (category) post.category = category;
  if (price !== undefined) post.price = price ?? undefined;
  if (post.category !== 'sale') post.price = undefined;
  if (!post.text && post.images.length === 0) throw errors.badRequest('A post needs text or a photo.', 'VALIDATION_ERROR', { fields: { text: 'Write something' } });
  post.editedAt = new Date();
  await post.save();
  const doc = await Post.findById(post._id).populate('author', AUTHOR_FIELDS).lean();
  res.json({ post: (await presentPosts([doc], req.user))[0] });
});

postsRouter.delete('/:id', validate({ params: idParams }), async (req, res) => {
  const post = await loadVisiblePost(req);
  const mine = post.author.equals(req.user._id);
  if (!mine && !can(req.user.role, 'content:moderate')) throw errors.forbidden();
  if (post.sharedFrom) await Post.updateOne({ _id: post.sharedFrom }, { $inc: { shareCount: -1 } });
  await Promise.all([
    Comment.deleteMany({ post: post._id }),
    Reaction.deleteMany({ $or: [{ targetType: 'post', target: post._id }] }),
    Report.updateMany({ post: post._id, status: 'open' }, { status: 'actioned', handledBy: req.user._id, handledAt: new Date(), note: 'Post deleted' }),
    post.deleteOne(),
  ]);
  if (!mine) audit(req, 'post_removed', { user: post.author, actor: req.user._id, meta: { id: post._id.toString(), deleted: true } });
  res.status(204).end();
});

/* ----------------------------- reactions ----------------------------- */
const reactionBody = z.strictObject({ type: z.enum(REACTION_TYPES) });

async function reactionResult(Model, id, viewerId, targetType) {
  const t = await Model.findById(id).select('reactions reactionTotal').lean();
  const mine = await Reaction.findOne({ user: viewerId, targetType, target: id }).select('type').lean();
  return { reactions: t.reactions, reactionTotal: t.reactionTotal, myReaction: mine?.type ?? null };
}

postsRouter.put('/:id/reaction', validate({ params: idParams, body: reactionBody }), async (req, res) => {
  const post = await loadVisiblePost(req, { allowOwnHidden: false });
  await setReaction(Post, 'post', post._id, req.user._id, req.body.type);
  res.json(await reactionResult(Post, post._id, req.user._id, 'post'));
});
postsRouter.delete('/:id/reaction', validate({ params: idParams }), async (req, res) => {
  const post = await loadVisiblePost(req, { allowOwnHidden: false });
  await clearReaction(Post, 'post', post._id, req.user._id);
  res.json(await reactionResult(Post, post._id, req.user._id, 'post'));
});

/* ------------------------------- share ------------------------------- */
postsRouter.post('/:id/share', postLimiter, validate({ params: idParams, body: z.strictObject({ text: text.default('') }) }), async (req, res) => {
  const { approx, areaName } = req.user.location ?? {};
  if (!approx) throw errors.badRequest('Set your home area before sharing.', 'NO_LOCATION');
  let original = await loadVisiblePost(req, { allowOwnHidden: false });
  if (original.status !== 'active') throw errors.notFound('Post not found');
  if (original.sharedFrom) { // always point at the root post, like a retweet of a retweet
    original = await Post.findOne({ _id: original.sharedFrom, status: 'active' });
    if (!original) throw errors.notFound('The original post is no longer available.');
  }
  const post = await Post.create({ author: req.user._id, text: req.body.text, category: 'general', location: approx, areaName, sharedFrom: original._id });
  await Post.updateOne({ _id: original._id }, { $inc: { shareCount: 1 } });
  const doc = await Post.findById(post._id).populate('author', AUTHOR_FIELDS).lean();
  res.status(201).json({ post: (await presentPosts([doc], req.user))[0], shareCount: original.shareCount + 1 });
});

/* ------------------------------ comments ----------------------------- */
const presentComment = (c, mineMap, viewer, postAuthorId) => ({
  id: c._id.toString(),
  parent: c.parent?.toString() ?? null,
  author: presentAuthor(c.author),
  text: c.text, createdAt: c.createdAt,
  reactionTotal: c.reactionTotal, reactions: c.reactions, replyCount: c.replyCount,
  myReaction: mineMap.get(c._id.toString()) ?? null,
  canDelete: Boolean(c.author?._id?.equals(viewer._id) || postAuthorId?.equals(viewer._id) || can(viewer.role, 'content:moderate')),
});

postsRouter.get('/:id/comments', validate({ params: idParams, query: z.object({ after: cursor.optional(), limit: z.coerce.number().int().min(1).max(20).default(6) }) }), async (req, res) => {
  const post = await loadVisiblePost(req);
  const { after, limit } = req.valid.query;
  const filter = { post: post._id, parent: null, ...(after ? cursorFilter(after, 'asc') : {}) };
  const tops = await Comment.find(filter).sort({ createdAt: 1, _id: 1 }).limit(limit + 1).populate('author', AUTHOR_FIELDS).lean();
  const page = tops.slice(0, limit);
  const replies = page.length
    ? await Comment.find({ post: post._id, parent: { $in: page.map((c) => c._id) } }).sort({ createdAt: 1 }).limit(200).populate('author', AUTHOR_FIELDS).lean()
    : [];
  const mine = await myReactions(req.user, 'comment', [...page, ...replies].map((c) => c._id));
  res.json({
    comments: page.map((c) => ({
      ...presentComment(c, mine, req.user, post.author),
      replies: replies.filter((x) => x.parent.equals(c._id)).map((x) => presentComment(x, mine, req.user, post.author)),
    })),
    next: tops.length > limit ? cursorOf(page.at(-1)) : null,
  });
});

postsRouter.post('/:id/comments', commentLimiter,
  validate({ params: idParams, body: z.strictObject({ text: z.string().trim().min(1, 'Write a comment').max(1000, 'Keep comments under 1,000 characters'), parent: oid.optional() }) }),
  async (req, res) => {
    const post = await loadVisiblePost(req, { allowOwnHidden: false });
    let parent = null;
    if (req.body.parent) {
      parent = await Comment.findOne({ _id: req.body.parent, post: post._id });
      if (!parent) throw errors.notFound('The comment you replied to is gone.');
      if (parent.parent) parent = await Comment.findById(parent.parent); // flatten: replies stay one level deep
    }
    const comment = await Comment.create({ post: post._id, author: req.user._id, text: req.body.text, parent: parent?._id });
    await Promise.all([
      Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } }),
      parent && Comment.updateOne({ _id: parent._id }, { $inc: { replyCount: 1 } }),
    ]);
    const populated = await Comment.findById(comment._id).populate('author', AUTHOR_FIELDS).lean();
    res.status(201).json({ comment: { ...presentComment(populated, new Map(), req.user, post.author), replies: [] } });
  });

commentsRouter.delete('/:id', validate({ params: idParams }), async (req, res) => {
  const comment = await Comment.findById(req.valid.params.id);
  if (!comment) throw errors.notFound('Comment not found');
  const post = await Post.findById(comment.post).select('author');
  const allowed = comment.author.equals(req.user._id) || post?.author.equals(req.user._id) || can(req.user.role, 'content:moderate');
  if (!allowed) throw errors.forbidden();
  const removed = await removeComment(comment);
  if (!comment.author.equals(req.user._id)) audit(req, 'comment_removed', { user: comment.author, actor: req.user._id, meta: { id: comment._id.toString() } });
  res.json({ removed });
});

/** Deletes a comment (and its replies), fixing counters. Shared with the admin panel. */
export async function removeComment(comment) {
  const replies = comment.parent ? [] : await Comment.find({ parent: comment._id }).select('_id').lean();
  const ids = [comment._id, ...replies.map((x) => x._id)];
  await Promise.all([
    Comment.deleteMany({ _id: { $in: ids } }),
    Reaction.deleteMany({ targetType: 'comment', target: { $in: ids } }),
    Post.updateOne({ _id: comment.post }, { $inc: { commentCount: -ids.length } }),
    comment.parent && Comment.updateOne({ _id: comment.parent }, { $inc: { replyCount: -1 } }),
    Report.updateMany({ targetType: 'comment', target: { $in: ids }, status: 'open' }, { status: 'actioned', handledAt: new Date(), note: 'Comment deleted' }),
  ]);
  return ids.length;
}

commentsRouter.put('/:id/reaction', validate({ params: idParams, body: reactionBody }), async (req, res) => {
  const c = await Comment.findById(req.valid.params.id).select('_id');
  if (!c) throw errors.notFound('Comment not found');
  await setReaction(Comment, 'comment', c._id, req.user._id, req.body.type);
  res.json(await reactionResult(Comment, c._id, req.user._id, 'comment'));
});
commentsRouter.delete('/:id/reaction', validate({ params: idParams }), async (req, res) => {
  const c = await Comment.findById(req.valid.params.id).select('_id');
  if (!c) throw errors.notFound('Comment not found');
  await clearReaction(Comment, 'comment', c._id, req.user._id);
  res.json(await reactionResult(Comment, c._id, req.user._id, 'comment'));
});

/* ------------------------------- reports ----------------------------- */
const reportBody = z.strictObject({ reason: z.enum(REPORT_REASONS), details: z.string().trim().max(300).optional() });

async function fileReport(req, res, targetType, target, post, authorId) {
  if (authorId.equals(req.user._id)) throw errors.badRequest('You can’t report your own content.', 'SELF_REPORT');
  try {
    await Report.create({ reporter: req.user._id, targetType, target, post, ...req.body });
  } catch (err) {
    if (err.code === 11000) throw errors.conflict('You already reported this. Our moderators will take a look.', 'ALREADY_REPORTED');
    throw err;
  }
  res.status(201).json({ message: 'Thanks. A moderator will review this.' });
}

postsRouter.post('/:id/report', reportLimiter, validate({ params: idParams, body: reportBody }), async (req, res) => {
  const post = await loadVisiblePost(req, { allowOwnHidden: false });
  await fileReport(req, res, 'post', post._id, post._id, post.author);
});
commentsRouter.post('/:id/report', reportLimiter, validate({ params: idParams, body: reportBody }), async (req, res) => {
  const c = await Comment.findById(req.valid.params.id);
  if (!c) throw errors.notFound('Comment not found');
  await fileReport(req, res, 'comment', c._id, c.post, c.author);
});
