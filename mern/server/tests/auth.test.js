import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, startDB, stopDB, clearDB, tokenFromEmail, cookieFrom, createVerifiedUser, PASSWORD, ORIGIN } from './setup.js';
import { User } from '../src/modules/users/user.model.js';
import { outbox } from '../src/utils/mailer.js';

beforeAll(startDB);
afterAll(stopDB);
beforeEach(clearDB);

const login = (email = 'rahim@example.com', password = PASSWORD) =>
  request(app).post('/api/auth/login').send({ email, password });

describe('registration', () => {
  it('rejects self-assigned admin or moderator roles', async () => {
    for (const role of ['admin', 'moderator']) {
      const res = await request(app).post('/api/auth/register')
        .send({ name: 'Eve', email: 'eve@example.com', password: PASSWORD, role, acceptTerms: true });
      expect(res.status).toBe(422);
      expect(res.body.error.fields.role).toBeDefined();
    }
    expect(await User.countDocuments()).toBe(0);
  });

  it('rejects weak passwords and unknown fields', async () => {
    const weak = await request(app).post('/api/auth/register')
      .send({ name: 'Eve', email: 'eve@example.com', password: 'short', acceptTerms: true });
    expect(weak.status).toBe(422);
    const extra = await request(app).post('/api/auth/register')
      .send({ name: 'Eve', email: 'eve@example.com', password: PASSWORD, acceptTerms: true, emailVerified: true });
    expect(extra.status).toBe(422);
  });

  it('requires business details for providers', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ name: 'Karim', email: 'k@example.com', password: PASSWORD, role: 'provider', acceptTerms: true });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.businessName).toBeDefined();
  });

  it('gives the same response for new and existing emails (no enumeration)', async () => {
    await createVerifiedUser();
    const again = await request(app).post('/api/auth/register')
      .send({ name: 'Someone', email: 'rahim@example.com', password: PASSWORD, acceptTerms: true });
    expect(again.status).toBe(201);
    expect(outbox.at(-1).subject).toMatch(/tried to sign up/);
  });

  it('stores only a hash of the password', async () => {
    await createVerifiedUser();
    const u = await User.findOne({ email: 'rahim@example.com' }).select('+passwordHash');
    expect(u.passwordHash).not.toContain(PASSWORD);
    expect(u.passwordHash).toMatch(/^\$2[aby]\$/);
  });
});

