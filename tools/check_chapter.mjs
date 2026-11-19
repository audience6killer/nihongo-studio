#!/usr/bin/env node
/* check_chapter.mjs — validate ONE chapter from its source files only.
 *
 * Unlike check_tap.mjs (which reads the generated bundle), this reads
 * content/lesson-NN.json plus the vocabulary TSVs directly, so several
 * chapters can be authored and checked at the same time without touching
 * generated output or racing each other.
 *
 *   node tools/check_chapter.mjs 4
 *
 * It reports schema problems and tap-coverage gaps with the surrounding text,
 * which is exactly what you need to finish a chapter:
 *
 *   ✗ 終わり   (2x)
 *       reading …文の終わりも変わる。…
 *
 * Exit code 1 means the chapter is not done.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const READ = (p) => readFileSync(join(ROOT, p), 'utf8');
const HAS = (p) => existsSync(join(ROOT, p));

const chapter = Number(process.argv[2]);
if (!Number.isInteger(chapter) || chapter < 1) {
  console.error('usage: node tools/check_chapter.mjs <chapter-number>');
  process.exit(2);
}

const pad = String(chapter).padStart(2, '0');
const lessonPath = `content/lesson-${pad}.json`;
const vocabPath = `content/vocab/recap-${pad}.tsv`;

const problems = [];
const fail = (msg) => problems.push(msg);

/* ------------------------------------------------------------ load sources */
function parseTsv(rel) {
  if (!HAS(rel)) return [];
  const rows = [];
  const lines = READ(rel).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const cells = line.split('\t').map((c) => c.trim());
    if (cells.length < 4) {
      fail(`${rel}:${i + 1}: expected 4+ tab-separated cells, got ${cells.length}`);
      continue;
    }
    rows.push({ w: cells[0], reading: cells[1], gloss: cells[2], pos: cells[3], line: i + 1 });
  }
  return rows;
}

if (!HAS(lessonPath)) {
  console.error(`  ${lessonPath} does not exist yet.`);
  process.exit(1);
}
if (!HAS(vocabPath)) {
  console.error(`  ${vocabPath} does not exist yet.`);
  process.exit(1);
}
const lesson = JSON.parse(READ(lessonPath));

const vocabDir = join(ROOT, 'content', 'vocab');
const allVocab = readdirSync(vocabDir).filter((f) => /^recap-\d+\.tsv$/.test(f)).sort();
const allDecks = readdirSync(vocabDir).filter((f) => /^n2-\d+\.tsv$/.test(f)).sort();
const allTap = readdirSync(vocabDir).filter((f) => /^tap-.*\.tsv$/.test(f)).sort();

// Earlier chapters are legitimate dictionary sources: a chapter recycles what
// has already been taught. The N2 decks count too — a word taught there is in
// the course dictionary for every chapter. Only this chapter's TSV counts as
// its own vocabulary for the writing-task check.
const sources = [
  vocabPath,
  ...allVocab.filter((f) => `content/vocab/${f}` !== vocabPath).map((f) => `content/vocab/${f}`),
  ...allDecks.map((f) => `content/vocab/${f}`),
  ...allTap.map((f) => `content/vocab/${f}`)
];
const entries = Object.create(null);
for (const rel of sources) {
  for (const row of parseTsv(rel)) {
    if (!entries[row.w]) entries[row.w] = { r: row.reading, g: row.gloss };
  }
}

/* --------------------------------------------------------------- the engine */
const sandbox = { console, Date, Math, JSON, Intl, String, Number, Object, Array, RegExp, isFinite };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(READ('assets/js/core/util.js'), sandbox, { filename: 'util.js' });
vm.runInContext(READ('assets/js/core/lang.js'), sandbox, { filename: 'lang.js' });
const L = sandbox.NJ.L;

/* --------------------------------------------------------- schema warnings */
const CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const KANA = /[\u3040-\u309F\u30A0-\u30FF]/;
const MARK = /[\u3005\u30FC]/;
const DIGIT = /[0-9]/;
const countChars = (s) => Array.from(String(s || '')).filter((c) => CJK.test(c) || KANA.test(c) || MARK.test(c) || DIGIT.test(c)).length;

