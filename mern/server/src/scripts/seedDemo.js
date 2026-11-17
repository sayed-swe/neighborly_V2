/**
 * Fills the database with realistic demo data: neighbours in two Dhaka areas, providers,
 * a moderator, 14 days of posts / comments / reactions / shares, spam and reports, and an
 * audit trail, so the feed and the admin panel are never empty during a demo.
 *
 * Usage (while `npm run dev` is running):
 *   MONGODB_URI=mongodb://127.0.0.1:27027/neighborly npm run seed:demo
 * Re-running replaces the previous demo data. Real accounts are never touched.
 * All demo accounts use the password: demo-pass-2026
 */
import bcrypt from 'bcryptjs';
import env from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../modules/users/user.model.js';
import { Session } from '../modules/auth/session.model.js';
import { AuditEvent } from '../modules/audit/audit.model.js';
import { Post, Comment, Reaction, Report, Rsvp, HelpOffer } from '../modules/posts/models.js';
import { Service, Review, ServiceRequest } from '../modules/services/models.js';
import { Conversation, Message } from '../modules/messages/messages.routes.js';
import { Notification } from '../modules/notifications/notification.model.js';
import { Alert } from '../modules/alerts/alerts.routes.js';
import { approximate, point } from '../utils/geo.js';

const DEMO_DOMAIN = '@demo.neighborly.test';
const DAY = 864e5;
const PASSWORD = 'demo-pass-2026';

// Deterministic randomness so the demo looks the same every time
let seed = 20261110;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const ago = (days) => new Date(Date.now() - days * DAY);

const AREAS = {
  dhanmondi27: { name: 'Dhanmondi 27, Dhaka', lat: 23.7561, lng: 90.3742 },
  dhanmondi15: { name: 'Dhanmondi 15, Dhaka', lat: 23.7473, lng: 90.3731 },
  dhanmondi8: { name: 'Dhanmondi 8, Dhaka', lat: 23.7396, lng: 90.3769 },
  lalmatia: { name: 'Lalmatia, Dhaka', lat: 23.7545, lng: 90.3665 },
  mohammadpur: { name: 'Mohammadpur, Dhaka', lat: 23.7576, lng: 90.3598 },
  kalabagan: { name: 'Kalabagan, Dhaka', lat: 23.7508, lng: 90.3829 },
  gulshan1: { name: 'Gulshan 1, Dhaka', lat: 23.7806, lng: 90.4166 },
  gulshan2: { name: 'Gulshan 2, Dhaka', lat: 23.7925, lng: 90.4144 },
  banani: { name: 'Banani, Dhaka', lat: 23.7937, lng: 90.4066 },
};

const PEOPLE = [
  { name: 'Rahim Ahmed', area: 'dhanmondi27' },
  { name: 'Tanvir Hossain', area: 'lalmatia', role: 'moderator' },
  { name: 'Karim Uddin', area: 'dhanmondi15', role: 'provider', provider: { businessName: 'Karim Electric Works', category: 'electrician', description: 'Wiring, fans, AC installation and short-circuit repair. Same-day service within 3 km.' } },
  { name: 'Farhana Akter', area: 'mohammadpur' },
  { name: 'Sadia Islam', area: 'kalabagan' },
  { name: 'Rafiq Mia', area: 'lalmatia', role: 'provider', provider: { businessName: 'Rafiq Plumbing', category: 'plumber', description: 'Leaking taps, blocked drains, water-tank cleaning. Free estimates for neighbours.' } },
  { name: 'Mehedi Hasan', area: 'dhanmondi8' },
  { name: 'Anika Rahman', area: 'lalmatia', role: 'provider', provider: { businessName: 'Anika’s Maths Coaching', category: 'tutoring', description: 'Small-group maths for Class 8–10. Two evenings a week, Lalmatia.' } },
  { name: 'Imran Khan', area: 'gulshan1' },
  { name: 'Tasnim Chowdhury', area: 'banani' },
  { name: 'Shakib Al Amin', area: 'gulshan2' },
  { name: 'Rina Begum', area: 'banani', role: 'provider', provider: { businessName: 'Rina’s Kitchen', category: 'catering', description: 'Homemade biryani and tehari. Order by 11 AM for same-day delivery.' } },
  { name: 'Jamal Hossain', area: 'mohammadpur', status: 'suspended' },
  { name: 'Sumon Das', area: 'kalabagan', unverified: true },
];
const idx = Object.fromEntries(PEOPLE.map((p, i) => [p.name.split(' ')[0].toLowerCase(), i]));

