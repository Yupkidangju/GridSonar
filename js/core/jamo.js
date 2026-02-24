/**
 * [v1.0.0] 한글 자모 분해 유틸리티
 * 한글 초성 검색을 위한 자모 분해, 초성 추출, 매칭 기능을 제공합니다.
 * 외부 라이브러리 없이 유니코드 연산만으로 구현되어 의존성이 없습니다.
 * 원본: Data Scavenger v2.0.0 jamo_utils.py → 1:1 완벽 포팅
 */

// 한글 유니코드 범위 상수
const HANGUL_BASE = 0xAC00; // '가'
const HANGUL_END = 0xD7A3;  // '힣'

// 초성, 중성, 종성 개수
const JUNG_COUNT = 21;
const JONG_COUNT = 28;

// 초성 목록 (19개, 유니코드 순서)
const CHO_LIST = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
    'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

// 초성 자음 문자의 집합 (빠른 판별용)
const CHOSUNG_SET = new Set(CHO_LIST);

/**
 * 한글 완성형 음절 여부 확인 ('가'~'힣')
 * @param {string} char - 단일 문자
 * @returns {boolean}
 */
export function isHangulSyllable(char) {
    const code = char.charCodeAt(0);
    return code >= HANGUL_BASE && code <= HANGUL_END;
}

/**
 * 단독 초성(자음) 문자 여부 확인 ('ㄱ'~'ㅎ')
 * @param {string} char - 단일 문자
 * @returns {boolean}
 */
export function isChosungChar(char) {
    return CHOSUNG_SET.has(char);
}

/**
 * 한글 음절을 초성, 중성, 종성 인덱스로 분해합니다.
 * 한글이 아닌 경우 null을 반환합니다.
 * @param {string} char - 단일 한글 문자
 * @returns {number[]|null} [초성idx, 중성idx, 종성idx] 또는 null
 */
export function decompose(char) {
    if (!isHangulSyllable(char)) return null;
    const code = char.charCodeAt(0) - HANGUL_BASE;
    const cho = Math.floor(code / (JUNG_COUNT * JONG_COUNT));
    const jung = Math.floor((code % (JUNG_COUNT * JONG_COUNT)) / JONG_COUNT);
    const jong = code % JONG_COUNT;
    return [cho, jung, jong];
}

/**
 * 텍스트에서 초성만 추출합니다.
 * 한글 음절 → 초성, 비한글 → 그대로 유지.
 * 예: '홍길동' → 'ㅎㄱㄷ', 'Hello홍' → 'Helloㅎ'
 * @param {string} text - 입력 텍스트
 * @returns {string} 초성 추출 결과
 */
export function extractChosung(text) {
    const result = [];
    for (const char of text) {
        if (isHangulSyllable(char)) {
            const choIdx = decompose(char)[0];
            result.push(CHO_LIST[choIdx]);
        } else {
            result.push(char);
        }
    }
    return result.join('');
}

/**
 * 입력 텍스트가 모두 초성(자음)으로만 이루어져 있는지 확인합니다.
 * 공백은 무시합니다. 빈 문자열은 false를 반환합니다.
 * 예: 'ㅎㄱㄷ' → true, 'ㅎ길ㄷ' → false
 * @param {string} text - 입력 텍스트
 * @returns {boolean}
 */
export function isChosungQuery(text) {
    if (!text || !text.trim()) return false;
    for (const char of text) {
        if (char === ' ') continue;
        if (!isChosungChar(char)) return false;
    }
    return true;
}

/**
 * 초성 쿼리가 텍스트의 초성 패턴에 포함되는지 확인합니다.
 * 예: matchChosung('ㅎㄱㄷ', '홍길동입니다') → true
 *     matchChosung('ㅎㄱ', '한강')         → true
 * @param {string} query - 초성 쿼리
 * @param {string} text - 대상 텍스트
 * @returns {boolean}
 */
export function matchChosung(query, text) {
    if (!query || !text) return false;
    const textChosung = extractChosung(text);
    return textChosung.includes(query);
}

/**
 * 초성 쿼리와 텍스트의 초성 매칭 유사도를 0.0~1.0으로 반환합니다.
 * 완전 매칭이면 1.0, 부분 매칭이면 비율에 따라 0.0~1.0.
 * @param {string} query - 초성 쿼리
 * @param {string} text - 대상 텍스트
 * @returns {number} 0.0 ~ 1.0
 */
export function chosungSimilarity(query, text) {
    if (!query || !text) return 0.0;
    const textChosung = extractChosung(text);
    if (query === textChosung) return 1.0;
    if (textChosung.includes(query)) {
        return 0.8 + (query.length / textChosung.length) * 0.2;
    }
    return 0.0;
}

// CHO_LIST 내보내기 (외부에서 초성 목록 참조 시 사용)
export { CHO_LIST, CHOSUNG_SET, HANGUL_BASE, HANGUL_END, JUNG_COUNT, JONG_COUNT };
