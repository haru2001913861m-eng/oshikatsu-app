/* 推し活家計簿 — オフライン用の控えと通知。ファイルを変えたら VERSION を上げる */
const VERSION = 'oshi-v2-2026-10-17c';
importScripts('./db.js', './notice.js');
const SHELL = [
  './', './index.html', './style.css', './app.js', './db.js', './notice.js', './share.js', './manifest.json', './offers.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './assets/emoji/bags.png',  './assets/emoji/bus.png',  './assets/emoji/calendar.png',  './assets/emoji/chart.png',  './assets/emoji/check.png',  './assets/emoji/coin.png',  './assets/emoji/envelope.png',  './assets/emoji/heart.png',  './assets/emoji/hearts.png',  './assets/emoji/hotel.png',  './assets/emoji/lightstick.png',  './assets/emoji/memo.png',  './assets/emoji/mic.png',  './assets/emoji/moneybag.png',  './assets/emoji/party.png',  './assets/emoji/pig.png',  './assets/emoji/receipt.png',  './assets/emoji/sparkles.png',  './assets/emoji/starstruck.png',  './assets/emoji/ticket.png',  './assets/emoji/warn.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== VERSION + '-fonts').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // Google Fonts：取れたら控えておき、オフラインでは控えを使う（無くても見た目は崩れない）
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      e.respondWith(caches.open(VERSION + '-fonts').then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }))));
    }
    return;
  }
  // offers.json は新しい方を優先（URL を差し込んだらすぐ出るように）
  if (url.pathname.endsWith('/offers.json')) {
    e.respondWith(fetch(req).then((res) => { const cp = res.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); return res; }).catch(() => caches.match(req)));
    return;
  }
  // それ以外は控えを先に出し、裏で新しくする
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => {
    const net = fetch(req).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); } return res; }).catch(() => hit || caches.match('./index.html'));
    return hit || net;
  }));
});

/* 通知：サーバーからは {"type": "daily" | "monthStart" | "eventSoon"} だけが届く。
   文面は端末の中の写し（IndexedDB）から作る。iOS は届いたら毎回表示が必要なので、必ず1件出す */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (er) { d = {}; }
  e.waitUntil(OshiDB.get('kv', 'state').catch(() => null).then((S) => {
    const n = OshiNotice.build(d.type || 'daily', S || {}, new Date());
    return self.registration.showNotification(n.title, { body: n.body, tag: n.tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './' } });
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