// [author, category, daysAgo, text, extras]
const POSTS = [
  ['tanvir', 'event', 0.2, 'Dhanmondi Lake cleanup this Saturday at 8 AM. Gloves and bags are provided. Bring a friend and your neighbours!'],
  ['rahim', 'news', 0.5, 'DESCO has announced scheduled maintenance tomorrow, 10 AM to 2 PM, on Road 27 and nearby lanes. Plan your day (and charge your laptops).'],
  ['karim', 'general', 0.8, 'Karim Electric Works: wiring, fan and AC installation, short-circuit repair. Same-day service within 3 km. Message me!'],
  ['farhana', 'help', 1.1, 'Does anyone have a ladder I could borrow for an hour? I need to change a ceiling light in Mohammadpur.'],
  ['mehedi', 'sale', 1.3, 'Nearly new mountain bicycle for sale. 21 gears, used for six months. Happy to show it in Dhanmondi 8.', { price: 4500 }],
  ['sadia', 'lost-found', 1.6, 'LOST: grey tabby cat with a red collar near the Kalabagan playground. Very friendly, answers to “Mishti”. Please message me if you spot her.'],
  ['rafiq', 'general', 2.0, 'Rafiq Plumbing: leaking taps, blocked drains, water-tank cleaning. Free visit estimate for neighbours.'],
  ['rahim', 'help', 2.4, 'Can anyone recommend a good home tutor for Class 8 English? Preferably within walking distance.'],
  ['anika', 'general', 2.6, 'Two seats are open in my Class 9–10 maths batch. Small groups, evenings, Lalmatia. Message me for details.'],
  ['farhana', 'news', 3.1, 'Heads up: gas pressure has been very low in Mohammadpur Block B since this morning. Titas Gas has been notified.'],
  ['mehedi', 'sale', 3.5, 'Study table and chair set, solid wood, one small scratch on a leg. Pickup only.', { price: 12000 }],
  ['tanvir', 'news', 4.0, 'Friendly reminder: keep posts kind and local. If something looks like spam or a scam, use the ⋯ menu to report it and a moderator will look.'],
  ['sadia', 'help', 4.2, 'Urgent: looking for an O+ blood donor at Square Hospital tonight. Please message me if you can help or know someone who can.'],
  ['rahim', 'lost-found', 4.8, 'FOUND: a black school bag near Dhanmondi Lake gate 3 with a Class 6 maths book inside. Message me to claim it.'],
  ['farhana', 'event', 5.5, 'Friday evening cricket at the Dhanmondi field, 5 PM. All ages welcome, beginners too!'],
  ['mehedi', 'general', 6.0, 'Has anyone tried the new bakery on Road 5? The sourdough is surprisingly good.'],
  ['tanvir', 'news', 6.5, 'Road 27 will be closed for repairs from Monday to Wednesday. Use Road 15 as the detour.'],
  ['rahim', 'sale', 7.0, 'Giving away a box of children’s story books (English and Bangla). Free to a good home. Pickup from Dhanmondi 27.', { price: 0 }],
  ['rafiq', 'help', 7.5, 'Looking for a reliable carpenter to fix a wardrobe door in Lalmatia. Recommendations welcome.'],
  ['anika', 'news', 8.0, 'SSC mock tests start next week. I have free practice papers for Class 10 students. Message me.'],
  ['sadia', 'general', 9.0, 'Beautiful evening at the lake today. Love this neighbourhood.'],
  ['farhana', 'help', 9.5, 'Is the pharmacy near the Mohammadpur bus stand open late? I need medicine tonight.'],
  ['mehedi', 'event', 10.0, 'Book swap meetup at the café on Road 8, Sunday 4 PM. Bring a book, take a book.'],
  ['rahim', 'news', 11.0, 'DNCC mosquito spraying is scheduled in our ward on Thursday morning. Keep windows closed for an hour or two.'],
  ['tanvir', 'general', 12.0, 'Welcome to all the new members who joined this week! Say hi in the comments.'],
  // Gulshan / Banani
  ['imran', 'news', 0.4, 'Traffic is gridlocked on Gulshan Avenue near the circle because of a broken-down bus. Avoid it if you can.'],
  ['tasnim', 'sale', 1.0, 'Selling my two-year-old split AC (1.5 ton), working perfectly. Moving abroad.', { price: 25000 }],
  ['rina', 'general', 1.9, 'Rina’s Kitchen: homemade biryani and tehari. Order by 11 AM for same-day delivery in Banani and Gulshan.'],
  ['shakib', 'event', 2.8, 'Gulshan Lake morning walk group, 6 AM every day. Come join us!'],
  ['imran', 'help', 3.7, 'Looking for recommendations for a good paediatrician in Gulshan or Banani.'],
  ['tasnim', 'lost-found', 5.0, 'FOUND: a set of keys with a blue keychain near the Banani 11 playground.'],
  ['shakib', 'news', 6.2, 'Banani Road 11 market had a 3-hour power outage this afternoon. Does anyone know why?'],
  // Spam / moderation cases
  ['jamal', 'general', 1.4, 'EARN 50,000 BDT DAILY FROM HOME!!! No investment needed. Click the link in my bio NOW. Limited seats!!!', { key: 'spam' }],
  ['jamal', 'sale', 3.9, 'Original iPhone 15 Pro only 500 BDT!!! DM me to order, advance payment via bKash only.', { key: 'scam', status: 'removed', mod: 'Scam / fraudulent listing' }],
  ['mehedi', 'general', 5.7, 'This landlord is a thief, everyone should go to his house and shout at him.', { key: 'harass', status: 'hidden', mod: 'Harassment / incitement' }],
];
// Typed details for marketplace, lost & found, events and help requests (matched by text start)
const at = (days, hour) => { const d = new Date(Date.now() + days * DAY); d.setHours(hour, 0, 0, 0); return d; };
const TYPED = {
  'Dhanmondi Lake cleanup': { title: 'Dhanmondi Lake cleanup', event: { startsAt: at(3, 8), endsAt: at(3, 11), place: 'Dhanmondi Lake, gate 2', capacity: 40 } },
  'Friday evening cricket': { title: 'Friday evening cricket', event: { startsAt: at(2, 17), endsAt: at(2, 19), place: 'Dhanmondi field' } },
  'Book swap meetup': { title: 'Neighbourhood book swap', event: { startsAt: at(-6, 16), endsAt: at(-6, 18), place: 'Café on Road 8' } },
  'Gulshan Lake morning walk': { title: 'Gulshan Lake morning walk', event: { startsAt: at(1, 6), endsAt: at(1, 7), place: 'Gulshan Lake park, north gate' } },
  'Nearly new mountain bicycle': { title: 'Mountain bicycle, 21 gears', listing: { kind: 'sell', condition: 'like-new', status: 'available' } },
  'Study table and chair': { title: 'Solid wood study table + chair', listing: { kind: 'sell', condition: 'good', status: 'reserved' } },
  'Giving away a box': { title: 'Children’s story books (free)', listing: { kind: 'free', condition: 'good', status: 'available' } },
  'Selling my two-year-old split AC': { title: '1.5 ton split AC', listing: { kind: 'sell', condition: 'good', status: 'sold' } },
  'Original iPhone 15 Pro': { title: 'iPhone 15 Pro', listing: { kind: 'sell', condition: 'new', status: 'available' } },
  'LOST: grey tabby cat': { title: 'Grey tabby cat “Mishti”', lost: { kind: 'lost', place: 'Kalabagan playground', date: at(-2, 18), status: 'open' } },
  'FOUND: a black school bag': { title: 'Black school bag', lost: { kind: 'found', place: 'Dhanmondi Lake gate 3', date: at(-5, 16), status: 'reunited' } },
  'FOUND: a set of keys': { title: 'Keys with a blue keychain', lost: { kind: 'found', place: 'Banani 11 playground', date: at(-5, 9), status: 'open' } },
};
const helpStatus = (text) => (/carpenter|pharmacy/.test(text) ? 'resolved' : 'open');

