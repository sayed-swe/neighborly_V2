import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, startDB, stopDB, clearDB, createVerifiedUser } from './setup.js';
import { User } from '../src/modules/users/user.model.js';

beforeAll(startDB);
afterAll(stopDB);
beforeEach(clearDB);

const auth = (u) => ({ Authorization: `Bearer ${u.accessToken}` });
const HOME = { lat: 23.7561, lng: 90.3742 };
const FAR = { lat: 22.3569, lng: 91.7832 };
async function member(email, { where = HOME, role } = {}) {
  const u = await createVerifiedUser({ email, name: `${email.split('@')[0].replace(/\W/g, '')} Test` });
  await request(app).put('/api/users/me/location').set(auth(u)).send({ ...where, areaName: 'Dhanmondi', radiusKm: 3 }).expect(200);
  if (role) await User.updateOne({ email }, { role });
  return u;
}
const post = (u, body) => request(app).post('/api/posts').set(auth(u)).send(body);
const inDays = (d) => new Date(Date.now() + d * 864e5).toISOString();

describe('typed posts', () => {
  it('requires the right details per type and rejects them on the wrong type', async () => {
    const a = await member('a@example.com');
    expect((await post(a, { category: 'sale', text: 'bike' })).status).toBe(422); // no title
    expect((await post(a, { category: 'lost-found', title: 'Keys' })).status).toBe(422); // no lost details
    expect((await post(a, { category: 'event', title: 'Cleanup', event: { startsAt: inDays(-2), place: 'Lake' } })).status).toBe(422); // in the past
    expect((await post(a, { category: 'news', text: 'x', lost: { kind: 'lost', place: 'Road 5' } })).status).toBe(422);
    const sale = await post(a, { category: 'sale', title: 'Bicycle', text: 'Good', price: 4500, listing: { kind: 'sell', condition: 'good' } });
    expect(sale.status).toBe(201);
    expect(sale.body.post.listing).toMatchObject({ kind: 'sell', condition: 'good', status: 'available' });
  });

  it('lets only the owner mark items sold / reunited / resolved', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    const { body: { post: p } } = await post(a, { category: 'sale', title: 'Lamp', price: 1200 });
    expect((await request(app).patch(`/api/posts/${p.id}/state`).set(auth(b)).send({ state: 'sold' })).status).toBe(403);
    expect((await request(app).patch(`/api/posts/${p.id}/state`).set(auth(a)).send({ state: 'reunited' })).status).toBe(400);
    const ok = await request(app).patch(`/api/posts/${p.id}/state`).set(auth(a)).send({ state: 'sold' });
    expect(ok.body.post.listing.status).toBe('sold');
    expect((await request(app).get('/api/posts?category=sale&state=available').set(auth(b))).body.posts).toHaveLength(0);
  });
});

describe('events', () => {
  it('counts RSVPs, switches status, and enforces capacity', async () => {
    const host = await member('host@example.com');
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    const { body: { post: e } } = await post(host, { category: 'event', title: 'Cricket', event: { startsAt: inDays(2), place: 'Field', capacity: 1 } });
    let r = await request(app).put(`/api/posts/${e.id}/rsvp`).set(auth(a)).send({ status: 'interested' });
    expect(r.body).toMatchObject({ going: 0, interested: 1, myRsvp: 'interested' });
    r = await request(app).put(`/api/posts/${e.id}/rsvp`).set(auth(a)).send({ status: 'going' });
    expect(r.body).toMatchObject({ going: 1, interested: 0 });
    r = await request(app).put(`/api/posts/${e.id}/rsvp`).set(auth(b)).send({ status: 'going' });
    expect(r.status).toBe(409); // full
    r = await request(app).delete(`/api/posts/${e.id}/rsvp`).set(auth(a));
    expect(r.body.going).toBe(0);
    const upcoming = await request(app).get('/api/posts?category=event&when=upcoming').set(auth(b));
    expect(upcoming.body.posts[0].event.place).toBe('Field');
  });
});

describe('help offers', () => {
  it('lets neighbours offer once, not on their own request, and only the asker sees who offered', async () => {
    const asker = await member('asker@example.com');
    const helper = await member('helper@example.com');
    const nosy = await member('nosy@example.com');
    const { body: { post: h } } = await post(asker, { category: 'help', text: 'Need a ladder' });
    expect((await request(app).post(`/api/posts/${h.id}/offers`).set(auth(asker)).send({})).status).toBe(400);
    expect((await request(app).post(`/api/posts/${h.id}/offers`).set(auth(helper)).send({ message: 'I have one' })).status).toBe(201);
    expect((await request(app).post(`/api/posts/${h.id}/offers`).set(auth(helper)).send({})).status).toBe(409);
    expect((await request(app).get(`/api/posts/${h.id}/offers`).set(auth(nosy))).status).toBe(403);
    const list = await request(app).get(`/api/posts/${h.id}/offers`).set(auth(asker));
    expect(list.body.offers[0].message).toBe('I have one');
    await new Promise((r) => setTimeout(r, 50)); // notifications are written fire-and-forget
    const notes = await request(app).get('/api/notifications').set(auth(asker));
    expect(notes.body.notifications.some((n) => n.type === 'help_offer')).toBe(true);
  });
});

