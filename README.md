# Tick

A habit tracker. React + shadcn/ui front end, tiny dependency-free Node server, data in a JSON file.

- **Habits view:** 5-day window (2 days back, today, 2 ahead) or a full week; page through time with the arrows.
- **Dashboard:** today's progress, best streak, 7-day completion rate, total ticks, 14-day chart, per-habit weekly bars.
- Responsive: tabs on phones, side-by-side on desktop. Light/dark.

## Run with Docker

```
docker compose up --build
```

Open http://localhost:3000. Data persists in the `tick-data` volume.

## Run on Windows (no Docker)

Requires Node.js 20+.

```
.\launcher.ps1                 # installs, builds if needed, starts, opens browser
.\launcher.ps1 -Port 8080 -NoBrowser
.\launcher.ps1 -Rebuild
```

Data is stored in `.\data\habits.json` (change with `-DataDir`).

## Sign-in

Tick has a single username + password account.

- **First run:** the first person to open the app is asked to create the account. If the server is reachable by others
  before you've done that, set `TICK_USERNAME` and `TICK_PASSWORD` instead (see `docker-compose.yml`): the account is
  created at startup and nobody can claim it first.
- Passwords are stored as salted **scrypt** hashes (never plain text) in `auth.json` next to the data. Minimum 8 characters.
- You stay signed in for 30 days (HttpOnly, SameSite=Strict cookie, signed with a key in `secret.key`; both files live in
  the data folder). Sign out is the door icon in the header.
- All habit data endpoints require sign-in. Failed logins are rate-limited (8 per 15 minutes per address), and cross-origin
  writes are rejected. Responses carry CSP / no-sniff / no-framing headers.
- **Behind HTTPS** (reverse proxy)? Have it send `X-Forwarded-Proto: https` so the cookie is marked `Secure`.
- **Forgot the password?** Stop Tick and delete `auth.json` from the data folder (Docker: `docker compose exec tick rm /data/auth.json`,
  then restart). Your habits are untouched; you'll be asked to create the account again. Deleting `secret.key` signs everyone out.

## Develop

```
npm run server   # API on :3000 (needs a build for static files, or just use dev below)
npm run dev      # Vite dev server, proxies /api to :3000
```
