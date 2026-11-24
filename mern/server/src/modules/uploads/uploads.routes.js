import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { authenticate, requireVerified } from '../../middleware/auth.js';
import { uploadLimiter } from '../../middleware/security.js';
import { AppError, errors } from '../../utils/AppError.js';
import { UPLOAD_DIR, saveImage } from './storage.js';

export { UPLOAD_DIR, isImageUrl } from './storage.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } });

/**
 * Photos can carry GPS coordinates in their metadata, which would defeat the app's
 * location privacy. We never trust the file name or declared type: the real type is
 * sniffed from the bytes, and all metadata segments are stripped before saving.
 */
function stripJpeg(buf) {
  const out = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) throw new Error('bad jpeg');
    const marker = buf[i + 1];
    if (marker === 0xda) { out.push(buf.subarray(i)); return Buffer.concat(out); } // start of scan: copy the rest
    const len = buf.readUInt16BE(i + 2);
    const segment = buf.subarray(i, i + 2 + len);
    // Drop comments and every APPn segment (EXIF, XMP, IPTC...) except the ICC colour profile (APP2) and Adobe tag (APP14)
    const drop = marker === 0xfe || (marker >= 0xe1 && marker <= 0xef && marker !== 0xe2 && marker !== 0xee);
    const keep = !drop;
    if (keep) out.push(segment);
    i += 2 + len;
  }
  throw new Error('bad jpeg');
}

function stripPng(buf) {
  const out = [buf.subarray(0, 8)];
  const drop = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME']);
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    const end = i + 12 + len;
    if (end > buf.length) throw new Error('bad png');
    if (!drop.has(type)) out.push(buf.subarray(i, end));
    i = end;
    if (type === 'IEND') return Buffer.concat(out);
  }
  throw new Error('bad png');
}

export function sanitizeImage(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', data: stripJpeg(buf) };
  if (buf.length > 24 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', data: stripPng(buf) };
  throw new Error('unsupported');
}

const r = Router();

r.post('/', uploadLimiter, authenticate, requireVerified, (req, res, next) =>
  upload.single('image')(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return next(errors.badRequest('That image is over 5 MB.', 'FILE_TOO_LARGE'));
    if (err) return next(errors.badRequest('Upload failed. Send one image.', 'BAD_UPLOAD'));
    next();
  }),
async (req, res) => {
  if (!req.file) throw errors.badRequest('Choose an image to upload.', 'BAD_UPLOAD');
  let clean;
  try { clean = sanitizeImage(req.file.buffer); } catch { throw errors.badRequest('Only JPEG or PNG images are allowed.', 'BAD_IMAGE'); }
  let url;
  try { url = await saveImage(clean); } catch (e) {
    console.error(e.message);
    throw new AppError(502, 'STORAGE_UNAVAILABLE', 'Could not save the photo right now. Please try again.');
  }
  res.status(201).json({ url });
});

// Public by unguessable name so <img> tags work without auth headers.
r.get('/:name', async (req, res) => {
  const m = /^([a-f0-9]{32})\.(jpg|png)$/.exec(req.params.name);
  if (!m) throw errors.notFound();
  res.set({
    'Content-Type': m[2] === 'jpg' ? 'image/jpeg' : 'image/png',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Cross-Origin-Resource-Policy': 'same-site',
  });
  res.sendFile(path.join(UPLOAD_DIR, req.params.name), (err) => { if (err && !res.headersSent) res.status(404).end(); });
});

export default r;
