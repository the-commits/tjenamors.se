# AGENTS.md

> **Personal instructions:** Per-developer overrides go in `.opencode/personal/AGENTS.md` (gitignored).

## ⚠️ CRITICAL — this repo is PUBLIC

NEVER commit secrets — API tokens, passwords, private keys, `.env` files,
connection strings. Check `git diff` and `git status` before committing.

Secrets go in Cloudflare Pages dashboard Variables and secrets; never in the
repo. Use `gh secret set` / `gh variable set` if you must script it.

## What this is

`tjenamors.se` is a single-page synthwave-themed radio station website.
`scripts/build.mjs` copies `src/` → `dist/`. Cloudflare Pages
(project `tjenamors`, production `main`, framework preset None) builds and
serves `dist/`.

## Developer commands

| Goal | Command |
|------|---------|
| Build | `node scripts/build.mjs` |
| Clean rebuild | `rm -rf dist && node scripts/build.mjs` |
| Radio API mgmt | `node scripts/azuracast.mjs <command>` |
| Lint JS files | `npm run lint` (ESLint: `scripts/*.mjs tests/*.mjs src/js/app.js`) |
| Check line length | `npm run lint:lines` (max 120 cols) |
| Run all E2E tests | `node tests/mobile-centering.mjs && node tests/sun-fade.mjs` |

## Workflow: trunk-based + TDD E2E

- **Branch**: short-lived feature branches off `main`, merged via PR (1 review required)
- **Main is protected** — direct pushes blocked, linear history required
- **TDD cycle**: write a Puppeteer test → run it (fails) → fix code → test passes → PR
- **Pre-push hook** (husky): runs `npm run lint && npm run lint:lines` before every push.
  If the hook blocks you, fix the issue, `git add` the fix, and retry the push.
- **Commits must be signed**: `git commit -S -m "type: message"`

## E2E testing (puppeteer)

E2E tests live in `tests/` and use Puppeteer (install via `npm install`).
Run with: `node tests/<name>.mjs`

Two test suites exist:
- `tests/mobile-centering.mjs` — 46 tests across 7 viewports for responsive layout
- `tests/sun-fade.mjs` — 10 tests for sun opacity on play/pause and button text

## Where to edit

- **`src/index.html`** — HTML structure only (47 lines). Do **not** edit `dist/`
  (generated, gitignored). Keep every line ≤120 chars.
- **`src/css/style.css`** — all visual styles (synthwave sun, grid, player,
  buttons, responsive breakpoints). 348 lines.
- **`src/js/app.js`** — all client-side logic (HLS/MP3 streaming, AzuraCast API
  polling, timeline rendering, cookie position save/restore, sun fade, grid
  timing). 483 lines.
- `src/build/assets/base.css` is minified Tailwind v3.3.3 + DaisyUI —
  hand-editing is fragile.
- `src/build/assets/*-legacy.css` are orphaned Vite/Vue artifacts, not loaded.
- `src/robots.txt` has a Cloudflare-managed block between `BEGIN` / `END
  Cloudflare Managed content` markers; edits outside them are safe.
- `eslint.config.mjs` — ESLint flat config (v10+), max-len 120, ES2022 env.
- `scripts/check-line-length.mjs` — post-build line-length linter, excludes
  generated dirs.

## Radio streaming

The site uses HLS.js (primary) with MP3 fallback for a live stream from
AzuraCast. API endpoints (from `src/js/app.js` constants):
- Now Playing API: `https://radio.tjenamors.se/api/nowplaying/1`
- HLS stream: `https://radio.tjenamors.se/hls/tjenamors_radio/live.m3u8`
- MP3 stream: `https://radio.tjenamors.se/listen/tjenamors_radio/radio.mp3`

### Art sync & timeline principle

**The API `now_playing.elapsed` field is the source of truth** for the timeline
position — not `audio.currentTime` or wall-clock timestamps. The API is polled
every 2s. An `elapsedCapturedAt` timestamp tracks when each `elapsed` value was
received, allowing smooth interpolation between polls. The position is clamped
to `[0, song.duration]`.

Artist/song/cover art only updates when the API reports a new `now_playing`
song (by `song.id`). Cover art is preloaded via `Image()` constructor
immediately after each API poll for all URLs in the response (history, now,
next). Do not pre-emptively switch songs based on calculated end times — if the
API lags by 1-2 songs, that's acceptable over switching too early.

All seeking features (skip buttons, scrub drag) are removed since the stream
has no DVR window.

### Other behavior

- Autoplay starts muted (browser policy); first click unmutes.
- Position saved every 5s in a `tj_pos` cookie, restored within 1-hour window.
- The synthwave sun (`#sun`) fades to 0.1 opacity while audio plays, returns
  to 1 on pause (CSS `transition: opacity 2s ease`). Button text toggles
  between `▶` and `❚❚`.
- The grid (`#grid-container > .synth-grid`) runs `flyForward` at 4s, then
  slides down & fades out at 5s. Respects `prefers-reduced-motion: reduce`.

## MCP

`opencode.jsonc` configures the `chrome-devtools-mcp` MCP server. Always verify
visual changes with Chrome DevTools — snapshot the DOM, check console for
errors, and screenshot the result before committing.
