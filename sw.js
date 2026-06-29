// ワンタッチすいぞくかん Service Worker
// アプリの基本ファイルをキャッシュして、起動を速く＆インストール可能にする。
const CACHE = 'suizokukan-v1';

// 同じ場所にあるファイル（アプリ本体）を事前にキャッシュ
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

// 外部CDN（あれば一緒にキャッシュしておくと、再起動が安定する）
const CDN = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // アプリ本体は確実にキャッシュ（1つでも失敗するとインストール失敗になるので個別に）
    await Promise.all(APP_SHELL.map(url =>
      cache.add(url).catch(err => console.warn('cache skip:', url, err))
    ));
    // CDNはオフライン用に「ベストエフォート」で取得（CORS不可でも no-cors で保存）
    await Promise.all(CDN.map(url =>
      fetch(url, { mode: 'no-cors' }).then(res => cache.put(url, res)).catch(() => {})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // キャッシュ優先 → なければネットワーク → 取得できたらキャッシュ更新
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      // 同一オリジンのものだけ動的にキャッシュ（不透明レスポンスは保存しない）
      if (res && res.status === 200 && res.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      // オフラインでindex.htmlが無いとき用のフォールバック
      const fallback = await caches.match('./index.html');
      return fallback || Response.error();
    }
  })());
});
