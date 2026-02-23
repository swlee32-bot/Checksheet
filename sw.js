const CACHE_NAME = 'aviation-v2'; // 버전 업데이트
const OFFLINE_URL = 'offline.html'; // 오프라인일 때 보여줄 페이지
const ASSETS = [
  'index.html',
  'manifest.json',
  'icon.png',
  OFFLINE_URL // 오프라인 페이지도 캐시에 미리 저장해야 합니다.
];
const TIMEOUT_DURATION = 3000; // 3초 (3000ms)

// ⏱️ 타임아웃이 적용된 커스텀 fetch 함수
const fetchWithTimeout = async (request, timeout) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // signal을 넘겨주어 timeoutId가 실행되면 fetch를 강제 중단(abort)합니다.
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error; // 타임아웃(가짜 와이파이)이거나 아예 오프라인이면 에러를 던짐
  }
};

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    (async () => {
      // 1. 캐시에 파일이 있는지 먼저 확인 (기존 로직 유지, 속도 보장)
      const cachedResponse = await caches.match(e.request);
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. 캐시에 없는 파일이라면 타임아웃이 적용된 네트워크 요청 실행
      try {
        return await fetchWithTimeout(e.request, TIMEOUT_DURATION);
      } catch (error) {
        // 3. 가짜 와이파이(타임아웃)이거나 완전한 오프라인일 때의 폴백(Fallback) 처리
        
        // 사용자가 새로운 HTML 페이지로 이동하려고 했던 거라면 (mode === 'navigate')
        if (e.request.mode === 'navigate') {
          return await caches.match(OFFLINE_URL); // 미리 캐시해둔 오프라인 안내 페이지를 보여줌
        }
        
        // 이미지, API 데이터 등 다른 종류의 요청이 실패했을 때 에러 응답 반환
        return new Response('오프라인 상태이거나 네트워크가 불안정합니다.', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      }
    })()
  );
});