// Shares: [author, index-of-original (by text start), text]
const SHARES = [
  ['sadia', 'DESCO has announced', 'Important for everyone on Road 27.'],
  ['farhana', 'Dhanmondi Lake cleanup', 'Count me in!'],
  ['farhana', 'FOUND: a black school bag', 'Please share so the owner sees it.'],
  ['rahim', 'Heads up: gas pressure', ''],
];

const COMMENTS = {
  general: ['Thanks for sharing!', 'Very helpful, thank you.', 'Good to know, neighbour.', 'Great idea 👍', 'Agree completely.', 'Just sent you a message.'],
  help: ['I can help, sending a message now.', 'Try asking at the shop near the corner, they usually know.', 'Following this, I need the same!', 'Check your inbox.'],
  news: ['Thanks for the heads up!', 'Same here in my lane.', 'Is there an official notice anywhere?', 'Appreciate the warning.'],
  sale: ['Is this still available?', 'Can you do a slightly lower price?', 'Interested! Messaged you.', 'Looks great.'],
  'lost-found': ['Sharing with my building group.', 'I hope you find it soon.', 'I will keep an eye out today.', 'Thank you for posting this.'],
  event: ['I will be there!', 'Count me in 🙌', 'What time does it finish?', 'Great initiative.'],
};
const REPLIES = ['Anytime!', 'Sure, message me.', 'Glad it helped.', 'Thanks, see you there.', 'Will do!', 'Yes, still available.'];
const SPECIAL_COMMENTS = {
  'LOST: grey tabby': ['I think I saw a grey cat near Road 5 yesterday evening!', 'Praying she comes home safe.'],
  'Urgent: looking for an O+': ['Messaged you, my brother is O+.', 'Shared in our building group.'],
};

const REACTION_MIX = [['like', 0.62], ['love', 0.2], ['haha', 0.07], ['wow', 0.06], ['sad', 0.05]];
const reactionType = (sadCtx) => {
  if (sadCtx && chance(0.4)) return pick(['sad', 'love']);
  let r = rand();
  for (const [t, p] of REACTION_MIX) { if ((r -= p) < 0) return t; }
  return 'like';
};

const blankCounts = () => ({ like: 0, love: 0, haha: 0, wow: 0, sad: 0 });

