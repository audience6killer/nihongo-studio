#!/usr/bin/env node
/* check_tap.mjs — prove that tap-to-define covers every word of every passage.
 *
 * This loads the same core/lang.js the browser uses and runs the same
 * segmentation over the same content files, so a pass here means the runtime
 * path is covered. If it fails it names the exact uncovered run and the
 * surrounding context; add the term to content/vocab/tap-extra.tsv and
 * rebuild with `python tools/build_tapdata.py`.
 *
 * Run: node tools/check_tap.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

function loadSandbox(files) {
  const sandbox = { console, Date, Math, JSON, Intl, String, Number, Object, Array, RegExp, isFinite, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const rel of files) {
    let src;
    try {
      src = readFileSync(join(ROOT, rel), 'utf8');
    } catch {
      console.error(`  x ${rel} is missing. Run the build tools first (see README.md).`);
      process.exit(1);
    }
    vm.runInContext(src, sandbox, { filename: rel });
  }
  return sandbox;
}

const S = loadSandbox([
  'assets/js/core/util.js',
  'assets/js/core/lang.js',
  'assets/js/data/vocab.js',
  'assets/js/data/lessons.js',
  'assets/js/data/tap.js'
]);

const L = S.NJ.L;
const VOCAB = S.NJ_VOCAB;
const LESSONS = S.NJ_LESSONS;
const TAP = S.NJ_TAP;

if (!VOCAB || !LESSONS || !TAP) {
  console.error('  x generated data missing (vocab.js / lessons.js / tap.js)');
  process.exit(1);
}

/* ------------------------------------------------------------ collect text */
/** Every Japanese string that must be tappable, with a human-readable path. */
function collectTexts(lesson) {
  const out = [];
  const add = (where, text) => { if (typeof text === 'string' && text) out.push({ where, text }); };

  add(`lesson ${lesson.chapter} reading`, lesson.reading && lesson.reading.text_l2);
  (lesson.reading && lesson.reading.sentences || []).forEach((s, i) =>
    add(`lesson ${lesson.chapter} reading.sentences[${i}]`, s.l2));
  (lesson.reading && lesson.reading.questions || []).forEach((q, i) => {
    add(`lesson ${lesson.chapter} reading.questions[${i}].q`, q.q_l2);
    (q.options_l2 || []).forEach((o, j) => add(`lesson ${lesson.chapter} reading.questions[${i}].options[${j}]`, o));
  });

  const g = lesson.grammar || {};
  (g.examples || []).forEach((ex, i) => add(`lesson ${lesson.chapter} grammar.examples[${i}].l2`, ex.l2));
  (g.drills || []).forEach((d, i) => {
    add(`lesson ${lesson.chapter} grammar.drills[${i}].q`, d.q_l2);
    (d.options_l2 || []).forEach((o, j) => add(`lesson ${lesson.chapter} grammar.drills[${i}].options[${j}]`, o));
  });

  ((lesson.listening && lesson.listening.dictation) || []).forEach((d, i) =>
    add(`lesson ${lesson.chapter} listening.dictation[${i}]`, d.l2));

  add(`lesson ${lesson.chapter} writing.model_l2`, lesson.writing && lesson.writing.model_l2);
  return out;
}

/* ------------------------------------------------------------- the checks */
const errors = [];
const entries = TAP.entries;

/** Punctuation needs no dictionary entry, even though ー and ・ sit in kana blocks. */
const PUNCT_ONLY = /^[\s、。，．・「」『』（）()！？!?…‥ー～〜\-—–・]+$/;

let textsChecked = 0;
let tokensChecked = 0;
let unknownCount = 0;
const unknownSeen = new Map();

for (const lesson of LESSONS) {
  // 1. The passage must equal the concatenation of its sentence pairs.
  const r = lesson.reading || {};
  const joined = (r.sentences || []).map((s) => s.l2).join('');
  if (r.text_l2 && joined !== r.text_l2) {
    errors.push(`lesson ${lesson.chapter}: reading.text_l2 does not equal the concatenation of sentences[].l2`);
  }

  for (const { where, text } of collectTexts(lesson)) {
    textsChecked++;
    const segs = L.segment(text, entries);

    // 2. Segmentation must be lossless.
    const rebuilt = segs.map((s) => s.t).join('');
    if (rebuilt !== text) {
      errors.push(`${where}: segmentation is lossy (round-trip mismatch)`);
      continue;
    }

    // 3. Every token containing kanji or kana must have a dictionary entry.
    let offset = 0;
    for (const seg of segs) {
      const tok = seg.t;
      const at = offset;
      offset += tok.length;
      tokensChecked++;

      if (PUNCT_ONLY.test(tok)) continue;
      const japanese = L.hasKanji(tok) || L.hasKana(tok);
      if (!japanese) continue;
      if (entries[tok]) continue;

      unknownCount++;
      const context = text.slice(Math.max(0, at - 10), at + tok.length + 10);
      if (!unknownSeen.has(tok)) unknownSeen.set(tok, []);
      unknownSeen.get(tok).push(`${where} …${context}…`);
    }
  }
}

// 4. Every vocabulary word must be present in the tap dictionary.
for (const word of VOCAB.words) {
  if (!entries[word.w]) errors.push(`vocabulary word ${word.w} (lesson ${word.lesson}) has no tap entry`);
}

// 5. No entry may be missing a reading or a gloss.
for (const [term, entry] of Object.entries(entries)) {
  if (!entry.r || !entry.g) errors.push(`tap entry ${term} is missing a reading or a gloss`);
}

/* ----------------------------------------------------------------- report */
if (errors.length || unknownCount) {
  if (unknownCount) {
    console.error(`\n  ${unknownCount} token(s) have no dictionary entry:\n`);
    const ranked = [...unknownSeen.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [tok, places] of ranked) {
      console.error(`  ✗ ${tok}   (${places.length}x)`);
      console.error(`      ${places[0]}`);
      if (places.length > 1) console.error(`      …and ${places.length - 1} more place(s)`);
    }
    console.error('\n  Add these to content/vocab/tap-extra.tsv, then:');
    console.error('    python tools/build_tapdata.py && node tools/check_tap.mjs\n');
  }
  for (const e of errors) console.error(`  ✗ ${e}`);
  if (!unknownCount) console.error('');
  process.exit(1);
}

console.log(`  tap coverage: ${tokensChecked} tokens in ${textsChecked} texts, all resolved (${TAP.meta.count} entries)`);
