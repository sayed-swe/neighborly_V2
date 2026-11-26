import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import env from '../config/env.js';
import { errors } from '../utils/AppError.js';

const limiter = (opts) =>
  rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.RATE_LIMIT_DISABLED,
    handler: (_req, res) =>
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a bit and try again.' } }),
    ...opts,
  });

export const apiLimiter = limiter({ windowMs: 15 * 60_000, limit: 600 });
export const authLimiter = limiter({ windowMs: 15 * 60_000, limit: 20 });
// Email-sending endpoints: keyed by IP + target email so one inbox can't be flooded
export const emailLimiter = limiter({
  windowMs: 60 * 60_000,
  limit: 5,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email ?? '').toLowerCase()}`,
});
export const refreshLimiter = limiter({ windowMs: 15 * 60_000, limit: 120 });
export const geoLimiter = limiter({ windowMs: 60_000, limit: 30 });

/** Rejects any key that looks like a Mongo operator or dotted path, at any depth. */
export function rejectOperatorKeys(req, _res, next) {
  const bad = (value, depth = 0) => {
    if (depth > 10 || value === null || typeof value !== 'object') return false;
    return Object.keys(value).some((k) => k.startsWith('$') || k.includes('.') || bad(value[k], depth + 1));
  };
  if (bad(req.body) || bad(req.query) || bad(req.params)) throw errors.badRequest('Invalid characters in request', 'INVALID_INPUT');
  next();
}

/**
 * CSRF defence for cookie-authenticated endpoints (refresh/logout). Besides
 * SameSite cookies, browsers always send Origin on POST; reject foreign origins.
 */
export function requireTrustedOrigin(req, _res, next) {
  const origin = req.get('origin');
  if (origin && !env.allowedOrigins.includes(origin)) throw errors.forbidden('Untrusted origin', 'BAD_ORIGIN');
  if (!origin && env.isProd) throw errors.forbidden('Missing origin', 'BAD_ORIGIN');
  next();
}

// Write-heavy social actions, keyed per IP
export const postLimiter = limiter({ windowMs: 60 * 60_000, limit: 30 });
export const commentLimiter = limiter({ windowMs: 10 * 60_000, limit: 60 });
export const uploadLimiter = limiter({ windowMs: 60 * 60_000, limit: 40 });
export const exportLimiter = limiter({ windowMs: 60 * 60_000, limit: 5 });
export const reportLimiter = limiter({ windowMs: 60 * 60_000, limit: 20 });
