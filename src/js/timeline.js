// Timeline rendering — position calculation, progress bar, song info, art.
// Depends on api.js for state, stream.js for sync, position.js for cookie.

import {
  nowPlayingSong, timeline, nextUp, isOnline, elapsedCapturedAt, fetchNow,
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

  const target = syncPosition();
  const behind = mode === 'hls' && hls ? Math.max(0, target - audio.currentTime) : 0;

  if (nowPlayingSong) {
    const apiElapsed = (nowPlayingSong.elapsed || 0) + (Date.now() - elapsedCapturedAt) / 1000;
    // effectiveElapsed can be negative (user hasn't reached song yet)
    const effectiveElapsed = apiElapsed - behind;
    // wall clock position of the audio the user hears
    const wc = nowPlayingSong.played_at + effectiveElapsed;

    let song;
    let pos;

    if (effectiveElapsed >= 0 && effectiveElapsed < nowPlayingSong.duration) {
      // User hears the current song, just delayed
      song = nowPlayingSong;
      pos = effectiveElapsed;
    } else {
      // User is hearing a different song (previous or next) — look up via timeline
      song = findSongAt(wc);
      if (!song && nextUp && nextUp.id) song = nextUp;
      if (song) pos = Math.max(0, wc - song.played_at);
    }

    if (song) {
      if (song.id && song.id !== lastSongId) {
        lastSongId = song.id;
      }
      setArt(song.art);
      songText.textContent = song.title || song.text;
      artistEl.textContent = song.artist || '';
      const clampedPos = Math.min(song.duration, Math.max(0, pos));
      const pct = song.duration ? Math.min(100, (clampedPos / song.duration) * 100) : 0;
      progressFill.style.width = pct + '%';
      timeLabel.textContent = fmt(clampedPos) + ' / ' + fmt(song.duration);
    } else {
      setArt(null);
      songText.textContent = 'TjenaMors Radio';
      artistEl.textContent = 'Vi spelar bra skit!';
      progressFill.style.width = '0%';
      timeLabel.textContent = '';
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
