export const REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Like', color: 'var(--green)' },
  { type: 'love', emoji: '❤️', label: 'Love', color: '#d1344a' },
  { type: 'haha', emoji: '😂', label: 'Haha', color: '#b07a16' },
  { type: 'wow', emoji: '😮', label: 'Wow', color: '#b07a16' },
  { type: 'sad', emoji: '😢', label: 'Sad', color: '#b07a16' },
];
export const REACTION_BY_TYPE = Object.fromEntries(REACTIONS.map((r) => [r.type, r]));

/** Optimistic update: switch (or clear, with type=null) the viewer's reaction on a post/comment. */
export function applyReaction(item, type) {
  const reactions = { ...item.reactions };
  let total = item.reactionTotal;
  if (item.myReaction) { reactions[item.myReaction] = Math.max(0, reactions[item.myReaction] - 1); total = Math.max(0, total - 1); }
  if (type) { reactions[type] = (reactions[type] ?? 0) + 1; total += 1; }
  return { ...item, reactions, reactionTotal: total, myReaction: type };
}

export const topReactions = (reactions = {}) =>
  REACTIONS.filter((r) => reactions[r.type] > 0).sort((a, b) => reactions[b.type] - reactions[a.type]).slice(0, 3);
