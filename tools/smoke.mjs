#!/usr/bin/env node
/* smoke.mjs — load every browser module in a sandbox and exercise the engine.
 *
 * There is no browser automation available here (no npm, no Puppeteer), so this
 * runs the real files against a minimal DOM shim. It catches: syntax errors,
 * missing globals, load-order mistakes, a screen that throws while rendering,
 * and SRS/plan/session regressions. It is not a substitute for looking at the
 * page — see the QA checklist in the final report.
 *
 * Run: node tools/smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/* ------------------------------------------------------------------- shim */
class FakeEl {
  constructor(tag = 'div', id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.children = [];
    this.attrs = {};
    this._html = '';
    this.style = {};
    this.classList = { add() {}, remove() {}, contains: () => false };
    this.files = [];
    this.value = '';
  }
  set innerHTML(v) { this._html = String(v); this.children = []; }
  get innerHTML() { return this._html; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener() {}
  removeEventListener() {}
  appendChild(c) { this.children.push(c); return c; }
  remove() {}
  click() {}
  focus() {}
  closest() { return null; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { left: 0, top: 0, bottom: 0, width: 0, height: 0 }; }
}

const elements = new Map();
function el(id, tag = 'div') {
  if (!elements.has(id)) elements.set(id, new FakeEl(tag, id));
  return elements.get(id);
}

const store = new Map();

const documentShim = {
  readyState: 'complete',
  documentElement: new FakeEl('html'),
  body: new FakeEl('body'),
  getElementById: (id) => (['main', 'toasts', 'modal-root'].includes(id) ? el(id) : null),
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: (tag) => new FakeEl(tag),
  addEventListener() {},
  removeEventListener() {}
};

const windowShim = {
  document: documentShim,
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; }
  },
  location: { hash: '#/today', hostname: '127.0.0.1', protocol: 'http:', search: '' },
  navigator: { serviceWorker: undefined },
  scrollTo() {},
  matchMedia: () => ({ matches: false }),
  addEventListener() {},
  removeEventListener() {},
  innerWidth: 390,
  innerHeight: 844,
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval
};

const sandbox = {
  ...windowShim,
  window: windowShim,
  globalThis: null,
  console,
  Date, Math, JSON, Intl, String, Number, Object, Array, RegExp, Boolean,
  isFinite, isNaN, parseFloat, parseInt,
  setTimeout, clearTimeout, setInterval, clearInterval,
  Blob, URL, TextDecoder, TextEncoder, structuredClone
};
sandbox.globalThis = sandbox;
windowShim.window = windowShim;
vm.createContext(sandbox);

const FILES = [
  'assets/js/data/config.js',
  'assets/js/data/vocab.js',
  'assets/js/data/lessons.js',
  'assets/js/data/tap.js',
  'assets/js/core/util.js',
  'assets/js/core/lang.js',
  'assets/js/core/data.js',
  'assets/js/core/storage.js',
  'assets/js/core/srs.js',
  'assets/js/core/plan.js',
  'assets/js/core/tts.js',
  'assets/js/core/session.js',
  'assets/js/core/diagnostic.js',
  'assets/js/core/exam.js',
  'assets/js/ui/components.js',
  'assets/js/ui/dashboard.js',
  'assets/js/ui/session.js',
  'assets/js/ui/lesson.js',
  'assets/js/ui/stats.js',
  'assets/js/ui/diagnostic.js',
  'assets/js/ui/exam.js',
  'assets/js/app.js'
];

/* ------------------------------------------------------------------ runner */
let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push({ name, message: e && e.message ? e.message : String(e) }); }
}
function ok(v, label = '') { if (!v) throw new Error(label + 'expected truthy, got ' + JSON.stringify(v)); }
function no(v, label = '') { if (v) throw new Error(label + 'expected falsy, got ' + JSON.stringify(v)); }
function is(a, b, label = '') {
  const as = JSON.stringify(a), bs = JSON.stringify(b);
  if (as !== bs) throw new Error(`${label}expected ${bs}, got ${as}`);
}
function includes(hay, needle, label = '') {
  const h = String(hay);
  if (h.indexOf(needle) < 0) {
    throw new Error(`${label}expected rendered output to contain ${JSON.stringify(needle.slice(0, 60))}`);
  }
}

