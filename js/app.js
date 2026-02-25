/**
 * [v1.0.0] GridSonar 애플리케이션 진입점
 * 모든 모듈을 초기화하고 이벤트를 바인딩합니다.
 *
 * 아키텍처:
 * - 파일 드롭/선택 → fileParser로 파싱 → SearchIndex에 인덱싱
 * - 검색 입력 → searchEngine으로 검색 → 결과 테이블 렌더링
 * - 모든 무거운 작업은 비동기로 처리하여 UI 블로킹 방지
 */

import { SearchIndex } from './core/searchIndex.js';
import { search } from './core/searchEngine.js';
import { parseQuery } from './core/queryParser.js';
// [v1.1.2] fileParser는 폴백에서 동적 import — Worker 우선 사용
import * as cache from './core/cacheManager.js';
import { getConfig, setConfig } from './utils/config.js';
import { exportResults, exportFailedFiles } from './utils/exporter.js';
import { copyResultsToClipboard } from './utils/clipboard.js';
import { t, getAvailableLanguages, getLanguage, setLanguage, translatePage } from './utils/i18n.js';
import { logger } from './utils/logger.js';
import { getDriveConfig, saveDriveConfig, connectAndPickFiles } from './core/googleDrive.js';

// ── 전역 상태 ──
const state = {
    index: new SearchIndex(),
    files: new Map(),
    results: [],
    filteredResults: [],
    recentKeywords: [],
    // [v1.1.7 Fix] Boolean Trap 방지 — 카운터 기반 동시성 제어
    // 연속 드롭 시 두 번째 배치가 false로 덮어쓰는 문제 방지
    indexingJobs: 0,
    get isIndexing() { return this.indexingJobs > 0; },
    fuseInstance: null,
    currentQuery: '',
};

// ── DOM 참조 ──
const $ = (id) => document.getElementById(id);
const dom = {};

// ── 초기화 ──
document.addEventListener('DOMContentLoaded', () => {
    cacheDomRefs();
    loadSettings();
    bindEvents();
    initResizeHandle();
    registerServiceWorker();
    // [v2.1.0] 영구 저장소 요청 — 브라우저가 IndexedDB를 임의 삭제하지 않도록 요청
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then(granted => {
            if (granted) logger.info('영구 저장소 권한 확보');
        });
    }
    // [v2.1.0] 세션 히스토리 초기 렌더링
    renderSessionHistory();
    logger.info('GridSonar 초기화 완료 (v2.7.0)');
});

function cacheDomRefs() {
    dom.searchInput = $('search-input');
    dom.searchStats = $('search-stats');
    dom.searchHistory = $('search-history');
    dom.uploadContainer = $('upload-container');
    dom.dropzone = $('dropzone');
    dom.fileTree = $('file-tree');
    dom.sidebarContent = $('sidebar-content');
    dom.resultsToolbar = $('results-toolbar');
    dom.resultsTableContainer = $('results-table-container');
    dom.resultsThead = $('results-thead');
    dom.resultsTbody = $('results-tbody');
    dom.resultsCount = $('results-count');
    dom.resultsTime = $('results-time');
    dom.emptyState = $('empty-state');
    dom.filterInput = $('filter-input');
    dom.simSlider = $('sim-slider');
    dom.simValue = $('sim-value');
    dom.statusText = $('status-text');
    dom.statusStats = $('status-stats');
    dom.progressBar = $('progress-bar');
    dom.progressFill = $('progress-fill');
    dom.toastContainer = $('toast-container');
    dom.detailModal = $('detail-modal');
    dom.modalTitle = $('modal-title');
    dom.modalBody = $('modal-body');
    dom.modalClose = $('modal-close');
    dom.fileInput = $('file-input');
    dom.btnTheme = $('btn-theme');
    dom.btnAddFiles = $('btn-add-files');
    dom.btnClearCache = $('btn-clear-cache');
    dom.btnCopy = $('btn-copy');
    dom.btnExportXlsx = $('btn-export-xlsx');
    dom.btnExportCsv = $('btn-export-csv');
    dom.langSelect = $('lang-select');
    dom.btnExportErrors = $('btn-export-errors');
    dom.btnExportErrorsSidebar = $('btn-export-errors-sidebar');
    // [v2.1.0] 세션 히스토리 DOM 참조
    dom.sessionHistory = $('session-history');
    dom.sessionList = $('session-list');

    // [v2.4.0] 도움말 모달 참조
    dom.btnHelp = $('btn-help');
    dom.helpModal = $('help-modal');
    dom.helpModalTitle = $('help-modal-title');
    dom.helpModalBody = $('help-modal-body');
    dom.helpModalClose = $('help-modal-close');

    // [v2.6.0] Google Drive 연동 DOM
    dom.btnGoogleDrive = $('btn-google-drive');
    dom.driveSettingsModal = $('drive-settings-modal');
    dom.driveSettingsClose = $('drive-settings-close');
    dom.driveSettingsCancel = $('drive-settings-cancel');
    dom.driveSettingsSave = $('drive-settings-save');
    dom.driveApiKey = $('drive-api-key');
    dom.driveClientId = $('drive-client-id');
}

function loadSettings() {
    // 테마
    const theme = getConfig('theme', 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    dom.btnTheme.textContent = theme === 'dark' ? '☀️' : '🌙';

    // 최근 검색어
    state.recentKeywords = getConfig('recentKeywords', []);

    // [v1.2.1] 다국어 셀렉트 박스 설정
    const langs = getAvailableLanguages();
    const currentLang = getLanguage();
    langs.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.code;
        opt.textContent = l.label;
        if (l.code === currentLang) opt.selected = true;
        dom.langSelect.appendChild(opt);
    });

    // 시작 시 HTML 요소 번역 적용
    translatePage();
}

