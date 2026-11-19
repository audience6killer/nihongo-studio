/* stats.js — the stats screen and the settings screen. */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var UI = (NJ.UI = NJ.UI || {});
  UI.screens = UI.screens || {};
  UI.actions = UI.actions || {};
  var U = NJ.U;

  function st() { return NJ.S.state(); }

  /* ------------------------------------------------------------------- stats */

  function streak(state) {
    var days = state.days || {};
    var d = new Date();
    var n = 0;
    // Today only counts once something happened; a streak may start yesterday.
    if (!days[U.dayKey(d)] || !(days[U.dayKey(d)].reviews + days[U.dayKey(d)].newWords)) {
      d = U.addDays(d, -1);
    }
    for (var i = 0; i < 400; i++) {
      var key = U.dayKey(d);
      var row = days[key];
      if (row && (row.reviews + row.newWords) > 0) {
        n++;
        d = U.addDays(d, -1);
      } else {
        break;
      }
    }
    return n;
  }

  function forecast(state, days) {
    var now = Date.now();
    var buckets = new Array(days).fill(0);
    var cards = state.cards || {};
    Object.keys(cards).forEach(function (k) {
      var card = cards[k];
      if (!card || card.suspended) return;
      var offset = U.daysBetween(new Date(now), new Date(card.due));
      if (offset < 0) offset = 0;
      if (offset < days) buckets[offset]++;
    });
    return buckets;
  }

  function heatmap(state, days) {
    var end = U.startOfDay(new Date());
    var start = U.addDays(end, -(days - 1));
    var cells = [];
    for (var i = 0; i < days; i++) {
      var key = U.dayKey(U.addDays(start, i));
      var row = state.days[key];
      var n = row ? row.reviews + row.newWords : 0;
      var level = n === 0 ? 0 : n < 10 ? 1 : n < 25 ? 2 : n < 50 ? 3 : 4;
      cells.push('<i data-l="' + level + '" title="' + key + ' · ' + n + ' items"></i>');
    }
    return '<div class="heatmap">' + cells.join('') + '</div>';
  }

  UI.screens.stats = {
    render: function () {
      var s = st();
      var acc = NJ.SRS.skillAccuracy(s);
      var totalReviews = Object.keys(s.skillStats).reduce(function (sum, k) {
        return sum + (s.skillStats[k].seen || 0);
      }, 0);
      var totalCorrect = Object.keys(s.skillStats).reduce(function (sum, k) {
        return sum + (s.skillStats[k].correct || 0);
      }, 0);
      var overall = totalReviews ? Math.round((totalCorrect / totalReviews) * 100) : 0;
      var mature = Object.keys(s.cards || {}).filter(function (k) {
        return NJ.SRS.isMature(s.cards[k]);
      }).length;
      var totalCards = Object.keys(s.cards || {}).length;

      var html = '<div class="page-head"><h1>Stats</h1>' +
        '<p class="sub">' + totalCards + ' cards across ' + Object.keys(s.words || {}).length + ' words</p></div>';

      html += '<div class="card"><div class="grid grid-3" style="margin-bottom:.6rem">' +
        UI.stat(streak(s), 'day streak') +
        UI.stat(overall + '%', 'overall accuracy') +
        UI.stat(mature, 'mature cards') +
      '</div>' +
      '<p class="small" style="color:var(--ink-3);margin:0">Mature means an interval of 21 days or more.</p></div>';

      html += '<div class="card"><h3>Last 30 days</h3>' + heatmap(s, 30) +
        '<p class="small" style="color:var(--ink-3);margin:.6rem 0 0">Each square is a day; darker means more items.</p></div>';

      html += '<div class="card"><h3>Accuracy by skill</h3>';
      NJ.SRS.SKILLS.forEach(function (skill) {
        var row = acc[skill];
        html += '<dl class="kv"><dt>' + UI.esc(NJ.SRS.SKILL_LABEL[skill]) + '</dt><dd>' +
          row.pct + '% <span class="small" style="color:var(--ink-3)">(' + row.correct + '/' + row.seen + ')</span></dd></dl>';
      });
      if (overall && acc.prod.seen > 6 && acc.rec.seen > 6) {
        if (acc.prod.pct < acc.rec.pct - 12) {
          html += '<div class="note" style="margin-top:.8rem"><strong>Recognition is ahead of production</strong>' +
            'That is the normal gap, and exactly what typing practice closes. Keep production cards first.</div>';
        }
      }
      html += '</div>';

      var fc = forecast(s, 8);
      html += '<div class="card"><h3>Next 8 days</h3><dl class="kv"><dt>Due now</dt><dd>' + fc[0] + '</dd></dl>';
      for (var i = 1; i < fc.length; i++) {
        html += '<dl class="kv"><dt>+ ' + i + ' day' + (i === 1 ? '' : 's') + '</dt><dd>' + fc[i] + '</dd></dl>';
      }
      html += '</div>';

      var recent = (s.sessions || []).slice(-6).reverse();
      html += '<div class="card"><h3>Recent sessions</h3>';
      if (!recent.length) {
        html += '<p class="small" style="color:var(--ink-3);margin:0">No sessions yet.</p>';
      } else {
        recent.forEach(function (row) {
          var pct = row.total ? Math.round((row.correct / row.total) * 100) : 0;
          html += '<dl class="kv"><dt>' + U.fmtDate(new Date(row.finishedAt || row.startedAt), { month: 'short', day: 'numeric' }) + '</dt>' +
            '<dd>' + row.graded + ' graded · ' + pct + '%</dd></dl>';
        });
      }
      html += '</div>';

      var exams = (s.exams || []).slice(-5).reverse();
      html += '<div class="card"><h3>Checkpoints</h3>';
      if (!exams.length) {
        html += '<p class="small" style="color:var(--ink-3);margin:0">No checkpoints taken yet.</p>';
      } else {
        exams.forEach(function (row) {
          html += '<dl class="kv"><dt>' + U.fmtDate(new Date(row.at), { month: 'short', day: 'numeric' }) + '</dt>' +
            '<dd>' + row.pct + '% <span class="small" style="color:var(--ink-3)">(' +
            row.correct + '/' + row.total + ')</span></dd></dl>';
        });
      }
      html += '</div>';

      if (s.diagnostic && s.diagnostic.done) {
        var diag = s.diagnostic;
        html += '<div class="card"><h3>Calibration</h3>' +
          (diag.skipped
            ? '<p class="small" style="color:var(--ink-3);margin:0">Skipped. Nothing was preseeded.</p>'
            : '<dl class="kv"><dt>Accuracy</dt><dd>' + diag.accuracy + '%</dd></dl>' +
              '<dl class="kv"><dt>Already solid</dt><dd>' + (diag.seeded || []).length + '</dd></dl>' +
              '<dl class="kv"><dt>Refresh deck</dt><dd>' + (diag.refreshed || []).length + '</dd></dl>') +
        '</div>';
      }

      return html;
    }
  };

  /* ---------------------------------------------------------------- settings */

  UI.actions['toggle-setting'] = function (ev, el) {
    var s = st();
    var key = el.getAttribute('data-key');
    if (key === 'reduceMotion') {
      s.settings.reduceMotion = !s.settings.reduceMotion;
      root.document.documentElement.setAttribute('data-motion', s.settings.reduceMotion ? 'reduce' : '');
    } else {
      s.settings[key] = !s.settings[key];
    }
    NJ.S.save(s);
    UI.render();
  };

  /* ------------------------------------------------------------ cloud sync */

  function syncCard(s) {
    var sync = NJ.sync;
    if (!sync) return '';

    var cfg = sync.config() || {};
    var baked = sync.usesSiteConfig();
    var signed = sync.signedIn();
    var configured = sync.configured();
    var st = sync.state;
    var host = '';
    try { host = cfg.url ? new URL(cfg.url).host : ''; } catch (e) { host = cfg.url || ''; }

    var html = '<div class="card"><h2>Cloud sync</h2>' +
      '<p class="small" style="color:var(--ink-3);margin:0 0 .8rem">' +
        'Optional. Every answer is saved on this device first; the cloud is a mirror for your other ' +
        'devices, never the source of truth. Without it, move progress by hand with Export and Import.' +
      '</p>';

    if (!configured && !signed) {
      html += '<p style="margin:0 0 .8rem">Point this app at a Supabase project to sync between devices. ' +
        '<a href="setup.html">The setup guide</a> has the SQL and the hosting steps.</p>' +
        '<label class="field"><span>Project URL</span>' +
          '<input class="input input--ui" id="sync-url" type="url" placeholder="https://xxxx.supabase.co" value="' +
            UI.esc(cfg.url || '') + '"></label>' +
        '<label class="field"><span>Anon / publishable key</span>' +
          '<input class="input input--ui" id="sync-key" type="text" placeholder="eyJ…" value="' +
            UI.esc(cfg.anonKey || '') + '">' +
          '<span class="hint">Safe to ship: Row Level Security limits each account to its own row. ' +
          'Never the service_role key.</span></label>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-act="sync-save-project">Save project</button>' +
        '</div>';
      return html;
    }

    if (!signed) {
      html += '<div class="card-head"><span class="pill">Not signed in</span>' +
        (baked ? '<span class="pill pill--muted">configured at build time</span>'
               : '<button type="button" class="btn btn--quiet btn--sm" data-act="sync-forget">Change project</button>') +
        '</div>' +
        '<p class="small" style="color:var(--ink-3);margin:0 0 .8rem">' +
          (baked ? 'This site is already pointed at your sync project. Sign in to pull your progress.'
                 : 'Connected to ' + UI.esc(host || 'your project') + '. Sign in to pull your progress.') +
        '</p>' +
        '<label class="field"><span>Email</span>' +
          '<input class="input input--ui" id="sync-email" type="email" autocomplete="username" value="' +
            UI.esc(cfg.email || '') + '"></label>' +
        '<label class="field"><span>Password</span>' +
          '<input class="input input--ui" id="sync-pass" type="password" autocomplete="current-password"></label>' +
        '<div class="btn-row">' +
          '<button type="button" class="btn btn--primary" data-act="sync-signin">Sign in</button>' +
          '<button type="button" class="btn btn--ghost" data-act="sync-signup">Create account</button>' +
        '</div>' +
        '</div>';
      return html;
    }

    var pill = st.syncing ? '<span class="pill">Syncing…</span>'
      : st.lastError ? '<span class="pill pill--listen">Sync error</span>'
      : '<span class="pill pill--done">Connected</span>';

    html += '<div class="card-head">' + pill + '<span class="small" style="color:var(--ink-3)">' +
      UI.esc(cfg.email || '') + (host ? ' · ' + UI.esc(host) : '') + '</span></div>' +
      '<dl class="kv"><dt>Status</dt><dd>' + UI.esc(sync.statusText()) + '</dd></dl>' +
      '<dl class="kv"><dt>Last sync</dt><dd>' +
        (st.lastSyncAt ? U.fmtDate(new Date(st.lastSyncAt), { hour: '2-digit', minute: '2-digit' }) : 'never') +
      '</dd></dl>';

    if (st.lastError) {
      html += '<div class="note" style="margin:.7rem 0"><strong>Last sync failed</strong>' + UI.esc(st.lastError) + '</div>';
    }

    html += '<div class="switch" style="margin-top:.6rem">' +
        '<span class="label">Auto-sync<span class="hint">After sessions and setting changes</span></span>' +
        '<button type="button" class="toggle" role="switch" aria-checked="' +
          (cfg.enabled !== false ? 'true' : 'false') + '" data-act="sync-toggle-auto" aria-label="Auto-sync"></button>' +
      '</div>' +
      '<div class="btn-row" style="margin-top:.8rem">' +
        '<button type="button" class="btn btn--primary btn--sm" data-act="sync-now">Sync now</button>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-act="sync-upload">Upload this device</button>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-act="sync-download">Download from cloud</button>' +
        '<button type="button" class="btn btn--quiet btn--sm" data-act="sync-signout">Sign out</button>' +
      '</div>' +
      '</div>';
    return html;
  }

  function syncField(id) {
    var el = root.document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function syncBusy(fn) {
    var run = function () {
      return Promise.resolve()
        .then(fn)
        .catch(function (e) {
          UI.toast((NJ.sync && NJ.sync.friendly && NJ.sync.friendly(e)) || e.message || 'Sync failed.', 'warn');
        })
        .then(function () { UI.render(); });
    };
    return run();
  }

  UI.actions['sync-save-project'] = function () {
    try {
      NJ.sync.saveConfig({ url: syncField('sync-url'), anonKey: syncField('sync-key') });
      UI.toast('Project saved.');
    } catch (e) {
      UI.toast(e.message, 'warn');
    }
    UI.render();
  };

  UI.actions['sync-forget'] = function () {
    UI.confirm('Forget this project?',
      'The URL and key are removed from this device and you are signed out. Local progress stays.',
      function () { NJ.sync.disconnect(); UI.render(); }, 'Forget');
  };

  UI.actions['sync-signin'] = function () {
    var email = syncField('sync-email');
    var pass = syncField('sync-pass');
    syncBusy(async function () {
      if (!NJ.sync.usesSiteConfig() && root.document.getElementById('sync-url')) {
        NJ.sync.saveConfig({ url: syncField('sync-url'), anonKey: syncField('sync-key') });
      }
      var res = await NJ.sync.signIn(email, pass);
      if (res && res.signedIn) {
        await NJ.sync.syncNow({ silent: true });
        UI.toast('Signed in. Progress merged and synced.');
      }
    });
  };

  UI.actions['sync-signup'] = function () {
    var email = syncField('sync-email');
    var pass = syncField('sync-pass');
    syncBusy(async function () {
      if (!NJ.sync.usesSiteConfig() && root.document.getElementById('sync-url')) {
        NJ.sync.saveConfig({ url: syncField('sync-url'), anonKey: syncField('sync-key') });
      }
      var res = await NJ.sync.signUp(email, pass);
      if (res && res.needsConfirmation) {
        UI.toast('Account created. Confirm your email, then sign in.', 'warn');
        return;
      }
      await NJ.sync.syncNow({ silent: true });
      UI.toast('Account created and synced.');
    });
  };

  UI.actions['sync-now'] = function () {
    syncBusy(async function () { await NJ.sync.syncNow({}); UI.toast('Synced.'); });
  };

  UI.actions['sync-upload'] = function () {
    syncBusy(async function () { await NJ.sync.upload(); UI.toast('Uploaded this device.'); });
  };

  UI.actions['sync-download'] = function () {
    UI.confirm('Replace this device with the cloud copy?',
      'This device\u2019s progress is replaced by the cloud snapshot. Export a backup first if you are unsure.',
      function () {
        syncBusy(async function () { await NJ.sync.download(); UI.toast('Downloaded.'); });
      }, 'Download');
  };

  UI.actions['sync-signout'] = function () {
    syncBusy(async function () { await NJ.sync.signOut(); UI.toast('Signed out. Local progress stays.'); });
  };

  UI.actions['sync-toggle-auto'] = function () {
    var cfg = NJ.sync.config() || {};
    NJ.sync.saveConfig({ enabled: !(cfg.enabled !== false) });
    UI.toast(cfg.enabled !== false ? 'Auto-sync off.' : 'Auto-sync on.');
    UI.render();
  };

  UI.screens.settings = {
    render: function () {
      var s = st();
      var voices = NJ.TTS.list();
      var audio = NJ.TTS.hasVoice();
      var p = s.profile || {};

      var html = '<div class="page-head"><h1>Settings</h1>' +
        '<p class="sub">Everything here is local to this browser.</p></div>';

      html += '<div class="card"><h2>Plan</h2>' +
        UI.field('Name', '<input class="input input--ui" id="set-name" type="text" maxlength="40" value="' +
          UI.esc(p.name || '') + '">') +
        UI.field('Minutes per weekday',
          '<input class="input input--ui" id="set-minutes" type="number" min="10" max="120" step="5" value="' +
            (p.dailyMinutes || 35) + '">') +
        UI.field('Target date', '<input class="input input--ui" id="set-target" type="date" value="' +
          UI.esc(p.targetDate || '') + '">') +
        UI.field('New words per day',
          '<input class="input input--ui" id="set-newperday" type="number" min="0" max="40" step="1" value="' +
            (s.settings.newPerDay || 15) + '">',
          'Cut automatically when the review queue passes 45, 70 or 100 cards.') +
        UI.field('Review cap per session',
          '<input class="input input--ui" id="set-reviewcap" type="number" min="10" max="200" step="5" value="' +
            (s.settings.reviewCap || 45) + '">') +
        '<button type="button" class="btn btn--primary" data-act="save-settings">Save</button>' +
        '<div class="btn-row" style="margin-top:.9rem">' +
          '<button type="button" class="btn btn--ghost btn--sm" data-act="run-calibration">' +
            (s.diagnostic && s.diagnostic.done ? 'Re-run calibration' : 'Run calibration') + '</button>' +
          '<a class="btn btn--ghost btn--sm" href="#/exam" data-act="go" data-to="#/exam">Checkpoints</a>' +
        '</div>' +
      '</div>';

      html += '<div class="card"><h2>Reading</h2>' +
        UI.toggle('furigana', s.settings.furigana, 'Furigana above kanji',
          'Off by default: you have finished Tobira, and reading without is the point.') +
        UI.toggle('showTranslations', s.settings.showTranslations, 'Show English translations') +
        UI.toggle('reduceMotion', s.settings.reduceMotion, 'Reduce motion') +
      '</div>';

      html += '<div class="card"><h2>Audio</h2>' +
        (audio
          ? '<p class="small" style="color:var(--moss)">Japanese voices found: ' + voices.length + '</p>'
          : '<div class="note"><strong>No Japanese voice installed</strong>' +
            'Listening cards are paused until one exists. On Windows: Settings → Time &amp; Language → ' +
            'Language &amp; region → Add a language → 日本語 → Language features → <em>Speech</em>, then reload. ' +
            'Microsoft Edge also supplies Japanese voices without a system pack.</div>') +
        UI.field('Voice',
          '<select class="input input--ui" id="set-voice">' + voices.map(function (v) {
            return '<option value="' + UI.esc(v.uri) + '"' +
              (s.settings.voiceURI === v.uri ? ' selected' : '') + '>' + UI.esc(v.name + ' (' + v.lang + ')') +
              '</option>';
          }).join('') + '</select>',
          voices.length ? '' : 'No voice available yet.') +
        UI.field('Speed',
          '<input class="input input--ui" id="set-rate" type="number" min="0.5" max="1.5" step="0.05" value="' +
            (s.settings.rate || 0.9) + '">', '0.9 is a comfortable learning pace.') +
        '<div class="btn-row">' +
          '<button type="button" class="btn btn--ghost" data-act="test-voice">Test voice</button>' +
          '<button type="button" class="btn btn--primary" data-act="save-settings">Save</button>' +
        '</div>' +
      '</div>';

      html += '<div class="card"><h2>Data</h2>' +
        '<dl class="kv"><dt>Storage key</dt><dd><code>' + NJ.S.KEY + '</code></dd></dl>' +
        '<dl class="kv"><dt>Snapshot size</dt><dd>' + Math.round(NJ.S.sizeBytes() / 1024) + ' KB</dd></dl>' +
        '<p class="small" style="color:var(--ink-3);margin:.7rem 0">' +
          'Progress lives in this browser only. It does not follow you to another device unless you export it.</p>' +
        '<div class="btn-row">' +
          '<button type="button" class="btn btn--ghost" data-act="export-data">Export backup</button>' +
          '<button type="button" class="btn btn--ghost" data-act="import-data">Import backup</button>' +
          '<button type="button" class="btn btn--quiet" data-act="reset-data">Start over</button>' +
        '</div>' +
        '<input type="file" id="import-file" accept="application/json,.json" hidden>' +
      '</div>';

      html += syncCard(s);

      html += '<div class="card card--quiet"><p class="small" style="color:var(--ink-3);margin:0">' +
        'Not affiliated with Kurosio Publishers or the JLPT administrators. Chapter topics are facts; ' +
        'all passages, questions and explanations here were written for this app.</p></div>';
      return html;
    },

    mount: function () {
      var input = root.document.getElementById('import-file');
      if (input) {
        input.addEventListener('change', function () {
          var file = input.files && input.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function () {
            var res = NJ.S.importText(String(reader.result || ''));
            if (!res.ok) { UI.toast(res.error, 'warn'); return; }
            UI.toast('Backup imported.');
            UI.render();
          };
          reader.readAsText(file);
        });
      }
    }
  };

  /* --------------------------------------------------------------- actions */

  UI.actions['save-settings'] = function () {
    var s = st();
    var g = function (id) { var el = root.document.getElementById(id); return el ? el.value : null; };

    s.profile = s.profile || { startDate: U.dayKey(new Date()), exam: true };
    if (g('set-name') != null) s.profile.name = String(g('set-name')).trim();
    if (g('set-minutes')) s.profile.dailyMinutes = U.clamp(Number(g('set-minutes')), 10, 120);
    if (g('set-target')) s.profile.targetDate = g('set-target');
    if (g('set-newperday') != null && g('set-newperday') !== '') {
      s.settings.newPerDay = U.clamp(Number(g('set-newperday')), 0, 40);
    }
    if (g('set-reviewcap')) s.settings.reviewCap = U.clamp(Number(g('set-reviewcap')), 10, 200);
    if (g('set-voice') != null) s.settings.voiceURI = g('set-voice');
    if (g('set-rate')) s.settings.rate = U.clamp(Number(g('set-rate')), 0.5, 1.5);

    NJ.S.save(s);
    UI.toast('Saved.');
    UI.render();
  };

  UI.actions['test-voice'] = function () {
    var s = st();
    var voiceEl = root.document.getElementById('set-voice');
    if (voiceEl) s.settings.voiceURI = voiceEl.value;
    var rateEl = root.document.getElementById('set-rate');
    if (rateEl) s.settings.rate = U.clamp(Number(rateEl.value), 0.5, 1.5);
    NJ.S.save(s);
    if (!UI.say(NJ.TTS.TEST, s, {})) return;
    UI.toast('Playing a test sentence.');
  };

  UI.actions['export-data'] = function () {
    var s = st();
    var text = NJ.S.exportText(s);
    var name = 'nihongo-studio-' + U.dayKey(new Date()) + '.json';
    U.download(name, text, 'application/json');
    UI.toast('Backup exported.');
  };

  UI.actions['import-data'] = function () {
    var input = root.document.getElementById('import-file');
    if (input) input.click();
  };

  UI.actions['reset-data'] = function () {
    UI.confirm('Start over?',
      'This deletes every card, word and writing attempt on this device. Export a backup first if you want it.',
      function () {
        NJ.S.reset();
        UI.toast('Reset. The plan is cleared too.');
        root.location.hash = '#/today';
        UI.render();
      }, 'Delete everything');
  };

  UI.actions['run-calibration'] = function () {
    var s = st();
    function begin() {
      s.diagnostic = null;
      NJ.S.save(s);
      root.location.hash = '#/calibrate';
      UI.render();
    }
    if (s.diagnostic && !s.diagnostic.done) {
      UI.confirm('Discard the calibration in progress?', 'Nothing has been applied yet.', begin, 'Discard');
      return;
    }
    if (s.diagnostic && s.diagnostic.done) {
      UI.confirm('Re-run calibration?',
        'The new result replaces the old one. Words already introduced keep their current cards.',
        begin, 'Re-run');
      return;
    }
    begin();
  };
})(typeof window !== 'undefined' ? window : globalThis);
