// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('configure').then((cache) => {
      return cache.addAll([
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
        'service-worker.js',
        'site.webmanifest',
        'webfonts/fa-brands-400.woff2',
        'webfonts/fa-regular-400.woff2',
        'webfonts/fa-solid-900.woff2'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
    .then((response) => {
      if (response)
        return response;

      return fetch(event.request);
    })
  );
});
