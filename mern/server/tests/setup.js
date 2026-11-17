import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { connectDB } from '../src/config/db.js';
import { createApp } from '../src/app.js';
import { outbox } from '../src/utils/mailer.js';

let mongo;
export const app = createApp();
export const ORIGIN = 'http://localhost:5173';

export async function startDB() {
  mongo = await MongoMemoryServer.create();
  await connectDB(mongo.getUri('neighborly-test'));
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}
export async function stopDB() {
  await mongoose.disconnect();
  await mongo?.stop();
}
export async function clearDB() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  outbox.length = 0;
}

/** Extracts a token from the last email sent to `to`. */
export function tokenFromEmail(to, path) {
  const msg = [...outbox].reverse().find((m) => m.to === to && m.text.includes(path));
  return msg?.text.match(new RegExp(`${path}\\?token=([\\w-]+)`))?.[1];
}

export const cookieFrom = (res) => res.headers['set-cookie']?.find((c) => c.startsWith('nb_rt='))?.split(';')[0];

export const PASSWORD = 'correct-horse-42';

/** Registers + verifies a user; returns { user, accessToken, cookie }. */
export async function createVerifiedUser(overrides = {}) {
  const body = { name: 'Rahim Ahmed', email: 'rahim@example.com', password: PASSWORD, role: 'resident', acceptTerms: true, ...overrides };
  await request(app).post('/api/auth/register').send(body).expect(201);
  const token = tokenFromEmail(body.email, '/verify-email');
  const res = await request(app).post('/api/auth/verify-email').set('Origin', ORIGIN).send({ token }).expect(200);
  return { user: res.body.user, accessToken: res.body.accessToken, cookie: cookieFrom(res) };
}
