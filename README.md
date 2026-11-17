# Neighborly

A hyper-local community platform: a Facebook-style feed for the people who live around you, plus a map, buy & sell, services, lost & found, events, direct messages, emergency alerts and a full admin panel.

**Stack:** React 18 + Vite · Supabase (Postgres, Auth, Storage, Realtime) · React Router · Leaflet / OpenStreetMap · lucide icons

> Capstone project — Daffodil International University, Software Engineering.

## Repository layout

| Folder | What it is | Run it |
|---|---|---|
| `/` (root) | Web app on **React + Vite + Supabase** | `npm install && npm run dev` |
| [`mern/`](mern/) | Web app on the **MERN stack**: Next.js frontend + Express API + MongoDB | `cd mern && npm install && npm run dev` (see [mern/README.md](mern/README.md)) |
| [`docs/`](docs/) | Shared docs: delivery [roadmap](docs/ROADMAP.md), legacy schema, design references | – |

The two web apps are independent: each has its own `package.json` and they don't share dependencies.

---

## Features

| Area | What users can do |
|---|---|
| **Home** | Neighborhood feed, composer, quick links, right rail with active alerts, upcoming events, help requests and neighbors |
| **Feed** | All posts with search, category filter, neighborhood filter and **Near me** (radius search on pinned posts) |
| **Posts** | Text, photo, location pin, category, audience (neighborhood). **7 Facebook reactions** (hover the Like button), **comments with replies + comment likes**, **share** (to feed with a caption, copy link, or send in Messages), edit / delete / report. Admins can post official announcements |
| **Map** | Every pinned post, listing, lost item, event, help request, alert and service on an OpenStreetMap map; filter by type, "near me" radius, distance list |
| **Buy & sell** | Listings (sell / wanted / exchange / free) with photo, price, condition, category, pick-up location; Q&A comments; message seller; mark sold / reserved |
| **Services** | Local service directory (verified badge set by admins), call or message a provider. **Help requests** tab: ask neighbors for help, others offer help, mark resolved |
| **Lost & found** | Lost / found reports with photo, place, date; comments; mark as reunited |
| **Events** | Create events, RSVP going / interested, attendees, discussion |
| **Messages** | 1:1 real-time chat (Supabase Realtime), unread counts, start a chat from any profile / listing / service |
| **Alerts** | Raise emergency alerts (severity, location) → every neighbor gets a notification + toast; personal notifications (reactions, comments, shares, RSVPs, help offers) |
| **Profile** | Cover + avatar, bio, neighborhood, posts / listings / about tabs, edit profile, message, report user |

### Admin panel (`/admin`)
Visible to `admin` and `moderator` roles.

- **Dashboard** — counts for every table, posts & sign-ups over the last 14 days, members by neighborhood, open reports, latest posts
- **Reports queue** — review reported content side-by-side with the item, then dismiss, warn the user, remove the content, suspend or ban
- **Users** — search everyone (with email + last sign-in), change role (admins only), suspend / ban, send a system notification, CSV export
- **Posts, Comments, Buy & sell, Lost & found, Events, Services, Help requests, Emergency alerts** — searchable, filterable, paged tables with inline status changes, verify / activate toggles, open-in-app, delete and CSV export
- **Neighborhoods & categories** — edit the lists people pick from

Moderators can do everything except change roles. Security is enforced in the database with Row Level Security, not just in the UI.

---

## Setup

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. In **SQL Editor**, run these files in order:
   - `supabase/migrations/20261114000001_schema.sql` — tables, enums, RLS, triggers, views, RPCs
   - `supabase/migrations/20261114000002_storage_and_lookups.sql` — `media` storage bucket + neighborhoods & categories
   - `supabase/migrations/20261114000003_lock_internal_functions.sql` and `…000004_neighborhood_fk_indexes.sql`
   - *(optional)* `supabase/seed_demo.sql` — demo users, posts, listings, events… (logins are listed at the top of the file)
3. Make yourself admin after you sign up:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
4. *(Optional, for quick testing)* **Authentication → Providers → Email**: turn off "Confirm email".

### 2. App
```bash
cp .env.example .env      # paste your Project URL + anon/publishable key
npm install
npm run dev               # http://localhost:5173
```

### 3. Publish

The repo is a Vite app: it has to be **built** before it can be served. Opening the repo on GitHub or turning on Pages from a branch gives a blank page.

**Option A — GitHub Pages (automatic, from this repo)**
1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions** (owner/admin only).
2. Supabase settings for production builds are in `.env.production` (public URL + anon key — safe to commit, data is protected by RLS). To point at a different project, edit that file or add repo secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, which override it.
3. Push to `main` (or **Actions → Deploy to GitHub Pages → Run workflow**). The site goes live at `https://<owner>.github.io/<repo>/`.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to that address.

The workflow (`.github/workflows/deploy.yml`) sets the `/<repo>/` base path and copies `index.html` to `404.html`, so deep links like `/post/12` survive a refresh.

**Option B — Vercel or Netlify (import the GitHub repo)**
Framework preset **Vite**, build command `npm run build`, output `dist`, plus the two `VITE_SUPABASE_*` environment variables. SPA rewrites are already included (`vercel.json`, `public/_redirects`). Vercel can only import repos your GitHub account can access. If the repo belongs to a teammate, ask them to import it, or add you as a collaborator first.

---

## Project structure
```
supabase/
  migrations/          SQL schema (converted from the original MySQL design)
  seed_demo.sql        optional demo data
docs/
  legacy-mysql-schema.sql   the original MySQL schema, for reference
src/
  lib/                 supabase client, data API (api.js), formatting, geo helpers
  context/             auth + toast providers
  components/          layout, sidebar, PostCard, Composer, comments, share/report modals
  pages/               Home, Feed, Map, Marketplace, Services, LostFound, Events, Messages, Alerts, Profile
  admin/               admin layout, dashboard, users, reports, generic data tables
  styles/app.css       design system (Fraunces + Figtree, forest green on warm paper)
```

## Database at a glance
`profiles` (linked to `auth.users`) · `neighborhoods` · `posts` (shares = `shared_post_id`) · `reactions` · `comments` (one target: post / listing / event / lost & found / help, with `parent_id` replies) · `marketplace_listings` · `lost_found_items` · `events` + `event_participants` · `services` + `service_categories` · `help_requests` + `help_responses` · `emergency_alerts` · `conversations` + `conversation_members` + `messages` · `notifications` · `reports`

Views: `feed_posts` (post + author + counts + my reaction + shared post), `map_items` (everything with coordinates).
RPCs: `start_conversation`, `my_conversations`, `admin_stats`, `admin_users`.
Triggers: auto-create profile on sign-up, notifications for reactions / comments / shares / alerts / RSVPs / help offers, users can't change their own role or status, owners can't un-hide moderated content.
