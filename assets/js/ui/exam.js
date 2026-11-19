/* exam.js (screen) — a timed practice checkpoint in JLPT shape. */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var UI = (NJ.UI = NJ.UI || {});
  UI.screens = UI.screens || {};
  UI.actions = UI.actions || {};
  var U = NJ.U;

  var view = { clockTimer: null, played: {} };

  function st() { return NJ.S.state(); }

  function stopClock() {
    if (view.clockTimer) { clearInterval(view.clockTimer); view.clockTimer = null; }
  }

  function renderIntro(s) {
    var available = NJ.EXAM.available(s);
    var studied = Object.keys(s.words || {}).length;
    var blocks = NJ.EXAM.blocks();

    var html = '<div class="page-head"><h1>Checkpoints</h1>' +
      '<p class="sub">Sampled tests in JLPT shape. Practice instruments, not official papers.</p></div>';

    if (blocks.length) {
      html += '<div class="card"><h2>Scheduled</h2>' +
        '<p class="small" style="color:var(--ink-3);margin:0 0 .8rem">' +
          'Each block unlocks once 60% of its words have been met, and covers everything up to that point.</p>' +
        '<div class="rows">';
      blocks.forEach(function (block) {
        var status = NJ.EXAM.blockStatus(s, block);
        var prog = NJ.EXAM.blockProgress(s, block);
        var pill = status === 'done' ? '<span class="pill pill--done">done</span>'
          : status === 'available' ? '<span class="pill pill--rec">ready</span>'
          : '<span class="pill pill--muted">locked</span>';
        html += '<div class="row-item" style="cursor:default">' +
          '<span class="grow">' +
            '<strong>' + UI.esc(block.label) + '</strong>' +
            '<span class="meta">' + prog.introduced + ' / ' + prog.total + ' words met · ' + prog.pct + '%</span>' +
          '</span>' + pill +
          (status === 'available'
            ? '<button type="button" class="btn btn--primary btn--sm" data-act="exam-start-block" data-block="' +
              UI.esc(block.id) + '">Start</button>'
            : status === 'done'
              ? '<button type="button" class="btn btn--ghost btn--sm" data-act="exam-start-block" data-block="' +
                UI.esc(block.id) + '">Retake</button>'
              : '') +
        '</div>';
      });
      html += '</div></div>';
    }

    html += '<div class="card card--accent">' +
      '<h2>' + (available ? 'Practice checkpoint' : 'Not enough words yet') + '</h2>' +
      (available
        ? '<p>A short mixed test over everything you have met, in three sections:</p>' +
          '<ul class="small" style="color:var(--ink-2);padding-left:1.1rem;margin:0 0 .9rem">' +
            '<li><strong lang="ja">文字・語彙</strong> — readings and meanings</li>' +
            '<li><strong lang="ja">文法・読解</strong> — grammar in context and a reading passage</li>' +
            '<li><strong lang="ja">聴解</strong> — listening, when a Japanese voice is available</li>' +
          '</ul>' +
          '<div class="btn-row"><button type="button" class="btn btn--ghost" data-act="exam-start">Start practice checkpoint</button></div>'
        : '<p>You have met <strong>' + studied + '</strong> words. A checkpoint needs at least ' +
          NJ.EXAM.MIN_WORDS + ', so that the result means something.</p>' +
          '<div class="btn-row"><a class="btn btn--ghost" href="#/session" data-act="go" data-to="#/session">Study a session</a></div>') +
    '</div>';

    html += '<div class="card card--flat">' +
      '<h3>What this is not</h3>' +
      '<ul class="small" style="color:var(--ink-3);padding-left:1.1rem;margin:0">' +
        '<li>Not an official JLPT paper, and not a prediction of a pass.</li>' +
        '<li>No writing and no speaking section — JLPT has none either.</li>' +
        '<li>The sections are shorter than the real exam, on purpose.</li>' +
      '</ul>' +
    '</div>';
    return html;
  }

  function renderReport(exam, s) {
    var rep = exam.report || { correct: 0, total: 0, pct: 0, bySection: {}, minutes: 0 };
    var html = '<div class="page-head"><h1>Checkpoint report</h1>' +
      '<p class="sub">' + rep.correct + ' / ' + rep.total + ' · ' + rep.pct + '% · ' + rep.minutes + ' min</p></div>';

    html += '<div class="card card--accent">' +
      '<div class="grid grid-3">' +
        UI.stat(rep.pct + '%', 'overall') +
        UI.stat(rep.correct, 'correct') +
        UI.stat(rep.minutes + ' min', 'time taken') +
      '</div></div>';

    html += '<div class="card"><h3>By section</h3>';
    (exam.sections || []).forEach(function (sec) {
      var row = rep.bySection[sec.id] || { seen: 0, correct: 0, pct: 0 };
      html += '<dl class="kv"><dt><span lang="ja">' + UI.esc(sec.l2) + '</span> · ' +
        UI.esc(sec.label) + '</dt><dd>' + row.correct + '/' + row.seen +
        ' <span class="small" style="color:var(--ink-3)">(' + row.pct + '%)</span></dd></dl>';
    });
    html += '</div>';

    var wrong = [];
    (exam.results || []).forEach(function (r, i) {
      if (r.correct) return;
      var item = exam.items[i];
      if (item) wrong.push({ result: r, item: item });
    });

    if (wrong.length) {
      html += '<div class="card"><h3>What went wrong</h3>';
      wrong.slice(0, 20).forEach(function (w) {
        var it = w.item;
        html += '<div class="grammar-ex">';
        if (it.kind === 'reading' || it.kind === 'meaning') {
          var word = NJ.D.word(it.term) || { w: it.term, reading: '', gloss: '' };
          html += '<p lang="ja" class="ja" style="margin:0">' + UI.esc(word.w) +
            ' <span class="small" style="color:var(--ink-3)">' + UI.esc(word.reading) + '</span></p>' +
            '<p class="small" style="margin:.1rem 0 0">' + UI.esc(word.gloss) + '</p>';
        } else if (it.kind === 'listen') {
          html += '<p lang="ja" class="ja" style="margin:0">' + UI.esc(it.play_l2) + '</p>' +
            '<p class="small" style="margin:.1rem 0 0">' + UI.esc(it.explain_l1) + '</p>';
        } else {
          html += '<p lang="ja" class="ja" style="margin:0">' + UI.esc(it.prompt_l2) + '</p>' +
            '<p class="small" style="margin:.1rem 0 0">Answer: <span lang="ja">' +
              UI.esc(it.options[it.answer]) + '</span></p>' +
            (it.explain_l1 ? '<p class="small" style="color:var(--ink-3);margin:.1rem 0 0">' +
              UI.esc(it.explain_l1) + '</p>' : '');
        }
        html += '</div>';
      });
      html += '</div>';
    }

    html += '<div class="card"><p class="small" style="color:var(--ink-3);margin:0 0 .8rem">' +
      'A checkpoint samples skills; it does not grade the course. The daily queue is the thing that moves progress.</p>' +
      '<div class="btn-row">' +
        '<a class="btn btn--primary" href="#/today" data-act="go" data-to="#/today">Back to Today</a>' +
        '<button type="button" class="btn btn--ghost" data-act="exam-again">Take another</button>' +
      '</div></div>';
    void s;
    return html;
  }

  function renderItem(exam, item, s) {
    var p = NJ.EXAM.progress(exam);
    var sec = (exam.sections || []).filter(function (x) { return x.id === item.section; })[0] || { l2: '', label: '' };

    var html = '<div class="session-bar">' +
      '<div class="session-bar-row">' +
        '<span>' + p.idx + ' / ' + p.total + '</span>' +
        '<span class="pill" lang="ja">' + UI.esc(sec.l2) + '</span>' +
        '<span id="exam-clock" class="pill" style="margin-left:auto" aria-live="off">' + U.fmtClock(NJ.EXAM.secondsLeft(exam)) + '</span>' +
      '</div>' + UI.bar(p.pct) + '</div>';

    if (item.kind === 'comprehension') {
      html += '<div class="card card--flat">' + UI.passage(item.passage_l2, s) + '</div>';
    }
    if (item.kind === 'listen') {
      html += '<div class="card"><div style="text-align:center">' +
        '<button type="button" class="btn btn--primary" data-act="exam-play">▶ Play</button>' +
        '<button type="button" class="btn btn--quiet" data-act="exam-play-slow">Slower</button>' +
      '</div></div>';
    }

    var prompt = item.prompt_l2 || '';
    var staticWord = (item.kind === 'reading' || item.kind === 'meaning')
      ? NJ.D.word(item.term) : null;

    html += '<div class="card">';
    if (staticWord) {
      html += '<p class="pos" style="text-align:center;margin-bottom:.3rem">' +
        (item.kind === 'reading' ? 'How is this read?' : 'What does this mean?') + '</p>' +
        '<div class="ja-display" lang="ja">' +
          (item.kind === 'reading' ? UI.esc(staticWord.w) : UI.jpWord(staticWord.w, staticWord.reading, s)) +
        '</div>';
    } else if (prompt) {
      html += '<p lang="ja" class="ja" style="margin:0 0 .3rem">' + UI.tappable(prompt, s) + '</p>';
    }

    var japaneseOptions = item.lang === 'ja' && item.kind !== 'reading' && !staticWord;
    html += UI.options(
      japaneseOptions ? item.options.map(function (o) { return UI.tappable(o, s); }) : item.options,
      null, -1,
      { lang: item.lang || 'en', html: japaneseOptions }
    );
    html += '<div class="btn-row" style="margin-top:.9rem">' +
      '<button type="button" class="btn btn--quiet btn--sm" data-act="exam-skip">Skip</button>' +
      '<button type="button" class="btn btn--quiet btn--sm" style="margin-left:auto" data-act="exam-end">End and score</button>' +
    '</div></div>';
    return html;
  }

  UI.screens.exam = {
    render: function () {
      var s = st();
      var exam = s.currentExam;

      if (!exam) return renderIntro(s);
      if (exam.done) return renderReport(exam, s);

      var item = NJ.EXAM.current(exam);
      if (!item) { NJ.EXAM.finish(s); NJ.S.save(s); return renderReport(exam, s); }
      return renderItem(exam, item, s);
    },

    mount: function () {
      stopClock();
      var s = st();
      var exam = s.currentExam;
      if (!exam || exam.done) return;

      var clock = root.document.getElementById('exam-clock');
      if (!clock) return;

      view.clockTimer = setInterval(function () {
        var left = NJ.EXAM.secondsLeft(exam);
        if (clock && clock.textContent != null) clock.textContent = U.fmtClock(left);
        if (left <= 0) {
          stopClock();
          NJ.EXAM.finish(s);
          NJ.S.save(s);
          UI.toast('Time is up.');
          UI.render();
        }
      }, 1000);
    },

    unmount: stopClock
  };

  /* ---------------------------------------------------------------- actions */

  UI.actions['exam-start'] = function () {
    var s = st();
    var exam = NJ.EXAM.build(s, { hasAudio: NJ.TTS.hasVoice() });
    if (!exam) { UI.toast('Not enough studied words for a checkpoint yet.', 'warn'); return; }
    s.currentExam = exam;
    NJ.S.save(s);
    view.played = {};
    UI.render();
  };

  UI.actions['exam-start-block'] = function (ev, el) {
    var s = st();
    var blockId = el.getAttribute('data-block');
    var block = NJ.EXAM.blocks().filter(function (b) { return b.id === blockId; })[0];
    if (!block) { UI.toast('That checkpoint does not exist yet.', 'warn'); return; }
    var exam = NJ.EXAM.build(s, {
      hasAudio: NJ.TTS.hasVoice(),
      chapters: block.chapters,
      blockId: block.id
    });
    if (!exam) {
      UI.toast('Meet a few more of this block\'s words first.', 'warn');
      return;
    }
    s.currentExam = exam;
    NJ.S.save(s);
    view.played = {};
    UI.render();
  };

  UI.actions['exam-pick'] = function (ev, el) {
    var s = st();
    var exam = s.currentExam;
    if (!exam || exam.done) return;
    var res = NJ.EXAM.answer(exam, Number(el.getAttribute('data-i')));
    if (res.complete) NJ.EXAM.finish(s);
    NJ.S.save(s);
    UI.render();
  };

  UI.actions['exam-skip'] = function () {
    var s = st();
    var exam = s.currentExam;
    if (!exam || exam.done) return;
    var res = NJ.EXAM.skip(exam);
    if (res.complete) NJ.EXAM.finish(s);
    NJ.S.save(s);
    UI.render();
  };

  UI.actions['exam-end'] = function () {
    var s = st();
    var exam = s.currentExam;
    if (!exam || exam.done) return;
    UI.confirm('End and score now?', 'Unanswered items count as wrong.', function () {
      NJ.EXAM.finish(s);
      NJ.S.save(s);
      UI.render();
    }, 'End and score');
  };

  UI.actions['exam-again'] = function () {
    var s = st();
    s.currentExam = null;
    NJ.S.save(s);
    UI.render();
  };

  UI.actions['exam-play'] = function () {
    var s = st();
    var item = NJ.EXAM.current(s.currentExam);
    if (!item || !item.play_l2) return;
    UI.say(item.play_l2, s, {});
  };

  UI.actions['exam-play-slow'] = function () {
    var s = st();
    var item = NJ.EXAM.current(s.currentExam);
    if (!item || !item.play_l2) return;
    UI.say(item.play_l2, s, { rate: NJ.TTS.slowRate(s.settings.rate) });
  };
})(typeof window !== 'undefined' ? window : globalThis);
