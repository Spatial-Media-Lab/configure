// © Kay Sievers <kay@vrfy.org>, 2021
// SPDX-License-Identifier: Apache-2.0

const name = '__NAME__';
const version = __VERSION__;
const files = [
  __FILES__
];

// Install a new version of the files, bypass the browser's cache.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(name + '-' + version).then((cache) => {
      for (const file of files) {
        fetch(file, {
            cache: 'no-cache'
          })
          .then((response) => {
            if (!response.ok)
              throw new Error('Status=' + response.status);

            return cache.put(file, response);
          })
      }
    })
  );
});

// After an upgrade, delete all other versions of the cached files.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith(name + '-') && (key != name + '-' + version)) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request)
    .then((response) => {
      return response || fetch(e.request);
    })
  );
});