if (lesson.chapter !== chapter) fail(`${lessonPath}: chapter is ${lesson.chapter}, expected ${chapter}`);
if (lesson.schema !== 2) fail(`${lessonPath}: schema must be 2`);

const g = lesson.grammar || {};
for (const key of ['point_l2', 'point_l1', 'explain_l1', 'common_mistake_l1']) {
  if (!String(g[key] || '').trim()) fail(`grammar.${key} is empty`);
}
if ((g.examples || []).length !== 3) fail(`grammar.examples must have exactly 3 entries`);
for (const [i, ex] of (g.examples || []).entries()) {
  for (const k of ['l2', 'reading', 'l1']) if (!String(ex[k] || '').trim()) fail(`grammar.examples[${i}].${k} is empty`);
  if (ex.reading && !/^[\u3041-\u3096\u30A1-\u30FA\u30FC\u309D\u309E\u30FD\u30FE\u3001\u3002\uFF01\uFF1F\u2026\u30FB\u300C\u300D\u300E\u300F\uFF08\uFF09]+$/.test(ex.reading)) {
    fail(`grammar.examples[${i}].reading must be kana (punctuation allowed), got ${ex.reading}`);
  }
}
if ((g.drills || []).length !== 2) fail('grammar.drills must have exactly 2 entries');
for (const [i, d] of (g.drills || []).entries()) {
  const opts = d.options_l2 || [];
  if (opts.length !== 4) fail(`grammar.drills[${i}] must have 4 options, found ${opts.length}`);
  if (!(Number.isInteger(d.answer) && d.answer >= 0 && d.answer < opts.length)) fail(`grammar.drills[${i}].answer out of range`);
  if (new Set(opts).size !== opts.length) fail(`grammar.drills[${i}] has duplicate options`);
  if (!String(d.explain_l1 || '').trim()) fail(`grammar.drills[${i}].explain_l1 is empty`);
}

const r = lesson.reading || {};
const sents = r.sentences || [];
if (sents.length < 3) fail(`reading.sentences needs at least 3 pairs, found ${sents.length}`);
const joined = sents.map((s) => String(s.l2 || '')).join('');
if (r.text_l2 && sents.length && joined !== r.text_l2) fail('reading.text_l2 must equal the concatenation of sentences[].l2');
const readingChars = countChars(r.text_l2);
if (readingChars < 240 || readingChars > 360) fail(`reading is ${readingChars} characters; keep it between 240 and 360`);
for (const [i, s] of sents.entries()) {
  if (!String(s.l2 || '').trim() || !String(s.l1 || '').trim()) fail(`reading.sentences[${i}] needs both l2 and l1`);
}
const l1s = sents.map((s) => String(s.l1 || '').trim().toLowerCase()).filter(Boolean);
if (new Set(l1s).size !== l1s.length) fail('two sentences share an identical translation — translations must be per sentence');
const questions = r.questions || [];
if (questions.length !== 3) fail(`reading.questions must have exactly 3 entries, found ${questions.length}`);
for (const [i, q] of questions.entries()) {
  const opts = q.options_l2 || [];
  if (opts.length !== 4) fail(`reading.questions[${i}] must have 4 options, found ${opts.length}`);
  if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < opts.length)) fail(`reading.questions[${i}].answer out of range`);
  if (new Set(opts).size !== opts.length) fail(`reading.questions[${i}] has duplicate options`);
  if (!String(q.q_l2 || '').trim() || !String(q.explain_l1 || '').trim()) fail(`reading.questions[${i}] needs q_l2 and explain_l1`);
}

const dictation = (lesson.listening || {}).dictation || [];
if (dictation.length !== 5) fail(`listening.dictation must have exactly 5 sentences, found ${dictation.length}`);
for (const [i, d] of dictation.entries()) {
  const n = countChars(d.l2);
  if (n < 6 || n > 60) fail(`listening.dictation[${i}] is ${n} characters; keep dictation 6-60`);
  if (!String(d.l1 || '').trim()) fail(`listening.dictation[${i}].l1 is empty`);
}

