// Timeline rendering — position calculation, progress bar, song info, art.
// Depends on api.js for state, stream.js for sync, position.js for cookie.

import {
  nowPlayingSong, nextUp, isOnline, elapsedCapturedAt, fetchNow,
} from './api.js';
import { mode, hls, isAtLive, syncPosition } from './stream.js';
import {
  audio, disc, songText, artistEl, progressFill, timeLabel, liveBtn,
} from './dom.js';
import { savePosition } from './position.js';

let currentArt = '';
let lastSongId = '';
let localStart = 0;
let localSongId = '';

export function fmt(s) {
  s = Math.max(0, s | 0);
  const m = (s / 60) | 0;
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

export function setArt(url) {
  if (url === currentArt) return;
  currentArt = url || '';
  if (url) {
    disc.style.backgroundImage = `url("${url}")`;
    disc.classList.add('has-art');
  } else {
    disc.style.backgroundImage = '';
    disc.classList.remove('has-art');
  }
}

export function render() {
  const live = isOnline || audio.paused === false;
  if (!live) {
    setArt(null);
    songText.textContent = 'Ingen sändning';
    artistEl.textContent = '';
    progressFill.style.width = '0%';
    timeLabel.textContent = '';
    liveBtn.classList.remove('live');
    fetchNow();
    return;
  }

  if (!isOnline && nextUp) {
    if (nextUp.id !== localSongId) {
      localSongId = nextUp.id;
      localStart = Date.now() / 1000;
    }
    setArt(nextUp.art);
    songText.textContent = nextUp.title || nextUp.text;
    artistEl.textContent = nextUp.artist || '';
    const pos = Math.max(0, Date.now() / 1000 - localStart);
    const dur = nextUp.duration || 0;
    const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;
    progressFill.style.width = pct + '%';
    timeLabel.textContent = dur ? fmt(pos) + ' / ' + fmt(dur) : '';
    liveBtn.classList.toggle('live', isAtLive());
    return;
  }

  const target = syncPosition();
  const behind = mode === 'hls' && hls ? Math.max(0, target - audio.currentTime) : 0;

  if (nowPlayingSong) {
    const apiElapsed = (nowPlayingSong.elapsed || 0) + (Date.now() - elapsedCapturedAt) / 1000;
    const effectiveElapsed = Math.max(0, apiElapsed - behind);

    // Use nowPlayingSong if the user is still within its range
    if (effectiveElapsed < nowPlayingSong.duration) {
      if (nowPlayingSong.id && nowPlayingSong.id !== lastSongId) {
        lastSongId = nowPlayingSong.id;
      }
      setArt(nowPlayingSong.art);
      songText.textContent = nowPlayingSong.title || nowPlayingSong.text;
      artistEl.textContent = nowPlayingSong.artist || '';
      const pos = Math.min(nowPlayingSong.duration, Math.max(0, effectiveElapsed));
      const pct = nowPlayingSong.duration ? Math.min(100, (pos / nowPlayingSong.duration) * 100) : 0;
      progressFill.style.width = pct + '%';
      timeLabel.textContent = fmt(pos) + ' / ' + fmt(nowPlayingSong.duration);
    } else {
      // Past current song — try nextUp
      const next = nextUp && nextUp.id ? nextUp : null;
      if (next) {
        if (next.id !== lastSongId) {
          lastSongId = next.id;
        }
        setArt(next.art);
        songText.textContent = next.title || next.text;
        artistEl.textContent = next.artist || '';
        const remaining = effectiveElapsed - nowPlayingSong.duration;
        const pos = Math.min(next.duration, Math.max(0, remaining));
        const pct = next.duration ? Math.min(100, (pos / next.duration) * 100) : 0;
        progressFill.style.width = pct + '%';
        timeLabel.textContent = fmt(pos) + ' / ' + fmt(next.duration);
      } else {
        setArt(null);
        songText.textContent = 'TjenaMors Radio';
        artistEl.textContent = 'Vi spelar bra skit!';
        progressFill.style.width = '0%';
        timeLabel.textContent = '';
      }
    }
  } else {
    setArt(null);
    songText.textContent = 'TjenaMors Radio';
    artistEl.textContent = 'Vi spelar bra skit!';
    progressFill.style.width = '0%';
    timeLabel.textContent = '';
    fetchNow();
  }

  liveBtn.classList.toggle('live', isAtLive());
}
