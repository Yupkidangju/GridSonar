/**
 * [v1.0.0] 검색어 파서 (QueryParser)
 * 사용자 입력을 구조화된 쿼리 객체로 변환합니다.
 * 원본: searcher.py QueryParser → 1:1 포팅
 *
 * 규칙:
 * - 공백 = AND 조건 (여러 키워드 동시 포함)
 * - '-키워드' = 제외 조건
 * - '숫자~숫자' = 범위 검색
 * - 그 외 = 일반 키워드
 */

// [v1.1.7] 숫자 범위 패턴: 100~500, -100~500, -0.5~0.5 등 (음수 지원)
const RANGE_PATTERN = /^(-?\d+(?:\.\d+)?)\s*[~]\s*(-?\d+(?:\.\d+)?)$/;

/**
 * 파싱된 검색 쿼리 구조체
 * @typedef {Object} SearchQuery
 * @property {string[]} keywords - 일반 검색어 (AND 조건)
 * @property {string[]} excludes - 제외 검색어 ('-' 접두사로 입력)
 * @property {Array<[number, number]>} ranges - 숫자 범위 [min, max] 배열
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

    if (!rawQuery || !rawQuery.trim()) {
        return { keywords, excludes, ranges, raw: rawQuery || '' };
    }

    const tokens = rawQuery.trim().split(/\s+/);

    for (const token of tokens) {
        // 제외 검색어 처리
        if (token.startsWith('-') && token.length > 1) {
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
            continue;
        }

        // 일반 키워드
        keywords.push(token);
    }

    return { keywords, excludes, ranges, raw: rawQuery };
}
