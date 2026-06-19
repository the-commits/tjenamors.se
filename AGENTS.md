# AGENTS.md

## ⚠️ CRITICAL — this repo is PUBLIC

This repository is **public**. NEVER commit, paste, or hard-code secrets of any
kind — API tokens, passwords, private keys, `.env` files, connection strings,
or anything that should stay private. Before committing, check `git diff` and
`git status` for anything that looks like a secret. When in doubt, do not
commit it.

Manage variables and secrets with the **GitHub CLI (`gh`)**, never in the repo:
- Repo-level: `gh variable set <NAME> --body <value>` / `gh secret set <NAME> --body <value>`
- Environment-level: `gh variable set <NAME> --env <env> --body <value>` / `gh secret set <NAME> --env <env> --body <value>`

Use Cloudflare Pages **Variables and secrets** (dashboard) for any build/runtime
secrets the Pages deploy needs — never put them in the repo.

## What this is

`tjenamors.se` is a single-page synthwave-themed static site. Source files live
in `src/`; `scripts/build.mjs` copies `src/` → `dist/`. Cloudflare Pages runs
`bun run build` on push to `main` and serves `dist/`.

## Developer commands

| Goal | Command |
|------|---------|
| Build (src/ → dist/) | `bun run build` |
| Clean rebuild | `rm -rf dist && bun run build` |

No tests, no linter, no dev server yet. The build script uses only `node:fs`
APIs, so it runs under either `bun` or `node`.

## Editing styles — where to change things

Edit **`src/index.html`** — the synthwave visuals (logo gradient, perspective
grid, sun, city animation) live as inline `<style>` there. Do **not** edit
`dist/`; it is generated and gitignored.

`src/build/assets/app-70c7238d.css` is the minified Tailwind v3.3.3 + DaisyUI
base and the only stylesheet `src/index.html` loads. The other two files in
`src/build/assets/` (`SynthwaveLogo-*.css`, `TjenaMors-*.css`) are Vite/Vue
component artifacts that are **not referenced** by `index.html` — their styles
were inlined instead. They are effectively orphaned.

All `src/build/assets/*.css` carry `[data-v-...]` scoped selectors and content
hashes from a Vite/Vue build. Hand-editing them is fragile.

## robots.txt

`src/robots.txt` contains a Cloudflare-managed block (between the `BEGIN` /
`END Cloudflare Managed content` markers). That section may be overwritten by
Cloudflare; edits outside the markers are safe.

## Cloudflare Pages

Project name `tjenamors`, production branch `main`. Config:
- Build command: `bun run build`
- Build output directory: `dist`
- Framework preset: None

## Planned changes (not yet implemented)

- The Vue/Vite + Tailwind + DaisyUI **source project will be moved into this
  repo**. Once present, `src/build/assets/` becomes generated output from that
  build and the copy-based `scripts/build.mjs` is replaced by the real Vite
  build.
