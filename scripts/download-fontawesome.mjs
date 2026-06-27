#!/usr/bin/env node
// One-time download of Font Awesome 6 CSS + webfonts into src/.
// Run when upgrading FA or setting up the project fresh.
// Usage: node scripts/download-fontawesome.mjs

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const faDir = join(root, 'build', 'assets', 'fontawesome');

const BASE = 'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6';

const FILES = [
  'css/all.min.css',
  'webfonts/fa-brands-400.woff2',
  'webfonts/fa-regular-400.woff2',
  'webfonts/fa-solid-900.woff2',
  'webfonts/fa-v4compatibility.woff2',
];

async function main() {
  console.log('Downloading Font Awesome 6 to ' + faDir + '\n');

  for (const file of FILES) {
    const url = BASE + '/' + file;
    const dest = join(faDir, file);
    const dir = dirname(dest);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const res = await fetch(url);
    if (!res.ok) {
      console.error('  Failed: ' + url + ' (' + res.status + ')');
      process.exit(1);
    }

    const buf = await res.arrayBuffer();
    writeFileSync(dest, Buffer.from(buf));
    console.log('  Downloaded: ' + file);
  }

  console.log('\nDone! Font Awesome 6 saved to src/build/assets/fontawesome/');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
