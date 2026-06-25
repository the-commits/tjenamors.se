// E2E tests: ABR quality selection and song-info accuracy at different network speeds.
// Serves dist/ locally (circumvents file:// CORS) so our code changes (window.__hls)
// are available. The actual HLS/MP3 streams still come from radio.tjenamors.se (api.js).
//
// Must-have speeds: 1 Mbps, 10 Mbps, 100 Mbps.
// ABR should converge within ~3 HLS fragments (~180s at 60s segment duration).
// Song info (title, artist, position) must render correctly at every speed.
//
// Set TEST_URL to test against production (e.g., after deploy).

import puppeteer from 'puppeteer';
import { serve } from './serve.mjs';
import {
  throttleNetwork,
  resetNetwork,
  getHlsLevel,
  getHlsLevels,
  getFragLoaded,
  getSongInfo,
  waitFor,
} from './helpers/network.mjs';

const { server, url } = await serve();
const URL = process.env.TEST_URL || url;
const ABR_TIMEOUT = 120_000; // 2 min max per speed for ABR to settle
const POLL_INTERVAL = 5_000; // check every 5s

// Must-have speeds in bits per second
const MUST_HAVE = [
  { label: '1 Mbps',   bps: 1_000_000,   minBitrate: 48_000 },   // at least aac_lofi
  { label: '10 Mbps',  bps: 10_000_000,  minBitrate: 128_000 },  // at least aac_hifi
  { label: '100 Mbps', bps: 100_000_000, minBitrate: null },     // should reach highest
];

// Nice-to-have speeds (will test if ALL_NETWORKS env is set)
const NICE_TO_HAVE = [
  { label: '2G (50 kbps)',     bps: 50_000,     minBitrate: null },
  { label: '3G (400 kbps)',    bps: 400_000,    minBitrate: 48_000 },
  { label: 'Slow 4G (1 Mbps)', bps: 1_000_000,  minBitrate: 48_000 },
  { label: '4G (4 Mbps)',      bps: 4_000_000,  minBitrate: 128_000 },
  { label: 'Slow 5G (10 Mbps)', bps: 10_000_000, minBitrate: 128_000 },
  { label: '5G (50 Mbps)',     bps: 50_000_000, minBitrate: null },
  { label: '500 Mbps',         bps: 500_000_000, minBitrate: null },
];

const speeds = process.env.ALL_NETWORKS
  ? [...MUST_HAVE, ...NICE_TO_HAVE]
  : MUST_HAVE;

let globalFailures = 0;
let globalPassed = 0;

function check(label, ok, detail) {
  if (ok) {
    console.log(`  ✓ ${label}`);
    globalPassed++;
  } else {
    console.error(`  ✗ ${label} — ${detail}`);
    globalFailures++;
  }
}

/**
 * Check that ABR selected an appropriate quality level for the network speed.
 * Polls until the expected bitrate is reached or timeout.
 */
async function checkAbrQuality(page, speed) {
  const { label, bps, minBitrate } = speed;

  // Wait for HLS to initialize (hls object with levels)
  const hlsReady = await waitFor(
    page,
    () => getHlsLevel(page).then((l) => l !== null),
    ABR_TIMEOUT,
    POLL_INTERVAL,
  );
  check(`${label}: HLS initialized`, !!hlsReady, 'HLS did not initialize within timeout');
  if (!hlsReady) return;

  // Read all available levels
  const levels = await getHlsLevels(page);
  check(`${label}: Has HLS levels`, levels.length > 0, `got ${levels.length} levels`);
  if (levels.length === 0) return;

  // Sort by bitrate
  const sorted = [...levels].sort((a, b) => a.bitrate - b.bitrate);
  const highest = sorted[sorted.length - 1];
  const lowest = sorted[0];

  const lowK = (lowest.bitrate / 1000).toFixed(0);
  const highK = (highest.bitrate / 1000).toFixed(0);
  console.log(`  ${label}: ${levels.length} levels (${lowK}–${highK} kbps)`);

  // Determine minimum expected bitrate for this speed
  let targetBitrate;
  if (minBitrate !== null) {
    targetBitrate = minBitrate;
  } else if (bps >= 100_000_000) {
    // 100 Mbps+: expect nearly the highest level (within 10% of max)
    targetBitrate = highest.bitrate * 0.9;
  } else if (bps >= 10_000_000) {
    targetBitrate = 128_000;
  } else if (bps >= 1_000_000) {
    targetBitrate = 48_000;
  } else {
    // Very slow networks: just staying on the lowest is acceptable
    targetBitrate = lowest.bitrate;
  }

  // Wait for ABR to reach the target bitrate or for fragments to accumulate
  const abrResult = await waitFor(
    page,
    async () => {
      const level = await getHlsLevel(page);
      if (!level) return null;
      const frag = await getFragLoaded(page);

      // ABR reached target
      if (level.bitrate >= targetBitrate) {
        return { ...level, frag, status: 'reached' };
      }

      // If enough fragments loaded and still on low level, check progress
      if (frag >= 3) {
        return { ...level, frag, status: 'settled' };
      }

      return null;
    },
    ABR_TIMEOUT,
    POLL_INTERVAL,
  );

  if (abrResult) {
    const pct = highest.bitrate > 0
      ? ((abrResult.bitrate / highest.bitrate) * 100).toFixed(1)
      : '0';
    check(
      `${label}: ABR reached ≥${(targetBitrate / 1000).toFixed(0)} kbps`,
      abrResult.bitrate >= targetBitrate,
      `level ${abrResult.index} @ ${(abrResult.bitrate / 1000).toFixed(0)} kbps (${pct}% of max), ` +
        `${abrResult.frag} fragments loaded, status: ${abrResult.status}`,
    );
  } else {
    // Timeout — read final state
    const final = await getHlsLevel(page);
    const frag = await getFragLoaded(page);
    check(
      `${label}: ABR converged within timeout`,
      false,
      `final level ${final?.index ?? '?'} @ ${(final?.bitrate ?? 0) / 1000} kbps, ${frag} fragments`,
    );
  }
}

