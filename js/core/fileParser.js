/**
 * [v1.0.0] 파일 파싱 어댑터
 * File API로 받은 파일을 포맷에 따라 적절한 파서로 라우팅합니다.
 * 원본: scanner.py → fileParser.js
 *
 * SheetJS (.xlsx/.xls) + PapaParse (.csv)를 사용하여 파싱합니다.
 * Web Worker 내에서 호출되므로 importScripts 대신 CDN ES 모듈 import를 사용합니다.
 */

// CDN에서 라이브러리를 동적으로 로드 (최초 1회)
let XLSX = null;
let Papa = null;

/**
 * CDN에서 SheetJS를 로드합니다.
 */
async function loadSheetJS() {
    if (XLSX) return XLSX;
    try {
        const module = await import('https://esm.sh/xlsx@0.18.5');
        XLSX = module;
        return XLSX;
    } catch (e) {
        // fallback CDN
        const module = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
        XLSX = module;
        return XLSX;
    }
}

/**
 * CDN에서 PapaParse를 로드합니다.
 */
async function loadPapaParse() {
    if (Papa) return Papa;
    const module = await import('https://esm.sh/papaparse@5.4.1');
    Papa = module.default || module;
    return Papa;
}

/**
 * 지원되는 파일 확장자
 */
const SUPPORTED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv', '.pdf', '.docx']);

/**
 * 파일 확장자를 추출합니다.
 * @param {string} fileName
 * @returns {string} 소문자 확장자 (예: '.xlsx')
 */
function getExtension(fileName) {
    const dotIdx = fileName.lastIndexOf('.');
    if (dotIdx === -1) return '';
    return fileName.slice(dotIdx).toLowerCase();
}

/**
 * 파일이 지원되는 포맷인지 확인합니다.
 * @param {File} file
 * @returns {boolean}
 */
export function isSupportedFile(file) {
    return SUPPORTED_EXTENSIONS.has(getExtension(file.name));
}

/**
 * 파일을 파싱하여 청크 단위로 콜백을 호출합니다.
 *
 * @param {File} file - 파싱할 파일 객체
 * @param {Object} callbacks
 * @param {function} callbacks.onChunk - (chunkData) => void, chunkData: { sheetName, headers, rows, offset }
 * @param {function} callbacks.onProgress - (message, percent) => void
 * @param {function} callbacks.onComplete - (totalRows) => void
 * @param {function} callbacks.onError - (errorMessage) => void
 * @param {number} [chunkSize=10000] - 청크당 행 수
 */
export async function parseFile(file, callbacks, chunkSize = 10000) {
    const ext = getExtension(file.name);

    try {
        if (ext === '.csv') {
            await parseCSV(file, callbacks, chunkSize);
        } else if (ext === '.xlsx' || ext === '.xls') {
            await parseExcel(file, callbacks, chunkSize);
        } else {
            callbacks.onError(`지원하지 않는 파일 형식: ${ext}`);
        }
    } catch (err) {
        callbacks.onError(`파일 파싱 실패 (${file.name}): ${err.message}`);
    }
}

/**
 * CSV 파일을 PapaParse chunk 모드로 스트리밍 파싱합니다.
 */
async function parseCSV(file, callbacks, chunkSize) {
    const PapaModule = await loadPapaParse();
    const sheetName = file.name;
    let totalRows = 0;
    let headers = null;
    let buffer = [];
    let offset = 0;

    return new Promise((resolve, reject) => {
        PapaModule.parse(file, {
            // header 모드 사용 — 자동으로 첫 행을 헤더로 인식
            header: true,
            skipEmptyLines: true,
            // 청크 단위로 행을 수신
            chunk(results) {
                if (!headers && results.meta && results.meta.fields) {
                    headers = results.meta.fields.map(String);
                }

                for (const row of results.data) {
                    // 객체를 배열로 변환 (헤더 순서)
                    const rowArr = headers.map(h => row[h] != null ? String(row[h]) : '');
                    buffer.push(rowArr);

                    if (buffer.length >= chunkSize) {
                        callbacks.onChunk({
                            sheetName,
                            headers,
                            rows: buffer,
                            offset
                        });
                        offset += buffer.length;
                        totalRows += buffer.length;
                        buffer = [];
                        callbacks.onProgress(`CSV 파싱 중: ${file.name} (${totalRows.toLocaleString()}행)`, -1);
                    }
                }
            },
            complete() {
                // 남은 버퍼 처리
                if (buffer.length > 0) {
                    callbacks.onChunk({
                        sheetName,
                        headers: headers || [],
                        rows: buffer,
                        offset
                    });
                    totalRows += buffer.length;
                }
                callbacks.onComplete(totalRows);
                resolve();
            },
            error(err) {
                callbacks.onError(`CSV 파싱 오류 (${file.name}): ${err.message}`);
                reject(err);
            }
        });
    });
}

/**
 * Excel 파일을 SheetJS로 파싱합니다.
 * ArrayBuffer로 읽은 후 시트별로 청크 분할하여 전달합니다.
 */
async function parseExcel(file, callbacks, chunkSize) {
    const xlsx = await loadSheetJS();

    callbacks.onProgress(`Excel 로딩 중: ${file.name}`, 0);

    // File → ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    callbacks.onProgress(`Excel 파싱 중: ${file.name}`, 20);

    // 워크북 파싱
    const workbook = xlsx.read(arrayBuffer, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: true
    });

    let totalRows = 0;
    const sheetCount = workbook.SheetNames.length;

    for (let si = 0; si < sheetCount; si++) {
        const sheetName = workbook.SheetNames[si];
        const worksheet = workbook.Sheets[sheetName];

        // 시트를 JSON으로 변환 (헤더 포함)
        const jsonData = xlsx.utils.sheet_to_json(worksheet, {
            header: 1,       // 배열 모드 (첫 행이 헤더)
            defval: '',      // 빈 셀 기본값
            blankrows: false  // 빈 행 스킵
        });

        if (jsonData.length === 0) continue;

        // 첫 행을 헤더로 사용
        const headers = jsonData[0].map(v => String(v ?? ''));
        const dataRows = jsonData.slice(1);

        // 청크 분할
        let offset = 0;
        for (let i = 0; i < dataRows.length; i += chunkSize) {
            const chunk = dataRows.slice(i, i + chunkSize);
            // 각 행을 문자열 배열로 변환
            const rows = chunk.map(row =>
                headers.map((_, colIdx) => row[colIdx] != null ? String(row[colIdx]) : '')
            );

            callbacks.onChunk({
                sheetName,
                headers,
                rows,
                offset
            });

            offset += rows.length;
            totalRows += rows.length;

            const pct = Math.round(20 + ((si / sheetCount + (i / dataRows.length) / sheetCount) * 70));
            callbacks.onProgress(
                `Excel 파싱 중: ${file.name} [${sheetName}] (${totalRows.toLocaleString()}행)`,
                Math.min(pct, 90)
            );
        }
    }

    callbacks.onComplete(totalRows);
}

export { loadSheetJS, loadPapaParse, SUPPORTED_EXTENSIONS };
