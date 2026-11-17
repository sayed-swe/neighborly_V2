import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Session } from './session.model.js';
import { REFRESH_COOKIE, findSessionByToken } from './token.service.js';
import { audit } from '../audit/audit.service.js';
import { errors } from '../../utils/AppError.js';
import * as c from './auth.controller.js';
import * as s from './auth.schemas.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { authLimiter, emailLimiter, refreshLimiter, requireTrustedOrigin } from '../../middleware/security.js';

const r = Router();

r.post('/register', authLimiter, validate({ body: s.registerSchema }), emailLimiter, c.register);
r.post('/verify-email', authLimiter, validate({ body: s.tokenSchema }), c.verifyEmail);
r.post('/resend-verification', authLimiter, validate({ body: s.emailOnlySchema }), emailLimiter, c.resendVerification);
r.post('/login', authLimiter, validate({ body: s.loginSchema }), c.login);
r.post('/forgot-password', authLimiter, validate({ body: s.emailOnlySchema }), emailLimiter, c.forgotPassword);
r.post('/reset-password', authLimiter, validate({ body: s.resetSchema }), c.resetPassword);

// Cookie-authenticated endpoints: protected against CSRF by SameSite + Origin check
r.post('/refresh', refreshLimiter, requireTrustedOrigin, c.refresh);
r.post('/logout', requireTrustedOrigin, c.logout);

r.get('/me', authenticate, c.me);
r.post('/logout-all', authenticate, c.logoutAll);
r.post('/change-password', authLimiter, authenticate, validate({ body: s.changePasswordSchema }), c.changePassword);

// Device/session management lives under /api/auth because the refresh cookie is
// scoped to this path; it's how we tell which session is "this device".
r.get('/sessions', authenticate, async (req, res) => {
  const current = await findSessionByToken(req.cookies?.[REFRESH_COOKIE]);
  const sessions = await Session.find({ user: req.user._id, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ lastUsedAt: -1 })
    .lean();
  res.json({
    sessions: sessions.map((s) => ({
      id: s._id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt ?? s.createdAt,
      current: current?.family === s.family,
    })),
  });
});

r.delete('/sessions/:id', authenticate, validate({ params: z.strictObject({ id: z.string().refine(mongoose.isValidObjectId, 'Invalid id') }) }), async (req, res) => {
  const session = await Session.findOne({ _id: req.valid.params.id, user: req.user._id }); // ownership check
  if (!session) throw errors.notFound('Session not found');
  await Session.updateMany({ family: session.family, revokedAt: null }, { revokedAt: new Date(), revokedReason: 'logout' });
  audit(req, 'session_revoked', { user: req.user._id });
  res.status(204).end();
});


export default r;
