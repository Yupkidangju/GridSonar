# GridSonar 변경 이력 (CHANGELOG)

이 문서는 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 형식과
[Semantic Versioning](https://semver.org/lang/ko/) 규칙을 따릅니다.

---

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
