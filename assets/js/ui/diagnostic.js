/* diagnostic.js (screen) — the calibration run and its report. */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var UI = (NJ.UI = NJ.UI || {});
  UI.screens = UI.screens || {};
  UI.actions = UI.actions || {};
  var U = NJ.U;

  var view = { picked: null, interstitial: null };

  function st() { return NJ.S.state(); }

  function renderIntro(s) {
    var words = NJ.D.words().length;
    return '<div class="page-head"><h1>Calibration</h1>' +
      '<p class="sub">About eight minutes. It sets your starting point; it is not a test.</p></div>' +

      '<div class="card card--accent">' +
        '<p>You have finished Tobira, so some of this vocabulary is still solid and some of it has gone. ' +
        'Re-learning the solid part would waste a month.</p>' +
        '<p>A short adaptive check finds the difference:</p>' +
        '<ul class="small" style="color:var(--ink-2);padding-left:1.1rem;margin:0 0 .9rem">' +
          '<li>14 items across the chapters — meaning and reading.</li>' +
          '<li>If you do well, five harder words and two grammar items follow.</li>' +
          '<li>Words you own get pushed far out; words you miss join a refresh deck.</li>' +
        '</ul>' +
        '<div class="btn-row">' +
          '<button type="button" class="btn btn--primary" data-act="diag-start">Start calibration</button>' +
          '<button type="button" class="btn btn--ghost" data-act="diag-skip">Skip for now</button>' +
        '</div>' +
        '<p class="small" style="color:var(--ink-3);margin:.9rem 0 0">' +
          'Skipping is fine: everything simply starts from the front of the deck. ' +
          'There ' + (words === 1 ? 'is' : 'are') + ' ' + words + ' words in the course so far.' +
        '</p>' +
      '</div>';
  }

  function renderItem(run, item, s) {
    var p = NJ.DIAG.progress(run);
    var html = '<div class="session-bar">' +
      '<div class="session-bar-row">' +
        '<span>' + UI.esc(p.label) + ' · ' + p.done + ' / ' + p.total + '</span>' +
        '<span class="pill">' + (item.kind === 'grammar' ? 'Grammar' : item.kind === 'reading' ? 'Reading' : 'Meaning') + '</span>' +
        '<button type="button" class="btn btn--quiet btn--sm" style="margin-left:auto" data-act="diag-abandon">Stop</button>' +
      '</div>' + UI.bar(p.pct) + '</div>';

    if (item.kind === 'grammar') {
      html += '<div class="card">' +
        '<p lang="ja" class="ja" style="margin:0 0 .3rem">' + UI.tappable(item.q_l2, s) + '</p>' +
        UI.options(item.options.map(function (o) { return UI.tappable(o, s); }), null, -1,
          { lang: 'ja', html: true }) +
      '</div>';
      return html;
    }

    var w = NJ.D.word(item.term) || { w: item.term, reading: '', gloss: '' };
    if (item.kind === 'reading') {
      html += '<div class="card">' +
        '<p class="pos" style="text-align:center;margin-bottom:.3rem">How is this read?</p>' +
        '<div class="ja-display" lang="ja">' + UI.esc(w.w) + '</div>' +
        UI.options(item.options, null, -1, { lang: 'ja' }) +
      '</div>';
      return html;
    }

    html += '<div class="card">' +
      '<p class="pos" style="text-align:center;margin-bottom:.3rem">What does this mean?</p>' +
      '<div class="ja-display" lang="ja">' + UI.jpWord(w.w, w.reading, s) + '</div>' +
      UI.options(item.options, null, -1, { lang: 'en' }) +
    '</div>';
    return html;
  }

  function renderReport(run, s) {
    if (run.skipped) {
      return '<div class="page-head"><h1>Calibration skipped</h1></div>' +
        '<div class="card"><p>Everything starts from the front of the deck. ' +
        'You can run calibration later from Settings.</p>' +
        '<a class="btn btn--primary" href="#/today" data-act="go" data-to="#/today">Back to Today</a></div>';
    }

    var chapters = Object.keys(run.byChapter || {}).map(Number).sort(function (a, b) { return a - b; });
    var html = '<div class="page-head"><h1>Starting point</h1>' +
      '<p class="sub">' + run.accuracy + '% on ' + run.results.length + ' items · ' +
      (run.strong ? 'stage B unlocked' : 'stage B kept to basics') + '</p></div>';

    html += '<div class="card card--accent"><div class="grid grid-3">' +
      UI.stat(run.seeded.length, 'already solid') +
      UI.stat(run.refreshed.length, 'to refresh') +
      UI.stat(run.accuracy + '%', 'accuracy') +
    '</div></div>';

    html += '<div class="card"><h3>By chapter</h3>' +
      '<dl class="kv"><dt>Stage A</dt><dd>' + (run.stageAPct == null ? '—' : run.stageAPct + '%') + '</dd></dl>';
    chapters.forEach(function (ch) {
      var row = run.byChapter[ch];
      html += '<dl class="kv"><dt>Chapter ' + ch + '</dt><dd>' + row.pct + '% <span class="small" style="color:var(--ink-3)">(' +
        row.correct + '/' + row.seen + ')</span></dd></dl>';
    });
    html += '</div>';

    if (run.refreshed.length) {
      html += '<div class="card"><h3>Refresh deck</h3>' +
        '<p class="small" style="color:var(--ink-3);margin:0 0 .5rem">' +
          'These came back wrong. They are scheduled now and mixed into the next sessions.</p>' +
        '<p lang="ja" class="ja" style="margin:0">' + run.refreshed.map(function (term) {
          var w = NJ.D.word(term);
          return '<span class="pill" style="margin:0 .25rem .3rem 0">' + UI.esc(w ? w.w : term) + '</span>';
        }).join('') + '</p></div>';
    }

    if (run.seeded.length) {
      html += '<div class="card card--flat"><h3>Already solid</h3>' +
        '<p class="small" style="color:var(--ink-3);margin:0 0 .5rem">' +
          'Recognition pushed out 21 days. Production is tested soon, because recognising a word is not producing it.</p>' +
        '<p lang="ja" class="ja" style="margin:0">' + run.seeded.map(function (term) {
          var w = NJ.D.word(term);
          return '<span class="pill pill--done" style="margin:0 .25rem .3rem 0">' + UI.esc(w ? w.w : term) + '</span>';
        }).join('') + '</p></div>';
    }

    html += '<div class="card"><div class="btn-row">' +
      '<a class="btn btn--primary" href="#/session" data-act="go" data-to="#/session">Start your first session</a>' +
      '<a class="btn btn--ghost" href="#/chapters" data-act="go" data-to="#/chapters">Look at chapter 1</a>' +
    '</div></div>';
    void s;
    return html;
  }

  UI.screens.calibrate = {
    render: function () {
      var s = st();
      var run = s.diagnostic;

      if (!run) return renderIntro(s);
      if (run.done) return renderReport(run, s);

      if (view.interstitial) {
        return '<div class="page-head"><h1>Stage B</h1></div>' +
          '<div class="card card--accent">' +
            '<p>' + (view.interstitial.strong
              ? 'Strong stage A. Five words from later chapters and two grammar items follow.'
              : 'Stage A was mixed. Five words from the earlier chapters and two grammar items follow, ' +
                'so the refresh deck starts where it should.') + '</p>' +
            '<button type="button" class="btn btn--primary" data-act="diag-continue">Continue</button>' +
          '</div>';
      }

      var item = NJ.DIAG.item(run);
      if (!item) return renderReport(run, s);
      return renderItem(run, item, s);
    }
  };

  /* ---------------------------------------------------------------- actions */

  UI.actions['diag-start'] = function () {
    var s = st();
    NJ.DIAG.start(s);
    NJ.S.save(s);
    view.interstitial = null;
    UI.render();
  };

  UI.actions['diag-skip'] = function () {
    var s = st();
    UI.confirm('Skip calibration?', 'Everything starts from the front of the deck. You can run it later from Settings.',
      function () {
        NJ.DIAG.skip(s);
        NJ.S.save(s);
        UI.render();
      }, 'Skip');
  };

  UI.actions['diag-abandon'] = function () {
    var s = st();
    UI.confirm('Stop calibrating?', 'Nothing has been applied yet. Your existing progress is untouched.', function () {
      s.diagnostic = null;
      NJ.S.save(s);
      root.location.hash = '#/today';
      UI.render();
    }, 'Stop');
  };

  UI.actions['diag-continue'] = function () {
    view.interstitial = null;
    UI.render();
  };

  UI.actions['diag-pick'] = function (ev, el) {
    var s = st();
    var run = s.diagnostic;
    if (!run || run.done) return;
    var picked = Number(el.getAttribute('data-i'));
    var res = NJ.DIAG.submit(s, picked);
    NJ.S.save(s);
    if (res.stageChanged) view.interstitial = { strong: res.strong };
    UI.render();
  };
})(typeof window !== 'undefined' ? window : globalThis);
