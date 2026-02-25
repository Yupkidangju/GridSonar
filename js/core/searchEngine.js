/**
 * [v1.0.0] 4계층 다중 검색 엔진
 * 쿼리 파싱, 정확 매칭, 퍼지 매칭, 초성 검색, BM25 랭킹을 통합하여
 * 사용자가 단순히 텍스트를 입력하면 최적의 결과를 반환합니다.
 * 원본: searcher.py (MultiLayerSearcher) → 1:1 포팅
 */

import { parseQuery } from './queryParser.js';
import { isChosungQuery, extractChosung } from './jamo.js';

// 검색 계층별 기본 가중치
const WEIGHT_EXACT = 1.0;
const WEIGHT_CHOSUNG = 0.85;
const WEIGHT_FUZZY = 0.7;
const WEIGHT_BM25 = 0.3;
const WEIGHT_RANGE = 0.9;
const WEIGHT_REGEX = 0.95; // [v2.5.0] 정규식 검색 가중치

/**
 * 행별 점수를 누적 갱신합니다. 최고 유사도와 매칭 유형을 추적.
 * @param {Map} rowScores - 행 키 → 스코어 정보 Map
 * @param {string} rowKey - 행 키
 * @param {number} score - 점수
 * @param {string} matchType - 매칭 유형
 * @param {number} similarity - 유사도
 * @param {Object} match - 매칭 상세
 */
function updateRowScore(rowScores, rowKey, score, matchType, similarity, match) {
    if (!rowScores.has(rowKey)) {
        rowScores.set(rowKey, {
            score,
            matchType,
            similarity,
            matches: [match]
        });
    } else {
        const entry = rowScores.get(rowKey);
        entry.score = Math.max(entry.score, score);
        if (similarity > entry.similarity) {
            entry.similarity = similarity;
            entry.matchType = matchType;
        }
        // 중복 매칭 방지 (같은 셀은 1회만)
        const exists = entry.matches.some(
            m => m.colName === match.colName && m.cellValue === match.cellValue
        );
        if (!exists) {
            entry.matches.push(match);
        }
    }
}

/**
 * 검색을 실행하고 점수순으로 정렬된 결과를 반환합니다.
 * @param {import('./searchIndex.js').SearchIndex} index - 검색 인덱스
 * @param {string} rawQuery - 사용자 입력 검색어
 * @param {Object} [options={}]
 * @param {number} [options.minSimilarity=0.6] - 퍼지 매칭 최소 유사도
 * @param {number} [options.maxResults=500] - 최대 결과 수
 * @param {Object|null} [options.fuseInstance=null] - Fuse.js 인스턴스 (외부 주입)
 * @returns {Array<Object>} 검색 결과 배열
 */
export function search(index, rawQuery, options = {}) {
    const {
        minSimilarity = 0.6,
        maxResults = 500,
        fuseInstance = null
    } = options;

    const query = parseQuery(rawQuery);

    if (query.keywords.length === 0 && query.ranges.length === 0 && query.columnFilters.length === 0 && query.regexFilters.length === 0) {
        return [];
    }

    // rowKey → { score, matchType, similarity, matches[] } 누적 맵
    const rowScores = new Map();

    // 각 키워드에 대해 다중 계층 검색 수행
    for (const keyword of query.keywords) {
        // 계층 1: 정확 매칭 (인버티드 인덱스)
        _exactSearch(index, keyword, rowScores);

        // 계층 2: 초성 검색 (입력이 초성인 경우)
        if (isChosungQuery(keyword)) {
            _chosungSearch(index, keyword, rowScores);
        }

        // 계층 3: 퍼지 매칭 (Fuse.js 사용 시)
        if (fuseInstance) {
            _fuzzySearch(index, keyword, rowScores, minSimilarity, fuseInstance);
        }
    }

    // 범위 검색
    for (const [minVal, maxVal] of query.ranges) {
        _rangeSearch(index, minVal, maxVal, rowScores);
    }

    // [v2.3.0] 열 모드 검색: 특정 열에서만 키워드 검색
    for (const { column, keyword } of query.columnFilters) {
        _columnSearch(index, column, keyword, rowScores);
    }

    // [v2.5.0] 정규식 검색: 전체 셀에 대해 정규식 테스트
    for (const regex of query.regexFilters) {
        _regexSearch(index, regex, rowScores);
    }

    // 계층 4: BM25 관련도 점수 가산
    if (query.keywords.length > 0) {
        const bm25Query = query.keywords.join(' ');
        _applyBM25(index, bm25Query, rowScores);
    }

    // 제외 조건 적용
    if (query.excludes.length > 0) {
        _applyExcludes(index, query.excludes, rowScores);
    }

    // [v2.5.4 Fix] 통합 AND 조건 적용:
    // 모든 조건의 총합이 2개 이상이면 AND(교집합) 검증 발동.
    // 기존 queryTypeCount(유형 수)는 동종 다중 조건(/a/ /b/, 범위 2개 등)에서
    // 1로 계산되어 AND가 발동되지 않는 치명적 버그가 있었음.
    const totalConditions = query.keywords.length
        + query.ranges.length
        + query.regexFilters.length
        + query.columnFilters.length;
    if (totalConditions > 1) {
        _applyAndCondition(index, query, rowScores);
    }

    // 결과 생성 및 정렬
    const results = [];
    for (const [rowKey, info] of rowScores) {
        const rowData = index.rows.get(rowKey);
        if (!rowData) continue;

        results.push({
            row: rowData,
            score: info.score,
            matchType: info.matchType,
            similarity: info.similarity,
            matches: info.matches || []
        });
    }

    // 점수 내림차순 정렬
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, maxResults);
}