describe('services', () => {
  it('only providers can list; one review per member; no self-reviews; rating is averaged', async () => {
    const resident = await member('r@example.com');
    const pro = await member('pro@example.com', { role: 'provider' });
    const other = await member('o@example.com');
    expect((await request(app).post('/api/services').set(auth(resident)).send({ name: 'Fake', category: 'plumber' })).status).toBe(403);
    const s = (await request(app).post('/api/services').set(auth(pro)).send({ name: 'Rafiq Plumbing', category: 'plumber', priceInfo: 'From ৳500' })).body.service;
    expect(s.verified).toBe(false);
    expect((await request(app).post(`/api/services/${s.id}/reviews`).set(auth(pro)).send({ rating: 5 })).status).toBe(400);
    await request(app).post(`/api/services/${s.id}/reviews`).set(auth(resident)).send({ rating: 5, text: 'Great' }).expect(201);
    await request(app).post(`/api/services/${s.id}/reviews`).set(auth(resident)).send({ rating: 4, text: 'Updated' }).expect(201); // upsert
    const r = await request(app).post(`/api/services/${s.id}/reviews`).set(auth(other)).send({ rating: 2 });
    expect(r.body).toEqual({ rating: 3, ratingCount: 2 });
    expect((await request(app).get('/api/services').set(auth(resident))).body.services).toHaveLength(1);
  });

  it('runs a service request through its allowed steps only', async () => {
    const pro = await member('pro@example.com', { role: 'provider' });
    const cust = await member('c@example.com');
    const s = (await request(app).post('/api/services').set(auth(pro)).send({ name: 'Karim Electric', category: 'electrician' })).body.service;
    const req1 = (await request(app).post(`/api/services/${s.id}/requests`).set(auth(cust)).send({ details: 'Fan not working', preferredTime: 'Evening' })).body;
    expect((await request(app).post(`/api/services/${s.id}/requests`).set(auth(cust)).send({ details: 'Again please' })).status).toBe(409);
    expect((await request(app).patch(`/api/services/requests/${req1.id}`).set(auth(cust)).send({ status: 'accepted' })).status).toBe(400); // customer can't accept
    expect((await request(app).patch(`/api/services/requests/${req1.id}`).set(auth(pro)).send({ status: 'done' })).status).toBe(400); // must accept first
    await request(app).patch(`/api/services/requests/${req1.id}`).set(auth(pro)).send({ status: 'accepted', note: 'Coming at 6' }).expect(200);
    const mine = await request(app).get('/api/services/requests?box=outgoing').set(auth(cust));
    expect(mine.body.requests[0]).toMatchObject({ status: 'accepted', providerNote: 'Coming at 6' });
  });

  it('only admins can verify a provider', async () => {
    const pro = await member('pro@example.com', { role: 'provider' });
    const mod = await member('mod@example.com', { role: 'moderator' });
    const admin = await member('admin@example.com', { role: 'admin' });
    const s = (await request(app).post('/api/services').set(auth(pro)).send({ name: 'Tutor', category: 'tutoring' })).body.service;
    expect((await request(app).patch(`/api/admin/services/${s.id}`).set(auth(mod)).send({ verified: true })).status).toBe(403);
    expect((await request(app).patch(`/api/admin/services/${s.id}`).set(auth(admin)).send({ verified: true })).body.verified).toBe(true);
  });
});

