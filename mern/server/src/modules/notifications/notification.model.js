import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = ['reaction', 'comment', 'reply', 'share', 'rsvp', 'help_offer', 'review', 'service_request', 'request_update', 'alert', 'moderation'];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    message: { type: String, required: true, maxlength: 300 },
    link: { type: String, maxlength: 200 },
    ref: { type: mongoose.Schema.Types.ObjectId },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 }); // keep 60 days
export const Notification = mongoose.model('Notification', notificationSchema);