// ── 이벤트 바인딩 ──
function bindEvents() {
    // 검색
    dom.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // [v2.9.0] 자동완성 항목이 선택된 경우 해당 값으로 채움
            const focused = dom.searchHistory.querySelector('.search-history-item.ac-focused');
            if (focused) {
                dom.searchInput.value = focused.dataset.keyword;
                hideSearchHistory();
                performSearch();
                return;
            }
            performSearch();
        }
        // [v2.8.0] ↑↓ 방향키: 드롭다운이 표시 중이면 항목 탐색, 아니면 결과 행 탐색
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (dom.searchHistory.classList.contains('visible')) {
                navigateAutoComplete(e.key === 'ArrowDown' ? 1 : -1);
            } else {
                navigateResults(e.key === 'ArrowDown' ? 1 : -1);
            }
        }
        // [v2.9.0] Tab: 첫 번째 제안으로 채움
        if (e.key === 'Tab') {
            const first = dom.searchHistory.querySelector('.search-history-item');
            if (first && dom.searchHistory.classList.contains('visible')) {
                e.preventDefault();
                dom.searchInput.value = first.dataset.keyword;
                hideSearchHistory();
            }
        }
    });
    dom.searchInput.addEventListener('focus', () => showAutoComplete(dom.searchInput.value));

    // [v2.8.0] 전역 키보드 단축키
    // Ctrl+K : 검색창 포커스 (macOS는 Cmd+K)
    // Esc    : 검색창 내용 지우기 / 모달 닫기
    document.addEventListener('keydown', (e) => {
        // Ctrl+K or Cmd+K
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            dom.searchInput.focus();
            dom.searchInput.select();
            return;
        }
        // Esc: 상세 모달 먼저 닫고, 없으면 검색창 초기화
        if (e.key === 'Escape') {
            const modal = document.getElementById('detail-modal');
            if (modal && modal.style.display !== 'none') {
                closeDetailModal();
                return;
            }
            if (dom.searchInput.value) {
                dom.searchInput.value = '';
                hideSearchHistory();
            }
            return;
        }
    });

    // [v1.1.5] 디바운스 300ms 실시간 검색 (구글 스타일 UX)
    // [v2.9.0] 자동완성 드롭다운 연동
    let searchDebounceTimer = null;
    dom.searchInput.addEventListener('input', () => {
        const val = dom.searchInput.value;
        showAutoComplete(val);
        // 검색 디바운스
        if (!val.trim()) return;
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            if (dom.searchInput.value.trim()) {
                performSearch();
            }
        }, 300);
    });
    document.addEventListener('click', (e) => {
        if (!dom.searchInput.contains(e.target) && !dom.searchHistory.contains(e.target)) {
            hideSearchHistory();
        }
    });

    // [v1.1.0] 파일/폴더 드래그 앤 드롭 (폴더 재귀 탐색 지원)
    dom.dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dom.dropzone.classList.add('drag-over');
    });
    dom.dropzone.addEventListener('dragleave', () => {
        dom.dropzone.classList.remove('drag-over');
    });
    dom.dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dom.dropzone.classList.remove('drag-over');
        handleDrop(e.dataTransfer);
    });
    dom.dropzone.addEventListener('click', () => dom.fileInput.click());

    // 전체 화면 드롭 지원
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            handleDrop(e.dataTransfer);
        }
    });

    // 파일 입력
    dom.fileInput.addEventListener('change', (e) => {
        handleFileDrop(e.target.files);
        dom.fileInput.value = '';
    });
    dom.btnAddFiles.addEventListener('click', () => dom.fileInput.click());

    // [v2.6.0] Google Drive 연동 이벤트
    dom.btnGoogleDrive.addEventListener('click', (e) => {
        e.stopPropagation(); // 드롭존 클릭(로컬 파일 탐색기 열기) 버블링 방지
        connectAndPickFiles({
            onSettingsNeeded: () => {
                // 저장된 설정값을 폼에 세팅하고 모달 열기
                const conf = getDriveConfig();
                dom.driveApiKey.value = conf.apiKey;
                dom.driveClientId.value = conf.clientId;
                dom.driveSettingsModal.style.display = 'flex';
            },
            onStatus: (msg, isLoad, pct) => {
                if (!msg) { setStatus(t('statusReady'), false); return; }
                setStatus(msg, isLoad, pct);
            },
            onProgress: (pct) => setStatus(`${t('driveDownloading') || '다운로드 중'} (${pct}%)`, true, pct),
            onFilesReady: (files) => {
                // 다운로드 완료된 File[] 객체들을 핸들러로 전달
                if (files && files.length > 0) {
                    handleFileDrop(files);
                } else {
                    setStatus(t('statusReady') || '준비됨', false);
                }
            },
            onError: (err) => {
                setStatus(t('statusReady') || '준비됨', false);
                showToast(`⚠️ ${err}`, 'error');
            }
        });
    });

    // Google Drive 설정 모달 액션
    const closeDriveModal = () => dom.driveSettingsModal.style.display = 'none';
    dom.driveSettingsClose.addEventListener('click', closeDriveModal);
    dom.driveSettingsCancel.addEventListener('click', closeDriveModal);
    dom.driveSettingsSave.addEventListener('click', () => {
        const key = dom.driveApiKey.value.trim();
        const cid = dom.driveClientId.value.trim();
        saveDriveConfig(key, cid);
        closeDriveModal();
        dom.btnGoogleDrive.click(); // 설정 후 즉시 연결 재시도
    });

    // 테마
    dom.btnTheme.addEventListener('click', toggleTheme);

    // 언어 전환
    dom.langSelect.addEventListener('change', (e) => {
        setLanguage(e.target.value);
        translatePage();
        updateStats(); // 동적 텍스트 갱신
        renderFileTree(); // 동적 텍스트 갱신
        if (state.results && state.results.length > 0) {
            renderResults(state.results, state.currentQuery);
        }
        showToast(t('statusReady'), 'success');
    });

    // 캐시 초기화
    dom.btnClearCache.addEventListener('click', async () => {
        // [v1.1.9 Fix] 캐시 제거 후 실제 리로드
        // DB만 지우고 UI는 남으면 메모리/상태와 DB가 다른 유령 상태 발생
        if (confirm(t('confirmClearCache'))) {
            await cache.clearAllCache();
            window.location.reload();
        }
    });

    // 결과 액션
    dom.btnCopy.addEventListener('click', async () => {
        const targets = state.filteredResults.length > 0 ? state.filteredResults : state.results;
        const ok = await copyResultsToClipboard(targets);
        showToast(ok ? `📋 ${targets.length}${t('resultsUnit')} ${t('copySuccess')}` : `⚠️ ${t('copyFail')}`, ok ? 'success' : 'error');
    });

    dom.btnExportXlsx.addEventListener('click', () => {
        const targets = state.filteredResults.length > 0 ? state.filteredResults : state.results;
        exportResults(targets, 'xlsx', null, state.files);
        showToast(`📤 ${targets.length}${t('resultsUnit')} ${t('exportSuccess')} (XLSX)`, 'success');
    });

    dom.btnExportCsv.addEventListener('click', () => {
        const targets = state.filteredResults.length > 0 ? state.filteredResults : state.results;
        exportResults(targets, 'csv', null, state.files);
        showToast(`📄 ${targets.length}${t('resultsUnit')} ${t('exportSuccess')} (CSV)`, 'success');
    });

    const exportErrorsHandler = () => {
        exportFailedFiles(state.files);
        showToast(`⚠️ ${t('exportSuccess')}`, 'success');
    };
    if (dom.btnExportErrors) dom.btnExportErrors.addEventListener('click', exportErrorsHandler);
    if (dom.btnExportErrorsSidebar) dom.btnExportErrorsSidebar.addEventListener('click', exportErrorsHandler);

    // 결과 내 필터링
    dom.filterInput.addEventListener('input', () => applyResultFilter());

    // 유사도 슬라이더
    dom.simSlider.addEventListener('input', () => {
        dom.simValue.textContent = `${dom.simSlider.value}%`;
    });
    dom.simSlider.addEventListener('change', () => {
        if (state.currentQuery) performSearch();
    });

    // [v2.4.0] 도움말 모달
    dom.btnHelp.addEventListener('click', () => {
        dom.helpModalTitle.textContent = '📚 ' + t('helpTitle');
        dom.helpModalBody.innerHTML = t('helpHtml');
        dom.helpModal.style.display = 'flex';
    });
    dom.helpModalClose.addEventListener('click', () => {
        dom.helpModal.style.display = 'none';
    });
    dom.helpModal.addEventListener('click', (e) => {
        if (e.target === dom.helpModal) dom.helpModal.style.display = 'none';
    });

    // 상세 보기 모달 닫기
    dom.modalClose.addEventListener('click', closeDetailModal);
    dom.detailModal.addEventListener('click', (e) => {
        if (e.target === dom.detailModal) closeDetailModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDetailModal();
            dom.helpModal.style.display = 'none';
        }
    });
}

// ── 파일 처리 ──

// [v2.0.0] 지원되는 확장자 — PDF/DOCX 비정형 문서 포함
// [v2.7.0] .pptx 추가 — fileParser.js, googleDrive.js와 동일하게 유지
const SUPPORTED_EXT = new Set(['.xlsx', '.xls', '.csv', '.pdf', '.docx', '.pptx']);

/**
 * 파일명이 지원되는 확장자인지 확인합니다.
 * @param {string} name - 파일명
 * @returns {boolean}
 */
function isSupportedExt(name) {
    const dot = name.lastIndexOf('.');
    if (dot === -1) return false;
    return SUPPORTED_EXT.has(name.slice(dot).toLowerCase());
}

/**
 * [v1.1.0] 드롭된 DataTransfer에서 파일/폴더를 처리합니다.
 * webkitGetAsEntry()로 폴더를 재귀 탐색하고,
 * 지원되는 확장자(.xlsx, .xls, .csv)만 필터링합니다.
 * @param {DataTransfer} dataTransfer
 */
async function handleDrop(dataTransfer) {
    const items = dataTransfer.items;
    const collectedFiles = [];
    let skippedCount = 0;

    if (items && items.length > 0) {
        // webkitGetAsEntry() 지원 여부 확인 (폴더 탐색용)
        const entries = [];
        for (let i = 0; i < items.length; i++) {
            const entry = items[i].webkitGetAsEntry?.();
            if (entry) {
                entries.push(entry);
            } else {
                // webkitGetAsEntry 미지원 시 일반 파일로 처리
                const file = items[i].getAsFile();
                if (file) {
                    if (isSupportedExt(file.name)) {
                        collectedFiles.push(file);
                    } else {
                        skippedCount++;
                    }
                }
            }
        }

        // Entry가 있으면 폴더 재귀 탐색
        if (entries.length > 0) {
            setStatus(t('loadingFolder') || '폴더 탐색 중...', true);
            for (const entry of entries) {
                const result = await collectFilesFromEntry(entry);
                collectedFiles.push(...result.files);
                skippedCount += result.skipped;
            }
        }
    } else {
        // dataTransfer.items 미지원 시 files 사용
        for (const file of dataTransfer.files) {
            if (isSupportedExt(file.name)) {
                collectedFiles.push(file);
            } else {
                skippedCount++;
            }
        }
    }

    // 결과 보고 및 처리
    if (collectedFiles.length === 0) {
        const msg = skippedCount > 0
            ? (t('errUnsupportedFormatCount') || '').replace('{count}', skippedCount) || `⚠️ ${skippedCount}개 파일이 지원되지 않는 형식입니다 (.xlsx, .xls, .csv만 가능)`
            : t('errUnsupportedFormat') || '⚠️ 지원되지 않는 파일 형식입니다 (.xlsx, .xls, .csv만 가능)';
        showToast(msg, 'warning');
        return;
    }

    if (skippedCount > 0) {
        let infoStr = t('infoSkippedFiles') || `ℹ️ {skipped}개 비지원 파일 제외, {loaded}개 파일 로드`;
        infoStr = infoStr.replace('{skipped}', skippedCount).replace('{loaded}', collectedFiles.length);
        showToast(infoStr, 'info');
    }

    await handleFileDrop(collectedFiles);
}

/**
 * [v1.1.0] FileSystemEntry를 재귀적으로 탐색하여 지원 파일을 수집합니다.
 * @param {FileSystemEntry} entry
 * @returns {Promise<{files: File[], skipped: number}>}
 */
async function collectFilesFromEntry(entry) {
    const files = [];
    let skipped = 0;

    if (entry.isFile) {
        // 파일 엔트리 → File 객체로 변환
        const file = await new Promise((resolve, reject) => {
            entry.file(resolve, reject);
        });
        if (isSupportedExt(file.name)) {
            file.customPath = entry.fullPath;
            files.push(file);
        } else {
            skipped++;
        }
    } else if (entry.isDirectory) {
        // 디렉토리 엔트리 → 하위 항목 재귀 탐색
        const dirReader = entry.createReader();
        const entries = await readAllDirectoryEntries(dirReader);
        for (const childEntry of entries) {
            const result = await collectFilesFromEntry(childEntry);
            files.push(...result.files);
            skipped += result.skipped;
        }
    }

    return { files, skipped };
}

/**
 * DirectoryReader에서 모든 엔트리를 읽습니다.
 * readEntries()는 한번에 최대 100개만 반환하므로 빈 배열이 올 때까지 반복합니다.
 * @param {FileSystemDirectoryReader} dirReader
 * @returns {Promise<FileSystemEntry[]>}
 */
