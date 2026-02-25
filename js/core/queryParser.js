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
 * - [v2.5.0] '/패턴/' 또는 '/패턴/i' = 정규식 검색
 * - 그 외 = 일반 키워드
 */

// [v1.1.7] 숫자 범위 패턴: 100~500, -100~500, -0.5~0.5 등 (음수 지원)
const RANGE_PATTERN = /^(-?\d+(?:\.\d+)?)\s*[~]\s*(-?\d+(?:\.\d+)?)$/;

// [v2.3.0] 열 모드 패턴: col:열이름 또는 열:열이름
const COLUMN_PATTERN = /^(?:col|열):(.+)$/i;

// [v2.5.0] 정규식 패턴: /패턴/ 또는 /패턴/i 또는 /패턴/gi 등
const REGEX_PATTERN = /^\/(.+)\/([gimsuy]*)$/;

/**
 * 파싱된 검색 쿼리 구조체
 * @typedef {Object} SearchQuery
 * @property {string[]} keywords - 일반 검색어 (AND 조건)
 * @property {string[]} excludes - 제외 검색어 ('-' 접두사로 입력)
 * @property {Array<[number, number]>} ranges - 숫자 범위 [min, max] 배열
 * @property {Array<{column: string, keyword: string}>} columnFilters - [v2.3.0] 열 모드 필터
 * @property {RegExp[]} regexFilters - [v2.5.0] 정규식 필터
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
    const regexFilters = [];

    if (!rawQuery || !rawQuery.trim()) {
        return { keywords, excludes, ranges, columnFilters, regexFilters, raw: rawQuery || '' };
    }

    // [v2.5.0] 정규식 토큰은 내부에 공백을 포함할 수 있으므로
    // 슬래시로 감싼 패턴을 먼저 추출한 뒤, 나머지를 공백으로 분리
    let remaining = rawQuery.trim();
    const regexTokenPattern = /\/(?:[^/\\]|\\.)+\/[gimsuy]*/g;
    let regexMatch;

    while ((regexMatch = regexTokenPattern.exec(remaining)) !== null) {
        const fullMatch = regexMatch[0];
        const parsed = fullMatch.match(REGEX_PATTERN);
        if (parsed) {
            try {
                const regex = new RegExp(parsed[1], parsed[2] || '');
                regexFilters.push(regex);
            } catch (e) {
                // 잘못된 정규식은 일반 키워드로 처리하지 않고 무시
            }
        }
    }

    // 정규식 토큰을 제거한 나머지 문자열에서 일반 토큰 추출
    remaining = remaining.replace(regexTokenPattern, '').trim();

    if (!remaining) {
        return { keywords, excludes, ranges, columnFilters, regexFilters, raw: rawQuery };
    }

    const tokens = remaining.split(/\s+/);

    // [v2.3.0] 열 모드 상태: 현재 활성화된 열 이름 (다음 키워드에 적용)
    let pendingColumn = null;

    for (const token of tokens) {
        // 제외 검색어 처리
        if (token.startsWith('-') && token.length > 1) {
            pendingColumn = null;
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
            pendingColumn = colMatch[1];
            continue;
        }

        // 열 모드가 활성화된 경우 → columnFilter로 등록
        if (pendingColumn) {
            columnFilters.push({ column: pendingColumn, keyword: token });
            pendingColumn = null;
            continue;
        }

        // 일반 키워드
        keywords.push(token);
    }

    return { keywords, excludes, ranges, columnFilters, regexFilters, raw: rawQuery };
}
