import env from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createApp } from './app.js';
import { checkMailer } from './utils/mailer.js';

await connectDB();
const app = createApp();
checkMailer();
if (!env.googleEnabled) console.log('🔑 Google sign-in: disabled (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)');
else console.log('🔑 Google sign-in: enabled');
const server = app.listen(env.PORT, () => console.log(`🏘️  Neighborly API on http://localhost:${env.PORT} (${env.NODE_ENV})`));

const shutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down…`);
  server.close();
  await disconnectDB();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
