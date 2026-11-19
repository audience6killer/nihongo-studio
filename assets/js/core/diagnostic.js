/* diagnostic.js — calibration before the plan.
 *
 * A short adaptive check, not a certification exam. Its job is to find out
 * which recap words the learner still owns so that three months are not spent
 * re-learning them (PORTING.md §4.6).
 *
 * Stage A: 14 items sampled across every chapter — 10 meaning, 4 reading.
 * Stage B: if stage A accuracy is at least 55%, five words from the latest
 *          chapter plus two grammar items; otherwise five from the earliest
 *          chapter plus two grammar items.
 *
 * Effects when it finishes:
 *   - recognised confidently   -> rec card seeded mature, prod and listen due now
 *   - missed                   -> refresh deck, all three cards due now
 */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var DIAG = (NJ.DIAG = {});

  DIAG.STAGE_A_MEANING = 10;
  DIAG.STAGE_A_READING = 4;
  DIAG.STAGE_B_WORDS = 5;
  DIAG.STAGE_B_GRAMMAR = 2;
  DIAG.PASS_PCT = 55;

  /** A mature seed for a card the learner already demonstrably owns. */
  DIAG.SEED_DAYS = 21;

  var U = NJ.U;

  function mcq(correct, distractors) {
    var options = U.shuffle([correct].concat(distractors), Math.random);
    return { options: options, answer: options.indexOf(correct) };
  }

  function wordItem(term, kind, seed) {
    var w = NJ.D.word(term);
    if (!w) return null;
    if (kind === 'reading') {
      if (!w.reading) return null;
      var r = mcq(w.reading, NJ.D.distractorReadings(w, 3));
      return { kind: 'reading', term: term, chapter: w.lesson, options: r.options, answer: r.answer, seed: seed };
    }
    var g = mcq(w.gloss, NJ.D.distractorGlosses(w, 3));
    return { kind: 'meaning', term: term, chapter: w.lesson, options: g.options, answer: g.answer, seed: seed };
  }

  function grammarItems(count, chapters) {
    var pool = [];
    (chapters || NJ.D.chapters()).forEach(function (ch) {
      var les = NJ.D.lesson(ch);
      var drills = (les && les.grammar && les.grammar.drills) || [];
      drills.forEach(function (d, i) {
        pool.push({
          kind: 'grammar',
          chapter: ch,
          id: 'g' + ch + '-' + i,
          q_l2: d.q_l2,
          options: d.options_l2.slice(),
          answer: d.answer,
          explain_l1: d.explain_l1
        });
      });
    });
    return U.sample(pool, count, Math.random);
  }

  /** Words ordered by chapter so "early" and "late" mean something. */
  function orderedTerms() {
    var out = [];
    NJ.D.chapters().forEach(function (ch) {
      NJ.D.chapterTerms(ch).forEach(function (t) { out.push(t); });
    });
    return out;
  }

  function splitByChapter(terms) {
    var chapters = NJ.D.chapters();
    var mid = Math.max(0, Math.floor(chapters.length / 2));
    var early = chapters.slice(0, Math.max(1, mid));
    var late = chapters.slice(Math.max(1, mid));
    function from(list) {
      return terms.filter(function (t) {
        var w = NJ.D.word(t);
        return w && list.indexOf(w.lesson) >= 0;
      });
    }
    return { early: from(early), late: from(late.length ? late : chapters) };
  }

  DIAG.stageA = function () {
    var terms = orderedTerms();
    if (!terms.length) return [];
    var all = U.shuffle(terms, Math.random);
    var meaningTerms = all.slice(0, DIAG.STAGE_A_MEANING);
    var readingTerms = all.slice(DIAG.STAGE_A_MEANING, DIAG.STAGE_A_MEANING + DIAG.STAGE_A_READING);
    var items = [];
    meaningTerms.forEach(function (t) { var it = wordItem(t, 'meaning', 'A'); if (it) items.push(it); });
    readingTerms.forEach(function (t) { var it = wordItem(t, 'reading', 'A'); if (it) items.push(it); });
    // Spread them so the first four items are not all one kind.
    return U.shuffle(items, Math.random);
  };

  DIAG.stageB = function (stageAItems, results) {
    var used = {};
    stageAItems.forEach(function (it) { if (it.term) used[it.term] = true; });

    var correct = results.filter(function (r) { return r.correct; }).length;
    var pct = results.length ? Math.round((correct / results.length) * 100) : 0;
    var strong = pct >= DIAG.PASS_PCT;

    var split = splitByChapter(orderedTerms().filter(function (t) { return !used[t]; }));
    var pool = strong ? split.late : split.early;
    if (!pool.length) pool = orderedTerms().filter(function (t) { return !used[t]; });

    var items = [];
    U.sample(pool, DIAG.STAGE_B_WORDS, Math.random).forEach(function (t) {
      var it = wordItem(t, 'meaning', 'B');
      if (it) items.push(it);
    });
    grammarItems(DIAG.STAGE_B_GRAMMAR).forEach(function (it) { items.push(it); });

    return { strong: strong, stageAPct: pct, items: U.shuffle(items, Math.random) };
  };

  /** Create the run. Returns the stored diagnostic object. */
  DIAG.start = function (state) {
    var stageA = DIAG.stageA();
    var run = {
      startedAt: Date.now(),
      done: false,
      stage: 'A',
      stageA: { items: stageA, results: [], idx: 0 },
      stageB: null,
      strong: null,
      results: [],
      byChapter: {},
      accuracy: 0,
      refreshed: [],
      seeded: []
    };
    state.diagnostic = run;
    return run;
  };

  DIAG.item = function (run) {
    if (!run || run.done) return null;
    var stage = run.stage === 'A' ? run.stageA : (run.stageB || { items: [], idx: 0 });
    return stage.items[stage.idx] || null;
  };

  DIAG.progress = function (run) {
    if (!run) return { done: 0, total: 0, pct: 0, label: '' };
    if (run.stage === 'A') {
      var total = run.stageA.items.length || 1;
      return { done: run.stageA.results.length, total: run.stageA.items.length, pct: Math.round((run.stageA.results.length / total) * 100), label: 'Stage A' };
    }
    if (run.stage === 'B') {
      var bTotal = (run.stageB && run.stageB.items.length) || 1;
      var bDone = (run.stageB && run.stageB.results && run.stageB.results.length) || 0;
      return { done: bDone, total: run.stageB.items.length, pct: Math.round((bDone / bTotal) * 100), label: 'Stage B' };
    }
    return { done: 1, total: 1, pct: 100, label: 'Done' };
  };

  /**
   * Record one answer and advance. Returns:
   *   { finished: false }                         still running
   *   { finished: true, stageChanged: true }      stage A done, stage B begins
   *   { finished: true, complete: true }          whole calibration done
   */
  DIAG.submit = function (state, picked) {
    var run = state.diagnostic;
    if (!run || run.done) return { finished: true, complete: true };
    var stage = run.stage === 'A' ? run.stageA : run.stageB;
    var item = stage.items[stage.idx];
    if (!item) return { finished: true, complete: true };

    var correct = Number(picked) === item.answer;
    var result = {
      kind: item.kind,
      term: item.term || null,
      chapter: item.chapter || null,
      correct: correct,
      picked: Number(picked)
    };
    stage.results.push(result);
    stage.idx++;
    run.results.push(result);

    if (stage.idx < stage.items.length) return { finished: false, correct: correct };

    if (run.stage === 'A') {
      var b = DIAG.stageB(run.stageA.items, run.stageA.results);
      run.strong = b.strong;
      run.stageAPct = b.stageAPct;
      run.stageB = { items: b.items, results: [], idx: 0 };
      run.stage = b.items.length ? 'B' : 'done';
      if (run.stage === 'done') { DIAG.finish(state); return { finished: true, complete: true }; }
      return { finished: true, stageChanged: true, strong: b.strong };
    }

    DIAG.finish(state);
    return { finished: true, complete: true };
  };

  /**
   * Apply the results: seed what was recognised, refresh what was missed.
   * This is the only place a diagnostic touches the study state.
   */
  DIAG.finish = function (state) {
    var run = state.diagnostic;
    if (!run || run.done) return run;
    var now = Date.now();

    // A word is "known" only if every item that tested it was right. A word
    // tested once and missed is refreshed; recognition with a failed reading
    // still counts as needing work, because kanji->reading is the fragile part.
    var byTerm = {};
    run.results.forEach(function (r) {
      if (!r.term) return;
      var row = byTerm[r.term] || (byTerm[r.term] = { seen: 0, correct: 0, chapter: r.chapter });
      row.seen++;
      if (r.correct) row.correct++;
    });

    var refreshed = [];
    var seeded = [];

    Object.keys(byTerm).forEach(function (term) {
      var row = byTerm[term];
      var known = row.correct === row.seen;
      var chapter = row.chapter || 1;
      if (state.words[term]) return;                    // already introduced

      state.words[term] = {
        w: term,
        lesson: chapter,
        deck: known ? 'recap' : 'refresh',
        introducedAt: now,
        status: known ? 'seeded' : 'refresh',
        seen: 0,
        correct: 0,
        lapses: 0,
        lastSeen: 0
      };
      NJ.SRS.ensureCards(state, term, { now: now, recap: true });

      if (known) {
        seeded.push(term);
        var rec = state.cards[NJ.SRS.key(term, 'rec')];
        if (rec) {
          rec.reps = 3;
          rec.interval = DIAG.SEED_DAYS;
          rec.ease = NJ.SRS.EASE0;
          rec.due = now + DIAG.SEED_DAYS * 86400000;
        }
        // Production is the skill the recap exists for: test it soon.
        var prod = state.cards[NJ.SRS.key(term, 'prod')];
        if (prod) prod.due = now;
      } else {
        refreshed.push(term);
      }
    });

    var correct = run.results.filter(function (r) { return r.correct; }).length;
    run.byChapter = {};
    run.results.forEach(function (r) {
      if (!r.chapter) return;
      var row = run.byChapter[r.chapter] || (run.byChapter[r.chapter] = { seen: 0, correct: 0 });
      row.seen++;
      if (r.correct) row.correct++;
    });
    Object.keys(run.byChapter).forEach(function (ch) {
      var row = run.byChapter[ch];
      row.pct = row.seen ? Math.round((row.correct / row.seen) * 100) : 0;
    });

    run.accuracy = run.results.length ? Math.round((correct / run.results.length) * 100) : 0;
    run.done = true;
    run.finishedAt = now;
    run.refreshed = refreshed;
    run.seeded = seeded;
    run.stage = 'done';
    run.grammarSeen = run.results.filter(function (r) { return r.kind === 'grammar'; }).length;
    run.grammarCorrect = run.results.filter(function (r) { return r.kind === 'grammar' && r.correct; }).length;

    if (state.profile) state.profile.calibrated = true;
    return run;
  };

  DIAG.skip = function (state) {
    state.diagnostic = {
      startedAt: Date.now(),
      finishedAt: Date.now(),
      done: true,
      skipped: true,
      results: [],
      byChapter: {},
      accuracy: 0,
      refreshed: [],
      seeded: []
    };
    if (state.profile) state.profile.calibrated = true;
    return state.diagnostic;
  };

  DIAG.hasRun = function (state) {
    return !!(state.diagnostic && state.diagnostic.done);
  };
})(typeof window !== 'undefined' ? window : globalThis);
