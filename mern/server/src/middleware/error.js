import { ZodError } from 'zod';
import env from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] ??= issue.message;
    }
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Please check the highlighted fields', fields } });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.details } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON body' } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Request body too large' } });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: { code: 'DUPLICATE', message: 'That value is already in use' } });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid identifier' } });
  }

  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong on our side', ...(!env.isProd && { debug: err?.message }) },
  });
}
