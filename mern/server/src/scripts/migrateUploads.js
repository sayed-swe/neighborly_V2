/**
 * Moves photos stored on the server's disk (server/uploads/) to Cloudinary and
 * rewrites the post image URLs. Safe to run more than once: posts that already
 * point at Cloudinary are skipped, and missing files are reported, not fatal.
 * Usage: npm run migrate:uploads            (does it)
 *        npm run migrate:uploads -- --dry-run   (only reports what it would do)
 */
import { parseArgs } from 'node:util';
import path from 'node:path';
import fs from 'node:fs/promises';
import env from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { Post } from '../modules/posts/models.js';
import { UPLOAD_DIR, saveImage } from '../modules/uploads/storage.js';

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const dry = values['dry-run'];
const LOCAL = /^\/api\/uploads\/([a-f0-9]{32}\.(jpg|png))$/;

if (!env.cloudinaryEnabled && !dry) {
  console.error('❌ Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env first.');
  process.exit(1);
}

const stats = { posts: 0, moved: 0, missing: 0, failed: 0 };
try {
  await connectDB();
  const posts = Post.find({ images: { $regex: '^/api/uploads/' } }).select('images').cursor();
  for await (const post of posts) {
    stats.posts++;
    const next = [];
    for (const url of post.images) {
      const m = LOCAL.exec(url);
      if (!m) { next.push(url); continue; }
      let data;
      try { data = await fs.readFile(path.join(UPLOAD_DIR, m[1])); } catch {
        stats.missing++; console.warn(`  ⚠️  ${post._id}: ${m[1]} not found on disk, left as is`); next.push(url); continue;
      }
      if (dry) { stats.moved++; next.push(url); continue; }
      try {
        next.push(await saveImage({ ext: m[2], data })); // already sanitised when first uploaded
        stats.moved++;
      } catch (e) {
        stats.failed++; console.warn(`  ⚠️  ${post._id}: ${e.message}`); next.push(url);
      }
    }
    if (!dry) await Post.updateOne({ _id: post._id }, { images: next });
  }
  console.log(`${dry ? '🔎 Dry run: ' : '✅ '}${stats.posts} posts with local photos, ${stats.moved} photos ${dry ? 'to move' : 'moved'}, ${stats.missing} missing, ${stats.failed} failed`);
} catch (e) {
  console.error('❌', e.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
