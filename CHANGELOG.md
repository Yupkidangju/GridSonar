# GridSonar 변경 이력 (CHANGELOG)

이 문서는 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식과
[Semantic Versioning](https://semver.org/lang/ko/) 규칙을 따릅니다.

---

## [2.5.1] - 2026-02-25

### 수정됨 (Fixed)
- **🚨 열 모드 AND 조건 버그** — `서울 col:이름 홍길동` 검색 시 columnFilter 조건이 OR로 작동하던 버그 수정. `_applyColumnCondition` 함수를 추가하여 모든 columnFilter를 AND 조건으로 강제 적용.
- **🚨 가상 스크롤 thead/tbody 열 정렬 불일치** — `<thead>` 헤더에 `<tbody>` 행과 동일한 flex 인라인 스타일(120px/180px/flex:1)을 적용하여 열 간격 정렬 동기화.

### 개선됨 (Improved)
- **정규식 검색 O(N) → vocabulary 기반 최적화** — 기존 전체 셀 풀스캔(50K 상한)에서 인버티드 인덱스 키(고유 토큰)만 정규식 테스트하는 방식으로 전환. 상한 제거 + 100만 행에서도 전수 검색 가능.

## [2.5.0] - 2026-02-25

### 추가됨 (Added)
- **정규식 검색** — `/패턴/` 또는 `/패턴/i` 구문으로 고급 패턴 매칭. 전화번호(`/\d{3}-\d{4}/`), 이메일, 한글 시작 문자(`/^홍/`) 등 정밀 검색 지원.
- **queryParser 확장** — 슬래시로 감싼 정규식을 먼저 추출 후 나머지를 기존 토큰 파싱. 잘못된 정규식은 안전하게 무시.
- **searchEngine 확장** — `_regexSearch` 함수 추가. 전체 셀 순회(최대 50,000개) 후 정규식 테스트. `WEIGHT_REGEX=0.95` 가중치.
- **정규식 매칭 배지** — 보라색 계열 배지(`match-badge--regex`) + 다국어 라벨(`matchRegex`) 추가.
- **도움말 모달 정규식 섹션** — 5개 국어 모두에 정규식 사용법 및 예제 추가.

## [2.4.0] - 2026-02-25

### 추가됨 (Added)
- **도움말 모달 추가** — 사용자 편의성을 위해 헤더에 `?` 버튼 추가. 클릭 시 모달이 나타나 구체적인 검색 예제와 설명을 다국어(5개 국어)로 안내함. (일반 검색, 제외 검색, 범위 검색, 초성 검색, 열 지정 검색 등)

## [2.3.0] - 2026-02-25

### 추가됨 (Added)
- **열 모드 검색** — `col:열이름 키워드` 또는 `열:열이름 키워드` 구문으로 특정 열(컬럼)에서만 검색. 예: `열:이름 홍길동`, `col:금액 100~500`. 열 이름은 대소문자 무시 부분 일치.
- **queryParser 확장** — `col:/열:` 패턴을 인식하여 `columnFilters` 배열에 `{column, keyword}` 쌍으로 저장
- **searchEngine 확장** — `_columnSearch` 함수 추가, 인버티드 인덱스에서 열 이름 필터링 후 매칭
- **검색창 placeholder 갱신** — 열 모드 구문 안내 추가 (한/영)

## [2.2.0] - 2026-02-25

### 추가됨 (Added)
- **가상 스크롤링** — 검색 결과를 뷰포트 내 ~40행만 DOM에 렌더링하여 대량 결과(5,000건)에서도 60fps 스크롤 유지. 이전에는 500건 전체를 DOM에 삽입하여 브라우저 렌더링 지연 발생.
- **검색 결과 상한 확장** — `maxResults` 500 → 5,000으로 확장. 가상 스크롤링 덕분에 메모리만 사용하고 DOM 비용은 일정.

### 변경됨 (Changed)
- **결과 내 필터링 최적화** — DOM 행 토글 방식에서 가상 스크롤 연동 방식으로 변경. 필터 결과에 대해 전체 높이 재계산 후 뷰포트 내 행만 렌더링.

## [2.1.0] - 2026-02-25

### 추가됨 (Added)
- **세션 히스토리 (원클릭 복원)** — 이전에 작업했던 파일 묶음을 사이드바 히스토리에 자동 저장하고, 클릭 한 번으로 IndexedDB 캐시에서 고속 복원 (원본 파일 불필요)
- **세션 자동 저장** — 인덱싱 완료 시 현재 파일 구성을 세션으로 자동 저장 (최대 20개 세션 유지)
- **캐시 유실 대응** — 브라우저가 IndexedDB를 삭제한 경우 파일 트리에 ⚠️ 경고 표시 + 원본 파일 재드롭 안내
- **영구 저장소 요청** — `navigator.storage.persist()` 호출로 브라우저의 임의 IndexedDB 삭제 방지
- **세션 히스토리 i18n** — 5개 국어 번역 키 추가
- **file-input accept 범위 확장** — `.pdf`, `.docx` 추가

## [2.1.1] - 2026-02-25

### 수정됨 (Fixed)
- **CJK 폰트 PDF 파싱 실패 해결** — `cMapUrl` + `cMapPacked` 옵션 추가. 한글/중국어/일본어 폰트가 PDF에 내장되지 않고 OS/Adobe 기본 폰트를 참조하는 경우, CMap(Character Map) 사전을 CDN에서 로드하여 글리프 코드→유니코드 변환 수행. 이전에는 CMap 미설정으로 "Unable to load CMap" 에러 → 워커 크래시 → 파싱 실패.

## [2.1.2] - 2026-02-25

### 수정됨 (Fixed)
- **PDF "document is not defined" 에러 근본 해결** — `pdfjsLib.GlobalWorkerOptions.workerPort`에 `MessageChannel` 더미 포트를 할당하여 pdf.js가 "외부 워커가 이미 연결됨" 상태로 인식하도록 강제. 이전 `importScripts`만으로는 `document.currentScript` fallback 경로 탐색을 차단하지 못해 캐시 삭제 후 에러 재발.

## [2.1.3] - 2026-02-25

### 수정됨 (Fixed)
- **PDF "document is not defined" 에러 최종 해결 (document 폴리필)** — Worker 환경에 `document` 객체의 최소 스텁 폴리필을 제공. pdf.js FakeWorker가 `document.currentScript.src`, `document.createElement('style')` 등에 접근할 때 에러 없이 진행. 이후 FakeWorker가 `globalThis.pdfjsWorker.WorkerMessageHandler`를 감지하여 동일 스레드에서 직접 실행. 이전 실패: importScripts만 사용(v2.0.2), workerPort 더미 포트(v2.1.2) 모두 불완전.

## [2.0.2] - 2026-02-25

### 수정됨 (Fixed)
- **PDF 파싱 "document is not defined" 에러 해결** — Worker 내에서 `workerSrc` URL 지정 방식이 Nested Worker 생성 → CORS 차단 → FakeWorker fallback → `document.createElement()` 호출 → Worker 환경에서 `document` 없음 에러. `pdf.worker.min.js`를 `importScripts`로 동일 스레드에 직접 로드하여 해결.
- **PDF 표준 폰트 누락 에러 방지** — `standardFontDataUrl` 옵션 추가, PDF에 내장되지 않은 기본 폰트(Helvetica, Times-Roman 등) 렌더링 시 CDN에서 로드
- **Service Worker CDN 패턴 누락 수정** — `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`을 CDN_PATTERNS에 추가, pdf.js/PapaParse/mammoth CDN 응답에 Stale While Revalidate 전략 적용

## [2.0.0] - 2026-02-25

### 추가됨 (Added)
- **PDF 문서 검색 지원** — pdf.js (Mozilla) 기반 페이지별 텍스트 추출, "1열짜리 엑셀" 가상화 패턴으로 기존 4계층 검색 엔진에 투명 통합
- **DOCX 문서 검색 지원** — mammoth.js 기반 문단별 텍스트 추출, 동일한 가상화 패턴 적용
- **스니펫(Snippet) 렌더링** — 200자 초과 셀에서 키워드 주변 앞뒤 80자 문맥만 추출하여 `<mark>` 하이라이팅 표시
- PDF/DOCX 파일 아이콘 구분 (📄/📝)

## [1.2.1] - 2026-02-25

### 추가됨 (Added)
- **i18n 다국어 UI 시스템 적용** — 한국어, 영어, 일본어, 중국어(번체), 중국어(간체) 등 5개 국어 UI 지원
- `index.html`에 언어 선택 드롭다운 옵션 추가
- 동적 안내 메시지, 토스트, 결과 테이블 헤더 등 앱 내 모든 텍스트 요소를 다국어 처리
- **Save As 다이얼로그** — Chromium 브라우저(Chrome/Edge)에서 내보내기 시 OS 네이티브 "다른 이름으로 저장" 대화상자 표시 (Firefox/Safari는 기존 다운로드 폴백)

### 수정됨 (Fixed)
- **PWA 서비스 워커 알림 구체화** — 다국어 처리를 위한 i18n 대응 완료

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
