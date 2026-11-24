import dotenv from 'dotenv';
import { z } from 'zod';

// Tests never read server/.env, so they can't send real emails or use real OAuth keys.
if (process.env.NODE_ENV !== 'test') dotenv.config({ quiet: true });

const bool = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().optional(),
  CLIENT_URL: z.string().url().default('http://localhost:3000'),
  // Comma-separated extra origins allowed by CORS (e.g. preview deployments)
  EXTRA_ORIGINS: z.string().default(''),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  COOKIE_SECURE: bool.optional(),
  COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  RATE_LIMIT_DISABLED: bool.default('false'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  NOMINATIM_URL: z.string().url().default('https://nominatim.openstreetmap.org'),
  // Reject passwords found in public data breaches (haveibeenpwned.com). On by default outside tests.
  PWNED_PASSWORD_CHECK: bool.optional(),
});

// Treat empty values in .env (e.g. `SMTP_HOST=`) as unset
const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''));
const parsed = schema.safeParse(raw);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

const env = parsed.data;
env.isProd = env.NODE_ENV === 'production';
env.isTest = env.NODE_ENV === 'test';
env.COOKIE_SECURE = env.COOKIE_SECURE ?? env.isProd;
env.smtpEnabled = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
env.MAIL_FROM ??= env.SMTP_USER ? `Neighborly <${env.SMTP_USER}>` : 'Neighborly <no-reply@neighborly.local>';
env.googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
env.pwnedCheck = env.PWNED_PASSWORD_CHECK ?? !env.isTest;
env.allowedOrigins = [env.CLIENT_URL, ...env.EXTRA_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)];

if (env.isProd && !env.MONGODB_URI) {
  console.error('❌ MONGODB_URI is required in production');
  process.exit(1);
}
if (env.COOKIE_SAMESITE === 'none' && !env.COOKIE_SECURE) {
  console.error('❌ COOKIE_SAMESITE=none requires COOKIE_SECURE=true');
  process.exit(1);
}

export default env;