function readAllDirectoryEntries(dirReader) {
    return new Promise((resolve, reject) => {
        const allEntries = [];
        function readBatch() {
            dirReader.readEntries((entries) => {
                if (entries.length === 0) {
                    resolve(allEntries);
                } else {
                    allEntries.push(...entries);
                    readBatch(); // 다음 배치 읽기
                }
            }, reject);
        }
        readBatch();
    });
}

/**
 * [v1.1.4] 파일 배열을 인덱싱합니다.
 * 배치 모드: 모든 파일 처리 후 BM25/Fuse 단 1회만 리빌드.
 * 고유 파일키: name_lastModified_size로 동일 이름 다른 파일 충돌 방지.
 * @param {File[]} files
 */
async function handleFileDrop(files) {
    if (files.length === 0) return;

    // UI 전환
    dom.uploadContainer.style.display = 'none';
    dom.fileTree.style.display = 'block';

    state.indexingJobs++;
    const isBatch = files.length > 1;

    for (const file of files) {
        const fileKey = `${file.name}__${file.lastModified}__${file.size}`;
        if (state.files.has(fileKey)) continue;

        state.files.set(fileKey, {
            file,
            fileKey,
            displayName: file.name,
            path: file.customPath || file.webkitRelativePath || file.name,
            status: 'pending',
            sheets: [],
            totalRows: 0,
            worker: null,
            errorReason: null
        });
        renderFileTree();
        await indexFile(file, fileKey, isBatch);
    }

    if (isBatch) {
        setStatus(t('loadingBM25') || 'BM25 인덱스 구축 중...', true, 95);
        await new Promise(resolve => setTimeout(() => {
            state.index.buildBM25();
            resolve();
        }, 0));
        await updateFuseInstance();
        updateStats();
        setStatus(`${t('indexingComplete')} (${state.index.totalFiles}${t('files')}, ${state.index.totalRows.toLocaleString()}${t('rows')})`, false);
    }
    state.indexingJobs--;
    // [v2.1.0] 인덱싱 완료 시 세션 자동 저장
    if (!state.isIndexing && state.files.size > 0) {
        saveCurrentSession();
    }
}

/**
 * [v1.1.4] 파일 파싱 및 인덱싱
 * @param {File} file
 * @param {string} fileKey - 고유 파일 식별자
 * @param {boolean} isBatch - 배치 모드 여부 (true면 BM25/Fuse 건너뛰)
 */
async function indexFile(file, fileKey, isBatch = false) {
    const fileInfo = state.files.get(fileKey);
    fileInfo.status = 'indexing';
    renderFileTree();

    setStatus(`${t('indexing')}: ${file.name}`, true);

    // [v1.1.8] 캐시 확인 — 스트리밍 복원 (OOM 방지)
    const cached = await cache.isFileCached(file.name, file.lastModified, file.size);
    if (cached) {
        let totalCells = 0;
        let cachedHeaders = null;
        const restored = await cache.loadFileData(file.name, file.lastModified, file.size, (chunk, headers) => {
            cachedHeaders = headers;
            restoreCacheChunk(fileKey, file.name, chunk, headers);
            totalCells += chunk.length;
        });
        if (restored) {
            // 헤더가 있으면 이미 콜백에서 처리 중이지만,
            // loadFileData는 헤더를 콜백 전에 읽으므로 여기서 재검증
            cachedHeaders = restored.headers;
            fileInfo.status = 'ready';
            fileInfo.totalRows = totalCells || restored.totalCells || 0;
            renderFileTree();
            updateStats();
            setStatus(`✅ ${t('cachedRestore')}: ${file.name}`, false);
            showToast(`⚡ ${file.name} ${t('cachedRestore')}`, 'success');
            return;
        }
    }

    // Worker 지원 여부에 따라 분기
    if (typeof Worker !== 'undefined') {
        await indexFileViaWorker(file, fileKey, fileInfo, isBatch);
    } else {
        await indexFileFallback(file, fileKey, fileInfo, isBatch);
    }
}

/**
 * [v1.1.5] Web Worker 기반 파일 파싱 — 스트리밍 캐시 적용
 * cellsForCache 메모리 누적 대신 청크가 도잩할 때마다 IndexedDB에 즉시 기록.
 */
async function indexFileViaWorker(file, fileKey, fileInfo, isBatch) {
    const headersForCache = {};
    let totalRows = 0;
    // [v1.1.5] 스트리밍 캐시 라이터 (OOM 방지)
    let cacheWriter = null;
    let cellBuffer = [];
    const CACHE_FLUSH_SIZE = 5000; // IndexedDB 청크 단위

    try {
        const worker = new Worker('./js/workers/parseWorker.js');
        fileInfo.worker = worker;
        const id = `${fileKey}_${Date.now()}`;

        const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
        // [v2.0.0] PDF/DOCX 파일 타입 분기 추가
        const typeMap = { '.csv': 'csv', '.xlsx': 'xlsx', '.xls': 'xls', '.pdf': 'pdf', '.docx': 'docx', '.pptx': 'pptx' };
        const fileType = typeMap[ext] || ext.replace('.', '');
        let data;
        if (fileType === 'csv') {
            data = file;
        } else {
            data = await file.arrayBuffer();
        }

        const transferList = fileType === 'csv' ? [] : [data];
        worker.postMessage({ type: 'parse', id, fileName: file.name, fileType, data }, transferList);

        await new Promise((resolve, reject) => {
            // [v1.1.6 Fix] Promise Queue — 메시지 순차 처리 강제
            // async onmessage에서 await 중 다음 메시지가 도잩하면
            // cacheWriter 중복 생성/cellBuffer 꽌임 레이스 컨디션 발생.
            // Promise를 체이닝하여 이전 메시지 처리가 끝난 후에만 다음을 처리.
            let messageQueue = Promise.resolve();

            worker.onmessage = (e) => {
                messageQueue = messageQueue.then(async () => {
                    // [v1.1.8 Fix] 파일이 삭제되었으면 즉시 중단 (좀비 캐시 방지)
                    if (!state.files.has(fileKey)) return;

                    const msg = e.data;
                    if (msg.id !== id) return;

                    switch (msg.type) {
                        case 'chunk': {
                            const { sheetName, headers, rows, offset } = msg;
                            state.index.addDataChunk(fileKey, file.name, sheetName, headers, rows, offset);

                            if (!fileInfo.sheets.includes(sheetName)) {
                                fileInfo.sheets.push(sheetName);
                            }
                            if (!headersForCache[sheetName]) {
                                headersForCache[sheetName] = headers;
                            }

                            for (let ri = 0; ri < rows.length; ri++) {
                                for (let ci = 0; ci < headers.length; ci++) {
                                    const val = rows[ri][ci];
                                    if (val && val !== '' && val !== 'nan' && val !== 'None' && val !== 'undefined') {
                                        cellBuffer.push({
                                            sheetName, rowIdx: offset + ri,
                                            colIdx: ci, colName: headers[ci], value: val
                                        });
                                    }
                                }
                            }

                            if (cellBuffer.length >= CACHE_FLUSH_SIZE) {
                                if (!cacheWriter) {
                                    cacheWriter = await cache.beginCacheWrite(
                                        file.name, file.lastModified, file.size, headersForCache
                                    );
                                }
                                await cacheWriter.appendChunk(cellBuffer.splice(0));
                            }

                            totalRows += rows.length;
                            renderFileTree();
                            break;
                        }
                        case 'progress':
                            setStatus(msg.message, true, msg.percent);
                            break;
                        case 'complete':
                            fileInfo.status = 'ready';
                            fileInfo.totalRows = msg.totalRows;
                            fileInfo.worker = null;
                            renderFileTree();
                            worker.terminate();
                            resolve();
                            break;
                        case 'error':
                            fileInfo.status = 'error';
                            fileInfo.errorReason = detectPasswordError(msg.message)
                                ? (t('errPasswordProtected') || '암호 보호된 파일')
                                : msg.message;
                            fileInfo.worker = null;
                            // [v1.1.8 Fix] 논리적 에러 시에도 롤백 (반쪽짜리 데이터 제거)
                            state.index.removeFile(fileKey);
                            renderFileTree();
                            updateStats(); // [v2.0.0 Fix] 에러 파일 버튼 토글
                            showToast(`⚠️ ${fileInfo.errorReason}`, 'error');
                            logger.error(fileInfo.errorReason);
                            worker.terminate();
                            reject(new Error(fileInfo.errorReason));
                            break;
                    }
                }).catch(err => {
                    logger.error('메시지 처리 중 오류:', err);
                    reject(err);
                });
            };

            worker.onerror = (err) => {
                logger.warn('Worker 실패, 폴백 모드:', err.message);
                fileInfo.errorReason = err.message;
                fileInfo.worker = null;
                worker.terminate();
                // [v1.1.7 Fix] 롬백: 반쪽짜리 데이터 제거 후 폴백 실행
                // 워커가 5만 행 적재 후 크래시 → 폴백이 0행부터 재시작 → 중복 방지
                state.index.removeFile(fileKey);
                indexFileFallback(file, fileKey, fileInfo, isBatch).then(resolve).catch(reject);
            };
        });

        if (!isBatch) {
            setStatus(t('loadingBM25') || 'BM25 인덱스 구축 중...', true, 95);
            await new Promise(resolve => setTimeout(() => {
                state.index.buildBM25();
                resolve();
            }, 0));
            await updateFuseInstance();
            updateStats();
        }

        // [v1.1.5] 남은 캐시 버퍼 플러시 + 트랜잭션 완료
        if (cellBuffer.length > 0 || cacheWriter) {
            if (!cacheWriter) {
                cacheWriter = await cache.beginCacheWrite(
                    file.name, file.lastModified, file.size, headersForCache
                );
            }
            if (cellBuffer.length > 0) {
                await cacheWriter.appendChunk(cellBuffer.splice(0));
            }
            await cacheWriter.finalize();
        }

        setStatus(`✅ 인덱싱 완료: ${file.name} (${totalRows.toLocaleString()}행)`, false);
        showToast(`✅ ${file.name} 인덱싱 완료 (${totalRows.toLocaleString()}행)`, 'success');

    } catch (err) {
        if (fileInfo.status !== 'error') {
            fileInfo.status = 'error';
            fileInfo.errorReason = fileInfo.errorReason || err.message;
            renderFileTree();
            updateStats(); // [v2.0.0 Fix] 에러 파일 버튼 토글
            showToast(`⚠️ 인덱싱 실패: ${file.name}`, 'error');
        }
        fileInfo.worker = null;
        logger.error('인덱싱 실패:', err);
    }
}

