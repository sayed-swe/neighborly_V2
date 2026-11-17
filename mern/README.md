# Neighborly (MERN)

This folder is the MERN version of Neighborly. The repository root holds the separate React + Supabase version.

A hyper-local community platform: verified residents see, post and act on what's happening within 1–10 km of home. MERN stack (MongoDB, Express, React via Next.js, Node), designed to run at $0 on free tiers.

> **Status:** Phase 1 complete; Phase 2 in progress (feed, reactions, comments, shares, photo posts, reports and the admin console are built). See [../docs/ROADMAP.md](../docs/ROADMAP.md).

## Quick start

Requirements: Node 20+. Run everything from this `mern/` folder.

```bash
cd mern
npm install
cp server/.env.example server/.env      # then set JWT_ACCESS_SECRET (command is in the file)
npm run dev                             # API on :4000, web on :3000
```

Open http://localhost:3000.

- **No database setup needed in development.** If `MONGODB_URI` is empty, the API starts a local MongoDB that saves to `server/.data/`. The first run downloads the MongoDB binary (~80 MB).
- **Emails are printed in the API terminal** when SMTP isn't configured. Copy the confirmation or reset link from there.
- **Create an admin** (admins can't be chosen at sign-up). Run this while `npm run dev` is running:

  ```bash
  MONGODB_URI=mongodb://127.0.0.1:27027/neighborly npm run seed:admin -- --email you@example.com --name "Your Name" --password "a-long-password-1"
  ```

  With Atlas, use your normal `MONGODB_URI` instead.
- **Load demo content** (14 neighbours in Dhanmondi/Gulshan, 39 posts, comments, reactions, shares, reports and an activity log) so the feed and admin console aren't empty. Re-running replaces the demo data and never touches real accounts:

  ```bash
  MONGODB_URI=mongodb://127.0.0.1:27027/neighborly npm run seed:demo
  ```

  Every demo account uses the password `demo-pass-2026`: `rahim@demo.neighborly.test` (resident), `karim@…` (provider), `tanvir@…` (moderator).

| Command | What it does |
|---|---|
| `npm run dev` | API + web with live reload |
| `npm test` | API test suite (51 tests, in-memory MongoDB) |
| `npm run build` | Production build of the web app |
| `npm run seed:admin` | Create or promote an admin |
| `npm run seed:demo` | Load (or reload) demo neighbours, posts and reports |

## Google sign-in & real emails

Both are configured in `server/.env` (git-ignored). Restart `npm run dev` after editing it. The API terminal prints whether each is working.

**Google sign-in** ([Google Cloud Console](https://console.cloud.google.com/apis/credentials) → your OAuth 2.0 Web client)
- Authorised JavaScript origins: `http://localhost:3000`
- Authorised redirect URIs: `http://localhost:3000/api/auth/google/callback`
- OAuth consent screen in *Testing* mode: add each Google account that will sign in under **Test users**
- Production: add the same two entries with your deployed domain

**Real emails via Gmail**
1. Turn on 2-Step Verification for the Gmail account
2. Create an App Password at https://myaccount.google.com/apppasswords
3. In `server/.env` set `SMTP_USER=<that gmail address>` and `SMTP_PASS=<the 16-character app password>`

## Architecture

```
Browser ──► Next.js (client/) ──/api/* rewrite──► Express API (server/) ──► MongoDB
             pages, UI, proxy.js redirects         auth, RBAC, validation       2dsphere geo indexes
```

- **One origin for the browser.** Next.js forwards `/api/*` to Express. Auth cookies stay first-party (`SameSite=Strict`) and no CORS is needed in production.
- **Modular monolith.** Each feature is a folder in `server/src/modules/` (auth, users, admin, geo, audit, posts, uploads) with its own routes, schemas and models.

```
server/src/
  config/        env (validated with zod), db, permissions (RBAC table)
  middleware/    auth (authenticate, requirePermission), validate, security, error
  modules/       auth/ users/ admin/ geo/ audit/ posts/ uploads/
  utils/         mailer, crypto, geo (location privacy), AppError
client/
  app/           (auth)/ login, register, verify… · (app)/ home, feed, post/[id], onboarding, settings, admin/*, soon/[feature]
  components/    ui kit, Modal, AppShell, LocationPicker, map/, landing/, feed/, admin/
  lib/           api client (token refresh), AuthProvider, permissions, schemas
  proxy.js       redirects signed-out visitors away from app pages
```

## Feed & admin console (Phase 2)

- **Feed** (`/feed`): posts from verified neighbours within your radius, newest first, with infinite scroll, type filters (news, help, buy & sell, lost & found, events), search and "your posts".
- **Posts**: text plus up to 4 photos, type and price for items for sale; edit, delete, copy link, report.
- **Reactions**: Like plus Love / Haha / Wow / Sad (hover, long-press or keyboard-focus the Like button).
- **Comments**: replies one level deep, comment likes, delete (by the author, the post owner or a moderator), report.
- **Share**: share now, share with a message, or copy the link; sharing a share points to the original.
- **Admin console** (`/admin`): overview with 14-day charts, members, posts (hide / remove / restore), comments, a report queue (dismiss or remove; every report about the same item closes together) and the full activity log. Moderators see everything except the overview and the activity log.
- **Safety**: photos are re-encoded in the browser and stripped of EXIF/GPS on the server; suspended members' posts disappear from feeds; per-action rate limits; ownership checks on every edit/delete.

## Security (Phase 1)

| Area | What's implemented |
|---|---|
| Passwords | bcrypt (cost 12); minimum 10 chars with letters + numbers; strength meter |
| Sessions | 15-min JWT access token kept **in memory only**. 30-day refresh token in an **httpOnly, SameSite=Strict** cookie scoped to `/api/auth`, stored **hashed** |
| Token theft | Refresh tokens **rotate** on every use. Replaying an old one revokes that device's whole session family. Concurrent tabs are handled safely |
| Instant revocation | `tokenVersion` on the user: suspension, role change, password change and "sign out everywhere" invalidate access tokens immediately |
| Brute force | Per-IP rate limits on auth routes; per-inbox limits on email-sending routes; 15-min account lockout after 5 failures |
| Enumeration | Register, forgot-password and resend give identical responses whether or not the email exists; login does constant-time work for unknown emails |
| Email tokens | 256-bit random, stored as SHA-256, single-use, expiring (24 h verify / 1 h reset) |
| Authorization | Central permission table; moderator/admin can't be self-selected; admins can't demote themselves or remove the last admin; ownership checks on sessions |
| Input | Strict zod schemas (unknown fields rejected), `$`/dotted keys rejected anywhere, 20 KB body limit, escaped regex search |
| CSRF | SameSite=Strict cookies + Origin allow-list on cookie-authenticated endpoints |
| Headers | Helmet on the API; CSP (production), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS on the web app |
| Privacy | Exact home is `select: false` and stripped from every response; others see a deterministic ~500 m grid cell; geocoding goes through the server, so user IPs aren't sent to third parties |
| Audit | Security events (logins, failures, lockouts, password changes, role changes…) logged for 90 days and shown to the user |
| Open redirect | `?next=` only accepts same-site relative paths |

## Weekly demo script (Phase 1)

1. Landing page: scroll through, drag the radius demo, resize to mobile.
2. Register as a provider → show the confirmation email in the API terminal → open the link → auto sign-in.
3. Onboarding: search an area or tap the map → set radius → land on Home.
4. Home: change the radius live; open a "Soon" feature.
5. Settings → Security: change password, show the device list and activity log, revoke a device.
6. Sign in as admin → Members: promote the provider to Moderator, suspend a user (their session dies instantly).
7. Show security: wrong password 5× → lockout; `npm test` → all green.

## Deployment (Phase 3)

MongoDB Atlas M0 · Render (API, `TRUST_PROXY=1`) · Vercel (web, `API_URL` = Render URL) · Brevo/Resend SMTP. All free tiers.
