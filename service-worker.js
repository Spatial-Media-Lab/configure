// © Kay Sievers <kay@vrfy.org>, 2021
// SPDX-License-Identifier: Apache-2.0

const name = 'configure';
const version = 50;
const files = [
  './',
  'css/bulma-addons.css',
  'css/bulma.min.css',
  'css/fontawesome.min.css',
  'css/fonts.css',
  'icons/android-chrome-192x192.png',
  'icons/android-chrome-512x512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-16x16.png',
  'icons/favicon-32x32.png',
  'icons/favicon.ico',
  'icons/icon.png',
  'icons/logo.png',
  'js/V2Configuration.js',
  'js/V2Debug.js',
  'js/V2Device.js',
  'js/V2Input.js',
  'js/V2Log.js',
  'js/V2MIDI.js',
  'js/V2MIDISelect.js',
  'js/V2Output.js',
  'js/V2Settings.js',
  'js/V2Test.js',
  'js/V2Web.js',
  'site.webmanifest',
  'webfonts/fa-brands-400.woff2',
  'webfonts/fa-regular-400.woff2',
  'webfonts/fa-solid-900.woff2'
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