/**
 * 계층 1: 인버티드 인덱스 기반 정확/부분 매칭
 */
function _exactSearch(index, keyword, rowScores) {
    const cellIndices = index.findCellsContaining(keyword);

    for (const cellIdx of cellIndices) {
        const cell = index.cells[cellIdx];
        if (cell === null) continue;

        const rowKey = `${cell.filePath}|${cell.sheetName}|${cell.rowIdx}`;

        // 완전 일치 vs 부분 일치 구분
        const valLower = cell.value.toLowerCase();
        const kwLower = keyword.toLowerCase();
        let sim;
        if (valLower === kwLower) {
            sim = 1.0;
        } else {
            sim = kwLower.length > 0 && valLower.includes(kwLower) ? 0.9 : 0.8;
        }

        const score = WEIGHT_EXACT * sim;
        const match = {
            colName: cell.colName,
            cellValue: cell.value,
            matchType: 'exact',
            similarity: sim
        };
        updateRowScore(rowScores, rowKey, score, 'exact', sim, match);
    }
}

/**
 * 계층 2: 한글 초성 인덱스 기반 검색
 */
function _chosungSearch(index, keyword, rowScores) {
    const cellIndices = index.findCellsByChosung(keyword);

    for (const cellIdx of cellIndices) {
        const cell = index.cells[cellIdx];
        if (cell === null) continue;

        const rowKey = `${cell.filePath}|${cell.sheetName}|${cell.rowIdx}`;

        // 초성 유사도 계산
        const textChosung = extractChosung(cell.value);
        const sim = textChosung.includes(keyword) ? 0.85 : 0.7;

        const score = WEIGHT_CHOSUNG * sim;
        const match = {
            colName: cell.colName,
            cellValue: cell.value,
            matchType: 'chosung',
            similarity: sim
        };
        updateRowScore(rowScores, rowKey, score, 'chosung', sim, match);
    }
}

/**
 * 계층 3: Fuse.js 기반 퍼지 매칭
 */
function _fuzzySearch(index, keyword, rowScores, minSimilarity, fuseInstance) {
    if (!fuseInstance) return;

    const kwLower = keyword.toLowerCase();
    const fuseResults = fuseInstance.search(kwLower, { limit: 50 });

    for (const result of fuseResults) {
        // Fuse.js score: 0 = 완벽 매치, 1 = 불일치 → 반전하여 0~1 유사도로 변환
        const sim = 1 - (result.score || 0);
        // [v1.2.0 Fix] 유사도 필터: "이상" 기준 (100% 설정 시 100% 결과 포함)
        // 부동소수점 비교 안전을 위해 미세 허용치(epsilon) 적용
        if (sim < minSimilarity - 1e-9) continue;

        const matchedToken = result.item;
        // 정확 매칭과 중복되는 결과는 건너뛰기
        if (matchedToken === kwLower) continue;

        const cellIndices = index.invertedIndex.get(matchedToken);
        if (!cellIndices) continue;

        for (const cellIdx of cellIndices) {
            const cell = index.cells[cellIdx];
            if (cell === null) continue;

            const rowKey = `${cell.filePath}|${cell.sheetName}|${cell.rowIdx}`;
            const weightedScore = WEIGHT_FUZZY * sim;
            const match = {
                colName: cell.colName,
                cellValue: cell.value,
                matchType: 'fuzzy',
                similarity: sim
            };
            updateRowScore(rowScores, rowKey, weightedScore, 'fuzzy', sim, match);
        }
    }
}

