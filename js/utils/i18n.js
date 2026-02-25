/**
 * [v1.0.0] 다국어 지원 모듈 (i18n)
 * 한/영/일/중(번체)/중(간체) 5개 국어 지원
 * D3D Protocol §8: 다국어 구현
 */

const translations = {
    ko: {
        appName: 'GridSonar',
        searchPlaceholder: '검색어를 입력하세요... (초성: ㅎㄱㄷ, 제외: -키워드, 범위: 100~500, 열: 열:이름 홍길동)',
        searchButton: '검색',
        dropFilesText: '파일을 여기에 끌어다 놓으세요',
        dropFilesOr: '또는 클릭하여 파일 선택',
        supportedFormats: '.xlsx · .xls · .csv · .pdf · .docx',
        indexing: '인덱싱 중',
        indexingComplete: '인덱싱 완료',
        searching: '검색 중',
        searchComplete: '검색 완료',
        noResults: '검색 결과가 없습니다',
        resultsUnit: '건',
        filesTitle: '📁 파일',
        addFilesTitle: '파일 추가',
        rows: '행',
        cells: '셀',
        copyTitle: '클립보드 복사',
        copyBtn: '📋 복사',
        exportXlsxTitle: 'Excel 내보내기',
        exportXlsxBtn: '📤 XLSX',
        exportCsvTitle: 'CSV 내보내기',
        exportCsvBtn: '📄 CSV',
        themeToggleTitle: '테마 전환 (Theme)',
        similarityLabel: '유사도',
        matchExact: '정확',
        matchFuzzy: '유사',
        matchChosung: '초성',
        matchRange: '범위',
        matchRegex: '정규식',
        statusReady: '준비됨',
        favorites: '즐겨찾기',
        removeFile: '제거',
        clearCacheTitle: '캐시 모조리 삭제',
        clearCacheBtn: '캐시삭제',
        detailModalTitle: '상세 보기',
        close: '닫기',
        copySuccess: '클립보드에 복사했습니다',
        copyFail: '클립보드 복사에 실패했습니다',
        exportSuccess: '내보내기 완료',
        exportFail: '내보내기 실패',
        addFilesFirst: '먼저 파일을 추가해 주세요',
        filterPlaceholder: '결과 내 필터링...',
        seconds: '초',
        cachedRestore: '캐시에서 복원',
        parsingError: '파싱 오류',
        selected: '선택됨',
        emptyStateTitle: 'GridSonar',
        loadingIndexing: '⏳ 데이터를 인덱싱 중입니다. 잠시만 기다려주세요.',
        searchError: '검색 오류',
        emptyStateTextQuery: '에 대한 결과를 찾을 수 없습니다.\n다른 검색어를 시도해 보세요.',
        confirmClearCache: '캐시를 모두 지우고 앱을 초기화하시겠습니까?',
        metaMatch: '_매칭',
        metaFile: '_파일',
        metaSheet: '_시트',
        metaMatchType: '_매칭유형',
        metaSimilarity: '_유사도',
        exportFileName: '검색결과',
        errUnsupportedFormatCount: '⚠️ {count}개 파일이 지원되지 않는 형식입니다 (.xlsx, .xls, .csv, .pdf, .docx만 가능)',
        errUnsupportedFormat: '⚠️ 지원되지 않는 파일 형식입니다 (.xlsx, .xls, .csv, .pdf, .docx만 가능)',
        infoSkippedFiles: 'ℹ️ {skipped}개 비지원 파일 제외, {loaded}개 파일 로드',
        loadingFolder: '폴더 탐색 중...',
        loadingBM25: 'BM25 인덱스 구축 중...',
        newVersionAvailable: '🔄 새로운 버전이 있습니다. 페이지를 새로고침하면 적용됩니다.',
        matchDetail: '매칭 상세',
        errPasswordProtected: '🔒 암호 보호된 파일',
        metaPath: '_파일경로',
        metaErrorReason: '_오류사유',
        exportErrorsTitle: '파싱 실패 파일 목록 내보내기',
        exportErrorsBtn: '⚠️ 실패 추출',
        failedFilesName: '실패파일목록',
        sessionHistory: '📋 최근 작업',
        sessionRestore: '복원',
        sessionDelete: '삭제',
        sessionRestoring: '세션 복원 중...',
        sessionRestored: '세션에서 복원 완료',
        sessionSaved: '작업 세션이 저장되었습니다',
        sessionDeleted: '세션이 삭제되었습니다',
        sessionCacheLost: '⚠️ 캐시가 소실되었습니다. 원본 파일을 다시 드롭해주세요.',
        sessionFiles: '개 파일',
        sessionEmpty: '최근 작업 없음',
        sessionConfirmDelete: '이 세션을 삭제하시겠습니까?',
        sessionConfirmRestore: '현재 작업을 초기화하고 이 세션을 복원하시겠습니까?',
        driveConnect: 'Google Drive',
        driveDisconnect: '연결 해제',
        driveConnecting: 'Google Drive 연결 중...',
        drivePickerTitle: 'Google Drive에서 파일 선택',
        drivePickerOpen: '파일을 선택하세요...',
        driveDownloading: '다운로드 중',
        driveDownloadComplete: '다운로드 완료',
        driveError: 'Google Drive 오류',
        driveLoginRequired: 'Google 로그인이 필요합니다',
        driveUnsupported: '지원하지 않는 파일 형식입니다',
        driveSettings: '설정',
        driveSave: '저장 & 연결',
        driveExportLimit: '파일이 너무 큽니다 (내보내기 10MB 제한)',
        driveSettingsGuide: 'Google Cloud Console에서 생성 방법',
        helpTitle: '도움말',
        helpHtml: `
            <div class="help-section">
                <div class="help-section-title">🔍 일반 검색 (다중 키워드)</div>
                <div class="help-example">
                    <div class="help-example-query">홍길동 영업부</div>
                    <div class="help-example-desc">공백으로 구분된 여러 검색어는 <b>AND 조건</b>으로 검색됩니다. 지정한 단어들이 모두 포함된 행만 반환합니다.</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">➖ 제외 검색 (NOT 조건)</div>
                <div class="help-example">
                    <div class="help-example-query">서울 <span class="help-kbd">-강남</span></div>
                    <div class="help-example-desc">단어 앞에 빼기(<kbd>-</kbd>) 기호를 붙이면 해당 단어가 포함된 행을 <b>제외</b>합니다.</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">📊 숫자 범위 검색</div>
                <div class="help-example">
                    <div class="help-example-query">사과 <span class="help-kbd">100~500</span></div>
                    <div class="help-example-desc">숫자와 물결(<kbd>~</kbd>) 기호를 사용하여 <b>숫자 범위</b>를 지정할 수 있습니다.</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">🔠 초성 검색 (한글 전용)</div>
                <div class="help-example">
                    <div class="help-example-query"><span class="help-kbd">ㅎㄱㄷ</span></div>
                    <div class="help-example-desc">한글 자음(초성)만 입력하여 <b>초성 문자열</b>과 일치하는 항목을 검색합니다. (예: ㅎㄱㄷ → 홍길동)</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">🎯 열 지정(Column) 검색</div>
                <div class="help-example">
                    <div class="help-example-query"><span class="help-kbd">열:이름</span> 홍길동 <span class="help-kbd">col:금액</span> 100~500</div>
                    <div class="help-example-desc"><kbd>열:</kbd> 또는 <kbd>col:</kbd> 접두사와 열 이름을 붙여 <b>특정 열에서만</b> 키워드를 검색합니다. 열 이름은 대소문자 구분 없이 부분 일치로 적용됩니다.</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">💬 공백 포함 키워드 (따옴표)</div>
                <div class="help-example">
                    <div class="help-example-query">열:<span class="help-kbd">"오늘 요금"</span> <span class="help-kbd">"장기 미납"</span></div>
                    <div class="help-example-desc">공백이 포함된 열 이름이나 검색어는 <b>큰따옴표 서식(" ")</b>으로 감싸서 하나의 검색어로 묶을 수 있습니다.</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">🧩 정규식 검색 (고급)</div>
                <div class="help-example">
                    <div class="help-example-query"><span class="help-kbd">/\\d{3}-\\d{4}/</span></div>
                    <div class="help-example-desc">슬래시(<kbd>/</kbd>)로 감싼 <b>정규식 패턴</b>을 사용할 수 있습니다. 전화번호, 이메일 등 특정 패턴을 정밀하게 검색합니다.</div>
                </div>
                <div class="help-example">
                    <div class="help-example-query"><span class="help-kbd">/홍[가-힣]+/i</span></div>
                    <div class="help-example-desc">플래그 <kbd>i</kbd>를 붙이면 대소문자를 무시합니다. <kbd>g</kbd>, <kbd>m</kbd> 등의 플래그도 지원됩니다.</div>
                </div>
            </div>
            <div class="help-tip">💡 <b>꿀팁:</b> 검색 결과 행을 더블클릭하면 <b>상세 보기</b>가 열리며 복사 버튼을 통해 전체 행 정보를 쉽게 공유할 수 있습니다.</div>
        `
    },
    en: {
        appName: 'GridSonar',
        searchPlaceholder: 'Search... (Fuzzy, -Exclude, Range: 100~500, Column: col:Name John)',
        searchButton: 'Search',
        dropFilesText: 'Drop files here',
        dropFilesOr: 'or click to select files',
        supportedFormats: '.xlsx · .xls · .csv · .pdf · .docx',
        indexing: 'Indexing',
        indexingComplete: 'Indexing complete',
        searching: 'Searching',
        searchComplete: 'Search complete',
        noResults: 'No results found',
        resultsUnit: 'results',
        filesTitle: '📁 Files',
        addFilesTitle: 'Add Files',
        rows: 'rows',
        cells: 'cells',
        copyTitle: 'Copy to clipboard',
        copyBtn: '📋 Copy',
        exportXlsxTitle: 'Export to Excel',
        exportXlsxBtn: '📤 XLSX',
        exportCsvTitle: 'Export to CSV',
        exportCsvBtn: '📄 CSV',
        themeToggleTitle: 'Toggle Theme',
        similarityLabel: 'Similarity',
        matchExact: 'Exact',
        matchFuzzy: 'Fuzzy',
        matchChosung: 'Initial',
        matchRange: 'Range',
        matchRegex: 'Regex',
        statusReady: 'Ready',
        favorites: 'Favorites',
        removeFile: 'Remove',
        clearCacheTitle: 'Flush entirely',
        clearCacheBtn: 'Flush',
        detailModalTitle: 'Detail View',
        close: 'Close',
        copySuccess: 'Copied to clipboard',
        copyFail: 'Clipboard copy failed',
        exportSuccess: 'Export complete',
        exportFail: 'Export failed',
        addFilesFirst: 'Please add files first',
        filterPlaceholder: 'Filter results...',
        seconds: 's',
        cachedRestore: 'Restored from cache',
        parsingError: 'Parsing error',
        selected: 'selected',
        emptyStateTitle: 'GridSonar',
        loadingIndexing: '⏳ Indexing data. Please wait.',
        searchError: 'Search error',
        emptyStateTextQuery: ' no results found.\nTry a different search term.',
        confirmClearCache: 'Are you sure you want to flush the cache and reset the app?',
        metaMatch: '_Match',
        metaFile: '_File',
        metaSheet: '_Sheet',
        metaMatchType: '_MatchType',
        metaSimilarity: '_Similarity',
        exportFileName: 'SearchResults',
        errUnsupportedFormatCount: '⚠️ {count} files have unsupported formats (only .xlsx, .xls, .csv, .pdf, .docx supported)',
        errUnsupportedFormat: '⚠️ Unsupported file format (only .xlsx, .xls, .csv, .pdf, .docx supported)',
        infoSkippedFiles: 'ℹ️ Skipped {skipped} unsupported files, loaded {loaded} files',
        loadingFolder: 'Scanning folder...',
        loadingBM25: 'Building BM25 index...',
        newVersionAvailable: '🔄 A new version is available. It will be applied when you refresh the page.',
        matchDetail: 'Match Details',
        errPasswordProtected: '🔒 Password protected file',
        metaPath: '_Path',
        metaErrorReason: '_ErrorReason',
        exportErrorsTitle: 'Export parse failed files list',
        exportErrorsBtn: '⚠️ Failures',
        failedFilesName: 'FailedFilesList',
        sessionHistory: '📋 Recent Sessions',
        sessionRestore: 'Restore',
        sessionDelete: 'Delete',
        sessionRestoring: 'Restoring session...',
        sessionRestored: 'Session restored',
        sessionSaved: 'Work session saved',
        sessionDeleted: 'Session deleted',
        sessionCacheLost: '⚠️ Cache was cleared. Please re-drop the original files.',
        sessionFiles: 'files',
        sessionEmpty: 'No recent sessions',
        sessionConfirmDelete: 'Delete this session?',
        sessionConfirmRestore: 'Clear current work and restore this session?',
        driveConnect: 'Google Drive',
        driveDisconnect: 'Disconnect',
        driveConnecting: 'Connecting to Google Drive...',
        drivePickerTitle: 'Select files from Google Drive',
        drivePickerOpen: 'Please select files...',
        driveDownloading: 'Downloading',
        driveDownloadComplete: 'Download complete',
        driveError: 'Google Drive Error',
        driveLoginRequired: 'Google login required',
        driveUnsupported: 'Unsupported file format',
        driveSettings: 'Settings',
        driveSave: 'Save & Connect',
        driveExportLimit: 'File too large (10MB export limit)',
        driveSettingsGuide: 'How to create them in Google Cloud Console',
        helpTitle: 'Help',
        helpHtml: `
            <div class="help-section">
                <div class="help-section-title">🔍 Normal Search (AND Condition)</div>
                <div class="help-example">
                    <div class="help-example-query">John Sales</div>
                    <div class="help-example-desc">Multiple words separated by spaces act as an <b>AND condition</b>. It returns rows containing all specified words.</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">➖ Exclude Search (NOT Condition)</div>
                <div class="help-example">
                    <div class="help-example-query">New York <span class="help-kbd">-Brooklyn</span></div>
                    <div class="help-example-desc">Prefix a word with a minus (<kbd>-</kbd>) sign to <b>exclude</b> rows containing that word.</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">📊 Number Range Search</div>
                <div class="help-example">
                    <div class="help-example-query">Apple <span class="help-kbd">100~500</span></div>
                    <div class="help-example-desc">Specify a <b>number range</b> using numbers and a tilde (<kbd>~</kbd>). Returns rows containing values within the range.</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">🎯 Column Target Search</div>
                <div class="help-example">
                    <div class="help-example-query"><span class="help-kbd">col:Name</span> John <span class="help-kbd">col:Price</span> 100~500</div>
                    <div class="help-example-desc">Use <kbd>col:</kbd> prefix followed by a column name to search a keyword <b>only in that specific column</b>. Partial matching and case-insensitivity apply.</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">💬 Phrase Search (Quotes)</div>
                <div class="help-example">
                    <div class="help-example-query">col:<span class="help-kbd">"today fee"</span> <span class="help-kbd">"long term"</span></div>
                    <div class="help-example-desc">Wrap keywords or column names with spaces in <b>double quotes (" ")</b> to treat them as a single phrase.</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">🧩 Regex Search (Advanced)</div>
                <div class="help-example">
                    <div class="help-example-query"><span class="help-kbd">/\\d{3}-\\d{4}/</span></div>
                    <div class="help-example-desc">Wrap a <b>regular expression</b> in slashes (<kbd>/</kbd>). Precisely search for phone numbers, emails and other patterns.</div>
                </div>
                <div class="help-example">
                    <div class="help-example-query"><span class="help-kbd">/^john/i</span></div>
                    <div class="help-example-desc">Append flag <kbd>i</kbd> for case-insensitive matching. Flags <kbd>g</kbd>, <kbd>m</kbd> etc. are also supported.</div>
                </div>
            </div>
            <div class="help-tip">💡 <b>Tip:</b> Double-click a row in the search results to open the <b>Detail View</b>, from which you can easily copy all information.</div>
        `
    },
    ja: {
        appName: 'GridSonar',
        searchPlaceholder: '検索語を入力してください... (-除外, 範囲: 100~500)',
        searchButton: '検索',
        dropFilesText: 'ここにファイルをドロップ',
        dropFilesOr: 'またはクリックして選択',
        supportedFormats: '.xlsx · .xls · .csv · .pdf · .docx',
        indexing: 'インデックス中',
        indexingComplete: 'インデックス完了',
        searching: '検索中',
        searchComplete: '検索完了',
        noResults: '検索結果なし',
        resultsUnit: '件',
        filesTitle: '📁 ファイル',
        addFilesTitle: 'ファイルを追加',
        rows: '行',
        cells: 'セル',
        copyTitle: 'クリップボードにコピー',
        copyBtn: '📋 コピー',
        exportXlsxTitle: 'Excel出力',
        exportXlsxBtn: '📤 XLSX',
        exportCsvTitle: 'CSV出力',
        exportCsvBtn: '📄 CSV',
        themeToggleTitle: 'テーマ切替',
        similarityLabel: '類似度',
        matchExact: '完全一致',
        matchFuzzy: '類似',
        matchChosung: '初声',
        matchRange: '範囲',
        matchRegex: '正規表現',
        statusReady: '準備完了',
        favorites: 'お気に入り',
        removeFile: '削除',
        clearCacheTitle: 'キャッシュを消去',
        clearCacheBtn: '消去',
        detailModalTitle: '詳細表示',
        close: '閉じる',
        copySuccess: 'クリップボードにコピーしました',
        copyFail: 'コピーに失敗しました',
        exportSuccess: '出力完了',
        exportFail: '出力失敗',
        addFilesFirst: 'まずファイルを追加してください',
        filterPlaceholder: '結果内フィルタ...',
        seconds: '秒',
        cachedRestore: 'キャッシュから復元',
        parsingError: 'パース・エラー',
        selected: '選択済み',
        emptyStateTitle: 'GridSonar',
        loadingIndexing: '⏳ データをインデックス中です。お待ちください。',
        searchError: '検索エラー',
        emptyStateTextQuery: ' の結果が見つかりません。\n他の語句をお試しください。',
        confirmClearCache: 'キャッシュを完全に消去してアプリを初期化しますか？',
        metaMatch: '_マッチ',
        metaFile: '_ファイル',
        metaSheet: '_シート',
        metaMatchType: '_マッチタイプ',
        metaSimilarity: '_類似度',
        exportFileName: '検索結果',
        errUnsupportedFormatCount: '⚠️ {count}個のファイルは未対応形式です (.xlsx, .xls, .csv, .pdf, .docxのみ対応)',
        errUnsupportedFormat: '⚠️ 未対応のファイル形式です (.xlsx, .xls, .csv, .pdf, .docxのみ対応)',
        infoSkippedFiles: 'ℹ️ {skipped}個の未対応ファイルを除外、{loaded}ファイル読み込み完了',
        loadingFolder: 'フォルダをスキャン中...',
        loadingBM25: 'BM25インデックス構築中...',
        newVersionAvailable: '🔄 新しいバージョンがあります。ページを更新すると適用されます。',
        matchDetail: 'マッチ詳細',
        errPasswordProtected: '🔒 パスワード保護されたファイル',
        metaPath: '_ファイルパス',
        metaErrorReason: '_エラー理由',
        exportErrorsTitle: 'パース失敗ファイルリストを出力',
        exportErrorsBtn: '⚠️ 失敗抽出',
        failedFilesName: '失敗ファイルリスト',
        sessionHistory: '📋 最近の作業',
        sessionRestore: '復元',
        sessionDelete: '削除',
        sessionRestoring: 'セッション復元中...',
        sessionRestored: 'セッションから復元完了',
        sessionSaved: '作業セッションを保存しました',
        sessionDeleted: 'セッションを削除しました',
        sessionCacheLost: '⚠️ キャッシュが消去されました。元のファイルを再度ドロップしてください。',
        sessionFiles: '個のファイル',
        sessionEmpty: '最近の作業なし',
        sessionConfirmDelete: 'このセッションを削除しますか？',
        sessionConfirmRestore: '現在の作業をクリアしてこのセッションを復元しますか？',
        driveConnect: 'Google Drive',
        driveDisconnect: '切断',
        driveConnecting: 'Google Driveに接続中...',
        drivePickerTitle: 'Google Driveからファイルを選択',
        drivePickerOpen: 'ファイルを選択してください...',
        driveDownloading: 'ダウンロード中',
        driveDownloadComplete: 'ダウンロード完了',
        driveError: 'Google Drive エラー',
        driveLoginRequired: 'Googleログインが必要です',
        driveUnsupported: 'サポートされていないファイル形式です',
        driveSettings: '設定',
        driveSave: '保存して接続',
        driveExportLimit: 'ファイルが大きすぎます (エクスポート制限10MB)',
        driveSettingsGuide: 'Google Cloud Consoleでの作成方法',
        helpTitle: 'ヘルプ',
        helpHtml: `
            <div class="help-section">
                <div class="help-section-title">🔍 通常検索 (AND 条件)</div>
                <div class="help-example">
                    <div class="help-example-query">山田 営業部</div>
                    <div class="help-example-desc">空白で区切られた複数のキーワードは<b>AND条件</b>として機能します。すべての指定語句が含まれる行を返します。</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">➖ 除外検索 (NOT 条件)</div>
                <div class="help-example">
                    <div class="help-example-query">東京 <span class="help-kbd">-新宿</span></div>
                    <div class="help-example-desc">単語の前にマイナス(<kbd>-</kbd>)記号を付けると、その語句を含む行を<b>除外</b>します。</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">📊 数値範囲検索</div>
                <div class="help-example">
                    <div class="help-example-query">りんご <span class="help-kbd">100~500</span></div>
                    <div class="help-example-desc">数値とチルダ(<kbd>~</kbd>)記号を使用して<b>数値範囲</b>を指定できます。範囲内の数値が含まれる行を検索します。</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">🎯 列指定検索</div>
                <div class="help-example">
                    <div class="help-example-query"><span class="help-kbd">col:氏名</span> 山田 <span class="help-kbd">col:価格</span> 100~500</div>
                    <div class="help-example-desc"><kbd>col:</kbd> 接頭辞と列名を続けることで、<b>特定の列内</b>のみでキーワードを検索します。列名は大文字小文字を区別せず、部分一致で適用されます。</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">💬 空白を含むフレーズ検索（引用符）</div>
                <div class="help-example">
                    <div class="help-example-query">col:<span class="help-kbd">"今日の 料金"</span> <span class="help-kbd">"長期 未納"</span></div>
                    <div class="help-example-desc">空白を含む検索語や列名は、<b>ダブルクォーテーション(" ")</b>で囲むことで一つのフレーズとして扱われます。</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">🧩 正規表現検索 (上級)</div>
                <div class="help-example">
                    <div class="help-example-query"><span class="help-kbd">/\\d{3}-\\d{4}/</span></div>
                    <div class="help-example-desc">スラッシュ(<kbd>/</kbd>)で囲んだ<b>正規表現パターン</b>を使用できます。電話番号やメールなど特定のパターンを精密に検索します。</div>
                </div>
                <div class="help-example">
                    <div class="help-example-query"><span class="help-kbd">/^田中/i</span></div>
                    <div class="help-example-desc">フラグ <kbd>i</kbd> で大文字小文字を無視します。<kbd>g</kbd>、<kbd>m</kbd> なども対応しています。</div>
                </div>
            </div>
            <div class="help-tip">💡 <b>ヒント：</b> 検索結果の行をダブルクリックすることで、<b>詳細表示</b>を開き、すべての情報を簡単にコピーできます。</div>
        `
    },
    'zh-TW': {
        appName: 'GridSonar',
        searchPlaceholder: '輸入搜尋詞... (-排除, 範圍: 100~500)',
        searchButton: '搜尋',
        dropFilesText: '將檔案拖放到此處',
        dropFilesOr: '或點擊選擇檔案',
        supportedFormats: '.xlsx · .xls · .csv · .pdf · .docx',
        indexing: '索引中',
        indexingComplete: '索引完成',
        searching: '搜尋中',
        searchComplete: '搜尋完成',
        noResults: '沒有搜尋結果',
        resultsUnit: '筆',
        filesTitle: '📁 檔案',
        addFilesTitle: '新增檔案',
        rows: '行',
        cells: '儲存格',
        copyTitle: '複製到剪貼簿',
        copyBtn: '📋 複製',
        exportXlsxTitle: '匯出為 Excel',
        exportXlsxBtn: '📤 XLSX',
        exportCsvTitle: '匯出為 CSV',
        exportCsvBtn: '📄 CSV',
        themeToggleTitle: '切換主題',
        similarityLabel: '相似度',
        matchExact: '精確',
        matchFuzzy: '模糊',
        matchChosung: '聲母',
        matchRange: '範圍',
        matchRegex: '正規表示',
        statusReady: '就緒',
        favorites: '我的最愛',
        removeFile: '移除',
        clearCacheTitle: '清除快取',
        clearCacheBtn: '清除',
        detailModalTitle: '詳細資料',
        close: '關閉',
        copySuccess: '已複製到剪貼簿',
        copyFail: '複製失敗',
        exportSuccess: '匯出完成',
        exportFail: '匯出失敗',
        addFilesFirst: '請先新增檔案',
        filterPlaceholder: '在結果中篩選...',
        seconds: '秒',
        cachedRestore: '從快取還原',
        parsingError: '解析錯誤',
        selected: '已選擇',
        emptyStateTitle: 'GridSonar',
        loadingIndexing: '⏳ 數據正在索引中，請稍候。',
        searchError: '搜尋錯誤',
        emptyStateTextQuery: ' 沒有找到結果。\n請嘗試其他搜尋詞。',
        confirmClearCache: '確定要清除所有快取並重設應用程式嗎？',
        metaMatch: '_匹配',
        metaFile: '_檔案',
        metaSheet: '_工作表',
        metaMatchType: '_匹配類型',
        metaSimilarity: '_相似度',
        exportFileName: '搜尋結果',
        errUnsupportedFormatCount: '⚠️ {count} 個檔案格式不支援 (僅支援 .xlsx, .xls, .csv, .pdf, .docx)',
        errUnsupportedFormat: '⚠️ 檔案格式不支援 (僅支援 .xlsx, .xls, .csv, .pdf, .docx)',
        infoSkippedFiles: 'ℹ️ 已略過 {skipped} 個不支援的檔案，已載入 {loaded} 個檔案',
        loadingFolder: '正在掃描資料夾...',
        loadingBM25: '正在建立 BM25 索引...',
        newVersionAvailable: '🔄 發現新版本。重新整理頁面後即可套用。',
        matchDetail: '匹配詳情',
        errPasswordProtected: '🔒 密碼保護的檔案',
        metaPath: '_檔案路徑',
        metaErrorReason: '_錯誤原因',
        exportErrorsTitle: '匯出解析失敗檔案清單',
        exportErrorsBtn: '⚠️ 失敗擷取',
        failedFilesName: '失敗檔案清單',
        sessionHistory: '📋 最近工作',
        sessionRestore: '還原',
        sessionDelete: '刪除',
        sessionRestoring: '正在還原工作階段...',
        sessionRestored: '工作階段已還原',
        sessionSaved: '工作階段已儲存',
        sessionDeleted: '工作階段已刪除',
        sessionCacheLost: '⚠️ 快取已清除。請重新拖放原始檔案。',
        sessionFiles: '個檔案',
        sessionEmpty: '沒有最近的工作',
        sessionConfirmDelete: '確定要刪除此工作階段嗎？',
        sessionConfirmRestore: '確定要清除目前工作並還原此工作階段嗎？',
        driveConnect: 'Google Drive',
        driveDisconnect: '中斷連線',
        driveConnecting: '正在連線至 Google Drive...',
        drivePickerTitle: '從 Google Drive 選擇檔案',
        drivePickerOpen: '請選擇檔案...',
        driveDownloading: '下載中',
        driveDownloadComplete: '下載完成',
        driveError: 'Google Drive 錯誤',
        driveLoginRequired: '需要登入 Google',
        driveUnsupported: '不支援的檔案格式',
        driveSettings: '設定',
        driveSave: '儲存並連線',
        driveExportLimit: '檔案過大 (匯出限制 10MB)',
        driveSettingsGuide: '如何在 Google Cloud Console 中建立',
        helpTitle: '說明',
        helpHtml: `
            <div class="help-section">
                <div class="help-section-title">🔍 一般搜尋 (AND 條件)</div>
                <div class="help-example">
                    <div class="help-example-query">張三 業務部</div>
                    <div class="help-example-desc">以空格分隔的多個關鍵字將作為 <b>AND 條件</b>。只傳回包含所有指定詞彙的資料列。</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">➖ 排除搜尋 (NOT 條件)</div>
                <div class="help-example">
                    <div class="help-example-query">台北 <span class="help-kbd">-信義</span></div>
                    <div class="help-example-desc">在單字前加上減號 (<kbd>-</kbd>) 可<b>排除</b>包含該詞彙的資料列。</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">📊 數值範圍搜尋</div>
                <div class="help-example">
                    <div class="help-example-query">蘋果 <span class="help-kbd">100~500</span></div>
                    <div class="help-example-desc">使用數字和波浪號 (<kbd>~</kbd>) 指定<b>數值範圍</b>。傳回包含範圍內數值的資料列。</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">🎯 指定欄位搜尋</div>
                <div class="help-example">
                    <div class="help-example-query"><span class="help-kbd">col:姓名</span> 張三 <span class="help-kbd">col:價格</span> 100~500</div>
                    <div class="help-example-desc">使用 <kbd>col:</kbd> 前綴加上欄位名稱可<b>僅在特定欄位中</b>搜尋關鍵字。欄位名稱支援不區分大小寫的部分比對。</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">💬 包含空白的詞彙 (引號)</div>
                <div class="help-example">
                    <div class="help-example-query">col:<span class="help-kbd">"今日 費用"</span> <span class="help-kbd">"長期 欠繳"</span></div>
                    <div class="help-example-desc">包含空白的搜尋詞或欄位名稱，可以使用<b>雙引號 (" ")</b> 包裹，將其視為單一詞彙。</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">🧩 正規表示式搜尋 (進階)</div>
                <div class="help-example">
                    <div class="help-example-query"><span class="help-kbd">/\\d{3}-\\d{4}/</span></div>
                    <div class="help-example-desc">使用斜線 (<kbd>/</kbd>) 包裹<b>正規表示式</b>。可精確搜尋電話號碼、電子郵件等特定模式。</div>
                </div>
                <div class="help-example">
                    <div class="help-example-query"><span class="help-kbd">/^張/i</span></div>
                    <div class="help-example-desc">加上旗標 <kbd>i</kbd> 可不區分大小寫。<kbd>g</kbd>、<kbd>m</kbd> 等旗標也支援。</div>
                </div>
            </div>
            <div class="help-tip">💡 <b>提示：</b> 在搜尋結果中連按兩下資料列可開啟<b>詳細資料</b>，並從中輕鬆複製所有資訊。</div>
        `
    },
    'zh-CN': {
        appName: 'GridSonar',
        searchPlaceholder: '输入搜索词... (-排除, 范围: 100~500)',
        searchButton: '搜索',
        dropFilesText: '将文件拖放到此处',
        dropFilesOr: '或点击选择文件',
        supportedFormats: '.xlsx · .xls · .csv · .pdf · .docx',
        indexing: '索引中',
        indexingComplete: '索引完成',
        searching: '搜索中',
        searchComplete: '搜索完成',
        noResults: '没有搜索结果',
        resultsUnit: '条',
        filesTitle: '📁 文件',
        addFilesTitle: '添加文件',
        rows: '行',
        cells: '单元格',
        copyTitle: '复制到剪贴板',
        copyBtn: '📋 复制',
        exportXlsxTitle: '导出为 Excel',
        exportXlsxBtn: '📤 XLSX',
        exportCsvTitle: '导出为 CSV',
        exportCsvBtn: '📄 CSV',
        themeToggleTitle: '切换主题',
        similarityLabel: '相似度',
        matchExact: '精确',
        matchFuzzy: '模糊',
        matchChosung: '声母',
        matchRange: '范围',
        matchRegex: '正则',
        statusReady: '就绪',
        favorites: '收藏夹',
        removeFile: '移除',
        clearCacheTitle: '清除缓存',
        clearCacheBtn: '清除',
        detailModalTitle: '详细信息',
        close: '关闭',
        copySuccess: '已复制到剪贴板',
        copyFail: '复制失败',
        exportSuccess: '导出完成',
        exportFail: '导出失败',
        addFilesFirst: '请先添加文件',
        filterPlaceholder: '在结果中筛选...',
        seconds: '秒',
        cachedRestore: '从缓存恢复',
        parsingError: '解析错误',
        selected: '已选择',
        emptyStateTitle: 'GridSonar',
        loadingIndexing: '⏳ 数据正在索引中，请稍候。',
        searchError: '搜索错误',
        emptyStateTextQuery: ' 没有找到结果。\n请尝试其他搜索词。',
        confirmClearCache: '确定要清除所有缓存并重置应用程序吗？',
        metaMatch: '_匹配',
        metaFile: '_文件',
        metaSheet: '_工作表',
        metaMatchType: '_匹配类型',
        metaSimilarity: '_相似度',
        exportFileName: '搜索结果',
        errUnsupportedFormatCount: '⚠️ {count} 个文件格式不支持 (仅支持 .xlsx, .xls, .csv, .pdf, .docx)',
        errUnsupportedFormat: '⚠️ 文件格式不支持 (仅支持 .xlsx, .xls, .csv, .pdf, .docx)',
        infoSkippedFiles: 'ℹ️ 已跳过 {skipped} 个不支持的文件，已加载 {loaded} 个文件',
        loadingFolder: '正在扫描文件夹...',
        loadingBM25: '正在构建 BM25 索引...',
        newVersionAvailable: '🔄 发现新版本。刷新页面后即可应用。',
        matchDetail: '匹配详情',
        errPasswordProtected: '🔒 密码保护的文件',
        metaPath: '_文件路径',
        metaErrorReason: '_错误原因',
        exportErrorsTitle: '导出解析失败文件列表',
        exportErrorsBtn: '⚠️ 失败提取',
        failedFilesName: '失败文件列表',
        sessionHistory: '📋 最近工作',
        sessionRestore: '恢复',
        sessionDelete: '删除',
        sessionRestoring: '正在恢复工作会话...',
        sessionRestored: '工作会话已恢复',
        sessionSaved: '工作会话已保存',
        sessionDeleted: '工作会话已删除',
        sessionCacheLost: '⚠️ 缓存已清除。请重新拖放原始文件。',
        sessionFiles: '个文件',
        sessionEmpty: '没有最近的工作',
        sessionConfirmDelete: '确定要删除此工作会话吗？',
        sessionConfirmRestore: '确定要清除当前工作并恢复此工作会话吗？',
        driveConnect: 'Google Drive',
        driveDisconnect: '断开连接',
        driveConnecting: '正在连接到 Google Drive...',
        drivePickerTitle: '从 Google Drive 选择文件',
        drivePickerOpen: '请选择文件...',
        driveDownloading: '下载中',
        driveDownloadComplete: '下载完成',
        driveError: 'Google Drive 错误',
        driveLoginRequired: '需要登录 Google',
        driveUnsupported: '不支持的文件格式',
        driveSettings: '设置',
        driveSave: '保存并连接',
        driveExportLimit: '文件过大 (导出限制超 10MB)',
        driveSettingsGuide: '如何在 Google Cloud Console 中创建',
        helpTitle: '帮助',
        helpHtml: `
            <div class="help-section">
                <div class="help-section-title">🔍 常用搜索 (AND 条件)</div>
                <div class="help-example">
                    <div class="help-example-query">张三 业务部</div>
                    <div class="help-example-desc">用空格分隔的多个关键词将作为 <b>AND 条件</b>。只返回包含所有指定词汇的数据行。</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">➖ 排除搜索 (NOT 条件)</div>
                <div class="help-example">
                    <div class="help-example-query">北京 <span class="help-kbd">-朝阳</span></div>
                    <div class="help-example-desc">在单词前加上减号 (<kbd>-</kbd>) 可<b>排除</b>包含该词汇的数据行。</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">📊 数字范围搜索</div>
                <div class="help-example">
                    <div class="help-example-query">苹果 <span class="help-kbd">100~500</span></div>
                    <div class="help-example-desc">使用数字和波浪号 (<kbd>~</kbd>) 指定<b>数字范围</b>。返回包含范围内数字的数据行。</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">🎯 指定列搜索</div>
                <div class="help-example">
                    <div class="help-example-query"><span class="help-kbd">col:姓名</span> 张三 <span class="help-kbd">col:价格</span> 100~500</div>
                    <div class="help-example-desc">使用 <kbd>col:</kbd> 前缀加上列名称可<b>仅在特定列中</b>搜索关键词。列名称支持不区分大小写的部分匹配。</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">💬 包含空格的词汇 (引号)</div>
                <div class="help-example">
                    <div class="help-example-query">col:<span class="help-kbd">"今日 费用"</span> <span class="help-kbd">"长期 欠缴"</span></div>
                    <div class="help-example-desc">包含空格的搜索词或列名称，可以使用<b>双引号 (" ")</b> 包裹，将其视为单个词汇。</div>
                </div>
            </div>
            <div class="help-section">
                <div class="help-section-title">🧩 正则表达式搜索 (高级)</div>
                <div class="help-example">
                    <div class="help-example-query"><span class="help-kbd">/\\d{3}-\\d{4}/</span></div>
                    <div class="help-example-desc">使用斜线 (<kbd>/</kbd>) 包裹<b>正则表达式</b>。可精确搜索电话号码、电子邮件等特定模式。</div>
                </div>
                <div class="help-example">
                    <div class="help-example-query"><span class="help-kbd">/^张/i</span></div>
                    <div class="help-example-desc">加上标志 <kbd>i</kbd> 可不区分大小写。<kbd>g</kbd>、<kbd>m</kbd> 等标志也支持。</div>
                </div>
            </div>
            <div class="help-tip">💡 <b>提示：</b> 在搜索结果中双击数据行可打开<b>详细信息</b>，并从中轻松复制所有内容。</div>
        `
    }
};

