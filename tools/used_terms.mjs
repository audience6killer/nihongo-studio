#!/usr/bin/env node
/* used_terms.mjs — every term already taken by some chapter or tap file.
 *
 * Vocabulary terms are global keys: two chapters cannot both teach 影響.
 * Read-only, so several chapters can be authored at once.
 *
 *   node tools/used_terms.mjs            # one term per line
 *   node tools/used_terms.mjs --count    # just the number
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'vocab');
const terms = new Set();

for (const name of readdirSync(DIR)) {
  if (!name.endsWith('.tsv')) continue;
  for (const line of readFileSync(join(DIR, name), 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const term = line.split('\t')[0].trim();
    if (term) terms.add(term);
  }
}

if (process.argv.includes('--count')) {
  console.log(terms.size);
} else {
  console.log([...terms].sort().join('\n'));
}
