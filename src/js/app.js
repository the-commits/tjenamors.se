// Entry point — imports modules and starts the application.
//
// Module dependency graph (no circular deps):
//   dom.js ← position.js ← stream.js ← timeline.js ← player.js ← app.js
//   api.js  ← stream.js ← timeline.js ← player.js ← app.js
//   api.js  ← (standalone) ─────────────────────────────────── app.js
//   dom.js ← surf-tips.js ← app.js

import { pollNowPlaying } from './api.js';
import { tickLiveWall, setupHls } from './stream.js';
import { render } from './timeline.js';
import { revealPlayer } from './player.js';
import { gridEl, gridContainer } from './dom.js';
import { savePosition, savePositionBeforeUnload } from './position.js';
import { startSurfTips } from './surf-tips.js';

// --- Grid animation stop ---

setTimeout(() => {
  gridEl.style.animationPlayState = 'paused';
  gridContainer.style.opacity = '0';
}, 5000);

// --- Position save interval ---

let saveTimer = 0;

setInterval(() => {
  tickLiveWall();
  render();
  const now = Date.now();
  if (now - saveTimer >= 5000) {
    saveTimer = now;
    savePosition();
  }
}, 1000);

// --- Before-unload save ---

window.addEventListener('beforeunload', savePositionBeforeUnload);

// --- Bootstrap ---

pollNowPlaying();
setInterval(pollNowPlaying, 2000);
setupHls();
render();
startSurfTips();
