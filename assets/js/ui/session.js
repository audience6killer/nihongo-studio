/* session.js — the screen that runs the day's queue.
 *
 * One item on screen at a time. Grading is objective: a multiple-choice pick, a
 * typed answer, or a dictation diff. Nothing asks the learner how it felt.
 */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var UI = (NJ.UI = NJ.UI || {});
  UI.screens = UI.screens || {};
  UI.actions = UI.actions || {};
  var U = NJ.U;

  /** Local view state for the current item. Reset when the item index moves. */
  var view = { idx: -1, done: null, typed: '', picked: null, played: false };

  function st() { return NJ.S.state(); }

  function session() { return st().current; }

  function resetFor(ix) {
    view.idx = ix;
    view.done = null;
    view.typed = '';
    view.picked = null;
    view.played = false;
  }

  function word(term) { return NJ.D.word(term) || { w: term, gloss: '', reading: '', pos: '' }; }

  function speak(term) {
    var s = st();
    UI.say(term, s, {});
  }

  /* ---------------------------------------------------------------- renders */

  function renderSummary(s, ses) {
    var sum = (ses && ses.summary) || { graded: 0, correct: 0, total: 0, minutes: 0, accuracy: 0 };
    var html = '<div class="page-head"><h1>Session complete</h1>' +
      '<p class="sub">' + (sum.minutes || 1) + ' minutes · ' + sum.accuracy + '% correct</p></div>';

    html += '<div class="card card--accent">' +
      '<div class="grid grid-3">' +
        UI.stat(sum.graded, 'graded') +
        UI.stat(sum.accuracy + '%', 'accuracy') +
        UI.stat(U.fmtMinutes(sum.minutes || 1), 'time') +
      '</div></div>';

    var due = NJ.SRS.countDue(s, { skills: NJ.TTS.hasVoice() ? NJ.SRS.SKILLS : ['rec', 'prod'] });
    html += '<div class="card">' +
      '<p>' + (due > 0 ? 'Another ' + due + ' card' + (due === 1 ? '' : 's') + ' came due while you were working.'
        : 'The queue is clear for now.') + '</p>' +
      '<div class="btn-row">' +
        '<a class="btn btn--primary" href="#/today" data-act="go" data-to="#/today">Back to Today</a>' +
        (due > 0 ? '<button type="button" class="btn btn--ghost" data-act="new-session">Keep going</button>' : '') +
      '</div>' +
    '</div>';

    html += '<div class="card card--quiet"><p class="small" style="color:var(--ink-3);margin:0">' +
      'Wrong answers come back in ten minutes. Correct answers move further out. ' +
      'That is the whole algorithm — no self-rating, no four buttons.</p></div>';
    return html;
  }

  function renderNewCard(item, s) {
    var w = word(item.term);
    var ex = NJ.D.exampleFor(item.term);
    var html = '<div class="card">' +
      '<p class="pos" style="text-align:center;margin-bottom:.2rem">New word · ' + UI.esc(w.pos || '') + '</p>' +
      '<div class="ja-display" lang="ja">' + UI.jpWord(w.w, w.reading, s) + '</div>' +
      (s.settings.furigana ? '' : '<div class="ja-reading" lang="ja">' + UI.esc(w.reading) + '</div>') +
      '<div class="gloss">' + UI.esc(w.gloss) + '</div>';

    if (ex) {
      html += '<hr>' +
        '<p lang="ja" class="ja" style="margin:0 0 .1rem">' + UI.tappable(ex.l2, s) + '</p>' +
        '<p class="small" style="color:var(--ink-3);margin:0">' + UI.esc(ex.l1) + '</p>';
    }

    html += '<div class="btn-row" style="margin-top:1rem">' +
      '<button type="button" class="btn btn--ghost" data-act="say" data-text="' + UI.esc(w.w) + '">Listen</button>' +
      (ex ? '<button type="button" class="btn btn--ghost" data-act="say" data-text="' + UI.esc(ex.l2) + '">Listen to the sentence</button>' : '') +
      '<button type="button" class="btn btn--primary" data-act="ack-new" style="margin-left:auto">Got it</button>' +
    '</div></div>';
    return html;
  }

  function feedbackBlock(ok, body) {
    return '<div class="feedback feedback--' + (ok ? 'ok' : 'no') + '">' +
      '<h4>' + (ok ? 'Correct' : 'Not this time') + '</h4>' + body + '</div>';
  }

  function renderReview(item, s, done) {
    var w = word(item.term);
    var html = '';
    var skill = item.skill;

    if (item.prompt === 'type') {
      if (!done) {
        html += '<div class="card">' +
          '<p class="pos" style="text-align:center;margin-bottom:.3rem">' + UI.esc(NJ.SRS.SKILL_LABEL[skill]) + '</p>' +
          '<div class="gloss" style="font-size:1.3rem">' + UI.esc(w.gloss) + '</div>' +
          '<p class="small" style="text-align:center;color:var(--ink-3);margin:.35rem 0 0">' +
            'Type the Japanese. Kanji or kana — kana counts if it reads the same.</p>' +
          '<form class="answer-form" data-act="submit-prod" novalidate>' +
            '<input class="answer-input" id="prod-input" type="text" lang="ja" autocomplete="off" ' +
              'autocapitalize="off" spellcheck="false" placeholder="日本語で入力" aria-label="Your answer">' +
            '<button type="submit" class="btn btn--primary">Check</button>' +
          '</form>' +
        '</div>';
        return html;
      }
      var ok = done.correct;
      html += '<div class="card">' +
        '<p class="pos" style="text-align:center;margin-bottom:.3rem">' + UI.esc(NJ.SRS.SKILL_LABEL[skill]) + '</p>' +
        '<div class="gloss" style="font-size:1.15rem">' + UI.esc(w.gloss) + '</div>' +
        '<hr>' +
        '<div class="answer-reveal" lang="ja">' + UI.jpWord(w.w, w.reading, s) + '</div>' +
        '<div class="ja-reading" lang="ja">' + UI.esc(w.reading) + '</div>' +
        feedbackBlock(ok,
          '<p style="margin:0">You typed <span lang="ja" class="ja">' + (done.typed ? UI.esc(done.typed) : '<em>nothing</em>') + '</span>.</p>') +
        '<div class="btn-row" style="margin-top:.8rem">' +
          '<button type="button" class="btn btn--ghost" data-act="say" data-text="' + UI.esc(w.w) + '">Listen</button>' +
          '<button type="button" class="btn btn--primary" data-act="next" style="margin-left:auto">Next</button>' +
        '</div></div>';
      return html;
    }

    // Recognition (meaning / reading) and listening.
    var head;
    if (item.prompt === 'listen') {
      head = '<p class="pos" style="text-align:center;margin-bottom:.4rem">Listening · what does it mean?</p>' +
        '<div style="text-align:center">' +
          '<button type="button" class="btn btn--primary" data-act="replay">▶ Play</button>' +
          '<button type="button" class="btn btn--quiet" data-act="replay-slow">Slower</button>' +
        '</div>';
      if (done) {
        head = '<p class="pos" style="text-align:center;margin-bottom:.4rem">Listening</p>' +
          '<div class="answer-reveal" style="text-align:center" lang="ja">' + UI.jpWord(w.w, w.reading, s) + '</div>' +
          '<div class="ja-reading" lang="ja">' + UI.esc(w.reading) + '</div>';
      }
    } else if (item.prompt === 'reading') {
      head = '<p class="pos" style="text-align:center;margin-bottom:.4rem">Recognition · how is it read?</p>' +
        '<div class="ja-display" lang="ja">' + UI.esc(w.w) + '</div>';
    } else {
      head = '<p class="pos" style="text-align:center;margin-bottom:.4rem">Recognition · what does it mean?</p>' +
        '<div class="ja-display" lang="ja">' + UI.jpWord(w.w, w.reading, s) + '</div>' +
        '<div style="text-align:center;margin-top:.2rem">' +
          '<button type="button" class="btn btn--quiet btn--sm" data-act="say" data-text="' + UI.esc(w.w) + '">Listen</button>' +
        '</div>';
    }

    var optsLang = item.prompt === 'reading' ? 'ja' : 'en';
    var picked = done ? done.picked : null;
    html += '<div class="card">' + head +
      UI.options(item.options || [], picked, item.answer, { lang: optsLang, hideTruth: !done }) +
      (done ? feedbackBlock(done.correct, done.correct
        ? '<p style="margin:0">' + UI.esc(w.gloss) + ' · <span lang="ja">' + UI.esc(w.reading) + '</span></p>'
        : '<p style="margin:0">The answer is <strong lang="ja">' + UI.esc(item.options[item.answer]) +
          '</strong>.</p>') +
        '<div class="btn-row" style="margin-top:.8rem">' +
          '<button type="button" class="btn btn--primary" data-act="next" style="margin-left:auto">Next</button>' +
        '</div>' : '') +
    '</div>';
    return html;
  }

  function renderDictation(item, s, done) {
    var sent = item.sentence;
    var html = '<div class="card">' +
      '<p class="pos" style="text-align:center;margin-bottom:.4rem">Dictation</p>' +
      '<div style="text-align:center">' +
        '<button type="button" class="btn btn--primary" data-act="replay-dictation">▶ Play</button>' +
        '<button type="button" class="btn btn--quiet" data-act="replay-dictation-slow">Slower</button>' +
      '</div>';

    if (!done) {
      html += '<form class="answer-form" data-act="submit-dictation" novalidate style="margin-top:1rem">' +
        '<input class="answer-input" id="dict-input" type="text" lang="ja" autocomplete="off" ' +
          'autocapitalize="off" spellcheck="false" placeholder="聞こえたとおりに入力" aria-label="What you heard">' +
        '<button type="submit" class="btn btn--primary">Check</button>' +
      '</form>' +
      '<p class="small" style="color:var(--ink-3);margin:.6rem 0 0">Type what you hear. Punctuation is optional; one slip is forgiven.</p>';
      return html + '</div>';
    }

    var segs = U.diffChars(sent.l2, done.typed || '');
    var rendered = segs.map(function (seg) {
      if (seg.op === 'same') return UI.esc(seg.text);
      if (seg.op === 'del') return '<del lang="ja">' + UI.esc(seg.text) + '</del>';
      return '<ins lang="ja">' + UI.esc(seg.text) + '</ins>';
    }).join('');

    html += '<div style="margin-top:1rem">' +
      '<p class="small" style="color:var(--ink-3);margin:0 0 .2rem">Expected</p>' +
      '<p class="ja diff" lang="ja" style="font-size:1.1rem;margin:0">' + rendered + '</p>' +
      '<p class="small" style="color:var(--ink-3);margin:.5rem 0 .2rem">Meaning</p>' +
      '<p style="margin:0">' + UI.esc(sent.l1) + '</p>' +
      feedbackBlock(done.correct,
        '<p style="margin:0">' + (done.exact ? 'Exactly right.' :
          'Accepted with ' + done.distance + ' character' + (done.distance === 1 ? '' : 's') + ' off.') + '</p>') +
      '<div class="btn-row" style="margin-top:.8rem">' +
        '<button type="button" class="btn btn--ghost" data-act="say" data-text="' + UI.esc(sent.l2) + '">Listen again</button>' +
        '<button type="button" class="btn btn--primary" data-act="next" style="margin-left:auto">Next</button>' +
      '</div>' +
    '</div></div>';
    return html;
  }

  function renderItem(item, s, done) {
    if (item.kind === NJ.SESSION.KIND.NEW) return renderNewCard(item, s);
    if (item.kind === NJ.SESSION.KIND.DICTATION) return renderDictation(item, s, done);
    return renderReview(item, s, done);
  }

  /* ------------------------------------------------------------------ screen */

  UI.screens.session = {
    render: function () {
      var s = st();
      var ses = s.current;

      if (!ses) {
        return '<div class="page-head"><h1>No session yet</h1></div>' +
          '<div class="card"><p>Start today\'s session from the Today screen.</p>' +
          '<a class="btn btn--primary" href="#/today" data-act="go" data-to="#/today">Go to Today</a></div>';
      }

      // Show the last item's feedback before the summary; never swallow it.
      if ((ses.done || NJ.SESSION.finished(ses)) && !view.done) {
        if (!ses.done) NJ.SESSION.finish(s);
        NJ.S.save(s);
        return renderSummary(s, ses);
      }

      if (view.idx !== ses.idx) resetFor(ses.idx);

      var item = ses.items[ses.idx];
      if (!item) return renderSummary(s, ses);

      var p = NJ.SESSION.progress(ses);
      var label = item.kind === NJ.SESSION.KIND.NEW ? 'New word'
        : item.kind === NJ.SESSION.KIND.DICTATION ? 'Dictation'
        : (NJ.SRS.SKILL_LABEL[item.skill] || 'Review');

      return '<div class="session-bar">' +
          '<div class="session-bar-row">' +
            '<span>' + p.idx + ' / ' + p.total + '</span>' +
            '<span class="pill">' + UI.esc(label) + '</span>' +
            '<button type="button" class="btn btn--quiet btn--sm" style="margin-left:auto" data-act="end-session">End</button>' +
          '</div>' +
          UI.bar((p.idx / Math.max(1, p.total)) * 100) +
        '</div>' +
        renderItem(item, s, view.done);
    },

    mount: function () {
      var s = st();
      var ses = s.current;
      var field = root.document.getElementById('prod-input') || root.document.getElementById('dict-input');
      if (field && !view.done) {
        // Only steal focus when the learner is already on a typing card.
        if (root.innerWidth > 640) { try { field.focus(); } catch (e) { /* ignore */ } }
      }
      if (!ses || ses.done || NJ.SESSION.finished(ses) || view.done || view.played) return;
      var item = ses.items[ses.idx];
      if (!item) return;
      view.played = true;
      if (item.kind === NJ.SESSION.KIND.DICTATION) {
        UI.say(item.sentence.l2, s, {});
      } else if (item.kind === NJ.SESSION.KIND.REVIEW && item.skill === 'listen') {
        UI.say(item.term, s, {});
      }
    },

    onKey: function (ev) {
      var ses = session();
      if (!ses || ses.done) return false;
      if (ev.target && /^(INPUT|TEXTAREA)$/.test(ev.target.tagName)) {
        return false; // let the form handle Enter
      }
      if (view.done) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); UI.actions['next'](); return true; }
        return false;
      }
      if (/^[1-4]$/.test(ev.key)) {
        var i = Number(ev.key) - 1;
        var btns = root.document.querySelectorAll('.option[data-act="pick"]');
        if (btns[i]) { btns[i].click(); return true; }
      }
      if (ev.key === ' ') {
        var item = ses.items[ses.idx];
        if (item && (item.skill === 'listen' || item.kind === NJ.SESSION.KIND.DICTATION)) {
          ev.preventDefault();
          UI.say(item.kind === NJ.SESSION.KIND.DICTATION ? item.sentence.l2 : item.term, st(), {});
          return true;
        }
      }
      return false;
    }
  };

  /* ---------------------------------------------------------------- actions */

  UI.actions['new-session'] = function () {
    var s = st();
    NJ.SESSION.start(s, { hasAudio: NJ.TTS.hasVoice(), force: true });
    NJ.S.save(s);
    resetFor(s.current.idx);
    UI.render();
  };

  UI.actions['ack-new'] = function () {
    var s = st();
    NJ.SESSION.grade(s, true);
    NJ.S.save(s);
    view.typed = '';
    view.done = null;
    UI.render();
  };

  UI.actions['pick'] = function (ev, el) {
    if (view.done) return;
    var s = st();
    var ses = s.current;
    var item = ses.items[ses.idx];
    var i = Number(el.getAttribute('data-i'));
    var correct = i === item.answer;
    var res = NJ.SESSION.grade(s, correct);
    NJ.S.save(s);
    view.done = {
      item: item,
      correct: correct,
      picked: i,
      result: res && res.result
    };
    if (correct) UI.toast('Correct');
    UI.render();
  };

  UI.actions['next'] = function () {
    view.done = null;
    view.typed = '';
    view.picked = null;
    view.played = false;
    UI.render();
  };

  UI.actions['replay'] = function () {
    var s = st();
    var item = s.current.items[s.current.idx];
    UI.say(item.term, s, {});
  };

  UI.actions['replay-slow'] = function () {
    var s = st();
    var item = s.current.items[s.current.idx];
    UI.say(item.term, s, { rate: NJ.TTS.slowRate(s.settings.rate) });
  };

  UI.actions['replay-dictation'] = function () {
    var s = st();
    var item = s.current.items[s.current.idx];
    UI.say(item.sentence.l2, s, {});
  };

  UI.actions['replay-dictation-slow'] = function () {
    var s = st();
    var item = s.current.items[s.current.idx];
    UI.say(item.sentence.l2, s, { rate: NJ.TTS.slowRate(s.settings.rate) });
  };

  function handleSubmit(ev, el) {
    ev.preventDefault();
    var s = st();
    var ses = s.current;
    if (!ses || view.done) return;
    var item = ses.items[ses.idx];
    var input = el.querySelector('input');
    var typed = input ? input.value : '';

    if (item.kind === NJ.SESSION.KIND.DICTATION) {
      var verdict = NJ.SESSION.dictationVerdict(typed, item.sentence.l2);
      NJ.SESSION.grade(s, verdict.correct, { typed: typed });
      NJ.S.save(s);
      view.done = {
        item: item, correct: verdict.correct, typed: typed, exact: verdict.exact, distance: verdict.distance
      };
      UI.render();
      return;
    }

    var w = word(item.term);
    var correct = NJ.L.sameAnswer(typed, w);
    NJ.SESSION.grade(s, correct, { typed: typed });
    NJ.S.save(s);
    view.done = { item: item, correct: correct, typed: typed };
    UI.render();
  }

  UI.actions['submit-prod'] = handleSubmit;
  UI.actions['submit-dictation'] = handleSubmit;

  UI.actions['end-session'] = function () {
    UI.confirm('End this session?', 'Items you have already answered are saved. The rest stay due.', function () {
      var s = st();
      NJ.SESSION.finish(s);
      NJ.S.save(s);
      UI.render();
    }, 'End session');
  };
})(typeof window !== 'undefined' ? window : globalThis);
