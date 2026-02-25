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
 * [v2.0.0] PDF/DOCX 지원 추가 — "1열짜리 엑셀" 가상화 패턴
 *   PDF: pdf.js (Mozilla) — 페이지별 텍스트 추출
 *   DOCX: mammoth.js — 문단별 텍스트 추출
 */

// CDN 라이브러리 (워커 내부에서 동적 로드)
let XLSX = null;
let Papa = null;
let pdfjsLib = null;
let mammoth = null;

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

// [v2.0.0] pdf.js 로드 (v3.11.174 — Web Worker 내 안정 동작 확인된 버전)
async function loadPdfJS() {
    if (pdfjsLib) return pdfjsLib;
    const module = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.mjs');
    pdfjsLib = module;
    // sub-worker 완전 비활성화: data: URL로 빈 워커를 주입하여
    // Web Worker 내부에서 중첩 워커 생성 시도 자체를 차단
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'data:text/javascript,';
    return pdfjsLib;
}

// [v2.0.0] mammoth.js 로드
async function loadMammoth() {
    if (mammoth) return mammoth;
    const module = await import('https://esm.sh/mammoth@1.8.0');
    mammoth = module.default || module;
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
 * [v1.1.3 Fix] File(Blob) 객체를 직접 받아 PapaParse 스트리밍 처리.
 */
async function parseCSVInWorker(id, fileName, fileOrBlob) {
    const PapaModule = await loadPapaParse();
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
 * Excel 파싱 (SheetJS — 동기 연산이지만 워커이므로 UI 블로킹 없음)
 */
async function parseExcelInWorker(id, fileName, arrayBuffer) {
    const xlsx = await loadSheetJS();
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
 * [v2.0.0] PDF 파싱 — pdf.js로 페이지별 텍스트 추출
 * "1열짜리 엑셀" 가상화: 각 페이지를 시트로, 전체 텍스트를 단일 셀로 취급
 */
async function parsePDFInWorker(id, fileName, arrayBuffer) {
    const pdfjs = await loadPdfJS();

    self.postMessage({ type: 'progress', id, message: `PDF 로딩 중: ${fileName}`, percent: 5 });

    // PDF 문서 로드 (sub-worker 비활성화 상태에서 동작)
    const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
        isEvalSupported: false,
        useSystemFonts: true
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

    // 페이지별로 텍스트 추출하여 청크 전송
    for (let p = 1; p <= numPages; p++) {
        const page = await pdf.getPage(p);
        const textContent = await page.getTextContent();

        // 텍스트 아이템을 공백으로 합치기
        const text = textContent.items.map(item => item.str).join(' ').trim();

        if (text.length === 0) continue; // 빈 페이지 스킵

        // 시트명: "N페이지" 형태 (예: "3p")
        const sheetName = `${p}p`;

        // 1열짜리 엑셀로 가상화: 본문 전체를 하나의 행/셀로
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
 * [v2.0.0] DOCX 파싱 — mammoth.js로 텍스트 추출
 * "1열짜리 엑셀" 가상화: 문단 단위로 행 분할, 단일 시트/단일 컬럼
 */
async function parseDOCXInWorker(id, fileName, arrayBuffer) {
    const mam = await loadMammoth();

    self.postMessage({ type: 'progress', id, message: `DOCX 로딩 중: ${fileName}`, percent: 10 });

    // mammoth로 텍스트 추출
    const result = await mam.extractRawText({ arrayBuffer });
    const fullText = result.value || '';

    if (fullText.trim().length === 0) {
        self.postMessage({ type: 'complete', id, totalRows: 0 });
        return;
    }

    // 문단(빈 줄 기준) 단위로 분할하여 행 생성
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

    // 청크 분할 전송
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
