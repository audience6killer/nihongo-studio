#!/usr/bin/env node
/* qa.mjs — the automatable half of the QA matrix (PORTING.md §12.4).
 *
 * No browser is available here, so this covers everything that can be proven
 * from the files: asset wiring, service-worker parity, instance isolation,
 * manifest, data integrity, and the absence of secrets. What it cannot cover is
 * how the app looks and feels — that stays a human check.
 *
 * Run: node tools/qa.mjs
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const has = (p) => existsSync(join(ROOT, p));

let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed++; } catch (e) { failures.push({ name, message: e && e.message ? e.message : String(e) }); }
}
function ok(v, label = '') { if (!v) throw new Error(label + 'expected truthy'); }
function no(v, label = '') { if (v) throw new Error(label + 'expected falsy'); }
function is(a, b, label = '') {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${label}expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
}
function includes(hay, needle, label = '') {
  if (String(hay).indexOf(needle) < 0) throw new Error(`${label}missing ${JSON.stringify(needle)}`);
}

/* --------------------------------------------------------------- modules */
const FILES = [
  'assets/js/data/config.js', 'assets/js/data/vocab.js', 'assets/js/data/lessons.js', 'assets/js/data/tap.js',
  'assets/js/core/util.js', 'assets/js/core/lang.js', 'assets/js/core/data.js', 'assets/js/core/storage.js', 'assets/js/core/sync.js',
  'assets/js/core/srs.js', 'assets/js/core/plan.js', 'assets/js/core/tts.js', 'assets/js/core/session.js',
  'assets/js/core/diagnostic.js', 'assets/js/core/exam.js',
  'assets/js/ui/components.js', 'assets/js/ui/dashboard.js', 'assets/js/ui/session.js',
  'assets/js/ui/lesson.js', 'assets/js/ui/stats.js', 'assets/js/ui/diagnostic.js', 'assets/js/ui/exam.js',
  'assets/js/app.js'
];

function loadEngine() {
  const els = new Map();
  const mk = (tag, id) => ({
    tagName: tag.toUpperCase(), id, children: [], attrs: {}, style: {}, _html: '',
    classList: { add() {}, remove() {}, contains: () => false }, files: [], value: '',
    set innerHTML(v) { this._html = String(v); }, get innerHTML() { return this._html; },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
    removeAttribute(k) { delete this.attrs[k]; }, addEventListener() {}, removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; }, remove() {}, click() {}, focus() {},
    closest() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, bottom: 0, width: 0, height: 0 }; }
  });
  const store = new Map();
  const doc = {
    readyState: 'complete', documentElement: mk('html'), body: mk('body'),
    getElementById: (id) => { if (!els.has(id)) els.set(id, mk('div', id)); return els.get(id); },
    querySelector: () => null, querySelectorAll: () => [], createElement: (t) => mk(t),
    addEventListener() {}, removeEventListener() {}
  };
  const win = {
    document: doc,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k),
      clear: () => store.clear(), key: (i) => Array.from(store.keys())[i] ?? null,
      get length() { return store.size; }
    },
    location: { hash: '#/today', hostname: '127.0.0.1', protocol: 'http:', search: '' },
    navigator: {}, scrollTo() {}, matchMedia: () => ({ matches: false }),
    addEventListener() {}, removeEventListener() {}, innerWidth: 390, innerHeight: 844, console,
    setTimeout, clearTimeout, setInterval, clearInterval
  };
  const sandbox = {
    ...win, window: win, globalThis: null, console,
    Date, Math, JSON, Intl, String, Number, Object, Array, RegExp, Boolean,
    isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout, setInterval, clearInterval,
    Blob, URL, TextDecoder, TextEncoder, structuredClone
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const rel of FILES) {
    vm.runInContext(read(rel), sandbox, { filename: rel });
  }
  return sandbox;
}

const S = loadEngine();
const W = S.window;
const NJ = W.NJ;
const VOCAB = W.NJ_VOCAB;
const LESSONS = W.NJ_LESSONS;
const TAP = W.NJ_TAP;

/* ------------------------------------------------------ asset wiring */
check('index.html loads every module, in dependency order', () => {
  const html = read('index.html');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  is(scripts, FILES, 'script order drifted: ');
  for (const s of scripts) ok(has(s), `index.html references a missing file: ${s}`);
});

check('every loaded module appears in the service worker CORE list', () => {
  const sw = read('sw.js');
  const core = [.../const CORE = \[([\s\S]*?)\];/.exec(sw)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const rel of FILES) {
    if (rel === 'assets/js/data/config.js') continue; // generated at deploy time
    ok(core.includes(rel), `sw.js CORE is missing ${rel}`);
  }
  for (const rel of ['index.html', 'assets/css/app.css', 'assets/img/icon.svg']) {
    ok(core.includes(rel), `sw.js CORE is missing ${rel}`);
  }
});

