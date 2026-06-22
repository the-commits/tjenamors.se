// Player UI — event handlers, positioning, sun fade.
// Depends on all other modules.

import {
  audio, disc, playPause, liveBtn, sunEl, playerEl, cityEl,
} from './dom.js';
import {
  mode, userSeeked, isAtLive, goLive, syncPosition,
  lastUserPos, suppressSeekGuard, setSuppressSeekGuard, scheduleRecover,
} from './stream.js';
import { render } from './timeline.js';

// --- Play/Pause ---

playPause.addEventListener('click', () => {
  if (audio.paused) {
    if (!userSeeked && (isAtLive() || !audio.seekable.length)) goLive();
    audio.play().catch((e) => console.error(e));
  } else {
    audio.pause();
  }
});

liveBtn.addEventListener('click', goLive);

// --- Audio events ---

audio.addEventListener('timeupdate', () => {
  if (userSeeked && !isAtLive()) {
    // lastUserPos is managed in stream.js — this is a cross-module reader
  }
  render();
});

audio.addEventListener('seeking', () => {
  if (suppressSeekGuard) return;
  if (userSeeked) {
    const live = syncPosition();
    if (live && Math.abs(audio.currentTime - live) < 5) {
      setSuppressSeekGuard(true);
      audio.currentTime = lastUserPos;
      setTimeout(() => setSuppressSeekGuard(false), 200);
    }
  }
});

audio.addEventListener('play', () => {
  playPause.textContent = '❚❚';
  if (sunEl) sunEl.style.opacity = '0.1';
});

audio.addEventListener('pause', () => {
  playPause.textContent = '▶';
  if (sunEl) sunEl.style.opacity = '1';
  render();
});

audio.addEventListener('waiting', () => {
  if (!audio.paused && mode === 'hls') scheduleRecover();
});

// --- Player positioning ---

export function alignPlayerToSun() {
  if (!sunEl || !playerEl) return;
  const s = sunEl.getBoundingClientRect();
  const cx = s.left + s.width / 2;
  const cy = s.top + s.height / 2;
  const cont = playerEl.offsetParent;
  const cRect = cont.getBoundingClientRect();
  const discH = disc.getBoundingClientRect().height;
  playerEl.style.left = cx - cRect.left + 'px';
  playerEl.style.top = cy - cRect.top + 'px';
  playerEl.style.transform = `translate(-50%, ${-discH / 2}px)`;
}

export function revealPlayer() {
  alignPlayerToSun();
  playerEl.classList.add('visible');
}

cityEl.addEventListener('animationend', (e) => {
  if (e.animationName === 'rising_city') revealPlayer();
});

setTimeout(revealPlayer, 1200);

window.addEventListener('resize', () => {
  if (playerEl.classList.contains('visible')) alignPlayerToSun();
});
