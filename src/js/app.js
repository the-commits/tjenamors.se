const API = 'https://radio.tjenamors.se/api/nowplaying/1';
const HLS_STREAM = 'https://radio.tjenamors.se/hls/tjenamors_radio/live.m3u8';
const MP3_STREAM = 'https://radio.tjenamors.se/listen/tjenamors_radio/radio.mp3';

const audio = document.getElementById('radio');
const disc = document.getElementById('disc');
const songText = document.getElementById('song-text');
const artistEl = document.getElementById('artist');
const progressFill = document.getElementById('progress-fill');
const timeLabel = document.getElementById('time');
const playPause = document.getElementById('play-pause');
const liveBtn = document.getElementById('live-btn');

let timeline = [];
let nowPlayingSong = null;
let hls = null;
let liveWall = Date.now() / 1000;
let scrubbing = false;
let userSeeked = false;
let lastUserPos = 0;
let suppressSeekGuard = false;
let currentArt = '';
let isOnline = false;
let recoverTimer = null;
let mode = 'hls';
let hlsFailCount = 0;
let upgradeTimer = null;
let audioPlaying = false;
let nextUp = null;
let songStartAudioTime = 0;
let lastSongId = '';
let localStart = 0;
let localSongId = '';
let lastFetch = 0;
let elapsedCapturedAt = 0;
const preloadedArt = new Set();

function preloadArt(url) {
  if (!url || preloadedArt.has(url)) return;
  preloadedArt.add(url);
  const img = new Image();
  img.src = url;
}

function normalize(np) {
  if (!np || !np.song) return null;
  if (!np.played_at || !np.duration) return null;
  return {
    played_at: np.played_at,
    duration: np.duration || 0,
    elapsed: np.elapsed || 0,
    art: np.song.art || null,
    title: np.song.title || '',
    artist: np.song.artist || '',
    text: np.song.text || '',
    id: np.song.id || '',
  };
}

async function pollNowPlaying() {
  lastFetch = Date.now();
  try {
    const res = await fetch(API);
    const data = await res.json();
    isOnline = !!data.is_online;
    nextUp = normalize(data.playing_next);
    const songs = [];
    (data.song_history || []).slice().reverse().forEach((h) => {
      const s = normalize(h);
      if (s) songs.push(s);
    });
    const now = normalize(data.now_playing);
    if (now && (!nowPlayingSong || now.id !== nowPlayingSong.id || now.elapsed !== nowPlayingSong.elapsed)) {
      elapsedCapturedAt = Date.now();
    }
    nowPlayingSong = now;
    if (now) songs.push(now);
    const next = normalize(data.playing_next);
    if (next) songs.push(next);
    const seen = new Set();
    timeline = songs
      .filter((s) => {
        if (seen.has(s.played_at)) return false;
        seen.add(s.played_at);
        return true;
      })
      .sort((a, b) => a.played_at - b.played_at);
    songs.forEach((s) => preloadArt(s.art));
  } catch (e) {
    console.error('nowplaying fetch failed', e);
  }
}

function fetchNow() {
  const now = Date.now();
  if (now - lastFetch < 2000) return;
  lastFetch = now;
  pollNowPlaying();
}

function teardownHls() {
  if (hls) {
    try {
      hls.destroy();
    } catch (_) {}
    hls = null;
  }
  audio.removeEventListener('error', onAudioError);
  audio.removeAttribute('src');
  audio.load();
}

function setupHls() {
  mode = 'hls';
  if (audio.canPlayType('application/vnd.apple.mpegurl')) {
    audio.src = HLS_STREAM;
    audio.addEventListener('loadedmetadata', onReady);
    audio.addEventListener('error', onAudioError);
  } else if (window.Hls && Hls.isSupported()) {
    hls = new Hls({
      lowLatencyMode: false,
      enableWorker: true,
      maxBufferLength: 40,
      maxMaxBufferLength: 120,
      liveSyncDuration: 20,
      liveDurationInfinity: true,
      backBufferLength: 600,
      manifestLoadingMaxRetry: 4,
      levelLoadingTimeOut: 10000,
      maxFragLookUpTolerance: 2,
    });
    hls.loadSource(HLS_STREAM);
    hls.attachMedia(audio);
    hls.on(Hls.Events.MANIFEST_PARSED, onReady);
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.fatal) onHlsFatal(data);
    });
  } else {
    switchToMp3();
  }
}

function onHlsFatal(data) {
  hlsFailCount++;
  if (hlsFailCount <= 2 && data.type !== Hls.ErrorTypes.NETWORK_ERROR) {
    scheduleRecover();
  } else {
    switchToMp3();
  }
}

function onAudioError() {
  if (mode === 'hls') switchToMp3();
}

function switchToMp3() {
  mode = 'mp3';
  hlsFailCount = 0;
  stopUpgradeProbe();
  teardownHls();
  audio.src = MP3_STREAM;
  liveWall = Date.now() / 1000;
  attemptPlay();
  playPause.disabled = false;
  startUpgradeProbe();
}

function switchToHls() {
  stopUpgradeProbe();
  const wasPlaying = !audio.paused;
  teardownHls();
  setupHls();
  if (wasPlaying) goLive();
}

async function probeHls() {
  try {
    const res = await fetch(HLS_STREAM, { method: 'HEAD' });
    if (res.ok) switchToHls();
  } catch (_) {}
}

function startUpgradeProbe() {
  stopUpgradeProbe();
  upgradeTimer = setInterval(probeHls, 30000);
  setTimeout(probeHls, 5000);
}

function stopUpgradeProbe() {
  if (upgradeTimer) {
    clearInterval(upgradeTimer);
    upgradeTimer = null;
  }
}