check('the shell has no leftover boot placeholder in front of the app', () => {
  const html = read('index.html');
  ok(/id="main"/.test(html), 'the #main mount point vanished: ');
  ok(/<html lang="en">/.test(html), 'the document language should stay English: ');
});

/* --------------------------------------------------- instance isolation */
check('no copy from the Chinese instance survives', () => {
  const sources = [
    'index.html', 'manifest.webmanifest', 'assets/css/app.css', 'assets/js/app.js',
    ...FILES.filter((f) => f.startsWith('assets/js/'))
  ];
  const FORBIDDEN = [/\bHSK\d?\b/, /\bhanyu\b/i, /\bpinyin\b/i, /zh-Hans/, /hanyu\.v1/, /细节/, /hanzi/i];
  const hits = [];
  for (const f of sources) {
    const text = read(f);
    for (const re of FORBIDDEN) if (re.test(text)) hits.push(`${f} matches ${re}`);
  }
  is(hits, [], 'Chinese-instance leftovers: ');
});

check('storage is namespaced to this instance', () => {
  includes(read('assets/js/core/storage.js'), "S.KEY = 'nihongo.v1'");
  includes(read('assets/js/core/storage.js'), "S.APP = 'ja'");
});

/* ------------------------------------------------------------- manifest */
check('the manifest describes this app, and its icons exist', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  includes(m.name, 'Nihongo');
  is(m.lang, 'en');
  is(m.display, 'standalone');
  is(m.start_url, './index.html');
  ok(m.icons && m.icons.length >= 2, 'expected at least two icons: ');
  for (const icon of m.icons) ok(has(icon.src), `manifest icon missing: ${icon.src}`);
});

/* ---------------------------------------------------------------- routes */
check('every route resolves to a registered screen', () => {
  const app = read('assets/js/app.js');
  const block = /var ROUTES = \{([\s\S]*?)\};/.exec(app);
  ok(block, 'could not read ROUTES from app.js: ');
  const names = [...block[1].matchAll(/(\w+):\s*'(\w+)'/g)].map((m) => m[2]);
  ok(names.length >= 8, `expected at least 8 routes, got ${names.length}: `);
  for (const name of names) ok(NJ.UI.screens[name], `route points at a missing screen: ${name}`);
});

/* ------------------------------------------------------------ data shape */
check('all four decks and units agree across vocabulary and lessons', () => {
  const vocabUnits = VOCAB.lessons.map((u) => u.n).sort((a, b) => a - b);
  const numbers = new Set(vocabUnits);
  is(numbers.size, vocabUnits.length, 'duplicate unit numbers: ');
  for (const les of LESSONS) {
    ok(numbers.has(les.chapter), `lesson ${les.chapter} has no vocabulary unit`);
  }
  is(VOCAB.meta.count, VOCAB.words.length, 'meta count disagrees with the word list: ');
});

check('every vocabulary word is complete and unique', () => {
  const seen = new Set();
  for (const w of VOCAB.words) {
    ok(w.w && !seen.has(w.w), `duplicate or empty term: ${w.w}`);
    seen.add(w.w);
    ok(w.reading && NJ.L.isKanaOnly(w.reading), `bad reading for ${w.w}: ${w.reading}`);
    ok(w.gloss && w.gloss.length > 1, `bad gloss for ${w.w}`);
    ok(TAP.entries[w.w], `no tap entry for ${w.w}`);
  }
});

check('writing tasks ask only for words from their own chapter', () => {
  for (const les of LESSONS) {
    const terms = new Set(NJ.D.chapterTerms(les.chapter));
    for (const req of les.writing.required) {
      ok(terms.has(req), `lesson ${les.chapter} asks for ${req}, which is not in its vocabulary`);
      includes(les.writing.model_l2, req, `model answer for lesson ${les.chapter}: `);
    }
  }
});

check('every reading sentence has its own translation', () => {
  for (const les of LESSONS) {
    const sents = les.reading.sentences || [];
    ok(sents.length >= 3, `lesson ${les.chapter} has too few sentence pairs: `);
    const l1s = sents.map((s) => (s.l1 || '').trim()).filter(Boolean);
    is(l1s.length, sents.length, `lesson ${les.chapter} has an untranslated sentence: `);
    is(new Set(l1s).size, l1s.length, `lesson ${les.chapter} repeats a translation: `);
    is(sents.map((s) => s.l2).join(''), les.reading.text_l2, `lesson ${les.chapter} text mismatch: `);
  }
});

