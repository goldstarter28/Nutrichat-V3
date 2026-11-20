
'use strict';

const CACHE = 'nutritrace-v3-auto-audit-v1';

const CORE = [
  './',
  './index.html',
  './app.js',
  './ingredient-reconstruction.js',
  './ingredient-auto-audit.js',
  './style.css',
  './label-import.js',
  './label-import-v3.js',
  './label-import-ui-state.js',
  './label-import-ui.js',
  './label-import-ui.css',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './config/ui.it.json',
  './config/search-policy.json',
  './config/standard-portions.json',
  './data/master/manifest.json',
  './data/master/index.json'
];

const VENDOR = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
  'https://cdn.sheetjs.com/xlsx-0.18.5/package/dist/xlsx.full.min.js'
];

const APP_ASSET = /\/(?:app\.js|style\.css|index\.html|sw\.js|label-import(?:-v3|-ui-state|-ui)?\.js|label-import-ui\.css)$/;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);

    await Promise.allSettled(
      VENDOR.map(async url => {
        const response = await fetch(url, { mode: 'no-cors' });
        await cache.put(url, response);
      })
    );

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key => key !== CACHE)
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    const url = new URL(event.request.url);
    const sameOrigin = url.origin === self.location.origin;

    const isMaster = sameOrigin &&
      url.pathname.includes('/data/master/');

    const isAppAsset = sameOrigin &&
      (APP_ASSET.test(url.pathname) ||
       url.pathname.endsWith('/'));

    if (isMaster || isAppAsset) {
      try {
        const response = await fetch(event.request, {
          cache: 'no-store'
        });

        if (response.ok) {
          const copy = response.clone();

          event.waitUntil(
            caches.open(CACHE)
              .then(cache => cache.put(event.request, copy))
              .catch(() => {})
          );
        }

        return response;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('./index.html');
          if (fallback) return fallback;
        }

        return Response.error();
      }
    }

    const cached = await caches.match(event.request);
    if (cached) return cached;

    try {
      const response = await fetch(event.request);

      if (response.ok && sameOrigin) {
        const copy = response.clone();

        event.waitUntil(
          caches.open(CACHE)
            .then(cache => cache.put(event.request, copy))
            .catch(() => {})
        );
      }

      return response;
    } catch {
      if (event.request.mode === 'navigate') {
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
      }

      return Response.error();
    }
  })());
});
