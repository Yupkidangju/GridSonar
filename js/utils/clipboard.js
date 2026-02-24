/**
 * [v1.0.0] 클립보드 관리자
 * 검색 결과를 TSV 형태로 클립보드에 복사합니다.
 * 원본: clipboard_manager.py → Clipboard API
 */

/**
 * 검색 결과를 TSV 형식으로 클립보드에 복사합니다.
 * @param {Array<Object>} results - 검색 결과 배열
 * @returns {Promise<boolean>} 성공 여부
 */
export async function copyResultsToClipboard(results) {
    if (!results || results.length === 0) return false;

    try {
        // 헤더 생성
        const headers = results[0].row.headers || [];
        let text = headers.join('\t') + '\n';

        // 데이터 행 생성
        for (const r of results) {
            const values = headers.map(h => r.row.cells[h] || '');
            text += values.join('\t') + '\n';
        }

        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('[Clipboard] 복사 실패:', err);
        // fallback: execCommand 방식
        return fallbackCopy(results);
    }
}

/**
 * Clipboard API 미지원 시 대체 복사 방법
 * @param {Array<Object>} results
 * @returns {boolean}
 */
function fallbackCopy(results) {
    try {
        const headers = results[0].row.headers || [];
        let text = headers.join('\t') + '\n';
        for (const r of results) {
            const values = headers.map(h => r.row.cells[h] || '');
            text += values.join('\t') + '\n';
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        // deprecated이지만 fallback으로 사용
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
    } catch {
        return false;
    }
}
