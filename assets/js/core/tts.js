/* tts.js — Japanese speech synthesis with a graceful silent mode.
 *
 * Voices are supplied by the device, never by this app. If no ja-JP voice is
 * installed, listening cards are deferred rather than lost, and the settings
 * screen explains how to install one. See INSTANCE.md / PLAN.md risk R3.
 */
(function (root) {
  'use strict';

  var NJ = (root.NJ = root.NJ || {});
  var TTS = (NJ.TTS = {});

  TTS.LANG = 'ja-JP';

  /** Preferred voice names across Windows, macOS, Chrome and Edge. */
  TTS.PREF = [
    'nanami', 'haruka', 'kyoko', 'otoya', 'ayumi', 'keita',
    'google 日本語', 'google japanese',
    'microsoft nanami', 'microsoft haruka', 'microsoft ayumi', 'microsoft keita',
    'o-ren', 'oren', 'hattori', 'voicevox'
  ];

  /** A test sentence with kanji, kana and a number (PORTING.md §8.4). */
  TTS.TEST = '北海道には、温泉が三百ぐらいあります。';

  var voices = [];
  var listeners = [];
  var loaded = false;
  var currentUtterance = null;

  function synth() {
    return root.speechSynthesis || null;
  }

  TTS.supported = function () { return !!synth(); };

  function refresh() {
    var s = synth();
    if (!s) return;
    var all = s.getVoices() || [];
    voices = all.filter(function (v) {
      return /^ja(\b|-|_)/i.test(v.lang || '') || /japanese|日本語/i.test(v.name || '');
    });
    loaded = true;
    listeners.splice(0).forEach(function (fn) { fn(TTS.list()); });
  }

  /** Resolve once the voice list is populated (browsers fill it asynchronously). */
  TTS.init = function (cb) {
    var s = synth();
    if (!s) { if (cb) cb([]); return; }
    if (cb) listeners.push(cb);
    refresh();
    if (!voices.length) {
      s.addEventListener('voiceschanged', refresh);
      // Some engines never fire the event; poll briefly, then give up quietly.
      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        refresh();
        if (voices.length || tries > 12) clearInterval(timer);
      }, 250);
    }
  };

  TTS.list = function () {
    return voices.map(function (v) { return { uri: v.voiceURI, name: v.name, lang: v.lang }; });
  };

  TTS.hasVoice = function () { return voices.length > 0; };

  TTS.pick = function (preferredURI) {
    if (!voices.length) return null;
    var i;
    if (preferredURI) {
      for (i = 0; i < voices.length; i++) {
        if (voices[i].voiceURI === preferredURI) return voices[i];
      }
    }
    for (var p = 0; p < TTS.PREF.length; p++) {
      for (i = 0; i < voices.length; i++) {
        if (String(voices[i].name || '').toLowerCase().indexOf(TTS.PREF[p]) >= 0) return voices[i];
      }
    }
    return voices[0];
  };

  TTS.currentName = function (preferredURI) {
    var v = TTS.pick(preferredURI);
    return v ? v.name : 'No Japanese voice';
  };

  function buildUtterance(text, opts) {
    var o = opts || {};
    var u = new root.SpeechSynthesisUtterance(String(text));
    var voice = TTS.pick(o.voiceURI);
    if (voice) u.voice = voice;
    u.lang = TTS.LANG;
    u.rate = Math.min(1.6, Math.max(0.5, Number(o.rate) || 0.9));
    u.pitch = 1;
    u.volume = 1;
    if (o.onend) u.onend = function () { currentUtterance = null; o.onend(); };
    if (o.onerror) u.onerror = function (ev) { currentUtterance = null; o.onerror(ev); };
    return u;
  }

  /** Speak Japanese. Returns false when there is no voice to speak with. */
  TTS.speak = function (text, opts) {
    var s = synth();
    if (!s || !text) return false;
    if (!voices.length) refresh();
    if (!voices.length) return false;
    var o = opts || {};
    try { s.cancel(); } catch (e) { /* ignore */ }
    var u = buildUtterance(text, o);
    currentUtterance = u;
    // Chrome sometimes swallows the very first utterance; a resume nudges it.
    try { s.resume(); } catch (e) { /* ignore */ }
    s.speak(u);
    return true;
  };

  TTS.cancel = function () {
    var s = synth();
    currentUtterance = null;
    if (s) { try { s.cancel(); } catch (e) { /* ignore */ } }
  };

  TTS.speaking = function () { return !!currentUtterance; };

  /** Rate used by the "listen again, slowly" control. */
  TTS.slowRate = function (rate) {
    return Math.max(0.5, (Number(rate) || 0.9) * 0.72);
  };
})(typeof window !== 'undefined' ? window : globalThis);
