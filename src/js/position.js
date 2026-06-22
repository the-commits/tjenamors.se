// Cookie position save/restore — no other module dependencies.

import { audio } from './dom.js';

export function loadPosition() {
  const m = document.cookie.match(/(?:^|; )tj_pos=([^;]*)/);
  if (!m) return null;
  try { return JSON.parse(decodeURIComponent(m[1])); } catch { return null; }
}

export function savePosition() {
  const t = audio.currentTime;
  if (t && !isNaN(t)) {
    const now = Date.now();
    const posData = JSON.stringify({ t: Math.round(t * 10) / 10, ts: now });
    document.cookie = 'tj_pos=' + encodeURIComponent(posData) + '; path=/; max-age=86400';
  }
}

export function savePositionBeforeUnload() {
  const t = audio.currentTime;
  if (t && !isNaN(t)) {
    const posData = JSON.stringify({ t: Math.round(t * 10) / 10, ts: Date.now() });
    document.cookie = 'tj_pos=' + encodeURIComponent(posData) + '; path=/; max-age=86400';
  }
}
