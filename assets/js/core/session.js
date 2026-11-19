/* session.js — building a day's queue, generating card prompts, grading, and
 * recording what happened.
 *
 * One rule keeps the engine honest: a card is graded on the objective answer
 * the learner gave, never on how they say it felt.
 */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var SES = (NJ.SESSION = {});

  SES.KIND = { NEW: 'new', REVIEW: 'review', DICTATION: 'dictation' };

  var ACTIVE_KEYS = ['recap', 'refresh', 'n2'];

  /**
   * The next unit with unintroduced words, drawn from the decks the current
   * phase puts first. Recap comes before N2 unless the learner switched.
   */
  SES.availableNew = function (state) {
    var decks = NJ.PLAN.activeDecks(state);
    for (var d = 0; d < decks.length; d++) {
      var units = NJ.D.deckLessons(decks[d]);
      for (var u = 0; u < units.length; u++) {
        var pending = (units[u].words || []).filter(function (t) { return !state.words[t]; });
        if (pending.length) {
          return { chapter: units[u].n, deck: decks[d], unit: units[u], terms: pending };
        }
      }
    }
    return { chapter: null, deck: decks[0], unit: null, terms: [] };
  };

  /** Which unit the learner is currently working through, or null when done. */
  SES.currentChapter = function (state) {
    return SES.availableNew(state).chapter;
  };

  function shuffle(arr) { return NJ.U.shuffle(arr, Math.random); }

  /** Build a 4-option question. Duplicates are dropped so grading is never ambiguous. */
  function mcq(correct, distractors) {
    var seen = [String(correct)];
    var pool = [];
    (distractors || []).forEach(function (d) {
      var text = String(d);
      if (!text || seen.indexOf(text) >= 0) return;
      seen.push(text);
      pool.push(text);
    });
    var options = shuffle([correct].concat(pool));
    return { options: options, answer: options.indexOf(correct) };
  }

  function buildReviewItem(card, key) {
    var word = NJ.D.word(card.w) || { w: card.w, gloss: '', reading: '', pos: '' };
    var item = { kind: SES.KIND.REVIEW, term: card.w, skill: card.skill, key: key || null };

    if (card.skill === 'prod') {
      item.prompt = 'type';
      return item;
    }

    if (card.skill === 'listen') {
      var lm = mcq(word.gloss || '—', NJ.D.distractorGlosses(word, 3));
      item.prompt = 'listen';
      item.options = lm.options;
      item.answer = lm.answer;
      return item;
    }

    // Recognition alternates between "what does it mean" and "how is it read".
    var variant = NJ.L.recVariant(card.reps);
    if (variant === 'reading' && word.reading) {
      var rm = mcq(word.reading, NJ.D.distractorReadings(word, 3));
      item.prompt = 'reading';
      item.options = rm.options;
      item.answer = rm.answer;
    } else {
      var gm = mcq(word.gloss || '—', NJ.D.distractorGlosses(word, 3));
      item.prompt = 'meaning';
      item.options = gm.options;
      item.answer = gm.answer;
    }
    return item;
  }

  /**
   * A brand-new word gets its card, then three immediate checks. They are built
   * exactly like review items — anything less and the learner would be shown an
   * empty option list and could not answer.
   */
  function buildNewGroup(term, chapter, hasAudio) {
    var items = [{ kind: SES.KIND.NEW, term: term, chapter: chapter, fresh: true }];
    items.push(buildReviewItem({ w: term, skill: 'rec', reps: 0 }, null));
    items.push(buildReviewItem({ w: term, skill: 'prod', reps: 0 }, null));
    if (hasAudio) items.push(buildReviewItem({ w: term, skill: 'listen', reps: 0 }, null));
    items.forEach(function (it) { it.fresh = true; });
    return items;
  }

  function dictationFor(state, chapter, count) {
    var lesson = NJ.D.lesson(chapter);
    if (!lesson || !lesson.listening || !lesson.listening.dictation) return [];
    var all = lesson.listening.dictation;
    if (!all.length || count <= 0) return [];
    var cursor = (state.meta && state.meta.dictationCursor) || 0;
    var out = [];
    for (var i = 0; i < Math.min(count, all.length); i++) {
      out.push({ kind: SES.KIND.DICTATION, sentence: all[(cursor + i) % all.length], chapter: chapter });
    }
    state.meta.dictationCursor = (cursor + out.length) % all.length;
    return out;
  }

  /**
   * Build and persist a session. Resumes an unfinished session from the same
   * day instead of throwing the learner's progress away.
   */
  SES.start = function (state, opts) {
    var o = opts || {};
    var now = o.now || Date.now();
    var hasAudio = o.hasAudio !== false;
    var today = NJ.U.dayKey(new Date(now));

    if (state.current && !state.current.done && state.current.date === today && !o.force) {
      return state.current;
    }

    var settings = state.settings || {};
    var skills = hasAudio ? NJ.SRS.SKILLS : ['rec', 'prod'];
    var due = NJ.SRS.due(state, { now: now, skills: skills });
    var behind = NJ.PLAN.behind(state, new Date(now));
    var wantNew = NJ.PLAN.effectiveNewPerDay(due.length, settings, behind);

    var availableNew = SES.availableNew(state);
    var chapter = availableNew.chapter;

    var avgReview = 20;
    if (due.length) {
      var sum = 0;
      due.forEach(function (d) { sum += (NJ.PLAN.EST[d.card.skill] || 16); });
      avgReview = sum / due.length;
    }

    var dictationCount = hasAudio ? 2 : 0;
    var shape = NJ.PLAN.shape({
      budgetSeconds: NJ.PLAN.budgetSeconds(settings.dailyMinutes || (state.profile && state.profile.dailyMinutes) || 35),
      dueCount: due.length,
      wantNew: wantNew,
      availableNew: availableNew.terms.length,
      newGroupSeconds: NJ.PLAN.newGroupSeconds(hasAudio),
      avgReviewSeconds: avgReview,
      reviewCap: settings.reviewCap || 45,
      dictationCount: dictationCount
    });

    var reviewItems = due.slice(0, shape.reviewCount).map(function (d) {
      return buildReviewItem(d.card, d.key);
    });

    var newGroups = [];
    for (var n = 0; n < shape.newCount; n++) {
      newGroups.push(buildNewGroup(availableNew.terms[n], chapter, hasAudio));
    }

    var dictItems = dictationFor(state, chapter, shape.dictationCount);

    // Mix units so the session does not run reviews-then-new-words in blocks.
    var units = [];
    reviewItems.forEach(function (it) { units.push([it]); });
    newGroups.forEach(function (g) { units.push(g); });
    dictItems.forEach(function (it) { units.push([it]); });
    units = shuffle(units);

    var items = [];
    units.forEach(function (u) { items = items.concat(u); });
    items.forEach(function (it) { delete it.card; });

    var session = {
      id: 's' + now.toString(36) + Math.floor(Math.random() * 1296).toString(36),
      date: today,
      startedAt: now,
      items: items,
      idx: 0,
      results: [],
      done: false,
      planned: shape,
      hasAudio: hasAudio,
      behind: behind,
      dueAtStart: due.length,
      newAtStart: shape.newCount
    };
    state.current = session;
    return session;
  };

  SES.current = function (state) { return state.current; };

  SES.item = function (session) {
    if (!session || session.done) return null;
    return session.items[session.idx] || null;
  };

  SES.progress = function (session) {
    if (!session) return { idx: 0, total: 0, pct: 0 };
    var total = session.items.length || 1;
    return {
      idx: Math.min(session.idx, total),
      total: session.items.length,
      pct: Math.round((Math.min(session.idx, total) / total) * 100)
    };
  };

  /** Introduce a word: create its cards and record the word. */
  SES.introduce = function (state, term, chapter, now) {
    now = now || Date.now();
    if (state.words[term]) return state.words[term];
    state.words[term] = {
      w: term,
      lesson: chapter,
      deck: 'recap',
      introducedAt: now,
      status: 'learning',
      seen: 0,
      correct: 0,
      lapses: 0,
      lastSeen: 0
    };
    NJ.SRS.ensureCards(state, term, { now: now, recap: true });
    NJ.S.bumpDay(state, { newWords: 1 });
    return state.words[term];
  };

  /**
   * Record the result of the current item and advance.
   * @param {boolean} correct  objective grading only
   * @param {object}  extra    { typed, expected } for production/dictation logging
   */
  SES.grade = function (state, correct, extra) {
    var session = state.current;
    if (!session || session.done) return null;
    var item = session.items[session.idx];
    if (!item) return null;
    var now = Date.now();
    correct = !!correct;

    var result = {
      kind: item.kind,
      term: item.term || null,
      skill: item.skill || null,
      correct: correct,
      at: now
    };
    if (extra && extra.typed != null) result.typed = String(extra.typed).slice(0, 200);

    if (item.kind === SES.KIND.NEW) {
      SES.introduce(state, item.term, item.chapter, now);
      result.correct = true;
      session.results.push(result);
      session.idx++;
      return { advanced: true, result: result, card: null };
    }

    if (item.kind === SES.KIND.REVIEW) {
      var key = item.key || NJ.SRS.key(item.term, item.skill);
      var card = state.cards[key];
      if (!card) {
        card = NJ.SRS.newCard(item.term, item.skill, { now: now });
        state.cards[key] = card;
      }
      NJ.SRS.grade(card, correct, now);

      var word = state.words[item.term];
      if (!word) {
        word = SES.introduce(state, item.term, item.chapter || 1, now);
      }
      word.seen = (word.seen || 0) + 1;
      word.lastSeen = now;
      if (correct) word.correct = (word.correct || 0) + 1;
      else word.lapses = (word.lapses || 0) + 1;

      var skills = state.skillStats[item.skill] || (state.skillStats[item.skill] = { seen: 0, correct: 0 });
      skills.seen++;
      if (correct) skills.correct++;

      NJ.S.bumpDay(state, {
        reviews: 1,
        total: 1,
        correct: correct ? 1 : 0
      });

      result.next = card.due;
      result.interval = card.interval;
      session.results.push(result);
      session.idx++;
      return { advanced: true, result: result, card: card };
    }

    // Dictation: records effort, does not schedule a card.
    NJ.S.bumpDay(state, { total: 1, correct: correct ? 1 : 0 });
    session.results.push(result);
    session.idx++;
    return { advanced: true, result: result, card: null };
  };

  SES.finished = function (session) {
    return !!session && session.idx >= session.items.length;
  };

  /** Close out a session and write the history row. */
  SES.finish = function (state) {
    var session = state.current;
    if (!session) return null;
    if (session.done) return session;

    var correct = 0;
    var total = 0;
    session.results.forEach(function (r) {
      if (r.kind === SES.KIND.NEW) return;
      total++;
      if (r.correct) correct++;
    });

    var graded = session.results.filter(function (r) { return r.kind === NJ.SESSION.KIND.REVIEW; }).length;
    var minutes = Math.max(1, Math.round((Date.now() - session.startedAt) / 60000));

    session.done = true;
    session.finishedAt = Date.now();
    session.summary = {
      graded: graded,
      correct: correct,
      total: total,
      minutes: minutes,
      accuracy: total ? Math.round((correct / total) * 100) : 0
    };

    state.sessions.push({
      id: session.id,
      date: session.date,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      graded: graded,
      correct: correct,
      total: total,
      minutes: minutes
    });
    if (state.sessions.length > 400) state.sessions = state.sessions.slice(-400);

    NJ.S.bumpDay(state, { minutes: minutes, sessions: 1 });
    return session;
  };

  /** Dictation acceptance: near-exact, with a small tolerance for a typo. */
  SES.dictationVerdict = function (typed, expected) {
    var a = NJ.L.normAnswer(typed);
    var b = NJ.L.normAnswer(expected);
    var len = Array.from(b).length;
    if (!a) return { correct: false, distance: len, exact: false, tolerance: 0 };
    if (a === b) return { correct: true, distance: 0, exact: true, tolerance: 0 };
    // Substitutions count as one edit: a mistyped character is one slip.
    var distance = NJ.U.editDistance(b, a);
    var tolerance = Math.max(1, Math.floor(len / 10));
    return { correct: distance <= tolerance, distance: distance, exact: false, tolerance: tolerance };
  };
})(typeof window !== 'undefined' ? window : globalThis);
