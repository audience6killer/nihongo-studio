/* app.js — boot, routing, delegated events, theme and the service worker.
 *
 * Everything else hangs off window.NJ. Screens are pure functions of state;
 * this file is the only place that touches the document directly for routing.
 */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var APP = (NJ.APP = NJ.APP || {});
  var UI = NJ.UI;
  var U = NJ.U;
  var doc = root.document;

  var ROUTES = {
    today: 'today',
    chapters: 'chapters',
    lesson: 'lesson',
    session: 'session',
    stats: 'stats',
    settings: 'settings',
    calibrate: 'calibrate',
    exam: 'exam'
  };

  var NAV_OF = {
    today: 'today',
    chapters: 'chapters',
    lesson: 'chapters',
    session: 'today',
    stats: 'stats',
    settings: 'settings',
    calibrate: 'today',
    exam: 'today'
  };

  var screen = null;

  function state() { return NJ.S.load(); }

  APP.render = function () {
    var route = UI.currentRoute();
    var module = UI.screens[ROUTES[route.name] || 'today'] || UI.screens.today;
    var main = doc.getElementById('main');
    if (!main || !module) return;

    UI.closePopover();

    // Let the outgoing screen release timers, audio and listeners.
    if (screen && typeof screen.unmount === 'function') {
      try { screen.unmount(); } catch (err) { if (root.console) root.console.error(err); }
    }

    var html;
    try {
      html = module.render(route.arg);
    } catch (err) {
      main.innerHTML = errorCard(err);
      if (root.console) root.console.error(err);
      return;
    }

    main.innerHTML = html;
    window.scrollTo(0, 0);

    var nav = NAV_OF[route.name] || '';
    Array.prototype.forEach.call(doc.querySelectorAll('.nav a[data-nav]'), function (a) {
      if (a.getAttribute('data-nav') === nav) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    screen = module;
    if (typeof module.mount === 'function') {
      try { module.mount(route.arg); } catch (err) { if (root.console) root.console.error(err); }
    }
  };

  function errorCard(err) {
    return '<div class="page-head"><h1>Something went wrong</h1></div>' +
      '<div class="card"><p>The screen could not be drawn. Your saved progress is untouched.</p>' +
      '<p class="small" style="color:var(--ink-3)">' + U.esc(err && err.message ? err.message : String(err)) + '</p>' +
      '<div class="btn-row"><a class="btn btn--ghost" href="#/today">Back to Today</a></div></div>';
  }

  /* ------------------------------------------------------- delegated events */

  function closest(node, sel) {
    if (!node) return null;
    if (node.nodeType !== 1) node = node.parentElement;
    return node && node.closest ? node.closest(sel) : null;
  }

  function onClick(ev) {
    var actionEl = closest(ev.target, '[data-act]');

    if (!actionEl) {
      if (doc.querySelector('.popover')) UI.closePopover();
      return;
    }

    var name = actionEl.getAttribute('data-act');

    if (name === 'go') {
      ev.preventDefault();
      var to = actionEl.getAttribute('data-to') || '#/today';
      UI.go(to);
      return;
    }

    if (name === 'tap') {
      ev.preventDefault();
      ev.stopPropagation();
      UI.showTapPopover(actionEl, actionEl.getAttribute('data-tap'), state());
      return;
    }

    if (name === 'close-popover') {
      ev.preventDefault();
      UI.closePopover();
      return;
    }

    if (name === 'say') {
      ev.preventDefault();
      UI.say(actionEl.getAttribute('data-text') || '', state(), {});
      return;
    }

    var handler = UI.actions[name];
    if (!handler) {
      if (root.console) root.console.warn('No action for', name);
      return;
    }
    ev.preventDefault();
    handler(ev, actionEl);
  }

  function onSubmit(ev) {
    var form = closest(ev.target, 'form[data-act]');
    if (!form) return;
    var handler = UI.actions[form.getAttribute('data-act')];
    if (!handler) return;
    handler(ev, form);
  }

  function onKeyDown(ev) {
    if (ev.key === 'Escape') {
      if (doc.querySelector('.popover')) { UI.closePopover(); return; }
      if (UI.isModalOpen()) { UI.closeModal(); return; }
    }
    if (UI.isModalOpen()) return;
    if (screen && typeof screen.onKey === 'function') {
      if (screen.onKey(ev)) ev.preventDefault();
    }
  }

  function onScroll() {
    if (doc.querySelector('.popover')) UI.closePopover();
  }

  /* ------------------------------------------------------------------ theme */

  function applyChrome() {
    var s = state();
    var theme = (s.settings && s.settings.theme) || 'auto';
    var html = doc.documentElement;
    if (theme === 'light' || theme === 'dark') html.setAttribute('data-theme', theme);
    else html.removeAttribute('data-theme');
    html.setAttribute('data-motion', (s.settings && s.settings.reduceMotion) ? 'reduce' : '');
    var meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) {
      var dark = theme === 'dark' || (theme === 'auto' && root.matchMedia &&
        root.matchMedia('(prefers-color-scheme: dark)').matches);
      meta.setAttribute('content', dark ? '#16130f' : '#f7f3ea');
    }
  }

  /* ------------------------------------------------------------------- boot */

  function registerWorker() {
    if (!('serviceWorker' in root.navigator)) return;
    var host = root.location.hostname;
    var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    if (isLocal || root.location.protocol === 'file:') return;
    if (String(root.location.search).indexOf('nosw') >= 0) return;
    root.navigator.serviceWorker.register('sw.js').catch(function () {
      /* Offline support is a bonus; failing to register must not break the app. */
    });
  }

  function boot() {
    if (!NJ.D.ready()) NJ.D.init();
    NJ.S.load();
    applyChrome();

    doc.addEventListener('click', onClick, false);
    doc.addEventListener('submit', onSubmit, false);
    doc.addEventListener('keydown', onKeyDown, false);
    root.addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('hashchange', function () {
      applyChrome();
      APP.render();
    });

    if (!root.location.hash) root.location.hash = '#/today';
    APP.render();

    // Voices arrive asynchronously in most browsers; redraw once they land so
    // the listening warning disappears without a manual reload.
    var hadVoices = NJ.TTS.hasVoice();
    NJ.TTS.init(function () {
      var s = state();
      if (!s.settings.voiceURI && NJ.TTS.hasVoice()) {
        var pick = NJ.TTS.pick('');
        if (pick) s.settings.voiceURI = pick.voiceURI;
        NJ.S.save(s);
      }
      if (!hadVoices && NJ.TTS.hasVoice()) {
        hadVoices = true;
        APP.render();
      }
    });

    registerWorker();

    var meta = state().meta;
    meta.storage = 'local';
    meta.configAt = (root.NJ_CONFIG && root.NJ_CONFIG.builtAt) || '';
    NJ.S.save(state());
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
