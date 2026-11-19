/* dashboard.js — the Today screen (and its first-run onboarding) and the
 * Chapters index.
 */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var UI = (NJ.UI = NJ.UI || {});
  UI.screens = UI.screens || {};
  UI.actions = UI.actions || {};
  var U = NJ.U;

  function state() { return NJ.S.state(); }

  function hasAudio(st) {
    void st;
    return NJ.TTS.hasVoice();
  }

  /* ------------------------------------------------------------- onboarding */

  function renderOnboarding(st) {
    var today = U.dayKey(new Date());
    var target = U.dayKey(U.addDays(new Date(), 24 * 7));
    var minutes = (st.profile && st.profile.dailyMinutes) || 35;
    return '' +
      '<div class="page-head">' +
        '<h1>Nihongo Studio</h1>' +
        '<p class="sub">A Tobira recap, then the road to JLPT N2.</p>' +
      '</div>' +
      '<div class="card card--accent">' +
        '<h2>Before we start</h2>' +
        '<p class="small" style="color:var(--ink-3)">Everything stays in this browser. No account, no network calls.</p>' +
        UI.field('What should I call you?',
          '<input class="input input--ui" id="ob-name" type="text" maxlength="40" value="' +
            UI.esc((st.profile && st.profile.name) || '') + '" placeholder="optional">') +
        UI.field('Minutes per weekday',
          '<input class="input input--ui" id="ob-minutes" type="number" min="10" max="120" step="5" value="' + minutes + '">',
          'The plan assumes five weekdays a week. Sessions adapt to the review backlog.') +
        UI.field('Start', '<input class="input input--ui" id="ob-start" type="date" value="' + today + '">') +
        UI.field('Target date', '<input class="input input--ui" id="ob-target" type="date" value="' + target + '">',
          '24 weeks out. The plan will tell you honestly if the date is tight.') +
        '<button type="button" class="btn btn--primary btn--block" data-act="finish-onboarding">Start the recap</button>' +
      '</div>' +
      '<div class="card">' +
        '<h2>What you are starting</h2>' +
        '<ul class="small" style="color:var(--ink-2);padding-left:1.1rem;margin:0">' +
          '<li>15 recap chapters from Tobira, one grammar point each.</li>' +
          '<li>Three independent skills per word: recognition, production, listening.</li>' +
          '<li>Typed production with your IME. No handwriting, no speaking.</li>' +
          '<li>Recognition and listening are graded by multiple choice; production by typing.</li>' +
        '</ul>' +
      '</div>';
  }

  UI.actions['finish-onboarding'] = function () {
    var st = state();
    var name = (root.document.getElementById('ob-name') || {}).value || '';
    var minutes = Number((root.document.getElementById('ob-minutes') || {}).value) || 35;
    var start = (root.document.getElementById('ob-start') || {}).value || U.dayKey(new Date());
    var target = (root.document.getElementById('ob-target') || {}).value || U.dayKey(U.addDays(new Date(), 24 * 7));

    minutes = U.clamp(minutes, 10, 120);
    st.profile = {
      name: name.trim(),
      startDate: start,
      targetDate: target,
      dailyMinutes: minutes,
      exam: true
    };
    st.settings.newPerDay = minutes >= 45 ? 18 : minutes <= 20 ? 8 : 15;
    st.onboarded = true;
    NJ.S.save(st);
    UI.toast('Plan set. Five weekdays, ' + minutes + ' minutes each.');
    UI.render();
  };

  /* ------------------------------------------------------------------ today */

  UI.screens.today = {
    render: function () {
      var st = state();
      if (!st.onboarded) return renderOnboarding(st);

      var audio = hasAudio(st);
      var skills = audio ? NJ.SRS.SKILLS : ['rec', 'prod'];
      var due = NJ.SRS.countDue(st, { skills: skills });
      var nav = NJ.SESSION.availableNew(st);
      var behind = NJ.PLAN.behind(st);
      var wantNew = NJ.PLAN.effectiveNewPerDay(due, st.settings, behind);
      var newCount = Math.min(wantNew, nav.terms.length);
      var proj = NJ.PLAN.projection(st);
      var current = st.current;
      var resumable = current && !current.done && current.date === U.dayKey(new Date());

      var minutes = (st.profile && st.profile.dailyMinutes) || 35;
      var estimate = Math.round((newCount * NJ.PLAN.newGroupSeconds(audio) + due * 20) / 60);

      var html = '<div class="page-head">' +
        '<h1>' + greeting(st) + '</h1>' +
        '<p class="sub">' + U.fmtDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' }) +
        ' · chapter ' + nav.chapter + ' of ' + Math.max(1, NJ.D.chapters().length) + '</p>' +
        '</div>';

      if (!audio) {
        html += '<div class="note" style="margin-bottom:1rem">' +
          '<strong>Listening is deferred</strong>' +
          'No Japanese voice is installed, so listening cards are not being scheduled. ' +
          '<a href="#/settings">Install one in Settings</a> and they will start appearing. Nothing is lost.' +
          '</div>';
      }

      // Calibration is optional and disappears once it has run.
      if (!NJ.DIAG.hasRun(st)) {
        html += '<div class="card card--accent" style="border-style:dashed">' +
          '<div class="card-head"><h2>Calibration</h2><span class="pill">~8 min</span></div>' +
          '<p style="margin:0 0 .8rem">Fourteen adaptive items find which Tobira vocabulary you still own, ' +
          'so the recap does not spend a month on words you already know.</p>' +
          '<div class="btn-row">' +
            '<a class="btn btn--primary" href="#/calibrate" data-act="go" data-to="#/calibrate">Calibrate</a>' +
            '<span class="small" style="color:var(--ink-3);align-self:center">or just start studying below</span>' +
          '</div>' +
        '</div>';
      }

      html += '<div class="card card--accent">' +
        '<div class="card-head"><h2>Today</h2>' +
          '<span class="pill">' + U.fmtMinutes(minutes) + ' planned</span>' +
        '</div>' +
        '<div class="grid grid-3" style="margin:.4rem 0 .9rem">' +
          UI.stat(due, 'due reviews') +
          UI.stat(newCount, 'new words') +
          UI.stat('~' + U.fmtMinutes(Math.max(1, estimate)), 'estimated') +
        '</div>';

      if (resumable) {
        var p = NJ.SESSION.progress(current);
        html += '<p class="small" style="color:var(--ink-3)">Session in progress — ' + p.idx + ' of ' + p.total + ' done.</p>' +
          UI.bar(p.pct) +
          '<div class="btn-row" style="margin-top:.9rem">' +
            '<a class="btn btn--primary" href="#/session" data-act="go" data-to="#/session">Continue session</a>' +
          '</div>';
      } else if (due === 0 && newCount === 0) {
        html += '<p>Nothing is due. Either you are ahead, or the backlog is paused.</p>' +
          '<div class="btn-row">' +
            '<a class="btn btn--ghost" href="#/chapters" data-act="go" data-to="#/chapters">Study a chapter</a>' +
          '</div>';
      } else {
        html += '<div class="btn-row">' +
          '<a class="btn btn--primary" href="#/session" data-act="go" data-to="#/session">Start session</a>' +
          '<a class="btn btn--ghost" href="#/chapters" data-act="go" data-to="#/chapters">Chapters</a>' +
        '</div>';
      }
      html += '</div>';

      // honest pace
      html += '<div class="card">' +
        '<div class="card-head"><h2>Pace</h2>' +
          '<span class="pill' + (proj.reachable === false ? ' pill--listen' : '') + '">' +
            (proj.reachable === false ? 'target is tight' : proj.reachable ? 'on track' : 'no target date') +
          '</span>' +
        '</div>' +
        '<dl class="kv"><dt>Words introduced</dt><dd>' + proj.introduced + ' / ' + proj.total + '</dd></dl>' +
        '<dl class="kv"><dt>Remaining</dt><dd>' + proj.remaining + '</dd></dl>' +
        '<dl class="kv"><dt>At ' + (st.settings.newPerDay || 15) + ' new/day, 5 days</dt><dd>' +
          (isFinite(proj.weeksNeeded) ? Math.ceil(proj.weeksNeeded) + ' weeks' : '—') + '</dd></dl>' +
        (proj.target ? '<dl class="kv"><dt>Target date</dt><dd>' + U.fmtDate(proj.target) + ' (' +
          Math.max(0, Math.ceil(proj.weeksLeft)) + ' weeks left)</dd></dl>' : '') +
        UI.bar(proj.pctComplete) +
        '<p class="small" style="color:var(--ink-3);margin:.7rem 0 0">' +
          'The full N3→N2 gap is roughly 2,300 new words. At this rate the first six months cover ' +
          'the recap plus about half of it. That is the honest number, not a promise of N2.' +
        '</p>' +
      '</div>';

      if (behind) {
        html += '<div class="note"><strong>Behind the plan</strong>' +
          'New words went up slightly to catch up, but only because the review queue is under control. ' +
          'If the queue grows, they will be cut instead.</div>';
      }

      // Checkpoint: offered once enough words have actually been met.
      if (NJ.EXAM.available(st)) {
        var lastExam = (st.exams || [])[st.exams.length - 1];
        html += '<div class="card">' +
          '<div class="card-head"><h2>Checkpoint</h2>' +
            (lastExam ? '<span class="pill">last: ' + lastExam.pct + '%</span>' : '<span class="pill">not taken</span>') +
          '</div>' +
          '<p class="small" style="color:var(--ink-3);margin:0 0 .8rem">' +
            'A timed sample in JLPT shape — <span lang="ja">文字・語彙</span>, ' +
            '<span lang="ja">文法・読解</span>, <span lang="ja">聴解</span>. No writing section, ' +
            'because JLPT has none.' +
          '</p>' +
          '<a class="btn btn--ghost" href="#/exam" data-act="go" data-to="#/exam">Take a checkpoint</a>' +
        '</div>';
      }

      return html;
    },
    mount: function () { /* delegated only */ }
  };

  function greeting(st) {
    var h = new Date().getHours();
    var part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    var name = st.profile && st.profile.name;
    return name ? part + ', ' + name : part;
  }

  /* --------------------------------------------------------------- chapters */

  UI.screens.chapters = {
    render: function () {
      var st = state();
      var lessons = NJ.D.lessons;
      var currentChapter = NJ.SESSION.currentChapter(st);
      var html = '<div class="page-head"><h1>Chapters</h1>' +
        '<p class="sub">Tobira recap — one grammar point, one reading, one writing task per chapter.</p></div>';

      if (!lessons.length) {
        html += UI.empty('No chapters yet', 'Run the build tools to generate lesson data.', '準備中');
        return html;
      }

      html += '<div class="card card--flat"><div class="rows">';
      lessons.forEach(function (les) {
        var terms = NJ.D.chapterTerms(les.chapter);
        var introduced = terms.filter(function (t) { return st.words[t]; }).length;
        var pct = terms.length ? Math.round((introduced / terms.length) * 100) : 0;
        var done = terms.length > 0 && introduced === terms.length;
        var kind = done ? 'done' : les.chapter === currentChapter ? 'current' : '';
        html += '<a class="row-item" href="#/lesson/' + les.chapter + '" data-act="go" data-to="#/lesson/' + les.chapter + '">' +
          UI.chapterNum(les.chapter, kind) +
          '<span class="grow">' +
            '<strong lang="ja">' + UI.esc(les.title.l2) + '</strong>' +
            '<span class="meta">' + UI.esc(les.title.l1) + ' · ' + introduced + '/' + terms.length + ' words · ' +
              (les.grammar ? UI.esc(les.grammar.point_l2) : '') + '</span>' +
            '<span class="meta">' + pct + '% introduced</span>' +
          '</span>' +
          '<span class="chev">›</span>' +
        '</a>';
      });
      html += '</div></div>';

      html += '<div class="card card--quiet">' +
        '<p class="small" style="color:var(--ink-3);margin:0">' +
          'Chapters 2–15 are authored in batches after chapter 1 is verified end-to-end. ' +
          'The engine already handles them; only content is missing.' +
        '</p>' +
      '</div>';
      return html;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
