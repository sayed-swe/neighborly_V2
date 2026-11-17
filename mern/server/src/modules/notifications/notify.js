import { Notification } from './notification.model.js';

const clip = (s, n = 60) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s ?? '');
export { clip };

/**
 * Creates an in-app notification. Never notifies people about their own actions, and
 * collapses repeats (e.g. someone switching reactions) into a single entry.
 * Fire-and-forget: a failed notification must never break the action that caused it.
 */
export function notify({ user, actor, type, message, link, ref, dedupe = false }) {
  if (!user || (actor && String(user) === String(actor))) return;
  const doc = { user, actor, type, message, link, ref };
  const op = dedupe
    ? Notification.updateOne({ user, actor, type, ref }, { $set: { ...doc, read: false }, $currentDate: { updatedAt: true } }, { upsert: true })
    : Notification.create(doc);
  Promise.resolve(op).catch((err) => console.error('notify failed', err.message));
}

/** One notification each for many recipients (emergency alerts). */
export async function notifyMany(userIds, data) {
  if (!userIds.length) return;
  await Notification.insertMany(userIds.filter((u) => String(u) !== String(data.actor)).map((user) => ({ ...data, user })));
}