/**
 * [v1.1.4] 폴백: Web Worker 미지원 시 메인 스레드 파싱
 */
async function indexFileFallback(file, fileKey, fileInfo, isBatch) {
    const cellsForCache = [];
    const headersForCache = {};
    let totalRows = 0;

    try {
        const { parseFile: parseFileFn } = await import('./core/fileParser.js');

        await parseFileFn(file, {
            onChunk(chunkData) {
                const { sheetName, headers, rows, offset } = chunkData;
                state.index.addDataChunk(fileKey, file.name, sheetName, headers, rows, offset);

                if (!fileInfo.sheets.includes(sheetName)) {
                    fileInfo.sheets.push(sheetName);
                }
                if (!headersForCache[sheetName]) {
                    headersForCache[sheetName] = headers;
                }
                for (let ri = 0; ri < rows.length; ri++) {
                    for (let ci = 0; ci < headers.length; ci++) {
                        const val = rows[ri][ci];
                        if (val && val !== '' && val !== 'nan' && val !== 'None' && val !== 'undefined') {
                            cellsForCache.push({
                                sheetName, rowIdx: offset + ri,
                                colIdx: ci, colName: headers[ci], value: val
                            });
                        }
                    }
                }
                totalRows += rows.length;
                renderFileTree();
            },
            onProgress(message, percent) { setStatus(message, true, percent); },
            onComplete(total) { fileInfo.status = 'ready'; fileInfo.totalRows = total; renderFileTree(); },
            onError(message) { fileInfo.status = 'error'; renderFileTree(); showToast(`⚠️ ${message}`, 'error'); }
        });

        if (!isBatch) {
            setStatus('BM25 인덱스 구축 중...', true, 95);
            await new Promise(resolve => setTimeout(() => { state.index.buildBM25(); resolve(); }, 0));
            await updateFuseInstance();
            updateStats();
        }

        if (cellsForCache.length > 0) {
            cache.saveFileData({
                fileName: file.name, lastModified: file.lastModified,
                fileSize: file.size, cells: cellsForCache, headers: headersForCache
            });
        }

        setStatus(`✅ 인덱싱 완료: ${file.name} (${totalRows.toLocaleString()}행)`, false);
        showToast(`✅ ${file.name} 인덱싱 완료 (${totalRows.toLocaleString()}행)`, 'success');

    } catch (err) {
        fileInfo.status = 'error';
        renderFileTree();
        showToast(`⚠️ 인덱싱 실패: ${file.name}`, 'error');
        logger.error('인덱싱 실패:', err);
    }
}

/**
 * [v1.1.8] 캐시 청크 1개를 인덱스로 복원 (스트리밍 모드)
 * 거대 배열을 메모리에 모으지 않고 청크 단위로 즉시 처리.
 */
function restoreCacheChunk(fileKey, displayName, cells, headers) {
    if (!cells || cells.length === 0) return;

    // 청크 내 셀을 시트별/행별로 그룹핑
    const sheetsData = {};
    for (const cell of cells) {
        const sheet = cell.sheetName;
        if (!sheetsData[sheet]) sheetsData[sheet] = {};
        if (!sheetsData[sheet][cell.rowIdx]) sheetsData[sheet][cell.rowIdx] = {};
        sheetsData[sheet][cell.rowIdx][cell.colName] = cell.value;
    }

    for (const [sheetName, rowsMap] of Object.entries(sheetsData)) {
        const hdrs = (headers && headers[sheetName]) || [];
        if (hdrs.length === 0) continue;

        const sortedRows = Object.keys(rowsMap).map(Number).sort((a, b) => a - b);
        const rows = sortedRows.map(rowIdx => {
            const rowDict = rowsMap[rowIdx];
            return hdrs.map(h => rowDict[h] || '');
        });

        if (rows.length > 0) {
            // [v1.1.9 Fix] sortedRows 배열 자체를 전달 — 연속 오프셋 가정 대신 실제 행 번호 사용
            // 중간에 빈 행이 있는 엑셀: sortedRows=[500,502,503]
            // 기존: offset=500+0,1,2 → 500,501,502 (데이터 밀림!)
            // 수정: addDataChunk이 배열을 받아 500,502,503으로 정확히 매핑
            state.index.addDataChunk(fileKey, displayName, sheetName, hdrs, rows, sortedRows);
        }

        const fileInfo = state.files.get(fileKey);
        if (fileInfo && !fileInfo.sheets.includes(sheetName)) {
            fileInfo.sheets.push(sheetName);
        }
    }
}

function finishIndexing() {
    // 모든 파일 인덱싱 완료 후 BM25 갱신
    if (!state.isIndexing) {
        state.index.buildBM25();
        updateFuseInstance();
    }
}

// ── Fuse.js 로드 및 인스턴스 갱신 ──
async function updateFuseInstance() {
    try {
        if (state.index.vocabulary.size === 0) return;

        const FuseModule = await import('https://esm.sh/fuse.js@7.0.0');
        const Fuse = FuseModule.default || FuseModule;

        // [v1.1.1 Fix] 퍼지 검색에 의미 있는 토큰만 필터링
        // - 1글자 토큰 제외 (CJK 유니그램 등 오타 매칭 무의미)
        // - 순수 숫자 제외 (범위 검색으로 처리)
        // - 20자 초과 제외 (셀 전체 텍스트 등 노이즈)
        // - 상한선 100K (기존 50K에서 확대, Fuse.js 성능 보장)
        const vocabList = [...state.index.vocabulary]
            .filter(t => t.length >= 2 && t.length <= 20 && !/^\d+$/.test(t))
            .slice(0, 100000);

        state.fuseInstance = new Fuse(vocabList, {
            threshold: 0.4,
            distance: 100,
            includeScore: true,
        });
        logger.info(`Fuse.js 어휘 등록: ${vocabList.length}개 (전체 ${state.index.vocabulary.size}개)`);
    } catch (err) {
        logger.warn('Fuse.js 로드 실패 (퍼지 검색 비활성화):', err);
        state.fuseInstance = null;
    }
}

// ── 검색 ──
function performSearch() {
    const query = dom.searchInput.value.trim();
    if (!query) return;

    // [v1.1.6 Fix] 인덱싱 중 검색 차단
    // _bm25Dirty=true 상태에서 검색하면 buildBM25()가 동기 실행되어
    // Worker로 격리한 UI 비블로킹이 무력화됨
    if (state.isIndexing) {
        showToast(t('loadingIndexing'), 'warning');
        return;
    }

    if (state.index.totalCells === 0) {
        showToast(`📂 ${t('addFilesFirst')}`, 'warning');
        return;
    }

    state.currentQuery = query;
    const minSim = parseInt(dom.simSlider.value) / 100;

    setStatus(`${t('searching')}: '${query}'...`, true);
    const start = performance.now();

    // 비동기 검색 처리 (UI 블로킹 방지)
    requestAnimationFrame(() => {
        try {
            state.results = search(state.index, query, {
                minSimilarity: minSim,
                maxResults: 5000,
                fuseInstance: state.fuseInstance
            });

            const elapsed = ((performance.now() - start) / 1000).toFixed(3);

            state.filteredResults = [];
            dom.filterInput.value = '';

            renderResults(state.results, query);
            dom.resultsCount.textContent = state.results.length;
            dom.resultsTime.textContent = `(${elapsed}초)`;

            setStatus(`${t('searchComplete')}: ${state.results.length}${t('resultsUnit')} (${elapsed}${t('seconds')})`, false);

            // 최근 검색어 저장
            addRecentKeyword(query);

        } catch (err) {
            logger.error('검색 오류:', err);
            showToast(`⚠️ ${t('searchError')}: ${err.message}`, 'error');
            setStatus(t('searchError'), false);
        }
    });
}

// ── 결과 렌더링 ([v2.2.0] 가상 스크롤링) ──

/**
 * 가상 스크롤 상태 관리
 */
const virtualScroll = {
    ROW_HEIGHT: 36,       // 행 고정 높이 (px)
    BUFFER: 10,           // 뷰포트 위아래 여유 행 수
    allResults: [],       // 전체 결과 (원본)
    visibleResults: [],   // 필터 적용 후 렌더링 대상
    headerList: [],       // 열 목록
    keywords: [],         // 검색 키워드
    scrollRAF: null,      // requestAnimationFrame ID
    lastStart: -1,        // 이전 렌더링 시작 인덱스 (중복 렌더링 방지)
    lastEnd: -1,          // 이전 렌더링 끝 인덱스
    // [v2.8.0] 열 정렬 상태
    sortCol: null,        // 현재 정렬 중인 열 이름 (null = 정렬 없음)
    sortDir: 'asc',       // 정렬 방향 ('asc' | 'desc')
};

/**
 * 결과 테이블의 헤더를 생성하고 가상 스크롤 상태를 초기화합니다.
 * DOM에는 뗤만 렌더링하고 실제 행은 renderVisibleRows()에서 처리.
 */