/**
 * Check that song info renders correctly at the current speed.
 * Verifies title, artist, time, and that the display is live.
 */
async function checkSongInfo(page, speed) {
  const { label } = speed;

  // Wait for song info to appear (not the default "TjenaMors Radio")
  const song = await waitFor(
    page,
    async () => {
      const info = await getSongInfo(page);
      if (!info) return null;
      // Must have a real song title (not the placeholder)
      if (info.title && info.title !== 'TjenaMors Radio') return info;
      return null;
    },
    60_000, // 1 min to get song info
    2_000,
  );

  check(`${label}: Song title loaded`, !!song?.title, `got "${song?.title ?? 'null'}"`);
  check(`${label}: Artist loaded`, !!song?.artist, `got "${song?.artist ?? 'null'}"`);
  check(`${label}: Time label non-empty`, !!song?.time, `got "${song?.time ?? 'null'}"`);

  if (song) {
    console.log(`  ${label}: "${song.title}" — ${song.artist} @ ${song.time}`);
  }

  // Verify position advances over time
  const info1 = await getSongInfo(page);
  await new Promise((r) => setTimeout(r, 5_000));
  const info2 = await getSongInfo(page);

  if (info1 && info2) {
    check(
      `${label}: Same song persists after 5s`,
      info1.title === info2.title,
      `"${info1.title}" → "${info2.title}"`,
    );
    check(
      `${label}: Position advances`,
      info2.time !== info1.time,
      `"${info1.time}" → "${info2.time}"`,
    );
  }

}

async function run() {
  const browser = await puppeteer.launch({ headless: true });

  for (const speed of speeds) {
    console.log(`\n═══════════════════════════════════════════`);
    console.log(`  Speed: ${speed.label} (${(speed.bps / 1_000_000).toFixed(1)} Mbps)`);
    console.log(`═══════════════════════════════════════════`);

    const page = await browser.newPage();

    // Collect console errors
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    // Throttle BEFORE navigation so the entire page loads under the target speed.
    // Using page.createCDPSession() (not page.target().createCDPSession()) to
    // avoid detached frame issues in Puppeteer 25.
    const cdp = await throttleNetwork(page, speed.bps);

    try {
      await page.goto(URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      }).catch(() => {});

      // Wait for the player to appear
      const playerFound = await page.waitForSelector('.player', { timeout: 30_000 })
        .then(() => true)
        .catch(() => false);
      check(`${speed.label}: Player loaded`, playerFound, '.player not found within 30s');

      if (playerFound) {
        // Allow HLS to initialize
        await new Promise((r) => setTimeout(r, 5_000));

        // ABR quality check
        await checkAbrQuality(page, speed);

        // Song info check
        await checkSongInfo(page, speed);

        // Check for console errors (ignore benign extension/favicon errors)
        const ourErrors = consoleErrors.filter(
          (e) => !e.includes('content-utils.js')
            && !e.includes('extension')
            && !e.includes('favicon.ico')
            && !e.includes('404 (Not Found)'),
        );
        check(
          `${speed.label}: No console errors`,
          ourErrors.length === 0,
          ourErrors.length ? ourErrors[0] : '',
        );
        if (ourErrors.length > 0) {
          console.error(`  Console errors: ${ourErrors.join(', ')}`);
        }
      }
    } finally {
      await resetNetwork(cdp).catch(() => {});
    }

    await page.close().catch(() => {});

    // Brief cooldown between tests to let CDP clean up
    await new Promise((r) => setTimeout(r, 1_000));
  }

  await browser.close().catch(() => {});
  server.close();
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`===== Results: ${globalPassed} passed, ${globalFailures} failed =====`);
  process.exit(globalFailures ? 1 : 0);
}

run().catch((err) => {
  console.error('Test error:', err);
  server.close();
  process.exit(1);
});
