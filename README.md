# GridSonar

## 🇰🇷 한국어

**GridSonar**는 대용량 Excel/CSV 파일에서 원하는 데이터를 빠르고 직관적으로 찾는 100% 브라우저 기반 서버리스 PWA 검색 도구입니다.

> ⚡ 서버 불필요 · 오프라인 동작 · 4계층 지능형 검색 · 초성 검색 지원

### ✨ 주요 기능
- **100% Web Native:** 서버/백엔드 없이 브라우저에서 독립적으로 동작
- **비정형 문서 지원(v2.0):** PDF(`.pdf`), Word(`.docx`) 문서 검색 및 스니펫 하이라이팅 지원
- **대용량 파일 처리:** Web Worker + 스트리밍 파싱으로 UI 프리징 없이 대용량 Excel/CSV 파일 처리
- **4계층 검색 엔진:** 정확 매칭, 초성 검색, 퍼지 매칭, BM25 랭킹을 동시 실행
- **초성 검색:** `ㅎㄱㄷ` → `홍길동` 자동 매칭 (외부 라이브러리 없이 순수 유니코드 연산)
- **스마트 쿼리:** 공백=AND, `-`=제외, `숫자~숫자`=범위 검색
- **오프라인 PWA:** Service Worker로 설치 후 인터넷 없이 사용 가능
- **IndexedDB 캐시:** 재시작 시 엑셀 재로드 없이 즉시 복원
- **테마:** Windows 11 Fluent 스타일 다크/라이트 모드
- **내보내기:** 검색 결과를 .xlsx/.csv로 내보내기
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

**GridSonar** is a 100% browser-based, serverless PWA search tool for quickly and intuitively finding data in large Excel/CSV files.

> ⚡ No server required · Offline capable · 4-layer intelligent search · Korean consonant search

### ✨ Key Features
- **100% Web Native:** Runs independently in the browser without any server/backend
- **Unstructured Docs (v2.0):** Supports PDF (`.pdf`) and Word (`.docx`) file search with snippet rendering
- **Large File Processing:** Web Workers + streaming parsing for freeze-free large Excel/CSV file handling
- **4-Layer Search Engine:** Exact match, Korean consonant search, fuzzy match, and BM25 ranking
- **Smart Queries:** Space=AND, `-`=exclude, `number~number`=range search
- **Offline PWA:** Install and use without internet via Service Worker
- **IndexedDB Cache:** Instant restore on restart without reloading Excel files
- **Themes:** Windows 11 Fluent-style dark/light mode
- **Export:** Export search results to .xlsx/.csv
- **Multilingual UI:** English, Korean, Japanese, Chinese (Traditional/Simplified)

---

## 🇯🇵 日本語

**GridSonar**は、大容量のExcel/CSVファイルからデータを素早く直感的に検索する、100%ブラウザベースのサーバーレスPWA検索ツールです。

> ⚡ サーバー不要 · オフライン動作 · 4階層インテリジェント検索 · 韓国語初声検索対応

### ✨ 主要機能
- **100% Web Native:** サーバー/バックエンドなしでブラウザ上で独立して動作
- **非構造化ドキュメント (v2.0):** PDF (`.pdf`) および Word (`.docx`) ファイルの検索とスニペット表示をサポート
- **大容量ファイル処理:** Web Worker + ストリーミング解析でUIのフリーズなしに大容量 Excel/CSV 処理
- **4階層検索エンジン:** 完全一致、初声検索、ファジーマッチ、BM25ランキングを同時実行
- **韓国語初声検索:** `ㅎㄱㄷ` → `홍길동`（ホン・ギルドン）自動マッチング (外部ライブラリなしの純粋なUnicode演算)
- **スマートクエリ:** スペース=AND、`-`=除外、`数字~数字`=範囲検索
- **オフラインPWA:** Service Workerでインストール後、インターネット不要
- **IndexedDBキャッシュ:** 再起動時にExcelを再ロードせずに即時復元
- **テーマ:** Windows 11 Fluentスタイルのダーク/ライトモード
- **エクスポート:** 検索結果を.xlsx/.csvでエクスポート
- **多言語対応UI:** 日本語、韓国語、英語、中国語（繁/簡）

---

## 🇹🇼 中文（繁體）

**GridSonar** 是一款 100% 基於瀏覽器的無伺服器 PWA 搜尋工具，用於快速直觀地在大型 Excel/CSV 檔案中尋找資料。

> ⚡ 無需伺服器 · 離線運作 · 4層智慧搜尋 · 支援韓文首音搜尋

### ✨ 主要功能
- **100% Web Native:** 無需伺服器/後端，在瀏覽器中獨立運作
- **非結構化文件 (v2.0):** 支援 PDF (`.pdf`) 和 Word (`.docx`) 檔案搜尋及片段重點顯示
- **大容量檔案處理:** Web Worker + 串流解析，處理大型 Excel/CSV 檔案時 UI 不卡頓
- **4層搜尋引擎:** 同時執行精確比對、初聲搜尋、模糊比對和 BM25 排名
- **韓文初聲搜尋:** `ㅎㄱㄷ` → 自動比對 `홍길동` (無需外部函式庫的純 Unicode 運算)
- **智慧查詢:** 空格=AND、`-`=排除、`數字~數字`=範圍查詢
- **離線 PWA:** 透過 Service Worker 安裝後可離線使用
- **IndexedDB 快取:** 重啟時無需重新載入 Excel 即可立即恢復
- **主題:** Windows 11 Fluent 風格的深色/淺色模式
- **匯出:** 將搜尋結果匯出為 .xlsx/.csv
- **多語言 UI：** 繁體中文、簡體中文、英文、韓文、日文

---

## 🇨🇳 中文（简体）

**GridSonar** 是一款 100% 基于浏览器的无服务器 PWA 搜索工具，用于快速直观地在大型 Excel/CSV 文件中查找数据。

> ⚡ 无需服务器 · 离线运行 · 4层智能搜索 · 支持韩文首音搜索

### ✨ 主要功能
- **100% Web Native:** 无需服务器/后端，在浏览器中独立运行
- **非结构化文档 (v2.0):** 支持 PDF (`.pdf`) 和 Word (`.docx`) 文件搜索及片段高亮显示
- **大容量文件处理:** Web Worker + 流式解析，处理大型 Excel/CSV 文件时 UI 不卡顿
- **4层搜索引擎:** 同时执行精确匹配、初声搜索、模糊匹配和 BM25 排名
- **韩文初声搜索:** `ㅎㄱㄷ` → 自动匹配 `홍길동` (无需外部库的纯 Unicode 运算)
- **智能查询:** 空格=AND、`-`=排除、`数字~数字`=范围查询
- **离线 PWA:** 通过 Service Worker 安装后可离线使用
- **IndexedDB 缓存:** 重启时无需重新加载 Excel 即可立即恢复
- **主题:** Windows 11 Fluent 风格的深色/浅色模式
- **导出:** 将搜索结果导出为 .xlsx/.csv
- **多语言 UI：** 简体中文、繁体中文、英文、韩文、日文

---

## 📄 License
MIT License

## 🔗 Origin
Ported from [Data Scavenger v2.0.0](https://github.com/) (Python/PySide6/Pandas) to Web Native PWA.
