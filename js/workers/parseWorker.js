/**
 * [v1.1.2] GridSonar 파싱 Web Worker
 * 메인 스레드 블로킹 방지를 위해 파일 파싱을 별도 스레드에서 실행합니다.
 *
 * 통신 프로토콜:
 *   Main → Worker: { type:'parse', id, fileName, fileType, data(ArrayBuffer|string) }
 *   Worker → Main: { type:'chunk',    id, sheetName, headers, rows, offset }
 *                   { type:'progress', id, message, percent }
 *                   { type:'complete', id, totalRows }
 *                   { type:'error',    id, message }
 *
 * SheetJS의 xlsx.read()가 동기 함수이므로 메인 스레드에서 실행하면 UI 프리징 발생.
 * 이 워커는 해당 동기 연산을 격리하여 Non-blocking UX를 보장합니다.
 */

// CDN 라이브러리 (워커 내부에서 동적 로드)
let XLSX = null;
let Papa = null;

// SheetJS 로드
async function loadSheetJS() {
    if (XLSX) return XLSX;
    try {
        XLSX = await import('https://esm.sh/xlsx@0.18.5');
    } catch {
        XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
    }
    return XLSX;
}

// PapaParse 로드
async function loadPapaParse() {
    if (Papa) return Papa;
    const module = await import('https://esm.sh/papaparse@5.4.1');
    Papa = module.default || module;
    return Papa;
}

// 메시지 핸들러
self.onmessage = async (e) => {
    const { type, id, fileName, fileType, data } = e.data;

    if (type !== 'parse') return;

    try {
        if (fileType === 'csv') {
            await parseCSVInWorker(id, fileName, data);
        } else if (fileType === 'xlsx' || fileType === 'xls') {
            await parseExcelInWorker(id, fileName, data);
        } else {
            self.postMessage({ type: 'error', id, message: `지원하지 않는 파일 형식: ${fileType}` });
        }
    } catch (err) {
        self.postMessage({ type: 'error', id, message: `파싱 실패 (${fileName}): ${err.message}` });
    }
};

/**
 * CSV 파싱 (PapaParse chunk 모드)
 * CSV 텍스트를 받아 청크 단위로 메인 스레드에 전달
 */
async function parseCSVInWorker(id, fileName, csvText) {
    const PapaModule = await loadPapaParse();
    const sheetName = fileName;
    let totalRows = 0;
    let headers = null;
    let buffer = [];
    let offset = 0;
    const CHUNK_SIZE = 10000;

    return new Promise((resolve, reject) => {
        PapaModule.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            chunk(results) {
                if (!headers && results.meta && results.meta.fields) {
                    headers = results.meta.fields.map(String);
                }

                for (const row of results.data) {
                    const rowArr = headers.map(h => row[h] != null ? String(row[h]) : '');
                    buffer.push(rowArr);

                    if (buffer.length >= CHUNK_SIZE) {
                        self.postMessage({
                            type: 'chunk', id, sheetName, headers, rows: buffer, offset
                        });
                        offset += buffer.length;
                        totalRows += buffer.length;
                        buffer = [];
                        self.postMessage({
                            type: 'progress', id,
                            message: `CSV 파싱 중: ${fileName} (${totalRows.toLocaleString()}행)`,
                            percent: -1
                        });
                    }
                }
            },
            complete() {
                if (buffer.length > 0) {
                    self.postMessage({
                        type: 'chunk', id,
                        sheetName, headers: headers || [], rows: buffer, offset
                    });
                    totalRows += buffer.length;
                }
                self.postMessage({ type: 'complete', id, totalRows });
                resolve();
            },
            error(err) {
                self.postMessage({ type: 'error', id, message: `CSV 오류: ${err.message}` });
                reject(err);
            }
        });
    });
}

/**
 * Excel 파싱 (SheetJS — 동기 연산이지만 워커이므로 UI 블로킹 없음)
 * ArrayBuffer를 받아 시트별로 청크 분할하여 메인 스레드에 전달
 */
async function parseExcelInWorker(id, fileName, arrayBuffer) {
    const xlsx = await loadSheetJS();
    const CHUNK_SIZE = 10000;

    self.postMessage({ type: 'progress', id, message: `Excel 파싱 중: ${fileName}`, percent: 10 });

    // 워커 스레드에서 동기 파싱 실행 (메인 스레드 프리징 없음!)
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

        const jsonData = xlsx.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            blankrows: false
        });

        if (jsonData.length === 0) continue;

        const headers = jsonData[0].map(v => String(v ?? ''));
        const dataRows = jsonData.slice(1);

        // 청크 분할하여 전송
        let offset = 0;
        for (let i = 0; i < dataRows.length; i += CHUNK_SIZE) {
            const chunk = dataRows.slice(i, i + CHUNK_SIZE);
            const rows = chunk.map(row =>
                headers.map((_, colIdx) => row[colIdx] != null ? String(row[colIdx]) : '')
            );

            self.postMessage({
                type: 'chunk', id, sheetName, headers, rows, offset
            });

            offset += rows.length;
            totalRows += rows.length;

            const pct = Math.round(10 + ((si / sheetCount + (i / dataRows.length) / sheetCount) * 80));
            self.postMessage({
                type: 'progress', id,
                message: `Excel 파싱 중: ${fileName} [${sheetName}] (${totalRows.toLocaleString()}행)`,
                percent: Math.min(pct, 90)
            });
        }
    }

    self.postMessage({ type: 'complete', id, totalRows });
}
