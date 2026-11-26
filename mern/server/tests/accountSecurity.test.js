import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { app, startDB, stopDB, clearDB, createVerifiedUser, PASSWORD } from './setup.js';
import env from '../src/config/env.js';
import { outbox } from '../src/utils/mailer.js';
import { pwnedCount, PWNED_MESSAGE } from '../src/utils/pwned.js';
import { describeDevice } from '../src/utils/device.js';

const LEAKED = 'password-everyone-uses-1';
const sha1 = (s) => createHash('sha1').update(s).digest('hex').toUpperCase();

/** Fake HIBP range API that knows exactly one leaked password, plus padding rows. */
function fakePwned() {
  const h = sha1(LEAKED);
  return vi.fn(async (url) => {
    const prefix = url.split('/').pop();
    const rows = [`${'0'.repeat(35)}:0`, `${'F'.repeat(35)}:3`];
    if (prefix === h.slice(0, 5)) rows.push(`${h.slice(5)}:52341`);
    return new Response(rows.join('\r\n'));
  });
}

beforeAll(startDB);
afterAll(stopDB);
beforeEach(clearDB);
afterEach(() => { vi.unstubAllGlobals(); env.pwnedCheck = false; });

describe('breached password check', () => {
  it('sends only a 5-character hash prefix and reads the count', async () => {
    const fetchMock = fakePwned();
    vi.stubGlobal('fetch', fetchMock);
    expect(await pwnedCount(LEAKED)).toBe(52341);
    expect(await pwnedCount('a-unique-and-long-passphrase-77')).toBe(0);
    const url = fetchMock.mock.calls[0][0];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${sha1(LEAKED).slice(0, 5)}`);
    expect(url).not.toContain(LEAKED);
  });

  it('fails open when the service is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    expect(await pwnedCount(LEAKED)).toBe(0);
  });

  it('blocks a leaked password at sign-up and password change, with a field error', async () => {
    env.pwnedCheck = true;
    vi.stubGlobal('fetch', fakePwned());
    const reg = await request(app).post('/api/auth/register')
      .send({ name: 'Talbina Test', email: 'new@example.com', password: LEAKED, role: 'resident', acceptTerms: true });
    expect(reg.status).toBe(400);
    expect(reg.body.error.fields.password).toBe(PWNED_MESSAGE);

    const u = await createVerifiedUser({ email: 'talbina@example.com' });
    const change = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .send({ currentPassword: PASSWORD, newPassword: LEAKED });
    expect(change.status).toBe(400);
    expect(change.body.error.fields.newPassword).toBe(PWNED_MESSAGE);
  });
});

describe('new-device sign-in alert', () => {
  const CHROME_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const FIREFOX_ANDROID = 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0';
  const login = (ua) => request(app).post('/api/auth/login').set('User-Agent', ua).send({ email: 'talbina@example.com', password: PASSWORD });
  const alerts = () => outbox.filter((m) => m.subject === 'New sign-in to your Neighborly account');

  it('emails only when a different browser signs in', async () => {
    await createVerifiedUser({ email: 'talbina@example.com' });
    await login(CHROME_MAC).expect(200); // first password sign-in from this browser
    const before = alerts().length;

    await login(CHROME_MAC).expect(200); // same browser again: no alert
    expect(alerts().length).toBe(before);

    await login(FIREFOX_ANDROID).expect(200); // new browser: alert
    await vi.waitFor(() => expect(alerts().length).toBe(before + 1));
    expect(alerts().at(-1).text).toContain('Firefox on Android');
  });

  it('describes common devices', () => {
    expect(describeDevice(CHROME_MAC)).toBe('Chrome on macOS');
    expect(describeDevice(FIREFOX_ANDROID)).toBe('Firefox on Android');
    expect(describeDevice('')).toBe('a browser on an unknown device');
  });
});

describe('download my data', () => {
  const auth = (u) => ({ Authorization: `Bearer ${u.accessToken}` });

  it('returns only my own content as a file, with no secrets or exact home point', async () => {
    const me = await createVerifiedUser({ email: 'me@example.com', name: 'Me Test' });
    const other = await createVerifiedUser({ email: 'other@example.com', name: 'Other Test' });
    for (const u of [me, other]) {
      await request(app).put('/api/users/me/location').set(auth(u)).send({ lat: 23.7561, lng: 90.3742, areaName: 'Dhanmondi', radiusKm: 3 }).expect(200);
    }
    await request(app).post('/api/posts').set(auth(me)).send({ category: 'news', text: 'Road 5 is being repaved this week' }).expect(201);
    await request(app).post('/api/posts').set(auth(other)).send({ category: 'news', text: 'Not mine to export' }).expect(201);

    const res = await request(app).get('/api/users/me/export').set(auth(me)).expect(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="neighborly-data-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.profile).toMatchObject({ email: 'me@example.com', name: 'Me Test' });
    expect(res.body.posts.map((p) => p.text)).toEqual(['Road 5 is being repaved this week']);
    expect(res.body.sessions.length).toBeGreaterThan(0);
    const raw = JSON.stringify(res.body);
    for (const secret of ['passwordHash', 'tokenHash', 'tokenVersion', '"home"', 'emailVerifyTokenHash']) expect(raw).not.toContain(secret);
  });

  it('requires sign-in', async () => {
    expect((await request(app).get('/api/users/me/export')).status).toBe(401);
  });
});
