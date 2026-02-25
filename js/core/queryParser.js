/**
 * [v1.0.0] 검색어 파서 (QueryParser)
 * 사용자 입력을 구조화된 쿼리 객체로 변환합니다.
 * 원본: searcher.py QueryParser → 1:1 포팅
 *
 * 규칙:
 * - 공백 = AND 조건 (여러 키워드 동시 포함)
 * - '-키워드' = 제외 조건
 * - '숫자~숫자' = 범위 검색
 * - [v2.3.0] 'col:열이름' 또는 '열:열이름' = 열 모드 검색
 *   다음 키워드가 해당 열에서만 검색됨
 * - 그 외 = 일반 키워드
 */

// [v1.1.7] 숫자 범위 패턴: 100~500, -100~500, -0.5~0.5 등 (음수 지원)
const RANGE_PATTERN = /^(-?\d+(?:\.\d+)?)\s*[~]\s*(-?\d+(?:\.\d+)?)$/;

// [v2.3.0] 열 모드 패턴: col:열이름 또는 열:열이름
const COLUMN_PATTERN = /^(?:col|열):(.+)$/i;

/**
 * 파싱된 검색 쿼리 구조체
 * @typedef {Object} SearchQuery
 * @property {string[]} keywords - 일반 검색어 (AND 조건)
 * @property {string[]} excludes - 제외 검색어 ('-' 접두사로 입력)
 * @property {Array<[number, number]>} ranges - 숫자 범위 [min, max] 배열
 * @property {Array<{column: string, keyword: string}>} columnFilters - [v2.3.0] 열 모드 필터
 * @property {string} raw - 원본 검색 문자열
 */

/**
 * 원시 검색어를 SearchQuery로 파싱합니다.
 * @param {string} rawQuery - 사용자 입력 검색어
 * @returns {SearchQuery}
 */
export function parseQuery(rawQuery) {
    const keywords = [];
    const excludes = [];
    const ranges = [];
    const columnFilters = [];

    if (!rawQuery || !rawQuery.trim()) {
        return { keywords, excludes, ranges, columnFilters, raw: rawQuery || '' };
    }

    const tokens = rawQuery.trim().split(/\s+/);

    // [v2.3.0] 열 모드 상태: 현재 활성화된 열 이름 (다음 키워드에 적용)
    let pendingColumn = null;

    for (const token of tokens) {
        // 제외 검색어 처리
        if (token.startsWith('-') && token.length > 1) {
            pendingColumn = null; // 열 모드 해제
            excludes.push(token.slice(1));
            continue;
        }

        // 범위 검색 처리
        const rangeMatch = token.match(RANGE_PATTERN);
        if (rangeMatch) {
            let minVal = parseFloat(rangeMatch[1]);
            let maxVal = parseFloat(rangeMatch[2]);
            if (minVal > maxVal) {
                [minVal, maxVal] = [maxVal, minVal];
            }
            ranges.push([minVal, maxVal]);
            pendingColumn = null;
            continue;
        }

        // [v2.3.0] 열 모드 검색 처리
        const colMatch = token.match(COLUMN_PATTERN);
        if (colMatch) {
            pendingColumn = colMatch[1]; // 열 이름 저장 → 다음 키워드에 적용
            continue;
        }

        // 열 모드가 활성화된 경우 → columnFilter로 등록
        if (pendingColumn) {
            columnFilters.push({ column: pendingColumn, keyword: token });
            pendingColumn = null; // 사용 후 해제
            continue;
        }

        // 일반 키워드
        keywords.push(token);
    }

    return { keywords, excludes, ranges, columnFilters, raw: rawQuery };
}
