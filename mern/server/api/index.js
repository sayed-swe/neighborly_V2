/**
 * Vercel entry point: runs the Express API as a serverless function.
 * The app is built once per instance and the MongoDB connection is reused
 * across requests (src/index.js is still the entry for local dev and Render).
 */
import { connectDB } from '../src/config/db.js';
import { createApp } from '../src/app.js';

const app = createApp();
let ready;

export default async function handler(req, res) {
  ready ??= connectDB().catch((err) => { ready = undefined; throw err; });
  await ready;
  return app(req, res);
}
