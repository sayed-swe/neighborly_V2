import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, startDB, stopDB, clearDB, createVerifiedUser } from './setup.js';
import { User } from '../src/modules/users/user.model.js';
import { Post } from '../src/modules/posts/models.js';

beforeAll(startDB);
afterAll(stopDB);
beforeEach(clearDB);

const auth = (u) => ({ Authorization: `Bearer ${u.accessToken}` });
const DHANMONDI = { lat: 23.7561, lng: 90.3742 };
const FAR = { lat: 22.3569, lng: 91.7832 }; // Chattogram

async function member(email, where = DHANMONDI, name = 'Test User') {
  const u = await createVerifiedUser({ email, name });
  await request(app).put('/api/users/me/location').set(auth(u)).send({ ...where, areaName: 'Somewhere', radiusKm: 3 }).expect(200);
  return u;
}
const post = (u, body = { text: 'Hello neighbours' }) => request(app).post('/api/posts').set(auth(u)).send(body);
const feed = (u, qs = '') => request(app).get(`/api/posts${qs}`).set(auth(u));

describe('posting & feed', () => {
  it('requires a home area before posting', async () => {
    const u = await createVerifiedUser();
    const res = await post(u);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_LOCATION');
  });

  it('only shows posts inside the viewer’s radius', async () => {
    const a = await member('a@example.com');
    const near = await member('b@example.com');
    const far = await member('c@example.com', FAR);
    await post(a, { text: 'Water cut tomorrow', category: 'news' }).expect(201);
    expect((await feed(near)).body.posts).toHaveLength(1);
    expect((await feed(far)).body.posts).toHaveLength(0);
    expect((await feed(a, '?mine=1')).body.posts).toHaveLength(1);
  });

  it('never exposes exact coordinates, and reports a rounded distance', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com', { lat: 23.7651, lng: 90.3742 });
    await post(a).expect(201);
    const res = await feed(b);
    const p = res.body.posts[0];
    expect(JSON.stringify(p)).not.toMatch(/coordinates|location/);
    expect(p.distanceKm).toBeGreaterThan(0.5);
    expect(p.distanceKm).toBeLessThan(1.5);
  });

  it('rejects mass-assignment, empty posts and foreign image URLs', async () => {
    const a = await member('a@example.com');
    expect((await post(a, { text: 'x', author: '000000000000000000000000' })).status).toBe(422);
    expect((await post(a, { text: 'x', reactionTotal: 999 })).status).toBe(422);
    expect((await post(a, { text: '   ' })).status).toBe(422);
    expect((await post(a, { text: 'x', price: 100 })).status).toBe(422); // price only for sale
    expect((await post(a, { text: 'x', images: ['https://evil.example/a.jpg'] })).status).toBe(422);
    expect((await post(a, { text: 'x', images: ['/api/uploads/../../etc/passwd'] })).status).toBe(422);
  });

  it('paginates with a cursor without repeating posts', async () => {
    const a = await member('a@example.com');
    for (let i = 0; i < 5; i++) await post(a, { text: `post ${i}` });
    const first = await feed(a, '?limit=3');
    expect(first.body.posts).toHaveLength(3);
    const second = await feed(a, `?limit=3&before=${first.body.next}`);
    expect(second.body.posts).toHaveLength(2);
    expect(second.body.next).toBeNull();
    const ids = [...first.body.posts, ...second.body.posts].map((p) => p.id);
    expect(new Set(ids).size).toBe(5);
  });
});

describe('suspension', () => {
  it('hides a suspended member’s posts from everyone’s feed', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    await post(a, { text: 'visible for now' }).expect(201);
    expect((await feed(b)).body.posts).toHaveLength(1);
    await User.updateOne({ email: 'a@example.com' }, { status: 'suspended' });
    expect((await feed(b)).body.posts).toHaveLength(0);
  });
});

describe('reactions', () => {
  it('toggles, switches and removes reactions with correct counts', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    const { body: { post: p } } = await post(a);
    const react = (u, type) => request(app).put(`/api/posts/${p.id}/reaction`).set(auth(u)).send({ type });

    let res = await react(a, 'like');
    expect(res.body).toMatchObject({ reactionTotal: 1, myReaction: 'like' });
    res = await react(a, 'like'); // idempotent
    expect(res.body.reactionTotal).toBe(1);
    res = await react(a, 'love'); // switch
    expect(res.body.reactionTotal).toBe(1);
    expect(res.body.reactions).toMatchObject({ like: 0, love: 1 });
    res = await react(b, 'like');
    expect(res.body.reactionTotal).toBe(2);
    res = await request(app).delete(`/api/posts/${p.id}/reaction`).set(auth(a));
    expect(res.body).toMatchObject({ reactionTotal: 1, myReaction: null });
    expect((await react(a, 'bogus')).status).toBe(422);
  });

  it('survives many simultaneous likes from the same user', async () => {
    const a = await member('a@example.com');
    const { body: { post: p } } = await post(a);
    await Promise.all(Array.from({ length: 8 }, () => request(app).put(`/api/posts/${p.id}/reaction`).set(auth(a)).send({ type: 'like' })));
    const after = (await feed(a)).body.posts[0];
    expect(after.reactionTotal).toBe(1);
  });
});

