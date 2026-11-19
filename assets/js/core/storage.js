/* storage.js — one state object in localStorage under `nihongo.v1`.
 *
 * Local-first invariant: every answer is written here before anything else
 * happens. Nothing leaves the device.
 */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var S = (NJ.S = {});

  S.KEY = 'nihongo.v1';
  S.APP = 'ja';
  S.VERSION = 1;

  S.defaults = function () {
    return {
      version: S.VERSION,
      app: S.APP,
      createdAt: new Date().toISOString(),
      profile: null,
      settings: {
        voiceURI: '',
        rate: 0.9,
        furigana: false,
        newPerDay: 15,
        reviewCap: 45,
        reduceMotion: false,
        theme: 'auto',
        showTranslations: true
      },
      diagnostic: null,
      cards: {},
      words: {},
      lessons: {},
      sessions: [],
      days: {},
      writing: [],
      exams: [],
      skillStats: { rec: { seen: 0, correct: 0 }, prod: { seen: 0, correct: 0 }, listen: { seen: 0, correct: 0 } },
      current: null,
      onboarded: false,
      meta: { lastOpen: Date.now(), storage: 'local', configAt: '' }
    };
  };

  var cache = null;
  var quiet = false;

  function readRaw() {
    try {
      return root.localStorage.getItem(S.KEY);
    } catch (err) {
      return null;
    }
  }

  /** Fill in anything a older/newer build may have dropped. */
  S.migrate = function (state) {
    var d = S.defaults();
    var out = state && typeof state === 'object' ? state : {};
    out.version = S.VERSION;
    out.app = out.app || S.APP;
    out.createdAt = out.createdAt || d.createdAt;
    out.profile = out.profile || null;
    out.settings = Object.assign({}, d.settings, out.settings || {});
    out.diagnostic = out.diagnostic || null;
    out.cards = out.cards && typeof out.cards === 'object' ? out.cards : {};
    out.words = out.words && typeof out.words === 'object' ? out.words : {};
    out.lessons = out.lessons && typeof out.lessons === 'object' ? out.lessons : {};
    out.sessions = Array.isArray(out.sessions) ? out.sessions : [];
    out.days = out.days && typeof out.days === 'object' ? out.days : {};
    out.writing = Array.isArray(out.writing) ? out.writing : [];
    out.exams = Array.isArray(out.exams) ? out.exams : [];
    out.skillStats = Object.assign({}, d.skillStats, out.skillStats || {});
    Object.keys(d.skillStats).forEach(function (k) {
      out.skillStats[k] = Object.assign({ seen: 0, correct: 0 }, out.skillStats[k] || {});
    });
    out.current = out.current || null;
    out.onboarded = !!out.onboarded;
    out.meta = Object.assign({}, d.meta, out.meta || {});
    out.meta.lastOpen = Date.now();
    return out;
  };

  S.load = function () {
    if (cache) return cache;
    var raw = readRaw();
    if (!raw) {
      cache = S.migrate(null);
      S.save();
      return cache;
    }
    try {
      cache = S.migrate(JSON.parse(raw));
    } catch (err) {
      // A corrupt snapshot must not brick the app: keep a copy and start fresh.
      try { root.localStorage.setItem(S.KEY + '.corrupt.' + Date.now(), raw); } catch (e) { /* ignore */ }
      cache = S.migrate(null);
    }
    return cache;
  };

  S.state = function () { return S.load(); };

  S.save = function (state) {
    var s = state || cache;
    if (!s) return false;
    cache = s;
    try {
      root.localStorage.setItem(S.KEY, JSON.stringify(s));
      if (!quiet && NJ.sync && NJ.sync.onLocalSave) NJ.sync.onLocalSave();
      return true;
    } catch (err) {
      return false;
    }
  };

  /**
   * Swap the whole state for another snapshot (used when a cloud copy wins).
   * Quiet: the write must not schedule another sync.
   */
  S.replace = function (next) {
    var prev = quiet;
    quiet = true;
    try {
      cache = S.migrate(next);
      S.save(cache);
      return cache;
    } finally {
      quiet = prev;
    }
  };

  S.reset = function () {
    cache = S.migrate(null);
    S.save(cache);
    return cache;
  };

  /** Bytes used by the stored snapshot, for the settings screen. */
  S.sizeBytes = function () {
    var raw = readRaw();
    return raw ? new Blob([raw]).size : 0;
  };

  /** Everything except device-local connection state. */
  S.exportSnapshot = function (state) {
    var s = JSON.parse(JSON.stringify(state || S.load()));
    s.app = S.APP;
    s.exportedAt = new Date().toISOString();
    s.meta = { storage: s.meta && s.meta.storage, configAt: s.meta && s.meta.configAt };
    delete s.current;
    return s;
  };

  S.exportText = function (state) {
    return JSON.stringify(S.exportSnapshot(state), null, 1);
  };

  /** Import a backup. Rejects a backup from a different language instance. */
  S.importText = function (text) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return { ok: false, error: 'That file is not valid JSON.' };
    }
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'That file does not contain a progress snapshot.' };
    }
    if (parsed.app && parsed.app !== S.APP) {
      return { ok: false, error: 'That backup belongs to a different app (' + parsed.app + ').' };
    }
    if (!parsed.cards && !parsed.words) {
      return { ok: false, error: 'That snapshot has no study data in it.' };
    }
    var next = S.migrate(parsed);
    next.onboarded = !!parsed.onboarded;
    cache = next;
    S.save(cache);
    return { ok: true, state: next };
  };

  /* ------------------------------------------------------- daily counters */

  S.today = function (state) {
    var s = state || S.load();
    var key = NJ.U.dayKey(new Date());
    if (!s.days[key]) {
      s.days[key] = { minutes: 0, reviews: 0, newWords: 0, correct: 0, total: 0, sessions: 0, items: 0 };
    }
    return s.days[key];
  };

  S.bumpDay = function (state, delta) {
    var day = S.today(state);
    Object.keys(delta || {}).forEach(function (k) {
      day[k] = (day[k] || 0) + delta[k];
    });
    return day;
  };
})(typeof window !== 'undefined' ? window : globalThis);
