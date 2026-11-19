/* lesson.js — a chapter: grammar, reading with tap-to-define, listening
 * practice, and the optional writing task.
 *
 * These are reference and practice stages, not scheduled reviews. Answers here
 * are practice feedback; they do not move SRS cards.
 */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var UI = (NJ.UI = NJ.UI || {});
  UI.screens = UI.screens || {};
  UI.actions = UI.actions || {};
  var U = NJ.U;

  var SECTIONS = ['grammar', 'reading', 'listening', 'writing'];
  var LABELS = { grammar: 'Grammar', reading: 'Reading', listening: 'Listening', writing: 'Writing' };

  var view = { chapter: null, section: 'grammar', picks: {}, writing: '', writingResult: null };

  function st() { return NJ.S.state(); }

  function lesson() { return NJ.D.lesson(view.chapter); }

  function markStage(chapter, stage) {
    var s = st();
    var rec = s.lessons[chapter] || (s.lessons[chapter] = { stages: {}, startedAt: Date.now() });
    rec.stages = rec.stages || {};
    rec.stages[stage] = true;
    rec.stageAt = Date.now();
    if (SECTIONS.every(function (k) { return rec.stages[k]; })) rec.completedAt = rec.completedAt || Date.now();
    NJ.S.save(s);
  }

  /* -------------------------------------------------------------- fragments */

  function sectionNav(active) {
    return '<div class="seg" style="margin-bottom:1rem;flex-wrap:wrap">' + SECTIONS.map(function (key) {
      return '<button type="button" data-act="lesson-section" data-section="' + key + '" aria-pressed="' +
        (active === key) + '">' + LABELS[key] + '</button>';
    }).join('') + '</div>';
  }

  function drillBlock(id, drill, s) {
    var picked = view.picks[id];
    var done = picked != null;
    return '<div class="card">' +
      '<p lang="ja" class="ja" style="margin:0 0 .2rem">' + UI.tappable(drill.q_l2, s) + '</p>' +
      UI.options((drill.options_l2 || []).map(function (o) { return UI.tappable(o, s); }), picked, drill.answer,
        { lang: 'ja', hideTruth: !done, html: true }) +
      (done ? '<div class="feedback feedback--' + (picked === drill.answer ? 'ok' : 'no') + '" style="margin-top:.8rem">' +
        '<h4>' + (picked === drill.answer ? 'Correct' : 'Not quite') + '</h4>' +
        '<p style="margin:0">' + UI.esc(drill.explain_l1) + '</p></div>' : '') +
    '</div>';
  }

  function renderGrammar(les, s) {
    var g = les.grammar;
    var html = '<div class="card card--accent">' +
      '<p class="pos">Grammar</p>' +
      '<h2 lang="ja" style="margin:.1rem 0 .2rem">' + UI.esc(g.point_l2) + '</h2>' +
      '<p class="small" style="color:var(--ink-3);margin:0 0 .7rem">' + UI.esc(g.point_l1) + '</p>' +
      '<p>' + UI.esc(g.explain_l1) + '</p>' +
      '<div class="note" style="margin-top:.6rem"><strong>Common mistake</strong>' + UI.esc(g.common_mistake_l1) + '</div>' +
    '</div>';

    html += '<div class="card"><div class="card-head"><h3>Examples</h3>' +
      '<button type="button" class="btn btn--quiet btn--sm" data-act="say" data-text="' +
        UI.esc(g.examples.map(function (e) { return e.l2; }).join(' ')) + '">Listen to all</button></div>';
    g.examples.forEach(function (ex) {
      html += '<div class="grammar-ex">' +
        '<p lang="ja" class="ja" style="margin:0">' + UI.tappable(ex.l2, s) + '</p>' +
        '<p class="small" lang="ja" style="color:var(--ink-3);margin:0">' + UI.esc(ex.reading) + '</p>' +
        '<p class="small" style="color:var(--ink-2);margin:.1rem 0 0">' + UI.esc(ex.l1) + '</p>' +
      '</div>';
    });
    html += '</div>';

    html += '<h2 style="margin:1.4rem 0 .6rem">Drills</h2>';
    (g.drills || []).forEach(function (d, i) { html += drillBlock('g' + i, d, s); });
    return html;
  }

  function renderReading(les, s) {
    var r = les.reading;
    var html = '<div class="card">' +
      '<div class="card-head"><h2>Reading</h2>' +
        '<button type="button" class="btn btn--quiet btn--sm" data-act="toggle-furigana">' +
          (s.settings.furigana ? 'Hide furigana' : 'Show furigana') + '</button>' +
      '</div>' +
      UI.passage(r.text_l2, s) +
      '<p class="small" style="color:var(--ink-3);margin:.8rem 0 0">Tap any word for its reading, gloss and audio.</p>' +
    '</div>';

    html += '<div class="card">' +
      '<div class="card-head"><h3>Sentence by sentence</h3>' +
        '<button type="button" class="btn btn--quiet btn--sm" data-act="toggle-translation">' +
          (s.settings.showTranslations ? 'Hide English' : 'Show English') + '</button></div>' +
      '<ul class="sentence-pairs">' + (r.sentences || []).map(function (pair) {
        return '<li>' +
          '<div class="l2" lang="ja">' + UI.tappable(pair.l2, s) + '</div>' +
          (s.settings.showTranslations ? '<div class="l1">' + UI.esc(pair.l1) + '</div>' : '') +
        '</li>';
      }).join('') + '</ul>' +
    '</div>';

    html += '<h2 style="margin:1.4rem 0 .6rem">Questions</h2>';
    (r.questions || []).forEach(function (q, i) {
      var picked = view.picks['r' + i];
      var done = picked != null;
      html += '<div class="card">' +
        '<p lang="ja" class="ja" style="margin:0 0 .2rem">' + UI.tappable(q.q_l2, s) + '</p>' +
        UI.options((q.options_l2 || []).map(function (o) { return UI.tappable(o, s); }), picked, q.answer,
          { lang: 'ja', hideTruth: !done, html: true }) +
        (done ? '<div class="feedback feedback--' + (picked === q.answer ? 'ok' : 'no') + '" style="margin-top:.8rem">' +
          '<h4>' + (picked === q.answer ? 'Correct' : 'Not quite') + '</h4>' +
          '<p style="margin:0">' + UI.esc(q.explain_l1) + '</p></div>' : '') +
      '</div>';
    });
    return html;
  }

  function renderListening(les, s) {
    var dict = (les.listening && les.listening.dictation) || [];
    var audio = NJ.TTS.hasVoice();
    var html = '<div class="card card--accent">' +
      '<div class="card-head"><h2>Dictation</h2>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-act="say" data-text="' +
          UI.esc(dict.map(function (d) { return d.l2; }).join(' ')) + '">Play all</button>' +
      '</div>' +
      (audio ? '<p class="small" style="color:var(--ink-3);margin:0">Play one, write it down, then check. Dictation cards also appear in your daily session.</p>'
             : '<div class="note"><strong>No Japanese voice</strong>Install one (Settings → Audio) or open this page in Microsoft Edge, which supplies Japanese voices without a system pack.</div>') +
    '</div>';

    dict.forEach(function (d, i) {
      var id = 'd' + i;
      var revealed = view.picks[id] === true;
      html += '<div class="card">' +
        '<div class="card-head"><span class="pill">' + (i + 1) + ' / ' + dict.length + '</span>' +
          '<button type="button" class="btn btn--ghost btn--sm" data-act="say" data-text="' + UI.esc(d.l2) + '">▶ Play</button>' +
        '</div>' +
        (revealed
          ? '<p lang="ja" class="ja" style="font-size:1.06rem;margin:0">' + UI.tappable(d.l2, s) + '</p>' +
            '<p class="small" style="color:var(--ink-3);margin:.2rem 0 0">' + UI.esc(d.l1) + '</p>'
          : '<button type="button" class="btn btn--quiet" data-act="reveal-dictation" data-id="' + id + '">Show the sentence</button>') +
      '</div>';
    });
    return html;
  }

  function renderWriting(les, s) {
    var w = les.writing;
    var text = view.writing || '';
    var count = NJ.L.countUnits(text, w.unit || 'chars');
    var required = w.required || [];
    var covered = required.filter(function (term) { return text.indexOf(term) >= 0; });
    var res = view.writingResult;

    var html = '<div class="card card--accent">' +
      '<p class="pos">Output practice · not a JLPT section</p>' +
      '<h2 style="margin:.1rem 0 .4rem">Writing</h2>' +
      '<p>' + UI.esc(w.prompt_l1) + '</p>' +
      '<p class="small" style="color:var(--ink-3);margin:0">' + UI.esc(w.tips_l1) + '</p>' +
    '</div>';

    html += '<div class="card">' +
      '<p class="small" style="margin:0 0 .35rem"><strong>Use these words</strong> — tap to insert</p>' +
      '<div class="btn-row" style="margin-bottom:.8rem">' + required.map(function (term) {
        var used = text.indexOf(term) >= 0;
        return '<button type="button" class="btn ' + (used ? 'btn--primary' : 'btn--ghost') + ' btn--sm" ' +
          'data-act="insert-word" data-word="' + UI.esc(term) + '" lang="ja">' + UI.esc(term) + '</button>';
      }).join('') + '</div>' +
      '<textarea class="textarea" id="writing-input" lang="ja" spellcheck="false" ' +
        'placeholder="日本語で書いてください" aria-label="Your writing">' + UI.esc(text) + '</textarea>' +
      '<div style="display:flex;gap:.8rem;align-items:center;margin-top:.5rem">' +
        '<span class="small" id="writing-count" style="color:' + (count >= w.min_units ? 'var(--moss)' : 'var(--ink-3)') + '">' +
          count + ' / ' + w.min_units + ' ' + (w.unit || 'chars') + '</span>' +
        '<span class="small" id="writing-covered" style="color:var(--ink-3);margin-left:auto">' + covered.length + ' / ' + required.length + ' required words</span>' +
      '</div>' +
      '<div class="btn-row" style="margin-top:.8rem">' +
        '<button type="button" class="btn btn--primary" data-act="submit-writing">Check my writing</button>' +
        '<button type="button" class="btn btn--ghost" data-act="show-model">Show a model answer</button>' +
      '</div>' +
    '</div>';

    if (res) {
      html += '<div class="card">' +
        '<h3>Heuristic check</h3>' +
        '<dl class="kv"><dt>Length</dt><dd>' + res.count + ' / ' + w.min_units + ' ' + (w.unit || 'chars') + '</dd></dl>' +
        '<dl class="kv"><dt>Required words</dt><dd>' + res.covered + ' / ' + required.length + '</dd></dl>' +
        '<dl class="kv"><dt>Sentences</dt><dd>' + res.sentences + '</dd></dl>' +
        '<p class="small" style="color:var(--ink-3);margin:.8rem 0 0">' +
          'This counts length, required words and sentences. It does not judge accuracy or style, and it ' +
          'is not an exam score. Have a human read it.</p>' +
        '<div class="btn-row" style="margin-top:.7rem">' +
          '<button type="button" class="btn btn--ghost btn--sm" data-act="show-model">Model answer</button>' +
        '</div>' +
      '</div>';
    }
    return html;
  }

  /* ------------------------------------------------------------------ screen */

  /**
   * A vocabulary-only unit: an N2 deck with no reading or grammar yet. It gets
   * a word list rather than a "not found" page, because the words are real and
   * studyable even when the prose is not written.
   */
  function renderDeck(unit, s) {
    var terms = unit.words || [];
    var introduced = terms.filter(function (t) { return s.words[t]; }).length;
    var pct = terms.length ? Math.round((introduced / terms.length) * 100) : 0;

    var html = '<div class="page-head">' +
      '<p class="small" style="color:var(--ink-3);margin:0">' + UI.esc(NJ.D.chapterLabel(unit.n)) +
        ' · vocabulary deck</p>' +
      '<h1 lang="ja">' + UI.esc(unit.title_l2 || 'N2 語彙') + '</h1>' +
      '<p class="sub">' + UI.esc(unit.title_l1 || '') + ' · ' + introduced + '/' + terms.length + ' words introduced</p>' +
    '</div>';

    html += '<div class="card card--quiet" style="margin-bottom:1rem">' +
      '<p class="small" style="color:var(--ink-3);margin:0">' +
        'This deck is vocabulary only: no reading, grammar or writing yet. ' +
        'The words are scheduled exactly like recap words, with the same three skills.' +
      '</p>' +
    '</div>' + UI.bar(pct);

    html += '<div class="card" style="margin-top:1rem"><div class="rows">';
    terms.forEach(function (term) {
      var w = NJ.D.word(term) || { w: term, reading: '', gloss: '', pos: '' };
      var known = !!s.words[term];
      html += '<div class="row-item" style="cursor:default">' +
        '<span class="grow">' +
          '<strong lang="ja">' + UI.jpWord(w.w, w.reading, s) + '</strong>' +
          '<span class="meta" lang="ja">' + UI.esc(w.reading) + ' · ' + UI.esc(w.pos || '') +
            (known ? ' · <span style="color:var(--moss)">introduced</span>' : '') + '</span>' +
          '<span class="meta">' + UI.esc(w.gloss) + '</span>' +
        '</span>' +
        '<button type="button" class="btn btn--quiet btn--sm" data-act="say" data-text="' + UI.esc(w.w) +
          '" aria-label="Listen to ' + UI.esc(w.w) + '">▶</button>' +
      '</div>';
    });
    html += '</div></div>';

    html += '<div class="btn-row" style="margin-top:1.2rem">' +
      '<a class="btn btn--primary" href="#/session" data-act="go" data-to="#/session">Practise these words</a>' +
      '<a class="btn btn--ghost" href="#/chapters" data-act="go" data-to="#/chapters">All chapters</a>' +
    '</div>';
    return html;
  }

  UI.screens.lesson = {
    render: function (routeArg) {
      var chapter = Number(routeArg);
      if (view.chapter !== chapter) {
        view = { chapter: chapter, section: 'grammar', picks: {}, writing: '', writingResult: null };
      }
      var les = NJ.D.lesson(chapter);
      if (!les) {
        var unit = NJ.D.unit(chapter);
        if (unit) return renderDeck(unit, st());
        return '<div class="page-head"><h1>Chapter not found</h1></div>' +
          '<div class="card"><a class="btn btn--ghost" href="#/chapters" data-act="go" data-to="#/chapters">Back to chapters</a></div>';
      }
      var s = st();
      markStage(chapter, view.section);
      updateNav('chapters');

      var terms = NJ.D.chapterTerms(chapter);
      var introduced = terms.filter(function (t) { return s.words[t]; }).length;

      var html = '<div class="page-head">' +
        '<p class="small" style="color:var(--ink-3);margin:0">Chapter ' + chapter + ' of ' +
          Math.max(chapter, NJ.D.chapters().length) + '</p>' +
        '<h1 lang="ja">' + UI.esc(les.title.l2) + '</h1>' +
        '<p class="sub">' + UI.esc(les.title.l1) + ' · ' + introduced + '/' + terms.length + ' words introduced</p>' +
      '</div>';

      html += sectionNav(view.section);
      if (view.section === 'grammar') html += renderGrammar(les, s);
      else if (view.section === 'reading') html += renderReading(les, s);
      else if (view.section === 'listening') html += renderListening(les, s);
      else html += renderWriting(les, s);

      html += '<div class="btn-row" style="margin-top:1.4rem">' +
        '<a class="btn btn--primary" href="#/session" data-act="go" data-to="#/session">Practise these words</a>' +
        '<a class="btn btn--ghost" href="#/chapters" data-act="go" data-to="#/chapters">All chapters</a>' +
      '</div>';
      return html;
    },

    mount: function () {
      var ta = root.document.getElementById('writing-input');
      if (!ta) return;
      var les = lesson();
      var unit = (les && les.writing && les.writing.unit) || 'chars';
      var min = (les && les.writing && les.writing.min_units) || 0;
      var required = (les && les.writing && les.writing.required) || [];
      var counter = root.document.getElementById('writing-count');

      function refresh() {
        view.writing = ta.value;
        if (!counter) return;
        var n = NJ.L.countUnits(ta.value, unit);
        counter.textContent = n + ' / ' + min + ' ' + unit;
        counter.style.color = n >= min ? 'var(--moss)' : 'var(--ink-3)';
        var used = required.filter(function (w) { return ta.value.indexOf(w) >= 0; }).length;
        var covered = root.document.getElementById('writing-covered');
        if (covered) covered.textContent = used + ' / ' + required.length + ' required words';
      }

      ta.addEventListener('input', U.debounce(refresh, 100));
      ta.addEventListener('input', refresh);
      ta.addEventListener('blur', refresh);
    }
  };

  function updateNav(name) {
    var links = root.document.querySelectorAll('.nav a[data-nav]');
    Array.prototype.forEach.call(links, function (a) {
      if (a.getAttribute('data-nav') === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  /* ---------------------------------------------------------------- actions */

  UI.actions['lesson-section'] = function (ev, el) {
    view.section = el.getAttribute('data-section');
    markStage(view.chapter, view.section);
    UI.closePopover();
    UI.render();
  };

  UI.actions['toggle-furigana'] = function () {
    var s = st();
    s.settings.furigana = !s.settings.furigana;
    NJ.S.save(s);
    UI.render();
  };

  UI.actions['toggle-translation'] = function () {
    var s = st();
    s.settings.showTranslations = !s.settings.showTranslations;
    NJ.S.save(s);
    UI.render();
  };

  UI.actions['reveal-dictation'] = function (ev, el) {
    view.picks[el.getAttribute('data-id')] = true;
    UI.render();
  };

  UI.actions['insert-word'] = function (ev, el) {
    var ta = root.document.getElementById('writing-input');
    var word = el.getAttribute('data-word') || '';
    if (!ta) return;
    var start = ta.selectionStart == null ? ta.value.length : ta.selectionStart;
    var end = ta.selectionEnd == null ? ta.value.length : ta.selectionEnd;
    var next = ta.value.slice(0, start) + word + ta.value.slice(end);
    ta.value = next;
    view.writing = next;
    ta.focus();
    var pos = start + word.length;
    try { ta.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
    UI.render();
  };

  UI.actions['submit-writing'] = function () {
    var les = lesson();
    if (!les) return;
    var ta = root.document.getElementById('writing-input');
    var text = ta ? ta.value : (view.writing || '');
    view.writing = text;
    var w = les.writing;
    var required = w.required || [];
    var sentences = NJ.L.splitSentences(text).length;
    var covered = required.filter(function (term) { return text.indexOf(term) >= 0; }).length;
    view.writingResult = {
      count: NJ.L.countUnits(text, w.unit || 'chars'),
      covered: covered,
      sentences: sentences
    };
    var s = st();
    s.writing.push({
      lesson: view.chapter,
      at: Date.now(),
      count: view.writingResult.count,
      covered: covered,
      required: required.length,
      sentences: sentences,
      text: text.slice(0, 4000)
    });
    if (s.writing.length > 200) s.writing = s.writing.slice(-200);
    NJ.S.save(s);
    UI.render();
  };

  UI.actions['show-model'] = function () {
    var les = lesson();
    if (!les) return;
    UI.modal({
      title: 'Model answer',
      body: '<p lang="ja" class="ja" style="font-size:1.05rem">' + UI.tappable(les.writing.model_l2, st()) + '</p>' +
        '<p class="small" style="color:var(--ink-3)">One good answer, not the only answer. Yours may differ.</p>',
      actions: [{ label: 'Close', primary: true }]
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