describe('comments', () => {
  it('adds comments and replies, keeps replies one level deep, and tracks counts', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    const { body: { post: p } } = await post(a);
    const c1 = (await request(app).post(`/api/posts/${p.id}/comments`).set(auth(b)).send({ text: 'Thanks for sharing' })).body.comment;
    const r1 = (await request(app).post(`/api/posts/${p.id}/comments`).set(auth(a)).send({ text: 'Welcome', parent: c1.id })).body.comment;
    const r2 = (await request(app).post(`/api/posts/${p.id}/comments`).set(auth(b)).send({ text: 'Reply to reply', parent: r1.id })).body.comment;
    expect(r2.parent).toBe(c1.id); // flattened

    const list = (await request(app).get(`/api/posts/${p.id}/comments`).set(auth(a))).body;
    expect(list.comments).toHaveLength(1);
    expect(list.comments[0].replies).toHaveLength(2);
    expect((await feed(a)).body.posts[0].commentCount).toBe(3);
  });

  it('lets only the author, the post owner or a moderator delete a comment', async () => {
    const owner = await member('owner@example.com');
    const commenter = await member('c@example.com');
    const stranger = await member('s@example.com');
    const { body: { post: p } } = await post(owner);
    const mk = async () => (await request(app).post(`/api/posts/${p.id}/comments`).set(auth(commenter)).send({ text: 'hi' })).body.comment;
    const c = await mk();
    expect((await request(app).delete(`/api/comments/${c.id}`).set(auth(stranger))).status).toBe(403);
    expect((await request(app).delete(`/api/comments/${c.id}`).set(auth(owner))).status).toBe(200); // post owner
    expect((await feed(owner)).body.posts[0].commentCount).toBe(0);
    const c2 = await mk();
    expect((await request(app).delete(`/api/comments/${c2.id}`).set(auth(commenter))).status).toBe(200); // author
  });

  it('rejects comments longer than 1,000 characters', async () => {
    const a = await member('a@example.com');
    const { body: { post: p } } = await post(a);
    const res = await request(app).post(`/api/posts/${p.id}/comments`).set(auth(a)).send({ text: 'x'.repeat(1001) });
    expect(res.status).toBe(422);
  });
});

describe('sharing', () => {
  it('shares to the feed, counts it, and shares of shares point to the original', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    const c = await member('c@example.com');
    const { body: { post: original } } = await post(a, { text: 'Original notice', category: 'news' });
    const s1 = (await request(app).post(`/api/posts/${original.id}/share`).set(auth(b)).send({ text: 'Please read' })).body.post;
    expect(s1.shared.text).toBe('Original notice');
    const s2 = (await request(app).post(`/api/posts/${s1.id}/share`).set(auth(c)).send({})).body.post;
    expect(s2.shared.text).toBe('Original notice');
    expect(s2.shared.id).toBe(original.id);
    expect((await request(app).get(`/api/posts/${original.id}`).set(auth(a))).body.post.shareCount).toBe(2);
  });
});

