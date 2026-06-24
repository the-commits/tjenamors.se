// Timeline rendering — position calculation, progress bar, song info, art.
// Depends on api.js for state, stream.js for sync, position.js for cookie.

import {
  nowPlayingSong, timeline, nextUp, isOnline, elapsedCapturedAt, fetchNow,
} from './api.js';
import { liveWall, mode, userSeeked, mediaToWall, isAtLive, syncPosition } from './stream.js';
import {
  audio, disc, songText, artistEl, progressFill, timeLabel, liveBtn,
} from './dom.js';
import { savePosition } from './position.js';

let currentArt = '';
let lastSongId = '';
let songStartAudioTime = 0;
let localStart = 0;
let localSongId = '';

export function fmt(s) {
  s = Math.max(0, s | 0);
  const m = (s / 60) | 0;
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

function findSongAt(wc) {
  const exact = timeline.find((s) => wc >= s.played_at && wc < s.played_at + s.duration);
  if (exact) return exact;
  let fallback = null;
  for (const s of timeline) {
    if (s.played_at <= wc && (!fallback || s.played_at > fallback.played_at)) fallback = s;
  }
  return fallback;
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

  const wc = mediaToWall(audio.currentTime);
  const target = syncPosition();
  const nearLive = mode === 'mp3' || Math.abs(audio.currentTime - target) < 60;
  const song = nearLive ? (nowPlayingSong || findSongAt(wc)) : findSongAt(wc);
  if (song) {
    if (song.id && song.id !== lastSongId) {
      lastSongId = song.id;
      songStartAudioTime = audio.currentTime;
    }
    setArt(song.art);
    songText.textContent = song.title || song.text;
    artistEl.textContent = song.artist || '';
    const elapsedSec = (song.elapsed || 0) + (Date.now() - elapsedCapturedAt) / 1000;
    const pos = Math.min(song.duration, Math.max(0, elapsedSec));
    const pct = song.duration ? Math.min(100, (pos / song.duration) * 100) : 0;
    progressFill.style.width = pct + '%';
    timeLabel.textContent = fmt(pos) + ' / ' + fmt(song.duration);
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
