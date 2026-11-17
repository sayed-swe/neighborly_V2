import { User } from '../modules/users/user.model.js';
import { verifyAccessToken } from '../modules/auth/token.service.js';
import { can } from '../config/permissions.js';
import { errors } from '../utils/AppError.js';

/**
 * Verifies the Bearer access token, then re-loads the user so that suspensions,
 * role changes and "sign out everywhere" take effect immediately, not after the
 * token expires.
 */
export async function authenticate(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw errors.unauthorized();

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw errors.unauthorized(
      err.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid token',
      err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
    );
  }

  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || user.tokenVersion !== payload.ver) throw errors.unauthorized('Session is no longer valid', 'INVALID_TOKEN');
  if (user.status === 'suspended') throw errors.forbidden('This account is suspended', 'ACCOUNT_SUSPENDED');

  req.user = user;
  next();
}

export function requireVerified(req, _res, next) {
  if (!req.user?.emailVerified) throw errors.forbidden('Please verify your email first', 'EMAIL_NOT_VERIFIED');
  next();
}

export const requirePermission = (permission) => (req, _res, next) => {
  if (!req.user) throw errors.unauthorized();
  if (!can(req.user.role, permission)) throw errors.forbidden();
  next();
};
