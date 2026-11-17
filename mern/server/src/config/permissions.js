/**
 * Role-based access control. Routes check permissions, never raw roles, so the
 * mapping lives in one place. The client mirrors this table for UI decisions only;
 * the server is always the authority.
 */
export const PERMISSIONS = {
  'profile:update': ['resident', 'provider', 'moderator', 'admin'],
  'content:create': ['resident', 'provider', 'moderator', 'admin'], // phase 2
  'service:list': ['provider', 'admin'], // phase 2
  'content:moderate': ['moderator', 'admin'], // phase 3
  'alert:broadcast': ['moderator', 'admin'], // phase 3
  'admin:dashboard': ['admin'],
  'audit:read': ['admin'],
  'users:read': ['moderator', 'admin'],
  'users:manage': ['admin'],
};

export const can = (role, permission) => Boolean(PERMISSIONS[permission]?.includes(role));
