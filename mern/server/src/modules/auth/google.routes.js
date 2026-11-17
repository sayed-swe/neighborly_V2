import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import env from '../../config/env.js';
import { User } from '../users/user.model.js';
import { audit } from '../audit/audit.service.js';
import { randomToken } from '../../utils/crypto.js';
import { authLimiter } from '../../middleware/security.js';
import { createSession, setRefreshCookie, revokeAllForUser } from './token.service.js';

/**
 * "Sign in with Google" using the server-side authorization-code flow with PKCE.
 * The client secret never reaches the browser. A random `state` (CSRF protection)
 * and the PKCE verifier live in a short-lived httpOnly cookie, and the ID token is
 * verified with Google's public keys (signature, audience, issuer, expiry).
 */
const r = Router();
const STATE_COOKIE = 'nb_g';
const REDIRECT_URI = new URL('/api/auth/google/callback', env.CLIENT_URL).toString();
const client = env.googleEnabled ? new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, REDIRECT_URI) : null;

const stateCookieOpts = { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax', path: '/api/auth/google' };
const toClient = (path) => new URL(path, env.CLIENT_URL).toString();
const fail = (res, reason) => res.redirect(302, toClient(`/login?error=${reason}`));
const safeNext = (n) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') && n.length < 200 ? n : '');

r.get('/providers', (_req, res) => res.json({ google: env.googleEnabled }));

r.get('/google', authLimiter, async (req, res) => {
  if (!client) return fail(res, 'google_disabled');
  const state = randomToken(24);
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  const next = safeNext(req.query.next);
  res.cookie(STATE_COOKIE, JSON.stringify({ state, codeVerifier, next }), { ...stateCookieOpts, maxAge: 10 * 60_000 });
  res.redirect(302, client.generateAuthUrl({
    scope: ['openid', 'email', 'profile'],
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    prompt: 'select_account',
    access_type: 'online',
  }));
});

r.get('/google/callback', authLimiter, async (req, res) => {
  if (!client) return fail(res, 'google_disabled');
  let saved;
  try { saved = JSON.parse(req.cookies?.[STATE_COOKIE] ?? ''); } catch { saved = null; }
  res.clearCookie(STATE_COOKIE, stateCookieOpts);

  const { code, state, error } = req.query;
  if (error) return fail(res, error === 'access_denied' ? 'google_cancelled' : 'google_failed');
  if (!saved?.state || typeof state !== 'string' || typeof code !== 'string'
    || state.length !== saved.state.length || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(saved.state))) {
    return fail(res, 'google_state');
  }

  let profile;
  try {
    const { tokens } = await client.getToken({ code, codeVerifier: saved.codeVerifier });
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.GOOGLE_CLIENT_ID });
    profile = ticket.getPayload();
  } catch (err) {
    console.error('Google sign-in failed:', err.message);
    return fail(res, 'google_failed');
  }
  if (!profile?.email || !profile.email_verified) return fail(res, 'google_unverified');

  const email = profile.email.toLowerCase();
  let user = await User.findOne({ googleId: profile.sub }).select('+googleId');
  if (!user) {
    user = await User.findOne({ email }).select('+googleId');
    if (user) {
      // Link Google to an existing email account (Google has verified the address).
      if (!user.emailVerified) {
        // Someone may have pre-registered this email with their own password; Google
        // proves the real owner is here, so wipe that password and any sessions.
        user.passwordHash = await bcrypt.hash(randomToken(32), env.BCRYPT_ROUNDS);
        user.hasPassword = false;
        await revokeAllForUser(user._id, 'password');
      }
      user.googleId = profile.sub;
      user.emailVerified = true;
      user.emailVerifiedAt ??= new Date();
      user.avatarUrl ??= profile.picture;
      audit(req, 'google_linked', { user: user._id });
    } else {
      const name = (profile.name || email.split('@')[0]).replace(/[^\p{L}\p{M}' .-]/gu, '').trim().slice(0, 60) || 'Neighbour';
      user = new User({
        name: name.length >= 2 ? name : 'Neighbour',
        email,
        googleId: profile.sub,
        role: 'resident', // providers sign up with email, or switch later
        emailVerified: true,
        emailVerifiedAt: new Date(),
        avatarUrl: profile.picture,
        hasPassword: false,
        passwordHash: await bcrypt.hash(randomToken(32), env.BCRYPT_ROUNDS), // unusable random password
      });
      audit(req, 'register', { user: user._id, meta: { method: 'google' } });
    }
  }

  if (user.status === 'suspended') return fail(res, 'suspended');

  user.lastLoginAt = new Date();
  await user.save();
  const { token } = await createSession(user, req);
  setRefreshCookie(res, token);
  audit(req, 'login', { user: user._id, meta: { method: 'google' } });
  res.redirect(302, toClient(`/oauth/complete${saved.next ? `?next=${encodeURIComponent(saved.next)}` : ''}`));
});

export default r;
