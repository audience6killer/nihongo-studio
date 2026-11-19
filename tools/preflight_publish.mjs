#!/usr/bin/env node
/* preflight_publish.mjs — check the repository is safe and sane to publish.
 *
 *   git ls-files | node tools/preflight_publish.mjs
 *
 * Takes the tracked file list on stdin rather than shelling out to git: the
 * sandbox denies a Node process capturing another program's output, and this
 * tool must work there. Verifies only what git actually tracks — no key-shaped
 * material, no build output, no oversized blobs — and exits 1 if anything needs
 * attention before a push.
 */
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const notes = [];

const files = readFileSync(0, 'utf8')
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean);

if (!files.length) {
  console.error('  no file list on stdin — run: git ls-files | node tools/preflight_publish.mjs');
  process.exit(2);
}

// 1 ── secret-shaped material in tracked files
//
// The value patterns apply everywhere. The two "name" patterns are skipped for
// the tools that define them, because those files contain the strings as
// regex sources, not as values — a real key would still be caught by the JWT
// and private-key patterns, which are never skipped.
const SCANNERS = new Set(['tools/preflight_publish.mjs', 'tools/prepare_deploy.mjs', 'tools/qa.mjs']);
const VALUE_PATTERNS = [
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, 'a JWT'],
  [/BEGIN [A-Z ]*PRIVATE KEY/, 'a private key block'],
  [/gh[pous]_[A-Za-z0-9]{20,}/, 'a GitHub token'],
];
const NAME_PATTERNS = [
  [/SUPABASE_SERVICE/, 'the service-role env var'],
  [/["']service_role["']/, 'a service_role value'],
];

for (const f of files) {
  let text;
  try {
    text = readFileSync(join(ROOT, f), 'utf8');
  } catch {
    continue; // binary or unreadable
  }
  for (const [re, what] of VALUE_PATTERNS) {
    if (re.test(text)) problems.push(`${f} contains ${what}`);
  }
  if (SCANNERS.has(f)) continue;
  for (const [re, what] of NAME_PATTERNS) {
    if (re.test(text)) problems.push(`${f} contains ${what}`);
  }
}

// 2 ── things that must never be tracked
const FORBIDDEN_PATHS = [/^deploy\//, /^node_modules\//, /^scratch\//, /^\.env/, /\.zip$/, /^\.npm-cache\//];
for (const f of files) {
  for (const re of FORBIDDEN_PATHS) {
    if (re.test(f)) problems.push(`${f} should be gitignored, not committed`);
  }
}

// 3 ── oversized blobs
let total = 0;
for (const f of files) {
  let size = 0;
  try {
    size = statSync(join(ROOT, f)).size;
  } catch {
    continue;
  }
  total += size;
  if (size > 2_000_000) problems.push(`${f} is ${(size / 1048576).toFixed(1)} MB — too large to commit`);
}

// 4 ── the committed build config must be empty
try {
  const config = readFileSync(join(ROOT, 'assets/js/data/config.js'), 'utf8');
  if (/url:\s*"[^"]+"/.test(config) || /anonKey:\s*"[^"]+"/.test(config)) {
    notes.push('assets/js/data/config.js carries build values; the committed copy should be empty');
  }
} catch {
  problems.push('assets/js/data/config.js is missing');
}

console.log('preflight');
console.log(`  files   ${files.length} tracked, ${(total / 1048576).toFixed(1)} MB total`);

if (notes.length) {
  console.log('\n  notes');
  for (const n of notes) console.log(`    - ${n}`);
}

if (problems.length) {
  console.error(`\n  ${problems.length} blocking problem(s):`);
  for (const p of problems) console.error(`    x ${p}`);
  process.exit(1);
}
console.log('\npreflight: clean — safe to publish');
