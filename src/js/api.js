// AzuraCast API communication — fetching, parsing, art preloading.
// No DOM manipulation except Image() for preloading.

export const API = 'https://radio.tjenamors.se/api/nowplaying/1';
export const HLS_STREAM = 'https://radio.tjenamors.se/hls/tjenamors_radio/live.m3u8';
export const MP3_STREAM = 'https://radio.tjenamors.se/listen/tjenamors_radio/radio.mp3';

export let nowPlayingSong = null;
export let timeline = [];
export let nextUp = null;
export let isOnline = false;
export let elapsedCapturedAt = 0;

let lastFetch = 0;
const preloadedArt = new Set();

export function normalize(np) {
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

export function preloadArt(url) {
  if (!url || preloadedArt.has(url)) return;
  preloadedArt.add(url);
  const img = new Image();
  img.src = url;
}

export async function pollNowPlaying() {
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

export function fetchNow() {
  const now = Date.now();
  if (now - lastFetch < 2000) return;
  lastFetch = now;
  pollNowPlaying();
}
