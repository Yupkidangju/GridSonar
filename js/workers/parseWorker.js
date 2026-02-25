/**
 * [v1.1.2] GridSonar 파싱 Web Worker
 * 메인 스레드 블로킹 방지를 위해 파일 파싱을 별도 스레드에서 실행합니다.
 *
 * 통신 프로토콜:
 *   Main → Worker: { type:'parse', id, fileName, fileType, data(File|ArrayBuffer) }
 *   Worker → Main: { type:'chunk',    id, sheetName, headers, rows, offset }
 *                   { type:'progress', id, message, percent }
 *                   { type:'complete', id, totalRows }
 *                   { type:'error',    id, message }
 *
 * [v2.0.1] module worker에서 classic worker로 전환 (importScripts 호환성 확보)
 *   - pdf.js 등 일부 라이브러리가 내부적으로 importScripts를 호출할 때
 *     모듈 워커 환경에서 발생하는 DOMException 원천 차단.
 *   - 지연 로딩(Lazy Load): 파일 타입에 따라 필요한 CDN만 동기 로드
 */

// 라이브러리 로드 함수 (Classic Worker 전용: importScripts 사용)
function loadSheetJS() {
    if (typeof XLSX !== 'undefined') return XLSX;
    importScripts('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');
    return XLSX;
}

function loadPapaParse() {
    if (typeof Papa !== 'undefined') return Papa;
    importScripts('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js');
    return Papa;
}

function loadPdfJS() {
    if (typeof pdfjsLib !== 'undefined') return pdfjsLib;
    // [v2.0.2] pdf.js v3.11.174 안정 버전 사용
    // 1단계: 메인 라이브러리 로드
    importScripts('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
    // 2단계: 워커 코드를 현재 스레드에 직접 로드 (Nested Worker CORS 우회)
    //   - workerSrc URL 지정 방식은 Worker 내에서 Nested Worker 생성을 시도하며,
    //     브라우저 CORS 정책에 의해 차단됨.
    //   - FakeWorker fallback도 document.createElement() 호출로 인해
    //     Worker 환경에서 "document is not defined" 에러 발생.
    //   - 해결: pdf.worker.min.js를 importScripts로 동일 스레드에 로드하면
    //     pdf.js가 워커 코드 존재를 감지하여 별도 워커 생성을 건너뜀.
    importScripts('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js');
    return pdfjsLib;
}

function loadMammoth() {
    if (typeof mammoth !== 'undefined') return mammoth;
    importScripts('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js');
    return mammoth;
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
        } else if (fileType === 'pdf') {
            await parsePDFInWorker(id, fileName, data);
        } else if (fileType === 'docx') {
            await parseDOCXInWorker(id, fileName, data);
        } else {
            self.postMessage({ type: 'error', id, message: `지원하지 않는 파일 형식: ${fileType}` });
        }
    } catch (err) {
        self.postMessage({ type: 'error', id, message: `파싱 실패 (${fileName}): ${err.message}` });
    }
};

/**
 * CSV 파싱 (PapaParse chunk 모드)
 */
async function parseCSVInWorker(id, fileName, fileOrBlob) {
    const PapaModule = loadPapaParse();
    const sheetName = fileName;
    let totalRows = 0;
    let headers = null;
    let buffer = [];
    let offset = 0;
    const CHUNK_SIZE = 10000;

    return new Promise((resolve, reject) => {
        PapaModule.parse(fileOrBlob, {
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
 * Excel 파싱 (SheetJS)
 */
async function parseExcelInWorker(id, fileName, arrayBuffer) {
    const xlsx = loadSheetJS();
    const CHUNK_SIZE = 10000;

    self.postMessage({ type: 'progress', id, message: `Excel 파싱 중: ${fileName}`, percent: 10 });

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

/**
 * [v2.0.2] PDF 파싱 (Nested Worker CORS 우회 + 표준 폰트 CDN 로드)
 */
async function parsePDFInWorker(id, fileName, arrayBuffer) {
    const pdfjs = loadPdfJS();

    self.postMessage({ type: 'progress', id, message: `PDF 로딩 중: ${fileName}`, percent: 5 });

    const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
        isEvalSupported: false,
        useSystemFonts: true,
        // [v2.0.2] 표준 폰트(Helvetica, Times-Roman 등) CDN 경로 지정
        // PDF에 내장되지 않은 기본 폰트를 만날 때 텍스트 추출 실패를 방지
        standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
    });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const HEADER = ['본문'];
    let totalRows = 0;

    self.postMessage({
        type: 'progress', id,
        message: `PDF 파싱 중: ${fileName} (${numPages}페이지)`,
        percent: 10
    });

    for (let p = 1; p <= numPages; p++) {
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();

        const text = textContent.items.map(item => item.str).join(' ').trim();
        if (text.length === 0) continue;

        const sheetName = `${p}p`;

        self.postMessage({
            type: 'chunk', id,
            sheetName,
            headers: HEADER,
            rows: [[text]],
            offset: 0
        });

        totalRows++;

        const pct = Math.round(10 + (p / numPages * 80));
        self.postMessage({
            type: 'progress', id,
            message: `PDF 파싱 중: ${fileName} (${p}/${numPages}페이지)`,
            percent: Math.min(pct, 90)
        });
    }

    self.postMessage({ type: 'complete', id, totalRows });
}

/**
 * [v2.0.0] DOCX 파싱
 */
async function parseDOCXInWorker(id, fileName, arrayBuffer) {
    const mam = loadMammoth();

    self.postMessage({ type: 'progress', id, message: `DOCX 로딩 중: ${fileName}`, percent: 10 });

    const result = await mam.extractRawText({ arrayBuffer });
    const fullText = result.value || '';

    if (fullText.trim().length === 0) {
        self.postMessage({ type: 'complete', id, totalRows: 0 });
        return;
    }

    const paragraphs = fullText.split(/\n+/).filter(p => p.trim().length > 0);
    const HEADER = ['본문'];
    const CHUNK_SIZE = 500;
    let totalRows = 0;
    const sheetName = '문서 본문';

    self.postMessage({
        type: 'progress', id,
        message: `DOCX 파싱 중: ${fileName} (${paragraphs.length}문단)`,
        percent: 30
    });

    for (let i = 0; i < paragraphs.length; i += CHUNK_SIZE) {
        const chunk = paragraphs.slice(i, i + CHUNK_SIZE);
        const rows = chunk.map(p => [p.trim()]);

        self.postMessage({
            type: 'chunk', id,
            sheetName,
            headers: HEADER,
            rows,
            offset: i
        });

        totalRows += rows.length;

        const pct = Math.round(30 + (i / paragraphs.length * 60));
        self.postMessage({
            type: 'progress', id,
            message: `DOCX 파싱 중: ${fileName} (${totalRows}/${paragraphs.length}문단)`,
            percent: Math.min(pct, 90)
        });
    }

    self.postMessage({ type: 'complete', id, totalRows });
}
