#!/usr/bin/env node
// Checks all source files for lines exceeding maxLength.
// Excludes dist/, node_modules/, and binary/image files.

import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const maxLength = parseInt(process.argv[2] || '120', 10);

const include = [
  'src/**/*',
  'scripts/*.mjs',
  'tests/*.mjs',
  'eslint.config.mjs',
  'package.json',
];

const exclude = [
  'dist/',
  'node_modules/',
  '.git/',
  '.opencode/',
  '.husky/',
  'src/build/',
  'package-lock.json',
];

function matches(path, patterns) {
  return patterns.some((p) => {
    const parts = p.replace(/\*\*/g, '__GLOBSTAR__').replace(/\*/g, '[^/]*').replace('__GLOBSTAR__', '.*');
    const re = new RegExp('^' + parts + '$');
    return re.test(path);
  });
}

import { readdirSync, statSync } from 'node:fs';

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = full.replace(root + '/', '');
    if (exclude.some((e) => rel.startsWith(e))) continue;
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (statSync(full).isFile()) {
      const ext = extname(full);
      if (['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.svg'].includes(ext)) continue;
      files.push(rel);
    }
  }
  return files;
}

let failures = 0;
const files = walk(root);

for (const file of files) {
  const content = readFileSync(join(root, file), 'utf-8');
  const lines = content.split('\n');
  let lineNum = 0;
  for (const line of lines) {
    lineNum++;
    if (line.length > maxLength) {
      // Skip long URLs in comments/data URIs
      if (/https?:\/\/[^\s]{80,}/.test(line)) continue;
      console.error(`✗ ${file}:${lineNum} (${line.length} cols): ${line.slice(0, maxLength)}…`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`\n✗ ${failures} line(s) exceed ${maxLength} characters`);
  process.exit(1);
} else {
  console.log(`✓ All lines within ${maxLength} characters`);
}
