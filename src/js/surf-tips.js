// Surf tips — random animated tips appearing while radio plays.
// Cartoonish spring-board fly-in from right, shoot-out to left.
// 33% chance every 180s check, 900s cooldown after tip finishes.
// Tips are loaded from /surf-tips.json.
// Debug: set window.__DEBUG = true for surf tip scheduling logs.

import { audio, surfTipEl, surfTipLink, surfTipText } from './dom.js';

// --- Tip data (loaded from JSON at startup) ---

let tips = [];

try {
  const res = await fetch('/surf-tips.json');
  if (res.ok) {
    tips = await res.json();
    if (window.__DEBUG) console.log('[SURF-TIP] loaded ' + tips.length + ' tips');
  }
} catch (e) {
  console.error('[SURF-TIP] failed to load tips:', e);
}

// --- State ---

let checkIntervalId = null;
let hideTimer = null;
let isShown = false;
let isPaused = true;
let cooldownUntil = 0;

// --- Constants ---

const CHECK_MS = 180000;       // 180 seconds between chance rolls
const COOLDOWN_MS = 900000;    // 900 seconds after tip finishes
const MIN_DISPLAY_MS = 60000;  // 60 seconds minimum display
const MAX_DISPLAY_MS = 180000; // 180 seconds maximum display
const CHANCE = 0.33;           // 33% probability per check
const INITIAL_DELAY_MS = 30000;// 30 seconds before first check on play

// --- Helpers ---

function isEnabled() {
  // Feature flag: set window.__SURF_TIPS_ENABLED = false to disable.
  if (window.__SURF_TIPS_ENABLED === false) return false;
  return true;
}

function pickTip() {
  if (!tips.length) return null;
  return tips[Math.floor(Math.random() * tips.length)];
}

function log(msg) {
  if (window.__DEBUG) console.log('[SURF-TIP]', msg);
}

/** Total cooldown remaining in seconds (for E2E/test introspection). */
export function cooldownLeft() {
  return Math.max(0, Math.round((cooldownUntil - Date.now()) / 1000));
}

// --- Show / hide ---

function showTip() {
  if (!surfTipEl || isShown || isPaused) return;

  const tip = pickTip();
  if (!tip) return;

  surfTipLink.href = tip.url;
  surfTipText.textContent = tip.text;

  surfTipEl.classList.remove('flying-out');
  surfTipEl.classList.add('flying-in', 'visible');
  isShown = true;

  log('showing: ' + tip.text);

  const displayMs = MIN_DISPLAY_MS +
    Math.random() * (MAX_DISPLAY_MS - MIN_DISPLAY_MS);

  hideTimer = setTimeout(hideTip, displayMs);
}

function hideTip() {
  if (!surfTipEl || !isShown) return;

  surfTipEl.classList.remove('flying-in');
  surfTipEl.classList.add('flying-out');

  log('hiding');

  hideTimer = setTimeout(() => {
    surfTipEl.classList.remove('visible', 'flying-out');
    isShown = false;
    // Cooldown starts AFTER the tip has fully flown out.
    cooldownUntil = Date.now() + COOLDOWN_MS;
    log('hidden — cooldown until ' + new Date(cooldownUntil).toLocaleTimeString());
  }, 450); // matches surfTipOut animation duration
}

function hideImmediate() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (!isShown) return;
  surfTipEl.classList.remove('flying-in', 'visible');
  surfTipEl.classList.add('flying-out');
  setTimeout(() => {
    surfTipEl.classList.remove('flying-out', 'visible');
    isShown = false;
    cooldownUntil = Date.now() + COOLDOWN_MS;
  }, 450);
}

// --- Periodic check ---

function checkForTip() {
  if (isPaused) {
    log('skipped — paused');
    return;
  }
  if (isShown) {
    log('skipped — tip already showing');
    return;
  }
  if (Date.now() < cooldownUntil) {
    const left = Math.round((cooldownUntil - Date.now()) / 1000);
    log('skipped — cooldown ' + left + 's left');
    return;
  }

  if (Math.random() < CHANCE) {
    log('33% hit — showing tip');
    showTip();
  } else {
    log('67% miss — next check in 180s');
  }
}

// --- Play/pause integration ---

function onPlay() {
  isPaused = false;
  if (!checkIntervalId) {
    log('play — starting check timer');
    // First check after a short delay so the tip doesn't appear instantly.
    setTimeout(checkForTip, INITIAL_DELAY_MS);
    checkIntervalId = setInterval(checkForTip, CHECK_MS);
  }
}

function onPause() {
  isPaused = true;
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
    log('pause — stopped check timer');
  }
  // Let a currently-showing tip live out its display timer naturally.
}

// --- Public API ---

export function startSurfTips() {
  if (!isEnabled()) {
    log('disabled (feature flag)');
    return;
  }
  if (!surfTipEl) return;
  if (!tips.length) {
    log('no tips loaded — surf tips disabled');
    return;
  }

  isPaused = audio.paused;

  audio.addEventListener('play', onPlay);
  audio.addEventListener('pause', onPause);

  if (!isPaused) onPlay();

  log('started');
}
