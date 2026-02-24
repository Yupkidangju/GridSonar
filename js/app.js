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
import { parseFile } from './core/fileParser.js';
import * as cache from './core/cacheManager.js';
import { getConfig, setConfig } from './utils/config.js';
import { exportResults } from './utils/exporter.js';
import { copyResultsToClipboard } from './utils/clipboard.js';
import { t } from './utils/i18n.js';
import { logger } from './utils/logger.js';

// ── 전역 상태 ──
const state = {
    index: new SearchIndex(),
    files: new Map(),          // fileName → { file, status, sheets }
    results: [],               // 현재 검색 결과
    filteredResults: [],        // 필터링된 결과
    recentKeywords: [],         // 최근 검색어
    isIndexing: false,
    fuseInstance: null,          // Fuse.js 인스턴스 (지연 로드)
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
    logger.info('GridSonar 초기화 완료 (v1.0.0)');
});

function cacheDomRefs() {
    dom.searchInput = $('search-input');
    dom.searchStats = $('search-stats');
    dom.searchHistory = $('search-history');
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
}

function loadSettings() {
    // 테마
    const theme = getConfig('theme', 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    dom.btnTheme.textContent = theme === 'dark' ? '☀️' : '🌙';

    // 최근 검색어
    state.recentKeywords = getConfig('recentKeywords', []);
}

// ── 이벤트 바인딩 ──
function bindEvents() {
    // 검색
    dom.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });
    dom.searchInput.addEventListener('focus', () => showSearchHistory());
    dom.searchInput.addEventListener('input', () => {
        if (!dom.searchInput.value.trim()) showSearchHistory();
        else hideSearchHistory();
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

    // 테마
    dom.btnTheme.addEventListener('click', toggleTheme);

    // 캐시 초기화
    dom.btnClearCache.addEventListener('click', async () => {
        await cache.clearAllCache();
        showToast('🗑️ 캐시가 초기화되었습니다', 'info');
    });

    // 결과 액션
    dom.btnCopy.addEventListener('click', async () => {
        const targets = state.filteredResults.length > 0 ? state.filteredResults : state.results;
        const ok = await copyResultsToClipboard(targets);
        showToast(ok ? `📋 ${targets.length}건 복사 완료` : '⚠️ 복사 실패', ok ? 'success' : 'error');
    });

    dom.btnExportXlsx.addEventListener('click', () => {
        const targets = state.filteredResults.length > 0 ? state.filteredResults : state.results;
        exportResults(targets, 'xlsx');
        showToast(`📤 ${targets.length}건 XLSX 내보내기`, 'success');
    });

    dom.btnExportCsv.addEventListener('click', () => {
        const targets = state.filteredResults.length > 0 ? state.filteredResults : state.results;
        exportResults(targets, 'csv');
        showToast(`📄 ${targets.length}건 CSV 내보내기`, 'success');
    });

    // 결과 내 필터링
    dom.filterInput.addEventListener('input', () => applyResultFilter());

    // 유사도 슬라이더
    dom.simSlider.addEventListener('input', () => {
        dom.simValue.textContent = `${dom.simSlider.value}%`;
    });
    dom.simSlider.addEventListener('change', () => {
        if (state.currentQuery) performSearch();
    });

    // 모달 닫기
    dom.modalClose.addEventListener('click', closeDetailModal);
    dom.detailModal.addEventListener('click', (e) => {
        if (e.target === dom.detailModal) closeDetailModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDetailModal();
    });
}

// ── 파일 처리 ──

// 지원되는 확장자 (소문자)
const SUPPORTED_EXT = new Set(['.xlsx', '.xls', '.csv']);

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
            setStatus('폴더 탐색 중...', true);
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
            ? `⚠️ ${skippedCount}개 파일이 지원되지 않는 형식입니다 (.xlsx, .xls, .csv만 가능)`
            : '⚠️ 지원되지 않는 파일 형식입니다 (.xlsx, .xls, .csv만 가능)';
        showToast(msg, 'warning');
        return;
    }

    if (skippedCount > 0) {
        showToast(`ℹ️ ${skippedCount}개 비지원 파일 제외, ${collectedFiles.length}개 파일 로드`, 'info');
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
 * 파일 배열을 인덱싱합니다.
 * @param {File[]} files
 */
async function handleFileDrop(files) {
    if (files.length === 0) return;

    // UI 전환
    dom.dropzone.style.display = 'none';
    dom.fileTree.style.display = 'block';

    for (const file of files) {
        if (state.files.has(file.name)) continue; // 중복 방지

        state.files.set(file.name, {
            file,
            status: 'pending',
            sheets: [],
            totalRows: 0
        });
        renderFileTree();
        await indexFile(file);
    }
}

async function indexFile(file) {
    const fileInfo = state.files.get(file.name);
    fileInfo.status = 'indexing';
    renderFileTree();

    state.isIndexing = true;
    setStatus(`인덱싱 중: ${file.name}`, true);

    // 캐시 확인
    const cached = await cache.isFileCached(file.name, file.lastModified, file.size);
    if (cached) {
        const restored = await cache.loadFileData(file.name, file.lastModified, file.size);
        if (restored && restored.cells && restored.cells.length > 0) {
            // 캐시에서 복원
            restoreFromCache(file.name, restored);
            fileInfo.status = 'ready';
            fileInfo.totalRows = restored.cells.length;
            renderFileTree();
            updateStats();
            setStatus(`✅ 캐시에서 복원: ${file.name}`, false);
            showToast(`⚡ ${file.name} 캐시에서 복원`, 'success');
            state.isIndexing = false;
            finishIndexing();
            return;
        }
    }

    // 직접 파싱 및 인덱싱
    const cellsForCache = [];
    const headersForCache = {};
    let totalRows = 0;

    try {
        await parseFile(file, {
            onChunk(chunkData) {
                const { sheetName, headers, rows, offset } = chunkData;

                // 인덱스에 추가
                state.index.addDataChunk(file.name, file.name, sheetName, headers, rows, offset);

                // 시트 목록 갱신
                if (!fileInfo.sheets.includes(sheetName)) {
                    fileInfo.sheets.push(sheetName);
                }

                // 캐시용 데이터 수집
                if (!headersForCache[sheetName]) {
                    headersForCache[sheetName] = headers;
                }
                for (let ri = 0; ri < rows.length; ri++) {
                    for (let ci = 0; ci < headers.length; ci++) {
                        const val = rows[ri][ci];
                        if (val && val !== '' && val !== 'nan' && val !== 'None' && val !== 'undefined') {
                            cellsForCache.push({
                                sheetName,
                                rowIdx: offset + ri,
                                colIdx: ci,
                                colName: headers[ci],
                                value: val
                            });
                        }
                    }
                }

                totalRows += rows.length;
                renderFileTree();
            },

            onProgress(message, percent) {
                setStatus(message, true, percent);
            },

            onComplete(total) {
                fileInfo.status = 'ready';
                fileInfo.totalRows = total;
                renderFileTree();
            },

            onError(message) {
                fileInfo.status = 'error';
                renderFileTree();
                showToast(`⚠️ ${message}`, 'error');
                logger.error(message);
            }
        });

        // BM25 인덱스 구축
        setStatus('BM25 인덱스 구축 중...', true, 95);
        // 비동기로 BM25 구축 (UI 블로킹 방지)
        await new Promise(resolve => setTimeout(() => {
            state.index.buildBM25();
            resolve();
        }, 0));

        // 캐시에 저장
        if (cellsForCache.length > 0) {
            cache.saveFileData({
                fileName: file.name,
                lastModified: file.lastModified,
                fileSize: file.size,
                cells: cellsForCache,
                headers: headersForCache
            });
        }

        // Fuse.js 인스턴스 갱신
        await updateFuseInstance();

        updateStats();
        setStatus(`✅ 인덱싱 완료: ${file.name} (${totalRows.toLocaleString()}행)`, false);
        showToast(`✅ ${file.name} 인덱싱 완료 (${totalRows.toLocaleString()}행)`, 'success');

    } catch (err) {
        fileInfo.status = 'error';
        renderFileTree();
        showToast(`⚠️ 인덱싱 실패: ${file.name}`, 'error');
        logger.error('인덱싱 실패:', err);
    }

    state.isIndexing = false;
    finishIndexing();
}

function restoreFromCache(fileName, data) {
    const headers = data.headers || {};

    // 셀을 시트별/행별로 그룹핑
    const sheetsData = {};
    for (const cell of data.cells) {
        const sheet = cell.sheetName;
        if (!sheetsData[sheet]) sheetsData[sheet] = {};
        if (!sheetsData[sheet][cell.rowIdx]) sheetsData[sheet][cell.rowIdx] = {};
        sheetsData[sheet][cell.rowIdx][cell.colName] = cell.value;
    }

    for (const [sheetName, rowsMap] of Object.entries(sheetsData)) {
        const hdrs = headers[sheetName] || [];
        if (hdrs.length === 0) continue;

        const sortedRows = Object.keys(rowsMap).map(Number).sort((a, b) => a - b);
        const rows = sortedRows.map(rowIdx => {
            const rowDict = rowsMap[rowIdx];
            return hdrs.map(h => rowDict[h] || '');
        });

        if (rows.length > 0) {
            const minRow = sortedRows[0];
            state.index.addDataChunk(fileName, fileName, sheetName, hdrs, rows, minRow);
        }

        const fileInfo = state.files.get(fileName);
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

    if (state.index.totalCells === 0) {
        showToast('📂 먼저 파일을 추가하고 인덱싱을 완료해 주세요', 'warning');
        return;
    }

    state.currentQuery = query;
    const minSim = parseInt(dom.simSlider.value) / 100;

    setStatus(`검색 중: '${query}'...`, true);
    const start = performance.now();

    // 비동기 검색 처리 (UI 블로킹 방지)
    requestAnimationFrame(() => {
        try {
            state.results = search(state.index, query, {
                minSimilarity: minSim,
                maxResults: 500,
                fuseInstance: state.fuseInstance
            });

            const elapsed = ((performance.now() - start) / 1000).toFixed(3);

            state.filteredResults = [];
            dom.filterInput.value = '';

            renderResults(state.results, query);
            dom.resultsCount.textContent = state.results.length;
            dom.resultsTime.textContent = `(${elapsed}초)`;

            setStatus(`검색 완료: ${state.results.length}건 (${elapsed}초)`, false);

            // 최근 검색어 저장
            addRecentKeyword(query);

        } catch (err) {
            logger.error('검색 오류:', err);
            showToast(`⚠️ 검색 오류: ${err.message}`, 'error');
            setStatus('검색 오류', false);
        }
    });
}

// ── 결과 렌더링 ──
function renderResults(results, query) {
    if (results.length === 0) {
        dom.resultsToolbar.style.display = 'none';
        dom.resultsTableContainer.style.display = 'none';
        dom.emptyState.style.display = 'flex';
        dom.emptyState.querySelector('.empty-state-title').textContent = '검색 결과 없음';
        dom.emptyState.querySelector('.empty-state-text').textContent =
            `'${query}'에 대한 결과를 찾을 수 없습니다.\n다른 검색어를 시도해 보세요.`;
        return;
    }

    dom.emptyState.style.display = 'none';
    dom.resultsToolbar.style.display = 'flex';
    dom.resultsTableContainer.style.display = 'block';

    // 헤더 생성
    const allHeaders = new Set();
    allHeaders.add('_매칭');
    allHeaders.add('_파일');
    allHeaders.add('_시트');
    for (const r of results) {
        for (const h of r.row.headers) allHeaders.add(h);
    }
    const headerList = [...allHeaders];

    let thead = '<tr>';
    for (const h of headerList) {
        thead += `<th>${escapeHtml(h)}</th>`;
    }
    thead += '</tr>';
    dom.resultsThead.innerHTML = thead;

    // 가상 스크롤링 대신 제한된 렌더링 (500건 이하)
    const displayResults = results.slice(0, 500);
    const keywords = query.toLowerCase().split(/\s+/).filter(k => !k.startsWith('-'));

    let tbody = '';
    for (let i = 0; i < displayResults.length; i++) {
        const r = displayResults[i];
        tbody += `<tr data-idx="${i}" class="fade-in" style="animation-delay:${Math.min(i * 10, 300)}ms">`;

        for (const h of headerList) {
            if (h === '_매칭') {
                const badgeClass = `match-badge--${r.matchType}`;
                const label = matchLabel(r.matchType);
                const simPct = Math.round(r.similarity * 100);
                tbody += `<td><span class="match-badge ${badgeClass}">${label} ${simPct}%</span></td>`;
            } else if (h === '_파일') {
                tbody += `<td class="truncate" title="${escapeHtml(r.row.fileName)}">${escapeHtml(r.row.fileName)}</td>`;
            } else if (h === '_시트') {
                tbody += `<td class="truncate">${escapeHtml(r.row.sheetName)}</td>`;
            } else {
                const val = r.row.cells[h] || '';
                const highlighted = highlightKeywords(val, keywords);
                tbody += `<td class="truncate" title="${escapeHtml(val)}">${highlighted}</td>`;
            }
        }
        tbody += '</tr>';
    }

    dom.resultsTbody.innerHTML = tbody;

    // 더블 클릭 → 상세 보기
    dom.resultsTbody.addEventListener('dblclick', (e) => {
        const tr = e.target.closest('tr');
        if (!tr) return;
        const idx = parseInt(tr.dataset.idx);
        if (!isNaN(idx) && displayResults[idx]) {
            openDetailModal(displayResults[idx]);
        }
    });
}

// ── 결과 내 필터링 ──
function applyResultFilter() {
    const filterText = dom.filterInput.value.toLowerCase().trim();
    if (!filterText) {
        state.filteredResults = [];
        // 모든 행 표시
        const rows = dom.resultsTbody.querySelectorAll('tr');
        rows.forEach(r => r.style.display = '');
        dom.resultsCount.textContent = state.results.length;
        return;
    }

    state.filteredResults = state.results.filter(r => {
        const rowText = Object.values(r.row.cells).join(' ').toLowerCase();
        return rowText.includes(filterText);
    });

    // 행 표시/숨김
    const rows = dom.resultsTbody.querySelectorAll('tr');
    const visibleIndices = new Set(state.filteredResults.map((_, i) => {
        return state.results.indexOf(state.filteredResults[i]);
    }));

    rows.forEach(r => {
        const idx = parseInt(r.dataset.idx);
        r.style.display = visibleIndices.has(idx) ? '' : 'none';
    });

    dom.resultsCount.textContent = state.filteredResults.length;
}

// ── 파일 트리 렌더링 ──
function renderFileTree() {
    let html = '';
    for (const [fileName, info] of state.files) {
        const statusIcon = info.status === 'ready' ? '✅' :
            info.status === 'indexing' ? '⏳' :
                info.status === 'error' ? '❌' : '📄';
        const extIcon = fileName.endsWith('.csv') ? '📊' :
            fileName.endsWith('.xls') ? '📗' : '📘';

        html += `
      <li class="file-tree-item" data-file="${escapeHtml(fileName)}">
        <span class="file-icon">${extIcon}</span>
        <span class="file-name truncate" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</span>
        <span style="font-size:10px;color:var(--text-tertiary)">${statusIcon}</span>
        <span class="file-remove" data-remove="${escapeHtml(fileName)}" title="제거">✕</span>
      </li>
    `;

        // 시트 목록
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
            const fileName = btn.dataset.remove;
            removeFile(fileName);
        });
    });
}