describe('email verification & login', () => {
  it('blocks login until email is verified, then verifying signs in', async () => {
    await request(app).post('/api/auth/register')
      .send({ name: 'Nusrat Jahan', email: 'n@example.com', password: PASSWORD, acceptTerms: true }).expect(201);
    const blocked = await login('n@example.com');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const token = tokenFromEmail('n@example.com', '/verify-email');
    const verified = await request(app).post('/api/auth/verify-email').send({ token });
    expect(verified.status).toBe(200);
    expect(verified.body.accessToken).toBeTruthy();
    expect(verified.body.user.passwordHash).toBeUndefined();

    const reused = await request(app).post('/api/auth/verify-email').send({ token });
    expect(reused.status).toBe(400);
  });

  it('sets a hardened httpOnly refresh cookie', async () => {
    await createVerifiedUser();
    const res = await login();
    expect(res.status).toBe(200);
    const raw = res.headers['set-cookie'].find((c) => c.startsWith('nb_rt='));
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Strict/i);
    expect(raw).toMatch(/Path=\/api\/auth/);
  });

  it('uses the same error for wrong password and unknown email', async () => {
    await createVerifiedUser();
    const a = await login('rahim@example.com', 'wrong-password-1');
    const b = await login('nobody@example.com', 'wrong-password-1');
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });

  it('locks the account after 5 failed attempts', async () => {
    await createVerifiedUser();
    for (let i = 0; i < 5; i++) await login('rahim@example.com', 'wrong-password-1');
    const res = await login();
    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('rejects NoSQL operator injection', async () => {
    await createVerifiedUser();
    const res = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });
});

describe('sessions & refresh tokens', () => {
  it('rotates the refresh token and detects reuse of an old one', async () => {
    const { cookie } = await createVerifiedUser();
    const first = await request(app).post('/api/auth/refresh').set('Origin', ORIGIN).set('Cookie', cookie);
    expect(first.status).toBe(200);
    const rotated = cookieFrom(first);
    expect(rotated).not.toBe(cookie);

    // Pretend the old token is replayed long after rotation
    const { Session } = await import('../src/modules/auth/session.model.js');
    await Session.updateMany({ revokedReason: 'rotated' }, { revokedAt: new Date(Date.now() - 60_000) });
    const replay = await request(app).post('/api/auth/refresh').set('Origin', ORIGIN).set('Cookie', cookie);
    expect(replay.status).toBe(401);

    // Whole family is revoked, so the newest token is dead too
    const after = await request(app).post('/api/auth/refresh').set('Origin', ORIGIN).set('Cookie', rotated);
    expect(after.status).toBe(401);
  });

  it('rejects refresh from a foreign origin (CSRF)', async () => {
    const { cookie } = await createVerifiedUser();
    const res = await request(app).post('/api/auth/refresh').set('Origin', 'https://evil.example').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('logout revokes the refresh token', async () => {
    const { cookie } = await createVerifiedUser();
    await request(app).post('/api/auth/logout').set('Origin', ORIGIN).set('Cookie', cookie).expect(204);
    const res = await request(app).post('/api/auth/refresh').set('Origin', ORIGIN).set('Cookie', cookie);
    expect(res.status).toBe(401);
  });

  it('logout-all invalidates existing access tokens immediately', async () => {
    const { accessToken } = await createVerifiedUser();
    await request(app).post('/api/auth/logout-all').set('Authorization', `Bearer ${accessToken}`).expect(204);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(401);
  });

  it('lists devices, marks the current one, and can revoke another', async () => {
    const { cookie, accessToken } = await createVerifiedUser();
    const other = await login(); // second device
    const otherCookie = cookieFrom(other);
    const list = await request(app).get('/api/auth/sessions').set('Authorization', `Bearer ${accessToken}`).set('Cookie', cookie);
    expect(list.body.sessions).toHaveLength(2);
    const mine = list.body.sessions.find((s) => s.current);
    const theirs = list.body.sessions.find((s) => !s.current);
    expect(mine).toBeDefined();
    await request(app).delete(`/api/auth/sessions/${theirs.id}`).set('Authorization', `Bearer ${accessToken}`).expect(204);
    expect((await request(app).post('/api/auth/refresh').set('Origin', ORIGIN).set('Cookie', otherCookie)).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Origin', ORIGIN).set('Cookie', cookie)).status).toBe(200);
  });

  it("cannot revoke another user's session", async () => {
    const a = await createVerifiedUser();
    const b = await createVerifiedUser({ email: 'b@example.com' });
    const list = await request(app).get('/api/auth/sessions').set('Authorization', `Bearer ${b.accessToken}`);
    const res = await request(app).delete(`/api/auth/sessions/${list.body.sessions[0].id}`).set('Authorization', `Bearer ${a.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('rejects tampered or missing access tokens', async () => {
    const { accessToken } = await createVerifiedUser();
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const tampered = accessToken.slice(0, -2) + (accessToken.endsWith('a') ? 'bb' : 'aa');
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tampered}`)).status).toBe(401);
  });
});

describe('password reset & change', () => {
  it('resets password with a single-use token and signs out everywhere', async () => {
    const { cookie } = await createVerifiedUser();
    const generic = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    const real = await request(app).post('/api/auth/forgot-password').send({ email: 'rahim@example.com' });
    expect(generic.body).toEqual(real.body);

    const token = tokenFromEmail('rahim@example.com', '/reset-password');
    await request(app).post('/api/auth/reset-password').send({ token, password: 'brand-new-pass-77' }).expect(200);
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'another-pass-88' })).status).toBe(400);
    expect((await request(app).post('/api/auth/refresh').set('Origin', ORIGIN).set('Cookie', cookie)).status).toBe(401);
    expect((await login()).status).toBe(401);
    expect((await login('rahim@example.com', 'brand-new-pass-77')).status).toBe(200);
  });

  it('change-password requires the current password', async () => {
    const { accessToken } = await createVerifiedUser();
    const bad = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'nope-nope-123', newPassword: 'brand-new-pass-77' });
    expect(bad.status).toBe(400);
    const ok = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: PASSWORD, newPassword: 'brand-new-pass-77' });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();
  });
});
