/* lang.js — the Japanese language adapter.
 *
 * Everything language-specific that pure JavaScript needs lives here, so the
 * engine and screens stay language-neutral and this file can be tested on its
 * own (tools/test_lang.mjs).
 *
 * Policy (INSTANCE.md, PORTING.md §8.3):
 *   - Full-width/half-width and whitespace are normalised; nothing else.
 *   - Dakuten and handakuten are NEVER stripped: they change the word.
 *   - Kana is accepted for a kanji term when it equals the stored reading.
 *   - Hiragana is accepted for an all-katakana loanword (same phonemes).
 *   - Every other accepted variant must be curated into the word's `alt` list.
 */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var L = (NJ.L = {});

  var RE_CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
  var RE_CJK_ALL = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g;
  var RE_HIRA = /[\u3040-\u309F]/;
  var RE_KATA = /[\u30A0-\u30FF]/;
  var RE_KANA = /[\u3040-\u309F\u30A0-\u30FF]/;
  var RE_KATA_RUN = /^[\u30A0-\u30FF\u30FC]+$/;
  var RE_DIGIT = /[0-9０-９]/;
  var RE_MARK = /[\u3005\u30FC]/;   // 々 and the long-vowel mark

  /* ------------------------------------------------------- character tests */

  L.isKanji = function (ch) { return RE_CJK.test(ch); };
  L.isHiragana = function (ch) { return RE_HIRA.test(ch); };
  L.isKatakana = function (ch) { return RE_KATA.test(ch); };
  L.isKana = function (ch) { return RE_KANA.test(ch); };
  L.hasKanji = function (s) { return RE_CJK.test(String(s || '')); };
  L.hasKana = function (s) { return RE_KANA.test(String(s || '')); };

  /** True for a loanword written entirely in katakana (ー allowed). */
  L.isAllKatakana = function (s) { return RE_KATA_RUN.test(String(s || '')); };

  /** A kana-only reading: hiragana, katakana, ー, ゝ ゞ. Used by the validator. */
  L.isKanaOnly = function (s) {
    var t = String(s || '');
    if (!t) return false;
    return /^[\u3041-\u3096\u30A1-\u30FA\u30FC\u309D\u309E\u30FD\u30FE]+$/.test(t);
  };

  L.kanjiCount = function (s) {
    var m = String(s || '').match(RE_CJK_ALL);
    return m ? m.length : 0;
  };

  /* --------------------------------------------------------- normalization */

  /**
   * General normalisation: NFKC (folds full-width ASCII and half-width kana),
   * unified quote/punctuation variants, collapsed whitespace, trimmed.
   * Never removes ー, ゛ or ゜.
   */
  L.norm = function (s) {
    var t = String(s == null ? '' : s);
    if (typeof t.normalize === 'function') t = t.normalize('NFKC');
    t = t
      .replace(/[\u2018\u2019\u201B]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(/[\u3000\u00A0\t\r\n]+/g, ' ')
      .replace(/ {2,}/g, ' ');
    return t.trim();
  };

  /**
   * Answer normalisation: general normalisation, then drop ALL whitespace
   * (Japanese has none, and IMEs add it) and trailing sentence punctuation.
   */
  L.normAnswer = function (s) {
    return L.norm(s)
      .replace(/[\s\u3000]+/g, '')
      .replace(/[。．\.、，,・…]+$/g, '')
      .trim();
  };

  /* -------------------------------------------------------------- kana fold */

  L.toHiragana = function (s) {
    return String(s || '').replace(/[\u30A1-\u30F6]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0x60);
    }).replace(/\u30FD/g, '\u309D').replace(/\u30FE/g, '\u309E');
  };

  L.toKatakana = function (s) {
    return String(s || '').replace(/[\u3041-\u3096]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) + 0x60);
    }).replace(/\u309D/g, '\u30FD').replace(/\u309E/g, '\u30FE');
  };

  /* --------------------------------------------------------------- answers */

  /**
   * Grade a typed production answer.
   * @param {string} input  what the learner typed
   * @param {object} word   { w|term, reading, alt: [] }
   */
  L.sameAnswer = function (input, word) {
    var w = (word && typeof word === 'object') ? word : { term: String(word || '') };
    var term = w.term || w.w;
    if (!term) return false;

    var got = L.normAnswer(input);
    if (!got) return false;

    var candidates = [term];
    if (w.alt) candidates = candidates.concat(w.alt);
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i] && L.normAnswer(candidates[i]) === got) return true;
    }

    // Kana for kanji: accepted only when it reproduces the stored reading.
    if (w.reading && L.hasKanji(term) && L.normAnswer(w.reading) === got) return true;

    // Loanword written in hiragana instead of katakana: same phonemes.
    if (L.isAllKatakana(term) && L.normAnswer(L.toHiragana(term)) === got) return true;

    return false;
  };

  /* ---------------------------------------------------------- text shaping */

  /** Sentence split that keeps the terminator with its sentence. */
  L.splitSentences = function (text) {
    var t = String(text || '');
    if (!t) return [];
    var out = [];
    var buf = '';
    var closers = '\u300D\u300F\uFF09\u3009\u300B\u3011"\'';
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      buf += ch;
      var isEnd = ch === '\u3002' || ch === '\uFF01' || ch === '\uFF1F' || ch === '!' || ch === '?';
      if (isEnd) {
        while (i + 1 < t.length && closers.indexOf(t[i + 1]) >= 0) {
          buf += t[i + 1];
          i++;
        }
        out.push(buf);
        buf = '';
      }
    }
    if (buf.trim()) out.push(buf);
    return out;
  };

  /**
   * Count writing length in the requested unit.
   * 'chars' counts CJK ideographs, kana, ー, 々 and digits — the characters
   * that make up written Japanese. Punctuation and Latin are ignored.
   */
  L.countUnits = function (s, unit) {
    var t = String(s == null ? '' : s);
    if (unit === 'words') {
      var trimmed = t.trim();
      return trimmed ? trimmed.split(/\s+/).length : 0;
    }
    var n = 0;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (RE_CJK.test(ch) || RE_KANA.test(ch) || RE_MARK.test(ch) || RE_DIGIT.test(ch)) n++;
    }
    return n;
  };

  /**
   * Ruby markup for one word. Okurigana shared between the term and its
   * reading stays outside the ruby, so 恵まれる / めぐまれる renders with
   * furigana over 恵 only. Surrounding punctuation also stays outside.
   */
  L.ruby = function (term, reading) {
    var esc = (NJ.U && NJ.U.esc) || function (x) { return String(x); };
    var t = String(term == null ? '' : term);
    var r = String(reading == null ? '' : reading);
    if (!t || !r || !L.hasKanji(t)) return esc(t);

    // Shared leading kana, then shared trailing kana.
    var pre = 0;
    while (pre < t.length && pre < r.length && L.isKana(t[pre]) && t[pre] === r[pre]) pre++;
    var suf = 0;
    while (suf < t.length - pre && suf < r.length - pre &&
           L.isKana(t[t.length - 1 - suf]) && t[t.length - 1 - suf] === r[r.length - 1 - suf]) suf++;

    // Narrow the ruby to the contiguous kanji run inside what is left.
    var start = pre;
    var end = t.length - suf;
    while (start < end && !L.isKanji(t[start])) start++;
    while (end > start && !L.isKanji(t[end - 1])) end--;
    if (start >= end) return esc(t);

    var core = t.slice(start, end);
    var coreR = r.slice(pre, r.length - suf);
    if (!coreR) return esc(t);

    return esc(t.slice(0, start)) + '<ruby>' + esc(core) + '<rt>' + esc(coreR) + '</rt></ruby>' + esc(t.slice(end));
  };

  /** Strip ruby/punctuation for screen-reader text or plain labels. */
  L.plain = function (s) {
    return String(s == null ? '' : s).replace(/[\u3000\s]+/g, ' ').trim();
  };

  /** Deterministic question variant for a recognition card (see STUDY_PLAN.md). */
  L.recVariant = function (reps) {
    return (Number(reps) || 0) % 2 === 0 ? 'meaning' : 'reading';
  };

  /**
   * Dictionary segmentation with maximum coverage.
   *
   * Greedy longest-match is not good enough for Japanese: at 「は」 in
   * 「人はいなくなる」 it prefers the longer-but-wrong はい over は +
   * いなくなる, because it cannot see past the current position. This walks the
   * whole string with dynamic programming instead, maximising the number of
   * characters covered by real dictionary words and, on a tie, minimising the
   * number of tokens. The old greedy segmentation is one of the candidates, so
   * coverage can only improve.
   *
   * Returns [{ t: token, known: bool }]. The concatenation of every `t` is the
   * input, always. Unknown runs come out one character at a time so the
   * coverage checker can name them.
   *
   * This is the only implementation of the tokenizer: tools/check_tap.mjs runs
   * this exact function over the exact content the browser renders.
   */
  L.MAX_TERM = 12;

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  L.segment = function (text, entries, maxLen) {
    var t = String(text == null ? '' : text);
    var table = entries || {};
    var MAX = maxLen || L.MAX_TERM;
    var n = t.length;
    if (!n) return [];

    var cover = new Array(n + 1);
    var tokens = new Array(n + 1);
    var back = new Array(n + 1);
    for (var k = 0; k <= n; k++) { cover[k] = -1; tokens[k] = Infinity; back[k] = -1; }
    cover[0] = 0;
    tokens[0] = 0;

    function relax(j, c, cnt, step) {
      if (c > cover[j] || (c === cover[j] && cnt < tokens[j])) {
        cover[j] = c;
        tokens[j] = cnt;
        back[j] = step;
      }
    }

    for (var i = 0; i < n; i++) {
      if (cover[i] < 0) continue;
      // Advance one unknown character: no coverage, one more token.
      relax(i + 1, cover[i], tokens[i] + 1, 1);
      var limit = Math.min(MAX, n - i);
      for (var len = limit; len >= 1; len--) {
        var cand = t.substr(i, len);
        if (!hasOwn(table, cand)) continue;
        relax(i + len, cover[i] + len, tokens[i] + 1, len);
      }
    }

    var steps = [];
    var p = n;
    while (p > 0) {
      var step = back[p];
      if (step < 1) step = 1;
      steps.push(step);
      p -= step;
    }
    steps.reverse();

    var out = [];
    var at = 0;
    for (var s = 0; s < steps.length; s++) {
      var tok = t.substr(at, steps[s]);
      out.push({ t: tok, known: hasOwn(table, tok) });
      at += steps[s];
    }
    return out;
  };

  /** Convenience: the tap entry for a token, or null. */
  L.lookup = function (token, entries) {
    var table = entries || {};
    return Object.prototype.hasOwnProperty.call(table, token) ? table[token] : null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
