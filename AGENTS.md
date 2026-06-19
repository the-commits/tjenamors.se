# AGENTS.md

## ⚠️ CRITICAL — this repo is PUBLIC

NEVER commit, paste, or hard-code secrets — API tokens, passwords, private
keys, `.env` files, connection strings. Before committing, check `git diff` and
`git status` for anything that looks like a secret. When in doubt, do not
commit it.

Manage variables and secrets with the **GitHub CLI (`gh`)**, never in the repo:
- Repo-level: `gh variable set <NAME> --body <value>` / `gh secret set <NAME> --body <value>`
- Environment-level: `gh variable set <NAME> --env <env> --body <value>` / `gh secret set <NAME> --env <env> --body <value>`

Use Cloudflare Pages **Variables and secrets** (dashboard) for any build/runtime
secrets the Pages deploy needs — never put them in the repo.

## What this is

`tjenamors.se` is a single-page synthwave-themed static site. Source files live
in `src/`; `scripts/build.mjs` copies `src/` → `dist/`. Cloudflare Pages
(project `tjenamors`, production branch `main`) runs `bun run build` on push and
serves `dist/` (framework preset: None).

## Developer commands

| Goal | Command |
|------|---------|
| Build (src/ → dist/) | `bun run build` |
| Clean rebuild | `rm -rf dist && bun run build` |

No tests, no linter, no dev server. The build script uses only `node:fs` APIs,
so it runs under either `bun` or `node`.

## Editing styles — where to change things

Edit **`src/index.html`** — the synthwave visuals (logo gradient, perspective
grid, sun, city animation) live as inline `<style>` there. Do **not** edit
`dist/`; it is generated and gitignored.

`src/build/assets/app-70c7238d.css` is the minified Tailwind v3.3.3 + DaisyUI
base and the only stylesheet `src/index.html` loads. The other two files in
`src/build/assets/` (`SynthwaveLogo-*.css`, `TjenaMors-*.css`) are orphaned
Vite/Vue component artifacts — not referenced by `index.html` (their styles were
inlined). All `src/build/assets/*.css` carry `[data-v-...]` scoped selectors and
content hashes from a Vite/Vue build, so hand-editing them is fragile.

## robots.txt

`src/robots.txt` has a Cloudflare-managed block (between the `BEGIN` / `END
Cloudflare Managed content` markers) that may be overwritten by Cloudflare;
edits outside the markers are safe.

## Planned changes (not yet implemented)

- The Vue/Vite + Tailwind + DaisyUI **source project will be moved into this
  repo**. Once present, `src/build/assets/` becomes generated output and the
  copy-based `scripts/build.mjs` is replaced by the real Vite build.
