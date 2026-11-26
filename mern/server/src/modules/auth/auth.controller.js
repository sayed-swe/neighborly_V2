import bcrypt from 'bcryptjs';
import env from '../../config/env.js';
import { User } from '../users/user.model.js';
import { Session } from './session.model.js';
import { errors } from '../../utils/AppError.js';
import { randomToken, sha256 } from '../../utils/crypto.js';
import { emails } from '../../utils/mailer.js';
import { audit } from '../audit/audit.service.js';
import { assertNotPwned } from '../../utils/pwned.js';
import { describeDevice } from '../../utils/device.js';
import {
  REFRESH_COOKIE, signAccessToken, createSession, rotateRefreshToken, revokeAllForUser,
  setRefreshCookie, clearRefreshCookie, findSessionByToken,
} from './token.service.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const VERIFY_TTL_MS = 24 * 3600_000;
const RESET_TTL_MS = 3600_000;

// Used to equalise response time when the email doesn't exist (prevents user enumeration by timing)
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-password', env.BCRYPT_ROUNDS);

const clientUrl = (path) => new URL(path, env.CLIENT_URL).toString();
const hashPassword = (pw) => bcrypt.hash(pw, env.BCRYPT_ROUNDS);

async function issueVerification(user) {
  const token = randomToken();
  user.emailVerifyTokenHash = sha256(token);
  user.emailVerifyExpires = new Date(Date.now() + VERIFY_TTL_MS);
  await user.save();
  await emails.verify(user, clientUrl(`/verify-email?token=${token}`));
}

/** Starts a session: refresh token in an httpOnly cookie, short-lived access token in the body. */
async function signIn(req, res, user, status = 200) {
  const { token } = await createSession(user, req);
  setRefreshCookie(res, token);
  user.lastLoginAt = new Date();
  await user.save();
  const fresh = await User.findById(user._id).select('+tokenVersion');
  res.status(status).json({ user: fresh.toJSON(), accessToken: signAccessToken(fresh) });
}

// The response is identical whether or not the email exists.
const GENERIC_REGISTER = { message: 'Check your inbox for a link to confirm your email.' };

export async function register(req, res) {
  const { name, email, password, role, businessName, serviceCategory } = req.body;
  await assertNotPwned(password);
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.emailVerified) {
      await emails.alreadyRegistered(existing, clientUrl('/login'), clientUrl('/forgot-password'));
    } else {
      await issueVerification(existing);
    }
    return res.status(201).json(GENERIC_REGISTER);
  }

  const user = new User({
    name,
    email,
    role,
    passwordHash: await hashPassword(password),
    ...(role === 'provider' && { provider: { businessName, category: serviceCategory } }),
  });
  await issueVerification(user);
  audit(req, 'register', { user: user._id, meta: { role } });
  res.status(201).json(GENERIC_REGISTER);
}

export async function verifyEmail(req, res) {
  const user = await User.findOne({
    emailVerifyTokenHash: sha256(req.body.token),
    emailVerifyExpires: { $gt: new Date() },
  });
  if (!user) throw errors.badRequest('This link is invalid or has expired. Request a new one.', 'INVALID_TOKEN');
  if (user.status === 'suspended') throw errors.forbidden('This account is suspended', 'ACCOUNT_SUSPENDED');

  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerifyTokenHash = undefined;
  user.emailVerifyExpires = undefined;
  await user.save();
  audit(req, 'email_verified', { user: user._id });
  await signIn(req, res, user); // the link proves inbox ownership, so sign them straight in
}

export async function resendVerification(req, res) {
  const user = await User.findOne({ email: req.body.email });
  if (user && !user.emailVerified) await issueVerification(user);
  res.json({ message: 'If that account needs confirming, a new link is on its way.' });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash +failedLoginCount +lockUntil');

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw errors.unauthorized('Incorrect email or password', 'INVALID_CREDENTIALS');
  }
  if (user.isLocked()) {
    const minutes = Math.ceil((user.lockUntil - Date.now()) / 60_000);
    throw errors.locked(`Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`, 'ACCOUNT_LOCKED', { minutes });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    user.failedLoginCount = (user.failedLoginCount ?? 0) + 1;
    if (user.failedLoginCount >= MAX_FAILED_LOGINS) {
      user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
      user.failedLoginCount = 0;
      audit(req, 'account_locked', { user: user._id });
    }
    await user.save();
    audit(req, 'login_failed', { user: user._id });
    throw errors.unauthorized('Incorrect email or password', 'INVALID_CREDENTIALS');
  }

  if (user.status === 'suspended') throw errors.forbidden('This account is suspended. Contact support.', 'ACCOUNT_SUSPENDED');
  if (!user.emailVerified) throw errors.forbidden('Please confirm your email before signing in.', 'EMAIL_NOT_VERIFIED');

  user.failedLoginCount = 0;
  user.lockUntil = undefined;
  audit(req, 'login', { user: user._id });
  const newDevice = await isNewDevice(user, req);
  await signIn(req, res, user);
  if (newDevice) {
    const when = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' });
    emails.newSignIn(user, { device: describeDevice(req.get('user-agent')), ip: req.ip, when: `${when} (Dhaka time)`, url: clientUrl('/settings') }).catch(() => {});
  }
}

