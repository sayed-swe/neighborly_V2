import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, startDB, stopDB, clearDB, createVerifiedUser } from './setup.js';
import { User } from '../src/modules/users/user.model.js';

beforeAll(startDB);
afterAll(stopDB);
beforeEach(clearDB);

const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function makeAdmin() {
  const admin = await createVerifiedUser({ name: 'Admin User', email: 'admin@example.com' });
  await User.updateOne({ email: 'admin@example.com' }, { role: 'admin' });
  return admin;
}

describe('role-based access control', () => {
  it('residents cannot reach admin endpoints', async () => {
    const { accessToken } = await createVerifiedUser();
    expect((await request(app).get('/api/admin/users').set(auth(accessToken))).status).toBe(403);
    expect((await request(app).get('/api/admin/stats').set(auth(accessToken))).status).toBe(403);
  });

  it('admins can promote a user and the change applies immediately', async () => {
    const admin = await makeAdmin();
    const resident = await createVerifiedUser();
    const res = await request(app).patch(`/api/admin/users/${resident.user.id}/role`).set(auth(admin.accessToken)).send({ role: 'moderator' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('moderator');
    // old token (with old role) is invalidated
    expect((await request(app).get('/api/auth/me').set(auth(resident.accessToken))).status).toBe(401);
  });

  it('moderators can list users but not change roles', async () => {
    const mod = await createVerifiedUser({ email: 'mod@example.com' });
    await User.updateOne({ email: 'mod@example.com' }, { role: 'moderator' });
    const other = await createVerifiedUser({ email: 'other@example.com' });
    expect((await request(app).get('/api/admin/users').set(auth(mod.accessToken))).status).toBe(200);
    expect((await request(app).patch(`/api/admin/users/${other.user.id}/role`).set(auth(mod.accessToken)).send({ role: 'admin' })).status).toBe(403);
  });

  it('admins cannot modify themselves (no self-demotion lockout)', async () => {
    const admin = await makeAdmin();
    const res = await request(app).patch(`/api/admin/users/${admin.user.id}/role`).set(auth(admin.accessToken)).send({ role: 'resident' });
    expect(res.status).toBe(403);
  });

  it('suspending a user kills their access immediately', async () => {
    const admin = await makeAdmin();
    const victim = await createVerifiedUser();
    await request(app).patch(`/api/admin/users/${victim.user.id}/status`).set(auth(admin.accessToken)).send({ status: 'suspended' }).expect(200);
    expect((await request(app).get('/api/auth/me').set(auth(victim.accessToken))).status).toBe(401);
    const login = await request(app).post('/api/auth/login').send({ email: 'rahim@example.com', password: 'correct-horse-42' });
    expect(login.status).toBe(403);
  });

  it('a user cannot escalate their own role via profile update', async () => {
    const { accessToken } = await createVerifiedUser();
    const res = await request(app).patch('/api/users/me').set(auth(accessToken)).send({ role: 'admin' });
    expect(res.status).toBe(422);
  });
});

describe('location privacy', () => {
  it('never returns the exact home location', async () => {
    const { accessToken } = await createVerifiedUser();
    const res = await request(app).put('/api/users/me/location').set(auth(accessToken))
      .send({ lat: 23.780887, lng: 90.407143, areaName: 'Gulshan, Dhaka', radiusKm: 3 });
    expect(res.status).toBe(200);
    expect(res.body.user.location.home).toBeUndefined();
    const [lng, lat] = res.body.user.location.approx.coordinates;
    expect([lng, lat]).not.toEqual([90.407143, 23.780887]);
    expect(Math.abs(lat - 23.780887)).toBeLessThan(0.005);
    expect(res.body.user.onboardingComplete).toBe(true);
  });

  it('counts neighbours within radius', async () => {
    const a = await createVerifiedUser();
    const b = await createVerifiedUser({ email: 'b@example.com' });
    const set = (t, lat, lng) => request(app).put('/api/users/me/location').set(auth(t)).send({ lat, lng, areaName: 'Somewhere', radiusKm: 2 });
    await set(a.accessToken, 23.78, 90.41);
    await set(b.accessToken, 23.79, 90.41); // ~1.1 km away
    const res = await request(app).get('/api/users/me/nearby-count').set(auth(a.accessToken));
    expect(res.body.count).toBe(1);
  });
});
