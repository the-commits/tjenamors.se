# tjenamors.se

Synthwave-radiostation byggd med **Tailwind CSS** (typ. vi kör `mt-[2.5em]` överallt och låtsas att det funkar).

## Kom igång

```bash
npm install
node scripts/build.mjs     # trollar om src/ → dist/
```

Ut kommer `dist/`. Cloudflare Pages deployar automatiskt från `main`, för att 2026 ska vara framtiden.

## Testa

```bash
# Flummiga individuella sviter
node tests/mobile-centering.mjs
node tests/sun-fade.mjs
node tests/player-spacing.mjs

# Kör allt (pre-push, typ 10 min av ditt liv)
npm run lint && npm run lint:lines && node scripts/build.mjs \
  && node tests/mobile-centering.mjs && node tests/sun-fade.mjs \
  && node tests/abr-speeds.mjs

# Testa mot prod (om du vågar)
TEST_URL=https://tjenamors.se node tests/player-spacing.mjs
```

## Deploya

Pusha till `main` — Cloudflare Pages får ett nervöst sammanbrott
och deployar `dist/`. Pre-push-hooken kör lint + build + E2E
(så man hinner ångra sig). Skippa med `SKIP_E2E=1 git push`
om du lever farligt.

---

**Lyssna på [tjenamors.se](https://tjenamors.se)** — retrobeats,
solnedgångar och ett grid som glider ut i tomheten. Inga frågor.