function scheduleRecover() {
  if (recoverTimer) return;
  recoverTimer = setTimeout(() => {
    recoverTimer = null;
    if (!audio.paused && audio.readyState < 3) {
      const seekTarget = userSeeked ? audio.currentTime : null;
      teardownHls();
      setupHls();
      if (seekTarget != null) {
        hls.once(Hls.Events.MANIFEST_PARSED, () => {
          hls.startPosition = seekTarget;
          audio.currentTime = seekTarget;
          audio.play().catch(() => {});
        });
      } else {
        goLive();
      }
    }
  }, 15000);
}

let unmuted = false;
function attemptPlay() {
  if (!unmuted) audio.muted = true;
  audio.play().catch(() => {});
  if (!unmuted) {
    const unmute = () => {
      if (unmuted) return;
      unmuted = true;
      audio.muted = false;
      audio.play().catch(() => {});
      document.removeEventListener('click', unmute);
      document.removeEventListener('touchstart', unmute);
    };
    document.addEventListener('click', unmute);
    document.addEventListener('touchstart', unmute);
  }
}

function onReady() {
  playPause.disabled = false;
  hlsFailCount = 0;
  const p = loadPosition();
  if (p && p.t && Date.now() - p.ts < 3600000 && audio.seekable.length &&
      p.t >= audio.seekable.start(0) && p.t <= audio.seekable.end(audio.seekable.length - 1)) {
    audio.currentTime = p.t;
    userSeeked = true;
    lastUserPos = p.t;
  }
  attemptPlay();
}

function trueEdgeMedia() {
  if (mode === 'mp3') return audio.currentTime;
  if (audio.seekable.length) return audio.seekable.end(audio.seekable.length - 1);
  return 0;
}

function syncPosition() {
  if (mode === 'mp3') return audio.currentTime;
  if (hls && hls.liveSyncPosition) return hls.liveSyncPosition;
  return trueEdgeMedia();
}

function mediaToWall(mediaTime) {
  if (mode === 'mp3') return Date.now() / 1000;
  const edge = trueEdgeMedia();
  if (edge > 0) return liveWall - (edge - mediaTime);
  return Date.now() / 1000;
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

function isAtLive() {
  if (mode === 'mp3') return true;
  const target = syncPosition();
  return Math.abs(target - audio.currentTime) < 5;
}

function setArt(url) {
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

function loadPosition() {
  const m = document.cookie.match(/(?:^|; )tj_pos=([^;]*)/);
  if (!m) return null;
  try { return JSON.parse(decodeURIComponent(m[1])); } catch { return null; }
}

function fmt(s) {
  s = Math.max(0, s | 0);
  const m = (s / 60) | 0;
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

function render() {
  const live = isOnline || audioPlaying;
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
  const song = nowPlayingSong || findSongAt(wc);
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

playPause.addEventListener('click', () => {
  if (audio.paused) {
    if (!userSeeked && (isAtLive() || !audio.seekable.length)) goLive();
    audio.play().catch((e) => console.error(e));
  } else {
    audio.pause();
  }
});

liveBtn.addEventListener('click', goLive);

function goLive() {
  userSeeked = false;
  if (mode === 'mp3') {
    liveWall = Date.now() / 1000;
    audio.play().catch(() => {});
    return;
  }
  const live = syncPosition();
  if (live) audio.currentTime = live;
  liveWall = Date.now() / 1000;
  audio.play().catch(() => {});
}

audio.addEventListener('timeupdate', () => {
  audioPlaying = true;
  if (userSeeked && !isAtLive()) lastUserPos = audio.currentTime;
  render();
});
audio.addEventListener('seeking', () => {
  if (suppressSeekGuard || scrubbing) return;
  if (userSeeked) {
    const live = syncPosition();
    if (live && Math.abs(audio.currentTime - live) < 5) {
      suppressSeekGuard = true;
      audio.currentTime = lastUserPos;
      setTimeout(() => { suppressSeekGuard = false; }, 200);
    }
  }
});
audio.addEventListener('play', () => {
  audioPlaying = true;
  playPause.textContent = '❚❚';
  if (sunEl) sunEl.style.opacity = '0.1';
});
audio.addEventListener('pause', () => {
  audioPlaying = false;
  playPause.textContent = '▶';
  if (sunEl) sunEl.style.opacity = '1';
  render();
});
audio.addEventListener('waiting', () => {
  if (!audio.paused && mode === 'hls' && !scrubbing) scheduleRecover();
});

let saveTimer = 0;
setInterval(() => {
  liveWall = Date.now() / 1000;
  render();
  const now = Date.now();
  if (now - saveTimer >= 5000) {
    saveTimer = now;
    const t = audio.currentTime;
    if (t && !isNaN(t)) {
      const posData = JSON.stringify({ t: Math.round(t * 10) / 10, ts: now });
      document.cookie = 'tj_pos=' + encodeURIComponent(posData) + '; path=/; max-age=86400';
    }
  }
}, 1000);

const cityEl = document.querySelector('.city');
const sunEl = document.querySelector('.city > .sun');
const playerEl = document.querySelector('.player');

function alignPlayerToSun() {
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

function revealPlayer() {
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

pollNowPlaying();
setInterval(pollNowPlaying, 2000);
setupHls();
render();

const grid = document.querySelector('.synth-grid');
const gridContainer = document.querySelector('.grid-container');
setTimeout(() => {
  grid.style.animationPlayState = 'paused';
  gridContainer.style.opacity = '0';
}, 5000);

window.addEventListener('beforeunload', () => {
  const t = audio.currentTime;
  if (t && !isNaN(t)) {
    const posData = JSON.stringify({ t: Math.round(t * 10) / 10, ts: Date.now() });
    document.cookie = 'tj_pos=' + encodeURIComponent(posData) + '; path=/; max-age=86400';
  }
});
