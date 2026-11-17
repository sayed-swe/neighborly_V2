# Neighborly: 3-phase delivery plan (21 days)

One phase per weekly class. Each phase ends with something demoable, tested and committed.

| Phase | Days | Theme | Demo at the end of the week |
|---|---|---|---|
| **1** | 1–7 | Foundation: landing, auth, authorization, security, home | Sign up → confirm email → set home on a map → personalised home; admin manages roles |
| **2** | 8–14 | Core community features: geo feed and the six content types | Post, browse and filter everything within your radius; providers listed with reviews |
| **3** | 15–21 | Real-time, safety and launch: chat, alerts, moderation, PWA, deploy | Live chat, emergency alert to everyone in range, report → moderator action, installed PWA on a phone, public URL |

---

## Phase 1: Foundation ✅ (this week)

**Goal:** a secure, good-looking skeleton that every later feature plugs into.

### Delivered
- **Monorepo:** `server/` (Express 5 modular monolith + MongoDB/Mongoose) and `client/` (Next.js 16 App Router). Next forwards `/api/*` to Express, so the browser sees one origin.
- **Landing page:** hero with an illustrated radius map, problem → solution, six feature cards, interactive radius demo, privacy explainer, emergency band, roles, FAQ, footer. Responsive down to 360 px.
- **Authentication**
  - Register as **Resident** or **Service provider** only (moderator/admin are assigned)
  - Required email verification (24 h single-use link) → auto sign-in
  - Login with show/hide password, strength meter, friendly error states
  - Forgot / reset password (1 h single-use link; signs out all devices)
  - Change password (keeps this device, signs out others)
  - Sign out, sign out everywhere, per-device session list with revoke
  - Delete account (password + typed confirmation)
- **Authorization (RBAC):** central permission table (`server/src/config/permissions.js`), `requirePermission()` middleware, mirrored on the client only for UI decisions. Admin seed script. Admin members page: search, filter, change role, suspend/restore, stats.
- **Location & privacy:** onboarding with Leaflet + OpenStreetMap, address search and reverse geocoding through a server-side Nominatim proxy, "use my location", radius 1–10 km. The exact point is never returned by the API; others see a deterministic ~500 m grid cell. `2dsphere` indexes in place for Phase 2.
- **Home dashboard:** greeting, area map with live radius control, nearby-neighbour count, quick actions, setup checklist, role-specific cards (provider business, moderator/admin tools), "coming soon" screens for upcoming features.
- **Security hardening:** see the README's security section.
- **Tests:** 27 automated API tests (auth flows, token rotation and reuse detection, CSRF, lockout, NoSQL injection, RBAC, privacy).

---

## Phase 2: Community features (days 8–14)

**Goal:** the app becomes useful. Everything is geo-filtered by the user's radius.

### Backend
- `Post` model with GeoJSON point (copied from the author's *approximate* location), category, text, images, expiry; `$geoNear` feed query with pagination (cursor by distance + date)
- Categories as post types with extra fields:
  - **News & notices**
  - **Help requests** (status: open / resolved)
  - **Marketplace** (price, condition, sold flag)
  - **Lost & found** (lost/found, item type, last-seen date)
  - **Events** (date/time, RSVP list)
- **Services:** provider profiles become listable; `Review` model (1–5 stars + text, one per resident per provider, only from verified users within range); average rating
- Comments and reactions on posts
- Image upload via Cloudinary free tier (signed uploads, type/size limits, EXIF stripping)
- Search (Mongo text index) and filters (category, distance, date)
- Report button on posts/comments/users (stored for Phase 3 moderation)

### Frontend
- Feed page with category tabs, distance labels ("400 m away"), infinite scroll, skeleton loading, empty states
- Composer modal (per-category fields, image picker, preview)
- Post detail page with comments
- Map view: clustered approximate pins by category
- Marketplace grid, services directory with ratings, lost & found board, events calendar list
- Public profile pages (name, area, bio, posts; provider: services and reviews)
- Avatar upload

### Tests
- Feed only returns posts inside the radius; never leaks exact coordinates
- Users can only edit or delete their own content; validation on every type

**Demo:** two accounts in different areas see different feeds; post an item for sale with a photo; leave a review for a provider.

---

## Phase 3: Real-time, safety and launch (days 15–21)

**Goal:** production-ready, deployed, installable.

### Real-time and notifications
- Socket.IO (authenticated handshake with access token): 1-to-1 **chat** (`Conversation`, `Message`, read receipts, typing indicator)
- In-app **notifications** (comment on my post, reply, review, RSVP, message)
- **Emergency alerts:** moderators/admins broadcast to everyone within X km (geo query → socket rooms + **Web Push** via VAPID keys, free)

### Moderation and admin
- Reports queue for moderators (hide content, warn, suspend), with an audit trail
- Rate-limit posting; basic profanity filter for English + Bangla
- Admin dashboard charts (signups, posts by category, reports handled within 24 h)

### PWA and polish
- Service worker (offline shell, cached feed), install prompt, web push opt-in
- Dark mode, Bangla language toggle (i18n strings)
- Accessibility pass (keyboard, screen reader, contrast), Lighthouse ≥ 90

### Launch
- MongoDB Atlas M0, API on Render free tier, web on Vercel (rewrite `/api/*` to Render so cookies stay first-party), Brevo/Resend free SMTP
- GitHub Actions CI: install → test → build on every push; auto-deploy `main`
- Seed script with realistic demo data for the final presentation
- Final report: architecture diagram, ER/collection diagram, security summary, test results

**Demo:** install the app on a phone, receive an emergency alert in real time, chat with a provider, file and resolve a report, open the public URL.
