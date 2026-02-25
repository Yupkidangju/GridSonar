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

    // [v2.1.3] Worker 환경용 document 폴리필
    //
    // 근본 원인:
    //   pdf.js v3.x는 내부적으로 PDFWorker 생성 시 다음 순서를 따름:
    //   1) Nested Worker 생성 시도 → CORS 차단 (Worker 내에서 CDN 워커 생성 불가)
    //   2) FakeWorker fallback 전환 →
    //      a) document.currentScript.src 로 fallback 워커 소스 탐색
    //      b) document.createElement('style') 로 CSS 주입
    //      → Worker 스레드에는 document 객체 자체가 없음 → 크래시
    //
    // 해결 전략:
    //   1단계: Worker에 document 최소 스텁 폴리필 제공
    //          → FakeWorker가 document 접근해도 에러 없이 진행
    //   2단계: pdf.worker.min.js를 importScripts로 동일 스레드에 로드
    //          → globalThis.pdfjsWorker 에 워커 코드가 등록됨
    //   3단계: FakeWorker가 globalThis.pdfjsWorker.WorkerMessageHandler 감지
    //          → 별도 스크립트 로딩 없이 동일 스레드에서 직접 실행
    //
    // 이전 실패한 접근법:
    //   - importScripts만 사용 (v2.0.2): document fallback 경로를 차단 못함
    //   - workerPort 더미 포트 (v2.1.2): pdf.js가 실제 메시지 응답을 기대하므로 동작 안함
    if (typeof document === 'undefined') {
        const noop = () => { };
        const mockElement = () => ({
            sheet: { insertRule: noop, deleteRule: noop, cssRules: [] },
            style: {},
            setAttribute: noop,
            getAttribute: () => null,
            appendChild: () => mockElement(),
            removeChild: noop,
            parentNode: null,
            textContent: '',
        });
        self.document = {
            currentScript: { src: '' },
            baseURI: self.location?.href || '',
            createElement: () => mockElement(),
            head: { appendChild: noop, removeChild: noop },
            body: { appendChild: noop, removeChild: noop },
            documentElement: { style: {} },
            getElementById: () => null,
            getElementsByTagName: () => [],
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: noop,
            removeEventListener: noop,
        };
    }

    // 1단계: 메인 라이브러리 로드 (document 폴리필 덕분에 초기화 에러 없음)
    importScripts('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
    // 2단계: 워커 코드 로드 → globalThis.pdfjsWorker 등록
    importScripts('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js');

    return pdfjsLib;
}

function loadMammoth() {
    if (typeof mammoth !== 'undefined') return mammoth;
    importScripts('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js');
    return mammoth;
}

// [v2.7.0] PPTX 파싱용 JSZip 로더
function loadJSZip() {
    if (typeof JSZip !== 'undefined') return JSZip;
    importScripts('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    return JSZip;
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
        } else if (fileType === 'pptx') {
            await parsePPTXInWorker(id, fileName, data);
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
        standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
        // [v2.1.1] CMap(Character Map) CDN 경로 지정 — CJK 폰트 디코딩 필수
        // 한글/중국어/일본어 등 폰트가 PDF에 내장되지 않고
        // OS 폰트나 Adobe 기본 아시아 폰트를 참조하는 경우,
        // 글리프 코드 → 유니코드 텍스트 변환을 위한 CMap 사전이 필요.
        // 없으면 "Unable to load CMap" 에러 → 워커 크래시 → 파싱 실패.
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true
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

/**
 * [v2.7.0] PPTX 파싱 (JSZip + XML 텍스트 추출)
 * .pptx는 ZIP 안에 ppt/slides/slide*.xml 파일들이 들어있는 구조.
 * 각 슬라이드 XML에서 <a:t> 태그 내의 텍스트를 추출하여 가상 엑셀 형식으로 변환.
 */
async function parsePPTXInWorker(id, fileName, arrayBuffer) {
    const zip = loadJSZip();

    self.postMessage({ type: 'progress', id, message: `PPTX 로딩 중: ${fileName}`, percent: 5 });

    // ZIP 압축 해제
    const archive = await zip.loadAsync(arrayBuffer);

    // 슬라이드 파일 목록 추출 및 정렬 (slide1.xml, slide2.xml, ...)
    const slideFiles = Object.keys(archive.files)
        .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
        .sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)/)[1], 10);
            const numB = parseInt(b.match(/slide(\d+)/)[1], 10);
            return numA - numB;
        });

    if (slideFiles.length === 0) {
        self.postMessage({ type: 'error', id, message: `PPTX 슬라이드를 찾을 수 없습니다: ${fileName}` });
        return;
    }

    self.postMessage({
        type: 'progress', id,
        message: `PPTX 파싱 중: ${fileName} (${slideFiles.length}슬라이드)`,
        percent: 10
    });

    const HEADER = ['본문'];
    let totalRows = 0;

    for (let i = 0; i < slideFiles.length; i++) {
        const slideFile = slideFiles[i];
        const xmlText = await archive.files[slideFile].async('text');

        // XML에서 <a:t> 태그 내용 추출 (간단한 정규식 파싱, DOM 파서 불필요)
        // <a:t> 태그는 PowerPoint의 텍스트 런(text run)을 나타냄
        const textFragments = [];
        const regex = /<a:t[^>]*>([^<]*)<\/a:t>/g;
        let match;
        while ((match = regex.exec(xmlText)) !== null) {
            if (match[1].trim()) {
                textFragments.push(match[1]);
            }
        }

        // 텍스트가 없는 슬라이드(이미지만 있는 경우 등)는 건너뛰
        if (textFragments.length === 0) continue;

        const slideText = textFragments.join(' ');
        const slideNum = i + 1;
        const sheetName = `슬라이드 ${slideNum}`;

        self.postMessage({
            type: 'chunk', id,
            sheetName,
            headers: HEADER,
            rows: [[slideText]],
            offset: 0
        });

        totalRows++;

        const pct = Math.round(10 + (slideNum / slideFiles.length * 80));
        self.postMessage({
            type: 'progress', id,
            message: `PPTX 파싱 중: ${fileName} (${slideNum}/${slideFiles.length}슬라이드)`,
            percent: Math.min(pct, 90)
        });
    }

    self.postMessage({ type: 'complete', id, totalRows });
}
