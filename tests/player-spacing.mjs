// E2E test: player element spacing/margins are correct
import puppeteer from 'puppeteer';
import { serve } from './serve.mjs';

const { server, url } = await serve();
let failures = 0;
let passed = 0;

function check(name, ok) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failures++; console.log(`  ✗ ${name}`); }
}

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });

// Wait for player to become visible
await page.waitForSelector('.player.visible', { timeout: 5000 }).catch(() => {});

const getStyle = (sel, prop) =>
  page.evaluate((s, p) => {
    const el = document.querySelector(s);
    return el ? parseFloat(getComputedStyle(el)[p]) : null;
  }, sel, prop);

const getGap = (sel) => getStyle(sel, 'gap');

console.log('\n--- Player element spacing ---\n');

// Player has gap between disc and content
const playerGap = await getGap('.player');
check('Player has gap', playerGap > 0);

// Player content has margin-top (spacing from disc)
const contentMt = await getStyle('.player-content', 'marginTop');
check('Player content has top margin', contentMt > 0);

// Player content has gap for its children
const contentGap = await getGap('.player-content');
check('Player content has gap', contentGap > 0);

// Artist has margin-top (spacing from song title)
const artistMt = await getStyle('#artist', 'marginTop');
check('Artist has top margin', artistMt > 0);

// Controls have gap between buttons
const controlsGap = await getGap('.controls');
check('Controls have gap', controlsGap > 0);

// Timeline has margin-top (spacing from controls)
const timelineMt = await getStyle('.timeline-wrap', 'marginTop');
check('Timeline has top margin', timelineMt > 0);

// Info text has font-family Audiowide
const fontFamily = await page.evaluate(() =>
  getComputedStyle(document.querySelector('.info-text')).fontFamily.toLowerCase()
);
check('Info text uses Audiowide', fontFamily.includes('audiowide'));

// Time element has styling
const timeColor = await page.evaluate(() =>
  getComputedStyle(document.querySelector('#time')).color
);
check('Time has color styling', timeColor !== 'rgba(0, 0, 0, 0)');

// Song text has font-size > 0
const songFontSize = await getStyle('#song-text', 'fontSize');
check('Song text has font-size', songFontSize > 8);

// Disc (#sun replacement) exists and has size
const discW = await getStyle('#disc', 'width');
check('Disc has width', discW > 0);

console.log(`\n===== Results: ${passed} passed, ${failures} failed =====`);
await browser.close();
server.close();
process.exit(failures ? 1 : 0);
