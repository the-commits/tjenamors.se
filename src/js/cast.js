// Chromecast integration — Cast SDK for streaming to TV/speakers.
// Feature flag: set window.__CAST_ENABLED = false to disable.
// Debug: set window.__DEBUG = true for Cast logging.

import { audio, volumeSlider, volumeIcon } from './dom.js';
import { nowPlayingSong } from './api.js';
import { HLS_STREAM, MP3_STREAM } from './api.js';
import { mode, goLive } from './stream.js';

// --- State ---

let castContext = null;
let remotePlayer = null;
let remotePlayerController = null;
let castBtn = null;
let isCasting = false;
let wasPlayingBeforeCast = false;
let lastSongId = null;

// --- Feature flag ---

function isEnabled() {
  if (window.__CAST_ENABLED === false) return false;
  return true;
}

// --- UI: Cast button ---

function createCastButton() {
  castBtn = document.createElement('i');
  castBtn.id = 'cast-btn';
  castBtn.className = 'fa-brands fa-chromecast';
  castBtn.setAttribute('role', 'button');
  castBtn.setAttribute('tabindex', '0');
  castBtn.title = 'Spela på Chromecast';
  castBtn.style.display = 'none'; // hidden until SDK available

  // Insert into .controls, after share button
  const controls = document.querySelector('.controls');
  const shareBtn = document.getElementById('share-btn');
  if (shareBtn && controls) {
    controls.insertBefore(castBtn, shareBtn.nextSibling);
  } else if (controls) {
    controls.appendChild(castBtn);
  }

  castBtn.addEventListener('click', onCastButtonClick);
  castBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onCastButtonClick();
    }
  });
}

function onCastButtonClick() {
  if (!castContext) return;
  if (castContext.getCurrentSession()) {
    castContext.endCurrentSession(true);
  } else {
    castContext.requestSession().catch(() => {
      // User cancelled or no devices available — silently ignore
    });
  }
}

function updateCastButton() {
  if (!castBtn || !castContext) return;
  const session = castContext.getCurrentSession();
  if (session) {
    castBtn.classList.add('casting');
    castBtn.title = 'Koppla från Chromecast';
  } else {
    castBtn.classList.remove('casting');
    castBtn.title = 'Spela på Chromecast';
  }
}

// --- Cast SDK ---

function initializeCastApi() {
  try {
    castContext = cast.framework.CastContext.getInstance();
    castContext.setOptions({
      receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
    });

    remotePlayer = new cast.framework.RemotePlayer();
    remotePlayerController = new cast.framework.RemotePlayerController(remotePlayer);

    castContext.addEventListener(
      cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
      onSessionStateChanged
    );

    // Show Cast button now that SDK is ready
    if (castBtn) castBtn.style.display = '';

    // If already in a session (page reload while casting), sync state
    if (castContext.getCurrentSession()) {
      isCasting = true;
      wasPlayingBeforeCast = !audio.paused;
      audio.pause();
      updateCastButton();
    }

    if (window.__DEBUG) console.log('[CAST] initialized');
  } catch (e) {
    if (window.__DEBUG) console.log('[CAST] init error:', e);
  }
}

function onGCastApiAvailable(available) {
  if (window.__DEBUG) console.log('[CAST] SDK available:', available);
  if (available) initializeCastApi();
}

function loadCastSDK() {
  window.__onGCastApiAvailable = onGCastApiAvailable;
  const s = document.createElement('script');
  s.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
  s.async = true;
  document.head.appendChild(s);
}

// --- Session handling ---

function onSessionStateChanged(event) {
  switch (event.sessionState) {
    case cast.framework.SessionState.SESSION_STARTED:
      isCasting = true;
      wasPlayingBeforeCast = !audio.paused;
      audio.pause();
      loadMediaToCast();
      updateCastButton();
      if (window.__DEBUG) console.log('[CAST] session started');
      break;

    case cast.framework.SessionState.SESSION_ENDED:
      isCasting = false;
      if (wasPlayingBeforeCast) goLive();
      updateCastButton();
      if (window.__DEBUG) console.log('[CAST] session ended');
      break;
  }
}

function getCurrentStreamUrl() {
  return mode === 'hls' ? HLS_STREAM : MP3_STREAM;
}

function getContentType() {
  return mode === 'hls' ? 'application/vnd.apple.mpegurl' : 'audio/mpeg';
}

function loadMediaToCast() {
  const session = castContext.getCurrentSession();
  if (!session) return;

  const mediaInfo = new chrome.cast.media.MediaInfo(getCurrentStreamUrl(), getContentType());
  mediaInfo.streamType = chrome.cast.media.StreamType.LIVE;

  // Set metadata if current song is known
  if (nowPlayingSong) {
    attachMetadata(mediaInfo);
  }

  const request = new chrome.cast.media.LoadRequest(mediaInfo);
  session.loadMedia(request).then(() => {
    if (window.__DEBUG) console.log('[CAST] media loaded');
  }).catch((err) => {
    if (window.__DEBUG) console.log('[CAST] load error:', err);
  });
}

// --- Metadata ---

function attachMetadata(mediaInfo) {
  if (!nowPlayingSong) return;
  const meta = new chrome.cast.media.MusicTrackMediaMetadata();
  meta.songName = nowPlayingSong.title || 'TjenaMors Radio';
  meta.artist = nowPlayingSong.artist || 'Vi spelar bra skit!';
  meta.albumName = 'TjenaMors.se';
  meta.title = nowPlayingSong.title || 'TjenaMors Radio';
  meta.subtitle = nowPlayingSong.artist || 'Vi spelar bra skit!';
  if (nowPlayingSong.art) {
    meta.images = [new chrome.cast.Image(nowPlayingSong.art)];
  }
  mediaInfo.metadata = meta;
}

function updateMetadataOnCast() {
  if (!isCasting || !castContext || !nowPlayingSong) return;
  if (nowPlayingSong.id === lastSongId) return;
  lastSongId = nowPlayingSong.id;

  // Reload media with updated metadata so Chromecast display updates
  const session = castContext.getCurrentSession();
  if (!session) return;

  const mediaInfo = new chrome.cast.media.MediaInfo(getCurrentStreamUrl(), getContentType());
  mediaInfo.streamType = chrome.cast.media.StreamType.LIVE;
  attachMetadata(mediaInfo);

  const request = new chrome.cast.media.LoadRequest(mediaInfo);
  session.loadMedia(request).catch(() => {});

  if (window.__DEBUG) console.log('[CAST] metadata updated:', nowPlayingSong.title);
}

// --- Volume sync when casting ---

function onVolumeInput() {
  if (!isCasting || !remotePlayer || !remotePlayerController) return;
  remotePlayer.volumeLevel = parseFloat(volumeSlider.value);
  remotePlayerController.setVolumeLevel();
}

function onMuteClick() {
  if (!isCasting || !remotePlayer || !remotePlayerController) return;
  remotePlayer.isMuted = !remotePlayer.isMuted;
  remotePlayerController.muteOrUnmute();
}

// --- Init ---

export function initCast() {
  if (!isEnabled()) {
    if (window.__DEBUG) console.log('[CAST] disabled (feature flag)');
    return;
  }

  createCastButton();
  loadCastSDK();

  // Sync volume slider to Chromecast when casting
  volumeSlider.addEventListener('input', onVolumeInput);
  volumeIcon.addEventListener('click', onMuteClick);

  // Poll for metadata updates while casting (every 2s, same as API poll)
  setInterval(updateMetadataOnCast, 2000);

  if (window.__DEBUG) console.log('[CAST] module loaded');
}
