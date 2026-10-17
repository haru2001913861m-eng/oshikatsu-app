/* 推し活家計簿 — オフライン用。ファイルを変えたら VERSION を上げる */
const VERSION = 'oshi-v1-2026-10-17';
const SHELL = [
  './', './index.html', './style.css', './app.js', './manifest.json', './offers.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  "./assets/emoji/bags.png",  "./assets/emoji/bus.png",  "./assets/emoji/calendar.png",  "./assets/emoji/chart.png",  "./assets/emoji/check.png",  "./assets/emoji/coin.png",  "./assets/emoji/envelope.png",  "./assets/emoji/heart.png",  "./assets/emoji/hearts.png",  "./assets/emoji/hotel.png",  "./assets/emoji/lightstick.png",  "./assets/emoji/memo.png",  "./assets/emoji/mic.png",  "./assets/emoji/moneybag.png",  "./assets/emoji/party.png",  "./assets/emoji/pig.png",  "./assets/emoji/receipt.png",  "./assets/emoji/sparkles.png",  "./assets/emoji/starstruck.png",  "./assets/emoji/ticket.png",  "./assets/emoji/warn.png",
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // Google Fonts など：取れたら控えておき、オフラインでは控えを使う（無くても見た目は崩れない）
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
