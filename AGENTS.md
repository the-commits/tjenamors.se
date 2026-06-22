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
| Lint JS files | `npm run lint` (ESLint: `scripts/*.mjs tests/*.mjs src/js/*.js`) |
| Check line length | `npm run lint:lines` (max 120 cols) |
| Run all E2E tests | `node tests/mobile-centering.mjs && node tests/sun-fade.mjs` |
| Skip E2E on push | `SKIP_E2E=1 git push` |

## Workflow: trunk-based + TDD E2E

- **Branch**: short-lived feature branches off `main`, merged via PR (1 review required)
- **Main is protected** — direct pushes blocked, linear history required
- **TDD cycle**: write a Puppeteer test → run it (fails) → fix code → test passes → PR
- **Pre-push hook** (husky): runs lint → line-length → build → E2E tests.
  If the hook blocks you, fix the issue, `git add` the fix, and retry the push.
  To skip E2E tests (slow), set `SKIP_E2E=1`.
- **Commits must be signed**: `git commit -S -m "type: message"`

## Cloudflare preview URLs

Pushing any branch to GitHub automatically creates a Cloudflare Pages preview
URL (e.g. `https://feature-modular-refactor.tjenamors.pages.dev`). Use this to
verify changes in production-like environment before merging to `main`.

To get the preview URL after a push:
```
gh run list --branch <branch-name> --json headBranch,databaseId \
  --jq '.[0].databaseId' | xargs gh run view --log | grep "preview\|pages.dev"
```

Or check the Cloudflare Dashboard → Pages → tjenamors → <branch-name>.

## E2E testing (puppeteer)

E2E tests live in `tests/` and use Puppeteer (install via `npm install`).
Run with: `node tests/<name>.mjs`

Two test suites exist (56 tests total):
- `tests/mobile-centering.mjs` — 46 tests across 7 viewports for responsive layout
- `tests/sun-fade.mjs` — 10 tests for sun opacity on play/pause and button text

### test server

Tests serve `dist/` via `tests/serve.mjs` (Node.js HTTP server) to circumvent
`file://` CORS restrictions on ES modules. Imported automatically — no manual
setup needed.

## Code style

Follow **DRY** (no duplication), **SRP** (one responsibility per file), and
**KISS** (simple over clever). Keep files short and focused.

- Use ES module `import`/`export` in JS (all under `src/js/`).
- Use CSS `@import` to compose modules (entry via `src/css/style.css`).
- Use Tailwind utility classes in HTML for layout/spacing; keep complex visual
  effects (gradients, shadows, keyframes) in CSS modules.
- Generated/minified assets (`src/build/assets/`) are excluded from this rule.

## Where to edit

Edit `src/*` — do **not** edit `dist/` (generated, gitignored).

- `src/index.html` — HTML structure only, ≤120 chars per line
- `src/css/*` — all visual styles (synthwave sun, grid, player, buttons)
- `src/js/*` — all client logic (HLS/MP3, API polling, timeline, cookie, sun)
- `src/build/assets/base.css` — minified Tailwind v3.3.3 + DaisyUI, fragile
- `src/build/assets/*-legacy.css` — orphaned Vite/Vue artifacts, not loaded
- `src/robots.txt` — has Cloudflare-managed block between `BEGIN` / `END
  Cloudflare Managed content` markers; edits outside them are safe

Root-level files to know about:
- `eslint.config.mjs` — ESLint flat config (v10+), max-len 120, ES2022 env
- `scripts/*.mjs` — build, lint, radio API proxy

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