/**
 * A device is "new" when no session in the last 30 days (kept until expiry, even
 * after sign-out) came from the same browser. The very first sign-in never alerts.
 */
async function isNewDevice(user, req) {
  const ua = req.get('user-agent')?.slice(0, 300);
  const [any, same] = await Promise.all([
    Session.exists({ user: user._id }),
    Session.exists({ user: user._id, userAgent: ua }),
  ]);
  return Boolean(any) && !same;
}

export async function refresh(req, res) {
  const result = await rotateRefreshToken(req.cookies?.[REFRESH_COOKIE], req);

  if (result.status === 'race') {
    // Another tab just rotated this token; the browser already holds the new cookie. Client retries once.
    return res.status(409).json({ error: { code: 'REFRESH_RACE', message: 'Retry' } });
  }
  if (result.status !== 'ok') {
    if (result.status === 'reuse') audit(req, 'refresh_reuse_detected', { user: result.session.user });
    clearRefreshCookie(res);
    throw errors.unauthorized('Please sign in again', 'SESSION_EXPIRED');
  }

  const user = await User.findById(result.session.user).select('+tokenVersion');
  if (!user || user.status === 'suspended' || !user.emailVerified) {
    await Session.updateOne({ _id: result.session._id }, { revokedAt: new Date(), revokedReason: 'admin' });
    clearRefreshCookie(res);
    throw errors.unauthorized('Please sign in again', 'SESSION_EXPIRED');
  }

  setRefreshCookie(res, result.token);
  res.json({ user: user.toJSON(), accessToken: signAccessToken(user) });
}

export async function logout(req, res) {
  const session = await findSessionByToken(req.cookies?.[REFRESH_COOKIE]);
  if (session && !session.revokedAt) {
    await Session.updateMany({ family: session.family, revokedAt: null }, { revokedAt: new Date(), revokedReason: 'logout' });
    audit(req, 'logout', { user: session.user });
  }
  clearRefreshCookie(res);
  res.status(204).end();
}

export async function logoutAll(req, res) {
  await revokeAllForUser(req.user._id, 'logout-all');
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  audit(req, 'logout_all', { user: req.user._id });
  clearRefreshCookie(res);
  res.status(204).end();
}

export async function forgotPassword(req, res) {
  const user = await User.findOne({ email: req.body.email });
  if (user && user.status === 'active') {
    const token = randomToken();
    user.passwordResetTokenHash = sha256(token);
    user.passwordResetExpires = new Date(Date.now() + RESET_TTL_MS);
    await user.save();
    await emails.reset(user, clientUrl(`/reset-password?token=${token}`));
    audit(req, 'password_reset_requested', { user: user._id });
  }
  res.json({ message: 'If an account exists for that email, we sent a reset link.' });
}

export async function resetPassword(req, res) {
  const user = await User.findOne({
    passwordResetTokenHash: sha256(req.body.token),
    passwordResetExpires: { $gt: new Date() },
  });
  if (!user) throw errors.badRequest('This reset link is invalid or has expired.', 'INVALID_TOKEN');
  await assertNotPwned(req.body.password);

  user.passwordHash = await hashPassword(req.body.password);
  user.hasPassword = true;
  user.passwordChangedAt = new Date();
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.failedLoginCount = 0;
  user.lockUntil = undefined;
  user.emailVerified = true; // they proved inbox ownership
  user.emailVerifiedAt ??= new Date();
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();
  await revokeAllForUser(user._id, 'password');
  audit(req, 'password_reset', { user: user._id });
  emails.passwordChanged(user).catch(() => {});
  clearRefreshCookie(res);
  res.json({ message: 'Password updated. You can now sign in.' });
}

export async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select('+passwordHash +tokenVersion');
  if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) {
    throw errors.badRequest('Current password is incorrect', 'VALIDATION_ERROR', { fields: { currentPassword: 'Current password is incorrect' } });
  }
  await assertNotPwned(req.body.newPassword, 'newPassword');
  user.passwordHash = await hashPassword(req.body.newPassword);
  user.passwordChangedAt = new Date();
  user.tokenVersion += 1;
  await user.save();

  // Keep this device signed in, sign out every other one.
  const current = await findSessionByToken(req.cookies?.[REFRESH_COOKIE]);
  await revokeAllForUser(user._id, 'password', current?.family);
  audit(req, 'password_changed', { user: user._id });
  emails.passwordChanged(user).catch(() => {});
  res.json({ message: 'Password changed. Other devices were signed out.', accessToken: signAccessToken(user) });
}

export const me = (req, res) => res.json({ user: req.user.toJSON() });
