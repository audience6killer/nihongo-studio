/* srs.js — three independent skills per word, SM-2 style, binary grading.
 *
 * Numbers are documented in STUDY_PLAN.md. Do not tune them silently: change
 * the table there in the same commit.
 */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var SRS = (NJ.SRS = {});

  SRS.SKILLS = ['rec', 'prod', 'listen'];
  SRS.SKILL_LABEL = { rec: 'Recognition', prod: 'Production', listen: 'Listening' };

  SRS.EASE0 = 2.5;
  SRS.EASE_MIN = 1.3;
  SRS.EASE_STEP = 0.2;
  SRS.MAX_DAYS = 730;
  SRS.MATURE_DAYS = 21;
  SRS.LAPSE_MINUTES = 10;

  // First-correct interval in days, by how the word was met.
  SRS.BASE = { rec: 1, prod: 2, listen: 1 };
  SRS.RECAP_BASE = { rec: 3, prod: 4, listen: 3 };

  var DAY_MS = 86400000;
  var MIN_MS = 60000;

  SRS.key = function (term, skill) { return term + '|' + skill; };

  SRS.splitKey = function (key) {
    var i = String(key).lastIndexOf('|');
    return { term: String(key).slice(0, i), skill: String(key).slice(i + 1) };
  };

  /** A card for one word and one skill, due immediately. */
  SRS.newCard = function (term, skill, opts) {
    var o = opts || {};
    var now = o.now == null ? Date.now() : o.now;
    return {
      w: term,
      skill: skill,
      due: now,
      interval: 0,
      ease: SRS.EASE0,
      reps: 0,
      lapses: 0,
      last: 0,
      suspended: false,
      recap: o.recap !== false,
      created: now
    };
  };

  /** Create any missing cards for a term. Returns the number created. */
  SRS.ensureCards = function (state, term, opts) {
    var created = 0;
    for (var i = 0; i < SRS.SKILLS.length; i++) {
      var skill = SRS.SKILLS[i];
      var k = SRS.key(term, skill);
      if (!state.cards[k]) {
        state.cards[k] = SRS.newCard(term, skill, opts);
        created++;
      }
    }
    return created;
  };

  SRS.isDue = function (card, now) {
    if (!card || card.suspended) return false;
    return card.due <= (now == null ? Date.now() : now);
  };

  SRS.isMature = function (card) {
    return !!card && card.interval >= SRS.MATURE_DAYS;
  };

  /** All cards that are due, soonest first. */
  SRS.due = function (state, opts) {
    var o = opts || {};
    var now = o.now == null ? Date.now() : o.now;
    var skills = o.skills || SRS.SKILLS;
    var out = [];
    var cards = state.cards || {};
    Object.keys(cards).forEach(function (k) {
      var card = cards[k];
      if (!card || card.suspended) return;
      if (skills.indexOf(card.skill) < 0) return;
      if (card.due > now) return;
      out.push({ key: k, card: card });
    });
    out.sort(function (a, b) { return a.card.due - b.card.due; });
    return out;
  };

  SRS.countDue = function (state, opts) {
    return SRS.due(state, opts).length;
  };

  /**
   * Grade one card. Binary: `correct` is true or false, nothing in between.
   * Mutates the card and returns it.
   */
  SRS.grade = function (card, correct, now) {
    now = now == null ? Date.now() : now;
    card.last = now;

    if (!correct) {
      card.lapses = (card.lapses || 0) + 1;
      card.reps = 0;                                  // SM-2 resets the streak
      card.ease = Math.max(SRS.EASE_MIN, Math.round(((card.ease || SRS.EASE0) - SRS.EASE_STEP) * 100) / 100);
      card.interval = SRS.LAPSE_MINUTES / 1440;       // ten minutes, in days
      card.due = now + SRS.LAPSE_MINUTES * MIN_MS;
      return card;
    }

    var base = (card.recap === false ? SRS.BASE : SRS.RECAP_BASE)[card.skill] || 1;
    if (card.reps === 0 || !card.interval) {
      card.interval = base;
    } else {
      card.interval = Math.min(SRS.MAX_DAYS, Math.round(card.interval * (card.ease || SRS.EASE0) * 100) / 100);
    }
    card.reps = (card.reps || 0) + 1;
    card.due = now + Math.round(card.interval * DAY_MS);
    return card;
  };

  /** Human summary of when a card will come back. */
  SRS.nextLabel = function (card) {
    if (!card) return '—';
    if (!card.interval) return 'now';
    if (card.interval < 1) return Math.round(card.interval * 1440) + ' min';
    if (card.interval < 1.5) return '1 day';
    if (card.interval < 60) return Math.round(card.interval) + ' days';
    return Math.round(card.interval / 30) + ' months';
  };

  /** Accuracy per skill. */
  SRS.skillAccuracy = function (state) {
    var stats = (state && state.skillStats) || {};
    var out = {};
    SRS.SKILLS.forEach(function (skill) {
      var s = stats[skill] || { seen: 0, correct: 0 };
      out[skill] = { seen: s.seen, correct: s.correct, pct: s.seen ? Math.round((s.correct / s.seen) * 100) : 0 };
    });
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
