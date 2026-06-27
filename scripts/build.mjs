import { cp, rm, mkdir } from 'node:fs/promises';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, '..', 'src');
const dist = join(root, '..', 'dist');

function stripVendorPrefixes(css) {
  const patterns = [
    '-webkit-text-size-adjust',
    '-moz-column-gap',
    '-moz-osx-font-smoothing',
  ];
  return css
    .split('\n')
    .filter((line) => !patterns.some((p) => line.includes(p)))
    .join('\n');
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(src, dist, { recursive: true });

// Strip bogus vendor-prefixed declarations from CSS files.
const cssFiles = [
  join(dist, 'build', 'assets', 'base.css'),
  join(dist, 'build', 'assets', 'fontawesome', 'css', 'all.min.css'),
];

for (const file of cssFiles) {
  if (!existsSync(file)) {
    console.log('Skipped ' + file.replace(dist, '') + ' (not found)');
    continue;
  }
  const original = readFileSync(file, 'utf-8');
  const cleaned = stripVendorPrefixes(original);
  if (cleaned !== original) {
    writeFileSync(file, cleaned, 'utf-8');
    console.log('Stripped vendor prefixes from' + file.replace(dist, ''));
  } else {
    console.log('No vendor prefixes found in' + file.replace(dist, ''));
  }
}

console.log('Built src/ -> dist/');
