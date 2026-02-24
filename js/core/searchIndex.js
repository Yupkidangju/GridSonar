/**
 * [v1.0.0] 다중 계층 검색 인덱스
 * Inverted Index, 초성 Index, BM25 Index를 구축하여 고속 검색을 지원합니다.
 * 원본: indexer.py (SearchIndex 클래스) → 1:1 포팅
 *
 * 파일 로드 시 1회 인덱싱하면 이후 검색은 O(1)~O(n) 수준으로 수행됩니다.
 */

import { extractChosung, isHangulSyllable } from './jamo.js';
import { BM25 } from './bm25.js';

// 토큰 분리용 정규식 (구두점/공백 기준)
const TOKEN_SPLIT_RE = /[\s,;|/\\()\[\]{}<>:"']+/;

/**
 * 텍스트를 검색용 토큰으로 분리합니다.
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
     * scanner.worker에서 전달받은 chunk 데이터를 처리합니다.
     *
     * @param {string} filePath - 파일 식별자
     * @param {string} fileName - 파일명
     * @param {string} sheetName - 시트명
     * @param {string[]} headers - 컬럼 헤더 배열
     * @param {Array<Array<string>>} rows - 행 데이터 (2차원 배열)
     * @param {number} rowOffset - 행 인덱스 오프셋
     */
    addDataChunk(filePath, fileName, sheetName, headers, rows, rowOffset = 0) {
        const hKey = SearchIndex.headerKey(filePath, sheetName);
        if (!this.fileHeaders.has(hKey)) {
            this.fileHeaders.set(hKey, headers);
        }

        this._indexedFiles.add(filePath);
        this._bm25Dirty = true;

        for (let localIdx = 0; localIdx < rows.length; localIdx++) {
            const row = rows[localIdx];
            const actualRowIdx = rowOffset + localIdx;
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
    }

    /**
     * BM25 인덱스를 (재)구축합니다.
     * 행 단위로 토큰화하여 관련도 랭킹에 사용.
     */
    buildBM25() {
        const corpus = [];
        this._bm25RowKeys = [];

        for (const [rowKey, rowData] of this.rows) {
            // 행의 모든 셀 값을 결합하여 하나의 "문서"로 취급
            const rowText = Object.values(rowData.cells).join(' ').toLowerCase();
            const tokens = rowText.split(/\s+/).filter(t => t.length > 0);
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

        const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
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
