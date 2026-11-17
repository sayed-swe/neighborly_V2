// Runs automatically before `npm run dev`. Catches the usual "it won't start" problems
// with a clear message instead of a stack trace.
import fs from 'node:fs';
import net from 'node:net';
import crypto from 'node:crypto';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const fail = (msg) => { console.error(`\n❌ ${msg}\n`); process.exit(1); };
const ok = (msg) => console.log(`✔ ${msg}`);

// 1. Node version (Next.js 16 needs 20.9+, the API uses import.meta.dirname: 20.11+)
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 20 || (maj === 20 && min < 11)) fail(`Node ${process.versions.node} is too old. Install Node 20.11 or newer (https://nodejs.org) and run npm install again.`);
ok(`Node ${process.versions.node}`);

// 2. Dependencies installed
for (const pkg of ['next', 'express', 'mongoose']) {
  if (!fs.existsSync(path.join(root, 'node_modules', pkg))) fail('Dependencies are missing. Run `npm install` in the project root (the folder with this package.json).');
}
ok('Dependencies installed');

// 3. server/.env exists with a real secret (create it on first run)
const envPath = path.join(root, 'server/.env');
if (!fs.existsSync(envPath)) {
  const example = fs.readFileSync(path.join(root, 'server/.env.example'), 'utf8');
  const secret = crypto.randomBytes(48).toString('base64url');
  fs.writeFileSync(envPath, example.replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${secret}`).replace(/^TRUST_PROXY=0$/m, 'TRUST_PROXY=1'));
  ok('Created server/.env with a fresh secret');
} else if (/^JWT_ACCESS_SECRET=change-me/m.test(fs.readFileSync(envPath, 'utf8'))) {
  fail('server/.env still has the placeholder JWT_ACCESS_SECRET. Delete server/.env and run `npm run dev` again to regenerate it.');
} else ok('server/.env found');

// 4. Ports free
const free = (port) => new Promise((res) => {
  const s = net.createServer().once('error', () => res(false)).once('listening', () => s.close(() => res(true))).listen(port);
});
for (const [port, what] of [[3000, 'web app'], [4000, 'API'], [27027, 'dev database']]) {
  if (!(await free(port))) fail(`Port ${port} (${what}) is already in use, probably an old Neighborly still running.\n   Stop it with:  lsof -ti tcp:${port} | xargs kill\n   then run npm run dev again.`);
}
ok('Ports 3000, 4000, 27027 are free');
console.log('\n→ Starting… open http://localhost:3000 when you see "Neighborly API on…"\n');
