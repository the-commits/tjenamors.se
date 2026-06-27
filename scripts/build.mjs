import { cp, rm, mkdir } from 'node:fs/promises';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, extname } from 'node:path';
import { minify as minifyHtml } from 'html-minifier-terser';
import { minify as minifyCss } from 'csso';
import { minify as minifyJs } from 'terser';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, '..', 'src');
const dist = join(root, '..', 'dist');

// --- Helpers ---

function* walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

/** Collect all file paths in dist/ matching given extensions, excluding certain paths. */
function collect(exts, exclude = []) {
  const files = [];
  for (const file of walk(dist)) {
    const ext = extname(file);
    if (!exts.includes(ext)) continue;
    if (exclude.some((p) => file.includes(p))) continue;
    files.push(file);
  }
  return files.sort();
}

// --- Vendor prefix stripping ---

function stripVendorPrefixes(css) {
  return css
    .replace(/-webkit-text-size-adjust\s*:\s*[^;]+;?\s*/gi, '')
    .replace(/-moz-column-gap\s*:\s*[^;]+;?\s*/gi, '')
    .replace(/-moz-osx-font-smoothing\s*:\s*[^;]+;?\s*/gi, '')
    .replace(/;;/g, ';');
}

// --- Minifiers ---

async function minifyAllCss() {
  const excluded = ['fontawesome'];
  const files = collect(['.css'], excluded);
  for (const file of files) {
    const original = readFileSync(file, 'utf-8');
    let result;
    try {
      result = minifyCss(original);
    } catch (err) {
      console.log('  CSS minify error (skipping):' + relative(dist, file));
      continue;
    }
    if (result.css !== original) {
      writeFileSync(file, result.css, 'utf-8');
    }
    console.log('  Minified CSS:' + relative(dist, file));
  }
  return files.length;
}

async function minifyAllJs() {
  const files = collect(['.js'], ['hls.min.js']);
  for (const file of files) {
    const original = readFileSync(file, 'utf-8');
    let result;
    try {
      result = await minifyJs(original, { module: true });
    } catch (err) {
      console.log('  JS minify error (skipping):' + relative(dist, file));
      continue;
    }
    if (result.code !== original) {
      writeFileSync(file, result.code, 'utf-8');
    }
    console.log('  Minified JS:' + relative(dist, file));
  }
  return files.length;
}

async function minifyAllHtml() {
  const files = collect(['.html']);
  for (const file of files) {
    const original = readFileSync(file, 'utf-8');
    let result;
    try {
      result = await minifyHtml(original, {
        collapseWhitespace: true,
        removeComments: true,
        removeAttributeQuotes: true,
        collapseBooleanAttributes: true,
        removeRedundantAttributes: true,
        decodeEntities: true,
      });
    } catch (err) {
      console.log('  HTML minify error (skipping):' + relative(dist, file));
      continue;
    }
    if (result !== original) {
      writeFileSync(file, result, 'utf-8');
    }
    console.log('  Minified HTML:' + relative(dist, file));
  }
  return files.length;
}

// --- Main ---

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(src, dist, { recursive: true });

console.log('Copied src/ -> dist/');

// Strip bogus vendor-prefixed declarations from CSS files.
const vendorFiles = [
  join(dist, 'build', 'assets', 'base.css'),
  join(dist, 'build', 'assets', 'fontawesome', 'css', 'all.min.css'),
];

for (const file of vendorFiles) {
  if (!existsSync(file)) {
    console.log('Skipped' + relative(dist, file) + ' (not found)');
    continue;
  }
  const original = readFileSync(file, 'utf-8');
  const cleaned = stripVendorPrefixes(original);
  if (cleaned !== original) {
    writeFileSync(file, cleaned, 'utf-8');
    console.log('Stripped vendor prefixes from' + relative(dist, file));
  } else {
    console.log('No vendor prefixes in' + relative(dist, file));
  }
}

// Minify CSS (skips fontawesome/ — already minified).
const cssCount = await minifyAllCss();

// Minify JS (skips hls.min.js — already minified CDN copy).
const jsCount = await minifyAllJs();

// Minify HTML.
const htmlCount = await minifyAllHtml();

console.log(`Minified ${cssCount} CSS, ${jsCount} JS, ${htmlCount} HTML file(s).`);
console.log('Built src/ -> dist/');
