# GridSonar

## 🇰🇷 한국어

**GridSonar**는 대용량 Excel/CSV/PDF/DOCX/PPTX 파일에서 원하는 데이터를 빠르고 직관적으로 찾는 100% 브라우저 기반 서버리스 PWA 검색 도구입니다.

> ⚡ 서버 불필요 · 오프라인 동작 · 4계층 지능형 검색 · 초성 검색 지원

### ✨ 주요 기능
- **100% Web Native:** 서버/백엔드 없이 브라우저에서 독립적으로 동작
- **비정형 문서 지원(v2.0):** PDF(`.pdf`), Word(`.docx`), PowerPoint(`.pptx`) 문서 검색 및 스니펫 하이라이팅 지원
- **Google Drive 연동(v2.6):** 100% 클라이언트 사이드 Google Drive 파일 선택 및 다운로드 (서버리스)
- **스마트 검색어 문법:** 공백=AND, `-`=제외, `숫자~숫자`=범위 검색, `열:이름`=특정열 검색, `/정규식/`=고급 매칭, `"공백 단어"`=따옴표 묶음
- **대용량 파일 처리:** Web Worker + 스트리밍 파싱으로 UI 프리징 없이 대용량 파일 처리
- **4계층 검색 엔진:** 정확 매칭, 초성 검색, 퍼지 매칭, BM25 랭킹을 동시 실행
- **초성 검색:** `ㅎㄱㄷ` → `홍길동` 자동 매칭 (외부 라이브러리 없이 순수 유니코드 연산)
- **열 정렬(v2.8):** 헤더 클릭으로 오름/내림 정렬, 3단계 사이클
- **키보드 단축키(v2.8):** `Ctrl+K` 검색창 포커스, `Esc` 모달/검색어 초기화, `↑↓` 결과 탐색
- **검색어 자동완성(v2.9):** 최근 검색어 필터 + 로드된 열 이름 `col:` 제안 드롭다운
- **행 선택 내보내기(v2.10):** 체크박스로 원하는 행만 골라 XLSX/CSV 내보내기
- **오프라인 PWA:** Service Worker로 설치 후 인터넷 없이 사용 가능
- **내보내기:** 전체/선택 결과를 .xlsx/.csv로 내보내기 (OS 네이티브 Save As)
- **다국어 지원:** 한/영/일/중(번체)/중(간체)

### 🎯 대상 사용자
대량의 스프레드시트에서 원하는 데이터를 찾아야 하는 비개발자 사무직 사용자

### 🖥️ 기술 스택
| 구분 | 기술 |
|------|------|
| 구조 | HTML5, Vanilla CSS, JavaScript ES2022+ (ES 모듈) |
| 파일 파싱 | SheetJS (CDN), PapaParse (CDN) |
| 검색 | 순수 JS (자모, BM25) + Fuse.js (CDN) |
| 저장 | IndexedDB (localForage CDN) |
| PWA | Service Worker + manifest.json |

---

## 🇺🇸 English

**GridSonar** is a 100% browser-based, serverless PWA search tool for quickly and intuitively finding data in large Excel/CSV/PDF/DOCX/PPTX files.

> ⚡ No server required · Offline capable · 4-layer intelligent search · Korean consonant search

### ✨ Key Features
- **100% Web Native:** Runs independently in the browser without any server/backend
- **Unstructured Docs (v2.0):** PDF (`.pdf`), Word (`.docx`), PowerPoint (`.pptx`) search with snippet highlighting
- **Google Drive Integration (v2.6):** 100% client-side Google Drive file selection and download (Serverless)
- **Smart Query Syntax:** Space=AND, `-`=exclude, `num~num`=range, `col:name`=column, `/regex/`=pattern, `"phrase"`=quoted
- **Large File Processing:** Web Workers + streaming parsing, no UI freeze
- **4-Layer Search Engine:** Exact match, Korean consonant, fuzzy, and BM25 ranking
- **Column Sort (v2.8):** Click header to sort ascending/descending/reset
- **Keyboard Shortcuts (v2.8):** `Ctrl+K` focus search, `Esc` close/clear, `↑↓` navigate results
- **Search Autocomplete (v2.9):** Recent keywords + `col:NAME` column suggestions dropdown
- **Row Selection Export (v2.10):** Checkbox to select rows and export only selected to XLSX/CSV
- **Offline PWA:** Install and use without internet via Service Worker
- **Export:** Full or selected results to .xlsx/.csv with native Save As dialog
- **Multilingual UI:** English, Korean, Japanese, Chinese (Traditional/Simplified)

---

## 🇯🇵 日本語

**GridSonar**は、大容量のExcel/CSV/PDF/DOCX/PPTXファイルからデータを素早く直感的に検索する、100%ブラウザベースのサーバーレスPWA検索ツールです。

> ⚡ サーバー不要 · オフライン動作 · 4階層インテリジェント検索 · 韓国語初声検索対応

