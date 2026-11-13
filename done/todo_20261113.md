# Tick TODO

## Phase 1: Bugs and trust issues
~~- [ ] Emoji: `src/lib/api.ts:24-25` never sends emoji on create and sends `emoji: ""` on rename. Make client and server agree (real `emoji` field plus a picker in `add-habit-dialog.tsx`)~~
- [x] Server date validation (`server/index.mjs:12`): reject invalid calendar dates and dates beyond today+1. Fix the UTC `createdAt` (~line 258)
  - [x] Add `isValidDate(s)`: matches `DATE_RE` and round-trips through `Date.UTC` (rejects `2024-99-99`, `2025-02-30`)
  - [x] `PUT /days/:date` (line 289): return 400 for invalid dates and for dates later than today+1 (one day of slack for timezones)
  - [x] `createdAt` (line 258): accept the client value only if valid, else use the server's local date instead of the UTC `toISOString()` date
- [x] Toggle race (`App.tsx:112-116`): serialize per-habit/day PUTs or ignore stale responses
  - [x] In `src/lib/api.ts`, chain `setDay` requests per `habitId:date` key so they reach the server in order
  - [x] Only reload on failure when no newer request for that key is pending
- [x] Wrap `decodeURIComponent` in `serveStatic` (`server/index.mjs:300`) so a bad URL returns 400, not 500 - also make it fun , like the tick is dead or something
  - [x] On failure, return a self-contained HTML page with status 400: a dead tick (x-eyes, legs up), "This tick is dead. That link is malformed.", and a "Back to the herd" link to `/`
  - [x] Inline CSS only (the CSP allows inline styles, no scripts); support dark and light via `prefers-color-scheme`
- [x] Fix README claims to match the code
  - [x] Line 7: Monday-based week view with paging (no 5-day window)
  - [x] Line 78: no emoji picker; start the habit name with an emoji
  - [x] Line 79: future days can't be ticked (remove "tick ahead")
- [x] Move `shadcn` to devDependencies (`cn` stays: it is the shadcn team's own package and 14 files import it)
  - [x] Refresh `package-lock.json` with `npm install`
- [x] Verify Phase 1: `npm run build`, `npx tsc -b`, `curl` bad date / far-future date / `GET /%E0%A4%A` all return 400
  - [x] Rapid-toggle a day in the browser and confirm it matches after reload (headless Chromium, 0-300ms random latency on the day PUTs, 7/8/15/20 rapid clicks: UI and server state matched every time)
~~- [ ] Add a light-mode `theme-color` in `index.html:9`~~

## Phase 2: Safety net and tooling
- [x] Export/import: `GET /api/export`, `POST /api/import`, plus UI buttons - but only on desktop mode (not mobile)
  - [x] Server: export downloads a JSON backup; import validates and rebuilds every habit from known fields (5MB cap, 500 habits max), then replaces all data
  - [x] UI: download/upload icons in the header, shown at the `lg` breakpoint and up only, with a confirm dialog before import replaces everything
~~- [ ] Undo for delete (toast with Undo, replacing confirm-only)    ~~
- [x] Tests: Vitest for `src/lib/habits.ts` and `streaks.ts`; `node:test` for server routes
  - [x] 18 unit tests (`src/lib/*.test.ts`) and 9 server tests (`server/test/server.test.mjs`: auth, CRUD, date validation, dead-tick page, export/import); `npm test` runs both
- [x] CI: run `tsc`, lint and tests before the Docker build (new `check` job; the image build `needs: check`)
- [x] Add Dependabot (npm, GitHub Actions, Docker; weekly), `LICENSE` (MIT, assumed - change if you want another), `CHANGELOG.md`
- [x] Stop hand-pinning the image tag in `docker-compose.yml:3` (now `${TICK_VERSION:-latest}`)

## Phase 3: Features
- [x] PWA: manifest and a minimal service worker
  - [x] `manifest.webmanifest`, 192/512 and maskable icons (rendered from the logo), `sw.js` app-shell cache (network-first pages, cache-first `/assets`, `/api` never cached), registered in production builds only
~~- [ ] Flexible schedules (weekdays, N per week) and per-habit best-ever streak~~
- [x] Habit detail view (month calendar, longest streak, rate over time, notes) - maybe as it's own pages. dashboard -> habit detail , not within the today screen.
  - [x] Own page at `#/habit/<id>` (hash route, no new dependency), linked from the dashboard's "This week by habit" rows only; the month calendar is tickable
  - [x] New helpers `longestStreak`, `lifetimeRate`, `weeklyRates`, `monthCells` with unit tests
- [x] Reorder and archive habits
  - [x] Reorder by press-and-hold then drag (`src/lib/use-long-press-reorder.ts`, no dependency; mouse + touch, auto-scroll, keyboard fallback buttons shown on focus; saved via `PUT /api/habits/order`); archive/restore with an Undo toast and an "Archived" list (`archived` flag via PATCH; kept in export/import)
~~- [ ] Jump to date / month view for backfill~~
- [x] Password change endpoint and UI
  - [x] `POST /api/auth/password` (shares the login rate limiter, signs out other devices, returns a fresh session); the new account menu in the header holds Change password and Sign out


## Phase 4: Hardening and polish
- [x] Session revocation (done as server-side sessions in `sessions.json`: logout ends only that session, password change ends all; instead of a global version counter, which would have signed out every device on any logout)
- [x] Rate limit `/api/auth/setup` (own budget per address; every refused attempt counts)
- [x] `TRUST_PROXY` option for `X-Forwarded-For` in the login limiter (number of proxies; rightmost-N entry, ignored when unset)
- [x] HSTS header when behind HTTPS
- [x] gzip/brotli for static files
- [x] Lazy-load `celebrate.ts` (own 13 kB chunk, prefetched when idle)
- [x] Accessibility: keyboard- and touch-accessible heatmap details, better contrast on 10px muted labels, labeled and confirmed sign-out
~~- [ ] Reminders (web push; needs backend and VAPID keys, defer)~~