async function reset() {
  const demo = await User.find({ email: new RegExp(`${DEMO_DOMAIN.replace('.', '\\.')}$`) }).select('_id').lean();
  if (!demo.length) return 0;
  const userIds = demo.map((u) => u._id);
  const posts = await Post.find({ author: { $in: userIds } }).select('_id').lean();
  const postIds = posts.map((p) => p._id);
  const comments = await Comment.find({ $or: [{ author: { $in: userIds } }, { post: { $in: postIds } }] }).select('_id').lean();
  const commentIds = comments.map((c) => c._id);
  await Promise.all([
    Reaction.deleteMany({ $or: [{ user: { $in: userIds } }, { target: { $in: [...postIds, ...commentIds] } }] }),
    Report.deleteMany({ $or: [{ reporter: { $in: userIds } }, { post: { $in: postIds } }] }),
    Comment.deleteMany({ _id: { $in: commentIds } }),
    Post.deleteMany({ $or: [{ _id: { $in: postIds } }, { sharedFrom: { $in: postIds } }] }),
    Session.deleteMany({ user: { $in: userIds } }),
    Rsvp.deleteMany({ $or: [{ user: { $in: userIds } }, { post: { $in: postIds } }] }),
    HelpOffer.deleteMany({ $or: [{ user: { $in: userIds } }, { post: { $in: postIds } }] }),
    Review.deleteMany({ author: { $in: userIds } }),
    ServiceRequest.deleteMany({ $or: [{ requester: { $in: userIds } }, { provider: { $in: userIds } }] }),
    Service.deleteMany({ provider: { $in: userIds } }),
    Notification.deleteMany({ $or: [{ user: { $in: userIds } }, { actor: { $in: userIds } }] }),
    Alert.deleteMany({ createdBy: { $in: userIds } }),
    (async () => {
      const convs = await Conversation.find({ members: { $in: userIds } }).select('_id').lean();
      await Message.deleteMany({ conversation: { $in: convs.map((c) => c._id) } });
      await Conversation.deleteMany({ _id: { $in: convs.map((c) => c._id) } });
    })(),
    AuditEvent.deleteMany({ $or: [{ user: { $in: userIds } }, { actor: { $in: userIds } }] }),
  ]);
  await User.deleteMany({ _id: { $in: userIds } });
  return demo.length;
}

