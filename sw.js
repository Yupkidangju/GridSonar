/**
 * [v1.0.0] GridSonar Service Worker
 * 오프라인 동작을 위한 캐싱 전략
 *
 * 전략:
 * - 정적 에셋 (HTML, CSS, JS): Cache First
 * - CDN 라이브러리: Stale While Revalidate
 * - 기타: Network First
 */

const CACHE_NAME = 'gridsonar-v2.7.0';

// 프리캐시할 정적 에셋
const PRECACHE_URLS = [
    './',
    './index.html',
    './css/variables.css',
    './css/base.css',
    './css/layout.css',
    './css/components.css',
    './js/app.js',
    './js/core/jamo.js',
    './js/core/bm25.js',
    './js/core/queryParser.js',
    './js/core/searchIndex.js',
    './js/core/searchEngine.js',
    './js/core/fileParser.js',
    './js/core/cacheManager.js',
    './js/core/googleDrive.js',
    './js/utils/config.js',
    './js/utils/exporter.js',
    './js/utils/clipboard.js',
    './js/utils/i18n.js',
    './js/utils/logger.js',
    './js/workers/parseWorker.js',
    './manifest.json'
];

// CDN URL 패턴 (캐싱 대상)
const CDN_PATTERNS = [
    'esm.sh',
    'cdn.sheetjs.com',
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'accounts.google.com',
    'apis.google.com'
];

// [v2.7.0] 설치: 정적 에셋 프리캐시 + 즉시 활성화
// skipWaiting()을 호출하여 새 SW가 설치 즉시 활성화되도록 함.
// 이전에는 "사용자 작업 중단 방지"를 위해 미사용했으나,
// GitHub Pages 등 정적 호스팅에서 새 버전이 영원히 적용되지 않는
// 치명적 문제가 발생하여 skipWaiting + clients.claim 조합으로 전환.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// 활성화: 오래된 캐시 정리
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch 인터셉터
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // CDN 라이브러리: Stale While Revalidate
    if (CDN_PATTERNS.some(pattern => url.includes(pattern))) {
        event.respondWith(staleWhileRevalidate(event.request));
        return;
    }

    // 정적 에셋: Cache First
    if (event.request.method === 'GET') {
        event.respondWith(cacheFirst(event.request));
        return;
    }
});

// Cache First 전략
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        // 오프라인 fallback
        return new Response('오프라인 상태입니다.', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Stale While Revalidate 전략
async function staleWhileRevalidate(request) {
    const cached = await caches.match(request);

    const fetchPromise = fetch(request)
        .then(response => {
            if (response.ok) {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
            }
            return response;
        })
        .catch(() => cached); // 네트워크 실패 시 캐시 반환

    return cached || fetchPromise;
}
