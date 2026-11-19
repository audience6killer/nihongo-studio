/* Cross-device sync through a Supabase project.
 *
 * Adapted from this project's Chinese sibling instance (provenance is recorded in PLAN.md; the
 * instance-isolation check keeps that name out of shipped code).
 * The design is unchanged: local-first, so every answer is still written to
 * localStorage first; the cloud holds a sanitised snapshot with a revision
 * number; on conflict the two snapshots are merged field by field so a session
 * on the phone and a session on the work laptop do not erase each other.
 *
 * Auth: email + password through Supabase's GoTrue REST endpoints.
 * Storage: public.progress, one row per auth user, RLS protected.
 */
(function (root) {
  const NJ = (root.NJ = root.NJ || {});
  const U = NJ.U;
  const S = (NJ.sync = {});
  const TIMEOUT = 20000;
  const offline = () => typeof navigator !== "undefined" && navigator.onLine === false;

  let pushTimer = null;
  let busy = false;
  let applying = false;

  S.state = { syncing: false, lastError: "", lastSyncAt: 0, lastResult: "" };

  function state() {
    return NJ.S.state();
  }

  function today() {
    return U.dayKey(new Date());
  }

  function refresh() {
    if (NJ.APP && NJ.APP.render) NJ.APP.render();
  }

  function config() {
    const s = state();
    return (s && s.meta && s.meta.sync) || null;
  }
  S.config = config;
  S.configured = () => !!(S.siteConfig() || (config() && config().url && config().anonKey));
  S.signedIn = () => !!(config() && config().accessToken && config().refreshToken);

  /* Build-time defaults written into assets/js/data/config.js at deploy time.
   * The anon/publishable key is public by design; Row Level Security protects
   * the row. When present this wins over anything typed on a device, so the
   * project is configured once (Netlify env vars) instead of per device. */
  S.siteConfig = function () {
    const raw = root.NJ_CONFIG || null;
    if (!raw) return null;
    const url = String(raw.supabaseUrl || "").trim().replace(/\/+$/, "");
    const anonKey = String(raw.supabaseAnonKey || "").trim();
    if (!url || !anonKey) return null;
    return { url, anonKey };
  };
  S.usesSiteConfig = () => !!S.siteConfig();

  S.applySiteConfig = function () {
    const site = S.siteConfig();
    if (!site) return false;
    const c = config();
    if (c && c.url === site.url && c.anonKey === site.anonKey) return false;
    /* A different project means the saved session token belongs to the old
     * project and must not be sent to the new one. */
    const moved = !!(c && c.url && c.url !== site.url);
    const patch = { url: site.url, anonKey: site.anonKey };
    if (moved) Object.assign(patch, {
      accessToken: "", refreshToken: "", expiresAt: 0, baseRev: 0, lastSyncAt: 0, lastError: ""
    });
    saveConfig(patch);
    S.state.lastError = "";
    S.state.lastSyncAt = moved ? 0 : S.state.lastSyncAt;
    return true;
  };

  function saveConfig(patch) {
    const s = state();
    s.meta = s.meta || {};
    s.meta.sync = Object.assign({}, s.meta.sync || {}, patch);
    NJ.S.save(s);
  }

  /* Merge partial settings into the current connection. The site-config path
   * calls this with only email/enabled, so omitted fields must survive. The
   * baked project also acts as the fallback if meta.sync was never applied. */
  S.saveConfig = function (opts) {
    opts = opts || {};
    const current = config() || {};
    const site = S.siteConfig() || {};
    const url = String(opts.url !== undefined ? opts.url : (site.url || current.url || "")).trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(url)) throw new Error("The project URL must start with https://");
    const patch = {
      url,
      anonKey: String(opts.anonKey !== undefined ? opts.anonKey : (site.anonKey || current.anonKey || "")).trim(),
      email: String(opts.email !== undefined ? opts.email : current.email || "").trim(),
      enabled: opts.enabled === undefined ? current.enabled !== false : opts.enabled !== false
    };
    /* A new project must not receive the old project's session token. */
    if (current.url && current.url !== url) {
      Object.assign(patch, { accessToken: "", refreshToken: "", expiresAt: 0, baseRev: 0, lastSyncAt: 0, lastError: "" });
    }
    saveConfig(patch);
  };

  S.disconnect = function () {
    saveConfig({ url: "", anonKey: "", email: "", accessToken: "", refreshToken: "", expiresAt: 0, baseRev: 0, lastError: "" });
    S.state.lastError = "";
  };

  function sanitize(st) {
    const copy = JSON.parse(JSON.stringify(st));
    if (copy.meta) delete copy.meta.sync;
    return copy;
  }
  S.sanitize = sanitize;

  /* ---------------- compact transport ----------------
   * A mature state approaches 1 MB. gzip keeps the Supabase row and request
   * small. Browsers without CompressionStream use the plain object; the pull
   * side handles both.
   */
  const HAS_GZIP = typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";
  const GZIP_MARK = "__nj";

  function bytesToBase64(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(out);
  }

  function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function packState(st) {
    const clean = sanitize(st);
    if (!HAS_GZIP) return clean;
    try {
      const input = new Blob([new TextEncoder().encode(JSON.stringify(clean))]);
      const stream = input.stream().pipeThrough(new CompressionStream("gzip"));
      const buf = await new Response(stream).arrayBuffer();
      return { [GZIP_MARK]: "gzip", data: bytesToBase64(new Uint8Array(buf)) };
    } catch (e) {
      return clean;
    }
  }

  async function unpackState(st) {
    if (!st || typeof st !== "object" || st[GZIP_MARK] !== "gzip") return st;
    if (typeof DecompressionStream === "undefined") {
      throw new Error("This browser cannot read the compressed cloud copy. Update the browser and sync again.");
    }
    const stream = new Blob([base64ToBytes(st.data)]).stream().pipeThrough(new DecompressionStream("gzip"));
    const text = await new Response(stream).text();
    return JSON.parse(text);
  }

  /* ---------------- errors ---------------- */
  function authError(msg) {
    const e = new Error(msg || "Sign in first.");
    e.code = "AUTH_REQUIRED";
    return e;
  }

  function messageFrom(data, res) {
    if (!data) return res.statusText || ("HTTP " + res.status);
    return data.message || data.msg || data.error_description || data.error || data.details || ("HTTP " + res.status);
  }

  function friendly(e) {
    const msg = String((e && e.message) || e || "");
    if (/failed to fetch|networkerror|load failed/i.test(msg)) return "Network error. Check the connection and the project URL.";
    if (/email logins are disabled/i.test(msg)) return "Email sign-in is disabled in Supabase. Authentication → Sign In / Providers → Email → enable the Email provider.";
    if (/signups not allowed|signup.*disabled/i.test(msg)) return "Account creation is disabled in Supabase. Authentication → Sign In / Providers → enable “Allow new users to sign up”, create the account, then turn it off again.";
    if (/invalid login credentials/i.test(msg)) return "Email or password is incorrect. If this is your first time, use Create account.";
    if (/email not confirmed/i.test(msg)) return "Confirm your email first, then sign in.";
    if (/user already registered/i.test(msg)) return "That email already has an account. Sign in instead.";
    if (/relation .*progress.* does not exist/i.test(msg)) return "The progress table is missing. Run supabase/schema.sql in the SQL editor.";
    if (/function .*save_progress.* does not exist/i.test(msg)) return "The save function is missing. Run supabase/schema.sql.";
    if (/jwt|token.*expired|invalid.*token/i.test(msg)) return "The session expired. Sign in again.";
    return msg;
  }
  S.friendly = friendly;

  /* ---------------- HTTP ---------------- */
  async function ensureAuth() {
    const c = config();
    if (!c) throw authError("Connect a Supabase project first.");
    if (c.accessToken && (c.expiresAt || 0) - 60000 > Date.now()) return c.accessToken;
    if (c.refreshToken) return refreshToken();
    throw authError("Sign in to sync.");
  }
  S.ensureAuth = ensureAuth;

  async function refreshToken() {
    const c = config();
    if (!c || !c.refreshToken) throw authError("Sign in again.");
    const data = await request("/auth/v1/token?grant_type=refresh_token", {
      method: "POST", auth: false, body: { refresh_token: c.refreshToken }
    });
    if (!data.access_token) throw authError("Could not refresh the session. Sign in again.");
    saveSession(data);
    return data.access_token;
  }

  function saveSession(data) {
    const session = data.session || data;
    const token = session.access_token || data.access_token;
    const refreshTok = session.refresh_token || data.refresh_token;
    if (!token) return false;
    const user = data.user || session.user || {};
    saveConfig({
      accessToken: token,
      refreshToken: refreshTok,
      expiresAt: Date.now() + ((session.expires_in || data.expires_in || 3600) * 1000),
      email: user.email || (config() && config().email) || ""
    });
    return true;
  }

  async function request(path, opts) {
    opts = opts || {};
    const c = config();
    if (!c || !c.url) throw authError("Connect a Supabase project first.");
    if (opts.auth && !opts.token) opts.token = await ensureAuth();
    const headers = { apikey: c.anonKey };
    if (opts.auth) headers.Authorization = "Bearer " + opts.token;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    let res;
    try {
      res = await fetch(c.url + path, {
        method: opts.method || "GET",
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: ctrl.signal,
        cache: "no-store"
      });
    } catch (e) {
      const err = new Error("Network error. Check the connection and the project URL.");
      err.code = "NETWORK";
      err.cause = e;
      throw err;
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (res.status === 401 && opts.auth && !opts.retried && config().refreshToken) {
      await refreshToken();
      return request(path, Object.assign({}, opts, { retried: true, token: null }));
    }
    if (!res.ok) {
      const err = new Error(messageFrom(data, res));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /* ---------------- auth API ---------------- */
  S.signUp = async function (email, password) {
    if (!email || !password) throw new Error("Email and password are required.");
    if (password.length < 6) throw new Error("Use a password of at least six characters.");
    const data = await request("/auth/v1/signup", { method: "POST", auth: false, body: { email, password } });
    const hadSession = saveSession(data);
    if (!hadSession) {
      saveConfig({ email });
      return { needsConfirmation: true };
    }
    return { signedIn: true, email };
  };

  S.signIn = async function (email, password) {
    if (!email || !password) throw new Error("Email and password are required.");
    const data = await request("/auth/v1/token?grant_type=password", {
      method: "POST", auth: false, body: { email, password }
    });
    if (!saveSession(data)) throw new Error("Sign-in succeeded but no session was returned.");
    return { signedIn: true, email };
  };

  S.signOut = async function () {
    try {
      if (S.signedIn()) await request("/auth/v1/logout", { method: "POST", auth: true });
    } catch (e) { /* the token may already be dead */ }
    saveConfig({ accessToken: "", refreshToken: "", expiresAt: 0 });
  };

  /* ---------------- state API ---------------- */
  async function pull() {
    const rows = await request("/rest/v1/progress?select=rev,state,updated_at&limit=1", { auth: true });
    if (!Array.isArray(rows) || !rows.length) return null;
    return { rev: Number(rows[0].rev), state: await unpackState(rows[0].state), updatedAt: rows[0].updated_at };
  }

  async function push(st, baseRev) {
    const packed = await packState(st);
    const rows = await request("/rest/v1/rpc/save_progress", {
      method: "POST", auth: true, body: { p_state: packed, p_base_rev: Number(baseRev) || 0 }
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) throw new Error("The sync function returned no row.");
    return { rev: Number(row.rev), state: row.state, conflict: !!row.conflict };
  }

  /* ---------------- merge ---------------- */
  const num = (x) => (typeof x === "number" && isFinite(x) ? x : 0);
  const later = (a, b, key) => (num(b && b[key]) > num(a && a[key]) ? b : a);

  function studiedCount(st) {
    if (!st) return 0;
    return Object.keys(st.words || {}).length * 5 + Object.keys(st.lessons || {}).length + Object.keys(st.days || {}).length;
  }

  /* A diagnostic's recency is when it finished; this app has no `at`. */
  const diagAt = (d) => num(d && (d.finishedAt || d.startedAt));

  function richer(a, b) {
    if (a && !a.profile && b && b.profile) return b;
    if (b && !b.profile && a && a.profile) return a;
    const pa = studiedCount(a);
    const pb = studiedCount(b);
    if (pa === 0 && pb > 0) return b;
    if (pb === 0 && pa > 0) return a;
    if (pa !== pb) return pb > pa ? b : a;
    const ac = num(a && a.meta && a.meta.configAt);
    const bc = num(b && b.meta && b.meta.configAt);
    if (ac !== bc) return bc > ac ? b : a;
    return num(b && b.meta && b.meta.lastOpen) > num(a && a.meta && a.meta.lastOpen) ? b : a;
  }

  function mergeStates(a, b) {
    if (!a) return JSON.parse(JSON.stringify(b || {}));
    if (!b) return JSON.parse(JSON.stringify(a));
    const base = richer(a, b);
    const out = JSON.parse(JSON.stringify(base));

    out.version = Math.max(num(a.version), num(b.version), 1);
    out.app = base.app || a.app || b.app || "ja";
    out.createdAt = [a.createdAt, b.createdAt].filter(Boolean).sort()[0] || base.createdAt;
    out.onboarded = !!(a.onboarded || b.onboarded);
    out.profile = base.profile || a.profile || b.profile || null;
    out.settings = Object.assign({}, (a.settings || {}), (b.settings || {}), (base.settings || {}));
    out.diagnostic = (diagAt(b.diagnostic) > diagAt(a.diagnostic) ? b.diagnostic : a.diagnostic) || base.diagnostic || null;

    out.words = {};
    const wordKeys = new Set(Object.keys(a.words || {}).concat(Object.keys(b.words || {})));
    for (const key of wordKeys) {
      const wa = a.words && a.words[key], wb = b.words && b.words[key];
      if (!wa) { out.words[key] = wb; continue; }
      if (!wb) { out.words[key] = wa; continue; }
      const chosen = later(wa, wb, "lastSeen");
      out.words[key] = Object.assign({}, chosen, {
        seen: Math.max(num(wa.seen), num(wb.seen)),
        correct: Math.max(num(wa.correct), num(wb.correct)),
        lapses: Math.max(num(wa.lapses), num(wb.lapses)),
        introducedAt: Math.min(...[wa.introducedAt, wb.introducedAt].filter(Boolean)) || chosen.introducedAt
      });
    }

    /* A card is one review, not a total: take the later review wholesale. */
    out.cards = {};
    const cardKeys = new Set(Object.keys(a.cards || {}).concat(Object.keys(b.cards || {})));
    for (const key of cardKeys) {
      const ca = a.cards && a.cards[key], cb = b.cards && b.cards[key];
      if (!ca) { out.cards[key] = cb; continue; }
      if (!cb) { out.cards[key] = ca; continue; }
      const chosen = later(ca, cb, "last");
      out.cards[key] = Object.assign({}, chosen, {
        reps: Math.max(num(ca.reps), num(cb.reps)),
        lapses: Math.max(num(ca.lapses), num(cb.lapses))
      });
    }

    /* Lesson stages are flags plus one timestamp in this app. */
    out.lessons = {};
    const lessonKeys = new Set(Object.keys(a.lessons || {}).concat(Object.keys(b.lessons || {})));
    for (const key of lessonKeys) {
      const la = a.lessons && a.lessons[key], lb = b.lessons && b.lessons[key];
      if (!la) { out.lessons[key] = lb; continue; }
      if (!lb) { out.lessons[key] = la; continue; }
      const stages = Object.assign({}, la.stages || {}, lb.stages || {});
      for (const k of Object.keys(stages)) stages[k] = !!(stages[k]);
      const completed = [la.completedAt, lb.completedAt].filter(Boolean);
      out.lessons[key] = {
        stages,
        stageAt: Math.max(num(la.stageAt), num(lb.stageAt)),
        startedAt: [la.startedAt, lb.startedAt].filter(Boolean).sort()[0],
        completedAt: completed.length ? Math.min.apply(null, completed) : undefined
      };
    }

    /* Daily counters are per-day totals: max avoids double counting a day
     * studied on two devices. */
    out.days = {};
    const dayKeys = new Set(Object.keys(a.days || {}).concat(Object.keys(b.days || {})));
    for (const key of dayKeys) {
      const da = a.days && a.days[key], db = b.days && b.days[key];
      if (!da) { out.days[key] = db; continue; }
      if (!db) { out.days[key] = da; continue; }
      out.days[key] = {
        minutes: Math.max(num(da.minutes), num(db.minutes)),
        reviews: Math.max(num(da.reviews), num(db.reviews)),
        newWords: Math.max(num(da.newWords), num(db.newWords)),
        correct: Math.max(num(da.correct), num(db.correct)),
        total: Math.max(num(da.total), num(db.total)),
        sessions: Math.max(num(da.sessions), num(db.sessions)),
        items: Math.max(num(da.items), num(db.items))
      };
    }

    const sessions = new Map();
    (a.sessions || []).concat(b.sessions || []).forEach((x) => {
      const k = String(x.id || ((x.date || "") + "|" + (x.startedAt || "")));
      if (!sessions.has(k)) sessions.set(k, x);
    });
    out.sessions = Array.from(sessions.values())
      .sort((x, y) => num(x.startedAt || x.finishedAt) - num(y.startedAt || y.finishedAt)).slice(-400);

    const exams = new Map();
    (a.exams || []).concat(b.exams || []).forEach((x) => {
      const k = String(x.id || ((x.at || "") + "|" + (x.blockId || "")));
      if (!exams.has(k)) exams.set(k, x);
    });
    out.exams = Array.from(exams.values()).sort((x, y) => num(x.at) - num(y.at)).slice(-40);

    const writing = new Map();
    (a.writing || []).concat(b.writing || []).forEach((x) => {
      const k = String(x.at || ((x.date || "") + "|" + (x.lesson || "")));
      if (!writing.has(k)) writing.set(k, x);
    });
    out.writing = Array.from(writing.values()).sort((x, y) => num(x.at) - num(y.at)).slice(-300);

    out.skillStats = {};
    for (const skill of ["rec", "prod", "listen"]) {
      const sa = (a.skillStats || {})[skill] || {}, sb = (b.skillStats || {})[skill] || {};
      out.skillStats[skill] = {
        seen: Math.max(num(sa.seen), num(sb.seen)),
        correct: Math.max(num(sa.correct), num(sb.correct))
      };
    }

    const ca = a.current, cb = b.current;
    if (!ca) out.current = cb || null;
    else if (!cb) out.current = ca;
    else if (!!ca.done !== !!cb.done) out.current = ca.done ? cb : ca;
    else out.current = later(ca, cb, "startedAt");

    out.meta = Object.assign({}, (base.meta || {}));
    out.meta.lastOpen = Math.max(num(a.meta && a.meta.lastOpen), num(b.meta && b.meta.lastOpen), Date.now());
    out.meta.configAt = Math.max(num(a.meta && a.meta.configAt), num(b.meta && b.meta.configAt));
    out.meta.storage = "local";
    out.meta.mergedAt = Date.now();
    delete out.meta.sync;
    return out;
  }
  S.mergeStates = mergeStates;

  /* ---------------- apply / sync ---------------- */
  function applyState(merged) {
    const local = state();
    const sync = local.meta && local.meta.sync;
    merged.meta = merged.meta || {};
    merged.meta.sync = sync;
    applying = true;
    try {
      NJ.S.replace(merged);
      const settings = merged.settings || {};
      if (settings.theme && settings.theme !== "auto") {
        document.documentElement.setAttribute("data-theme", settings.theme);
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
      document.documentElement.setAttribute("data-motion", settings.reduceMotion ? "reduce" : "");
    } finally {
      applying = false;
    }
  }

  function sameState(x, y) {
    try {
      const a = sanitize(x), b = sanitize(y);
      for (const s of [a, b]) {
        if (s.meta) { delete s.meta.lastOpen; delete s.meta.mergedAt; }
      }
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
      return false;
    }
  }

  S.syncNow = async function (opts) {
    opts = opts || {};
    if (!S.configured()) throw new Error("Cloud sync is not configured.");
    if (!S.signedIn()) throw new Error("Sign in to sync.");
    if (busy) return { ok: false, skipped: true };
    if (offline()) throw new Error("Offline. Local progress is safe and will sync when the connection returns.");
    const local = state();
    const cur = local.current;
    if (cur && !cur.done && cur.date === today()) throw new Error("Finish or exit the current session before syncing.");
    busy = true;
    S.state.syncing = true;
    S.state.lastError = "";
    clearTimeout(pushTimer);
    try {
      const remote = await pull();
      let changed = false;
      let rev = 0;
      if (!remote) {
        const res = await push(local, 0);
        rev = res.rev;
      } else {
        let merged = mergeStates(local, remote.state);
        merged.meta.sync = local.meta && local.meta.sync;
        if (!sameState(local, merged)) { applyState(merged); changed = true; }
        let res = await push(state(), remote.rev);
        rev = res.rev;
        let attempts = 0;
        while (res.conflict && attempts < 2) {
          attempts++;
          const again = await pull();
          if (!again) throw new Error("The cloud row disappeared during sync.");
          merged = mergeStates(state(), again.state);
          merged.meta.sync = state().meta && state().meta.sync;
          if (!sameState(state(), merged)) { applyState(merged); changed = true; }
          res = await push(state(), again.rev);
          rev = res.rev;
        }
        if (res.conflict) throw new Error("The cloud copy kept changing. Try syncing again.");
      }
      saveConfig({ baseRev: rev, lastSyncAt: Date.now(), lastError: "" });
      S.state.lastSyncAt = Date.now();
      S.state.lastError = "";
      S.state.lastResult = changed ? "Merged changes" : "Up to date";
      if (changed && !opts.silent) refresh();
      return { ok: true, rev, changed };
    } catch (e) {
      const msg = friendly(e);
      S.state.lastError = msg;
      saveConfig({ lastError: msg });
      throw new Error(msg);
    } finally {
      busy = false;
      S.state.syncing = false;
    }
  };

  S.upload = async function () {
    if (!S.configured() || !S.signedIn()) throw new Error("Sign in first.");
    if (busy) throw new Error("A sync is already running.");
    const cur = state().current;
    if (cur && !cur.done && cur.date === today()) throw new Error("Finish or exit the current session before uploading.");
    busy = true;
    try {
      const remote = await pull();
      let res = await push(state(), remote ? remote.rev : 0);
      let attempts = 0;
      while (res.conflict && attempts < 2) {
        attempts++;
        const again = await pull();
        res = await push(state(), again ? again.rev : 0);
      }
      if (res.conflict) throw new Error("The cloud copy changed during upload. Try again.");
      saveConfig({ baseRev: res.rev, lastSyncAt: Date.now(), lastError: "" });
      S.state.lastSyncAt = Date.now();
      S.state.lastError = "";
      return { rev: res.rev };
    } finally {
      busy = false;
    }
  };

  S.download = async function () {
    if (!S.configured() || !S.signedIn()) throw new Error("Sign in first.");
    if (busy) throw new Error("A sync is already running.");
    const cur = state().current;
    if (cur && !cur.done && cur.date === today()) throw new Error("Finish or exit the current session before downloading.");
    busy = true;
    try {
      const remote = await pull();
      if (!remote) throw new Error("There is no cloud copy yet. Upload this device first.");
      applyState(remote.state);
      saveConfig({ baseRev: remote.rev, lastSyncAt: Date.now(), lastError: "" });
      S.state.lastSyncAt = Date.now();
      S.state.lastError = "";
      refresh();
      return { rev: remote.rev };
    } finally {
      busy = false;
    }
  };

  /* ---------------- automation ---------------- */
  S.scheduleSoon = function (ms) {
    if (!S.configured() || !S.signedIn() || !config().enabled) return;
    if (busy || applying || offline()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      S.syncNow({ silent: true })
        .then((r) => { if (r && r.changed) refresh(); })
        .catch(() => { /* the status line surfaces it */ });
    }, Math.max(1000, ms == null ? 30000 : ms));
  };

  S.onLocalSave = function () {
    if (!S.configured() || !S.signedIn() || !config().enabled || offline()) return;
    if (busy || applying) return;
    const cur = state().current;
    if (cur && !cur.done && cur.date === today()) return;
    S.scheduleSoon(30000);
  };

  S.onSessionEnd = function () {
    if (!S.configured() || !S.signedIn() || !config().enabled) return;
    S.scheduleSoon(4000);
  };

  S.init = function () {
    S.applySiteConfig();
    const c = config();
    if (!c) return;
    S.state.lastError = c.lastError || "";
    S.state.lastSyncAt = c.lastSyncAt || 0;
    if (!S.signedIn() || offline()) return;
    const cur = state().current;
    if (cur && !cur.done && cur.date === today()) return;
    setTimeout(() => {
      S.syncNow({ silent: true })
        .then((r) => { if (r && r.changed) refresh(); })
        .catch(() => { /* the dashboard can show the error */ });
    }, 900);
  };

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    if (!S.configured() || !S.signedIn() || !config().enabled || busy) return;
    if (document.querySelector(".modal-backdrop")) return;
    const cur = state().current;
    if (cur && !cur.done && cur.date === today()) return;
    if (Date.now() - (config().lastSyncAt || 0) < 60000) return;
    S.syncNow({ silent: true })
      .then((r) => { if (r && r.changed) refresh(); })
      .catch(() => { /* surfaced in Settings */ });
  });

  window.addEventListener("online", function () {
    if (S.configured() && S.signedIn()) S.scheduleSoon(1500);
  });

  S.statusText = function () {
    if (offline()) return "Offline";
    if (!S.configured()) return "Not connected";
    if (!S.signedIn()) return "Signed out";
    if (S.state.syncing) return "Syncing…";
    if (S.state.lastError) return "Sync error";
    if (S.state.lastSyncAt) {
      return "Synced " + new Date(S.state.lastSyncAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return "Ready to sync";
  };
})(typeof window !== "undefined" ? window : globalThis);