function removeFile(fileName) {
    state.index.removeFile(fileName);
    const fileInfo = state.files.get(fileName);
    if (fileInfo && fileInfo.file) {
        cache.removeFileCache(fileName, fileInfo.file.lastModified, fileInfo.file.size);
    }
    state.files.delete(fileName);

    if (state.files.size === 0) {
        dom.fileTree.style.display = 'none';
        dom.dropzone.style.display = 'block';
    }

    renderFileTree();
    updateStats();
    showToast(`🗑️ ${fileName} 제거됨`, 'info');
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
        html += '<h4 style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-sm);">매칭 상세</h4>';
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

// ── 검색 기록 ──
function showSearchHistory() {
    if (state.recentKeywords.length === 0) return;

    let html = '';
    for (const kw of state.recentKeywords) {
        html += `<div class="search-history-item" data-keyword="${escapeHtml(kw)}">
      <span class="history-icon">🕐</span>
      <span>${escapeHtml(kw)}</span>
    </div>`;
    }
    dom.searchHistory.innerHTML = html;
    dom.searchHistory.classList.add('visible');

    dom.searchHistory.querySelectorAll('.search-history-item').forEach(item => {
        item.addEventListener('click', () => {
            dom.searchInput.value = item.dataset.keyword;
            hideSearchHistory();
            performSearch();
        });
    });
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
    dom.statusStats.textContent = `${files}파일 · ${rows.toLocaleString()}행 · ${cells.toLocaleString()}셀`;
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

function matchLabel(type) {
    return { exact: '정확', fuzzy: '유사', chosung: '초성', range: '범위' }[type] || type;
}

// ── PWA 서비스 워커 ──
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => {
            logger.warn('Service Worker 등록 실패:', err);
        });
    }
}
