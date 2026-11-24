/**
 * Where photos live. With Cloudinary configured (production), images go to the
 * cloud so they survive redeploys; otherwise they are written to server/uploads/
 * (development and tests). Either way the image has already had its metadata
 * stripped by sanitizeImage(), and its name is an unguessable random id.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import env from '../../config/env.js';

export const UPLOAD_DIR = path.resolve(import.meta.dirname, '../../../uploads');

const LOCAL_URL = /^\/api\/uploads\/([a-f0-9]{32})\.(jpg|png)$/;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cloudUrl = (cloud, folder) =>
  new RegExp(`^https://res\\.cloudinary\\.com/${esc(cloud)}/image/upload/v\\d+/${esc(folder)}/([a-f0-9]{32})\\.(jpg|png)$`);

/** True for photo URLs this server issued: local ones, or ones in our own Cloudinary folder. */
export function isImageUrl(url, { cloud = env.CLOUDINARY_CLOUD_NAME, folder = env.CLOUDINARY_FOLDER } = {}) {
  if (typeof url !== 'string') return false;
  return LOCAL_URL.test(url) || Boolean(cloud && cloudUrl(cloud, folder).test(url));
}

/** Cloudinary's signature: SHA-1 of the sorted params plus the API secret. */
export function signParams(params, secret) {
  const base = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  return createHash('sha1').update(base + secret).digest('hex');
}

async function saveLocal({ ext, data }, id) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, `${id}.${ext}`), data, { flag: 'wx' });
  return `/api/uploads/${id}.${ext}`;
}

async function saveCloud({ ext, data }, id) {
  const params = { folder: env.CLOUDINARY_FOLDER, public_id: id, timestamp: Math.floor(Date.now() / 1000) };
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, String(v));
  form.append('api_key', env.CLOUDINARY_API_KEY);
  form.append('signature', signParams(params, env.CLOUDINARY_API_SECRET));
  form.append('file', new Blob([data], { type: ext === 'jpg' ? 'image/jpeg' : 'image/png' }), `${id}.${ext}`);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST', body: form, signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !isImageUrl(body.secure_url)) throw new Error(`Cloudinary upload failed (${res.status}): ${body.error?.message ?? 'bad response'}`);
  return body.secure_url;
}

/** Stores a sanitised image and returns its public URL. */
export async function saveImage(image) {
  const id = randomBytes(16).toString('hex');
  return env.cloudinaryEnabled ? saveCloud(image, id) : saveLocal(image, id);
}

/** For local photos, checks the file is still there; cloud URLs were verified when issued. */
export async function imageExists(url) {
  const m = LOCAL_URL.exec(url);
  if (!m) return isImageUrl(url);
  try { await fs.access(path.join(UPLOAD_DIR, `${m[1]}.${m[2]}`)); return true; } catch { return false; }
}