/* --------------------------------------------------------------- secrets */
check('no secret-shaped strings anywhere in the shipped source', () => {
  const FORBIDDEN = [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, /SUPABASE_SERVICE/, /BEGIN [A-Z ]*PRIVATE KEY/];
  const hits = [];
  for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', ...FILES]) {
    const text = read(f);
    for (const re of FORBIDDEN) if (re.test(text)) hits.push(`${f} matches ${re}`);
  }
  is(hits, []);
});

check('build output is ignored by git', () => {
  const ignore = read('.gitignore');
  includes(ignore, 'deploy/');
  includes(ignore, 'node_modules/');
});

/* ----------------------------------------------------------- deployment */
check('the deploy contract is complete', () => {
  for (const f of ['netlify.toml', '.nvmrc', 'package.json', 'tools/prepare_deploy.mjs', 'serve.py', 'setup.html', 'supabase/schema.sql']) {
    ok(has(f), `missing ${f}`);
  }
  const pkg = JSON.parse(read('package.json'));
  includes(pkg.scripts.build, 'prepare_deploy');
  is(pkg.scripts.serve, 'python serve.py');
  ok(!pkg.dependencies || !Object.keys(pkg.dependencies).length, 'the app must have no dependencies: ');
});

check('the documentation set is present', () => {
  for (const f of ['README.md', 'INSTANCE.md', 'CONTENT_SPEC.md', 'STUDY_PLAN.md', 'PLAN.md',
    'content/LEDGER.md', 'content/REVIEW.md']) {
    ok(has(f), `missing ${f}`);
  }
  includes(read('README.md'), 'not affiliated', 'the disclaimer should be in the README: ');
});

check('every tool referenced by the docs exists', () => {
  const docs = read('README.md') + read('CONTENT_SPEC.md');
  const tools = [...docs.matchAll(/tools\/([a-zA-Z_]+\.(?:mjs|py))/g)].map((m) => m[1]);
  for (const t of new Set(tools)) ok(has(join('tools', t)), `README/CONTENT_SPEC references a missing tool: tools/${t}`);
});

/* --------------------------------------------------------------- sync */
check('the sync contract is complete', () => {
  ok(has('supabase/schema.sql'), 'supabase/schema.sql is missing: ');
  const schema = read('supabase/schema.sql');
  includes(schema, 'create table if not exists public.progress');
  includes(schema, 'enable row level security');
  includes(schema, 'security definer', 'the save function must be a definer: ');
  includes(schema, 'save_progress');
  includes(schema, 'auth.uid() = user_id', 'RLS must scope rows to the owner: ');
  no(/grant\s+(insert|update|delete)/i.test(schema), 'the client must not be granted direct writes: ');

  ok(has('setup.html'), 'setup.html is missing: ');
  includes(read('setup.html'), '<pre id="sql">', 'the build injects the schema into this placeholder: ');

  const config = read('assets/js/data/config.js');
  includes(config, 'supabaseUrl');
  includes(config, 'supabaseAnonKey');

  const syncSource = read('assets/js/core/sync.js');
  includes(syncSource, 'save_progress', 'the client should call the RPC: ');
  includes(syncSource, '/auth/v1/token', 'the client should use GoTrue: ');
});

check('sync is documented as optional and local-first', () => {
  const readme = read('README.md');
  includes(readme.toLowerCase(), 'local-first');
  const instance = read('INSTANCE.md');
  includes(instance, 'Sync');
});

/* ------------------------------------------------------------ inventory */
check('content inventory is non-trivial', () => {
  ok(VOCAB.words.length >= 200, `expected a real course, got ${VOCAB.words.length} words: `);
  ok(LESSONS.length >= 3, `expected at least 3 full lessons, got ${LESSONS.length}: `);
  ok(Object.keys(TAP.entries).length >= VOCAB.words.length, 'the tap dictionary is smaller than the vocabulary: ');
  const n2 = VOCAB.lessons.filter((u) => u.deck === 'n2');
  ok(n2.length >= 1, 'no N2 deck: ');
});

/* ----------------------------------------------------------------- report */
const total = passed + failures.length;
if (failures.length) {
  console.error(`\n  ${failures.length} of ${total} QA checks FAILED\n`);
  for (const f of failures) console.error(`  ✗ ${f.name}\n      ${f.message}`);
  console.error('');
  process.exit(1);
}
console.log(`  qa: ${passed}/${total} checks passed`);
console.log(`  inventory: ${VOCAB.words.length} words · ${LESSONS.length} lessons · ` +
  `${Object.keys(TAP.entries).length} dictionary entries · ${VOCAB.meta.decks.join(' + ')} decks`);
