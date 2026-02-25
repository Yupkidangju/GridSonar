/**
 * [v1.0.0] GridSonar Service Worker
 * 오프라인 동작을 위한 캐싱 전략
 *
 * 전략:
 * - 정적 에셋 (HTML, CSS, JS): Cache First
 * - CDN 라이브러리: Stale While Revalidate
 * - 기타: Network First
 */

const CACHE_NAME = 'gridsonar-v1.2.1';

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
    'fonts.googleapis.com',
    'fonts.gstatic.com'
];

// [v1.1.3] 설치: 정적 에셋 프리캐시
// skipWaiting() 의도적으로 미사용:
// 즉시 활성화되면 controllerchange→reload로 사용자 작업이 중단됨.
// 새 워커는 모든 탭이 닫힌 후 자연스럽게 활성화됩니다.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_URLS))
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
