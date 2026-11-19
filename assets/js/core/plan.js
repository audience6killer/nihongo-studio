/* plan.js — the target-date plan, the adaptive daily load, and honest pacing.
 *
 * The plan protects the habit: when reviews pile up, new words are cut rather
 * than the review queue. See STUDY_PLAN.md for the arithmetic.
 */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var PLAN = (NJ.PLAN = {});

  PLAN.SESSIONS_PER_WEEK = 5;

  /** Which deck the learner is working through, and the order to draw from. */
  PLAN.phaseOf = function (state) {
    var p = state && state.profile;
    return (p && p.phase) || 'recap';
  };

  PLAN.activeDecks = function (state) {
    return PLAN.phaseOf(state) === 'n2' ? ['n2', 'recap'] : ['recap', 'n2'];
  };

  PLAN.deckLabel = function (deck) {
    return deck === 'n2' ? 'N2 vocabulary' : 'Tobira recap';
  };

  /** Introduced / total for one deck, for the phase card. */
  PLAN.deckProgress = function (state, deck) {
    var units = NJ.D.deckLessons(deck);
    var total = 0;
    var introduced = 0;
    units.forEach(function (u) {
      (u.words || []).forEach(function (t) {
        total++;
        if (state.words[t]) introduced++;
      });
    });
    return { total: total, introduced: introduced, pct: total ? Math.round((introduced / total) * 100) : 0 };
  };

  /** Seconds per item, used to fill a session to the target minutes. */
  PLAN.EST = { rec: 12, prod: 30, listen: 16, new: 40, dictation: 45, reading: 60, writing: 300 };

  /** A new word costs its card plus the checks that follow it in the same session. */
  PLAN.NEW_GROUP = { card: 40, rec: 12, prod: 30, listen: 16 };

  PLAN.THRESHOLDS = [
    { due: 100, newPerDay: 0 },
    { due: 70, newPerDay: 4 },
    { due: 45, newPerDay: 8 }
  ];

  PLAN.CATCH_UP_BONUS = 3;
  PLAN.CATCH_UP_CEILING = 30;

  /**
   * How many new words today's session may introduce.
   * dueCount is the number of review cards already due.
   *
   * The catch-up bonus is genuinely additive (PORTING.md §4.5: "+3 new words"),
   * so a learner who is behind can exceed their usual setting — but only while
   * the review queue is under 70 cards, and never past the absolute ceiling.
   */
  PLAN.effectiveNewPerDay = function (dueCount, settings, behindPlan) {
    var want = (settings && settings.newPerDay) || 15;
    var allowed = want;
    for (var i = 0; i < PLAN.THRESHOLDS.length; i++) {
      var t = PLAN.THRESHOLDS[i];
      if (dueCount > t.due) {
        allowed = Math.min(allowed, t.newPerDay);
        break;
      }
    }
    if (behindPlan && dueCount < 70) {
      allowed = Math.min(PLAN.CATCH_UP_CEILING, allowed + PLAN.CATCH_UP_BONUS);
    }
    return Math.max(0, allowed);
  };

  PLAN.newGroupSeconds = function (hasAudio) {
    var g = PLAN.NEW_GROUP;
    return g.card + g.rec + g.prod + (hasAudio ? g.listen : 0);
  };

  PLAN.targetDate = function (state) {
    var p = state && state.profile;
    if (p && p.targetDate) return new Date(p.targetDate);
    return null;
  };

  /** Whole weeks from today until the target date (negative if passed). */
  PLAN.weeksLeft = function (state, now) {
    var t = PLAN.targetDate(state);
    if (!t) return null;
    return NJ.U.daysBetween(now || new Date(), t) / 7;
  };

  /**
   * Are we behind the linear schedule that the target date implies?
   * Compared in words introduced, which is what the learner controls.
   */
  PLAN.behind = function (state, now) {
    var p = state && state.profile;
    if (!p || !p.startDate) return false;
    var total = NJ.D.words().length || 0;
    if (!total) return false;
    var start = NJ.U.toDate(p.startDate);
    var elapsedDays = Math.max(0, NJ.U.daysBetween(start, now || new Date()));
    var elapsedStudyDays = Math.floor((elapsedDays / 7) * PLAN.SESSIONS_PER_WEEK);
    var expected = Math.round(elapsedStudyDays * (p.newPerDay || 15));
    var introduced = Object.keys(state.words || {}).length;
    if (expected <= 0) return false;
    return introduced < expected * 0.85;
  };

  PLAN.introducedCount = function (state) {
    return Object.keys(state.words || {}).length;
  };

  PLAN.remainingCount = function (state) {
    var total = NJ.D.words().length || 0;
    return Math.max(0, total - PLAN.introducedCount(state));
  };

  /**
   * Projected finish date at the current new-word rate, and whether the target
   * date is reachable. This is deliberately pessimistic-ish: it says "not
   * enough" instead of flattering the learner.
   */
  PLAN.projection = function (state, now) {
    now = now || new Date();
    var settings = (state && state.settings) || {};
    var perDay = settings.newPerDay || 15;
    var remaining = PLAN.remainingCount(state);
    var total = NJ.D.words().length || 0;
    var introduced = PLAN.introducedCount(state);
    var capacityPerWeek = perDay * PLAN.SESSIONS_PER_WEEK;
    var weeksNeeded = capacityPerWeek > 0 ? remaining / capacityPerWeek : Infinity;
    var finish = isFinite(weeksNeeded) ? NJ.U.addDays(now, Math.ceil(weeksNeeded * 7)) : null;
    var target = PLAN.targetDate(state);
    var weeksLeft = target ? NJ.U.daysBetween(now, target) / 7 : null;
    var reachable = target && isFinite(weeksNeeded) ? weeksNeeded <= weeksLeft : null;

    return {
      total: total,
      introduced: introduced,
      remaining: remaining,
      capacityPerWeek: capacityPerWeek,
      weeksNeeded: weeksNeeded,
      weeksLeft: weeksLeft,
      finish: finish,
      target: target,
      reachable: reachable,
      pctComplete: total ? Math.round((introduced / total) * 100) : 0
    };
  };

  /** Split a target minutes budget into a session shape. */
  PLAN.budgetSeconds = function (minutes) {
    return Math.max(120, Math.round((Number(minutes) || 35) * 60));
  };

  /**
   * Decide how many items fit. New words are guaranteed a share so the course
   * keeps moving; reviews fill what is left, which is what keeps retention up.
   */
  PLAN.shape = function (opts) {
    var budget = opts.budgetSeconds;
    var dueCount = opts.dueCount;
    var wantNew = opts.wantNew;
    var newCost = Math.max(20, opts.newGroupSeconds || PLAN.newGroupSeconds(true));
    var dictationCount = opts.dictationCount || 0;
    var dictationCost = dictationCount * PLAN.EST.dictation;
    var avgReview = opts.avgReviewSeconds || 20;

    var left = Math.max(0, budget - dictationCost);
    // New words get at most 45% of the remaining time so reviews always fit.
    var newRoom = Math.floor((left * 0.45) / newCost);
    var newCount = Math.max(0, Math.min(wantNew, newRoom, opts.availableNew || 0));
    left -= newCount * newCost;

    var reviewRoom = Math.floor(left / avgReview);
    var reviewCount = Math.max(0, Math.min(dueCount, reviewRoom, opts.reviewCap || Infinity));

    return {
      newCount: newCount,
      reviewCount: reviewCount,
      dictationCount: dictationCount,
      seconds: newCount * newCost + reviewCount * avgReview + dictationCost
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