describe('ownership & moderation', () => {
  it('stops people editing or deleting other people’s posts (IDOR)', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    const { body: { post: p } } = await post(a);
    expect((await request(app).patch(`/api/posts/${p.id}`).set(auth(b)).send({ text: 'hacked' })).status).toBe(403);
    expect((await request(app).delete(`/api/posts/${p.id}`).set(auth(b))).status).toBe(403);
    expect((await request(app).patch(`/api/posts/${p.id}`).set(auth(a)).send({ text: 'edited' })).body.post.editedAt).toBeTruthy();
    expect((await request(app).delete(`/api/posts/${p.id}`).set(auth(a))).status).toBe(204);
    expect(await Post.countDocuments()).toBe(0);
  });

  it('lets a moderator hide a post so it disappears for everyone else', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    const mod = await member('mod@example.com');
    await User.updateOne({ email: 'mod@example.com' }, { role: 'moderator' });
    const { body: { post: p } } = await post(a);
    expect((await request(app).patch(`/api/admin/posts/${p.id}/status`).set(auth(b)).send({ status: 'hidden' })).status).toBe(403);
    await request(app).patch(`/api/admin/posts/${p.id}/status`).set(auth(mod)).send({ status: 'hidden', reason: 'spam' }).expect(200);
    expect((await feed(b)).body.posts).toHaveLength(0);
    expect((await request(app).get(`/api/posts/${p.id}`).set(auth(b))).status).toBe(404);
    expect((await request(app).get(`/api/posts/${p.id}`).set(auth(mod))).status).toBe(200);
  });

  it('runs the report flow: file, de-duplicate, remove from the queue', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    const mod = await member('mod@example.com');
    await User.updateOne({ email: 'mod@example.com' }, { role: 'moderator' });
    const { body: { post: p } } = await post(a, { text: 'Buy cheap followers now' });
    expect((await request(app).post(`/api/posts/${p.id}/report`).set(auth(a)).send({ reason: 'spam' })).status).toBe(400); // own post
    await request(app).post(`/api/posts/${p.id}/report`).set(auth(b)).send({ reason: 'spam', details: 'looks like a scam' }).expect(201);
    expect((await request(app).post(`/api/posts/${p.id}/report`).set(auth(b)).send({ reason: 'spam' })).status).toBe(409);

    const queue = (await request(app).get('/api/admin/reports').set(auth(mod))).body;
    expect(queue.reports).toHaveLength(1);
    expect(queue.reports[0].target.text).toBe('Buy cheap followers now');
    await request(app).patch(`/api/admin/reports/${queue.reports[0].id}`).set(auth(mod)).send({ action: 'remove' }).expect(200);
    expect((await feed(b)).body.posts).toHaveLength(0);
    expect((await request(app).get('/api/admin/reports').set(auth(mod))).body.reports).toHaveLength(0);
  });

  it('gives admins an overview and keeps it away from residents and moderators', async () => {
    const a = await member('a@example.com');
    const admin = await member('admin@example.com');
    await User.updateOne({ email: 'admin@example.com' }, { role: 'admin' });
    await post(a);
    const res = await request(app).get('/api/admin/overview').set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.totals.posts).toBe(1);
    expect(res.body.series.signups).toHaveLength(14);
    expect((await request(app).get('/api/admin/overview').set(auth(a))).status).toBe(403);
    expect((await request(app).get('/api/admin/audit').set(auth(a))).status).toBe(403);
    expect((await request(app).get('/api/admin/audit').set(auth(admin))).status).toBe(200);
  });
});

describe('image uploads', () => {
  const png = (extra) => Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.alloc(13), Buffer.alloc(4),
    ...(extra ? [Buffer.from([0, 0, 0, 12]), Buffer.from('eXIf'), Buffer.from('GPS-SECRET'.padEnd(12, '.')), Buffer.alloc(4)] : []),
    Buffer.from([0, 0, 0, 0]), Buffer.from('IEND'), Buffer.alloc(4),
  ]);
  const jpeg = () => {
    const exif = Buffer.from('Exif\0\0GPS-SECRET-LOCATION');
    const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, exif.length + 2]), exif]);
    return Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      Buffer.from([0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(14),
      app1,
      Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0, 0]), Buffer.alloc(8, 7), Buffer.from([0xff, 0xd9]),
    ]);
  };

  it('strips metadata from PNG and JPEG and serves them with safe headers', async () => {
    const a = await member('a@example.com');
    for (const [buf, name] of [[png(true), 'a.png'], [jpeg(), 'a.jpg']]) {
      const up = await request(app).post('/api/uploads').set(auth(a)).attach('image', buf, name);
      expect(up.status).toBe(201);
      const got = await request(app).get(up.body.url).buffer(true).parse((res, cb) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
      expect(got.status).toBe(200);
      expect(got.headers['x-content-type-options']).toBe('nosniff');
      expect(got.body.toString('latin1')).not.toContain('GPS-SECRET');
      // and the URL is accepted on a post
      expect((await post(a, { text: 'with photo', images: [up.body.url] })).status).toBe(201);
    }
  });

  it('rejects non-images, spoofed extensions and anonymous uploads', async () => {
    const a = await member('a@example.com');
    const fake = await request(app).post('/api/uploads').set(auth(a)).attach('image', Buffer.from('<script>alert(1)</script>'), 'x.png');
    expect(fake.status).toBe(400);
    expect((await request(app).post('/api/uploads').attach('image', png(), 'a.png')).status).toBe(401);
  });
});