function renderResults(results, query) {
    if (results.length === 0) {
        dom.resultsToolbar.style.display = 'none';
        dom.resultsTableContainer.style.display = 'none';
        dom.emptyState.style.display = 'flex';
        dom.emptyState.querySelector('.empty-state-title').textContent = t('noResults');
        dom.emptyState.querySelector('.empty-state-text').textContent =
            `'${query}'${t('emptyStateTextQuery')}`;
        return;
    }

    dom.emptyState.style.display = 'none';
    dom.resultsToolbar.style.display = 'flex';
    dom.resultsTableContainer.style.display = 'block';

    // 헤더 생성
    const allHeaders = new Set();
    allHeaders.add(t('metaMatch'));
    allHeaders.add(t('metaFile'));
    allHeaders.add(t('metaSheet'));
    for (const r of results) {
        for (const h of r.row.headers) allHeaders.add(h);
    }
    virtualScroll.headerList = [...allHeaders];

    // [v2.5.1 Fix] 헤더는 tbody 행의 flex 스타일과 동일하게 적용
    // [v2.8.0] 열 정렬 클릭 이벤트 + 정렬 아이콘 표시
    let thead = '<tr style="display:flex;width:100%;">';
    for (const h of virtualScroll.headerList) {
        const isSort = virtualScroll.sortCol === h;
        const icon = isSort ? (virtualScroll.sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅';
        const iconSpan = `<span class="sort-icon" style="opacity:${isSort ? 1 : 0.3};font-size:0.7em;">${icon}</span>`;
        const sortAttr = `data-sort-col="${escapeHtml(h)}"`;
        const cursor = 'cursor:pointer;user-select:none;';
        if (h === t('metaMatch')) {
            thead += `<th ${sortAttr} style="flex:0 0 120px;text-align:left;${cursor}">${escapeHtml(h)}${iconSpan}</th>`;
        } else if (h === t('metaFile')) {
            thead += `<th ${sortAttr} style="flex:0 0 180px;text-align:left;${cursor}">${escapeHtml(h)}${iconSpan}</th>`;
        } else if (h === t('metaSheet')) {
            thead += `<th ${sortAttr} style="flex:0 0 120px;text-align:left;${cursor}">${escapeHtml(h)}${iconSpan}</th>`;
        } else {
            thead += `<th ${sortAttr} style="flex:1;min-width:0;text-align:left;${cursor}">${escapeHtml(h)}${iconSpan}</th>`;
        }
    }
    thead += '</tr>';
    dom.resultsThead.innerHTML = thead;

    // 가상 스크롤 상태 초기화
    virtualScroll.allResults = results;
    virtualScroll.visibleResults = results;
    // [v2.8.0] 정렬 상태 초기화 (새 검색 시 정렬 리셋)
    virtualScroll.sortCol = null;
    virtualScroll.sortDir = 'asc';
    // [v2.5.4] 하이라이트에 순수 키워드 + 열 필터 값 전달 (col:/regex 구문 자체는 제외)
    const parsed = parseQuery(query);
    virtualScroll.keywords = [
        ...parsed.keywords.map(k => k.toLowerCase()),
        ...parsed.columnFilters.map(cf => cf.keyword.toLowerCase())
    ];
    virtualScroll.lastStart = -1;
    virtualScroll.lastEnd = -1;

    // [v2.2.0] tbody를 문서 흐름에서 분리하여 절대 높이로 배치
    // 스크롤 컨테이너가 전체 높이 스페이서를 제공하고
    // tbody는 뷰포트 내 행만 렌더링
    const totalHeight = results.length * virtualScroll.ROW_HEIGHT;
    dom.resultsTbody.style.position = 'relative';
    dom.resultsTbody.style.height = totalHeight + 'px';
    dom.resultsTbody.style.display = 'block';
    dom.resultsTbody.innerHTML = '';

    // 스크롤 이벤트 바인딩 (기존 이벤트 제거 후 재바인딩)
    dom.resultsTableContainer.removeEventListener('scroll', onVirtualScroll);
    dom.resultsTableContainer.addEventListener('scroll', onVirtualScroll, { passive: true });

    // 더블클릭 이벤트 (기존 제거 후 재바인딩)
    dom.resultsTbody.removeEventListener('dblclick', onResultDblClick);
    dom.resultsTbody.addEventListener('dblclick', onResultDblClick);

    // [v2.8.0] 헤더 정렬 클릭 이벤트 (기존 제거 후 재바인딩)
    dom.resultsThead.removeEventListener('click', onTheadSortClick);
    dom.resultsThead.addEventListener('click', onTheadSortClick);

    // 초기 렌더링
    dom.resultsTableContainer.scrollTop = 0;
    renderVisibleRows();
}

/**
 * 스크롤 위치에 따라 뷰포트 내 행만 DOM에 렌더링합니다.
 * 전체 결과 배열에서 보이는 범위의 행만 생성하여
 * DOM 노드 수를 ~50개 이하로 유지합니다.
 */
function renderVisibleRows() {
    const container = dom.resultsTableContainer;
    const results = virtualScroll.visibleResults;
    const rowHeight = virtualScroll.ROW_HEIGHT;
    const buffer = virtualScroll.BUFFER;

    if (results.length === 0) {
        dom.resultsTbody.innerHTML = '';
        return;
    }

    // 스크롤 오프셋에서 thead 높이 만큼 보정
    const theadHeight = dom.resultsThead.offsetHeight || 36;
    const scrollTop = Math.max(0, container.scrollTop - theadHeight);
    const viewportHeight = container.clientHeight;

    // 뷰포트에 보이는 행 범위 계산
    const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
    const endIdx = Math.min(results.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + buffer);

    // 범위가 동일하면 렌더링 생략 (성능 최적화)
    if (startIdx === virtualScroll.lastStart && endIdx === virtualScroll.lastEnd) return;
    virtualScroll.lastStart = startIdx;
    virtualScroll.lastEnd = endIdx;

    const { headerList, keywords } = virtualScroll;
    let html = '';

    for (let i = startIdx; i < endIdx; i++) {
        const r = results[i];
        const top = i * rowHeight;
        // 행을 절대 위치로 배치 (position: absolute)
        html += `<tr data-idx="${i}" style="position:absolute;top:${top}px;left:0;right:0;height:${rowHeight}px;display:flex;align-items:center;">`;

        for (const h of headerList) {
            if (h === t('metaMatch')) {
                const badgeClass = `match-badge--${r.matchType}`;
                const label = matchLabel(r.matchType);
                const simPct = Math.round(r.similarity * 100);
                html += `<td style="flex:0 0 120px;"><span class="match-badge ${badgeClass}">${label} ${simPct}%</span></td>`;
            } else if (h === t('metaFile')) {
                html += `<td class="truncate" title="${escapeHtml(r.row.fileName)}" style="flex:0 0 180px;">${escapeHtml(r.row.fileName)}</td>`;
            } else if (h === t('metaSheet')) {
                html += `<td class="truncate" style="flex:0 0 120px;">${escapeHtml(r.row.sheetName)}</td>`;
            } else {
                const val = r.row.cells[h] || '';
                if (val.length > 200 && keywords.length > 0) {
                    const snippet = buildSnippet(val, keywords, 80);
                    html += `<td class="truncate snippet-cell" title="${escapeHtml(val.slice(0, 500))}..." style="flex:1;min-width:0;">${snippet}</td>`;
                } else {
                    const highlighted = highlightKeywords(val, keywords);
                    html += `<td class="truncate" title="${escapeHtml(val)}" style="flex:1;min-width:0;">${highlighted}</td>`;
                }
            }
        }
        html += '</tr>';
    }

    dom.resultsTbody.innerHTML = html;
}

/**
 * 스크롤 이벤트 핸들러 (requestAnimationFrame으로 스로틀링)
 */
function onVirtualScroll() {
    if (virtualScroll.scrollRAF) return;
    virtualScroll.scrollRAF = requestAnimationFrame(() => {
        virtualScroll.scrollRAF = null;
        renderVisibleRows();
    });
}

/**
 * [v2.8.0] 헤더 th 클릭 → 열 정렬 핸들러
 */
function onTheadSortClick(e) {
    const th = e.target.closest('[data-sort-col]');
    if (!th) return;
    const col = th.dataset.sortCol;

    if (virtualScroll.sortCol === col) {
        if (virtualScroll.sortDir === 'asc') {
            virtualScroll.sortDir = 'desc';
        } else {
            // 3번째 클릭: 원래 순서로 복원
            virtualScroll.sortCol = null;
            virtualScroll.sortDir = 'asc';
        }
    } else {
        virtualScroll.sortCol = col;
        virtualScroll.sortDir = 'asc';
    }
    applySort();
}

/**
 * [v2.8.0] visibleResults를 sortCol/sortDir에 따라 정렬 후 재렌더링
 * 숫자를 숫자로, 그 외는 문자열로 비교 (자연 정렬)
 */
function applySort() {
    const { sortCol, sortDir } = virtualScroll;

    if (!sortCol) {
        // 정렬 해제: 원본 순서 (검색 스코어 순)
        // allResults에서 현재 필터 상태를 유지하여 복원
        const filterText = dom.filterInput ? dom.filterInput.value.toLowerCase().trim() : '';
        if (filterText) {
            virtualScroll.visibleResults = virtualScroll.allResults.filter(r => {
                const rowText = Object.values(r.row.cells).join(' ').toLowerCase();
                return rowText.includes(filterText);
            });
        } else {
            virtualScroll.visibleResults = [...virtualScroll.allResults];
        }
    } else {
        const metaMatch = t('metaMatch');
        const metaFile = t('metaFile');
        const metaSheet = t('metaSheet');

        // 정렬용 값 추출 함수
        const getVal = (r) => {
            if (sortCol === metaMatch) return r.similarity;
            if (sortCol === metaFile) return r.row.fileName || '';
            if (sortCol === metaSheet) return r.row.sheetName || '';
            return r.row.cells[sortCol] || '';
        };

        virtualScroll.visibleResults = [...virtualScroll.visibleResults].sort((a, b) => {
            const va = getVal(a);
            const vb = getVal(b);
            let cmp;
            // 숫자인지 확인 (similarity는 항상 숫자)
            const na = parseFloat(va);
            const nb = parseFloat(vb);
            if (!isNaN(na) && !isNaN(nb)) {
                cmp = na - nb;
            } else {
                // 문자열 자연 정렬 (한국어 포함)
                cmp = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' });
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }

    // 헤더 아이콘 갱신
    dom.resultsThead.querySelectorAll('[data-sort-col]').forEach(th => {
        const col = th.dataset.sortCol;
        const icon = th.querySelector('.sort-icon');
        if (!icon) return;
        if (col === virtualScroll.sortCol) {
            icon.textContent = virtualScroll.sortDir === 'asc' ? ' ▲' : ' ▼';
            icon.style.opacity = '1';
        } else {
            icon.textContent = ' ⇅';
            icon.style.opacity = '0.3';
        }
    });

    // 가상 스크롤 높이 재계산 + 상단으로 스크롤 + 재렌더링
    const totalHeight = virtualScroll.visibleResults.length * virtualScroll.ROW_HEIGHT;
    dom.resultsTbody.style.height = totalHeight + 'px';
    virtualScroll.lastStart = -1;
    virtualScroll.lastEnd = -1;
    dom.resultsTableContainer.scrollTop = 0;
    renderVisibleRows();
}

/**
 * 결과 행 더블클릭 → 상세 보기
 */
function onResultDblClick(e) {
    const tr = e.target.closest('tr');
    if (!tr) return;
    const idx = parseInt(tr.dataset.idx);
    if (!isNaN(idx) && virtualScroll.visibleResults[idx]) {
        openDetailModal(virtualScroll.visibleResults[idx]);
    }
}

// ── 결과 내 필터링 ([v2.2.0] 가상 스크롤 연동) ──
function applyResultFilter() {
    const filterText = dom.filterInput.value.toLowerCase().trim();

    if (!filterText) {
        // 필터 해제: 전체 결과 다시 표시
        virtualScroll.visibleResults = virtualScroll.allResults;
        state.filteredResults = [];
        dom.resultsCount.textContent = virtualScroll.allResults.length;
    } else {
        // 필터 적용: 일치하는 결과만 유지
        state.filteredResults = virtualScroll.allResults.filter(r => {
            const rowText = Object.values(r.row.cells).join(' ').toLowerCase();
            return rowText.includes(filterText);
        });
        virtualScroll.visibleResults = state.filteredResults;
        dom.resultsCount.textContent = state.filteredResults.length;
    }

    // 가상 스크롤 높이 재계산 + 렌더링
    const totalHeight = virtualScroll.visibleResults.length * virtualScroll.ROW_HEIGHT;
    dom.resultsTbody.style.height = totalHeight + 'px';
    virtualScroll.lastStart = -1;
    virtualScroll.lastEnd = -1;
    dom.resultsTableContainer.scrollTop = 0;
    renderVisibleRows();
}

/**
 * [v2.8.0] ↑↓ 방향키로 결과 행을 탐색합니다.
 * 포커스된 행을 CSS 클래스로 강조하고 뷰포트 내로 자동 스크롤합니다.
 * @param {number} delta - 이동 방향 (+1: 아래, -1: 위)
 */
function navigateResults(delta) {
    const results = virtualScroll.visibleResults;
    if (results.length === 0) return;

    // 현재 포커스된 행 인덱스 파악 (없으면 -1)
    const sel = dom.resultsTbody.querySelector('tr.row-focused');
    let curIdx = sel ? parseInt(sel.dataset.idx) : -1;

    // 새 인덱스 계산 (경계 처리)
    let nextIdx = curIdx + delta;
    if (nextIdx < 0) nextIdx = 0;
    if (nextIdx >= results.length) nextIdx = results.length - 1;

    // 해당 행이 뷰포트에 들어오도록 스크롤
    const container = dom.resultsTableContainer;
    const theadHeight = dom.resultsThead.offsetHeight || 36;
    const rowHeight = virtualScroll.ROW_HEIGHT;
    const rowTop = nextIdx * rowHeight + theadHeight;
    const rowBot = rowTop + rowHeight;
    const visTop = container.scrollTop;
    const visBot = visTop + container.clientHeight;

    if (rowTop < visTop) {
        container.scrollTop = rowTop - theadHeight;
    } else if (rowBot > visBot) {
        container.scrollTop = rowBot - container.clientHeight;
    }

    // renderVisibleRows 호출 후 포커스 클래스 부여
    renderVisibleRows();
    dom.resultsTbody.querySelectorAll('tr').forEach(tr => {
        tr.classList.toggle('row-focused', parseInt(tr.dataset.idx) === nextIdx);
    });
}

// ── 파일 트리 렌더링 ──
function renderFileTree() {
    let html = '';
    for (const [fileKey, info] of state.files) {
        const displayName = info.displayName || fileKey;
        const statusIcon = info.status === 'ready' ? '✅' :
            info.status === 'indexing' ? '⏳' :
                info.status === 'error' ? '❌' : '📄';
        const extIcon = displayName.endsWith('.csv') ? '📊' :
            displayName.endsWith('.xls') ? '📗' :
                displayName.endsWith('.pdf') ? '📄' :
                    displayName.endsWith('.docx') ? '📝' : '📘';

        html += `
      <li class="file-tree-item" data-file="${escapeHtml(fileKey)}">
        <span class="file-icon">${extIcon}</span>
        <span class="file-name truncate" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>
        <span style="font-size:10px;color:var(--text-tertiary)">${statusIcon}</span>
        <span class="file-remove" data-remove="${escapeHtml(fileKey)}" title="제거">✕</span>
      </li>
    `;

        for (const sheet of info.sheets) {
            html += `
        <li class="file-tree-sheet">
          <span style="opacity:0.4">└</span> 📋 ${escapeHtml(sheet)}
        </li>
      `;
        }
    }

    dom.fileTree.innerHTML = html;

    // 제거 버튼
    dom.fileTree.querySelectorAll('.file-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const fileKey = btn.dataset.remove;
            removeFile(fileKey);
        });
    });
}

/**
 * [v1.1.4] 파일 제거 — 좀비 워커 종료 + 인덱스/캐시 정리
 */
function removeFile(fileKey) {
    const fileInfo = state.files.get(fileKey);
    if (!fileInfo) return;

    // [v1.1.4] 실행 중인 워커가 있으면 즉시 종료 (좀비 워커 방지)
    if (fileInfo.worker) {
        fileInfo.worker.terminate();
        fileInfo.worker = null;
        logger.info(`워커 종료: ${fileInfo.displayName}`);
    }

    state.index.removeFile(fileKey);
    if (fileInfo.file) {
        cache.removeFileCache(fileInfo.displayName, fileInfo.file.lastModified, fileInfo.file.size);
    }
    state.files.delete(fileKey);

    if (state.files.size === 0) {
        dom.fileTree.style.display = 'none';
        dom.uploadContainer.style.display = 'flex';
    }

    renderFileTree();
    updateStats();
    // [v1.1.5 Fix] Fuse.js 사전 갱신 — 삭제된 파일의 어휘가 퍼지 검색에 좀비로 남지 않도록
    updateFuseInstance();
    showToast(`🗑️ ${fileInfo.displayName} ${t('removeFile')}`, 'info');
    // [v2.1.0] 파일 제거 시 현재 세션 갱신
    if (state.files.size > 0) {
        saveCurrentSession();
    }
    renderSessionHistory();
}

// ── [v2.1.0] 세션 히스토리 ── //

/**
 * 세션 히스토리 최대 보관 수 (localStorage 용량 제한 방지)
 */
const MAX_SESSIONS = 20;
const SESSION_STORAGE_KEY = 'gridsonar_sessions';

/**
 * localStorage에서 저장된 세션 목록을 읽어옵니다.
 * @returns {Array} 세션 배열
 */
function getSessions() {
    try {
        const raw = localStorage.getItem(SESSION_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/**
 * 세션 목록을 localStorage에 저장합니다.
 * @param {Array} sessions - 세션 배열
 */
function saveSessions(sessions) {
    // 최대 수 제한: 오래된 순으로 초과분 제거
    while (sessions.length > MAX_SESSIONS) {
        sessions.pop();
    }
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
}

/**
 * 현재 로드된 파일들을 하나의 세션으로 저장합니다.
 * 동일 파일 구성이면 기존 세션을 갱신, 아니면 신규 생성.
 */
function saveCurrentSession() {
    if (state.files.size === 0) return;

    // 파일 메타 정보 수집 (File 객체는 저장 불가 → 메타만 추출)
    const files = [];
    for (const [fileKey, info] of state.files) {
        // 에러 상태 파일은 세션에 포함하지 않음
        if (info.status === 'error') continue;
        const parts = fileKey.split('__');
        files.push({
            fileKey,
            fileName: info.displayName,
            lastModified: parseInt(parts[1]) || 0,
            fileSize: parseInt(parts[2]) || 0
        });
    }

    if (files.length === 0) return;

    const sessions = getSessions();
    const now = new Date();
    const title = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 동일한 파일 구성의 세션이 있는지 확인 (fileKey 집합 비교)
    const currentKeySet = new Set(files.map(f => f.fileKey));
    const existingIdx = sessions.findIndex(s => {
        if (s.files.length !== currentKeySet.size) return false;
        return s.files.every(f => currentKeySet.has(f.fileKey));
    });

    if (existingIdx >= 0) {
        // 기존 세션 갱신 (제목, 시각, 파일 목록)
        sessions[existingIdx].title = `${title} (${files.length}${t('sessionFiles')})`;
        sessions[existingIdx].updatedAt = now.toISOString();
        sessions[existingIdx].files = files;
        // 최신으로 끌어올리기
        const [updated] = sessions.splice(existingIdx, 1);
        sessions.unshift(updated);
    } else {
        // 신규 세션 생성
        sessions.unshift({
            id: String(Date.now()),
            title: `${title} (${files.length}${t('sessionFiles')})`,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            files
        });
    }

    saveSessions(sessions);
    renderSessionHistory();
    logger.info(`세션 저장: ${files.length}개 파일`);
}

/**
 * 세션을 삭제합니다.
 * @param {string} sessionId - 세션 ID
 */
function deleteSession(sessionId) {
    const sessions = getSessions().filter(s => s.id !== sessionId);
    saveSessions(sessions);
    renderSessionHistory();
    showToast(t('sessionDeleted'), 'info');
}

/**
 * 세션을 복원합니다.
 * 현재 작업을 초기화한 뒤 IndexedDB 캐시에서 데이터를 직접 복원합니다.
 * 원본 파일 없이 1~2초 내에 검색 가능 상태로 전환됩니다.
 * @param {string} sessionId - 세션 ID
 */
async function restoreSession(sessionId) {
    const sessions = getSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    setStatus(t('sessionRestoring'), true, 10);

    // 1단계: 현재 상태 초기화 (인덱스/파일트리만 — IndexedDB 캐시는 유지)
    state.index = new SearchIndex();
    state.fuseInstance = null;
    state.results = [];
    state.filteredResults = [];
    state.currentQuery = '';
    // 기존 워커 종료
    for (const [, info] of state.files) {
        if (info.worker) {
            info.worker.terminate();
            info.worker = null;
        }
    }
    state.files.clear();

    // UI 전환
    dom.dropzone.style.display = 'none';
    dom.fileTree.style.display = 'block';

    // 2단계: 세션 파일별 IndexedDB 캐시 복원
    let restoredCount = 0;
    let lostCount = 0;
    const totalFiles = session.files.length;

    state.indexingJobs++;

    for (let fi = 0; fi < totalFiles; fi++) {
        const fileMeta = session.files[fi];
        const { fileKey, fileName, lastModified, fileSize } = fileMeta;

        // 파일 트리에 항목 등록 (File 객체 없이 메타만)
        state.files.set(fileKey, {
            file: null, // 원본 File 객체 없음
            fileKey,
            displayName: fileName,
            path: fileName,
            status: 'pending',
            sheets: [],
            totalRows: 0,
            worker: null,
            errorReason: null
        });
        renderFileTree();

        // 캐시 확인
        const cached = await cache.isFileCached(fileName, lastModified, fileSize);
        if (!cached) {
            // 캐시 유실 — 경고 상태로 표시
            const info = state.files.get(fileKey);
            if (info) {
                info.status = 'error';
                info.errorReason = t('sessionCacheLost');
            }
            lostCount++;
            renderFileTree();
            continue;
        }

        // 고속 복원: IndexedDB → SearchIndex 직접 적재
        const fileInfo = state.files.get(fileKey);
        let totalCells = 0;
        const restored = await cache.loadFileData(fileName, lastModified, fileSize, (chunk, headers) => {
            restoreCacheChunk(fileKey, fileName, chunk, headers);
            totalCells += chunk.length;
        });

        if (restored) {
            fileInfo.status = 'ready';
            fileInfo.totalRows = totalCells || restored.totalCells || 0;
            restoredCount++;
        } else {
            fileInfo.status = 'error';
            fileInfo.errorReason = t('sessionCacheLost');
            lostCount++;
        }

        renderFileTree();
        const pct = Math.round(10 + ((fi + 1) / totalFiles * 80));
        setStatus(`${t('sessionRestoring')} (${fi + 1}/${totalFiles})`, true, pct);
    }

    // 3단계: BM25 + Fuse.js 재구축
    if (restoredCount > 0) {
        setStatus(t('loadingBM25'), true, 95);
        await new Promise(resolve => setTimeout(() => {
            state.index.buildBM25();
            resolve();
        }, 0));
        await updateFuseInstance();
    }

    state.indexingJobs--;
    updateStats();
    renderFileTree();

    // 결과 보고
    if (lostCount > 0) {
        showToast(`${t('sessionRestored')} (${restoredCount}/${totalFiles}). ${lostCount}${t('sessionFiles')} ${t('sessionCacheLost')}`, 'warning');
    } else {
        showToast(`⚡ ${t('sessionRestored')} (${restoredCount}${t('sessionFiles')})`, 'success');
    }
    setStatus(`✅ ${t('sessionRestored')} (${restoredCount}${t('sessionFiles')})`, false);
    logger.info(`세션 복원 완료: ${restoredCount}개 성공, ${lostCount}개 유실`);
}

/**
 * 세션 히스토리 UI를 렌더링합니다.
 */
function renderSessionHistory() {
    if (!dom.sessionList) return;

    const sessions = getSessions();

    if (sessions.length === 0) {
        dom.sessionList.innerHTML = `<li class="session-empty">${t('sessionEmpty')}</li>`;
        return;
    }

    let html = '';
    for (const session of sessions) {
        const fileCount = session.files.length;
        const date = session.updatedAt
            ? new Date(session.updatedAt).toLocaleString()
            : new Date(session.createdAt).toLocaleString();

        html += `
      <li class="session-item" data-session-id="${session.id}">
        <span class="session-item-icon">📋</span>
        <div class="session-item-info">
          <span class="session-item-title">${escapeHtml(session.title)}</span>
          <span class="session-item-meta">${date}</span>
        </div>
        <div class="session-item-actions">
          <button class="session-action-btn" data-action="restore" data-session-id="${session.id}" title="${t('sessionRestore')}">▶</button>
          <button class="session-action-btn session-action-btn--danger" data-action="delete" data-session-id="${session.id}" title="${t('sessionDelete')}">✕</button>
        </div>
      </li>
    `;
    }

    dom.sessionList.innerHTML = html;

    // 이벤트 바인딩: 복원
    dom.sessionList.querySelectorAll('[data-action="restore"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            // [v2.5.2 Fix] Race Condition 방지: 인덱싱/복원 중 중복 클릭 차단
            if (state.isIndexing) {
                showToast(t('loadingIndexing'), 'warning');
                return;
            }
            const id = btn.dataset.sessionId;
            // 현재 파일이 있으면 확인 대화
            if (state.files.size > 0) {
                if (!confirm(t('sessionConfirmRestore'))) return;
            }
            restoreSession(id);
        });
    });

    // 이벤트 바인딩: 삭제
    dom.sessionList.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.sessionId;
            if (confirm(t('sessionConfirmDelete'))) {
                deleteSession(id);
            }
        });
    });

    // 세션 아이템 전체 클릭 = 복원
    dom.sessionList.querySelectorAll('.session-item').forEach(item => {
        item.addEventListener('click', () => {
            // [v2.5.2 Fix] Race Condition 방지: 인덱싱/복원 중 중복 클릭 차단
            if (state.isIndexing) {
                showToast(t('loadingIndexing'), 'warning');
                return;
            }
            const id = item.dataset.sessionId;
            if (state.files.size > 0) {
                if (!confirm(t('sessionConfirmRestore'))) return;
            }
            restoreSession(id);
        });
    });
}