/* ---------------------------------------------------------------- load all */
const loadErrors = [];
for (const rel of FILES) {
  try {
    vm.runInContext(readFileSync(join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  } catch (err) {
    loadErrors.push(`${rel}: ${err.message}`);
  }
}
check('every script loads without throwing', () => {
  if (loadErrors.length) throw new Error(loadErrors.join(' | '));
});

const NJ = windowShim.NJ || sandbox.NJ;
check('window.NJ namespace exists', () => ok(NJ));
check('all engine modules are present', () => {
  for (const k of ['U', 'L', 'D', 'S', 'SRS', 'PLAN', 'TTS', 'SESSION']) ok(NJ[k], `missing NJ.${k}: `);
  for (const k of ['UI', 'APP']) ok(NJ[k], `missing NJ.${k}: `);
});
check('all five screens are registered', () => {
  for (const k of ['today', 'chapters', 'session', 'lesson', 'stats', 'settings', 'calibrate', 'exam']) {
    ok(NJ.UI.screens[k], `missing screen ${k}: `);
  }
});
check('generated data is loaded', () => {
  ok(NJ.D.ready(), 'data.js never initialised: ');
  ok(NJ.D.lessons.length >= 1, 'no lessons: ');
  ok(NJ.D.words().length >= 40, 'expected the chapter 1 vocabulary: ');
  ok(Object.keys(NJ.D.entries).length > 200, 'expected the tap dictionary: ');
});

/* ------------------------------------------------------------------- state */
const S = NJ.S;
check('storage starts from defaults with the right key', () => {
  is(S.KEY, 'nihongo.v1');
  const st = S.load();
  is(st.app, 'ja');
  no(st.onboarded);
  ok(Array.isArray((st).sessions));
});

/* --------------------------------------------------------------------- SRS */
const SRS = NJ.SRS;
check('new card is due immediately and recap-aware', () => {
  const c = SRS.newCard('気候', 'rec', { now: 1000 });
  is(c.due, 1000);
  is(c.reps, 0);
  is(c.ease, 2.5);
  ok(c.recap);
  ok(SRS.isDue(c, 1000));
});
check('first correct answer uses the recap base interval', () => {
  const c = SRS.newCard('気候', 'prod', { now: 0 });
  SRS.grade(c, true, 0);
  is(c.interval, 4, 'recap prod base: ');
  is(c.reps, 1);
  is(c.due, 4 * 86400000);
});
check('first correct answer on a non-recap card uses the short base', () => {
  const c = SRS.newCard('気候', 'prod', { now: 0, recap: false });
  SRS.grade(c, true, 0);
  is(c.interval, 2);
});
check('later correct answers multiply by ease', () => {
  const c = SRS.newCard('気候', 'rec', { now: 0 });
  SRS.grade(c, true, 0);
  const first = c.interval;
  SRS.grade(c, true, 0);
  is(c.interval, Math.round(first * 2.5 * 100) / 100);
  is(c.reps, 2);
});
check('a wrong answer drops to ten minutes and lowers ease', () => {
  const c = SRS.newCard('気候', 'rec', { now: 0 });
  SRS.grade(c, true, 0);
  SRS.grade(c, true, 0);
  const before = c.ease;
  SRS.grade(c, false, 0);
  is(c.interval, 10 / 1440);
  is(c.due, 10 * 60000);
  is(c.ease, Math.round((before - 0.2) * 100) / 100);
  is(c.reps, 0, 'a lapse resets the streak: ');
  is(c.lapses, 1);
});
check('ease never drops below the floor', () => {
  const c = SRS.newCard('気候', 'rec', { now: 0 });
  for (let i = 0; i < 20; i++) SRS.grade(c, false, 0);
  is(c.ease, 1.3);
});
check('interval is capped', () => {
  const c = SRS.newCard('気候', 'rec', { now: 0 });
  c.interval = 700;
  c.reps = 5;
  SRS.grade(c, true, 0);
  is(c.interval, 730);
});
check('mature threshold is 21 days', () => {
  const c = SRS.newCard('気候', 'rec', { now: 0 });
  no(SRS.isMature(c));
  c.interval = 21;
  ok(SRS.isMature(c));
});
check('due lists exclude future and suspended cards, sorted by due', () => {
  const st = S.load();
  st.cards = {
    'A|rec': { ...SRS.newCard('A', 'rec', { now: 0 }), due: 500 },
    'B|rec': { ...SRS.newCard('B', 'rec', { now: 0 }), due: 100 },
    'C|rec': { ...SRS.newCard('C', 'rec', { now: 0 }), due: 100, suspended: true },
    'D|rec': { ...SRS.newCard('D', 'rec', { now: 0 }), due: 99999 }
  };
  const due = SRS.due(st, { now: 1000 });
  is(due.map((d) => d.card.w), ['B', 'A']);
  S.reset();
});

/* -------------------------------------------------------------------- plan */
const PLAN = NJ.PLAN;
check('adaptive new-word load cuts at the documented thresholds', () => {
  is(PLAN.effectiveNewPerDay(0, { newPerDay: 15 }, false), 15);
  is(PLAN.effectiveNewPerDay(45, { newPerDay: 15 }, false), 15);
  is(PLAN.effectiveNewPerDay(46, { newPerDay: 15 }, false), 8);
  is(PLAN.effectiveNewPerDay(71, { newPerDay: 15 }, false), 4);
  is(PLAN.effectiveNewPerDay(101, { newPerDay: 15 }, false), 0);
});
check('catch-up bonus applies only when the queue is healthy', () => {
  is(PLAN.effectiveNewPerDay(10, { newPerDay: 15 }, true), 18, 'bonus is additive: ');
  is(PLAN.effectiveNewPerDay(10, { newPerDay: 10 }, true), 13);
  is(PLAN.effectiveNewPerDay(80, { newPerDay: 15 }, true), 4);
});
check('session shape never exceeds the review cap or the budget', () => {
  const shape = PLAN.shape({
    budgetSeconds: 35 * 60, dueCount: 200, wantNew: 15, availableNew: 45,
    newGroupSeconds: PLAN.newGroupSeconds(true), avgReviewSeconds: 20,
    reviewCap: 45, dictationCount: 2
  });
  ok(shape.reviewCount <= 45, 'review cap ignored: ');
  ok(shape.newCount > 0, 'no new words in a 35 minute budget: ');
  ok(shape.seconds <= 35 * 60, 'over budget: ');
});
check('projection is honest about an impossible target', () => {
  const st = S.load();
  st.settings.newPerDay = 15;
  st.profile = {
    startDate: NJ.U.dayKey(new Date()),
    targetDate: NJ.U.dayKey(new Date()),
    dailyMinutes: 35, exam: true
  };
  const p = PLAN.projection(st);
  is(p.reachable, false);
  ok(p.remaining > 0);
  is(p.pctComplete, 0);
  S.reset();
});

/* -------------------------------------------------------- language + data */
const L = NJ.L;
check('production accepts kana for a real kanji word', () => {
  const w = NJ.D.word('気候');
  ok(w);
  ok(L.sameAnswer('きこう', w), 'kana reading rejected: ');
  ok(L.sameAnswer('気候', w));
  no(L.sameAnswer('ぎこう', w), 'wrong kana accepted: ');
});
check('every vocabulary word has a reading and a gloss', () => {
  for (const w of NJ.D.words()) {
    ok(w.reading && L.isKanaOnly(w.reading), `bad reading for ${w.w}: ${w.reading}`);
    ok(w.gloss && w.gloss.length > 1, `bad gloss for ${w.w}`);
  }
});
check('example context carries its own translation', () => {
  const ex = NJ.D.exampleFor('気候');
  ok(ex, 'no example found for 気候: ');
  ok(ex.l2.indexOf('気候') >= 0, 'example does not contain the word: ');
  ok(ex.l1 && ex.l1.length > 8, 'example has no translation: ');
});
check('distractors never include the answer', () => {
  const w = NJ.D.word('気候');
  for (let i = 0; i < 12; i++) {
    const g = NJ.D.distractorGlosses(w, 3);
    is(g.length, 3);
    no(g.includes(w.gloss), 'answer leaked into distractors: ');
    is(new Set(g).size, 3, 'duplicate distractors: ');
  }
});

/* ----------------------------------------------------------------- session */
const SES = NJ.SESSION;
check('dictation verdict forgives one slip but not a rewrite', () => {
  const exact = SES.dictationVerdict('日本の国土の多くは山地です。', '日本の国土の多くは山地です');
  is(exact.correct, true);
  is(exact.exact, true);
  const typo = SES.dictationVerdict('日本の国土のおくは山地です。', '日本の国土の多くは山地です。');
  is(typo.correct, true, 'one character off should pass: ');
  const wrong = SES.dictationVerdict('まったく違う文です', '日本の国土の多くは山地です。');
  is(wrong.correct, false);
});

check('a session builds, introduces words, and advances through grading', () => {
  const st = S.load();
  st.onboarded = true;
  st.profile = {
    name: 'Test', startDate: NJ.U.dayKey(new Date()),
    targetDate: NJ.U.dayKey(NJ.U.addDays(new Date(), 168)),
    dailyMinutes: 35, exam: true
  };
  st.settings.newPerDay = 4;

  const session = SES.start(st, { hasAudio: false, force: true });
  ok(session.items.length > 0, 'session has no items: ');
  is(session.done, false);

  // The first item must be a new-word card or a review; a new group always
  // puts the card before its own checks.
  let guard = 0;
  while (!SES.finished(session) && guard++ < 400) {
    const item = SES.item(session);
    if (item.kind === SES.KIND.NEW) SES.grade(st, true);
    else if (item.kind === SES.KIND.DICTATION) SES.grade(st, false, { typed: '' });
    else SES.grade(st, true);
  }
  ok(SES.finished(session), 'session never finished: ');
  SES.finish(st);
  ok(session.done);
  ok(Object.keys(st.words).length > 0, 'no words were introduced: ');
  ok(st.sessions.length === 1, 'session history not written: ');
  ok(st.cards[Object.keys(st.cards)[0]], 'cards were not created: ');
  S.reset();
});

check('every multiple-choice item is answerable', () => {
  const st = S.load();
  st.onboarded = true;
  st.settings.newPerDay = 6;
  const session = SES.start(st, { hasAudio: true, force: true });
  let mcqCount = 0;
  for (const item of session.items) {
    if (item.kind !== SES.KIND.REVIEW) continue;
    if (item.prompt === 'type') {
      no(item.options, 'a typing card must not carry options: ');
      continue;
    }
    mcqCount++;
    ok(Array.isArray(item.options), `item ${item.term}/${item.skill} has no options: `);
    is(item.options.length, 4, `item ${item.term}/${item.skill} option count: `);
    is(new Set(item.options).size, 4, `item ${item.term}/${item.skill} has duplicate options: `);
    ok(item.answer >= 0 && item.answer < 4, `item ${item.term}/${item.skill} answer index: `);
    if (item.prompt === 'reading') {
      ok(NJ.L.isKanaOnly(item.options[item.answer]), 'reading answer must be kana: ');
    } else {
      ok(item.options[item.answer] === NJ.D.word(item.term).gloss, 'answer must be the real gloss: ');
    }
  }
  ok(mcqCount > 0, 'expected at least one multiple-choice item: ');
  S.reset();
});

check('a new word group is card-then-checks and each check is answerable', () => {
  const st = S.load();
  st.onboarded = true;
  st.settings.newPerDay = 2;
  const session = SES.start(st, { hasAudio: false, force: true });
  const firstNew = session.items.findIndex((i) => i.kind === SES.KIND.NEW);
  ok(firstNew >= 0, 'no new-word card in the session: ');
  const next = session.items[firstNew + 1];
  ok(next && next.kind === SES.KIND.REVIEW && next.term === session.items[firstNew].term,
    'the checks must follow their card immediately: ');
  ok(Array.isArray(next.options) && next.options.length === 4, 'fresh checks need options: ');
  S.reset();
});
check('listening cards are not scheduled without a voice', () => {
  const st = S.load();
  st.onboarded = true;
  st.settings.newPerDay = 2;
  const session = SES.start(st, { hasAudio: false, force: true });
  const listenItems = session.items.filter((i) => i.skill === 'listen');
  is(listenItems.length, 0);
  S.reset();
});

/* ------------------------------------------------------------- calibration */
const DIAG = NJ.DIAG;

function answerAllDiagnostic(st, correct) {
  const run = DIAG.start(st);
  let guard = 0;
  while (!run.done && guard++ < 200) {
    const item = DIAG.item(run);
    if (!item) break;
    DIAG.submit(st, correct ? item.answer : (item.answer + 1) % 4);
  }
  return run;
}

check('calibration seeds what is known and refreshes what is missed', () => {
  const st = S.reset();
  st.onboarded = true;

  const strong = answerAllDiagnostic(st, true);
  ok(strong.done, 'strong run never finished: ');
  is(strong.strong, true, 'a perfect stage A must unlock stage B: ');
  ok(strong.seeded.length >= 14, `expected the tested words to be seeded, got ${strong.seeded.length}: `);
  is(strong.refreshed.length, 0);

  const term = strong.seeded[0];
  const word = st.words[term];
  ok(word, 'seeded word never entered state.words: ');
  is(word.status, 'seeded');

  const rec = st.cards[NJ.SRS.key(term, 'rec')];
  const prod = st.cards[NJ.SRS.key(term, 'prod')];
  ok(rec && prod, 'seeded word is missing cards: ');
  is(rec.interval, DIAG.SEED_DAYS, 'recognition should be pushed out: ');
  ok(rec.due > Date.now() + 20 * 86400000, 'recognition is not far enough out: ');
  ok(prod.due <= Date.now() + 1000, 'production must be tested soon: ');

  S.reset();
});

check('a weak calibration sends words to the refresh deck', () => {
  const st = S.reset();
  st.onboarded = true;

  const weak = answerAllDiagnostic(st, false);
  ok(weak.done);
  is(weak.strong, false, 'a failing stage A must not unlock stage B: ');
  is(weak.seeded.length, 0);
  ok(weak.refreshed.length > 0, 'nothing went to the refresh deck: ');

  const term = weak.refreshed[0];
  is(st.words[term].deck, 'refresh');
  is(st.words[term].status, 'refresh');
  const card = st.cards[NJ.SRS.key(term, 'rec')];
  ok(card, 'refresh word has no card: ');
  ok(card.due <= Date.now() + 1000, 'refresh card should be due now: ');
  is(card.interval, 0, 'a refresh card must not be seeded mature: ');

  S.reset();
});

check('calibration only applies on finish, never mid-run', () => {
  const st = S.reset();
  st.onboarded = true;
  const run = DIAG.start(st);
  const item = DIAG.item(run);
  DIAG.submit(st, item.answer);
  is(Object.keys(st.words).length, 0, 'words were introduced before the run finished: ');
  ok(!run.done);
  S.reset();
});

check('skipping calibration leaves the deck untouched', () => {
  const st = S.reset();
  st.onboarded = true;
  DIAG.skip(st);
  ok(DIAG.hasRun(st));
  is(Object.keys(st.words).length, 0);
  is(Object.keys(st.cards).length, 0);
  S.reset();
});

/* ------------------------------------------------------------------- exam */
const EXAM = NJ.EXAM;

function introduceSome(st, n) {
  let count = 0;
  NJ.D.chapters().forEach((ch) => {
    NJ.D.chapterTerms(ch).forEach((t) => {
      if (count >= n) return;
      if (!st.words[t]) { NJ.SESSION.introduce(st, t, ch); count++; }
    });
  });
  return count;
}

check('a checkpoint needs enough studied vocabulary', () => {
  const st = S.reset();
  introduceSome(st, 3);
  is(EXAM.available(st), false);
  is(EXAM.build(st, { hasAudio: false }), null);
  S.reset();
});

check('a checkpoint is three JLPT-shaped sections with no writing', () => {
  const st = S.reset();
  introduceSome(st, 20);
  const exam = EXAM.build(st, { hasAudio: false });
  ok(exam, 'no checkpoint built with 20 studied words: ');
  const ids = exam.sections.map((x) => x.id);
  ok(ids.includes('vocab'), 'missing 文字・語彙: ');
  ok(ids.includes('langread'), 'missing 文法・読解: ');
  no(ids.includes('listen'), 'listening must be omitted when there is no voice: ');
  no(ids.includes('writing'), 'JLPT has no writing section: ');
  ok(exam.minutes >= EXAM.MIN_MINUTES, 'checkpoint too short: ');
  ok(exam.items.length >= 6, 'checkpoint has too few items: ');
  for (const item of exam.items) {
    ok(Array.isArray(item.options) && item.options.length === 4,
      `item ${item.kind} needs 4 options: `);
    ok(item.answer >= 0 && item.answer < 4, `item ${item.kind} answer index: `);
    is(new Set(item.options).size, 4, `item ${item.kind} has duplicate options: `);
  }
  S.reset();
});

check('finishing a checkpoint writes a scored report', () => {
  const st = S.reset();
  introduceSome(st, 20);
  const exam = EXAM.build(st, { hasAudio: false });
  st.currentExam = exam;
  let guard = 0;
  while (!exam.done && guard++ < 200) {
    const item = EXAM.current(exam);
    if (!item) break;
    const res = EXAM.answer(exam, item.answer);
    if (res.complete) EXAM.finish(st);
  }
  ok(exam.done, 'checkpoint never finished: ');
  is(exam.report.pct, 100, 'all-correct run should score 100: ');
  ok(exam.report.bySection.vocab.seen > 0, 'no vocabulary items scored: ');
  is(st.exams.length, 1, 'exam history not written: ');
  is(st.exams[0].pct, 100);
  S.reset();
});

check('the checkpoint timer runs out and does not go negative', () => {
  const st = S.reset();
  introduceSome(st, 20);
  const exam = EXAM.build(st, { hasAudio: false });
  ok(EXAM.secondsLeft(exam) > 0, 'a fresh checkpoint is already over: ');
  exam.startedAt = Date.now() - (exam.totalSeconds + 5) * 1000;
  is(EXAM.secondsLeft(exam), 0);
  S.reset();
});

check('skipped checkpoint items score as wrong', () => {
  const st = S.reset();
  introduceSome(st, 20);
  const exam = EXAM.build(st, { hasAudio: false });
  st.currentExam = exam;
  let guard = 0;
  while (!exam.done && guard++ < 200) {
    const res = EXAM.skip(exam);
    if (res.complete) EXAM.finish(st);
  }
  is(exam.report.pct, 0);
  is(exam.report.correct, 0);
  S.reset();
});

/* -------------------------------------------------------------- phases */
check('recap and N2 units keep distinct numbers', () => {
  const recap = NJ.D.deckLessons('recap').map((u) => u.n);
  const n2 = NJ.D.deckLessons('n2').map((u) => u.n);
  is(recap.length, NJ.D.lessons.length, 'every lesson should have a recap unit: ');
  is(recap, recap.slice().sort((a, b) => a - b), 'recap units must be ordered: ');
  ok(recap.every((n) => n < 101), `recap units must stay below 101: ${recap}`);
  ok(n2.length >= 1, 'no N2 deck: ');
  ok(n2.every((n) => n > 100), `N2 units must start at 101: ${n2}`);
  is(NJ.D.chapterLabel(1), 'Chapter 1');
  is(NJ.D.chapterLabel(101), 'N2 · 1');
  ok(NJ.D.unit(101), 'N2 unit 101 not found: ');
  ok(NJ.D.unit(101).words.length >= 40, 'N2 deck looks empty: ');
});

check('new words come from the recap before the N2 deck', () => {
  const st = S.reset();
  st.onboarded = true;
  const first = SES.availableNew(st);
  is(first.deck, 'recap');
  is(first.chapter, 1);

  introduceSome(st, 1000);
  const next = SES.availableNew(st);
  is(next.deck, 'n2');
  is(next.chapter, 101);
  S.reset();
});

check('switching phase draws from the N2 deck first', () => {
  const st = S.reset();
  st.onboarded = true;
  st.profile = {
    phase: 'n2',
    startDate: NJ.U.dayKey(new Date()),
    targetDate: NJ.U.dayKey(NJ.U.addDays(new Date(), 168)),
    dailyMinutes: 35
  };
  is(NJ.PLAN.phaseOf(st), 'n2');
  const nav = SES.availableNew(st);
  is(nav.deck, 'n2');
  is(nav.chapter, 101);
  S.reset();
});

/* -------------------------------------------------- scheduled checkpoints */
check('scheduled checkpoints are derived from the content that exists', () => {
  const blocks = NJ.EXAM.blocks();
  const recap = blocks.filter((b) => b.deck === 'recap');
  const n2 = blocks.filter((b) => b.deck === 'n2');
  is(recap.length, Math.min(NJ.EXAM.BLOCKS, NJ.D.chapters().length), 'recap block count: ');
  is(n2.length, Math.min(NJ.EXAM.N2_BLOCKS, NJ.D.deckLessons('n2').length), 'N2 block count: ');
  // Blocks are cumulative: the last one covers the whole deck.
  is(recap[recap.length - 1].chapters, NJ.D.chapters(), 'the last recap block should cover every chapter: ');
  is(n2[n2.length - 1].chapters, NJ.D.deckLessons('n2').map((u) => u.n), 'the last N2 block should cover every deck: ');
  // Earlier blocks are strict prefixes.
  for (let i = 1; i < recap.length; i++) {
    ok(recap[i].chapters.length > recap[i - 1].chapters.length, 'blocks should grow: ');
  }
});

check('blocks stay locked until enough of their words are met', () => {
  const st = S.reset();
  st.onboarded = true;
  const blocks = NJ.EXAM.blocks();
  is(NJ.EXAM.blockStatus(st, blocks[0]), 'locked');

  // Meet every word of the first block, and nothing beyond it.
  const first = blocks[0];
  first.chapters.forEach((ch) => {
    NJ.D.chapterTerms(ch).forEach((t) => { if (!st.words[t]) SES.introduce(st, t, ch); });
  });
  is(NJ.EXAM.blockStatus(st, first), 'available', 'first block fully met: ');
  const lastRecap = blocks.filter((b) => b.deck === 'recap').pop();
  is(NJ.EXAM.blockStatus(st, lastRecap), 'locked', 'the rest of the course is not met: ');
  S.reset();
});

check('a scheduled checkpoint is scoped to its block and marked done', () => {
  const st = S.reset();
  st.onboarded = true;
  const block = NJ.EXAM.blocks()[0];
  block.chapters.forEach((ch) => {
    NJ.D.chapterTerms(ch).forEach((t) => { if (!st.words[t]) SES.introduce(st, t, ch); });
  });

  const exam = NJ.EXAM.build(st, { chapters: block.chapters, blockId: block.id, hasAudio: false });
  ok(exam, 'no checkpoint built for the block: ');
  is(exam.blockId, block.id);
  for (const item of exam.items) {
    ok(block.chapters.indexOf(item.chapter) >= 0, `an out-of-scope chapter leaked in: ${item.chapter}`);
  }

  st.currentExam = exam;
  let guard = 0;
  while (!exam.done && guard++ < 400) {
    const item = EXAM.current(exam);
    if (!item) break;
    const res = EXAM.answer(exam, item.answer);
    if (res.complete) EXAM.finish(st);
  }
  is(st.exams[0].blockId, block.id);
  is(NJ.EXAM.blockStatus(st, block), 'done');
  S.reset();
});

/* ------------------------------------------------------------------ router */
const APP = NJ.APP;
const UI = NJ.UI;
const main = el('main');

function renderRoute(hash) {
  windowShim.location.hash = hash;
  APP.render();
  return main.innerHTML;
}

check('every route renders without throwing', () => {
  for (const hash of ['#/today', '#/chapters', '#/lesson/1', '#/session', '#/stats', '#/settings', '#/calibrate', '#/exam']) {
    const html = renderRoute(hash);
    ok(typeof html === 'string' && html.length > 40, `route ${hash} produced almost nothing: `);
    no(/Something went wrong/.test(html), `route ${hash} rendered the error card: ${html.slice(0, 200)}`);
  }
});

check('today screen shows onboarding before the profile exists', () => {
  const S2 = NJ.S;
  S2.reset();
  const html = renderRoute('#/today');
  includes(html, 'Before we start');
  includes(html, 'Minutes per weekday');
});

check('today screen shows the plan once onboarded', () => {
  const st = NJ.S.load();
  st.onboarded = true;
  st.profile = {
    name: 'Ada', startDate: NJ.U.dayKey(new Date()),
    targetDate: NJ.U.dayKey(NJ.U.addDays(new Date(), 168)),
    dailyMinutes: 35, exam: true
  };
  NJ.S.save(st);
  const html = renderRoute('#/today');
  includes(html, 'Ada');
  includes(html, 'Pace');
  includes(html, 'due reviews');
  includes(html, 'Listening is deferred', 'no-voice warning: ');
});

check('chapters screen lists chapter 1 with its Japanese title', () => {
  const html = renderRoute('#/chapters');
  includes(html, '日本の地理');
  includes(html, 'The Geography of Japan');
  includes(html, 'あいづちとフィラー', 'grammar point in the chapter row: ');
  includes(html, '/45 words', 'word count in the chapter row: ');
});

check('lesson screen renders all four sections', () => {
  let html = renderRoute('#/lesson/1');
  includes(html, '日本の地理');
  includes(html, 'Grammar');
  includes(html, 'あいづちとフィラー');

  UI.actions['lesson-section'](null, { getAttribute: () => 'reading' });
  html = main.innerHTML;
  includes(html, 'Reading');
  includes(html, 'ユーラシア大陸');
  includes(html, 'Sentence by sentence');

  UI.actions['lesson-section'](null, { getAttribute: () => 'listening' });
  html = main.innerHTML;
  includes(html, 'Dictation');

  UI.actions['lesson-section'](null, { getAttribute: () => 'writing' });
  html = main.innerHTML;
  includes(html, 'Output practice');
  includes(html, 'Use these words');
  includes(html, 'textarea');

  UI.actions['lesson-section'](null, { getAttribute: () => 'grammar' });
});

check('passage is fully tappable in the rendered output', () => {
  UI.actions['lesson-section'](null, { getAttribute: () => 'reading' });
  const html = main.innerHTML;
  const tokens = html.match(/class="tok"/g) || [];
  ok(tokens.length > 100, `expected a heavily tappable passage, got ${tokens.length} tokens: `);
  includes(html, 'data-tap="気候"');
});

check('writing submits and records a heuristic result', () => {
  UI.actions['lesson-section'](null, { getAttribute: () => 'writing' });
  const st = NJ.S.load();
  const before = st.writing.length;
  // The textarea is not in the fake DOM, so exercise the counter path directly.
  const text = NJ.D.lesson(1).writing.model_l2;
  const count = NJ.L.countUnits(text, 'chars');
  ok(count >= NJ.D.lesson(1).writing.min_units, 'model answer too short: ');
  is(st.writing.length, before);
});

check('session route starts the days session instead of dead-ending', () => {
  const st = NJ.S.load();
  st.current = null;
  NJ.S.save(st);
  const html = renderRoute('#/session');
  ok(NJ.S.load().current, 'opening the session route did not start a session: ');
  no(/No session yet/.test(html), 'the old dead-end message is back: ');
  ok(/New word|Recognition|Production|Listening|Dictation/.test(html),
    'unexpected session body: ' + html.slice(0, 300));
});

check('a finished session from a previous day does not block the next one', () => {
  const st = NJ.S.load();
  const dated = { ...st, current: { id: 'old', date: '2020-01-01', startedAt: 1, items: [], idx: 0, results: [], done: true } };
  NJ.S.save(dated);
  renderRoute('#/session');
  const after = NJ.S.load().current;
  ok(after, 'no session after a stale summary: ');
  no(after.done === true && after.date === '2020-01-01', 'still showing the stale finished session: ');
});

check('screens survive an unknown chapter', () => {
  const html = renderRoute('#/lesson/99');
  includes(html, 'Chapter not found');
});

check('the N2 deck screen renders as a word list, not an error', () => {
  const html = renderRoute('#/lesson/101');
  includes(html, 'N2 · 1');
  includes(html, 'vocabulary deck');
  includes(html, '影響');
  no(/Chapter not found/.test(html), 'the deck fell through to the not-found page: ');
});

check('the chapters screen lists the N2 deck alongside the recap', () => {
  const html = renderRoute('#/chapters');
  includes(html, 'N2 vocabulary');
  includes(html, 'N2 語彙 1');
});

/* ------------------------------------------------------------- export/import */
check('export contains no secrets and no live session', () => {
  const st = NJ.S.load();
  st.meta.sync = { token: 'SECRET' };
  const text = NJ.S.exportText(st);
  no(text.indexOf('SECRET') >= 0, 'token leaked into the export: ');
  no(text.indexOf('"current"') >= 0, 'live session leaked into the export: ');
  no(text.indexOf('access_token') >= 0);
  includes(text, '"app": "ja"', 'app marker missing: ');
});
check('import rejects a backup from another app', () => {
  const res = NJ.S.importText(JSON.stringify({ app: 'hanyu', cards: {}, words: {} }));
  is(res.ok, false);
  ok(/different app/.test(res.error), res.error);
});
check('import rejects junk', () => {
  is(NJ.S.importText('not json').ok, false);
  is(NJ.S.importText('{}').ok, false);
});
check('export round-trips', () => {
  const st = NJ.S.load();
  st.cards['気候|rec'] = NJ.SRS.newCard('気候', 'rec', { now: 1 });
  const text = NJ.S.exportText(st);
  const res = NJ.S.importText(text);
  is(res.ok, true);
  ok(res.state.cards['気候|rec'], 'card lost in round-trip: ');
});

/* ------------------------------------------------------------------ report */
const total = passed + failures.length;
if (failures.length) {
  console.error(`\n  ${failures.length} of ${total} checks FAILED\n`);
  for (const f of failures) console.error(`  ✗ ${f.name}\n      ${f.message}`);
  console.error('');
  process.exit(1);
}
console.log(`  smoke: ${passed}/${total} checks passed across ${FILES.length} modules`);
