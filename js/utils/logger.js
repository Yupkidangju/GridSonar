/**
 * [v1.0.0] 콘솔 로깅 유틸리티
 * 원본: logger.py → console 래퍼
 * 개발/프로덕션 모드에 따라 로깅 수준을 조절합니다.
 */

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
let currentLevel = LOG_LEVELS.INFO;

const PREFIX = '[GridSonar]';

export const logger = {
    setLevel(level) {
        currentLevel = LOG_LEVELS[level] ?? LOG_LEVELS.INFO;
    },

    debug(...args) {
        if (currentLevel <= LOG_LEVELS.DEBUG) {
            console.debug(PREFIX, ...args);
        }
    },

    info(...args) {
        if (currentLevel <= LOG_LEVELS.INFO) {
            console.info(PREFIX, ...args);
        }
    },

    warn(...args) {
        if (currentLevel <= LOG_LEVELS.WARN) {
            console.warn(PREFIX, ...args);
        }
    },

    error(...args) {
        if (currentLevel <= LOG_LEVELS.ERROR) {
            console.error(PREFIX, ...args);
        }
    },

    // 타이밍 측정 유틸
    time(label) {
        console.time(`${PREFIX} ${label}`);
    },

    timeEnd(label) {
        console.timeEnd(`${PREFIX} ${label}`);
    }
};
