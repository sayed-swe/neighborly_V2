import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, startDB, stopDB, clearDB, createVerifiedUser } from './setup.js';
import { hasProfanity, PROFANITY_MESSAGE } from '../src/utils/profanity.js';

describe('profanity filter', () => {
  it('blocks English, Banglish and Bangla abuse, including common disguises', () => {
    for (const t of [
      'fuck this', 'F4CK you', 'fuuuuck', 'f.u.c.k', 'f u c k off', '$hit happens', 'you BITCH', 'motherfucker',
      'tui ekta khanki', 'madarchod', 'kuttar baccha', 'খানকি', 'চুদি', 'বোকাচোদা', 'কুত্তার বাচ্চা', 'খান‌কি',
    ]) expect(hasProfanity(t), t).toBe(true);
  });

  it('allows ordinary text that only looks similar', () => {
    for (const t of [
      'Selling a classic bicycle', 'Scunthorpe United', 'shiitake mushrooms', 'assistant needed', 'Pass the class',
      'Fukushima trip', 'Road 5, House 14', 'I am 100% sure', 'Email me at a@b.com', 'চোদ্দ তারিখে মিটিং', 'বালতি বিক্রি হবে', '',
    ]) expect(hasProfanity(t), t).toBe(false);
  });
});

describe('profanity on the API', () => {
  beforeAll(startDB);
  afterAll(stopDB);
  beforeEach(clearDB);

  const auth = (u) => ({ Authorization: `Bearer ${u.accessToken}` });
  async function member(email) {
    const u = await createVerifiedUser({ email, name: 'Test Member' });
    await request(app).put('/api/users/me/location').set(auth(u)).send({ lat: 23.7561, lng: 90.3742, areaName: 'Dhanmondi', radiusKm: 3 }).expect(200);
    return u;
  }

  it('rejects offensive posts and comments with a field message, and accepts clean ones', async () => {
    const a = await member('a@example.com');
    const bad = await request(app).post('/api/posts').set(auth(a)).send({ text: 'what the fuck is this' });
    expect(bad.status).toBe(422);
    expect(bad.body.error.fields.text).toBe(PROFANITY_MESSAGE);

    const badTitle = await request(app).post('/api/posts').set(auth(a)).send({ category: 'sale', title: 'khanki chair', price: 100 });
    expect(badTitle.status).toBe(422);
    expect(badTitle.body.error.fields.title).toBe(PROFANITY_MESSAGE);

    const ok = await request(app).post('/api/posts').set(auth(a)).send({ text: 'Lost a classic black umbrella near the lake' });
    expect(ok.status).toBe(201);

    const c = await request(app).post(`/api/posts/${ok.body.post.id}/comments`).set(auth(a)).send({ text: 'তুই একটা হারামজাদা' });
    expect(c.status).toBe(422);
    expect(c.body.error.fields.text).toBe(PROFANITY_MESSAGE);
  });

  it('rejects offensive private messages and profile bios', async () => {
    const a = await member('a@example.com');
    const b = await member('b@example.com');
    const conv = await request(app).post('/api/conversations').set(auth(a)).send({ userId: b.user.id }).expect(201);
    const m = await request(app).post(`/api/conversations/${conv.body.id}/messages`).set(auth(a)).send({ body: 'sh1t' });
    expect(m.status).toBe(422);
    await request(app).post(`/api/conversations/${conv.body.id}/messages`).set(auth(a)).send({ body: 'Is the bicycle still available?' }).expect(201);

    const bio = await request(app).patch('/api/users/me').set(auth(a)).send({ bio: 'bitch please' });
    expect(bio.status).toBe(422);
    expect(bio.body.error.fields.bio).toBe(PROFANITY_MESSAGE);
  });
});
