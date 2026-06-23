// HLS/MP3 streaming — mode switching, live sync, error recovery.
// No direct UI manipulation (only audio element); no dependency on timeline.

import { HLS_STREAM, MP3_STREAM } from './api.js';
import { audio, playPause } from './dom.js';
import { loadPosition } from './position.js';

export let hls = null;
export let liveWall = Date.now() / 1000;
export let mode = 'hls';
export let userSeeked = false;
export let lastUserPos = 0;
export let suppressSeekGuard = false;

export function setSuppressSeekGuard(v) {
  suppressSeekGuard = v;
}

export function tickLiveWall() {
  liveWall = Date.now() / 1000;
}

let hlsFailCount = 0;
let upgradeTimer = null;
let recoverTimer = null;
let unmuted = false;

export function trueEdgeMedia() {
  if (mode === 'mp3') return audio.currentTime;
  if (audio.seekable.length) return audio.seekable.end(audio.seekable.length - 1);
  return 0;
}

export function syncPosition() {
  if (mode === 'mp3') return audio.currentTime;
  if (hls && hls.liveSyncPosition) return hls.liveSyncPosition;
  return trueEdgeMedia();
}

export function mediaToWall(mediaTime) {
  if (mode === 'mp3') return Date.now() / 1000;
  const edge = trueEdgeMedia();
  if (edge > 0) return liveWall - (edge - mediaTime);
  return Date.now() / 1000;
}

export function isAtLive() {
  if (mode === 'mp3') return true;
  const target = syncPosition();
  return Math.abs(target - audio.currentTime) < 5;
}

export function goLive() {
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

export function attemptPlay() {
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

export function onReady() {
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

export function teardownHls() {
  if (hls) {
    try { hls.destroy(); } catch (_) {}
    hls = null;
  }
  audio.removeEventListener('error', onAudioError);
  audio.removeAttribute('src');
  audio.load();
}

export function setupHls() {
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

export function onHlsFatal(data) {
  hlsFailCount++;
  if (hlsFailCount <= 2 && data.type !== Hls.ErrorTypes.NETWORK_ERROR) {
    scheduleRecover();
  } else {
    switchToMp3();
  }
}

export function onAudioError() {
  if (mode === 'hls') switchToMp3();
}

export function switchToMp3() {
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

export function switchToHls() {
  stopUpgradeProbe();
  const wasPlaying = !audio.paused;
  teardownHls();
  setupHls();
  if (wasPlaying) goLive();
}

export async function probeHls() {
  try {
    const res = await fetch(HLS_STREAM, { method: 'HEAD' });
    if (res.ok) switchToHls();
  } catch (_) {}
}

export function startUpgradeProbe() {
  stopUpgradeProbe();
  upgradeTimer = setInterval(probeHls, 30000);
  setTimeout(probeHls, 5000);
}

export function stopUpgradeProbe() {
  if (upgradeTimer) {
    clearInterval(upgradeTimer);
    upgradeTimer = null;
  }
}

export function scheduleRecover() {
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
