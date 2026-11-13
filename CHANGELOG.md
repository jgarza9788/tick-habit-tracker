# Changelog

## 0.3.0 - 2026-11-13

### Added
- Export and import: download all habits as a JSON backup and restore it (desktop only; import replaces existing habits after confirmation).
- Tests: Vitest for streak/date logic, `node:test` for the server API. CI runs lint, typecheck and tests before building the image.
- Dependabot for npm, GitHub Actions and Docker; MIT `LICENSE`; this changelog.
- A dead-tick 400 page for malformed URLs.
- Habit detail page (`#/habit/<id>`, opened from the dashboard): current and longest streak, completion rate, tickable month calendar, last 12 weeks, notes.
- Archive and restore habits (with Undo), and reorder habits by pressing and holding a card and dragging it (mouse and touch; keyboard users get "Move up/down" buttons on focus).
- Change password from the new account menu (signs out other devices).
- Installable PWA: web manifest, icons and an app-shell service worker (habit data is never cached).
- Real session revocation: sign-ins are stored server-side (`sessions.json`), so signing out ends that session and changing the password ends all of them.
- `TRUST_PROXY` option so the login/setup rate limits see each visitor's address behind a reverse proxy; the account-setup endpoint is now rate limited too.
- `Strict-Transport-Security` header when the proxy reports HTTPS; brotli/gzip for the built JS, CSS and HTML.
- Heatmap days are keyboard- and touch-accessible, with a details line (arrow keys, tap, hover or focus).

### Changed
- Updating from an earlier version signs everyone out once (old cookies have no server-side session).
- The milestone celebration effects load as a separate chunk on demand (prefetched when idle).
- Better contrast: darker muted text in light mode, 11px instead of 10px labels, readable upcoming-day numbers.
- Signing out now asks for confirmation.
- Sign out moved into the account menu in the header.
- `docker-compose.yml` uses `${TICK_VERSION:-latest}` instead of a hand-pinned image tag.
- `shadcn` moved to devDependencies.
- README now matches the app (Monday-based week view, no emoji picker, future days can't be ticked).

### Fixed
- The server rejects impossible dates (`2025-02-30`) and days more than a day in the future.
- New habits default `createdAt` to the server's local date instead of the UTC date.
- Rapid taps on one day are sent in order, so the saved state always matches the last tap.
- A malformed URL no longer returns a 500.

## 0.2.0
- Renamed habits, new-habit dialog at top, npm audit fixes.

## 0.1.1
- Fixed `/data` permissions; README screenshots and docs.

## 0.1.0
- First release: image published to GHCR, configurable data volume.
