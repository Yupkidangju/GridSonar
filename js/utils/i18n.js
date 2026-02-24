/**
 * [v1.0.0] 다국어 지원 모듈 (i18n)
 * 한/영/일/중(번체)/중(간체) 5개 국어 지원
 * D3D Protocol §8: 다국어 구현
 */

const translations = {
    ko: {
        appName: 'GridSonar',
        searchPlaceholder: '검색어를 입력하세요...',
        searchButton: '검색',
        dropFiles: '파일을 여기에 끌어다 놓으세요',
        dropFilesOr: '또는 클릭하여 파일 선택',
        supportedFormats: '지원 형식: .xlsx, .xls, .csv',
        indexing: '인덱싱 중',
        indexingComplete: '인덱싱 완료',
        searching: '검색 중',
        searchComplete: '검색 완료',
        noResults: '검색 결과가 없습니다',
        results: '건',
        files: '파일',
        rows: '행',
        cells: '셀',
        copy: '복사',
        export: '내보내기',
        exportXlsx: 'Excel (.xlsx)',
        exportCsv: 'CSV (.csv)',
        themeToggle: '테마 전환',
        similarity: '유사도',
        matchExact: '정확',
        matchFuzzy: '유사',
        matchChosung: '초성',
        matchRange: '범위',
        ready: '준비됨',
        favorites: '즐겨찾기',
        removeFile: '파일 제거',
        clearCache: '캐시 초기화',
        detail: '상세 보기',
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
    },
    en: {
        appName: 'GridSonar',
        searchPlaceholder: 'Enter search term...',
        searchButton: 'Search',
        dropFiles: 'Drop files here',
        dropFilesOr: 'or click to select files',
        supportedFormats: 'Supported: .xlsx, .xls, .csv',
        indexing: 'Indexing',
        indexingComplete: 'Indexing complete',
        searching: 'Searching',
        searchComplete: 'Search complete',
        noResults: 'No results found',
        results: 'results',
        files: 'files',
        rows: 'rows',
        cells: 'cells',
        copy: 'Copy',
        export: 'Export',
        exportXlsx: 'Excel (.xlsx)',
        exportCsv: 'CSV (.csv)',
        themeToggle: 'Toggle theme',
        similarity: 'Similarity',
        matchExact: 'Exact',
        matchFuzzy: 'Fuzzy',
        matchChosung: 'Chosung',
        matchRange: 'Range',
        ready: 'Ready',
        favorites: 'Favorites',
        removeFile: 'Remove file',
        clearCache: 'Clear cache',
        detail: 'Detail',
        close: 'Close',
        copySuccess: 'Copied to clipboard',
        copyFail: 'Clipboard copy failed',
        exportSuccess: 'Export complete',
        exportFail: 'Export failed',
        addFilesFirst: 'Add files first',
        filterPlaceholder: 'Filter results...',
        seconds: 's',
        cachedRestore: 'Restored from cache',
        parsingError: 'Parsing error',
        selected: 'selected',
    },
    ja: {
        appName: 'GridSonar',
        searchPlaceholder: '検索語を入力してください...',
        searchButton: '検索',
        dropFiles: 'ここにファイルをドロップ',
        dropFilesOr: 'またはクリックして選択',
        supportedFormats: '対応形式: .xlsx, .xls, .csv',
        indexing: 'インデックス中',
        indexingComplete: 'インデックス完了',
        searching: '検索中',
        searchComplete: '検索完了',
        noResults: '検索結果なし',
        results: '件',
        files: 'ファイル',
        rows: '行',
        cells: 'セル',
        copy: 'コピー',
        export: 'エクスポート',
        themeToggle: 'テーマ切替',
        similarity: '類似度',
        matchExact: '完全一致',
        matchFuzzy: '類似',
        matchChosung: '初声',
        matchRange: '範囲',
        ready: '準備完了',
        close: '閉じる',
    },
    'zh-TW': {
        appName: 'GridSonar',
        searchPlaceholder: '輸入搜尋詞...',
        searchButton: '搜尋',
        dropFiles: '將檔案拖放到此處',
        indexing: '索引中',
        searchComplete: '搜尋完成',
        noResults: '沒有搜尋結果',
        copy: '複製',
        export: '匯出',
        themeToggle: '切換主題',
        ready: '就緒',
        close: '關閉',
    },
    'zh-CN': {
        appName: 'GridSonar',
        searchPlaceholder: '输入搜索词...',
        searchButton: '搜索',
        dropFiles: '将文件拖放到此处',
        indexing: '索引中',
        searchComplete: '搜索完成',
        noResults: '没有搜索结果',
        copy: '复制',
        export: '导出',
        themeToggle: '切换主题',
        ready: '就绪',
        close: '关闭',
    }
};

let currentLang = 'ko';

/**
 * 현재 언어를 설정합니다.
 * @param {string} lang - 언어 코드 ('ko', 'en', 'ja', 'zh-TW', 'zh-CN')
 */
export function setLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
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
