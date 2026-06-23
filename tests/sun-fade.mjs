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

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667 });
  await page.goto(url, { waitUntil: 'networkidle0' });

  // Wait for the player to become visible (rising_city animation + reveal)
  await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));

  console.log('\n--- Button existence ---');

  // Check play/pause button exists
  const playBtn = await page.$('#play-pause');
  check('Play/pause button exists', !!playBtn, '#play-pause not found');

  // Check live button exists
  const liveBtn = await page.$('#live-btn');
  check('Live button exists', !!liveBtn, '#live-btn not found');

  // Check play button initial text
  const playText = await page.evaluate(() => document.getElementById('play-pause')?.textContent);
  check('Play button shows ▶ initially', playText === '▶', `got "${playText}"`);

  // Check live button initial text
  const liveText = await page.evaluate(() => document.getElementById('live-btn')?.textContent);
  check('Live button shows LIVE', liveText?.includes('LIVE'), `got "${liveText}"`);

  console.log('\n--- Sun opacity (CSS transition) ---');

  // Check sun has the transition property
  const transition = await getStyle(page, '.city > .sun', 'transition');
  check('Sun has opacity transition', transition?.includes('opacity 2s'), `got "${transition}"`);

  // Check sun starts at opacity 1 (computed style defaults to 1 since no inline style is set)
  const initialOpacity = await getStyle(page, '.city > .sun', 'opacity');
  check('Sun starts at opacity 1', parseFloat(initialOpacity) === 1, `got "${initialOpacity}"`);

  console.log('\n--- Play event → sun fades to 0.1 ---');

  // Dispatch a 'play' event on the audio element
  await page.evaluate(() => {
    const a = document.querySelector('audio');
    if (a) a.dispatchEvent(new Event('play'));
  });

  // Wait for the 2s CSS transition to complete
  await page.evaluate(() => new Promise(r => setTimeout(r, 2200)));

  const playingOpacity = await getInlineStyle(page, '.city > .sun', 'opacity');
  check('Sun opacity is 0.1 after play event', playingOpacity === '0.1', `got "${playingOpacity}"`);

  console.log('\n--- Pause event → sun returns to 1 ---');

  // Dispatch a 'pause' event
  await page.evaluate(() => {
    const a = document.querySelector('audio');
    if (a) a.dispatchEvent(new Event('pause'));
  });

  // Wait for the 2s CSS transition to complete
  await page.evaluate(() => new Promise(r => setTimeout(r, 2200)));

  const pausedOpacity = await getInlineStyle(page, '.city > .sun', 'opacity');
  check('Sun opacity is 1 after pause event', pausedOpacity === '1', `got "${pausedOpacity}"`);

  console.log('\n--- Play button toggles text ---');

  // Simulate clicking play (dispatch play event sets textContent)
  await page.evaluate(() => {
    const a = document.querySelector('audio');
    if (a) a.dispatchEvent(new Event('play'));
  });
  const afterPlayText = await page.evaluate(() => document.getElementById('play-pause')?.textContent);
  check('Play button shows ❚❚ after play', afterPlayText === '❚❚', `got "${afterPlayText}"`);

  await page.evaluate(() => {
    const a = document.querySelector('audio');
    if (a) a.dispatchEvent(new Event('pause'));
  });
  const afterPauseText = await page.evaluate(() => document.getElementById('play-pause')?.textContent);
  check('Play button shows ▶ after pause', afterPauseText === '▶', `got "${afterPauseText}"`);

  await browser.close();
  server.close();

  console.log(`\n===== Results: ${passed} passed, ${failures} failed =====`);
  process.exit(failures ? 1 : 0);
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
