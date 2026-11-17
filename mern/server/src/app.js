import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import mongoose from 'mongoose';
import env from './config/env.js';
import authRoutes from './modules/auth/auth.routes.js';
import googleRoutes from './modules/auth/google.routes.js';
import userRoutes from './modules/users/users.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import geoRoutes from './modules/geo/geo.routes.js';
import uploadRoutes from './modules/uploads/uploads.routes.js';
import { postsRouter, commentsRouter } from './modules/posts/posts.routes.js';
import { apiLimiter, rejectOperatorKeys } from './middleware/security.js';
import { errorHandler, notFound } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY); // correct client IPs behind Render/Vercel proxies

  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }, // API serves JSON only
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: env.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.allowedOrigins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  // Friendly hint if someone opens the API port in a browser
  // Opening the API port in a browser? Send people to the actual app.
  app.get('/', (req, res) => {
    if (req.accepts(['json', 'html']) === 'html') return res.redirect(302, env.CLIENT_URL);
    res.json({ name: 'Neighborly API', message: `This is the API. Open the app at ${env.CLIENT_URL}` });
  });

  app.get('/api/health', (_req, res) =>
    res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'up' : 'down', time: new Date().toISOString() }),
  );

  // Uploaded images are served before the global limiter/no-store so feeds can cache and load many photos
  app.use('/api/uploads', uploadRoutes);

  app.use('/api', apiLimiter, rejectOperatorKeys, (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api/auth', googleRoutes, authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/geo', geoRoutes);
  app.use('/api/posts', postsRouter);
  app.use('/api/comments', commentsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
