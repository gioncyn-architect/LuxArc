// ============================================================
// LuxArc AI — Service Worker (sw.js)
// Versi: v1.0.0
// Strategy:
//   - App Shell  → Cache First (HTML, CSS, JS, gambar produk)
//   - API calls  → Network Only (YouCam, Groq, ImgBB)
//   - Font CDN   → Stale While Revalidate
// ============================================================

const CACHE_NAME = 'luxarc-shell-v4';
const RUNTIME_CACHE = 'luxarc-runtime-v4';

// ── App Shell: di-cache saat install ────────────────────────
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',

  // Icons PWA
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png',

  // Gambar produk
  './cat-rambut-premium.jpg',
  './1000027250.jpg',
  './kalung-mutiara.jpg',
  './kalung-emas-211.jpg',
  './rok-mini-hitam.jpg',
  './rok-levis-121.jpg',
  './topi-xx.webp',
  './skincare-jerawat.jpg',
  './skincare-pemutih.jpg',
  './lipstik-merah-01.jpg',
  './lipstik-pink-02.jpg',
  './eyeshadow-001.jpg',
  './lipstik-coklat-gold.jpg',
  './eyeshadow-gold.jpg',
  './kemeja-panjang.jpg',
  './kaos-olahraga.jpg',
  './blouse-valen-cream.jpg',
  './blouse-valen-hitam.jpg',
  './dress-pelangi.jpg',
  './dress-kids-pita.jpg',
  './dress-biru.jpg',
  './gaun-renda-malam.jpg',
  './blazer-pria.jpg',
  './jaket-denim.jpg',
  './atasan-seksi-merah.jpg',
  './lipstik-collection.jpg',
  './blushon-collection.jpg',
  './atasan-01.webp',
  './atasan-02.webp',
  './atasan-03.webp',
  './atasan-04.webp',
  './atasan-05.webp',
  './atasan-06.webp',
  './atasan-07.webp',
  './atasan-08.webp',
  './atasan-09.webp',
  './atasan-10.webp',
  './dress-01.webp',
  './dress-02.webp',
  './dress-03.webp',
  './dress-04.webp',
  './dress-05.webp',
  './topi-01.webp',
  './topi-02.webp',
  './topi-03.webp',
  './topi-04.webp',
  './topi-05.webp',
];

// ── URL yang TIDAK boleh di-cache (selalu ambil dari network) ─
const NETWORK_ONLY_PATTERNS = [
  '/api/',
  'api.imgbb.com',
  'api.whatsapp.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// ── Cek apakah URL masuk daftar network-only ────────────────
function isNetworkOnly(url) {
  return NETWORK_ONLY_PATTERNS.some(pattern => url.includes(pattern));
}

// ── Cek apakah request adalah navigasi HTML ─────────────────
function isNavigation(request) {
  return request.mode === 'navigate';
}

// ════════════════════════════════════════════════════════════
// INSTALL — Pre-cache App Shell
// ════════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  console.log('[LuxArc SW] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache satu per satu — 1 file gagal tidak blokir yang lain
      const results = await Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          cache.add(url).catch(() => {
            // Diam-diam skip file yang tidak ditemukan
            // (misal gambar produk belum ada di repo)
          })
        )
      );
      const ok  = results.filter(r => r.status === 'fulfilled').length;
      console.log(`[LuxArc SW] Pre-cache: ${ok}/${PRECACHE_ASSETS.length} file di-cache`);
    })
  );

  // Aktifkan SW baru langsung tanpa tunggu tab lama ditutup
  self.skipWaiting();
});

// ════════════════════════════════════════════════════════════
// ACTIVATE — Bersihkan cache lama
// ════════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  console.log('[LuxArc SW] Activating...');

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map(name => {
            console.log('[LuxArc SW] Hapus cache lama:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[LuxArc SW] Aktif & siap!');
      // Ambil kontrol semua tab yang sudah terbuka
      return self.clients.claim();
    })
  );
});

// ════════════════════════════════════════════════════════════
// FETCH — Strategi cache sesuai jenis request
// ════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Abaikan non-GET dan chrome-extension
  if (request.method !== 'GET') return;
  if (url.startsWith('chrome-extension://')) return;

  // ── 1. Network Only — API calls jangan di-cache ───────────
  if (isNetworkOnly(url)) {
    event.respondWith(
      fetch(request).catch(() => {
        // Kalau network mati & ini API call, return pesan error JSON
        return new Response(
          JSON.stringify({ error: 'Tidak ada koneksi internet. Coba lagi nanti.' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // ── 2. Cache First — aset statis (JS, CSS, gambar, icons) ─
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) {
        // Ada di cache — langsung pakai
        return cachedResponse;
      }

      // Belum ada di cache — ambil dari network lalu simpan
      return fetch(request)
        .then(networkResponse => {
          // Hanya cache response yang valid (status 200, bukan opaque)
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type === 'opaque'
          ) {
            return networkResponse;
          }

          // Simpan ke runtime cache
          const responseToCache = networkResponse.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // Offline & tidak ada cache — tampilkan halaman offline
          // untuk navigasi HTML
          if (isNavigation(request)) {
            return caches.match('./index.html');
          }
          // Untuk gambar yang tidak ada di cache, return blank 1x1 pixel
          if (request.destination === 'image') {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
        });
    })
  );
});

// ════════════════════════════════════════════════════════════
// MESSAGE — Handle pesan dari halaman utama
// ════════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
  // Paksa update SW saat user klik "Update App"
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Hapus semua cache (reset)
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(cacheNames => {
      Promise.all(cacheNames.map(name => caches.delete(name)));
    });
  }
});
