/*
 * Cleat service worker.
 *
 * Its one job is to make sure the craving flow opens with no network. Someone at
 * 2am with one bar of signal is close to the median case for the screen this
 * exists for, and "check your connection" is not an acceptable answer to a
 * craving.
 *
 * PRIVACY RULE, and it is the important one: this worker caches the application
 * shell and nothing else. API responses are never cached — they contain relapse
 * histories, craving logs and coach transcripts, and a cache on a shared or
 * stolen device is a disclosure. Personal data needed offline lives in
 * localStorage under the user's control instead (see `lib/offline.ts`), so
 * signing out can clear it.
 */
const CACHE = 'cleat-shell-v2';

// The routes that must open offline. Everything else can fail honestly.
const SHELL = ['/craving', '/home', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        // Cached one at a time rather than with `addAll`, which is all-or-
        // nothing: a single 404 in the list silently discards the entire
        // precache and leaves the craving flow unavailable offline. Losing one
        // entry should cost that entry, not the whole shell.
        Promise.all(
          SHELL.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
          ),
        ),
      )
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never touch the API. Not cached, not intercepted, not inspected.
  if (url.pathname.startsWith('/v1/') || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only the shell is worth keeping, and only when it is actually OK.
        if (response.ok && (request.mode === 'navigate' || url.pathname.startsWith('/_next/'))) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // A navigation with nothing cached still gets somewhere useful rather
        // than the browser's dinosaur.
        if (request.mode === 'navigate') {
          const fallback = await caches.match('/craving');
          if (fallback) return fallback;
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      }),
  );
});
