/* components.js — shared rendering helpers, toasts, the modal, tap-to-define
 * and the action registry used by delegated events.
 *
 * Screens render pure HTML strings and expose mount() for anything stateful.
 */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var UI = (NJ.UI = NJ.UI || {});
  var U = NJ.U;

  UI.screens = UI.screens || {};
  UI.actions = UI.actions || {};

  UI.esc = U.esc;

  /* ---------------------------------------------------------------- routing */

  UI.go = function (hash) {
    if (root.location.hash === hash) UI.render();
    else root.location.hash = hash;
  };

  UI.currentRoute = function () {
    var h = String(root.location.hash || '#/today').replace(/^#/, '');
    if (!h || h === '/') h = '/today';
    var parts = h.split('/').filter(Boolean);
    return { name: parts[0] || 'today', arg: parts[1] || null, raw: h };
  };

  /* ----------------------------------------------------------------- toasts */

  UI.toast = function (message, kind) {
    var host = root.document.getElementById('toasts');
    if (!host) return;
    var el = root.document.createElement('div');
    el.className = 'toast' + (kind === 'warn' ? ' toast--warn' : '');
    el.textContent = message;
    host.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 260);
    }, kind === 'warn' ? 5200 : 2600);
  };

  /* ------------------------------------------------------------------ modal */

  var modalOpen = false;

  UI.modal = function (opts) {
    var host = root.document.getElementById('modal-root');
    if (!host) return;
    var o = opts || {};
    var actions = (o.actions || []).map(function (a, i) {
      return '<button class="btn ' + (a.primary ? 'btn--primary' : 'btn--ghost') + '" data-modal-act="' + i + '">' +
        UI.esc(a.label) + '</button>';
    }).join('');
    host.innerHTML =
      '<div class="modal-backdrop" data-modal-close="1">' +
        '<div class="modal" role="dialog" aria-modal="true" aria-label="' + UI.esc(o.title || 'Dialog') + '">' +
          (o.title ? '<h2>' + UI.esc(o.title) + '</h2>' : '') +
          '<div class="modal-body">' + (o.body || '') + '</div>' +
          (actions ? '<div class="btn-row btn-row--end" style="margin-top:1.1rem">' + actions + '</div>' : '') +
        '</div>' +
      '</div>';
    modalOpen = true;
    UI._modalActions = o.actions || [];
    var backdrop = host.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function (ev) {
        if (ev.target === backdrop && o.dismissible !== false) UI.closeModal();
      });
    }
    var buttons = host.querySelectorAll('[data-modal-act]');
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () {
        var action = UI._modalActions[Number(btn.getAttribute('data-modal-act'))];
        if (action && action.fn) action.fn();
        if (!action || action.keepOpen !== true) UI.closeModal();
      });
    });
    var focusable = host.querySelector('input, button');
    if (focusable) setTimeout(function () { focusable.focus(); }, 30);
    return host;
  };

  UI.closeModal = function () {
    var host = root.document.getElementById('modal-root');
    if (host) host.innerHTML = '';
    modalOpen = false;
    UI._modalActions = [];
  };

  UI.confirm = function (title, body, onYes, yesLabel) {
    UI.modal({
      title: title,
      body: '<p>' + UI.esc(body) + '</p>',
      actions: [
        { label: 'Cancel' },
        { label: yesLabel || 'Confirm', primary: true, fn: onYes }
      ]
    });
  };

  UI.isModalOpen = function () { return modalOpen; };

  /* --------------------------------------------------------------- fragments */

  UI.bar = function (pct) {
    var p = Math.max(0, Math.min(100, Math.round(pct || 0)));
    return '<div class="progress" role="progressbar" aria-valuenow="' + p + '" aria-valuemin="0" aria-valuemax="100">' +
      '<i style="width:' + p + '%"></i></div>';
  };

  UI.skillPill = function (skill) {
    var label = NJ.SRS.SKILL_LABEL[skill] || skill;
    return '<span class="pill pill--' + skill + '">' + label + '</span>';
  };

  UI.stat = function (value, label, warn) {
    return '<div class="stat' + (warn ? ' stat--warn' : '') + '"><b>' + UI.esc(value) + '</b><span>' + UI.esc(label) + '</span></div>';
  };

  UI.chapterNum = function (n, stateKind) {
    return '<span class="chapter-num"' + (stateKind ? ' data-state="' + stateKind + '"' : '') + '>' + n + '</span>';
  };

  /* ---------------------------------------------------------------- Japanese */

  UI.furiganaOn = function (state) {
    return !!(state && state.settings && state.settings.furigana);
  };

  /** A single term, with furigana when the learner has turned it on. */
  UI.jpWord = function (term, reading, state) {
    if (UI.furiganaOn(state) && reading) return NJ.L.ruby(term, reading);
    return UI.esc(term);
  };

  /**
   * Render a Japanese text as tappable tokens.
   * Tokens that resolve in the dictionary become buttons; anything else stays
   * plain text so a gap never breaks the page.
   */
  UI.tappable = function (text, state, opts) {
    var o = opts || {};
    var entries = NJ.D.entries || {};
    var segs = NJ.L.segment(text, entries);
    var html = '';
    for (var i = 0; i < segs.length; i++) {
      var tok = segs[i].t;
      var entry = entries[tok];
      if (!entry) {
        html += UI.esc(tok);
        continue;
      }
      var inner = UI.furiganaOn(state) && entry.r && NJ.L.hasKanji(tok)
        ? NJ.L.ruby(tok, entry.r)
        : UI.esc(tok);
      html += '<button type="button" class="tok" data-act="tap" data-tap="' + UI.esc(tok) +
        '" aria-label="' + UI.esc(tok + ' — ' + (entry.r || '') + ' — ' + (entry.g || '')) + '">' +
        inner + '</button>';
    }
    void o;
    return html;
  };

  UI.passage = function (text, state) {
    return '<div class="passage" lang="ja">' + UI.tappable(text, state) + '</div>';
  };

  var popoverEl = null;

  UI.closePopover = function () {
    if (popoverEl && popoverEl.parentNode) popoverEl.parentNode.removeChild(popoverEl);
    popoverEl = null;
  };

  UI.showTapPopover = function (anchor, term, state) {
    UI.closePopover();
    var entry = (NJ.D.entries || {})[term];
    if (!entry) return;
    var el = U.el(
      '<div class="popover" role="dialog" aria-label="' + UI.esc(term) + '">' +
        '<button type="button" class="btn btn--quiet btn--sm p-close" data-act="close-popover" aria-label="Close">✕</button>' +
        '<div class="p-term" lang="ja">' + UI.esc(term) + '</div>' +
        '<div class="p-reading" lang="ja">' + UI.esc(entry.r || '') + '</div>' +
        '<div class="p-gloss">' + UI.esc(entry.g || '') + ' <span class="pos">' + UI.esc(entry.p || '') + '</span></div>' +
        '<div class="p-actions">' +
          '<button type="button" class="btn btn--ghost btn--sm" data-act="say" data-text="' + UI.esc(term) + '">Listen</button>' +
        '</div>' +
      '</div>'
    );
    root.document.body.appendChild(el);
    popoverEl = el;

    var rect = anchor.getBoundingClientRect();
    var vw = root.innerWidth || 360;
    var vh = root.innerHeight || 640;
    var w = el.offsetWidth || 260;
    var h = el.offsetHeight || 120;
    var left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), vw - w - 8);
    var top = rect.bottom + root.scrollY + 8;
    if (rect.bottom + h + 16 > vh) top = rect.top + root.scrollY - h - 8;
    el.style.left = left + 'px';
    el.style.top = Math.max(8, top) + 'px';
    el.style.position = 'absolute';
  };

  /* ------------------------------------------------------------------ audio */

  UI.say = function (text, state, opts) {
    var o = opts || {};
    var settings = (state && state.settings) || {};
    var ok = NJ.TTS.speak(text, { voiceURI: settings.voiceURI, rate: o.rate || settings.rate });
    if (!ok) {
      UI.toast('No Japanese voice installed — see Settings.', 'warn');
      return false;
    }
    return true;
  };

  /* ---------------------------------------------------------------- options */

  /**
   * Multiple-choice list. `chosen` is the index the learner picked (or null),
   * `answer` is the correct index (or -1 to hide the truth until graded).
   * Labels are escaped unless opts.html is set, in which case they are trusted
   * HTML (the lesson screens pass tappable tokens).
   */
  UI.options = function (options, chosen, answer, opts) {
    var o = opts || {};
    var revealed = chosen != null;
    var keys = ['A', 'B', 'C', 'D', 'E', 'F'];
    return '<ul class="options">' + options.map(function (label, i) {
      var stateAttr = '';
      if (revealed && !o.hideTruth) {
        if (i === answer) stateAttr = ' data-state="correct"';
        else if (i === chosen) stateAttr = ' data-state="wrong"';
        else stateAttr = ' data-state="dim"';
      }
      var disabled = revealed || o.disabled;
      var body = o.html ? label : UI.esc(label);
      return '<li>' +
        '<button type="button" class="option" data-act="pick" data-i="' + i + '"' +
          (disabled ? ' disabled' : '') + stateAttr + '>' +
          '<span class="option-key" aria-hidden="true">' + keys[i] + '</span>' +
          '<span class="option-body" lang="' + (o.lang || 'en') + '">' + body + '</span>' +
        '</button>' +
      '</li>';
    }).join('') + '</ul>';
  };

  /* ------------------------------------------------------------------ misc */

  UI.empty = function (title, message, jaLine) {
    return '<div class="empty">' +
      (jaLine ? '<div class="ja-display ja-display--sm" lang="ja">' + UI.esc(jaLine) + '</div>' : '') +
      '<p><strong>' + UI.esc(title) + '</strong></p>' +
      '<p class="small">' + message + '</p>' +
      '</div>';
  };

  UI.field = function (label, inputHTML, hint) {
    return '<label class="field"><span>' + UI.esc(label) + '</span>' + inputHTML +
      (hint ? '<span class="hint">' + hint + '</span>' : '') + '</label>';
  };

  UI.toggle = function (id, checked, label, hint) {
    return '<div class="switch">' +
      '<span class="label">' + UI.esc(label) + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</span>' +
      '<button type="button" class="toggle" role="switch" aria-checked="' + (checked ? 'true' : 'false') +
        '" data-act="toggle-setting" data-key="' + UI.esc(id) + '" aria-label="' + UI.esc(label) + '"></button>' +
    '</div>';
  };

  UI.render = function () {
    if (NJ.APP && NJ.APP.render) NJ.APP.render();
  };
})(typeof window !== 'undefined' ? window : globalThis);