/**
 * [v1.1.2] 숫자 범위 검색 — 이진 탐색 O(log N + K)
 * 기존: 전체 셀 풀스캔 O(N) + parseFloat 매번 호출
 * 개선: 인덱싱 시 숫자 전처리 + 정렬 배열에서 이진 탐색
 */
function _rangeSearch(index, minVal, maxVal, rowScores) {
    const rangeResults = index.findCellsInRange(minVal, maxVal);

    for (const { cellIdx } of rangeResults) {
        const cell = index.cells[cellIdx];
        if (cell === null) continue;

        const rowKey = `${cell.filePath}|${cell.sheetName}|${cell.rowIdx}`;
        const match = {
            colName: cell.colName,
            cellValue: cell.value,
            matchType: 'range',
            similarity: 0.9
        };
        updateRowScore(rowScores, rowKey, WEIGHT_RANGE, 'range', 0.9, match);
    }
}

/**
 * 계층 4: BM25 관련도 점수를 기존 결과에 가산
 */
function _applyBM25(index, query, rowScores) {
    const bm25Scores = index.getBM25Scores(query);
    if (bm25Scores.size === 0) return;

    // BM25 점수 정규화 (최대값 기준)
    let maxBM25 = 0;
    for (const score of bm25Scores.values()) {
        if (score > maxBM25) maxBM25 = score;
    }
    if (maxBM25 === 0) return;

    for (const [rowKey, bm25Score] of bm25Scores) {
        if (rowScores.has(rowKey)) {
            const normalized = (bm25Score / maxBM25) * WEIGHT_BM25;
            rowScores.get(rowKey).score += normalized;
        }
    }
}

/**
 * 제외 조건: 제외 키워드가 포함된 행을 결과에서 제거
 */
function _applyExcludes(index, excludes, rowScores) {
    const keysToRemove = [];
    for (const [rowKey] of rowScores) {
        const rowData = index.rows.get(rowKey);
        if (!rowData) continue;
        const rowText = Object.values(rowData.cells).join(' ').toLowerCase();
        for (const ex of excludes) {
            if (rowText.includes(ex.toLowerCase())) {
                keysToRemove.push(rowKey);
                break;
            }
        }
    }
    for (const key of keysToRemove) {
        rowScores.delete(key);
    }
}

/**
 * [v2.5.2] 통합 AND 조건: 모든 쿼리 유형(키워드, 정규식, 범위, 열 필터)을
 * 교집합(AND)으로 검증합니다. 하나라도 충족하지 않는 행은 제거.
 * @param {Object} index - 검색 인덱스
 * @param {Object} query - parseQuery() 결과 (keywords, regexFilters, ranges, columnFilters)
 * @param {Map} rowScores - 행별 점수 맵
 */
function _applyAndCondition(index, query, rowScores) {
    const keysToRemove = [];
    for (const [rowKey] of rowScores) {
        const rowData = index.rows.get(rowKey);
        if (!rowData) continue;

        // [v2.5.3 Fix] 원본/소문자 텍스트 분리: 정규식은 원본 대소문자, 키워드는 소문자로 검사
        const rowTextOriginal = Object.values(rowData.cells).join(' ');
        const rowTextLower = rowTextOriginal.toLowerCase();
        let allPassed = true;

        // 1. 일반 키워드 AND 검사: 소문자 텍스트로 비교
        if (query.keywords.length > 0) {
            const keywordsPassed = query.keywords.every(
                kw => rowTextLower.includes(kw.toLowerCase())
            );
            if (!keywordsPassed) allPassed = false;
        }

        // 2. 정규식 AND 검사: 원본 대소문자 유지 텍스트로 검사 (/Apple/은 대문자 A 필요)
        if (allPassed && query.regexFilters.length > 0) {
            const regexPassed = query.regexFilters.every(regex => {
                regex.lastIndex = 0;
                return regex.test(rowTextOriginal);
            });
            if (!regexPassed) allPassed = false;
        }

        // 3. 범위 AND 검사: 행의 어느 셀이든 해당 범위에 속하는 숫자가 있어야 함
        if (allPassed && query.ranges.length > 0) {
            const rangePassed = query.ranges.every(([minVal, maxVal]) => {
                return Object.values(rowData.cells).some(cellVal => {
                    const num = parseFloat(cellVal);
                    return !isNaN(num) && num >= minVal && num <= maxVal;
                });
            });
            if (!rangePassed) allPassed = false;
        }

        // 4. 열 필터 AND 검사: .filter().으로 부분 일치하는 모든 열을 가져오고 .some()으로 검사
        // [v2.5.3 Fix] .find() 단일 매칭 버그: "영문이름"이 "이름"보다 먼저 걸리는 문제 해결
        if (allPassed && query.columnFilters.length > 0) {
            for (const { column, keyword } of query.columnFilters) {
                const colLower = column.toLowerCase();
                const kwLower = keyword.toLowerCase();

                // 부분 일치하는 모든 열을 가져옴
                const targetCols = rowData.headers.filter(
                    h => h.toLowerCase().includes(colLower)
                );

                // 매칭되는 열이 없으면 실패
                if (targetCols.length === 0) {
                    allPassed = false;
                    break;
                }

                // 찾은 열들 중 하나라도 keyword를 포함하면 통과
                const passed = targetCols.some(col =>
                    (rowData.cells[col] || '').toLowerCase().includes(kwLower)
                );
                if (!passed) {
                    allPassed = false;
                    break;
                }
            }
        }

        if (!allPassed) {
            keysToRemove.push(rowKey);
        }
    }
    for (const key of keysToRemove) {
        rowScores.delete(key);
    }
}
export { WEIGHT_EXACT, WEIGHT_CHOSUNG, WEIGHT_FUZZY, WEIGHT_BM25, WEIGHT_RANGE, WEIGHT_REGEX };

