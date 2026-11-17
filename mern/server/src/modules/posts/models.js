import mongoose from 'mongoose';

const { Schema } = mongoose;

export const CATEGORIES = ['general', 'news', 'help', 'sale', 'lost-found', 'event'];
export const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad'];
export const REPORT_REASONS = ['spam', 'harassment', 'false-info', 'scam', 'inappropriate', 'other'];

const counters = () => Object.fromEntries(REACTION_TYPES.map((t) => [t, { type: Number, default: 0, min: 0 }]));

const pointSchema = new Schema(
  { type: { type: String, enum: ['Point'], required: true }, coordinates: { type: [Number], required: true } },
  { _id: false },
);

/* ------------------------------- Post -------------------------------- */
const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    text: { type: String, trim: true, maxlength: 2000, default: '' },
    category: { type: String, enum: CATEGORIES, default: 'general', index: true },
    price: { type: Number, min: 0, max: 1e8 },
    images: { type: [{ type: String, maxlength: 80 }], validate: (v) => v.length <= 4 },
    // Copied from the author's *approximate* location. Never the exact home.
    location: { type: pointSchema, required: true },
    areaName: { type: String, maxlength: 120 },
    sharedFrom: { type: Schema.Types.ObjectId, ref: 'Post', index: true },
    status: { type: String, enum: ['active', 'hidden', 'removed'], default: 'active', index: true },
    moderation: { by: { type: Schema.Types.ObjectId, ref: 'User' }, reason: { type: String, maxlength: 200 }, at: Date },
    editedAt: Date,
    reactions: counters(),
    reactionTotal: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    shareCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);
postSchema.index({ location: '2dsphere' });
postSchema.index({ status: 1, createdAt: -1, _id: -1 });
postSchema.index({ text: 'text' });
export const Post = mongoose.model('Post', postSchema);

/* ------------------------------ Comment ------------------------------ */
const commentSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    parent: { type: Schema.Types.ObjectId, ref: 'Comment', index: true }, // replies are one level deep
    text: { type: String, trim: true, required: true, minlength: 1, maxlength: 1000 },
    reactions: counters(),
    reactionTotal: { type: Number, default: 0, min: 0 },
    replyCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);
commentSchema.index({ post: 1, parent: 1, createdAt: 1, _id: 1 });
export const Comment = mongoose.model('Comment', commentSchema);

/* ------------------------------ Reaction ----------------------------- */
const reactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['post', 'comment'], required: true },
    target: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: REACTION_TYPES, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
reactionSchema.index({ user: 1, targetType: 1, target: 1 }, { unique: true }); // one reaction per user per target
reactionSchema.index({ targetType: 1, target: 1 });
export const Reaction = mongoose.model('Reaction', reactionSchema);

/* ------------------------------- Report ------------------------------ */
const reportSchema = new Schema(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: { type: String, enum: ['post', 'comment'], required: true },
    target: { type: Schema.Types.ObjectId, required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post', index: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: ['open', 'actioned', 'dismissed'], default: 'open', index: true },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    handledAt: Date,
    note: { type: String, maxlength: 200 },
  },
  { timestamps: true },
);
reportSchema.index({ reporter: 1, targetType: 1, target: 1 }, { unique: true }); // can't report the same thing twice
export const Report = mongoose.model('Report', reportSchema);
