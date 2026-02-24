# GridSonar 변경 이력 (CHANGELOG)

이 문서는 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식과
[Semantic Versioning](https://semver.org/lang/ko/) 규칙을 따릅니다.

---

## [1.1.9] - 2026-02-25

### 수정됨 (Fixed)
- **빈 행 인덱스 시프트 방지** — `addDataChunk`에 배열 다형성 추가, 캐시 복원 시 `sortedRows` 배열 직접 전달로 행 번호 밀림 차단
- **캐시 초기화 UI** — `confirm()` 후 `window.location.reload()`로 DB/메모리/UI 일치 보장

## [1.1.8] - 2026-02-25

### 추가됨 (Added)
- **캐시 스트리밍 복원** — `loadFileData(onChunk)` 콜백 모드, 거대 배열 누적 없이 청크 단위 즉시 처리

### 수정됨 (Fixed)
- **파일 삭제 vs 캐시 기록 충돌** — `messageQueue` 최상단에 `state.files.has(fileKey)` 검사, 삭제된 파일의 좀비 캐시 방지
- **워커 논리적 에러 롤백** — `case 'error'`에도 `removeFile(fileKey)` 호출, 반쪽 데이터 잔류 방지

## [1.1.7] - 2026-02-25

### 수정됨 (Fixed)
- **isIndexing Boolean Trap** — `boolean` → `indexingJobs` 카운터 + `getter`로 연속 드롭 시 방어벽 붕괴 방지
- **워커 크래시 데이터 롤백** — `worker.onerror`에서 `removeFile(fileKey)` 호출로 멱등성 보장
- **음수 범위 검색** — `RANGE_PATTERN`에 `-` 캡처 추가, 구분자 `~` only로 음수 부호 충돌 방지

## [1.1.6] - 2026-02-25

### 수정됨 (Fixed)
- **동시성 레이스 컨디션 차단** — Web Worker onmessage를 Promise Queue 패턴으로 순차 처리 강제
- **인덱싱 중 검색 차단** — `state.isIndexing` 체크로 `buildBM25()` 동기 실행에 의한 UI 프리징 방어

## [1.1.5] - 2026-02-25

### 추가됨 (Added)
- **스트리밍 캐시 API** — `beginCacheWrite→appendChunk→finalize` 패턴으로 대용량 파일 OOM 방지
- **실시간 디바운스 검색** — 검색 입력 300ms 디바운싱 (구글 스타일 UX, designs.md 스펙 구현)

### 수정됨 (Fixed)
- **Fuse.js 좀비 데이터** — `removeFile()` 후 `updateFuseInstance()` 호출 추가, 삭제된 파일 어휘가 퍼지 검색에 남지 않도록

## [1.1.4] - 2026-02-25

### 추가됨 (Added)
- **배치 모드 인덱싱** — 다중 파일 드롭 시 BM25/Fuse.js를 전체 처리 후 1회만 리빌드
- **고유 파일키** — `name__lastModified__size` 조합으로 동일 이름 다른 파일 충돌 방지
- **좀비 워커 사살** — `removeFile()` 시 실행 중 워커 즉시 `terminate()`

## [1.1.3] - 2026-02-25

### 수정됨 (Fixed)
- **CSV 대용량 OOM 방지** — `file.text()` 제거, File(Blob) 객체 직접 워커 전달 (PapaParse 스트리밍)
- **Service Worker 강제 리로드 루프 제거** — `skipWaiting()` + `controllerchange→reload()` 양쪽 제거
- **숫자 인덱스 오탐 수정** — `parseFloat` → `/^-?\d+(\.\d+)?$/` 정규식으로 엄격한 숫자 판별

## [1.1.2] - 2026-02-24

### 추가됨 (Added)
- **Web Worker 파싱** — `js/workers/parseWorker.js` 신규, SheetJS 동기 파싱을 워커 스레드로 격리
- **이진탐색 범위 검색** — O(N) 풀스캔 → O(log N) 이진탐색 (`findCellsInRange`)
- **Service Worker 업데이트 감지** — 새 버전 설치 시 토스트 안내

### 수정됨 (Fixed)
- **스택 안전 캐시** — `push(...chunk)` → for-push 패턴으로 call stack 한계 초과 방지

## [1.1.1] - 2026-02-24

### 수정됨 (Fixed)
- **BM25 TF 계산 버그** — `tokenize` (Set) → `tokenizeToArray` (Array)로 중복 허용
- **Fuse.js 어휘 필터링** — 의미 있는 토큰만 필터링 (2~20자, 순수 숫자 제외), 상한 100K
- **detectLang CJK 혼합** — 전체 순회로 CJK 우선 판별, 한글 조기 리턴 제거

## [1.1.0] - 2026-02-24

### 추가됨 (Added)
- **CJK 토큰화** — Intl.Segmenter 기반 중국어/일본어 분절 처리
- **폴더 드래그 앤 드롭** — 폴더 재귀 탐색, `.xlsx/.xls/.csv` 필터링

## [1.0.0] - 2026-02-24

### 추가됨 (Added)

#### 핵심 코어 엔진
- `core/jamo.js` — 한글 자모 분해/초성 추출/매칭 (순수 JS 유니코드 연산, 외부 라이브러리 무사용)
- `core/bm25.js` — BM25 Okapi 랭킹 알고리즘 순수 JS 구현
- `core/queryParser.js` — 검색어 파서 (AND/제외/범위 조건 지원)
- `core/searchIndex.js` — Inverted Index + 초성 Index + BM25 통합 검색 인덱스
- `core/searchEngine.js` — 4계층 다중 검색 엔진 (정확/초성/퍼지/BM25)
- `core/fileParser.js` — SheetJS/PapaParse CDN 어댑터, 청크 스트리밍 파싱
- `core/cacheManager.js` — IndexedDB 캐시 (localForage), 재시작 시 즉시 복원

#### UI 레이어
- `index.html` — SPA 진입점, 시맨틱 HTML5 구조
- CSS 디자인 시스템 (variables, base, layout, components) — 다크/라이트 테마, 40+ 디자인 토큰
- 검색 바 — 디바운싱, 검색 기록 드롭다운, 통계 배지
- 파일 트리 사이드바 — Drag & Drop, 파일/시트 트리, 제거 기능
- 결과 테이블 — 매칭 유형 배지, 키워드 하이라이팅, 결과 내 필터링
- 상세 보기 모달 — 행 전체 데이터 그리드, 매칭 상세 정보
- 토스트 알림 — 하단 Fade In/Out 비동기 알림
- 유사도 슬라이더 — 실시간 퍼지 매칭 임계값 조정
- 리사이즈 핸들 — 사이드바 너비 드래그 조절

#### 유틸리티
- `utils/config.js` — localStorage 기반 설정 관리
- `utils/exporter.js` — SheetJS 기반 xlsx/csv 내보내기, UTF-8 BOM 한글 지원
- `utils/clipboard.js` — Clipboard API + execCommand fallback
- `utils/i18n.js` — 5개 국어 번역 (한/영/일/중(번)/중(간))
- `utils/logger.js` — 콘솔 로깅 유틸리티, 로그 레벨 지원

#### PWA
- `manifest.json` — standalone 모드, 테마 색상, SVG 아이콘
- `sw.js` — Service Worker (Cache First + Stale While Revalidate)

#### 문서 (D3D Protocol 준수)
- `spec.md` — 구현 명세 (기술 스택, 아키텍처, 포팅 매핑표)
- `designs.md` — 디자인 명세 (ASCII 아키텍처, 컴포넌트 설계, 디자인 시스템)
- `README.md` — 5개 국어 (한/영/일/중(번)/중(간))
- `CHANGELOG.md` — SemVer 변경 이력
- `BUILD_GUIDE.md` — 빌드 불필요 정적 앱 실행/배포 가이드
- `IMPLEMENTATION_SUMMARY.md` — 구현 요약 및 검증 결과
- `DESIGN_DECISIONS.md` — 8가지 핵심 설계 결정 (DD-001~DD-008)
- `LESSONS_LEARNED.md` — Python→Web 포팅 교훈 및 사전 조사 항목
- `audit_roadmap.md` — 4단계 감사 프로세스
- `.gitignore` — D3D §7 준수 (README/CHANGELOG/BUILD_GUIDE만 Git 포함)

### 포팅 완료 (Migration)
- `jamo_utils.py` → `core/jamo.js` (100% 완벽 포팅)
- `indexer.py` → `core/searchIndex.js` (100%)
- `searcher.py` → `core/searchEngine.js` (100%)
- `scanner.py` → `core/fileParser.js` (100%)
- `cache.py` → `core/cacheManager.js` (100%)
- `workers.py` → `app.js` 내 비동기 처리 (95%)
- `exporter.py` → `utils/exporter.js` (100%)
- `config.py` → `utils/config.js` (100%)
- `styles.py` → `css/*.css` (100%)
- 전체 UI → `index.html` + `app.js` (100%)
