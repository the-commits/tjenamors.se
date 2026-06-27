# tjenamors.se

Synthwave-themed radio station website. Built with vanilla HTML, CSS & JS.

## Develop

```bash
npm install
node scripts/build.mjs     # src/ → dist/
```

Output lands in `dist/`. Cloudflare Pages auto-deploys `dist/` from `main`.

## Test

```bash
# Individual suites
node tests/mobile-centering.mjs
node tests/sun-fade.mjs
node tests/player-spacing.mjs

# Run all (pre-push)
npm run lint && npm run lint:lines && node scripts/build.mjs \
  && node tests/mobile-centering.mjs && node tests/sun-fade.mjs \
  && node tests/abr-speeds.mjs

# Test production
TEST_URL=https://tjenamors.se node tests/player-spacing.mjs
```

## Deploy

Push to `main` — Cloudflare Pages picks up `dist/` automatically. Pre-push
hook runs lint + build + E2E tests. Skip with `SKIP_E2E=1 git push`.

---

**Tune in at [tjenamors.se](https://tjenamors.se)** — retro beats, sunset
gradients, and a grid that slides into the void.
