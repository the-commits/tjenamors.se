// SEO — updates JSON-LD structured data with current song info.
// Feature flag: set window.__SEO_ENABLED = false to disable.
// Debug: set window.__DEBUG = true for SEO update logging.

import { nowPlayingSong } from './api.js';

// --- State ---

let lastSongId = null;
let checkInterval = null;
let schemaEl = null;

// --- Feature flag ---

function isEnabled() {
  if (window.__SEO_ENABLED === false) return false;
  return true;
}

// --- Update JSON-LD with current song ---

function updateSchema() {
  if (!schemaEl) return;
  if (!nowPlayingSong) return;

  if (nowPlayingSong.id === lastSongId) return;
  lastSongId = nowPlayingSong.id;

  try {
    const schema = JSON.parse(schemaEl.textContent);

    // Add/update BroadcastEvent with current song
    schema.event = {
      '@type': 'MusicEvent',
      name: 'Nu spelas: ' + (nowPlayingSong.title || 'okänd låt'),
      description: nowPlayingSong.artist || 'okänd artist',
      startDate: new Date(nowPlayingSong.played_at * 1000).toISOString(),
      location: {
        '@type': 'Place',
        name: 'TjenaMors.se',
      },
    };

    schemaEl.textContent = JSON.stringify(schema, null, 2);

    // Also update OG meta tags for crawlers
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    const twitterDesc = document.querySelector('meta[name="twitter:description"]');

    const songLabel = nowPlayingSong.title + ' — ' + nowPlayingSong.artist;
    if (ogTitle) ogTitle.setAttribute('content', 'TjenaMors.se — ' + songLabel);
    if (ogDesc) {
      ogDesc.setAttribute('content',
        'Nu spelas: ' + songLabel +
        '. Rebelradio — från ölstinkande punk till norsk getblodsdyrkande hobbit metal, varvat med ska.');
    }
    if (twitterTitle) twitterTitle.setAttribute('content', 'TjenaMors.se — ' + songLabel);
    if (twitterDesc) twitterDesc.setAttribute('content', 'Nu spelas: ' + songLabel);

    // Also update og:image with album art if available
    if (nowPlayingSong.art) {
      const ogImage = document.querySelector('meta[property="og:image"]');
      const twitterImage = document.querySelector('meta[name="twitter:image"]');
      if (ogImage) ogImage.setAttribute('content', nowPlayingSong.art);
      if (twitterImage) twitterImage.setAttribute('content', nowPlayingSong.art);
    }

    if (window.__DEBUG) console.log('[SEO] updated schema: ' + songLabel);
  } catch (e) {
    if (window.__DEBUG) console.log('[SEO] parse error', e);
  }
}

// --- Init ---

export function initSeo() {
  if (!isEnabled()) {
    if (window.__DEBUG) console.log('[SEO] disabled (feature flag)');
    return;
  }

  schemaEl = document.getElementById('seo-schema');
  if (!schemaEl) return;

  // Initial update if song data already exists
  updateSchema();

  // Poll every 2s for song changes (same cadence as API poll)
  checkInterval = setInterval(updateSchema, 2000);

  if (window.__DEBUG) console.log('[SEO] initialized');
}
