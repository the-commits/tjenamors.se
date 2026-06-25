// Network throttling presets and helpers for Puppeteer E2E tests.
// All values in bits per second (bps).

export const PRESETS = {
  '2G': 50_000,
  '3G': 400_000,
  'slow4G': 1_000_000,
  '4G': 4_000_000,
  'slow5G': 10_000_000,
  '5G': 50_000_000,
  '100mbps': 100_000_000,
  '500mbps': 500_000_000,
};

const DEFAULT_LATENCY = 0;

/**
 * Throttle the page's network to a given speed via CDP Network.emulateNetworkConditions.
 * Creates the CDP session on a fresh page before navigation so the frame is never detached.
 *
 * @param {import('puppeteer').Page} page
 * @param {number} bps — bits per second
 * @returns {Promise<import('puppeteer').CDPSession>} the CDP session for cleanup
 */
export async function throttleNetwork(page, bps) {
  const throughput = Math.round(bps / 8);
  const cdp = await page.createCDPSession();
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: throughput,
    uploadThroughput: throughput,
    connectionType: 'wifi',
  });
  return cdp;
}

/**
 * Remove network throttling.
 * @param {import('puppeteer').CDPSession} cdp
 */
export async function resetNetwork(cdp) {
  if (!cdp) return;
  try {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
      connectionType: 'wifi',
    });
  } catch (_) {
    // Session may have been closed
  }
}

// Wrapper around frame.evaluate that handles detached frame errors.
// Returns null on transient failures; the caller (waitFor) will retry.
async function safeEval(page, fn) {
  try {
    // Use mainFrame() evaluate instead of page.evaluate to avoid detached frame issues
    const frame = page.mainFrame();
    if (!frame) return null;
    return await frame.evaluate(fn);
  } catch (e) {
    // Detached frame during navigation — return null and retry on next poll
    return null;
  }
}

/**
 * Read HLS internal state from the page.
 * @param {import('puppeteer').Page} page
 * @returns {Promise<{index: number, bitrate: number} | null>}
 */
export async function getHlsLevel(page) {
  return safeEval(page, () => {
    const hls = window.__hls;
    if (!hls || hls.currentLevel < 0) return null;
    return {
      index: hls.currentLevel,
      bitrate: hls.levels[hls.currentLevel]?.bitrate || 0,
    };
  });
}

/**
 * Get all available HLS levels from the page.
 * @param {import('puppeteer').Page} page
 * @returns {Promise<Array<{index: number, bitrate: number, name: string}>>}
 */
export async function getHlsLevels(page) {
  return safeEval(page, () => {
    const hls = window.__hls;
    if (!hls || !hls.levels) return [];
    return hls.levels.map((l, i) => ({
      index: i,
      bitrate: l.bitrate,
      name: l.name || '',
    }));
  });
}

/**
 * Get the number of fragments loaded so far.
 * @param {import('puppeteer').Page} page
 * @returns {Promise<number>}
 */
export async function getFragLoaded(page) {
  return safeEval(page, () => {
    const hls = window.__hls;
    if (!hls || !hls.stats) return 0;
    return hls.stats.fragLoaded || 0;
  });
}

/**
 * Read current song info from the DOM.
 * @param {import('puppeteer').Page} page
 * @returns {Promise<{title: string, artist: string, time: string, playBtn: string, liveBtn: string} | null>}
 */
export async function getSongInfo(page) {
  return safeEval(page, () => {
    const title = document.getElementById('song-text')?.textContent || '';
    const artist = document.getElementById('artist')?.textContent || '';
    const time = document.getElementById('time')?.textContent || '';
    const playBtn = document.getElementById('play-pause')?.textContent || '';
    const liveBtn = document.getElementById('live-btn')?.textContent || '';
    return { title, artist, time, playBtn, liveBtn };
  });
}

/**
 * Wait for a given condition with polling, returning the first truthy value.
 * @template T
 * @param {import('puppeteer').Page} page
 * @param {() => Promise<T>} pollFn
 * @param {number} timeout — max ms to wait
 * @param {number} interval — ms between polls
 * @returns {Promise<T | null>}
 */
export async function waitFor(page, pollFn, timeout = 120_000, interval = 2_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await pollFn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, interval));
  }
  return null;
}

/**
 * Standard test runner: run a callback for each speed preset.
 * @param {import('puppeteer').Browser} browser
 * @param {import('puppeteer').Page} page
 * @param {Array<{label: string, bps: number}>} speeds
 * @param {(opts) => Promise<{passed: number, failures: number}>} testFn
 *   opts.page — Puppeteer Page
 *   opts.speed — {label, bps}
 *   opts.cdp — CDPSession
 * @returns {Promise<{passed: number, failures: number}>}
 */
export async function runSpeedSuite(browser, page, speeds, testFn) {
  let totalPassed = 0;
  let totalFailures = 0;
  for (const speed of speeds) {
    console.log(`\n=== Speed: ${speed.label} (${(speed.bps / 1_000_000).toFixed(1)} Mbps) ===`);
    const cdp = await throttleNetwork(page, speed.bps);
    try {
      const result = await testFn({ page, speed, cdp });
      totalPassed += result.passed;
      totalFailures += result.failures;
    } finally {
      await resetNetwork(cdp).catch(() => {});
    }
  }
  return { passed: totalPassed, failures: totalFailures };
}
