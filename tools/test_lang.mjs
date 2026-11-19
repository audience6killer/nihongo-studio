#!/usr/bin/env node
/* test_lang.mjs — unit tests for assets/js/core/util.js and core/lang.js.
 *
 * The browser modules are plain scripts that attach to window.NJ, so they are
 * loaded into a bare vm sandbox here. No test framework, no dependencies: the
 * project has no package manager available and does not need one.
 *
 * Run: node tools/test_lang.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

function loadEngine() {
  const sandbox = { console, Date, Math, JSON, Intl, String, Number, Object, Array, RegExp, isFinite, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const rel of ['assets/js/core/util.js', 'assets/js/core/lang.js']) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    vm.runInContext(src, sandbox, { filename: rel });
  }
  if (!sandbox.NJ || !sandbox.NJ.U || !sandbox.NJ.L) throw new Error('engine did not attach to window.NJ');
  return sandbox.NJ;
}

const NJ = loadEngine();
const U = NJ.U;
const L = NJ.L;

/* ------------------------------------------------------------- mini runner */
let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failures.push({ name, message: err && err.message ? err.message : String(err) });
  }
}

function eq(actual, expected, label = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}expected ${e}, got ${a}`);
}
const is = (actual, expected, label = '') => eq(actual, expected, label);
const ok = (v, label = '') => { if (!v) throw new Error(label + 'expected truthy, got ' + JSON.stringify(v)); };
const no = (v, label = '') => { if (v) throw new Error(label + 'expected falsy, got ' + JSON.stringify(v)); };

const WORD = {
  chiri: { term: '気候', reading: 'きこう' },
  kanjiKana: { term: '恵まれる', reading: 'めぐまれる' },
  loan: { term: 'コンピューター' },
  dakuten: { term: '花', reading: 'はな' }
};

/* ---------------------------------------------------------------- U.esc */
check('esc escapes HTML metacharacters', () => {
  is(U.esc('<b>"a" & \'b\'</b>'), '&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;');
});
check('esc renders null as empty string', () => is(U.esc(null), ''));

/* -------------------------------------------------------------- U.clamp */
check('clamp bounds', () => {
  is(U.clamp(5, 0, 10), 5);
  is(U.clamp(-2, 0, 10), 0);
  is(U.clamp(99, 0, 10), 10);
  is(U.clamp('x', 3, 10), 3);
});

/* --------------------------------------------------------------- U.dates */
check('dayKey is local, not UTC', () => {
  is(U.dayKey(new Date(2026, 10, 18, 23, 30)), '2026-11-18');
  is(U.dayKey(new Date(2026, 0, 1, 0, 5)), '2026-01-01');
});
check('parseDayKey round-trips dayKey', () => {
  const d = U.parseDayKey('2026-11-18');
  ok(d instanceof Date);
  is(d.getFullYear(), 2026);
  is(d.getMonth(), 10);
  is(d.getDate(), 18);
  is(U.parseDayKey('nope'), null);
});
check('daysBetween works on day keys and Dates', () => {
  is(U.daysBetween('2026-11-18', '2026-11-25'), 7);
  is(U.daysBetween(new Date(2026, 10, 18), new Date(2026, 10, 18, 23, 59)), 0);
  is(U.daysBetween('2026-11-25', '2026-11-18'), -7);
});
check('addDays crosses month and year boundaries', () => {
  is(U.dayKey(U.addDays('2026-12-31', 1)), '2027-01-01');
  is(U.dayKey(U.addDays('2026-03-01', -1)), '2026-02-28');
});
check('relDay phrasing', () => {
  const base = new Date(2026, 10, 18);
  is(U.relDay(base, base), 'today');
  is(U.relDay(U.addDays(base, 1), base), 'tomorrow');
  is(U.relDay(U.addDays(base, -1), base), 'yesterday');
  is(U.relDay(U.addDays(base, 5), base), 'in 5 days');
  is(U.relDay(U.addDays(base, -5), base), '5 days ago');
});
check('fmtClock and fmtMinutes', () => {
  is(U.fmtClock(67), '1:07');
  is(U.fmtClock(0), '0:00');
  is(U.fmtMinutes(35), '35 min');
  is(U.fmtMinutes(90), '1 h 30 min');
});

/* ------------------------------------------------------------- U randomness */
check('hash32 is deterministic and differs by input', () => {
  is(U.hash32('気候'), U.hash32('気候'));
  ok(U.hash32('気候') !== U.hash32('気後'));
});
check('mulberry32 is reproducible', () => {
  const a = U.mulberry32(42);
  const b = U.mulberry32(42);
  for (let i = 0; i < 5; i++) is(a(), b());
});
check('shuffle keeps every element and respects the seeded PRNG', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const s1 = U.shuffle(src, U.mulberry32(7));
  const s2 = U.shuffle(src, U.mulberry32(7));
  is(s1, s2);
  is(s1.slice().sort((x, y) => x - y), [1, 2, 3, 4, 5, 6, 7, 8]);
  is(src, [1, 2, 3, 4, 5, 6, 7, 8], 'shuffle must not mutate its input: ');
});
check('sample returns at most n and keeps order-independence', () => {
  const got = U.sample([1, 2, 3, 4, 5], 3, U.mulberry32(1));
  is(got.length, 3);
  is(U.sample([1, 2], 5).length, 2);
});

/* ---------------------------------------------------------------- U.pct */
check('pct', () => {
  is(U.pct(1, 4), 25);
  is(U.pct(0, 0), 0);
  is(U.pct(3, 2), 150);
});

/* ---------------------------------------------------------- U.diffChars */
check('diff identifies identical strings', () => {
  is(U.diffChars('あい', 'あい'), [{ op: 'same', text: 'あい' }]);
  is(U.diffDistance('あい', 'あい'), 0);
});
check('diff distinguishes insertion from deletion', () => {
  const ins = U.diffChars('あい', 'あいう');
  ok(ins.some((s) => s.op === 'ins' && s.text === 'う'), 'expected an insertion of う: ');
  is(U.diffDistance('あい', 'あいう'), 1);
  const del = U.diffChars('あいう', 'あい');
  ok(del.some((s) => s.op === 'del' && s.text === 'う'), 'expected a deletion of う: ');
  is(U.diffDistance('あいう', 'あい'), 1);
});
check('diff distance counts a substitution as two edits', () => {
  is(U.diffDistance('あい', 'あお'), 2);
  is(U.diffDistance('', 'あい'), 2);
});
check('diff segments reconstruct both strings', () => {
  const pairs = [
    ['日本の地理を勉強します。', '日本の地理を勉強します'],
    ['火山が多い', '火山がおおい'],
    ['あいうえお', 'あいえお'],
    ['', ''],
    ['コンピューター', 'コンピューター']
  ];
  for (const [expected, actual] of pairs) {
    const segs = U.diffChars(expected, actual);
    const fromExpected = segs.filter((s) => s.op !== 'ins').map((s) => s.text).join('');
    const fromActual = segs.filter((s) => s.op !== 'del').map((s) => s.text).join('');
    is(fromExpected, expected, `reconstruct expected for ${JSON.stringify(expected)}: `);
    is(fromActual, actual, `reconstruct actual for ${JSON.stringify(expected)}: `);
  }
});

/* ------------------------------------------------------------- L.norm */
check('norm folds full-width ASCII (NFKC)', () => is(L.norm('ＡＢＣ１２３'), 'ABC123'));
check('norm folds half-width katakana (NFKC)', () => is(L.norm('ﾆﾎﾝｺﾞ'), 'ニホンゴ'));
check('norm collapses the ideographic space', () => is(L.norm('気　候'), '気 候'));
check('norm preserves the long-vowel mark and dakuten', () => {
  is(L.norm('コンピューター'), 'コンピューター');
  is(L.norm('が'), 'が');
  is(L.norm('ぱ'), 'ぱ');
});
check('norm unifies curly quotes', () => is(L.norm('“a” ‘b’'), '"a" \'b\''));

/* ------------------------------------------------------- L.normAnswer */
check('normAnswer drops all whitespace and trailing punctuation', () => {
  is(L.normAnswer(' 気 候 '), '気候');
  is(L.normAnswer('気候。'), '気候');
  is(L.normAnswer('気候、'), '気候');
  is(L.normAnswer('気候です…'), '気候です');
  is(L.normAnswer(''), '');
});

/* ------------------------------------------------------- L.sameAnswer */
check('sameAnswer accepts the exact written form', () => {
  ok(L.sameAnswer('気候', WORD.chiri));
  ok(L.sameAnswer(' 気候 ', WORD.chiri));
  ok(L.sameAnswer('気候。', WORD.chiri));
  ok(L.sameAnswer('気候', '気候'), 'string word argument: ');
});
check('sameAnswer accepts kana for a kanji word when it equals the reading', () => {
  ok(L.sameAnswer('きこう', WORD.chiri));
  ok(L.sameAnswer('めぐまれる', WORD.kanjiKana));
});
check('sameAnswer rejects the wrong kana', () => {
  no(L.sameAnswer('きこ', WORD.chiri));
  no(L.sameAnswer('ぎこう', WORD.chiri));
});
check('sameAnswer never strips dakuten', () => {
  ok(L.sameAnswer('はな', WORD.dakuten));
  no(L.sameAnswer('ばな', WORD.dakuten));
  no(L.sameAnswer('ぱな', WORD.dakuten));
});
check('sameAnswer accepts hiragana for an all-katakana loanword', () => {
  ok(L.sameAnswer('こんぴゅーたー', WORD.loan));
  ok(L.sameAnswer('コンピューター', WORD.loan));
  no(L.sameAnswer('コンピュータ', WORD.loan), 'dropping ー must fail: ');
});
check('sameAnswer accepts curated alternatives only', () => {
  const w = { term: '気候', reading: 'きこう', alt: ['気候風土'] };
  ok(L.sameAnswer('気候風土', w));
  no(L.sameAnswer('きこうふうど', w), 'alternatives are not readings: ');
});
check('sameAnswer rejects empty and whitespace-only input', () => {
  no(L.sameAnswer('', WORD.chiri));
  no(L.sameAnswer('   ', WORD.chiri));
  no(L.sameAnswer(null, WORD.chiri));
});
check('sameAnswer accepts full-width input as normalised', () => {
  ok(L.sameAnswer('ＡＢＣ', { term: 'ABC' }));
});

/* ------------------------------------------------------- kana conversion */
check('toHiragana and toKatakana round-trip', () => {
  is(L.toHiragana('コンピューター'), 'こんぴゅーたー');
  is(L.toKatakana('こんぴゅーたー'), 'コンピューター');
  is(L.toKatakana(L.toHiragana('カタカナ')), 'カタカナ');
});
check('kana conversion leaves kanji and ー alone', () => {
  is(L.toHiragana('気候'), '気候');
  is(L.toHiragana('ー'), 'ー');
});

/* ---------------------------------------------------------- character tests */
check('hasKanji / hasKana', () => {
  ok(L.hasKanji('気候'));
  no(L.hasKanji('きこう'));
  ok(L.hasKana('きこう'));
  ok(L.hasKana('コンピューター'));
  no(L.hasKana('気候'));
  no(L.hasKanji('ABC'), 'latin is not kanji: ');
});
check('isAllKatakana', () => {
  ok(L.isAllKatakana('コンピューター'));
  no(L.isAllKatakana('こんぴゅーたー'));
  no(L.isAllKatakana('気候'));
  no(L.isAllKatakana(''));
});
check('isKanaOnly validates readings', () => {
  ok(L.isKanaOnly('きこう'));
  ok(L.isKanaOnly('コンピューター'));
  ok(L.isKanaOnly('めぐまれる'));
  no(L.isKanaOnly('気候'), 'kanji reading must be rejected: ');
  no(L.isKanaOnly('き こう'), 'spaces must be rejected: ');
  no(L.isKanaOnly(''), 'empty must be rejected: ');
  no(L.isKanaOnly('きこう。'), 'punctuation must be rejected: ');
});
check('kanjiCount', () => {
  is(L.kanjiCount('気候'), 2);
  is(L.kanjiCount('きこう'), 0);
});

/* ------------------------------------------------------- L.splitSentences */
check('splitSentences keeps the terminator', () => {
  is(L.splitSentences('今日は寒いです。明日は暖かいです。'),
    ['今日は寒いです。', '明日は暖かいです。']);
});
check('splitSentences absorbs closing quotes', () => {
  is(L.splitSentences('「行きますか。」と聞いた。'),
    ['「行きますか。」', 'と聞いた。']);
});
check('splitSentences handles no terminator and empty input', () => {
  is(L.splitSentences('終わりなし'), ['終わりなし']);
  is(L.splitSentences(''), []);
  is(L.splitSentences(null), []);
});

/* ------------------------------------------------------------ L.countUnits */
check('countUnits counts CJK and kana', () => {
  is(L.countUnits('気候', 'chars'), 2);
  is(L.countUnits('きこう', 'chars'), 3);
  is(L.countUnits('コンピューター', 'chars'), 7);
});
check('countUnits ignores punctuation and latin', () => {
  is(L.countUnits('、。「」', 'chars'), 0);
  is(L.countUnits('ABC', 'chars'), 0);
  is(L.countUnits('気候、です。', 'chars'), 4);
});
check('countUnits counts digits', () => {
  is(L.countUnits('２０２６年', 'chars'), 5);
  is(L.countUnits('2026年', 'chars'), 5);
});
check('countUnits words mode', () => {
  is(L.countUnits('hello brave new world', 'words'), 4);
  is(L.countUnits('   ', 'words'), 0);
  is(L.countUnits('', 'words'), 0);
});

/* ---------------------------------------------------------------- L.ruby */
check('ruby wraps the whole word when there is no okurigana', () => {
  is(L.ruby('気候', 'きこう'), '<ruby>気候<rt>きこう</rt></ruby>');
});
check('ruby leaves shared okurigana outside the ruby', () => {
  is(L.ruby('恵まれる', 'めぐまれる'), '<ruby>恵<rt>めぐ</rt></ruby>まれる');
});
check('ruby returns plain text when it cannot help', () => {
  is(L.ruby('きこう', 'きこう'), 'きこう');
  is(L.ruby('気候', ''), '気候');
  is(L.ruby('', 'きこう'), '');
});
check('ruby escapes markup and keeps punctuation outside', () => {
  is(L.ruby('<気候>', 'きこう'), '&lt;<ruby>気候<rt>きこう</rt></ruby>&gt;');
  is(L.ruby('「気候」', 'きこう'), '「<ruby>気候<rt>きこう</rt></ruby>」');
});

/* ------------------------------------------------------------ L.recVariant */
check('recVariant alternates on reps', () => {
  is(L.recVariant(0), 'meaning');
  is(L.recVariant(1), 'reading');
  is(L.recVariant(2), 'meaning');
  is(L.recVariant(undefined), 'meaning');
});

/* ------------------------------------------------------------------ report */
const total = passed + failures.length;
if (failures.length) {
  console.error(`\n  ${failures.length} of ${total} checks FAILED\n`);
  for (const f of failures) console.error(`  ✗ ${f.name}\n    ${f.message}`);
  console.error('');
  process.exit(1);
}
console.log(`  lang adapter: ${passed}/${total} checks passed`);