### ✨ 主要機能
- **100% Web Native:** サーバー/バックエンドなしでブラウザ上で独立して動作
- **非構造化ドキュメント (v2.0):** PDF (`.pdf`)、Word (`.docx`)、PowerPoint (`.pptx`) ファイルの検索とスニペット表示
- **Google Drive 連携 (v2.6):** 100%クライアントサイドのGoogle Driveファイル選択とダウンロード (サーバーレス)
- **スマートクエリ構文:** スペース=AND、`-`=除外、`数字~数字`=範囲、`col:名前`=列検索、`/正規表現/`=パターン、`"フレーズ"`=引号
- **大容量ファイル処理:** Web Worker + ストリーミング解析でUIフリーズなし
- **4階層検索エンジン:** 完全一致、初声検索、ファジーマッチ、BM25ランキング
- **列ソート (v2.8):** ヘッダークリックで昇順/降順/元順の3段階ソート
- **キーボードショートカット (v2.8):** `Ctrl+K` 検索フォーカス、`Esc` クリア、`↑↓` 結果ナビ
- **検索自動補完 (v2.9):** 最近の検索語 + `col:NAME` 列名候補ドロップダウン
- **行選択エクスポート (v2.10):** チェックボックスで選択行のみXLSX/CSVエクスポート
- **オフラインPWA:** Service Workerでインストール後、インターネット不要
- **エクスポート:** 検索結果を.xlsx/.csvでエクスポート
- **多言語対応UI:** 日本語、韓国語、英語、中国語（繁/簡）

---

## 🇹🇼 中文（繁體）

**GridSonar** 是一款 100% 基於瀏覽器的無伺服器 PWA 搜尋工具，用於快速直觀地在大型 Excel/CSV/PDF/DOCX/PPTX 檔案中尋找資料。

> ⚡ 無需伺服器 · 離線運作 · 4層智慧搜尋 · 支援韓文首音搜尋

### ✨ 主要功能
- **100% Web Native:** 無需伺服器/後端，在瀏覽器中獨立運作
- **非結構化文件 (v2.0):** 支援 PDF (`.pdf`)、Word (`.docx`)、PowerPoint (`.pptx`) 搜尋及片段重點顯示
- **整合 Google 雲端硬碟 (v2.6):** 100% 用戶端 Google Drive 檔案選擇與下載 (無伺服器)
- **智慧查詢語法:** 空格=AND、`-`=排除、`數字~數字`=範圍、`col:名稱`=欄位搜尋、`/正規表示式/`=進階比對、`"片語"`=引號包覆
- **大容量檔案處理:** Web Worker + 串流解析，UI 不卡頓
- **4層搜尋引擎:** 精確比對、初聲搜尋、模糊比對和 BM25 排名
- **欄位排序 (v2.8):** 點擊標題進行升序/降序/原序 3段切換
- **鍵盤快捷鍵 (v2.8):** `Ctrl+K` 聚焦搜尋、`Esc` 清除、`↑↓` 結果導覽
- **搜尋自動完成 (v2.9):** 最近搜尋語 + `col:NAME` 欄位名稱建議下拉
- **選取列匯出 (v2.10):** 核取方塊選取需要的列，僅匯出至 XLSX/CSV
- **離線 PWA:** 透過 Service Worker 安裝後可離線使用
- **多語言 UI：** 繁體中文、簡體中文、英文、韓文、日文

---

## 🇨🇳 中文（简体）

**GridSonar** 是一款 100% 基于浏览器的无服务器 PWA 搜索工具，用于快速直观地在大型 Excel/CSV/PDF/DOCX/PPTX 文件中查找数据。

> ⚡ 无需服务器 · 离线运行 · 4层智能搜索 · 支持韩文首音搜索

### ✨ 主要功能
- **100% Web Native:** 无需服务器/后端，在浏览器中独立运行
- **非结构化文档 (v2.0):** 支持 PDF (`.pdf`)、Word (`.docx`)、PowerPoint (`.pptx`) 文件搜索及片段高亮
- **集成 Google Drive (v2.6):** 100% 客户端 Google Drive 文件选择与下载 (无服务器)
- **智能查询语法:** 空格=AND、`-`=排除、`数字~数字`=范围、`col:名称`=列查询、`/正则式/`=高级匹配、`"词组"`=引号包裹
- **大容量文件处理:** Web Worker + 流式解析，UI 不卡顿
- **4层搜索引擎:** 精确匹配、初声搜索、模糊匹配和 BM25 排名
- **列排序 (v2.8):** 点击列标题进行升序/降序/原序 3段切换
- **键盘快捷键 (v2.8):** `Ctrl+K` 聚焦搜索、`Esc` 清除、`↑↓` 结果导航
- **搜索自动补全 (v2.9):** 最近搜索词 + `col:NAME` 列名建议下拉
- **行选择导出 (v2.10):** 复选框选取需要的行，仅导出至 XLSX/CSV
- **离线 PWA:** 通过 Service Worker 安装后可离线使用
- **多语言 UI：** 简体中文、繁体中文、英文、韩文、日文

---

## 📄 License
Apache License 2.0 — See [LICENSE](LICENSE) for details.

## 🔗 Origin
Ported from [Data Scavenger v2.0.0](https://github.com/) (Python/PySide6/Pandas) to Web Native PWA.
