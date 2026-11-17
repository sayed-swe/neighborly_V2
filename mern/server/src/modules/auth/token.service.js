import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import env from '../../config/env.js';
import { Session } from './session.model.js';
import { randomToken, sha256 } from '../../utils/crypto.js';

const JWT_OPTS = { issuer: 'neighborly-api', audience: 'neighborly-web' };
export const REFRESH_COOKIE = 'nb_rt';
// Non-secret hint so the Next.js edge proxy can redirect signed-out visitors without a round trip.
// It grants nothing: every API call still needs a valid access token.
export const HINT_COOKIE = 'nb_session';
const REFRESH_GRACE_MS = 20_000; // concurrent refreshes (two tabs) within this window aren't treated as theft

export function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role, ver: user.tokenVersion ?? 0 }, env.JWT_ACCESS_SECRET, {
    ...JWT_OPTS,
    algorithm: 'HS256',
    expiresIn: env.ACCESS_TOKEN_TTL,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { ...JWT_OPTS, algorithms: ['HS256'] });
}

export async function createSession(user, req, family = crypto.randomUUID()) {
  const token = randomToken(48);
  const session = await Session.create({
    user: user._id,
    family,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 864e5),
    userAgent: req.get('user-agent')?.slice(0, 300),
    ip: req.ip,
  });
  return { token, session };
}

/**
 * Rotates a refresh token. Returns { status: 'ok', session, token } or
 * { status: 'invalid' | 'race' | 'reuse', session? }.
 */
export async function rotateRefreshToken(rawToken, req) {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length > 200) return { status: 'invalid' };
  const session = await Session.findOne({ tokenHash: sha256(rawToken) });
  if (!session || session.expiresAt < new Date()) return { status: 'invalid' };

  if (session.revokedAt) {
    if (session.revokedReason === 'rotated' && Date.now() - session.revokedAt.getTime() < REFRESH_GRACE_MS) {
      return { status: 'race' };
    }
    if (session.revokedReason === 'rotated') {
      // An old token was replayed long after rotation: assume it was stolen.
      await revokeFamily(session.family, 'reuse');
      return { status: 'reuse', session };
    }
    return { status: 'invalid' };
  }

  // Atomically claim this token so two concurrent requests can't both rotate it.
  const claimed = await Session.findOneAndUpdate(
    { _id: session._id, revokedAt: null },
    { revokedAt: new Date(), revokedReason: 'rotated' },
  );
  if (!claimed) return { status: 'race' };

  const { token, session: next } = await createSession({ _id: session.user }, req, session.family);
  return { status: 'ok', token, session: next };
}

export const revokeFamily = (family, reason) =>
  Session.updateMany({ family, revokedAt: null }, { revokedAt: new Date(), revokedReason: reason });

export const revokeAllForUser = (userId, reason, exceptFamily) =>
  Session.updateMany(
    { user: userId, revokedAt: null, ...(exceptFamily ? { family: { $ne: exceptFamily } } : {}) },
    { revokedAt: new Date(), revokedReason: reason },
  );

export function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 864e5,
  });
  res.cookie(HINT_COOKIE, '1', {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 864e5,
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    path: '/api/auth',
  });
  res.clearCookie(HINT_COOKIE, { secure: env.COOKIE_SECURE, sameSite: 'lax', path: '/' });
}

export async function findSessionByToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null;
  return Session.findOne({ tokenHash: sha256(rawToken) });
}
