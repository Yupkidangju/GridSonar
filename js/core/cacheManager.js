/**
 * [v1.0.0] IndexedDB 캐시 매니저
 * 파일 메타데이터와 셀 데이터를 IndexedDB에 캐싱합니다.
 * 원본: cache.py (IndexCache / SQLite) → IndexedDB (localForage)
 *
 * 캐시 키: File.name + File.lastModified + File.size
 * 앱 재시작 시 엑셀 재로드 없이 인덱스 즉시 복원
 */

// localForage CDN 로드
let localforage = null;

/**
 * localForage를 CDN에서 로드합니다 (최초 1회).
 */
async function loadLocalForage() {
    if (localforage) return localforage;
    const module = await import('https://esm.sh/localforage@1.10.0');
    localforage = module.default || module;
    return localforage;
}

// 스토어 인스턴스 (지연 초기화)
let fileMetaStore = null;
let cellDataStore = null;
let sheetHeaderStore = null;

/**
 * IndexedDB 스토어를 초기화합니다.
 */
async function initStores() {
    const lf = await loadLocalForage();

    fileMetaStore = lf.createInstance({
        name: 'gridsonar',
        storeName: 'file_meta'
    });

    cellDataStore = lf.createInstance({
        name: 'gridsonar',
        storeName: 'cell_data'
    });

    sheetHeaderStore = lf.createInstance({
        name: 'gridsonar',
        storeName: 'sheet_headers'
    });
}

/**
 * 스토어가 초기화되었는지 확인하고, 안되어 있으면 초기화합니다.
 */
async function ensureStores() {
    if (!fileMetaStore || !cellDataStore || !sheetHeaderStore) {
        await initStores();
    }
}

/**
 * 파일의 고유 캐시 키를 생성합니다.
 * 웹 환경에서는 파일 경로 접근 불가 → name + lastModified + size 조합
 * @param {string} fileName
 * @param {number} lastModified
 * @param {number} fileSize
 * @returns {string}
 */
function makeCacheKey(fileName, lastModified, fileSize) {
    return `${fileName}__${lastModified}__${fileSize}`;
}

/**
 * 파일이 캐시에 존재하고 유효한지 확인합니다.
 * @param {string} fileName
 * @param {number} lastModified
 * @param {number} fileSize
 * @returns {Promise<boolean>}
 */
export async function isFileCached(fileName, lastModified, fileSize) {
    try {
        await ensureStores();
        const key = makeCacheKey(fileName, lastModified, fileSize);
        const meta = await fileMetaStore.getItem(key);
        return meta !== null;
    } catch {
        return false;
    }
}

/**
 * 파일 데이터를 캐시에 저장합니다.
 * @param {Object} params
 * @param {string} params.fileName - 파일명
 * @param {number} params.lastModified - File.lastModified
 * @param {number} params.fileSize - File.size
 * @param {Object[]} params.cells - 셀 데이터 배열
 * @param {Object} params.headers - 시트별 헤더 { sheetName: headers[] }
 */
export async function saveFileData({ fileName, lastModified, fileSize, cells, headers }) {
    try {
        await ensureStores();
        const key = makeCacheKey(fileName, lastModified, fileSize);

        // 메타 정보 저장
        await fileMetaStore.setItem(key, {
            fileName,
            lastModified,
            fileSize,
            indexedAt: Date.now(),
            cellCount: cells.length
        });

        // 헤더 정보 저장
        await sheetHeaderStore.setItem(key, headers);

        // 셀 데이터는 청크 단위로 저장 (단일 트랜잭션에서 대량 쓰기 방지)
        const CHUNK_SIZE = 5000;
        const totalChunks = Math.ceil(cells.length / CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
            const chunk = cells.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            await cellDataStore.setItem(`${key}__chunk_${i}`, chunk);
        }
        // 총 청크 수 저장
        await cellDataStore.setItem(`${key}__meta`, { totalChunks });

    } catch (err) {
        console.error(`[CacheManager] 캐시 저장 실패: ${fileName}`, err);
    }
}

/**
 * 캐시에서 파일 데이터를 로드합니다.
 * @param {string} fileName
 * @param {number} lastModified
 * @param {number} fileSize
 * @returns {Promise<Object|null>} { fileName, headers, cells } 또는 null
 */
export async function loadFileData(fileName, lastModified, fileSize) {
    try {
        await ensureStores();
        const key = makeCacheKey(fileName, lastModified, fileSize);

        const meta = await fileMetaStore.getItem(key);
        if (!meta) return null;

        const headers = await sheetHeaderStore.getItem(key);
        if (!headers) return null;

        // 셀 데이터 청크 로드
        const chunkMeta = await cellDataStore.getItem(`${key}__meta`);
        if (!chunkMeta) return null;

        const cells = [];
        for (let i = 0; i < chunkMeta.totalChunks; i++) {
            const chunk = await cellDataStore.getItem(`${key}__chunk_${i}`);
            if (chunk) cells.push(...chunk);
        }

        return { fileName, headers, cells };
    } catch (err) {
        console.error(`[CacheManager] 캐시 로드 실패: ${fileName}`, err);
        return null;
    }
}

/**
 * 캐시에서 파일 데이터를 제거합니다.
 * @param {string} fileName
 * @param {number} lastModified
 * @param {number} fileSize
 */
export async function removeFileCache(fileName, lastModified, fileSize) {
    try {
        await ensureStores();
        const key = makeCacheKey(fileName, lastModified, fileSize);

        // 메타/헤더 삭제
        await fileMetaStore.removeItem(key);
        await sheetHeaderStore.removeItem(key);

        // 셀 데이터 청크 삭제
        const chunkMeta = await cellDataStore.getItem(`${key}__meta`);
        if (chunkMeta) {
            for (let i = 0; i < chunkMeta.totalChunks; i++) {
                await cellDataStore.removeItem(`${key}__chunk_${i}`);
            }
            await cellDataStore.removeItem(`${key}__meta`);
        }
    } catch (err) {
        console.error(`[CacheManager] 캐시 삭제 실패: ${fileName}`, err);
    }
}

/**
 * 캐시된 모든 파일 메타 정보를 반환합니다.
 * @returns {Promise<Object[]>} 메타 정보 배열
 */
export async function getCachedFiles() {
    try {
        await ensureStores();
        const keys = await fileMetaStore.keys();
        const metas = [];
        for (const key of keys) {
            const meta = await fileMetaStore.getItem(key);
            if (meta) metas.push(meta);
        }
        return metas;
    } catch {
        return [];
    }
}

/**
 * 전체 캐시를 초기화합니다.
 */
export async function clearAllCache() {
    try {
        await ensureStores();
        await fileMetaStore.clear();
        await cellDataStore.clear();
        await sheetHeaderStore.clear();
    } catch (err) {
        console.error('[CacheManager] 전체 캐시 삭제 실패:', err);
    }
}

export { makeCacheKey };
