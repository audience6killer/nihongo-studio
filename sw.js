/* Nihongo Studio service worker.
 *
 * Strategy:
 *   - navigations        -> network first, fall back to the cached shell
 *   - same-origin assets -> cache first, revalidate in the background
 *   - everything else    -> straight to the network (we make no third-party calls)
 *
 * The cache name is stamped by the deploy build, so a new deploy always
 * installs a fresh cache. If an installed app still runs old code once after a
 * deploy, reload twice: that is the documented service-worker behaviour, not a
 * bug. `?nosw` and localhost never register this worker.
 */
const RELEASE = 'nj-0.1.0';
const CACHE = 'nihongo-' + RELEASE;
const SHELL = 'index.html';

const CORE = [
  './',
  SHELL,
  'index.html',
  'manifest.webmanifest',
  'assets/css/app.css',
  'assets/img/icon.svg',
  'assets/img/icon-180.png',
  'assets/img/icon-512.png',
  'assets/js/data/config.js',
  'assets/js/data/vocab.js',
  'assets/js/data/lessons.js',
  'assets/js/data/tap.js',
  'assets/js/core/util.js',
  'assets/js/core/lang.js',
  'assets/js/core/data.js',
  'assets/js/core/storage.js',
  'assets/js/core/sync.js',
  'assets/js/core/srs.js',
  'assets/js/core/plan.js',
  'assets/js/core/tts.js',
  'assets/js/core/session.js',
  'assets/js/core/diagnostic.js',
  'assets/js/core/exam.js',
  'assets/js/ui/components.js',
  'assets/js/ui/dashboard.js',
  'assets/js/ui/session.js',
  'assets/js/ui/lesson.js',
  'assets/js/ui/stats.js',
  'assets/js/ui/diagnostic.js',
  'assets/js/ui/exam.js',
  'assets/js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Add individually: one missing file must not abort the whole install.
    await Promise.all(CORE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n.startsWith('nihongo-') && n !== CACHE).map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }
  event.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(SHELL, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = (await cache.match(req)) || (await cache.match(SHELL));
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) {
    // Revalidate quietly; a failure here must never affect the response.
    fetch(req).then((fresh) => {
      if (fresh && fresh.ok) cache.put(req, fresh.clone());
    }).catch(() => {});
    return cached;
  }
  const fresh = await fetch(req);
  if (fresh && fresh.ok) cache.put(req, fresh.clone());
  return fresh;
}
