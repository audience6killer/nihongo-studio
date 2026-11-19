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

  UI.actions['finish-onboarding'] = function () {    var st = state();
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

  UI.actions['switch-phase'] = function () {
    var st = state();
    var current = NJ.PLAN.phaseOf(st);
    var next = current === 'n2' ? 'recap' : 'n2';
    UI.confirm(
      next === 'n2' ? 'Switch to the N2 deck?' : 'Switch back to the recap?',
      next === 'n2'
        ? 'New words will come from the N2 vocabulary deck. Recap words you have not met stay available and will still be drawn once N2 runs out.'
        : 'New words will come from the Tobira recap again, then back to N2.',
      function () {
        st.profile = st.profile || {};
        st.profile.phase = next;
        NJ.S.save(st);
        UI.toast('Drawing new words from ' + NJ.PLAN.deckLabel(next) + '.');
        UI.render();
      },
      'Switch'
    );
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
        ' · ' + UI.esc(NJ.D.chapterLabel(nav.chapter)) + '</p>' +
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
        var exams = st.exams || [];
        var lastExam = exams[exams.length - 1];
        var unlocked = NJ.EXAM.blocks().filter(function (b) {
          return NJ.EXAM.blockStatus(st, b) === 'available';
        });
        html += '<div class="card">' +
          '<div class="card-head"><h2>Checkpoint</h2>' +
            (lastExam ? '<span class="pill">last: ' + lastExam.pct + '%</span>' : '<span class="pill">not taken</span>') +
          '</div>' +
          '<p class="small" style="color:var(--ink-3);margin:0 0 .8rem">' +
            (unlocked.length
              ? '<strong>' + unlocked.length + '</strong> scheduled checkpoint' + (unlocked.length === 1 ? '' : 's') +
                ' unlocked: ' + UI.esc(unlocked[0].label) + '.'
              : 'A timed sample in JLPT shape — <span lang="ja">文字・語彙</span>, ' +
                '<span lang="ja">文法・読解</span>, <span lang="ja">聴解</span>. No writing section, ' +
                'because JLPT has none.') +
          '</p>' +
          '<a class="btn ' + (unlocked.length ? 'btn--primary' : 'btn--ghost') + '" href="#/exam" data-act="go" data-to="#/exam">' +
            (unlocked.length ? 'Take ' + UI.esc(unlocked[0].label) : 'Take a checkpoint') + '</a>' +
        '</div>';
      }

      // Phase: recap first, then the N2 deck. Switching is explicit.
      var phase = NJ.PLAN.phaseOf(st);
      var recapProg = NJ.PLAN.deckProgress(st, 'recap');
      var n2Prog = NJ.PLAN.deckProgress(st, 'n2');
      var hasN2 = n2Prog.total > 0;
      html += '<div class="card card--flat">' +
        '<div class="card-head"><h3>Course phase</h3>' +
          '<span class="pill">' + UI.esc(NJ.PLAN.deckLabel(phase)) + '</span>' +
        '</div>' +
        '<dl class="kv"><dt>Tobira recap</dt><dd>' + recapProg.introduced + ' / ' + recapProg.total +
          ' <span class="small" style="color:var(--ink-3)">(' + recapProg.pct + '%)</span></dd></dl>' +
        (hasN2 ? '<dl class="kv"><dt>N2 vocabulary</dt><dd>' + n2Prog.introduced + ' / ' + n2Prog.total +
          ' <span class="small" style="color:var(--ink-3)">(' + n2Prog.pct + '%)</span></dd></dl>' : '') +
        '<p class="small" style="color:var(--ink-3);margin:.6rem 0 0">' +
          (phase === 'recap'
            ? 'New words come from the recap. The N2 deck starts once the recap runs out, or when you switch.'
            : 'New words come from the N2 deck. Any recap words left over are still available.') +
        '</p>' +
        (hasN2 ? '<div class="btn-row" style="margin-top:.7rem">' +
          '<button type="button" class="btn btn--ghost btn--sm" data-act="switch-phase">' +
            (phase === 'recap' ? 'Switch to N2' : 'Switch back to the recap') + '</button>' +
        '</div>' : '') +
      '</div>';

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

      var n2Units = NJ.D.deckLessons('n2');
      if (n2Units.length) {
        html += '<h2 style="margin:1.5rem 0 .6rem">N2 vocabulary</h2>' +
          '<div class="card card--flat"><div class="rows">';
        n2Units.forEach(function (unit) {
          var terms = unit.words || [];
          var introduced = terms.filter(function (t) { return st.words[t]; }).length;
          var done = terms.length > 0 && introduced === terms.length;
          var kind2 = done ? 'done' : unit.n === currentChapter ? 'current' : '';
          html += '<a class="row-item" href="#/lesson/' + unit.n + '" data-act="go" data-to="#/lesson/' + unit.n + '">' +
            UI.chapterNum(unit.n - 100, kind2) +
            '<span class="grow">' +
              '<strong lang="ja">' + UI.esc(unit.title_l2 || 'N2 語彙') + '</strong>' +
              '<span class="meta">' + UI.esc(unit.title_l1 || '') + ' · ' + introduced + '/' + terms.length + ' words</span>' +
              '<span class="meta">Vocabulary only — reading and grammar arrive in a later content batch</span>' +
            '</span>' +
            '<span class="chev">›</span>' +
          '</a>';
        });
        html += '</div></div>';
      }

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
