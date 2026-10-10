/* 圏外対策：アプリ本体をスマホに保存しておく。最新情報（/api）は毎回取りに行く */
var CACHE = 'parknavi-v19';
var FILES = ['./', 'index.html', 'app.js', 'data.js', 'map.js', 'guide.js', 'icons.js', 'links.js', 'icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin || url.pathname.indexOf('/api/') === 0) return; /* リアルタイム情報はキャッシュしない */
  /* まずネットから、だめなら保存済みを使う */
  e.respondWith(fetch(e.request).then(function (r) {
    if (r.ok && url.origin === location.origin) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
    return r;
  }).catch(function () { return caches.match(e.request).then(function (m) { return m || caches.match('index.html'); }); }));
});