// ── 상세 보기 모달 ──
function openDetailModal(result) {
    dom.modalTitle.textContent = `${result.row.fileName} / ${result.row.sheetName} (행 ${result.row.rowIdx + 1})`;

    let html = '<table>';
    for (const header of result.row.headers) {
        const val = result.row.cells[header] || '';
        html += `<tr><th>${escapeHtml(header)}</th><td>${escapeHtml(val)}</td></tr>`;
    }
    html += '</table>';

    // 매칭 정보
    if (result.matches && result.matches.length > 0) {
        html += '<div style="margin-top:var(--space-lg);">';
        html += `<h4 style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-sm);">${t('matchDetail') || '매칭 상세'}</h4>`;
        for (const m of result.matches) {
            const badgeClass = `match-badge--${m.matchType}`;
            const label = matchLabel(m.matchType);
            html += `<div style="margin-bottom:4px;">
        <span class="match-badge ${badgeClass}">${label}</span>
        <strong>${escapeHtml(m.colName)}</strong>: ${escapeHtml(m.cellValue)}
        <span style="color:var(--text-tertiary)">(${Math.round(m.similarity * 100)}%)</span>
      </div>`;
        }
        html += '</div>';
    }

    dom.modalBody.innerHTML = html;
    dom.detailModal.style.display = 'flex';
}

