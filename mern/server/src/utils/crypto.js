import crypto from 'node:crypto';

/** Cryptographically random URL-safe token. */
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

/** One-way hash for storing tokens: we never store raw tokens in the database. */
export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
