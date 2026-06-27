// Central DOM element references — single source of truth for all queries.
// Every module imports its elements from here rather than querying the DOM.

export const audio = document.getElementById('radio');
export const disc = document.getElementById('disc');
export const songText = document.getElementById('song-text');
export const artistEl = document.getElementById('artist');
export const progressFill = document.getElementById('progress-fill');
export const timeLabel = document.getElementById('time');
export const playPause = document.getElementById('play-pause');
export const liveBtn = document.getElementById('live-btn');
export const cityEl = document.querySelector('.city');
export const sunEl = document.querySelector('.city > .sun');
export const playerEl = document.querySelector('.player');
export const gridEl = document.querySelector('.synth-grid');
export const gridContainer = document.querySelector('.grid-container');
export const surfTipEl = document.getElementById('surf-tip');
export const surfTipLink = document.getElementById('surf-tip-link');
export const surfTipText = document.getElementById('surf-tip-text');
