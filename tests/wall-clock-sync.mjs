// E2E test: verify song info matches the audio position using API-based
// wall-clock calculation (played_at + elapsed - contentAge).
//
// Tests:
// 1. Song info renders with title and time label after HLS loads
// 2. goLive() seeks near the true edge (within 20s), not 30-60s behind
// 3. Live button shows active after goLive()
// 4. Song info time label position is within a reasonable range (not stuck)
//
// Usage: node tests/wall-clock-sync.mjs
//        TEST_URL=https://tjenamors.se node tests/wall-clock-sync.mjs

import puppeteer from 'puppeteer';
import { serve } from './serve.mjs';
import { waitFor } from './helpers/network.mjs';

const { server, url } = await serve();
const TEST_URL = process.env.TEST_URL || url;

let failures = 0;
let passed = 0;

function check(name, ok, detail) {
  if (ok) { passed++; console.log(`  \u2713 ${name}`); }
  else { failures++; console.error(`  \u2717 ${name}${detail ? ' \u2014 ' + detail : ''}`); }
}

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => console.error('  page error:', err.message));
page.on('dialog', (dialog) => dialog.dismiss());

await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await page.waitForSelector('.player', { timeout: 30000 }).catch(() => {});

// Wait for song info to render (HLS loads + API returns data)
console.log('\n--- Waiting for song info to render ---');

const songInfo = await waitFor(page, async () => {
  return page.evaluate(() => {
    const title = document.getElementById('song-text')?.textContent || '';
    const time = document.getElementById('time')?.textContent || '';
    if (title && title !== 'TjenaMors Radio' && time && time.includes('/')) {
      return { title, time };
    }
    return null;
  });
}, 60000, 2000);

check('Song info has title', !!songInfo?.title, `got "${songInfo?.title}"`);
check('Song info has time label', !!songInfo?.time, `got "${songInfo?.time}"`);

if (songInfo) {
  console.log(`  Title: "${songInfo.title}"`);
  console.log(`  Time:  "${songInfo.time}"`);

  // Parse time label: "1:23 / 4:56"
  const timeMatch = songInfo.time.match(/(\d+:\d+)\s*\/\s*(\d+:\d+)/);
  if (timeMatch) {
    const parseTime = (s) => {
      const [m, sec] = s.split(':').map(Number);
      return m * 60 + sec;
    };
    const pos = parseTime(timeMatch[1]);
    const dur = parseTime(timeMatch[2]);
    const pct = dur > 0 ? pos / dur : 0;
    console.log(`  Position: ${pos.toFixed(0)}s / ${dur.toFixed(0)}s (${(pct * 100).toFixed(0)}%)`);
    check('Position is between 0% and 100%', pct >= 0 && pct <= 1, `got ${(pct * 100).toFixed(0)}%`);
  }
}

// Test goLive() seeks near the edge
console.log('\n--- Testing goLive() ---');

// Click the live button
await page.evaluate(() => {
  const btn = document.getElementById('live-btn');
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 2000));

const liveState = await page.evaluate(() => {
  const audio = document.querySelector('audio');
  const hls = window.__hls;
  const seekableEnd = audio.seekable.length
    ? audio.seekable.end(audio.seekable.length - 1) : 0;
  const title = document.getElementById('song-text')?.textContent || '';
  const time = document.getElementById('time')?.textContent || '';
  const liveBtn = document.getElementById('live-btn');
  return {
    currentTime: audio.currentTime,
    seekableEnd,
    distFromEdge: seekableEnd ? seekableEnd - audio.currentTime : -1,
    liveSyncPosition: hls?.liveSyncPosition || null,
    isLive: liveBtn?.classList.contains('live') || false,
    title,
    time,
  };
});

console.log(`  currentTime    = ${liveState.currentTime.toFixed(1)}`);
console.log(`  seekableEnd    = ${liveState.seekableEnd.toFixed(1)}`);
console.log(`  distFromEdge   = ${liveState.distFromEdge.toFixed(1)}s`);
console.log(`  liveSyncPos    = ${liveState.liveSyncPosition?.toFixed(1) || 'null'}`);
console.log(`  title          = "${liveState.title}"`);
console.log(`  time           = "${liveState.time}"`);

// After goLive(), user should be within 20s of the true edge
check('goLive() seeks within 20s of true edge', liveState.distFromEdge >= 0 && liveState.distFromEdge <= 20,
  `distance from edge is ${liveState.distFromEdge.toFixed(1)}s`);

// goLive() should NOT seek to liveSyncPosition (which is 30s from edge)
if (liveState.liveSyncPosition) {
  const distFromSyncPos = Math.abs(liveState.currentTime - liveState.liveSyncPosition);
  check('goLive() does not seek to liveSyncPosition (30s from edge)',
    distFromSyncPos > 5,
    `only ${distFromSyncPos.toFixed(1)}s from liveSyncPosition`);
}

// Live button should show active after goLive()
check('Live button shows active after goLive()', liveState.isLive, 'live class not set');

// Song info should still be reasonable after goLive (not "TjenaMors Radio")
check('Song title is set after goLive', !!liveState.title && liveState.title !== 'TjenaMors Radio',
  `got "${liveState.title}"`);

// Time label should have valid format
check('Time label has valid format after goLive',
  /^\d+:\d+\s*\/\s*\d+:\d+$/.test(liveState.time),
  `got "${liveState.time}"`);

await browser.close();
server.close();

console.log(`\n===== Results: ${passed} passed, ${failures} failed =====`);
process.exit(failures ? 1 : 0);