function closeDetailModal() {
    dom.detailModal.style.display = 'none';
}

// ── 검색 자동완성 ──

/**
 * [v2.9.0] 검색창 입력에 따라 자동완성 드롭다운을 표시합니다.
 * - 빈 입력: 최근 검색어 전체
 * - 타이핑 중: 매칭 최근 검색어 + 로드된 열 이름 col: 제안
 * @param {string} rawVal - 검색창 현재 값 (trim 미적용)
 */
function showAutoComplete(rawVal) {
    const val = rawVal.trim().toLowerCase();
    const items = [];

    if (!val) {
        // 빈 입력: 최근 검색어만 표시
        for (const kw of state.recentKeywords) {
            items.push({ icon: '🕐', label: kw, keyword: kw, type: 'history' });
        }
    } else {
        // 최근 검색어 필터링
        for (const kw of state.recentKeywords) {
            if (kw.toLowerCase().includes(val)) {
                items.push({ icon: '🕐', label: kw, keyword: kw, type: 'history' });
            }
        }
        // 현재 로드된 파일의 열 이름 수집 (중복 제거)
        const colSet = new Set();
        for (const [, info] of state.files) {
            if (info.headers) {
                for (const [sheetName, headers] of Object.entries(info.headers)) {
                    for (const h of headers) {
                        // 입력값이 col: 형식이면 열 이름만 비교, 아니면 전체 비교
                        const colQuery = val.startsWith('col:') ? val.slice(4) : val;
                        if (h.toLowerCase().includes(colQuery) && !colSet.has(h)) {
                            colSet.add(h);
                        }
                    }
                }
            }
        }
        // 열 이름 제안 (col:NAME 형식)
        for (const col of [...colSet].slice(0, 8)) {
            // 이미 col: 입력 중이면 바로 col:NAME, 아니면 col:NAME 제안
            const keyword = `col:${col}`;
            items.push({ icon: '📋', label: `col:${col}`, keyword, type: 'column', sub: '열 검색' });
        }
    }

    if (items.length === 0) {
        hideSearchHistory();
        return;
    }

    // 섹션 구분 (history → column 전환 지점)
    let html = '';
    let lastType = null;
    for (const item of items) {
        if (lastType && lastType !== item.type) {
            html += '<div class="ac-divider"></div>';
        }
        lastType = item.type;
        const subHtml = item.sub ? `<span class="ac-sub">${escapeHtml(item.sub)}</span>` : '';
        html += `<div class="search-history-item" data-keyword="${escapeHtml(item.keyword)}" data-type="${item.type}">
            <span class="history-icon">${item.icon}</span>
            <span class="ac-label">${escapeHtml(item.label)}</span>
            ${subHtml}
        </div>`;
    }
    dom.searchHistory.innerHTML = html;
    dom.searchHistory.classList.add('visible');

    dom.searchHistory.querySelectorAll('.search-history-item').forEach(el => {
        el.addEventListener('click', () => {
            dom.searchInput.value = el.dataset.keyword;
            hideSearchHistory();
            performSearch();
        });
    });
}

