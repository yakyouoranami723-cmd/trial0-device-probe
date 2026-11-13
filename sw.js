'use strict';
const CACHE_NAME = 'trial0-phase0-shell-v02';
const LIB_CACHE_NAME = 'trial0-runtime-jsdelivr-v01';
const SHELL_FILES = ['./', './index.html', './model-test.html', './model-test.js', './manifest.webmanifest', './icon.svg'];
const TRANSFORMERS_CDN_PREFIX = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_FILES);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('trial0-phase0-shell-') && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Cache only the explicitly pinned Transformers.js package; model files are
  // cached separately by Transformers.js under its own Cache API key.
  if (request.url.startsWith(TRANSFORMERS_CDN_PREFIX)) {
    event.respondWith((async () => {
      const cache = await caches.open(LIB_CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type !== 'opaque') {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })());
    return;
  }

  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (request.destination === 'script' || request.destination === 'document') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (error) {
      if (request.mode === 'navigate') {
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});
