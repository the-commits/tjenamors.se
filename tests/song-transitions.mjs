// E2E test: verify song info renders and cover art loads on production
// Usage: TEST_URL=https://tjenamors.se node tests/song-transitions.mjs
import puppeteer from 'puppeteer';

const url = process.env.TEST_URL || 'https://tjenamors.se';

let failures = 0;
let passed = 0;

function check(name, ok, detail) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failures++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

// Handle dialogs and page errors
page.on('pageerror', (err) => console.error('  page error:', err.message));
page.on('dialog', (dialog) => dialog.dismiss());

// Navigate with a longer timeout and no wait (we'll wait for elements manually)
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

// Wait for the player to appear (up to 30s for slow connections)
const playerFound = await page.waitForSelector('.player', { timeout: 30000 })
  .then(() => true)
  .catch(() => false);
check('Player element found', playerFound, 'player did not appear within 30s');
if (!playerFound) {
  await browser.close();
  process.exit(failures ? 1 : 0);
}

// Wait for autoplay to start (up to 10s for HLS to initialize on slow connections)
await new Promise(r => setTimeout(r, 4000));

// Helper: get current song info
async function getSong() {
  return page.evaluate(() => ({
    title: document.querySelector('#song-text')?.textContent || '',
    artist: document.querySelector('#artist')?.textContent || '',
    time: document.querySelector('#time')?.textContent || '',
    art: document.querySelector('#disc')?.style?.backgroundImage?.slice(0, 160) || '',
    playBtn: document.querySelector('#play-pause')?.innerHTML || '',
    liveBtn: document.querySelector('#live-btn')?.textContent || '',
  })).catch(() => null);
}

// Try to unmute (autoplay starts muted)
await page.evaluate(() => {
  const a = document.querySelector('audio');
  if (a && a.muted) {
    a.muted = false;
    a.play().catch(() => {});
  }
}).catch(() => {});

// Wait a moment for state to settle after unmute
await new Promise(r => setTimeout(r, 1000));

let song1 = await getSong();
if (!song1) {
  // Page may have navigated; try one reload
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 5000));
  song1 = await getSong();
}

console.log(`\n--- Song #1 ---`);
console.log(`  Title:   "${song1?.title || ''}"`);
console.log(`  Artist:  "${song1?.artist || ''}"`);
console.log(`  Time:    "${song1?.time || ''}"`);
check('Song #1 has title', !!song1?.title, 'no title text');
check('Song #1 has artist', !!song1?.artist, 'no artist text');
check('Song #1 time is non-empty', song1?.time?.length > 0, `got "${song1?.time}"`);
check('Song #1 has cover art', song1?.art?.includes('url('), 'no background-image');
check(
  'Play button exists',
  (song1?.playBtn?.includes('fa-play') || song1?.playBtn?.includes('fa-pause')),
  `got "${song1?.playBtn}"`,
);
check('Live button shows LIVE', song1?.liveBtn?.includes('LIVE'), `got "${song1?.liveBtn}"`);

// Click play if paused to start streaming
if (song1?.playBtn?.includes('fa-play')) {
  await page.evaluate(() => {
    const a = document.querySelector('audio');
    if (a) {
      a.muted = true;
      a.play().catch(() => {});
    }
  }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
}

// Wait for 2 song transitions by polling every 2s (up to 5 minutes)
let song2 = null;
let song3 = null;
let lastTitle = song1?.title || '';
let stableChecks = 0;

console.log(`\n--- Waiting for transitions (every 2s, up to 5min) ---`);

for (let i = 0; i < 150; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const cur = await getSong().catch(() => null);
  if (!cur?.title) continue;

  if (cur.title !== lastTitle) {
    if (!song2) {
      song2 = cur;
      console.log(`\n  → Song #2 at transition ${i * 2}s`);
      console.log(`  Title:   "${song2.title}"`);
      console.log(`  Artist:  "${song2.artist}"`);
      check('Song #2 has title', !!song2.title);
      check('Song #2 has artist', !!song2.artist);
      check('Song #2 has cover art', song2.art?.includes('url('));
      lastTitle = cur.title;
    } else if (!song3) {
      song3 = cur;
      console.log(`\n  → Song #3 at transition ${i * 2}s`);
      console.log(`  Title:   "${song3.title}"`);
      console.log(`  Artist:  "${song3.artist}"`);
      check('Song #3 has title', !!song3.title);
      check('Song #3 has artist', !!song3.artist);
      check('Song #3 has cover art', song3.art?.includes('url('));
      break;
    }
  } else {
    stableChecks++;
  }
}

if (!song2) { failures++; console.log('  ✗ Never detected song #2 transition (5min timeout)'); }
if (!song3) { failures++; console.log('  ✗ Never detected song #3 transition (5min timeout)'); }

console.log(`\n--- Summary ---`);
if (song1) console.log(`1: "${song1.title}" — ${song1.artist}`);
if (song2) console.log(`2: "${song2.title}" — ${song2.artist}`);
if (song3) console.log(`3: "${song3.title}" — ${song3.artist}`);

console.log(`\n===== Results: ${passed} passed, ${failures} failed =====`);
await browser.close().catch(() => {});
process.exit(failures ? 1 : 0);