describe('messages', () => {
  it('keeps conversations private to their two members and tracks unread counts', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    const eve = await member('eve@example.com');
    const c = (await request(app).post('/api/conversations').set(auth(a)).send({ userId: b.user.id })).body;
    const again = (await request(app).post('/api/conversations').set(auth(b)).send({ userId: a.user.id })).body;
    expect(again.id).toBe(c.id); // same thread both ways
    expect((await request(app).post('/api/conversations').set(auth(a)).send({ userId: a.user.id })).status).toBe(400);
    await request(app).post(`/api/conversations/${c.id}/messages`).set(auth(a)).send({ body: 'Is the bicycle available?' }).expect(201);
    expect((await request(app).get('/api/conversations/unread-count').set(auth(b))).body.count).toBe(1);
    expect((await request(app).get(`/api/conversations/${c.id}/messages`).set(auth(eve))).status).toBe(404);
    expect((await request(app).post(`/api/conversations/${c.id}/messages`).set(auth(eve)).send({ body: 'hi' })).status).toBe(404);
    const thread = await request(app).get(`/api/conversations/${c.id}/messages`).set(auth(b));
    expect(thread.body.messages[0]).toMatchObject({ body: 'Is the bicycle available?', mine: false });
    await request(app).post(`/api/conversations/${c.id}/read`).set(auth(b)).expect(204);
    expect((await request(app).get('/api/conversations/unread-count').set(auth(b))).body.count).toBe(0);
  });

  it('tells the sender when the other member has read the thread, and only the sender', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    const c = (await request(app).post('/api/conversations').set(auth(a)).send({ userId: b.user.id })).body;
    await request(app).post(`/api/conversations/${c.id}/messages`).set(auth(a)).send({ body: 'Still selling the lamp?' }).expect(201);
    expect((await request(app).get(`/api/conversations/${c.id}/messages`).set(auth(a))).body.seenAt).toBeNull();
    await request(app).post(`/api/conversations/${c.id}/read`).set(auth(b)).expect(204);
    const forA = (await request(app).get(`/api/conversations/${c.id}/messages`).set(auth(a))).body;
    expect(new Date(forA.seenAt) >= new Date(forA.messages[0].createdAt)).toBe(true);
    // b's own view reports a's reading, not b's
    expect((await request(app).get(`/api/conversations/${c.id}/messages`).set(auth(b))).body.seenAt).toBeNull();
  });
});

describe('emergency alerts & notifications', () => {
  it('only moderators broadcast; people in range are notified, people far away are not', async () => {
    const resident = await member('r@example.com');
    const near = await member('near@example.com');
    const far = await member('far@example.com', { where: FAR });
    const mod = await member('mod@example.com', { role: 'moderator' });
    const body = { title: 'Fire at Road 4 market', message: 'Avoid the area, fire service on site', severity: 'critical', radiusKm: 3 };
    expect((await request(app).post('/api/alerts').set(auth(resident)).send(body)).status).toBe(403);
    const sent = await request(app).post('/api/alerts').set(auth(mod)).send(body);
    expect(sent.status).toBe(201);
    expect(sent.body.alert.notified).toBe(2); // resident + near, not far, not the sender
    expect((await request(app).get('/api/notifications/unread-count').set(auth(near))).body.count).toBe(1);
    expect((await request(app).get('/api/notifications/unread-count').set(auth(far))).body.count).toBe(0);
    expect((await request(app).get('/api/alerts').set(auth(near))).body.alerts).toHaveLength(1);
    expect((await request(app).get('/api/alerts').set(auth(far))).body.alerts).toHaveLength(0);
    await request(app).patch(`/api/alerts/${sent.body.alert.id}/resolve`).set(auth(mod)).expect(200);
    expect((await request(app).get('/api/alerts').set(auth(near))).body.alerts).toHaveLength(0);
  });

  it('notifies on comments but never for your own actions, and read state is per owner', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    const { body: { post: p } } = await post(a, { text: 'Hello' });
    await request(app).post(`/api/posts/${p.id}/comments`).set(auth(a)).send({ text: 'my own comment' });
    await request(app).post(`/api/posts/${p.id}/comments`).set(auth(b)).send({ text: 'Nice' });
    await new Promise((r) => setTimeout(r, 50));
    const list = (await request(app).get('/api/notifications').set(auth(a))).body.notifications;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ type: 'comment', read: false, link: `/post/${p.id}` });
    await request(app).post(`/api/notifications/${list[0].id}/read`).set(auth(b)).expect(204); // someone else's: no effect
    expect((await request(app).get('/api/notifications/unread-count').set(auth(a))).body.count).toBe(1);
  });
});

describe('map & profiles', () => {
  it('returns nearby pins with approximate coordinates only, and public profiles without private fields', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    await post(a, { category: 'sale', title: 'Desk', price: 3000 });
    const map = await request(app).get('/api/map').set(auth(b));
    expect(map.body.items[0]).toMatchObject({ kind: 'sale', title: 'Desk' });
    expect(map.body.items[0].lat).not.toBe(23.7561);
    const prof = await request(app).get(`/api/users/${a.user.id}/profile`).set(auth(b));
    expect(prof.body.profile.stats.posts).toBe(1);
    expect(JSON.stringify(prof.body)).not.toMatch(/email|home|coordinates/);
  });
});