const w = lesson.writing || {};
const required = w.required || [];
if (required.length < 3 || required.length > 6) fail(`writing.required must list 3-6 words, found ${required.length}`);
const vocabTerms = new Set(parseTsv(vocabPath).map((row) => row.w));
for (const term of required) {
  if (!String(w.model_l2 || '').includes(term)) fail(`required word ${term} does not appear in writing.model_l2`);
  if (!vocabTerms.has(term)) fail(`required word ${term} is not in ${vocabPath}`);
}
if (w.unit !== 'chars') fail(`writing.unit must be "chars"`);
const modelChars = countChars(w.model_l2);
if (modelChars < (w.min_units || 100)) fail(`writing.model_l2 is ${modelChars} characters but min_units is ${w.min_units}`);
if (!String(w.prompt_l1 || '').trim() || !String(w.tips_l1 || '').trim()) fail('writing.prompt_l1 and writing.tips_l1 are required');

if (vocabTerms.size < 40) fail(`${vocabPath} has ${vocabTerms.size} words; aim for 45-60`);

/* ------------------------------------------------------------ tap coverage */
const texts = [];
const add = (where, text) => { if (typeof text === 'string' && text) texts.push({ where, text }); };
add('reading', r.text_l2);
(sents || []).forEach((s, i) => add(`sentences[${i}]`, s.l2));
(questions || []).forEach((q, i) => {
  add(`questions[${i}].q`, q.q_l2);
  (q.options_l2 || []).forEach((o, j) => add(`questions[${i}].options[${j}]`, o));
});
(g.examples || []).forEach((ex, i) => add(`grammar.examples[${i}]`, ex.l2));
(g.drills || []).forEach((d, i) => {
  add(`grammar.drills[${i}].q`, d.q_l2);
  (d.options_l2 || []).forEach((o, j) => add(`grammar.drills[${i}].options[${j}]`, o));
});
(dictation || []).forEach((d, i) => add(`listening.dictation[${i}]`, d.l2));
add('writing.model_l2', w.model_l2);

const PUNCT_ONLY = /^[\s、。，．・「」『』（）()！？!?…‥ー～〜\-—–]+$/;
const unknown = new Map();
let tokens = 0;
for (const { where, text } of texts) {
  const segs = L.segment(text, entries);
  if (segs.map((s) => s.t).join('') !== text) fail(`${where}: segmentation is lossy`);
  let at = 0;
  for (const seg of segs) {
    const tok = seg.t;
    const start = at;
    at += tok.length;
    tokens++;
    if (PUNCT_ONLY.test(tok)) continue;
    if (!L.hasKanji(tok) && !L.hasKana(tok)) continue;
    if (entries[tok]) continue;
    if (!unknown.has(tok)) unknown.set(tok, []);
    unknown.get(tok).push(`${where} …${text.slice(Math.max(0, start - 8), start + tok.length + 8)}…`);
  }
}

/* ------------------------------------------------------------------ report */
const vocabDuplicates = [];
const seenTerms = new Set();
for (const row of parseTsv(vocabPath)) {
  if (seenTerms.has(row.w)) vocabDuplicates.push(row.w);
  seenTerms.add(row.w);
  if (!L.isKanaOnly(row.reading)) vocabDuplicates.push(`${row.w} (reading not kana: ${row.reading})`);
  if (!row.gloss) vocabDuplicates.push(`${row.w} (empty gloss)`);
}
for (const d of vocabDuplicates) fail(`vocabulary: ${d}`);

if (unknown.size === 0 && problems.length === 0) {
  console.log(`  chapter ${chapter}: PASS — ${countChars(r.text_l2)} char reading, ` +
    `${vocabTerms.size} words, ${tokens} tokens all resolved`);
  process.exit(0);
}

if (unknown.size) {
  console.error(`\n  ${unknown.size} token(s) have no dictionary entry in this chapter:`);
  for (const [tok, places] of unknown) {
    console.error(`    ✗ ${tok}   (${places.length}x)`);
    console.error(`        ${places[0]}`);
  }
  console.error(`\n  Add them to content/vocab/tap-${pad}.tsv (term, reading, gloss, pos).`);
}
for (const p of problems) console.error(`    x ${p}`);
if (!unknown.size) console.error('');
process.exit(1);