/**
 * [v2.3.0] 열 모드 검색: 특정 열(컨럼)에서만 키워드를 검색합니다.
 * 열 이름은 대소문자 무시 부분 일치로 매칭합니다.
 * 예: col:이름 홍길동 → '이름' 열에서 '홍길동' 검색
 * @param {Object} index - 검색 인덱스
 * @param {string} column - 대상 열 이름
 * @param {string} keyword - 검색 키워드
 * @param {Map} rowScores - 행별 점수 맵
 */
function _columnSearch(index, column, keyword, rowScores) {
    const colLower = column.toLowerCase();
    const kwLower = keyword.toLowerCase();

    // 인버티드 인덱스에서 키워드 포함 셀 검색
    const cellIndices = index.findCellsContaining(keyword);

    for (const cellIdx of cellIndices) {
        const cell = index.cells[cellIdx];
        if (cell === null) continue;

        // 열 이름 필터: 대소문자 무시 부분 일치
        const cellColLower = cell.colName.toLowerCase();
        if (!cellColLower.includes(colLower)) continue;

        const rowKey = `${cell.filePath}|${cell.sheetName}|${cell.rowIdx}`;

        // 유사도 계산
        const valLower = cell.value.toLowerCase();
        let sim;
        if (valLower === kwLower) {
            sim = 1.0;
        } else {
            sim = valLower.includes(kwLower) ? 0.9 : 0.8;
        }

        const score = WEIGHT_EXACT * sim;
        const match = {
            colName: cell.colName,
            cellValue: cell.value,
            matchType: 'exact',
            similarity: sim
        };
        updateRowScore(rowScores, rowKey, score, 'exact', sim, match);
    }
}

/**
 * [v2.5.3] 정규식 검색: 원본 셀 값에 대한 O(N) 풀스캔 (상한 없음)
 * 
 * vocabulary(토큰) 기반 최적화는 토큰화 시 하이픈/공백이 제거되고
 * 소문자로 변환되어 /\d{3}-\d{4}/, /[A-Z]+/ 등의 정규식이
 * 절대 매칭되지 않는 치명적 결함이 있어 원본 셀 풀스캔으로 복원.
 * V8 엔진에서 100만 셀 regex.test() 루프는 20~40ms 내외.
 * 
 * @param {Object} index - 검색 인덱스
 * @param {RegExp} regex - 적용할 정규식
 * @param {Map} rowScores - 행별 점수 맵
 */
function _regexSearch(index, regex, rowScores) {
    for (let i = 0; i < index.cells.length; i++) {
        const cell = index.cells[i];
        if (cell === null) continue;

        // 원본 셀 값(cell.value)에 정규식 직접 검사 (대소문자/특수문자 보존)
        regex.lastIndex = 0;
        if (!regex.test(cell.value)) continue;

        const rowKey = `${cell.filePath}|${cell.sheetName}|${cell.rowIdx}`;
        const sim = 0.95;
        const score = WEIGHT_REGEX * sim;
        const match = {
            colName: cell.colName,
            cellValue: cell.value,
            matchType: 'regex',
            similarity: sim
        };
        updateRowScore(rowScores, rowKey, score, 'regex', sim, match);
    }
}
