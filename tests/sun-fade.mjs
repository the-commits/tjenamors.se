// E2E tests: sun opacity on play/pause, button text toggles.
// Uses a real silent WAV blob URL so native audio events fire properly.

import puppeteer from 'puppeteer';
import { serve } from './serve.mjs';

const { server, url } = await serve();
let failures = 0;
let passed = 0;

async function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label} — ${detail}`);
    failures++;
  }
}

async function getStyle(page, selector, prop) {
  return page.evaluate(([sel, p]) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return getComputedStyle(el)[p];
  }, [selector, prop]);
}

async function getInlineStyle(page, selector, prop) {
  return page.evaluate(([sel, p]) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return el.style[p];
  }, [selector, prop]);
}

// Generate a minimal silent 16-bit mono PCM WAV as a Blob URL inside the page.
async function injectSilentWav(page) {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      const sampleRate = 8000;
      const durationSec = 30;
      const numSamples = Math.floor(sampleRate * durationSec);
      const dataSize = numSamples * 2; // 16-bit = 2 bytes per sample
      const buf = new ArrayBuffer(44 + dataSize);
      const dv = new DataView(buf);

      function writeStr(off, str) {
        for (let i = 0; i < str.length; i++) dv.setUint8(off + i, str.charCodeAt(i));
      }

      writeStr(0, 'RIFF');
      dv.setUint32(4, 36 + dataSize, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      dv.setUint32(16, 16, true);       // chunk size
      dv.setUint16(20, 1, true);        // PCM
      dv.setUint16(22, 1, true);        // mono
      dv.setUint32(24, sampleRate, true);
      dv.setUint32(28, sampleRate * 2, true); // byte rate
      dv.setUint16(32, 2, true);        // block align
      dv.setUint16(34, 16, true);       // bits per sample
      writeStr(36, 'data');
      dv.setUint32(40, dataSize, true);
      // samples are already zero-initialised (silence for 16-bit PCM)

      const blob = new Blob([buf], { type: 'audio/wav' });
      const blobUrl = URL.createObjectURL(blob);

      // Replace the audio element's source with the silent WAV
      const audio = document.querySelector('audio');
      if (!audio) { resolve(false); return; }

      // Detach HLS if active
      if (window.hls) {
        try { window.hls.destroy(); } catch (_) {}
        window.hls = null;
      }
      audio.removeAttribute('src');

      audio.src = blobUrl;
      audio.load();

      audio.addEventListener('canplaythrough', () => resolve(true), { once: true });
      audio.addEventListener('error', () => resolve(false), { once: true });
    });
  });
}

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await page.waitForSelector('.player', { timeout: 5000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1200));

  // Wait for the player to become visible (rising_city animation + reveal)
  await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));

  console.log('\n--- Inject silent WAV ---');

  const wavLoaded = await injectSilentWav(page);
  check('Silent WAV loaded', wavLoaded, 'could not load test audio');

  // Wait a bit for the new source to settle
  await new Promise(r => setTimeout(r, 500));

  // Explicitly play the audio (autoplay policy blocks unmuted play without interaction)
  await page.evaluate(() => {
    const a = document.querySelector('audio');
    if (a) { a.muted = true; a.play().catch(() => {}); }
  });
  await new Promise(r => setTimeout(r, 500));

  console.log('\n--- Button existence ---');

  // Check play/pause button exists
  const playBtn = await page.$('#play-pause');
  check('Play/pause button exists', !!playBtn, '#play-pause not found');

  // Check live button exists
  const liveBtn = await page.$('#live-btn');
  check('Live button exists', !!liveBtn, '#live-btn not found');

  // Check play button initial icon (muted autoplay → shows fa-play until user clicks)
  const hasPlay = await page.evaluate(() => {
    const i = document.querySelector('#play-pause i');
    return i ? i.classList.contains('fa-play') : false;
  });
  check('Play button shows fa-play on muted autoplay', hasPlay, 'fa-play not found');

  // Check live button initial text
  const liveText = await page.evaluate(() => document.getElementById('live-btn')?.textContent);
  check('Live button shows LIVE', liveText?.includes('LIVE'), `got "${liveText}"`);

  console.log('\n--- Sun opacity (CSS transition) ---');

  // Check sun has the transition property
  const transition = await getStyle(page, '.city > .sun', 'transition');
  check('Sun has opacity transition', transition?.includes('opacity 2s'), `got "${transition}"`);

  // Check sun starts at opacity 1 (CSS default, no inline style set on muted autoplay)
  const mutedOpacity = await getStyle(page, '.city > .sun', 'opacity');
  check('Sun is at opacity 1 on muted autoplay', mutedOpacity === '1', `got "${mutedOpacity}"`);

  console.log('\n--- Unmute via click → sun fades to 0.1 ---');

  // Simulate user click to unmute (matches attemptPlay() flow in app.js/stream.js).
  // Dispatch on document directly (MouseEvent defaults to bubbles: false).
  // After unmute, manually dispatch play event since audio is already playing
  // and play() on an already-playing element is a no-op.
  await page.evaluate(() => {
    document.dispatchEvent(new MouseEvent('click'));
    const a = document.querySelector('audio');
    if (a) a.dispatchEvent(new Event('play'));
  });
  // Wait for the 2s CSS transition to complete
  await page.evaluate(() => new Promise(r => setTimeout(r, 2200)));

  const unmutedOpacity = await getInlineStyle(page, '.city > .sun', 'opacity');
  check('Sun is at opacity 0.1 after unmute', unmutedOpacity === '0.1', `got "${unmutedOpacity}"`);

  // Button icon should be fa-pause after unmute
  const afterUnmutePause = await page.evaluate(() => {
    const i = document.querySelector('#play-pause i');
    return i ? i.classList.contains('fa-pause') : false;
  });
  check('Play button shows fa-pause after unmute', afterUnmutePause, 'fa-pause not found');

  console.log('\n--- Pause audio → sun returns to 1 ---');

  // Pause the audio element (native pause triggers event listener → opacity 1)
  await page.evaluate(() => {
    const a = document.querySelector('audio');
    if (a) a.pause();
  });
  // Wait for the 2s CSS transition to complete
  await page.evaluate(() => new Promise(r => setTimeout(r, 2200)));

  const pausedOpacity = await getInlineStyle(page, '.city > .sun', 'opacity');
  check('Sun opacity is 1 after pause', pausedOpacity === '1', `got "${pausedOpacity}"`);

  // Button icon should be fa-play after pause
  const afterPausePlay = await page.evaluate(() => {
    const i = document.querySelector('#play-pause i');
    return i ? i.classList.contains('fa-play') : false;
  });
  check('Play button shows fa-play after pause', afterPausePlay, 'fa-play not found');

  console.log('\n--- Play audio → sun fades to 0.1 ---');

  // Resume playback (native play triggers event listener → opacity 0.1)
  await page.evaluate(() => {
    const a = document.querySelector('audio');
    if (a) a.play().catch(() => {});
  });
  // Wait for the 2s CSS transition to complete
  await page.evaluate(() => new Promise(r => setTimeout(r, 2200)));

  const playingOpacity = await getInlineStyle(page, '.city > .sun', 'opacity');
  check('Sun opacity is 0.1 after play', playingOpacity === '0.1', `got "${playingOpacity}"`);

  // Button icon should be fa-pause after play
  const afterPlayPause = await page.evaluate(() => {
    const i = document.querySelector('#play-pause i');
    return i ? i.classList.contains('fa-pause') : false;
  });
  check('Play button shows fa-pause after play', afterPlayPause, 'fa-pause not found');

  console.log('\n--- Click Live before unmute → sun fades, button changes ---');

  // Pause and re-mute to reset to the "before user interaction" state.
  // Then click the Live button (not play/pause) — this should unmute
  // and trigger the visual update via the document click listener.
  await page.evaluate(() => {
    const a = document.querySelector('audio');
    if (a) { a.pause(); a.muted = true; }
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 2200)));

  const preLiveOpacity = await getInlineStyle(page, '.city > .sun', 'opacity');
  check('Sun is at opacity 1 before Live click', preLiveOpacity === '1', `got "${preLiveOpacity}"`);

  const preLivePlay = await page.evaluate(() => {
    const i = document.querySelector('#play-pause i');
    return i ? i.classList.contains('fa-play') : false;
  });
  check('Play button shows fa-play before Live click', preLivePlay, 'fa-play not found');

  // Click the Live button — should unmute + play + fade sun + show ❚❚
  await page.evaluate(() => {
    const btn = document.getElementById('live-btn');
    if (btn) btn.click();
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 2200)));

  const liveClickOpacity = await getInlineStyle(page, '.city > .sun', 'opacity');
  check('Sun fades to 0.1 after Live click (before unmute)', liveClickOpacity === '0.1',
    `got "${liveClickOpacity}"`);

  const liveClickPause = await page.evaluate(() => {
    const i = document.querySelector('#play-pause i');
    return i ? i.classList.contains('fa-pause') : false;
  });
  check('Play button shows fa-pause after Live click (before unmute)', liveClickPause, 'fa-pause not found');

  await browser.close();
  server.close();

  console.log(`\n===== Results: ${passed} passed, ${failures} failed =====`);
  process.exit(failures ? 1 : 0);
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
