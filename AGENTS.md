# AGENTS.md

## What this is

`tjenamors.se` is a single-page synthwave-themed static site. The repo currently
holds **only the published output** — there is no source project, no
`package.json`, no build tooling, no tests, and no linter. Do not look for or run
`npm` / `bun` / `pnpm` commands; none exist here.

## Editing styles — where to change things

The synthwave visuals (logo gradient, perspective grid, sun, city animation)
live as **inline `<style>` in `index.html`**, not in `build/assets/`. Edit
`index.html` directly to change the look.

`build/assets/app-70c7238d.css` is the minified Tailwind v3.3.3 + DaisyUI base
and the only stylesheet `index.html` loads. The other two files in
`build/assets/` (`SynthwaveLogo-*.css`, `TjenaMors-*.css`) are Vite/Vue
component artifacts that are **not referenced** by `index.html` — their styles
were inlined instead. They are effectively orphaned.

All `build/assets/*.css` carry `[data-v-...]` scoped selectors and content
hashes from a Vite/Vue build. Hand-editing them is fragile.

## robots.txt

Contains a Cloudflare-managed block (between the `BEGIN` / `END Cloudflare
Managed content` markers). That section may be overwritten by Cloudflare; edits
outside the markers are safe.

## Planned changes (not yet implemented)

- The Vue/Vite + Tailwind + DaisyUI **source project will be moved into this
  repo**. Once present, `build/assets/` becomes generated output and should not
  be hand-edited.
- Deployment is **manual today**; the goal is **Cloudflare Pages auto-deploy on
  push to `main`**.
