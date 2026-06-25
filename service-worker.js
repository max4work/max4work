'use strict';

const CACHE = 'max4work-v20';
const OFFLINE = 'offline.html';

const SHELL = [
  'index.html','rechnungen.html','kunden.html','termine.html',
  'auswertung.html','belege.html','kassenbuch.html','produkte.html',
  'werkzeuge.html','fahrtenbuch.html','einstellungen.html','eur.html',
  'angebote.html',
  'shared.js','css/shared.css','manifest.json','logo.png',OFFLINE,
  'js/index.js','js/rechnungen.js','js/kunden.js','js/termine.js',
  'js/auswertung.js','js/belege.js','js/kassenbuch.js','js/zahlungen.js',
  'js/fahrtenbuch.js','js/einstellungen.js','js/werkzeuge.js','js/datentransfer.js',
  'js/angebote.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(SHELL.map(url => cache.add(new Request(url, { redirect: 'follow' }))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(new Request(e.request, { redirect: 'follow' }))
        .then(res => {
          if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => e.request.mode === 'navigate' ? caches.match(OFFLINE) : Response.error());
    })
  );
});
