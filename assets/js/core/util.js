/* util.js — DOM, dates, text and small numeric helpers.
 *
 * No dependencies. Everything hangs off window.NJ.U.
 * The script is wrapped so it can also be loaded in a bare sandbox by
 * tools/test_lang.mjs and tools/smoke.mjs.
 */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var U = (NJ.U = {});

  /* ------------------------------------------------------------------ DOM */

  U.$ = function (sel, scope) {
    return (scope || root.document).querySelector(sel);
  };

  U.$$ = function (sel, scope) {
    return Array.prototype.slice.call((scope || root.document).querySelectorAll(sel));
  };

  /** Build an element tree from an HTML string and return the first node. */
  U.el = function (html) {
    var tpl = root.document.createElement('template');
    tpl.innerHTML = String(html).trim();
    return tpl.content.firstElementChild;
  };

  /** Escape untrusted text for interpolation into an HTML template. */
  U.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  /** Delegated listener: one handler on a root, matched by selector. */
  U.on = function (rootEl, evName, sel, fn) {
    if (!rootEl) return function () {};
    function handler(ev) {
      var target = ev.target;
      if (target && target.nodeType !== 1) target = target.parentElement;
      if (!target || !target.closest) return;
      var hit = target.closest(sel);
      if (!hit || !rootEl.contains(hit)) return;
      fn.call(hit, ev, hit);
    }
    rootEl.addEventListener(evName, handler);
    return function () { rootEl.removeEventListener(evName, handler); };
  };

  U.clamp = function (n, lo, hi) {
    n = Number(n);
    if (!isFinite(n)) n = lo;
    return n < lo ? lo : n > hi ? hi : n;
  };

  U.pad2 = function (n) {
    return (n < 10 ? '0' : '') + n;
  };

  /* ----------------------------------------------------------------- dates */

  var DAY_MS = 86400000;

  U.now = function () { return Date.now(); };

  U.startOfDay = function (d) {
    var x = d instanceof Date ? new Date(d.getTime()) : new Date(d || Date.now());
    x.setHours(0, 0, 0, 0);
    return x;
  };

  /** Local date key: YYYY-MM-DD. Never use toISOString here — that is UTC. */
  U.dayKey = function (d) {
    var x = d instanceof Date ? d : new Date(d == null ? Date.now() : d);
    return x.getFullYear() + '-' + U.pad2(x.getMonth() + 1) + '-' + U.pad2(x.getDate());
  };

  U.parseDayKey = function (key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };

  U.addDays = function (d, n) {
    var x = U.toDate(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  /**
   * Coerce to a Date. A YYYY-MM-DD string is parsed as a LOCAL calendar date:
   * `new Date('2026-11-18')` would be UTC midnight and land on the wrong day
   * for anyone west of Greenwich.
   */
  U.toDate = function (x) {
    if (x instanceof Date) return new Date(x.getTime());
    if (typeof x === 'number') return new Date(x);
    var pd = U.parseDayKey(x);
    return pd || new Date(x);
  };

  /** Whole days from a to b, both floored to local midnight. b - a. */
  U.daysBetween = function (a, b) {
    var x = U.startOfDay(U.toDate(a)).getTime();
    var y = U.startOfDay(U.toDate(b)).getTime();
    return Math.round((y - x) / DAY_MS);
  };

  U.fmtDate = function (d, opts) {
    var x = U.toDate(d);
    if (!x || isNaN(x.getTime())) return '—';
    return x.toLocaleDateString(undefined, opts || { month: 'short', day: 'numeric' });
  };

  /** "3 days ago", "in 2 days", "today". Used in the UI, not for scheduling. */
  U.relDay = function (d, from) {
    var n = U.daysBetween(from || new Date(), d);
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n === -1) return 'yesterday';
    return n > 0 ? 'in ' + n + ' days' : Math.abs(n) + ' days ago';
  };

  U.fmtMinutes = function (min) {
    var m = Math.round(Number(min) || 0);
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60);
    var r = m % 60;
    return r ? h + ' h ' + r + ' min' : h + ' h';
  };

  /** "1:07" style clock for timers. */
  U.fmtClock = function (seconds) {
    var s = Math.max(0, Math.round(Number(seconds) || 0));
    return Math.floor(s / 60) + ':' + U.pad2(s % 60);
  };

  /* ------------------------------------------------------------ randomness */

  /** Deterministic 32-bit PRNG so shuffles are reproducible in tests. */
  U.mulberry32 = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.hash32 = function (str) {
    var h = 2166136261 >>> 0;
    var s = String(str);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  };

  U.shuffle = function (arr, rand) {
    var a = arr.slice();
    var r = rand || Math.random;
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  };

  U.sample = function (arr, n, rand) {
    return U.shuffle(arr, rand).slice(0, Math.max(0, n));
  };

  U.pick = function (arr, rand) {
    if (!arr || !arr.length) return undefined;
    var r = rand || Math.random;
    return arr[Math.floor(r() * arr.length)];
  };

  /* ----------------------------------------------------------------- misc */

  U.pct = function (num, den) {
    if (!den) return 0;
    return Math.round((num / den) * 100);
  };

  U.deepClone = function (v) {
    if (typeof structuredClone === 'function') return structuredClone(v);
    return JSON.parse(JSON.stringify(v));
  };

  U.debounce = function (fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, args); }, ms);
    };
  };

  /**
   * Character-level diff for dictation feedback.
   * Returns [{ op: 'same'|'ins'|'del', text }] where 'ins' is text the learner
   * added and 'del' is text they missed, both relative to the expected answer.
   */
  U.diffChars = function (expected, actual) {
    var a = Array.from(String(expected == null ? '' : expected));
    var b = Array.from(String(actual == null ? '' : actual));
    var n = a.length, m = b.length;

    // LCS table. Strings here are short (a dictation sentence), so O(n*m) is fine.
    var dp = [];
    for (var i = 0; i <= n; i++) dp.push(new Array(m + 1).fill(0));
    for (i = 1; i <= n; i++) {
      for (var j = 1; j <= m; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    // Walk back from the end, recording one op per character, then reverse.
    var perChar = [];
    i = n; j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        perChar.push({ op: 'same', ch: a[i - 1] }); i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        perChar.push({ op: 'ins', ch: b[j - 1] }); j--;
      } else {
        perChar.push({ op: 'del', ch: a[i - 1] }); i--;
      }
    }
    perChar.reverse();

    var out = [];
    for (var k = 0; k < perChar.length; k++) {
      var o = perChar[k];
      var last = out[out.length - 1];
      if (last && last.op === o.op) last.text += o.ch;
      else out.push({ op: o.op, text: o.ch });
    }
    return out;
  };

  /** Count how many characters differ, for a coarse dictation score. */
  U.diffDistance = function (expected, actual) {
    return U.diffChars(expected, actual).reduce(function (sum, seg) {
      return sum + (seg.op === 'same' ? 0 : Array.from(seg.text).length);
    }, 0);
  };

  /**
   * Levenshtein distance in characters, where a substitution costs 1.
   * Used for dictation tolerance: a mistyped character is one mistake, not two.
   */
  U.editDistance = function (a, b) {
    var s = Array.from(String(a == null ? '' : a));
    var t = Array.from(String(b == null ? '' : b));
    if (!s.length) return t.length;
    if (!t.length) return s.length;

    var prev = new Array(t.length + 1);
    var cur = new Array(t.length + 1);
    var i, j;
    for (j = 0; j <= t.length; j++) prev[j] = j;
    for (i = 1; i <= s.length; i++) {
      cur[0] = i;
      for (j = 1; j <= t.length; j++) {
        var cost = s[i - 1] === t[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      var swap = prev; prev = cur; cur = swap;
    }
    return prev[t.length];
  };

  U.download = function (filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = root.document.createElement('a');
    a.href = url;
    a.download = filename;
    root.document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  };
})(typeof window !== 'undefined' ? window : globalThis);
