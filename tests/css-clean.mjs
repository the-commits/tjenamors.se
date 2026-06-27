// Build-output test: verify zero bogus vendor-prefixed CSS declarations
// in the built CSS files. Reads dist/ files after build and asserts the
// known-problematic lines are stripped.
//
// CSS parser warnings only appear in the DevTools console UI, not via
// Puppeteer's page.on('console') or CDP Log.enable in headless mode.
// This file-level check is the reliable way to verify the fix.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const BOGUS_PATTERNS = [
  '-webkit-text-size-adjust',
  '-moz-column-gap',
  '-moz-osx-font-smoothing',
];

const CSS_FILES = [
  'build/assets/base.css',
  'build/assets/fontawesome/css/all.min.css',
];

let failures = 0;
let passed = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  \u2713 ${label}`);
    passed++;
  } else {
    console.error(`  \u2717 ${label} \u2014 ${detail}`);
    failures++;
  }
}

console.log('--- Checking built CSS files for bogus vendor prefixes ---\n');

for (const file of CSS_FILES) {
  const filePath = join(root, file);

  check(`${file} exists`, existsSync(filePath), `file not found at ${filePath}`);

  if (!existsSync(filePath)) continue;

  const content = readFileSync(filePath, 'utf-8');

  for (const pattern of BOGUS_PATTERNS) {
    // Find line numbers of any remaining occurrences
    const lines = content.split('\n');
    const matches = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(pattern)) {
        matches.push(i + 1);
      }
    }

    check(`${file} has no "${pattern}" (${matches.length} found)`,
      matches.length === 0,
      `found at line(s) ${matches.join(', ')}`);
  }
}

console.log(`\n===== Results: ${passed} passed, ${failures} failed =====\n`);
process.exit(failures ? 1 : 0);