let currentLang = localStorage.getItem('appLang') || 'ko';

/**
 * 현재 언어를 설정합니다.
 * @param {string} lang - 언어 코드 ('ko', 'en', 'ja', 'zh-TW', 'zh-CN')
 */
export function setLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem('appLang', lang);
    }
}

/**
 * 번역된 텍스트를 반환합니다.
 * @param {string} key - 번역 키
 * @returns {string}
 */
export function t(key) {
    // 현재 언어 → 영어 → 한국어 순서로 fallback
    return translations[currentLang]?.[key]
        || translations['en']?.[key]
        || translations['ko']?.[key]
        || key;
}

/**
 * 페이지 내의 [data-i18n] 요소 내용과 [data-i18n-...] 속성들을 모두 갱신합니다.
 */
export function translatePage() {
    document.documentElement.lang = currentLang;

    // 1. TextContent 
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) {
            el.textContent = t(key);
        }
    });

    // 2. title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key) {
            el.setAttribute('title', t(key));
        }
    });

    // 3. placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) {
            el.setAttribute('placeholder', t(key));
        }
    });
}

/**
 * 현재 언어를 반환합니다.
 * @returns {string}
 */
export function getLanguage() {
    return currentLang;
}

/**
 * 사용 가능한 언어 목록을 반환합니다.
 * @returns {Array<{code: string, label: string}>}
 */
export function getAvailableLanguages() {
    return [
        { code: 'ko', label: '한국어' },
        { code: 'en', label: 'English' },
        { code: 'ja', label: '日本語' },
        { code: 'zh-TW', label: '繁體中文' },
        { code: 'zh-CN', label: '简体中文' },
    ];
}
