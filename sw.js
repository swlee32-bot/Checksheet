const CACHE_NAME = 'Checksheet-v2'; // 캐시 버전 업데이트
const OFFLINE_URL = 'offline.html'; 
const ASSETS = [
  './',                  // 기본 주소 캐시
  'index.html',          // 통합 파일 이름에 맞게 수정하세요 (예: 통합 v3.0.html 이라면 이름을 영어로 바꾸는 것을 권장)
  'manifest.json',
  'logo.png',            // HTML에 사용된 이미지
  OFFLINE_URL
];
const TIMEOUT_DURATION = 3000; 

// ⏱️ 타임아웃이 적용된 커스텀 fetch 함수
const fetchWithTimeout = async (request, timeout) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error; 
  }
};

self.addEventListener('install', (e) => {
  self.skipWaiting(); // 새 버전이 즉시 활성화되도록 함
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  // 이전 버전의 불필요한 캐시 삭제
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 🚀 예외 처리: 구글 Apps Script 등 명시적인 API 통신은 무조건 네트워크만 사용!
  // 캐시를 뒤지지 않고 타임아웃을 적용해 즉시 요청합니다.
  if (url.hostname.includes('script.google.com') || e.request.method !== 'GET') {
    e.respondWith(
      fetchWithTimeout(e.request, 5000).catch(() => {
        return new Response(JSON.stringify({ result: "error", msg: "오프라인 상태입니다." }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return; // 여기서 종료
  }

  // 🛡️ 기본 로직: 철저한 Cache-First 전략 (오프라인 완벽 대응)
  e.respondWith(
    (async () => {
      // 1. 캐시에 파일이 있는지 확인 (있으면 무조건 캐시 반환, 인터넷 접속 안 함)
      const cachedResponse = await caches.match(e.request);
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. 캐시에 없는 파일일 경우에만 네트워크 요청 (타임아웃 적용)
      try {
        const networkResponse = await fetchWithTimeout(e.request, TIMEOUT_DURATION);
        
        // (선택) 외부에서 불러온 폰트/이미지 등도 다음에 오프라인에서 쓰기 위해 캐시에 동적 저장
        const cache = await caches.open(CACHE_NAME);
        cache.put(e.request, networkResponse.clone());
        
        return networkResponse;
      } catch (error) {
        // 3. 가짜 와이파이이거나 완전 오프라인일 때의 처리
        if (e.request.mode === 'navigate') {
          return await caches.match(OFFLINE_URL); 
        }
        
        return new Response('오프라인 상태이거나 자원을 찾을 수 없습니다.', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      }
    })()
  );

});



















