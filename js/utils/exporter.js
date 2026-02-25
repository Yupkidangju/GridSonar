/**
 * [v1.0.0] 검색 결과 내보내기 유틸리티
 * SheetJS를 이용해 검색 결과를 Excel(.xlsx) 또는 CSV(.csv)로 내보냅니다.
 * 원본: exporter.py (ResultExporter) → SheetJS 기반
 */

import { loadSheetJS } from '../core/fileParser.js';
import { t } from './i18n.js';

/**
 * 검색 결과를 파일로 내보냅니다.
 * @param {Array<Object>} results - 검색 결과 배열
 * @param {string} format - 'xlsx' 또는 'csv'
 * @param {string} [fileName=null] - 저장 파일명 (확장자 제외, null 시 다국어 기본값)
 * @param {Map} [stateFiles=null] - [v1.2.1] 파일 경로 추적을 위한 files Map
 */
export async function exportResults(results, format = 'xlsx', fileName = null, stateFiles = null) {
    if (!results || results.length === 0) {
        console.warn('[Exporter] 내보낼 결과가 없습니다');
        return;
    }

    const xlsx = await loadSheetJS();

    // 결과를 2차원 배열로 변환
    const rows = [];
    const finalFileName = fileName || t('exportFileName') || 'ExportedResults';

    // 메타 헤더 + 원본 데이터 헤더
    const metaHeaders = [t('metaFile'), t('metaPath'), t('metaSheet'), t('metaMatchType'), t('metaSimilarity')];
    const dataHeaders = results[0].row.headers || [];
    const allHeaders = [...metaHeaders, ...dataHeaders];
    rows.push(allHeaders);

    // 데이터 행 추가
    for (const r of results) {
        let filePath = '';
        if (stateFiles) {
            const info = r.row.fileKey ? stateFiles.get(r.row.fileKey) : Array.from(stateFiles.values()).find(f => f.displayName === r.row.fileName);
            if (info && info.path) filePath = info.path;
        }

        const metaValues = [
            r.row.fileName,
            filePath,
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
    xlsx.utils.book_append_sheet(wb, ws, finalFileName);

    // 파일 다운로드
    const ext = format === 'csv' ? 'csv' : 'xlsx';
    const fullName = `${finalFileName}.${ext}`;

    if (format === 'csv') {
        const csvContent = xlsx.utils.sheet_to_csv(ws);
        const BOM = '\uFEFF'; // UTF-8 BOM (한글 깨짐 방지)
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        await downloadBlob(blob, fullName);
    } else {
        const wbout = xlsx.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        await downloadBlob(blob, fullName);
    }
}

/**
 * [v1.2.2] Blob을 파일로 저장합니다.
 * Chromium 브라우저: showSaveFilePicker() → OS 네이티브 "다른 이름으로 저장" 대화상자
 * Firefox/Safari 등: 기존 <a download> 방식 (다운로드 폴더) 폴백
 * @param {Blob} blob - 저장할 데이터
 * @param {string} fileName - 기본 파일명 (확장자 포함)
 */
async function downloadBlob(blob, fileName) {
    // [v1.2.2] File System Access API 지원 시 Save As 다이얼로그 표시
    if (window.showSaveFilePicker) {
        try {
            // 확장자에서 MIME 타입과 필터 구성
            const ext = fileName.split('.').pop().toLowerCase();
            const fileTypes = buildFileTypeFilter(ext);

            const handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: fileTypes
            });

            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return; // Save As 성공 시 여기서 종료
        } catch (err) {
            // 사용자가 다이얼로그를 취소한 경우 (AbortError)
            if (err.name === 'AbortError') return;
            // 그 외 예외는 폴백으로 진행
            console.warn('[Exporter] showSaveFilePicker 실패, 폴백 사용:', err.message);
        }
    }

    // 폴백: 기존 <a download> 방식 (다운로드 폴더)
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * [v1.2.2] 확장자에 맞는 showSaveFilePicker용 파일 타입 필터를 구성합니다.
 * @param {string} ext - 파일 확장자 (예: 'xlsx', 'csv')
 * @returns {Array} - showSaveFilePicker의 types 옵션 배열
 */
function buildFileTypeFilter(ext) {
    const filters = {
        xlsx: [{
            description: 'Excel Workbook (.xlsx)',
            accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
        }],
        csv: [{
            description: 'CSV (Comma-Separated Values)',
            accept: { 'text/csv': ['.csv'] }
        }]
    };
    return filters[ext] || [];
}

/**
 * [v1.2.1] 파싱 실패(에러) 파일 목록을 CSV로 내보냅니다.
 * @param {Map} stateFiles - 앱의 state.files Map
 */
export async function exportFailedFiles(stateFiles) {
    if (!stateFiles || stateFiles.size === 0) return;

    const errorList = [];
    for (const info of stateFiles.values()) {
        if (info.status === 'error') {
            errorList.push([
                info.displayName || '',
                info.path || '',
                info.errorReason || 'Unknown parsing error'
            ]);
        }
    }

    if (errorList.length === 0) return;

    const xlsx = await loadSheetJS();

    // 헤더: 파일명, 경로, 에러 사유
    const rows = [
        [t('metaFile') || 'File', t('metaPath') || 'Path', t('metaErrorReason') || 'Error Reason'],
        ...errorList
    ];

    const ws = xlsx.utils.aoa_to_sheet(rows);
    const csvContent = xlsx.utils.sheet_to_csv(ws);
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const finalFileName = t('failedFilesName') || 'FailedFilesList';
    await downloadBlob(blob, `${finalFileName}.csv`);
}

export { downloadBlob };
