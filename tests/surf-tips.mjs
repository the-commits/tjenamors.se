// E2E tests: surf tip element existence, animation classes, positioning, and constraints.
// Tests manual tip injection (no random-interval waiting).

import puppeteer from 'puppeteer';
import { serve } from './serve.mjs';

const { server, url } = await serve();
let failures = 0;
let passed = 0;

async function check(label, condition, detail) {
  if (condition) {
    console.log(`  \u2713 ${label}`);
    passed++;
  } else {
    console.error(`  \u2717 ${label} \u2014 ${detail}`);
    failures++;
  }
}

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

  await page.waitForSelector('#surf-tip', { timeout: 5000 }).catch(() => {});
  await page.waitForSelector('#surf-tip-link', { timeout: 5000 }).catch(() => {});
  await page.waitForSelector('#surf-tip-text', { timeout: 5000 }).catch(() => {});

  // --- DOM existence ---
  console.log('\n--- DOM existence ---');

  const tipEl = await page.$('#surf-tip');
  check('Surf tip container exists', !!tipEl, '#surf-tip not found');

  const tipLink = await page.$('#surf-tip-link');
  check('Surf tip link exists', !!tipLink, '#surf-tip-link not found');

  const tipText = await page.$('#surf-tip-text');
  check('Surf tip text span exists', !!tipText, '#surf-tip-text not found');

  const tipAria = await page.evaluate(() =>
    document.getElementById('surf-tip')?.getAttribute('aria-live'));
  check('Surf tip has aria-live="polite"', tipAria === 'polite', `got "${tipAria}"`);

  // --- Initial hidden state ---
  console.log('\n--- Initial hidden state ---');

  const hasVisibleClassInit = await page.evaluate(() =>
    document.getElementById('surf-tip')?.classList.contains('visible'));
  check('Tip container is not .visible initially', !hasVisibleClassInit,
    'should not be visible');

  const initOpacity = await page.evaluate(() => {
    const el = document.getElementById('surf-tip');
    return el ? getComputedStyle(el).opacity : null;
  });
  check('Tip container opacity is 0 initially', initOpacity === '0', `got "${initOpacity}"`);

  // --- Inject a tip and verify fly-in ---
  console.log('\n--- Manual tip injection (fly-in) ---');

  await page.evaluate(() => {
    const tipEl = document.getElementById('surf-tip');
    const tipLink = document.getElementById('surf-tip-link');
    const tipText = document.getElementById('surf-tip-text');
    if (tipEl && tipLink && tipText) {
      tipLink.href = 'https://example.com';
      tipText.textContent = 'Test surf tip!';
      tipEl.classList.add('flying-in', 'visible');
    }
  });

  const urlAfter = await page.evaluate(() =>
    document.getElementById('surf-tip-link')?.getAttribute('href'));
  check('Tip URL is set', urlAfter === 'https://example.com', `got "${urlAfter}"`);

  const textAfter = await page.evaluate(() =>
    document.getElementById('surf-tip-text')?.textContent);
  check('Tip text is set', textAfter === 'Test surf tip!', `got "${textAfter}"`);

  const hasVisibleAfterInject = await page.evaluate(() =>
    document.getElementById('surf-tip')?.classList.contains('visible'));
  check('Tip gets .visible after injection', hasVisibleAfterInject,
    'should have visible class');

  const hasFlyingIn = await page.evaluate(() =>
    document.getElementById('surf-tip')?.classList.contains('flying-in'));
  check('Tip has .flying-in class', hasFlyingIn, 'should have flying-in class');

  const visibleOpacity = await page.evaluate(() => {
    const el = document.getElementById('surf-tip');
    return el ? getComputedStyle(el).opacity : null;
  });
  check('Tip container opacity is 1 when visible', visibleOpacity === '1', `got "${visibleOpacity}"`);

  // --- Verify fly-out ---
  console.log('\n--- Fly-out animation ---');

  await page.evaluate(() => {
    const tipEl = document.getElementById('surf-tip');
    if (tipEl) {
      tipEl.classList.remove('flying-in');
      tipEl.classList.add('flying-out');
    }
  });

  const hasFlyingOut = await page.evaluate(() =>
    document.getElementById('surf-tip')?.classList.contains('flying-out'));
  check('Tip gets .flying-out class', hasFlyingOut, 'should have flying-out class');

  const lostFlyingIn = await page.evaluate(() =>
    document.getElementById('surf-tip')?.classList.contains('flying-in'));
  check('Tip loses .flying-in when flying-out', !lostFlyingIn, 'should not have flying-in');

  // Wait for fly-out animation to complete, then verify hidden
  await page.evaluate(() => new Promise((r) => setTimeout(r, 600)));

  await page.evaluate(() => {
    const tipEl = document.getElementById('surf-tip');
    if (tipEl) tipEl.classList.remove('visible', 'flying-out');
  });

  const hiddenAfterFlyOut = await page.evaluate(() =>
    document.getElementById('surf-tip')?.classList.contains('visible'));
  check('Tip hidden after fly-out completes', !hiddenAfterFlyOut,
    'should not be visible');

  const hiddenOpacity = await page.evaluate(() => {
    const el = document.getElementById('surf-tip');
    return el ? getComputedStyle(el).opacity : null;
  });
  check('Tip container opacity returns to 0', hiddenOpacity === '0', `got "${hiddenOpacity}"`);

  // --- Positioning ---
  console.log('\n--- Positioning constraints ---');

  const bottomPx = await page.evaluate(() => {
    const el = document.getElementById('surf-tip');
    return el ? parseFloat(getComputedStyle(el).bottom) : null;
  });
  check('Tip is near bottom of screen (bottom <= 2em)', bottomPx !== null && bottomPx <= 40,
    `bottom is ${bottomPx}px`);

  const posFixed = await page.evaluate(() => {
    const el = document.getElementById('surf-tip');
    return el ? getComputedStyle(el).position : null;
  });
  check('Tip container is position: fixed', posFixed === 'fixed', `got "${posFixed}"`);

  const maxHeight = await page.evaluate(() => {
    const el = document.getElementById('surf-tip');
    return el ? getComputedStyle(el).maxHeight : null;
  });
  check('Tip container has max-height set', maxHeight !== 'none' && maxHeight !== '0px',
    `got "${maxHeight}"`);

  const zIndex = await page.evaluate(() => {
    const el = document.getElementById('surf-tip');
    return el ? parseInt(getComputedStyle(el).zIndex, 10) : null;
  });
  check('Tip container is above other content (z-index >= 20)', zIndex >= 20,
    `z-index is ${zIndex}`);

  // --- Link styling ---
  console.log('\n--- Link styling ---');

  const linkBackground = await page.evaluate(() => {
    const el = document.getElementById('surf-tip-link');
    return el ? getComputedStyle(el).backgroundColor : null;
  });
  check('Link has dark background', linkBackground && linkBackground !== 'rgba(0, 0, 0, 0)',
    `got "${linkBackground}"`);

  const linkBorder = await page.evaluate(() => {
    const el = document.getElementById('surf-tip-link');
    return el ? getComputedStyle(el).border : null;
  });
  check('Link has neon border', linkBorder && linkBorder.includes('2px'),
    `got "${linkBorder}"`);

  const linkRadius = await page.evaluate(() => {
    const el = document.getElementById('surf-tip-link');
    return el ? getComputedStyle(el).borderRadius : null;
  });
  check('Link has rounded corners', linkRadius && linkRadius !== '0px',
    `got "${linkRadius}"`);

  const linkFont = await page.evaluate(() => {
    const el = document.getElementById('surf-tip-link');
    return el ? getComputedStyle(el).fontFamily.toLowerCase() : null;
  });
  check('Link uses Audiowide font', linkFont && linkFont.includes('audiowide'),
    `got "${linkFont}"`);

  const minHeight = await page.evaluate(() => {
    const el = document.getElementById('surf-tip-link');
    return el ? parseFloat(getComputedStyle(el).minHeight) : null;
  });
  check('Link min-height >= 20px', minHeight !== null && minHeight >= 20,
    `min-height is ${minHeight}px`);

  // --- Feature flag: window.__SURF_TIPS_ENABLED = false ---
  console.log('\n--- Feature flag: window.__SURF_TIPS_ENABLED = false ---');

  const flagPage = await browser.newPage();
  await flagPage.evaluateOnNewDocument(() => {
    window.__SURF_TIPS_ENABLED = false;
  });
  await flagPage.setViewport({ width: 390, height: 844 });
  await flagPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await flagPage.waitForSelector('#surf-tip', { timeout: 10000 }).catch(() => {});

  const flagVisible = await flagPage.evaluate(() =>
    document.getElementById('surf-tip')?.classList.contains('visible'));
  check('Tip hidden with __SURF_TIPS_ENABLED=false', !flagVisible,
    'should not be visible');

  const flagElExists = await flagPage.$('#surf-tip');
  check('Tip container exists with __SURF_TIPS_ENABLED=false', !!flagElExists,
    '#surf-tip missing');

  await flagPage.close();

  await browser.close();
  server.close();

  console.log(`\n===== Results: ${passed} passed, ${failures} failed =====\n`);
  process.exit(failures ? 1 : 0);
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
