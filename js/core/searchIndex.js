/**
 * [v1.1.0] 다중 계층 검색 인덱스
 * Inverted Index, 초성 Index, BM25 Index를 구축하여 고속 검색을 지원합니다.
 * 원본: indexer.py (SearchIndex 클래스) → 1:1 포팅
 *
 * [v1.1.0] CJK(중국어/일본어) 토큰화 추가
 *   - Intl.Segmenter API 우선 사용 (브라우저 내장, 사전 불필요)
 *   - 미지원 시 Bigram 폴백 (2글자 슬라이딩 윈도우)
 *   - 한국어/영어 기존 로직에 영향 없음
 *
 * 파일 로드 시 1회 인덱싱하면 이후 검색은 O(1)~O(n) 수준으로 수행됩니다.
 */

import { extractChosung, isHangulSyllable } from './jamo.js';
import { BM25 } from './bm25.js';

// 토큰 분리용 정규식 (구두점/공백 기준)
const TOKEN_SPLIT_RE = /[\s,;|/\\()\[\]{}<>:"']+/;

// CJK 유니코드 범위: 한글은 별도 처리하므로 여기는 중국어/일본어만
// CJK Unified Ideographs: U+4E00~U+9FFF
// CJK Extension A: U+3400~U+4DBF
// 히라가나: U+3040~U+309F
// 가타카나: U+30A0~U+30FF
const CJK_RANGE_RE = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

// Intl.Segmenter 지원 여부 (최초 1회 판별)
const HAS_SEGMENTER = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';

// 언어별 Segmenter 캐시 (지연 생성)
const _segmenters = {};

/**
 * [v1.1.1] 텍스트의 주요 언어를 간이 판별합니다.
 * 혼합 텍스트("東京都홍길동") 시 CJK를 우선 판별합니다.
 * 한글만 있으면 'ko', 히라가나/가타카나가 있으면 'ja', 한자만 있으면 'zh'.
 * @param {string} text
 * @returns {'ja'|'zh'|'ko'|'other'}
 */
function detectLang(text) {
    let hasCJK = false;
    let hasHiraganaKatakana = false;
    let hasHangul = false;
    // [v1.1.1 Fix] 전체 순회 — 한글 조기 리턴 제거
    // 혼합 텍스트에서 CJK 문자가 있으면 Segmenter를 가동해야 하므로
    // 끝까지 순회하여 모든 문자 유형을 파악합니다.
    for (const ch of text) {
        const c = ch.charCodeAt(0);
        if (c >= 0x3040 && c <= 0x30FF) hasHiraganaKatakana = true;
        if ((c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3400 && c <= 0x4DBF)) hasCJK = true;
        if (isHangulSyllable(ch)) hasHangul = true;
    }
    // CJK/히라가나가 있으면 한글 여부와 무관하게 해당 언어 반환
    // → Segmenter가 CJK 부분을 정상 분할하고, 한글은 별도 처리됨
    if (hasHiraganaKatakana) return 'ja';
    if (hasCJK) return 'zh';
    if (hasHangul) return 'ko';
    return 'other';
}

/**
 * CJK 텍스트를 Intl.Segmenter로 단어 분할합니다.
 * @param {string} text
 * @param {string} lang - 'ja' 또는 'zh'
 * @returns {string[]} 단어 배열
 */
function segmentCJK(text, lang) {
    if (!HAS_SEGMENTER) return bigramTokenize(text);

    try {
        if (!_segmenters[lang]) {
            _segmenters[lang] = new Intl.Segmenter(lang, { granularity: 'word' });
        }
        return [..._segmenters[lang].segment(text)]
            .filter(s => s.isWordLike)
            .map(s => s.segment);
    } catch {
        // Segmenter 실패 시 Bigram 폴백
        return bigramTokenize(text);
    }
}

/**
 * Bigram 토큰화 (Intl.Segmenter 미지원 브라우저용 폴백)
 * CJK 문자 연속 구간에 대해 2글자씩 슬라이딩 윈도우 적용
 * 예: "東京都港区" → ["東京", "京都", "都港", "港区"]
 * @param {string} text
 * @returns {string[]}
 */
function bigramTokenize(text) {
    const result = [];
    // CJK 문자 연속 구간을 추출
    const cjkRuns = text.match(/[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]+/g);
    if (!cjkRuns) return result;

    for (const run of cjkRuns) {
        // 유니그램 (1글자도 추가, 단일 문자 검색 보장)
        for (const ch of run) {
            result.push(ch);
        }
        // 바이그램 (2글자 슬라이딩)
        const chars = [...run];
        for (let i = 0; i < chars.length - 1; i++) {
            result.push(chars[i] + chars[i + 1]);
        }
    }
    return result;
}

/**
 * 텍스트를 검색용 토큰으로 분리합니다 (고유 토큰, Set 반환).
 * 인버티드 인덱스 구축에 사용합니다. (중복 불필요)
 * [v1.1.0] CJK 토큰화 추가
 * @param {string} text - 정규화된 텍스트
 * @returns {Set<string>} 토큰 집합
 */
function tokenize(text) {
    const tokens = new Set();
    if (!text) return tokens;

    // 전체 텍스트 자체도 토큰으로 추가 (완전 일치용)
    tokens.add(text);

    // 구두점/공백 기준 단어 분리
    const words = text.split(TOKEN_SPLIT_RE);
    for (const w of words) {
        const trimmed = w.trim();
        if (trimmed.length > 0) {
            tokens.add(trimmed);

            // CJK 문자가 포함된 경우 추가 토큰화 수행
            if (CJK_RANGE_RE.test(trimmed)) {
                const lang = detectLang(trimmed);
                if (lang === 'ja' || lang === 'zh') {
                    const cjkTokens = segmentCJK(trimmed, lang);
                    for (const ct of cjkTokens) {
                        if (ct.length > 0) tokens.add(ct);
                    }
                }
            }
        }
    }
    return tokens;
}

/**
 * 검색 인덱스 클래스
 * 인버티드 인덱스, 초성 인덱스, 어휘 집합, BM25를 통합 관리
 */
export class SearchIndex {
    constructor() {
        // 셀 데이터 저장소 (배열 인덱스가 셀 ID)
        /** @type {Array<Object|null>} */
        this.cells = [];

        // 행 데이터 저장소: "filePath|sheetName|rowIdx" → RowData
        /** @type {Map<string, Object>} */
        this.rows = new Map();

        // 시트별 헤더 정보: "filePath|sheetName" → headers[]
        /** @type {Map<string, string[]>} */
        this.fileHeaders = new Map();

        // 검색 인덱스
        /** @type {Map<string, Set<number>>} */
        this.invertedIndex = new Map();

        /** @type {Map<string, Set<number>>} */
        this.chosungIndex = new Map();

        /** @type {Set<string>} */
        this.vocabulary = new Set();

        // BM25 관련
        this._bm25 = null;
        this._bm25RowKeys = [];
        this._bm25Dirty = true;

        // [v1.1.2] 숫자 인덱스: 범위 검색 O(log N) 지원
        // 정렬 전 원본: { numVal, cellIdx }[]
        /** @type {Array<{numVal: number, cellIdx: number}>} */
        this._numericEntries = [];
        this._numericSorted = false;

        // 파일 관리
        /** @type {Set<string>} */
        this._indexedFiles = new Set();
    }

    /** @returns {number} 총 셀 수 */
    get totalCells() { return this.cells.length; }

    /** @returns {number} 총 행 수 */
    get totalRows() { return this.rows.size; }

    /** @returns {number} 총 파일 수 */
    get totalFiles() { return this._indexedFiles.size; }

    /** @returns {Set<string>} 인덱싱된 파일 집합 (복사본) */
    get indexedFiles() { return new Set(this._indexedFiles); }

    /** 인덱스 전체 초기화 */
    clear() {
        this.cells = [];
        this.rows = new Map();
        this.fileHeaders = new Map();
        this.invertedIndex = new Map();
        this.chosungIndex = new Map();
        this.vocabulary = new Set();
        this._bm25 = null;
        this._bm25RowKeys = [];
        this._bm25Dirty = true;
        this._numericEntries = [];
        this._numericSorted = false;
        this._indexedFiles = new Set();
    }

    /**
     * 행 키를 생성합니다.
     * @param {string} filePath
     * @param {string} sheetName
     * @param {number} rowIdx
     * @returns {string}
     */
    static rowKey(filePath, sheetName, rowIdx) {
        return `${filePath}|${sheetName}|${rowIdx}`;
    }

    /**
     * 헤더 키를 생성합니다.
     * @param {string} filePath
     * @param {string} sheetName
     * @returns {string}
     */
    static headerKey(filePath, sheetName) {
        return `${filePath}|${sheetName}`;
    }

    /**
     * 데이터 청크를 인덱스에 추가합니다.
     *
     * @param {string} filePath - 파일 식별자
     * @param {string} fileName - 파일명
     * @param {string} sheetName - 시트명
     * @param {string[]} headers - 컬럼 헤더 배열
     * @param {Array<Array<string>>} rows - 행 데이터 (2차원 배열)
     * @param {number|number[]} rowOffsetOrIndices - 행 인덱스 오프셋(Number) 또는 실제 행 번호 배열(Array)
     *   [v1.1.9] 배열 다형성: 캐시 복원 시 빈 행으로 인한 인덱스 시프트 방지
     */
    addDataChunk(filePath, fileName, sheetName, headers, rows, rowOffsetOrIndices = 0) {
        const hKey = SearchIndex.headerKey(filePath, sheetName);
        if (!this.fileHeaders.has(hKey)) {
            this.fileHeaders.set(hKey, headers);
        }

        this._indexedFiles.add(filePath);
        this._bm25Dirty = true;

        // [v1.1.9] 다형성: 배열이면 각 행의 실제 인덱스, 숫자면 연속 오프셋
        const isIndicesArray = Array.isArray(rowOffsetOrIndices);

        for (let localIdx = 0; localIdx < rows.length; localIdx++) {
            const row = rows[localIdx];
            const actualRowIdx = isIndicesArray
                ? rowOffsetOrIndices[localIdx]
                : (rowOffsetOrIndices + localIdx);
            const rKey = SearchIndex.rowKey(filePath, sheetName, actualRowIdx);
            const cellsDict = {};

            for (let colIdx = 0; colIdx < headers.length; colIdx++) {
                const colName = headers[colIdx];
                const rawVal = colIdx < row.length ? row[colIdx] : null;
                const value = rawVal != null ? String(rawVal) : '';

                // NaN, None 등 무효값 건너뛰기
                if (value === '' || value === 'nan' || value === 'None' ||
                    value === 'NaT' || value === 'undefined' || value === 'null') {
                    continue;
                }

                cellsDict[colName] = value;

                // 셀 정보 저장
                const cellInfo = { filePath, fileName, sheetName, rowIdx: actualRowIdx, colIdx, colName, value };
                const cellIdx = this.cells.length;
                this.cells.push(cellInfo);

                // 정규화 후 인버티드 인덱스에 추가
                const normalized = value.toLowerCase().trim();
                const tokens = tokenize(normalized);
                for (const token of tokens) {
                    if (!this.invertedIndex.has(token)) {
                        this.invertedIndex.set(token, new Set());
                    }
                    this.invertedIndex.get(token).add(cellIdx);
                    this.vocabulary.add(token);
                }

                // 한글이 포함된 경우 초성 인덱스에도 추가
                let hasHangul = false;
                for (const c of value) {
                    if (isHangulSyllable(c)) { hasHangul = true; break; }
                }
                if (hasHangul) {
                    const chosungStr = extractChosung(value);
                    const chosungTokens = tokenize(chosungStr.toLowerCase());
                    for (const ct of chosungTokens) {
                        if (!this.chosungIndex.has(ct)) {
                            this.chosungIndex.set(ct, new Set());
                        }
                        this.chosungIndex.get(ct).add(cellIdx);
                    }
                }

                // [v1.1.3 Fix] 숫자 인덱스: 엄격한 숫자 판별
                // parseFloat("123동") = 123 같은 오탐 방지를 위해
                // 정규식으로 순수 숫자(음수, 소수점 허용)만 허용
                const cleaned = value.replace(/,/g, '').trim();
                if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
                    const numVal = Number(cleaned);
                    if (isFinite(numVal)) {
                        this._numericEntries.push({ numVal, cellIdx });
                        this._numericSorted = false;
                    }
                }
            }

            // 행 데이터 저장 (유효한 셀이 있는 경우만)
            if (Object.keys(cellsDict).length > 0) {
                this.rows.set(rKey, {
                    filePath, fileName, sheetName,
                    rowIdx: actualRowIdx,
                    cells: cellsDict,
                    headers
                });
            }
        }
    }

    /**
     * 파일을 인덱스에서 제거하고 관련 데이터를 정리합니다.
     * @param {string} filePath - 제거할 파일 식별자
     */
    removeFile(filePath) {
        // 제거할 셀 인덱스 수집
        const removeIndices = new Set();
        for (let i = 0; i < this.cells.length; i++) {
            const c = this.cells[i];
            if (c !== null && c.filePath === filePath) {
                removeIndices.add(i);
            }
        }
        if (removeIndices.size === 0) return;

        // 인버티드 인덱스에서 제거
        const emptyKeys = [];
        for (const [key, idxSet] of this.invertedIndex) {
            for (const idx of removeIndices) {
                idxSet.delete(idx);
            }
            if (idxSet.size === 0) emptyKeys.push(key);
        }
        for (const key of emptyKeys) {
            this.invertedIndex.delete(key);
            this.vocabulary.delete(key);
        }

        // 초성 인덱스에서 제거
        const emptyChosungKeys = [];
        for (const [key, idxSet] of this.chosungIndex) {
            for (const idx of removeIndices) {
                idxSet.delete(idx);
            }
            if (idxSet.size === 0) emptyChosungKeys.push(key);
        }
        for (const key of emptyChosungKeys) {
            this.chosungIndex.delete(key);
        }

        // 셀 데이터 무효화 (인덱스 순서 유지를 위해 null 처리)
        for (const i of removeIndices) {
            this.cells[i] = null;
        }

        // 행 데이터 제거
        for (const [key, data] of this.rows) {
            if (data.filePath === filePath) {
                this.rows.delete(key);
            }
        }

        // 헤더 제거
        for (const [key] of this.fileHeaders) {
            if (key.startsWith(filePath + '|')) {
                this.fileHeaders.delete(key);
            }
        }

        this._indexedFiles.delete(filePath);
        this._bm25Dirty = true;

        // [v1.1.2] 숫자 인덱스에서 제거된 셀 제거
        this._numericEntries = this._numericEntries.filter(
            e => !removeIndices.has(e.cellIdx)
        );
        this._numericSorted = false;
    }

    /**
     * [v1.1.2] 숫자 인덱스를 정렬합니다 (최초 범위 검색 시 1회).
     */
    _ensureNumericSorted() {
        if (!this._numericSorted) {
            this._numericEntries.sort((a, b) => a.numVal - b.numVal);
            this._numericSorted = true;
        }
    }

    /**
     * [v1.1.2] 범위 내 숫자를 가진 셀 인덱스를 이진 탐색으로 반환합니다.
     * 기존 O(N) 풀스캔 → O(log N + K) (K = 결과 수)
     * @param {number} minVal - 최솟값
     * @param {number} maxVal - 최댓값
     * @returns {Array<{numVal: number, cellIdx: number}>} 범위 내 항목
     */
    findCellsInRange(minVal, maxVal) {
        this._ensureNumericSorted();
        const entries = this._numericEntries;
        if (entries.length === 0) return [];

        // 이진 탐색: minVal 이상인 첫 번째 위치 찾기 (lower bound)
        let lo = 0, hi = entries.length;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (entries[mid].numVal < minVal) lo = mid + 1;
            else hi = mid;
        }

        // lo부터 maxVal 이하인 동안 수집
        const result = [];
        for (let i = lo; i < entries.length && entries[i].numVal <= maxVal; i++) {
            result.push(entries[i]);
        }
        return result;
    }

    /**
     * [v1.1.1] BM25 코퍼스용 토큰화 (중복 허용 Array 반환)
     * Set 기반 tokenize()와 달리 동일 단어의 반복을 유지하여
     * BM25의 TF(Term Frequency) 계산이 정상 작동하도록 합니다.
     * @param {string} text
     * @returns {string[]} 토큰 배열 (중복 유지)
     */
    static tokenizeToArray(text) {
        const tokens = [];
        if (!text) return tokens;

        const words = text.split(TOKEN_SPLIT_RE);
        for (const w of words) {
            const trimmed = w.trim();
            if (trimmed.length > 0) {
                tokens.push(trimmed);

                // CJK 문자 포함 시 추가 토큰화 (중복 허용)
                if (CJK_RANGE_RE.test(trimmed)) {
                    const lang = detectLang(trimmed);
                    if (lang === 'ja' || lang === 'zh') {
                        const cjkTokens = segmentCJK(trimmed, lang);
                        for (const ct of cjkTokens) {
                            if (ct.length > 0) tokens.push(ct);
                        }
                    }
                }
            }
        }
        return tokens;
    }

    /**
     * BM25 인덱스를 (재)구축합니다.
     * [v1.1.1 Fix] tokenizeToArray() 사용하여 TF(용어 빈도) 정상 반영
     * 행 단위로 토큰화하여 관련도 랭킹에 사용.
     */
    buildBM25() {
        const corpus = [];
        this._bm25RowKeys = [];

        for (const [rowKey, rowData] of this.rows) {
            // 행의 모든 셀 값을 결합하여 하나의 "문서"로 취급
            const rowText = Object.values(rowData.cells).join(' ').toLowerCase();
            // [v1.1.1] Array 기반 토큰화로 TF 보존
            const tokens = SearchIndex.tokenizeToArray(rowText);
            corpus.push(tokens);
            this._bm25RowKeys.push(rowKey);
        }

        if (corpus.length > 0) {
            this._bm25 = new BM25();
            this._bm25.buildIndex(corpus);
        }
        this._bm25Dirty = false;
    }

    /**
     * BM25 기반 관련도 점수를 반환합니다.
     * @param {string} query - 검색 쿼리
     * @returns {Map<string, number>} rowKey → 점수
     */
    getBM25Scores(query) {
        if (this._bm25Dirty) {
            this.buildBM25();
        }

        if (!this._bm25 || this._bm25RowKeys.length === 0) {
            return new Map();
        }

        // [v1.1.1 Fix] Array 기반 토큰화로 TF 보존
        const tokens = SearchIndex.tokenizeToArray(query.toLowerCase());
        const scores = this._bm25.getScores(tokens);

        const result = new Map();
        for (let i = 0; i < scores.length; i++) {
            if (scores[i] > 0) {
                result.set(this._bm25RowKeys[i], scores[i]);
            }
        }
        return result;
    }

    /**
     * 키워드를 포함하는 셀 인덱스를 반환합니다.
     * 인버티드 인덱스의 토큰 중 키워드를 포함하는 토큰의 셀들을 합산합니다.
     * @param {string} keyword - 검색 키워드
     * @returns {Set<number>} 셀 인덱스 집합
     */
    findCellsContaining(keyword) {
        const kwLower = keyword.toLowerCase().trim();
        if (!kwLower) return new Set();

        const result = new Set();

        // 정확한 토큰 매칭 (O(1))
        const exact = this.invertedIndex.get(kwLower);
        if (exact) {
            for (const idx of exact) result.add(idx);
        }

        // 부분 문자열 매칭 (토큰 순회)
        for (const [token, cellIndices] of this.invertedIndex) {
            if (token !== kwLower && token.includes(kwLower)) {
                for (const idx of cellIndices) result.add(idx);
            }
        }

        return result;
    }

    /**
     * 초성 쿼리로 매칭되는 셀 인덱스를 반환합니다.
     * @param {string} chosungQuery - 초성 쿼리
     * @returns {Set<number>} 셀 인덱스 집합
     */
    findCellsByChosung(chosungQuery) {
        const qLower = chosungQuery.toLowerCase().trim();
        if (!qLower) return new Set();

        const result = new Set();
        for (const [token, cellIndices] of this.chosungIndex) {
            if (token.includes(qLower)) {
                for (const idx of cellIndices) result.add(idx);
            }
        }
        return result;
    }

    /**
     * 인덱스를 직렬화 가능한 객체로 변환합니다 (Worker 전송용).
     * @returns {Object} 직렬화 가능한 인덱스 데이터
     */
    serialize() {
        // Map/Set을 일반 객체/배열로 변환
        const inverted = {};
        for (const [key, set] of this.invertedIndex) {
            inverted[key] = [...set];
        }
        const chosung = {};
        for (const [key, set] of this.chosungIndex) {
            chosung[key] = [...set];
        }
        const rowsObj = {};
        for (const [key, val] of this.rows) {
            rowsObj[key] = val;
        }
        const headersObj = {};
        for (const [key, val] of this.fileHeaders) {
            headersObj[key] = val;
        }

        return {
            cells: this.cells,
            rows: rowsObj,
            fileHeaders: headersObj,
            invertedIndex: inverted,
            chosungIndex: chosung,
            vocabulary: [...this.vocabulary],
            indexedFiles: [...this._indexedFiles]
        };
    }

    /**
     * 직렬화된 데이터로부터 인덱스를 복원합니다.
     * @param {Object} data - serialize()로 생성된 데이터
     */
    deserialize(data) {
        this.cells = data.cells || [];
        this.rows = new Map(Object.entries(data.rows || {}));
        this.fileHeaders = new Map(Object.entries(data.fileHeaders || {}));

        this.invertedIndex = new Map();
        for (const [key, arr] of Object.entries(data.invertedIndex || {})) {
            this.invertedIndex.set(key, new Set(arr));
        }

        this.chosungIndex = new Map();
        for (const [key, arr] of Object.entries(data.chosungIndex || {})) {
            this.chosungIndex.set(key, new Set(arr));
        }

        this.vocabulary = new Set(data.vocabulary || []);
        this._indexedFiles = new Set(data.indexedFiles || []);
        this._bm25Dirty = true;
    }
}
