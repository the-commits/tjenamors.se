// Entry point — imports modules and starts the application.
//
// Module dependency graph (no circular deps):
//   dom.js ← position.js ← stream.js ← timeline.js ← player.js ← app.js
//   api.js  ← stream.js ← timeline.js ← player.js ← app.js
//   api.js  ← (standalone) ─────────────────────────────────── app.js
//   dom.js ← surf-tips.js ← app.js
//   api.js ← seo.js ← app.js
//   api.js ← media-session.js ← app.js
//   dom.js ← cast.js ← app.js
//   api.js ← share.js ← app.js

import { pollNowPlaying } from './api.js';
import { tickLiveWall, setupHls } from './stream.js';
import { render } from './timeline.js';
import { revealPlayer } from './player.js';
import { gridEl, gridContainer } from './dom.js';
import { savePosition, savePositionBeforeUnload } from './position.js';
import { startSurfTips } from './surf-tips.js';
import { initVolume } from './volume.js';
import { initSeo } from './seo.js';
import { initMediaSession } from './media-session.js';
import { initCast } from './cast.js';
import { initShare } from './share.js';

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
initVolume();
initSeo();
initMediaSession();
initCast();
initShare();

// --- Cookie notice dismiss + surf tip reposition ---

(function () {
  const notice = document.getElementById('cookie-notice');
  const tip = document.getElementById('surf-tip');
  if (!notice) return;

  function lowerSurfTip() {
    if (tip) tip.style.bottom = '0.8em';
  }

  if (localStorage.getItem('tj_cookie_notice_dismissed')) {
    notice.classList.add('dismissed');
    lowerSurfTip();
  } else {
    notice.addEventListener('click', function () {
      notice.classList.add('dismissed');
      localStorage.setItem('tj_cookie_notice_dismissed', '1');
      lowerSurfTip();
    });
  }
})();

// --- Service Worker registration (PWA) ---

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Registration failure is non-critical — the page works fine without it
  });
}

// --- Visibility change — re-sync UI when coming back to tab ---

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    tickLiveWall();
    render();
    pollNowPlaying();
  }
});
