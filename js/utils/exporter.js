/**
 * [v1.0.0] 검색 결과 내보내기 유틸리티
 * SheetJS를 이용해 검색 결과를 Excel(.xlsx) 또는 CSV(.csv)로 내보냅니다.
 * 원본: exporter.py (ResultExporter) → SheetJS 기반
 */

import { loadSheetJS } from '../core/fileParser.js';

/**
 * 검색 결과를 파일로 내보냅니다.
 * @param {Array<Object>} results - 검색 결과 배열
 * @param {string} format - 'xlsx' 또는 'csv'
 * @param {string} [fileName='검색결과'] - 저장 파일명 (확장자 제외)
 */
export async function exportResults(results, format = 'xlsx', fileName = '검색결과') {
    if (!results || results.length === 0) {
        console.warn('[Exporter] 내보낼 결과가 없습니다');
        return;
    }

    const xlsx = await loadSheetJS();

    // 결과를 2차원 배열로 변환
    const rows = [];

    // 메타 헤더 + 원본 데이터 헤더
    const metaHeaders = ['_출처파일', '_시트', '_매칭유형', '_유사도'];
    const dataHeaders = results[0].row.headers || [];
    const allHeaders = [...metaHeaders, ...dataHeaders];
    rows.push(allHeaders);

    // 데이터 행 추가
    for (const r of results) {
        const metaValues = [
            r.row.fileName,
            r.row.sheetName,
            r.matchType,
            `${Math.round(r.similarity * 100)}%`
        ];
        const dataValues = dataHeaders.map(h => r.row.cells[h] || '');
        rows.push([...metaValues, ...dataValues]);
    }

    // SheetJS로 워크북 생성
    const ws = xlsx.utils.aoa_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, '검색결과');

    // 파일 다운로드
    const ext = format === 'csv' ? 'csv' : 'xlsx';
    const fullName = `${fileName}.${ext}`;

    if (format === 'csv') {
        const csvContent = xlsx.utils.sheet_to_csv(ws);
        const BOM = '\uFEFF'; // UTF-8 BOM (한글 깨짐 방지)
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, fullName);
    } else {
        const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        downloadBlob(blob, fullName);
    }
}

/**
 * Blob을 파일로 다운로드합니다.
 * @param {Blob} blob
 * @param {string} fileName
 */
function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    // 정리
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

export { downloadBlob };
