// Mirror of server/src/config/permissions.js, used only to decide what UI to show.
// The API enforces every permission independently.
export const PERMISSIONS = {
  'profile:update': ['resident', 'provider', 'moderator', 'admin'],
  'content:create': ['resident', 'provider', 'moderator', 'admin'],
  'service:list': ['provider', 'admin'],
  'content:moderate': ['moderator', 'admin'],
  'alert:broadcast': ['moderator', 'admin'],
  'admin:dashboard': ['admin'],
  'audit:read': ['admin'],
  'users:read': ['moderator', 'admin'],
  'users:manage': ['admin'],
};

export const can = (user, permission) => Boolean(user && PERMISSIONS[permission]?.includes(user.role));

export const ROLE_LABELS = { resident: 'Resident', provider: 'Service provider', moderator: 'Moderator', admin: 'Admin' };
