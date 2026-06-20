# AGENTS.md

## ⚠️ CRITICAL — this repo is PUBLIC

NEVER commit secrets — API tokens, passwords, private keys, `.env` files,
connection strings. Check `git diff` and `git status` before committing.

Secrets go in Cloudflare Pages dashboard Variables and secrets; never in the
repo. Use `gh secret set` / `gh variable set` if you must script it.

## What this is

`tjenamors.se` is a single-page synthwave-themed radio station website.
Everything (HTML, CSS, JS) is inline in `src/index.html`. `scripts/build.mjs`
copies `src/` → `dist/`. Cloudflare Pages (project `tjenamors`, production
`main`, framework preset None) builds and serves `dist/`.

## Developer commands

| Goal | Command |
|------|---------|
| Build | `node scripts/build.mjs` |
| Clean rebuild | `rm -rf dist && node scripts/build.mjs` |
| Radio API mgmt | `node scripts/azuracast.mjs <command>` |

## Workflow: trunk-based + TDD E2E

- **Branch**: short-lived feature branches off `main`, merged via PR (1 review required)
- **Main is protected** — direct pushes blocked, linear history required
- **TDD cycle**: write a Puppeteer test → run it (fails) → fix code → test passes → PR

## E2E testing (puppeteer)

E2E tests live in `tests/` and use Puppeteer (install via `npm install`).
Run with: `node tests/<name>.mjs`

## Where to edit

- **`src/index.html`** — all visuals, layout, JS logic, and inline `<style>`.
  Do **not** edit `dist/` (generated, gitignored).
- `src/build/assets/app-70c7238d.css` is minified Tailwind v3.3.3 + DaisyUI.
  Has `[data-v-...]` scoped selectors — hand-editing is fragile.
- Other `src/build/assets/*.css` are orphaned Vite/Vue artifacts, not loaded.
- `src/robots.txt` has a Cloudflare-managed block between `BEGIN` / `END
  Cloudflare Managed content` markers; edits outside them are safe.

## Radio streaming

The site uses HLS.js (primary) with MP3 fallback for a live stream from
AzuraCast. Key endpoints (inlined in `src/index.html`):
- Now Playing API: `https://radio.tjenamors.se/api/nowplaying/1`
- HLS stream: `https://radio.tjenamors.se/hls/tjenamors_radio/live.m3u8`
- MP3 stream: `https://radio.tjenamors.se/listen/tjenamors_radio/radio.mp3`

Autoplay starts muted (browser policy); first click unmutes. Position is saved
every 5s in a `tj_pos` cookie and restored on next visit (1-hour window).

## Grid animation (WCAG)

The synthwave grid (`#grid-container > .synth-grid`) runs `flyForward` at 4s,
then slides down & fades out at 5s. Respects `prefers-reduced-motion: reduce`.

## MCP

`opencode.jsonc` configures the `chrome-devtools-mcp` MCP server (installed on
project level so all contributors get it). Tools available after restart:
navigate, screenshot, console inspection, script evaluation, etc.
