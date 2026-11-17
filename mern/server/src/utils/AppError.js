export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  badRequest: (msg = 'Bad request', code = 'BAD_REQUEST', details) => new AppError(400, code, msg, details),
  unauthorized: (msg = 'Authentication required', code = 'UNAUTHORIZED') => new AppError(401, code, msg),
  forbidden: (msg = 'You do not have permission to do that', code = 'FORBIDDEN') => new AppError(403, code, msg),
  notFound: (msg = 'Not found', code = 'NOT_FOUND') => new AppError(404, code, msg),
  conflict: (msg = 'Conflict', code = 'CONFLICT') => new AppError(409, code, msg),
  locked: (msg, code = 'ACCOUNT_LOCKED', details) => new AppError(423, code, msg, details),
};
