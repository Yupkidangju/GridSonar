# GridSonar 빌드 가이드 (BUILD_GUIDE)

> **최종 갱신일:** 2026-02-24
> **대상:** GridSonar v1.0.0

---

## 1. 개요

GridSonar는 **빌드 과정이 필요 없는** 순수 정적 웹 애플리케이션입니다.
Node.js, npm, Webpack, Vite 등의 빌드 도구가 전혀 필요하지 않습니다.

## 2. 실행 방법

### 2.1. 로컬 개발 서버 (권장)

ES 모듈과 Service Worker는 `file://` 프로토콜에서 동작하지 않으므로,
로컬 HTTP 서버가 필요합니다.

**방법 1: Python (이미 설치된 경우)**
```bash
cd GridSonar
python -m http.server 8080
# 브라우저에서 http://localhost:8080 접속
```

**방법 2: Node.js (이미 설치된 경우)**
```bash
npx -y serve .
# 또는
npx -y http-server . -p 8080
```

**방법 3: VS Code Live Server 확장**
- `index.html`을 우클릭하여 "Open with Live Server" 선택

### 2.2. 배포

정적 파일 호스팅 서비스에 `GridSonar/` 폴더 전체를 업로드하면 됩니다.

- **GitHub Pages:** 레포지토리 설정 → Pages → 소스 지정
- **Netlify:** 폴더 드래그 앤 드롭
- **Vercel:** 프로젝트 import
- **Cloudflare Pages:** Git 연동 또는 직접 업로드

### 2.3. PWA 설치

HTTPS 환경에서 배포 시, 브라우저의 "앱 설치" 기능을 통해 데스크톱 앱처럼 설치 가능합니다.

## 3. 외부 의존성

모든 외부 라이브러리는 CDN에서 런타임에 동적 로드됩니다.
빌드 시 설치할 패키지가 없습니다.

| 라이브러리 | CDN 소스 | 오프라인 대응 |
|-----------|---------|-------------|
| SheetJS | esm.sh/xlsx | Service Worker 캐싱 |
| PapaParse | esm.sh/papaparse | Service Worker 캐싱 |
| Fuse.js | esm.sh/fuse.js | Service Worker 캐싱 |
| localForage | esm.sh/localforage | Service Worker 캐싱 |

## 4. 브라우저 호환성

| 브라우저 | 최소 버전 | 비고 |
|---------|----------|------|
| Chrome | 90+ | 권장 |
| Edge | 90+ | Chromium 기반 |
| Firefox | 90+ | 지원 |
| Safari | 15+ | 부분 지원 (IndexedDB 제한) |

## 5. 디렉토리 설명

```
GridSonar/
├── index.html          # 진입점 (이것만 열면 됨)
├── manifest.json       # PWA 설정
├── sw.js              # 오프라인 캐싱
├── css/               # 스타일시트
├── js/                # JavaScript 모듈
│   ├── app.js         # 앱 초기화
│   ├── core/          # 핵심 로직
│   ├── workers/       # Web Worker
│   ├── ui/            # UI 컴포넌트
│   └── utils/         # 유틸리티
└── assets/            # 아이콘, 폰트
```