try {
  await connectDB();
  const removed = await reset();
  if (removed) console.log(`♻️  Removed previous demo data (${removed} demo users)`);

  /* ---- users ---- */
  const passwordHash = await bcrypt.hash(PASSWORD, env.BCRYPT_ROUNDS);
  const firstPostDay = {};
  for (const [a, , d] of POSTS) firstPostDay[a] = Math.max(firstPostDay[a] ?? 0, d); // earliest post = most days ago

  const users = await User.insertMany(PEOPLE.map((p) => {
    const first = p.name.split(' ')[0].toLowerCase();
    const area = AREAS[p.area];
    const jitter = () => (rand() - 0.5) * 0.004;
    const home = [area.lng + jitter(), area.lat + jitter()];
    const joined = ago(Math.min(13.5, (firstPostDay[first] ?? rand() * 12) + 0.3 + rand() * 1.5));
    return {
      name: p.name, email: `${first}${DEMO_DOMAIN}`, passwordHash, hasPassword: true,
      role: p.role ?? 'resident', status: p.status ?? 'active',
      provider: p.provider, bio: p.provider ? '' : pick(['', '', 'Long-time resident. Happy to help where I can.', 'New here, say hi!', 'Teacher, cat person.']),
      emailVerified: !p.unverified, emailVerifiedAt: p.unverified ? undefined : joined,
      onboardingComplete: !p.unverified,
      location: p.unverified ? undefined : { home: point(home), approx: point(approximate(home)), areaName: area.name, radiusKm: 3 },
      lastLoginAt: ago(rand() * 3), createdAt: joined, updatedAt: joined,
    };
  }));
  console.log(`👥 ${users.length} demo users`);
  const byFirst = (f) => users[idx[f]];

  /* ---- posts ---- */
  const postDocs = POSTS.map(([a, category, d, text, extra = {}]) => {
    const author = byFirst(a);
    const at = ago(d);
    const typed = Object.entries(TYPED).find(([k]) => text.startsWith(k))?.[1] ?? {};
    return {
      ...typed,
      ...(category === 'event' && typed.event && { event: { ...typed.event, going: 0, interested: 0 } }),
      ...(category === 'help' && { help: { status: helpStatus(text), offers: 0 } }),
      author: author._id, text, category, price: extra.price, areaName: author.location.areaName, location: author.location.approx,
      status: extra.status ?? 'active',
      moderation: extra.mod ? { by: byFirst('tanvir')._id, reason: extra.mod, at: new Date(at.getTime() + 3 * 3600e3) } : undefined,
      reactions: blankCounts(), createdAt: at, updatedAt: at, _key: extra.key,
    };
  });
  const posts = await Post.insertMany(postDocs.map(({ _key, ...p }) => p));
  const postByText = (prefix) => posts.find((p) => p.text.startsWith(prefix));

  const shared = [];
  for (const [a, prefix, text] of SHARES) {
    const orig = postByText(prefix);
    const author = byFirst(a);
    const at = new Date(orig.createdAt.getTime() + (2 + rand() * 20) * 3600e3);
    shared.push({ author: author._id, text, category: 'general', areaName: author.location.areaName, location: author.location.approx, sharedFrom: orig._id, reactions: blankCounts(), createdAt: at, updatedAt: at });
    orig.shareCount = (orig.shareCount ?? 0) + 1;
  }
  const sharePosts = await Post.insertMany(shared);
  for (const p of posts.filter((x) => x.shareCount)) await Post.updateOne({ _id: p._id }, { shareCount: p.shareCount });
  console.log(`📝 ${posts.length + sharePosts.length} posts (${sharePosts.length} shares)`);

  /* ---- comments & reactions ---- */
  const activeUsers = users.filter((u) => u.emailVerified && u.status === 'active');
  const commentDocs = [];
  const replyPlans = [];
  for (const post of [...posts, ...sharePosts]) {
    if (post.status !== 'active') continue;
    const pool = activeUsers.filter((u) => u.location?.areaName && Math.abs(u.location.approx.coordinates[1] - post.location.coordinates[1]) < 0.04);
    const special = Object.entries(SPECIAL_COMMENTS).find(([k]) => post.text.startsWith(k))?.[1];
    const n = special ? special.length : chance(0.25) ? 0 : 1 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const others = pool.filter((u) => !u._id.equals(post.author));
      if (!others.length) break;
      const author = pick(others);
      const at = new Date(post.createdAt.getTime() + (0.3 + rand() * 14) * 3600e3);
      if (at > new Date()) continue;
      const doc = { _id: undefined, post: post._id, author: author._id, text: special?.[i] ?? pick(COMMENTS[post.category] ?? COMMENTS.general), reactions: blankCounts(), createdAt: at, updatedAt: at };
      commentDocs.push(doc);
      if (chance(0.35)) replyPlans.push({ doc, post });
    }
  }
  const top = await Comment.insertMany(commentDocs.map(({ _id, ...c }) => c));
  const replyDocs = [];
  for (const { doc, post } of replyPlans) {
    const parent = top.find((c) => c.post.equals(doc.post) && c.text === doc.text && c.createdAt.getTime() === doc.createdAt.getTime());
    if (!parent) continue;
    const responder = chance(0.6) ? users.find((u) => u._id.equals(post.author)) : pick(activeUsers);
    const at = new Date(parent.createdAt.getTime() + (0.2 + rand() * 6) * 3600e3);
    if (at > new Date()) continue;
    replyDocs.push({ post: post._id, author: responder._id, parent: parent._id, text: pick(REPLIES), reactions: blankCounts(), createdAt: at, updatedAt: at });
  }
  // One abusive comment for the moderation queue
  const abusePost = postByText('Heads up: gas pressure');
  const abusive = { post: abusePost._id, author: byFirst('jamal')._id, text: 'You are all idiots. Nobody cares about your gas problem.', reactions: blankCounts(), createdAt: new Date(abusePost.createdAt.getTime() + 5 * 3600e3), updatedAt: new Date() };
  const replies = await Comment.insertMany([...replyDocs, abusive]);
  const allComments = [...top, ...replies];

  const commentCountByPost = new Map();
  for (const c of allComments) commentCountByPost.set(c.post.toString(), (commentCountByPost.get(c.post.toString()) ?? 0) + 1);
  for (const r of replies.filter((x) => x.parent)) await Comment.updateOne({ _id: r.parent }, { $inc: { replyCount: 1 } });

  const reactionDocs = [];
  const postTally = new Map();
  const commentTally = new Map();
  const react = (targetType, target, user, type, createdAt, tally) => {
    reactionDocs.push({ user: user._id, targetType, target: target._id, type, createdAt });
    const t = tally.get(target._id.toString()) ?? { counts: blankCounts(), total: 0 };
    t.counts[type]++; t.total++; tally.set(target._id.toString(), t);
  };
  for (const post of [...posts, ...sharePosts]) {
    if (post.status === 'removed') continue;
    const pool = activeUsers.filter((u) => u.location?.areaName && Math.abs(u.location.approx.coordinates[1] - post.location.coordinates[1]) < 0.04);
    const likers = pool.filter(() => chance(post.status === 'hidden' ? 0.1 : 0.55));
    const sad = /LOST|Urgent|blood/i.test(post.text);
    for (const u of likers) react('post', post, u, reactionType(sad), new Date(post.createdAt.getTime() + rand() * 20 * 3600e3), postTally);
  }
  for (const c of allComments) {
    if (c.text.startsWith('You are all idiots')) continue;
    for (const u of activeUsers.filter(() => chance(0.18))) {
      if (!u._id.equals(c.author)) react('comment', c, u, 'like', new Date(c.createdAt.getTime() + rand() * 6 * 3600e3), commentTally);
    }
  }
  await Reaction.insertMany(reactionDocs);
  const bulk = async (Model, tally, extra) => tally.size && Model.bulkWrite([...tally].map(([id, t]) => ({
    updateOne: { filter: { _id: id }, update: { $set: { reactions: t.counts, reactionTotal: t.total, ...(extra?.(id) ?? {}) } } },
  })));
  await bulk(Post, postTally, (id) => ({ commentCount: commentCountByPost.get(id) ?? 0 }));
  await bulk(Comment, commentTally);
  for (const [id, n] of commentCountByPost) if (!postTally.has(id)) await Post.updateOne({ _id: id }, { commentCount: n });
  console.log(`💬 ${allComments.length} comments · ❤️  ${reactionDocs.length} reactions`);

  /* ---- reports ---- */
  const mod = byFirst('tanvir');
  const abusiveComment = allComments.find((c) => c.text.startsWith('You are all idiots'));
  const spam = postByText('EARN 50,000');
  const scam = postByText('Original iPhone');
  const harass = postByText('This landlord');
  const promo = postByText('Karim Electric');
  const kitchen = postByText('Rina’s Kitchen');
  const R = (reporter, targetType, target, reason, details, status = 'open', extra = {}) => ({
    reporter: byFirst(reporter)._id, targetType, target: target._id, post: targetType === 'post' ? target._id : target.post, reason, details, status, ...extra,
    createdAt: ago(extra.daysAgo ?? 0.3 + rand()), updatedAt: new Date(),
  });
  const handled = { handledBy: mod._id, handledAt: ago(0.5) };
  await Report.insertMany([
    R('rahim', 'post', spam, 'spam', 'Looks like a get-rich-quick scam.'),
    R('farhana', 'post', spam, 'scam', 'Asks people to click a suspicious link.'),
    R('sadia', 'post', spam, 'spam'),
    R('mehedi', 'comment', abusiveComment, 'harassment', 'Rude and insulting.'),
    R('imran', 'post', kitchen, 'spam', 'Is this an advertisement?'),
    R('rahim', 'post', scam, 'scam', 'Fake price, asks for advance payment.', 'actioned', { ...handled, note: 'Removed: fraudulent listing', daysAgo: 3.6 }),
    R('sadia', 'post', scam, 'scam', undefined, 'actioned', { ...handled, note: 'Removed: fraudulent listing', daysAgo: 3.5 }),
    R('farhana', 'post', harass, 'harassment', 'Encourages people to confront someone.', 'actioned', { ...handled, note: 'Hidden: harassment', daysAgo: 5.4 }),
    R('jamal', 'post', promo, 'spam', undefined, 'dismissed', { ...handled, note: 'Legitimate local business', daysAgo: 0.6 }),
  ]);
  console.log('🚩 9 reports (5 open)');

  /* ---- RSVPs & help offers ---- */
  const rsvps = [];
  for (const ev of posts.filter((p) => p.category === 'event' && p.event?.startsAt && p.status === 'active')) {
    const pool = activeUsers.filter((u) => !u._id.equals(ev.author) && Math.abs(u.location.approx.coordinates[1] - ev.location.coordinates[1]) < 0.04);
    let going = 0; let interested = 0;
    for (const u of pool) {
      if (!chance(0.6)) continue;
      const status = chance(0.65) ? 'going' : 'interested';
      if (status === 'going') going++; else interested++;
      rsvps.push({ post: ev._id, user: u._id, status, createdAt: new Date(ev.createdAt.getTime() + rand() * 20 * 3600e3) });
    }
    await Post.updateOne({ _id: ev._id }, { 'event.going': going, 'event.interested': interested });
  }
  await Rsvp.insertMany(rsvps);
  const offers = [];
  for (const h of posts.filter((p) => p.category === 'help' && p.status === 'active')) {
    const helpers = activeUsers.filter((u) => !u._id.equals(h.author) && Math.abs(u.location.approx.coordinates[1] - h.location.coordinates[1]) < 0.04 && chance(0.3)).slice(0, 3);
    helpers.forEach((u) => offers.push({ post: h._id, user: u._id, message: pick(['I can help, sending you a message.', 'I have one you can borrow.', 'I know someone, will share their number.', '']) || undefined, createdAt: new Date(h.createdAt.getTime() + 2 * 3600e3) }));
    await Post.updateOne({ _id: h._id }, { 'help.offers': helpers.length });
  }
  await HelpOffer.insertMany(offers);
  console.log(`📅 ${rsvps.length} RSVPs · 🤝 ${offers.length} help offers`);

  /* ---- services, reviews & requests ---- */
  const SERVICES = [
    ['karim', 'Electrical repairs & wiring', 'electrician', 'Fans, lights, sockets, AC installation and short-circuit repair. Same-day visits within 3 km.', 'Visit ৳300, parts extra', '9 AM – 9 PM, every day', true],
    ['karim', 'AC servicing', 'appliance-repair', 'Gas refill, cleaning and seasonal servicing for split and window ACs.', 'From ৳1,200', '10 AM – 6 PM', false],
    ['rafiq', 'Rafiq Plumbing', 'plumber', 'Leaking taps, blocked drains, water-tank cleaning and pipe fitting.', 'Free estimate', '8 AM – 8 PM', true],
    ['anika', 'Maths coaching, Class 8–10', 'tutoring', 'Small groups of up to 6 students. SSC preparation and weekly tests.', '৳2,500 / month', 'Sun, Tue, Thu 5–7 PM', false],
    ['rina', 'Rina’s Kitchen: home catering', 'catering', 'Homemade biryani, tehari and khichuri. Party orders for up to 50 people.', 'From ৳180 per plate', 'Order by 11 AM', true],
  ];
  const services = await Service.insertMany(SERVICES.map(([who, name, category, description, priceInfo, hours, verified]) => {
    const u = byFirst(who);
    return { provider: u._id, name, category, description, priceInfo, hours, verified, location: u.location.approx, areaName: u.location.areaName, createdAt: ago(10 + rand() * 3), updatedAt: new Date() };
  }));
  const REVIEW_TEXT = { 5: ['Excellent, quick and tidy work.', 'Came on time and fixed it properly. Highly recommend.', 'Very honest pricing.'], 4: ['Good job, slightly late.', 'Reliable, would call again.'], 3: ['Fine, but took two visits.'] };
  const reviews = [];
  for (const sv of services) {
    const near = activeUsers.filter((u) => !u._id.equals(sv.provider) && Math.abs(u.location.approx.coordinates[1] - sv.location.coordinates[1]) < 0.04);
    for (const u of near.filter(() => chance(0.55))) {
      const rating = pick([5, 5, 5, 4, 4, 3]);
      reviews.push({ service: sv._id, author: u._id, rating, text: pick(REVIEW_TEXT[rating]), createdAt: ago(rand() * 9) });
    }
  }
  await Review.insertMany(reviews);
  for (const sv of services) {
    const mine = reviews.filter((v) => v.service.equals(sv._id));
    await Service.updateOne({ _id: sv._id }, { ratingCount: mine.length, ratingAvg: mine.length ? mine.reduce((a, v) => a + v.rating, 0) / mine.length : 0 });
  }
  const svc = (name) => services.find((x) => x.name.startsWith(name));
  await ServiceRequest.insertMany([
    { service: svc('Electrical')._id, requester: byFirst('rahim')._id, provider: byFirst('karim')._id, details: 'Ceiling fan in the bedroom makes a grinding noise and slows down.', preferredTime: 'Tomorrow evening', status: 'pending', createdAt: ago(0.3) },
    { service: svc('Rafiq')._id, requester: byFirst('sadia')._id, provider: byFirst('rafiq')._id, details: 'Kitchen sink drain is completely blocked.', preferredTime: 'Any time today', status: 'accepted', providerNote: 'Coming at 4 PM with tools.', createdAt: ago(1.2) },
    { service: svc('Maths')._id, requester: byFirst('farhana')._id, provider: byFirst('anika')._id, details: 'My son is in Class 9 and needs help with algebra before SSC.', preferredTime: 'Weekday evenings', status: 'done', createdAt: ago(6) },
    { service: svc('Electrical')._id, requester: byFirst('mehedi')._id, provider: byFirst('karim')._id, details: 'Two sockets in the living room stopped working.', status: 'declined', providerNote: 'Fully booked this week, sorry!', createdAt: ago(3) },
  ]);
  console.log(`🛠  ${services.length} services · ⭐ ${reviews.length} reviews · 4 service requests`);

  /* ---- conversations ---- */
  const CHATS = [
    ['rahim', 'mehedi', [['rahim', 'Hi! Is the bicycle still available?'], ['mehedi', 'Yes it is. Want to see it this evening?'], ['rahim', 'Perfect, around 6?'], ['mehedi', 'Sure, Road 8, house 12. See you then.']]],
    ['sadia', 'rafiq', [['sadia', 'Thanks for accepting. The building gate code is 2741.'], ['rafiq', 'Noted, I’ll be there at 4.']]],
    ['farhana', 'tanvir', [['farhana', 'Is the lake cleanup still on if it rains?'], ['tanvir', 'Light rain is fine. If it storms we’ll move it to Sunday and post an update.']]],
    ['karim', 'rahim', [['karim', 'Got your request about the fan. I can come tomorrow at 7 PM.']]],
  ];
  for (const [a, b, lines] of CHATS) {
    const ua = byFirst(a); const ub = byFirst(b);
    const conv = await Conversation.create({ key: [String(ua._id), String(ub._id)].sort().join(':'), members: [ua._id, ub._id] });
    const start = ago(0.2 + rand() * 1.5);
    const msgs = await Message.insertMany(lines.map(([who, body], i) => ({ conversation: conv._id, sender: byFirst(who)._id, body, createdAt: new Date(start.getTime() + i * 7 * 60e3) })));
    const last = msgs.at(-1);
    const otherOfLast = last.sender.equals(ua._id) ? ub._id : ua._id;
    await Conversation.updateOne({ _id: conv._id }, { lastMessage: { text: last.body, sender: last.sender, at: last.createdAt }, unread: { [String(otherOfLast)]: 1 } });
  }
  console.log(`✉️  ${CHATS.length} conversations`);

  /* ---- an active emergency alert + notifications ---- */
  const alertAt = ago(0.08);
  const alert = await Alert.create({
    createdBy: mod._id, title: 'Water main burst on Road 27', severity: 'high', place: 'Road 27, near the mosque',
    message: 'WASA is repairing a burst main. Expect low water pressure until about 8 PM and avoid the flooded section of the road.',
    location: mod.location.approx, areaName: mod.location.areaName, radiusKm: 4, expiresAt: new Date(Date.now() + 10 * 3600e3), createdAt: alertAt,
  });
  const inRange = activeUsers.filter((u) => !u._id.equals(mod._id) && Math.abs(u.location.approx.coordinates[1] - alert.location.coordinates[1]) < 0.03);
  await Alert.updateOne({ _id: alert._id }, { notified: inRange.length });
  const notes = inRange.map((u) => ({ user: u._id, actor: mod._id, type: 'alert', ref: alert._id, link: '/alerts', message: `⚠ ${alert.title}`, createdAt: alertAt, updatedAt: alertAt }));
  for (const c of allComments.filter((x) => x.createdAt > ago(3) && !x.text.startsWith('You are all idiots'))) {
    const p = [...posts, ...sharePosts].find((x) => x._id.equals(c.post));
    if (!p || p.author.equals(c.author)) continue;
    const actor = users.find((u) => u._id.equals(c.author));
    notes.push({ user: p.author, actor: c.author, type: c.parent ? 'reply' : 'comment', ref: c._id, link: `/post/${p._id}`, message: `${actor.name} commented on your post: “${c.text.slice(0, 50)}”`, read: chance(0.4), createdAt: c.createdAt, updatedAt: c.createdAt });
  }
  notes.push({ user: byFirst('karim')._id, actor: byFirst('rahim')._id, type: 'service_request', link: '/services?tab=requests', message: 'Rahim Ahmed requested “Electrical repairs & wiring”', createdAt: ago(0.3), updatedAt: ago(0.3) });
  await Notification.insertMany(notes);
  console.log(`🚨 1 active alert · 🔔 ${notes.length} notifications`);

  /* ---- audit trail ---- */
  const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
  const actor = admin?._id ?? mod._id;
  const events = [];
  const ev = (type, user, at, extra = {}) => events.push({ type, user: user._id, createdAt: at, ip: `103.${Math.floor(rand() * 200)}.${Math.floor(rand() * 250)}.${Math.floor(rand() * 250)}`, userAgent: pick(['Chrome on macOS', 'Safari on iOS', 'Chrome on Android', 'Firefox on Windows']), ...extra });
  for (const u of users) {
    ev('register', u, u.createdAt);
    if (u.emailVerified) { ev('email_verified', u, new Date(u.createdAt.getTime() + 600e3)); ev('location_updated', u, new Date(u.createdAt.getTime() + 900e3)); }
    for (let i = 0; i < 2 + Math.floor(rand() * 4); i++) ev('login', u, ago(rand() * 10));
  }
  ev('login_failed', byFirst('sumon'), ago(1.2)); ev('login_failed', byFirst('sumon'), ago(1.19)); ev('account_locked', byFirst('sumon'), ago(1.18));
  ev('role_changed', mod, ago(9), { actor, meta: { from: 'resident', to: 'moderator' } });
  ev('post_removed', byFirst('jamal'), ago(3.5), { actor: mod._id, meta: { reason: 'Scam / fraudulent listing' } });
  ev('post_hidden', byFirst('mehedi'), ago(5.3), { actor: mod._id, meta: { reason: 'Harassment / incitement' } });
  ev('suspended', byFirst('jamal'), ago(3.4), { actor, meta: { reason: 'Repeated scam posts' } });
  ev('report_handled', mod, ago(3.5), { actor: mod._id, meta: { action: 'remove' } });
  ev('password_changed', byFirst('rahim'), ago(2));
  await AuditEvent.insertMany(events);
  console.log(`🧾 ${events.length} audit events`);

  console.log(`\n✅ Demo data ready. Sign in as any demo user with password: ${PASSWORD}`);
  console.log(`   Moderator: tanvir${DEMO_DOMAIN}   Provider: karim${DEMO_DOMAIN}   Resident: rahim${DEMO_DOMAIN}`);
} catch (err) {
  console.error('❌ Seeding failed:', err);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
