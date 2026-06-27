// Share — Web Share API with clipboard fallback.
// Feature flag: set window.__SHARE_ENABLED = false to disable.
// Debug: set window.__DEBUG = true for Share logging.

import { nowPlayingSong } from './api.js';
import { shareBtn } from './dom.js';

// --- Feature flag ---

function isEnabled() {
  if (window.__SHARE_ENABLED === false) return false;
  return true;
}

// --- Share logic ---

function getShareData() {
  const url = 'https://tjenamors.se';
  if (nowPlayingSong && nowPlayingSong.title) {
    const title = nowPlayingSong.title || 'TjenaMors Radio';
    const artist = nowPlayingSong.artist || 'Vi spelar bra skit!';
    return {
      title: 'TjenaMors.se — ' + title,
      text: 'Nu spelas: ' + title + ' — ' + artist +
        '. Rebelradio från ölstinkande punk till norsk getblodsdyrkande hobbit metal, varvat med ska.',
      url: url,
    };
  }
  return {
    title: 'TjenaMors.se',
    text: 'Rebelradio från ölstinkande punk till norsk getblodsdyrkande hobbit metal, varvat med ska.' +
      ' Helt utan tracking.',
    url: url,
  };
}

async function onShareClick() {
  const data = getShareData();

  // Try native Web Share API first (mobile)
  if (navigator.share) {
    try {
      await navigator.share({
        title: data.title,
        text: data.text,
        url: data.url,
      });
      if (window.__DEBUG) console.log('[SHARE] shared via Web Share API');
      return;
    } catch (e) {
      // User cancelled or API unavailable — fall through to clipboard
      if (e.name !== 'AbortError') {
        if (window.__DEBUG) console.log('[SHARE] Web Share API error:', e);
      }
    }
  }

  // Fallback: copy link to clipboard
  try {
    await navigator.clipboard.writeText(data.url);
    showCopiedFeedback();
    if (window.__DEBUG) console.log('[SHARE] link copied to clipboard');
  } catch (e) {
    if (window.__DEBUG) console.log('[SHARE] clipboard write error:', e);
  }
}

// --- Copied feedback ---

let feedbackTimeout = null;

function showCopiedFeedback() {
  if (!shareBtn) return;
  const originalClass = shareBtn.className;
  shareBtn.className = 'fa-solid fa-check';
  shareBtn.style.color = '#36e2f8';
  shareBtn.title = 'Länk kopierad!';

  if (feedbackTimeout) clearTimeout(feedbackTimeout);
  feedbackTimeout = setTimeout(() => {
    shareBtn.className = originalClass;
    shareBtn.style.color = '';
    shareBtn.title = 'Dela';
  }, 2000);
}

// --- Init ---

export function initShare() {
  if (!isEnabled()) {
    if (window.__DEBUG) console.log('[SHARE] disabled (feature flag)');
    return;
  }

  if (!shareBtn) {
    if (window.__DEBUG) console.log('[SHARE] button not found');
    return;
  }

  shareBtn.addEventListener('click', onShareClick);
  shareBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onShareClick();
    }
  });

  if (window.__DEBUG) console.log('[SHARE] initialized');
}
