/**
 * [v1.0.0] 설정 관리자
 * localStorage를 사용하여 앱 설정을 저장/로드합니다.
 * 원본: config.py (ConfigManager) → localStorage
 */

const STORAGE_KEY = 'gridsonar_config';

// 기본 설정값
const DEFAULT_CONFIG = {
    theme: 'dark',            // 'dark' 또는 'light'
    recentKeywords: [],        // 최근 검색어 (최대 10개)
    favorites: [],             // 즐겨찾기 경로
    minSimilarity: 60,         // 퍼지 매칭 최소 유사도 (0~100)
    language: 'ko',            // UI 언어
    maxResults: 500            // 최대 결과 수
};

/**
 * 전체 설정을 로드합니다.
 * @returns {Object} 설정 객체
 */
export function loadConfig() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return { ...DEFAULT_CONFIG };
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch {
        return { ...DEFAULT_CONFIG };
    }
}

/**
 * 전체 설정을 저장합니다.
 * @param {Object} config
 */
export function saveConfig(config) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
        console.error('[Config] 설정 저장 실패:', e);
    }
}

/**
 * 특정 키의 설정값을 가져옵니다.
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
export function getConfig(key, defaultValue = undefined) {
    const config = loadConfig();
    return config[key] !== undefined ? config[key] : (defaultValue !== undefined ? defaultValue : DEFAULT_CONFIG[key]);
}

/**
 * 특정 키의 설정값을 저장합니다.
 * @param {string} key
 * @param {*} value
 */
export function setConfig(key, value) {
    const config = loadConfig();
    config[key] = value;
    saveConfig(config);
}

export { DEFAULT_CONFIG };
