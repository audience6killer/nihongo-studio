/* exam.js — practice checkpoints in JLPT shape.
 *
 * JLPT has no writing or speaking section, so neither does this. A checkpoint
 * samples the same skills as the daily session at exam section boundaries:
 *   文字・語彙 (script & vocabulary) · 文法・読解 (grammar & reading) · 聴解 (listening)
 *
 * It is a practice instrument over the words the learner has actually met, not
 * an official paper and not a prediction of a pass.
 */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var EXAM = (NJ.EXAM = {});

  var U = NJ.U;

  EXAM.SECTIONS = [
    { id: 'vocab', l2: '文字・語彙', label: 'Kanji & vocabulary' },
    { id: 'langread', l2: '文法・読解', label: 'Grammar & reading' },
    { id: 'listen', l2: '聴解', label: 'Listening' }
  ];

  EXAM.MIN_WORDS = 12;
  EXAM.SECONDS_PER_ITEM = 70;
  EXAM.MIN_MINUTES = 8;

  function mcq(correct, distractors) {
    var options = U.shuffle([correct].concat(distractors), Math.random);
    return { options: options, answer: options.indexOf(correct) };
  }

  function studiedTerms(state) {
    var studied = [];
    NJ.D.chapters().forEach(function (ch) {
      NJ.D.chapterTerms(ch).forEach(function (t) {
        if (state.words[t]) studied.push(t);
      });
    });
    return studied;
  }

  function vocabItems(state, count) {
    var terms = studiedTerms(state);
    if (!terms.length) return [];
    var items = [];
    var half = Math.ceil(count / 2);
    var readingTerms = U.sample(terms, Math.min(half, terms.length), Math.random);
    readingTerms.forEach(function (t) {
      var w = NJ.D.word(t);
      if (!w || !w.reading) return;
      var m = mcq(w.reading, NJ.D.distractorReadings(w, 3));
      items.push({
        kind: 'reading', section: 'vocab', term: t, chapter: w.lesson,
        prompt_l2: 'この言葉はどう読みますか。',
        options: m.options, answer: m.answer, lang: 'ja'
      });
    });
    var meaningTerms = U.sample(terms, Math.min(count - items.length, terms.length), Math.random);
    meaningTerms.forEach(function (t) {
      var w = NJ.D.word(t);
      if (!w) return;
      var m = mcq(w.gloss, NJ.D.distractorGlosses(w, 3));
      items.push({
        kind: 'meaning', section: 'vocab', term: t, chapter: w.lesson,
        prompt_l2: 'この言葉の意味はどれですか。',
        options: m.options, answer: m.answer, lang: 'en'
      });
    });
    return items;
  }

  function grammarItems(count) {
    var pool = [];
    NJ.D.chapters().forEach(function (ch) {
      var les = NJ.D.lesson(ch);
      ((les && les.grammar && les.grammar.drills) || []).forEach(function (d, i) {
        pool.push({
          kind: 'grammar', section: 'langread', chapter: ch,
          prompt_l2: d.q_l2, options: d.options_l2.slice(), answer: d.answer,
          explain_l1: d.explain_l1, lang: 'ja'
        });
      });
    });
    return U.sample(pool, count, Math.random);
  }

  function readingItems(count) {
    var pool = [];
    NJ.D.chapters().forEach(function (ch) {
      var les = NJ.D.lesson(ch);
      var r = les && les.reading;
      if (!r) return;
      (r.questions || []).forEach(function (q, i) {
        pool.push({
          kind: 'comprehension', section: 'langread', chapter: ch,
          passage_l2: r.text_l2,
          prompt_l2: q.q_l2,
          options: q.options_l2.slice(), answer: q.answer,
          explain_l1: q.explain_l1, lang: 'ja'
        });
      });
    });
    return U.sample(pool, count, Math.random);
  }

  function listeningItems(state, count, hasAudio) {
    if (!hasAudio) return [];
    var sentences = [];
    NJ.D.chapters().forEach(function (ch) {
      var les = NJ.D.lesson(ch);
      ((les && les.listening && les.listening.dictation) || []).forEach(function (d) {
        sentences.push({ l2: d.l2, l1: d.l1, chapter: ch });
      });
    });
    if (sentences.length < 4) return [];
    var picked = U.sample(sentences, Math.min(count, sentences.length - 1), Math.random);
    return picked.map(function (s) {
      var others = sentences.filter(function (x) { return x.l1 !== s.l1; })
        .map(function (x) { return x.l1; });
      var m = mcq(s.l1, U.sample(others, 3, Math.random));
      return {
        kind: 'listen', section: 'listen', chapter: s.chapter,
        play_l2: s.l2, prompt_l2: '聞いて、意味を選んでください。',
        options: m.options, answer: m.answer, explain_l1: s.l2 + ' — ' + s.l1, lang: 'en'
      };
    });
  }

  /**
   * Build a checkpoint from the content the learner has met.
   * Returns null when there is not enough studied vocabulary to be meaningful.
   */
  EXAM.build = function (state, opts) {
    var o = opts || {};
    var hasAudio = o.hasAudio !== false;
    if (studiedTerms(state).length < EXAM.MIN_WORDS) return null;

    var perChapter = NJ.D.chapters().length;
    var vocab = vocabItems(state, perChapter >= 3 ? 14 : 10);
    var grammar = grammarItems(perChapter >= 3 ? 6 : 2);
    var reading = readingItems(perChapter >= 3 ? 4 : 2);
    var listen = listeningItems(state, perChapter >= 3 ? 5 : 3, hasAudio);

    var items = vocab.concat(grammar, reading, listen);
    if (items.length < 6) return null;

    var minutes = Math.max(EXAM.MIN_MINUTES, Math.round((items.length * EXAM.SECONDS_PER_ITEM) / 60));

    var counts = {};
    items.forEach(function (it) { counts[it.section] = (counts[it.section] || 0) + 1; });

    return {
      id: 'e' + Date.now().toString(36),
      startedAt: Date.now(),
      minutes: minutes,
      totalSeconds: minutes * 60,
      items: items,
      sections: EXAM.SECTIONS.filter(function (s) { return counts[s.id]; }).map(function (s) {
        return { id: s.id, l2: s.l2, label: s.label, count: counts[s.id] };
      }),
      idx: 0,
      results: [],
      done: false,
      hasAudio: hasAudio
    };
  };

  EXAM.current = function (exam) {
    if (!exam || exam.done) return null;
    return exam.items[exam.idx] || null;
  };

  EXAM.progress = function (exam) {
    if (!exam) return { idx: 0, total: 0, pct: 0 };
    var total = exam.items.length || 1;
    return { idx: Math.min(exam.idx, total), total: exam.items.length, pct: Math.round((Math.min(exam.idx, total) / total) * 100) };
  };

  EXAM.secondsLeft = function (exam, now) {
    if (!exam) return 0;
    var elapsed = ((now == null ? Date.now() : now) - exam.startedAt) / 1000;
    return Math.max(0, Math.round(exam.totalSeconds - elapsed));
  };

  /** Record an answer and advance. Answers are not revealed until the report. */
  EXAM.answer = function (exam, picked) {
    var item = EXAM.current(exam);
    if (!item) return { complete: true };
    exam.results.push({
      section: item.section,
      kind: item.kind,
      term: item.term || null,
      chapter: item.chapter || null,
      picked: Number(picked),
      answer: item.answer,
      correct: Number(picked) === item.answer
    });
    exam.idx++;
    return { complete: exam.idx >= exam.items.length };
  };

  EXAM.skip = function (exam) {
    var item = EXAM.current(exam);
    if (!item) return { complete: true };
    exam.results.push({
      section: item.section, kind: item.kind, term: item.term || null,
      chapter: item.chapter || null, picked: -1, answer: item.answer, correct: false
    });
    exam.idx++;
    return { complete: exam.idx >= exam.items.length };
  };

  EXAM.finish = function (state) {
    var exam = state.currentExam;
    if (!exam || exam.done) return exam;

    var bySection = {};
    EXAM.SECTIONS.forEach(function (s) { bySection[s.id] = { seen: 0, correct: 0, pct: 0 }; });
    var correct = 0;
    exam.results.forEach(function (r) {
      var row = bySection[r.section];
      if (!row) return;
      row.seen++;
      if (r.correct) { row.correct++; correct++; }
    });
    Object.keys(bySection).forEach(function (k) {
      var row = bySection[k];
      row.pct = row.seen ? Math.round((row.correct / row.seen) * 100) : 0;
    });

    exam.done = true;
    exam.finishedAt = Date.now();
    exam.report = {
      correct: correct,
      total: exam.results.length,
      pct: exam.results.length ? Math.round((correct / exam.results.length) * 100) : 0,
      bySection: bySection,
      minutes: Math.max(1, Math.round((exam.finishedAt - exam.startedAt) / 60000))
    };

    state.exams = state.exams || [];
    state.exams.push({
      id: exam.id,
      at: exam.finishedAt,
      pct: exam.report.pct,
      correct: correct,
      total: exam.report.total,
      minutes: exam.report.minutes,
      bySection: bySection
    });
    if (state.exams.length > 50) state.exams = state.exams.slice(-50);
    return exam;
  };

  /** Is there enough material for a checkpoint right now? */
  EXAM.available = function (state) {
    return studiedTerms(state).length >= EXAM.MIN_WORDS;
  };
})(typeof window !== 'undefined' ? window : globalThis);
