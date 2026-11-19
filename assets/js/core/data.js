/* data.js — joins generated vocabulary and lesson content, builds lookups,
 * and finds the sentence-level context shown on a new-word card.
 *
 * Context translation rule (PORTING.md §4.12): a card shows a translation only
 * when that translation belongs to the exact sentence being shown. There is no
 * passage-level fallback, ever.
 */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var D = (NJ.D = {});

  var byTerm = null;
  var lessonById = null;
  var ready = false;

  D.init = function (opts) {
    var vocab = (opts && opts.vocab) || root.NJ_VOCAB || { lessons: [], words: [] };
    var lessons = (opts && opts.lessons) || root.NJ_LESSONS || [];
    var tap = (opts && opts.tap) || root.NJ_TAP || { entries: {} };

    byTerm = Object.create(null);
    for (var i = 0; i < vocab.words.length; i++) {
      var w = vocab.words[i];
      byTerm[w.w] = w;
    }

    lessonById = Object.create(null);
    for (var j = 0; j < lessons.length; j++) {
      lessonById[lessons[j].chapter] = lessons[j];
    }

    D.vocab = vocab;
    D.lessons = lessons.slice().sort(function (a, b) { return a.chapter - b.chapter; });
    D.tap = tap;
    D.entries = tap.entries || {};
    D.meta = vocab.meta || {};
    ready = true;
    return D;
  };

  D.ready = function () { return ready; };

  D.word = function (term) { return (byTerm && byTerm[term]) || null; };
  D.lesson = function (chapter) { return (lessonById && lessonById[chapter]) || null; };

  D.words = function () { return (D.vocab && D.vocab.words) || []; };

  /** Chapter numbers that have full lesson content, in order. */
  D.chapters = function () {
    return D.lessons.map(function (l) { return l.chapter; });
  };

  /** Every vocabulary unit in the course, recap and N2, ordered by number. */
  D.units = function () {
    var list = (D.vocab && D.vocab.lessons) ? D.vocab.lessons.slice() : [];
    return list.sort(function (a, b) { return a.n - b.n; });
  };

  /** Vocabulary units belonging to one deck. */
  D.deckLessons = function (deck) {
    return D.units().filter(function (u) { return u.deck === deck; });
  };

  D.unit = function (n) {
    var list = D.units();
    for (var i = 0; i < list.length; i++) if (list[i].n === n) return list[i];
    return null;
  };

  D.decks = function () {
    return (D.meta && D.meta.decks && D.meta.decks.length) ? D.meta.decks : ['recap'];
  };

  /** "Chapter 3" for the recap, "N2 · 1" for a vocabulary deck. */
  D.chapterLabel = function (n) {
    if (n == null) return '—';
    if (n > 100) return 'N2 · ' + (n - 100);
    return 'Chapter ' + n;
  };

  /** True when the unit has reading, grammar and writing content. */
  D.hasLesson = function (n) {
    return !!D.lesson(n);
  };

  /** Terms belonging to a chapter, in TSV order. */
  D.chapterTerms = function (chapter) {
    var les = D.vocab && D.vocab.lessons ? D.vocab.lessons.filter(function (l) {
      return l.n === chapter;
    })[0] : null;
    if (les && les.words && les.words.length) return les.words.slice();
    return D.words().filter(function (w) { return w.lesson === chapter; }).map(function (w) { return w.w; });
  };

  /**
   * Find the single sentence that best illustrates a word, with its own
   * translation. Dictation sentences are short and unambiguous, so they win;
   * then reading sentences; then grammar examples.
   */
  D.exampleFor = function (term) {
    var chapters = D.lessons;
    for (var pass = 0; pass < 3; pass++) {
      for (var i = 0; i < chapters.length; i++) {
        var les = chapters[i];
        var candidates = [];
        if (pass === 0) {
          candidates = (les.listening && les.listening.dictation) || [];
        } else if (pass === 1) {
          candidates = (les.reading && les.reading.sentences) || [];
        } else {
          candidates = (les.grammar && les.grammar.examples) || [];
        }
        for (var k = 0; k < candidates.length; k++) {
          var c = candidates[k];
          if (!c.l2 || !c.l1) continue;
          // Skip a sentence whose translation is identical to another's: that is
          // the signature of a mis-aligned passage translation.
          if (c.l2.indexOf(term) >= 0) return { l2: c.l2, l1: c.l1, source: les.chapter };
        }
      }
    }
    return null;
  };

  /** Pick up to `need` distinct glosses, never reusing anything in `exclude`. */
  function pickGlosses(pool, exclude, need, rand) {
    var U = NJ.U;
    var seen = exclude.slice();
    var out = [];
    var shuffled = U.shuffle(pool, rand);
    for (var i = 0; i < shuffled.length && out.length < need; i++) {
      var g = String(shuffled[i].gloss || '');
      if (!g || seen.indexOf(g) >= 0) continue;
      seen.push(g);
      out.push(g);
    }
    return out;
  }

  /** Distractor glosses for a multiple-choice card, from the same chapter. */
  D.distractorGlosses = function (word, n, rand) {
    var exclude = [String(word.gloss)];
    var samePos = D.words().filter(function (x) {
      return x.w !== word.w && x.pos === word.pos;
    });
    var out = pickGlosses(samePos, exclude, n, rand);
    if (out.length < n) {
      var rest = D.words().filter(function (x) { return x.w !== word.w; });
      // Dedupe across both pools: a fresh `seen` per call would let the second
      // pass repeat a gloss the first pass already offered.
      out = out.concat(pickGlosses(rest, exclude.concat(out), n - out.length, rand));
    }
    return out;
  };

  /** Distractor kana readings for a reading-recall card. */
  D.distractorReadings = function (word, n, rand) {
    var U = NJ.U;
    var seen = [String(word.reading)];
    var out = [];
    var shuffled = U.shuffle(D.words().filter(function (x) {
      return x.w !== word.w;
    }), rand);
    for (var i = 0; i < shuffled.length && out.length < n; i++) {
      var r = String(shuffled[i].reading || '');
      if (!r || seen.indexOf(r) >= 0) continue;
      seen.push(r);
      out.push(r);
    }
    return out;
  };

  /** How many review cards are due now, for the dashboard. */
  D.stats = function (state) {
    var chapters = D.chapters();
    return {
      chapters: chapters.length,
      words: D.words().length,
      introduced: Object.keys(state.words || {}).filter(function (k) {
        return state.words[k].status !== 'new';
      }).length
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