/**
 * [v2.9.0] ↑↓ 키로 자동완성 드롭다운 항목을 탐색합니다.
 * @param {number} delta - 이동 방향 (+1: 아래, -1: 위)
 */
function navigateAutoComplete(delta) {
    const items = [...dom.searchHistory.querySelectorAll('.search-history-item')];
    if (items.length === 0) return;
    const cur = dom.searchHistory.querySelector('.ac-focused');
    let idx = cur ? items.indexOf(cur) : -1;
    items.forEach(el => el.classList.remove('ac-focused'));
    idx = Math.max(0, Math.min(items.length - 1, idx + delta));
    items[idx].classList.add('ac-focused');
    items[idx].scrollIntoView({ block: 'nearest' });
}

function showSearchHistory() {
    showAutoComplete(dom.searchInput ? dom.searchInput.value : '');
}

function hideSearchHistory() {
    dom.searchHistory.classList.remove('visible');
}

function addRecentKeyword(keyword) {
    state.recentKeywords = state.recentKeywords.filter(k => k !== keyword);
    state.recentKeywords.unshift(keyword);
    state.recentKeywords = state.recentKeywords.slice(0, 10);
    setConfig('recentKeywords', state.recentKeywords);
}

// ── 테마 ──
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    dom.btnTheme.textContent = next === 'dark' ? '☀️' : '🌙';
    setConfig('theme', next);
}

// ── 리사이즈 핸들 ──
function initResizeHandle() {
    const handle = $('resize-handle');
    const sidebar = $('sidebar');
    let isResizing = false;

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        handle.classList.add('active');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const newWidth = Math.min(Math.max(e.clientX, 180), 450);
        sidebar.style.width = `${newWidth}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            handle.classList.remove('active');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// ── 상태 표시 ──
function setStatus(text, showProgress = false, percent = -1) {
    dom.statusText.textContent = text;
    dom.progressBar.style.display = showProgress ? 'block' : 'none';
    if (percent >= 0) {
        dom.progressFill.style.width = `${percent}%`;
    } else if (showProgress) {
        // 인디터미네이트 모드
        dom.progressFill.style.width = '100%';
    }
}

function updateStats() {
    const files = state.index.totalFiles;
    const rows = state.index.totalRows;
    const cells = state.index.totalCells;

    dom.searchStats.innerHTML = `
    <span class="search-stats-badge">📁 ${files}</span>
    <span class="search-stats-badge">📋 ${rows.toLocaleString()}</span>
  `;
    dom.statusStats.textContent = `${files}${t('files')} · ${rows.toLocaleString()}${t('rows')} · ${cells.toLocaleString()}${t('cells')}`;

    // [v1.2.1] 에러 파일이 있을 경우 추출 버튼 표시
    let errorCount = 0;
    for (const info of state.files.values()) {
        if (info.status === 'error') errorCount++;
    }
    const hasErrors = errorCount > 0;
    if (dom.btnExportErrors) dom.btnExportErrors.style.display = hasErrors ? 'inline-flex' : 'none';
    if (dom.btnExportErrorsSidebar) {
        dom.btnExportErrorsSidebar.style.display = hasErrors ? 'inline-flex' : 'none';
        dom.btnExportErrorsSidebar.textContent = `⚠️ N/A`.replace('N/A', errorCount);
    }
}

// ── 토스트 ──
function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 350);
    }, duration);
}

// ── 유틸리티 ──
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function highlightKeywords(text, keywords) {
    if (!text || keywords.length === 0) return escapeHtml(text);

    let escaped = escapeHtml(text);
    for (const kw of keywords) {
        if (!kw) continue;
        const regex = new RegExp(`(${escapeRegex(kw)})`, 'gi');
        escaped = escaped.replace(regex, '<span class="highlight">$1</span>');
    }
    return escaped;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * [v2.0.0] 긴 텍스트에서 키워드 주변 스니펫을 생성합니다.
 * PDF/DOCX 문서 검색 결과에서 핵심 문맥만 추출하여 표시합니다.
 * @param {string} text - 원본 텍스트
 * @param {string[]} keywords - 검색 키워드 배열
 * @param {number} contextLen - 키워드 앞뒤 문맥 길이
 * @returns {string} - 하이라이트된 HTML 스니펫
 */
function buildSnippet(text, keywords, contextLen = 80) {
    const lower = text.toLowerCase();
    let bestIdx = -1;

    // 첫 번째로 매칭되는 키워드 위치 찾기
    for (const kw of keywords) {
        if (!kw) continue;
        const idx = lower.indexOf(kw.toLowerCase());
        if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
            bestIdx = idx;
        }
    }

    if (bestIdx === -1) {
        // 키워드를 찾지 못리면 앞에서 자른 텍스트 표시
        const preview = text.slice(0, contextLen * 2);
        return escapeHtml(preview) + (text.length > contextLen * 2 ? '...' : '');
    }

    const start = Math.max(0, bestIdx - contextLen);
    const end = Math.min(text.length, bestIdx + contextLen * 2);
    const slice = text.slice(start, end);

    const prefix = start > 0 ? '...' : '';
    const suffix = end < text.length ? '...' : '';

    return prefix + highlightKeywords(slice, keywords) + suffix;
}

/**
 * [v2.0.0] 에러 메시지에서 암호 보호 파일 여부를 감지합니다.
 * PDF(pdf.js PasswordException), Excel(SheetJS encrypted), DOCX(mammoth) 등
 * 주요 라이브러리의 암호 관련 에러 패턴을 포괄적으로 커버합니다.
 * @param {string} message - 에러 메시지
 * @returns {boolean} 암호 보호 에러인지 여부
 */
function detectPasswordError(message) {
    if (!message) return false;
    const lower = message.toLowerCase();
    const patterns = [
        'password',          // pdf.js PasswordException
        'encrypted',         // SheetJS "File is password-protected/encrypted"
        'password-protected',// 일반적 표현
        'need a password',   // pdf.js 구체적 메시지
        'incorrect password',// pdf.js 잘못된 비밀번호
        'decryption',        // 복호화 실패
    ];
    return patterns.some(p => lower.includes(p));
}

function matchLabel(type) {
    const key = 'match' + type.charAt(0).toUpperCase() + type.slice(1);
    const val = t(key);
    return val !== key ? val : type;
}

// ── PWA 서비스 워커 ──
/**
 * [v1.1.3 Fix] Service Worker 업데이트 감지
 * 새 버전 설치 시 토스트로 안내만 합니다.
 * 자동 새로고침 제거: skipWaiting + controllerchange 조합으로
 * 사용자 작업 중 강제 리로드되는 UX 파괴 방지.
 * 새 워커는 모든 탭이 닫히면 자동 활성화됩니다.
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        // [v2.7.0] controllerchange → 자동 reload 복원
        // skipWaiting + clients.claim 조합으로 새 SW가 즉시 활성화되므로,
        // controllerchange 발생 시 페이지를 자동 새로고침하여 새 캐시 즉시 적용.
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });

        navigator.serviceWorker.register('sw.js').then(registration => {
            logger.info('Service Worker 등록 성공');

            // 업데이트 감지: 새 워커가 설치될 때
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker) return;

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // skipWaiting이 호출되므로 곧바로 activating → activated 전환됨
                        // controllerchange 핸들러에서 자동 reload 처리
                        logger.info('새 Service Worker 설치 완료, 자동 새로고침 예정');
                    }
                });
            });
        }).catch(err => {
            logger.warn('Service Worker 등록 실패:', err);
        });
    }
}
