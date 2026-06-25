// Timeline rendering — position calculation, progress bar, song info, art.
// Depends on api.js for state, stream.js for sync, position.js for cookie.

import {
  nowPlayingSong, timeline, nextUp, isOnline, fetchNow, elapsedCapturedAt,
} from './api.js';
import { mode, isAtLive } from './stream.js';
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

  // Wall clock of the audio the user hears.
  // The API gives us the real broadcast wall clock (played_at + elapsed).
  // The user is contentAge seconds behind the HLS live edge (buffer ahead
  // of playhead). In a real-time live stream, media seconds ≈ wall clock
  // seconds, so contentAge approximates the user's wall-clock lag.
  //
  // This avoids relying on HLS segment filename timestamps or client-server
  // clock alignment. The result may be up to ~20s ahead of the user's actual
  // position (due to HLS encoding latency unaccounted for), but is far more
  // accurate than the old Date.now()-based approach which could be >60s off.
  const seekableEnd = audio.seekable.length
    ? audio.seekable.end(audio.seekable.length - 1)
    : 0;
  const contentAge = mode === 'hls' && seekableEnd
    ? Math.max(0, seekableEnd - audio.currentTime)
    : 0;
  const userWallClock = mode === 'hls' && seekableEnd && nowPlayingSong
    ? (nowPlayingSong.played_at + nowPlayingSong.elapsed) - contentAge
    : Date.now() / 1000;

  if (nowPlayingSong) {
    // Always search timeline (includes song_history + now_playing + playing_next)
    let song = findSongAt(userWallClock);
    let pos;
    if (song) {
      pos = Math.max(0, userWallClock - song.played_at);
    } else {
      // timeline doesn't cover this time — fall back to nowPlayingSong
      song = nowPlayingSong;
      pos = Math.max(0, Math.min(song.duration || 0, userWallClock - song.played_at));
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
