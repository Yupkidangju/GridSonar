/**
 * [v2.6.0] Google Drive 연동 모듈
 * OAuth 2.0 (GIS) + Google Picker + Drive API v3 다운로드를 통합 관리합니다.
 * 100% 클라이언트 사이드 — 백엔드 서버 없이 동작.
 *
 * 흐름: 사용자 클릭 → OAuth 토큰 발급 → Picker UI → 파일 다운로드 → File 객체 반환
 *
 * 의존:
 *   - Google Identity Services (GIS): <script src="https://accounts.google.com/gsi/client">
 *   - Google API Client (gapi): <script src="https://apis.google.com/js/api.js">
 *   (두 스크립트는 index.html에서 로드)
 */

import { getConfig, setConfig } from '../utils/config.js';
import { t } from '../utils/i18n.js';
import { logger } from '../utils/logger.js';

// ── 상수 ──
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

// Google Workspace 문서 → 내보내기 변환 매핑
const EXPORT_MIME_MAP = {
    'application/vnd.google-apps.spreadsheet':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // → xlsx
    'application/vnd.google-apps.document':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // → docx
};

// 내보내기 시 사용할 파일 확장자
const EXPORT_EXT_MAP = {
    'application/vnd.google-apps.spreadsheet': '.xlsx',
    'application/vnd.google-apps.document': '.docx',
};

// GridSonar가 지원하는 파일 확장자
const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.pdf', '.docx'];

// Google Workspace 문서 중 지원 가능한 mimeType
const SUPPORTED_WORKSPACE_MIMES = Object.keys(EXPORT_MIME_MAP);

// ── 내부 상태 ──
let tokenClient = null;
let accessToken = null;
let pickerInited = false;
let gisInited = false;

/**
 * Google Drive 설정을 가져옵니다.
 * @returns {{ apiKey: string, clientId: string }}
 */
function getDriveConfig() {
    return {
        apiKey: getConfig('driveApiKey', ''),
        clientId: getConfig('driveClientId', ''),
    };
}

/**
 * Google Drive 설정을 저장합니다.
 * @param {string} apiKey
 * @param {string} clientId
 */
function saveDriveConfig(apiKey, clientId) {
    setConfig('driveApiKey', apiKey);
    setConfig('driveClientId', clientId);
}

/**
 * 설정이 유효한지 확인합니다.
 * @returns {boolean}
 */
function isConfigured() {
    const { apiKey, clientId } = getDriveConfig();
    return !!(apiKey && clientId);
}

/**
 * GIS 토큰 클라이언트를 초기화합니다.
 * @param {Function} onTokenReceived - 토큰 수신 시 콜백
 */
function initTokenClient(onTokenReceived) {
    const { clientId } = getDriveConfig();
    if (!clientId) {
        logger.error('Google Drive Client ID가 설정되지 않았습니다.');
        return;
    }

    // google.accounts.oauth2은 GIS 스크립트가 로드되어야 사용 가능
    if (typeof google === 'undefined' || !google.accounts?.oauth2) {
        logger.error('Google Identity Services 스크립트가 로드되지 않았습니다.');
        return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (tokenResponse) => {
            if (tokenResponse.error) {
                logger.error('OAuth 토큰 오류:', tokenResponse.error);
                return;
            }
            accessToken = tokenResponse.access_token;
            logger.info('Google Drive 토큰 발급 완료');
            if (onTokenReceived) onTokenReceived(accessToken);
        },
    });
    gisInited = true;
}

/**
 * gapi Picker 라이브러리를 로드합니다.
 * @returns {Promise<void>}
 */
function loadPickerApi() {
    return new Promise((resolve, reject) => {
        if (pickerInited) { resolve(); return; }
        if (typeof gapi === 'undefined') {
            reject(new Error('gapi 스크립트가 로드되지 않았습니다.'));
            return;
        }
        gapi.load('picker', {
            callback: () => {
                pickerInited = true;
                logger.info('Google Picker API 로드 완료');
                resolve();
            },
            onerror: () => reject(new Error('Picker API 로드 실패')),
        });
    });
}

/**
 * OAuth 토큰을 요청합니다 (동의 팝업 포함).
 * @returns {Promise<string>} access_token
 */
function requestToken() {
    return new Promise((resolve, reject) => {
        if (!gisInited) {
            initTokenClient((token) => resolve(token));
            // initTokenClient 안에서 callback이 설정될 수 있으므로
            // tokenClient가 아직 없으면 에러
            if (!tokenClient) {
                reject(new Error('GIS 초기화 실패'));
                return;
            }
        } else {
            // 이미 초기화된 상태 → callback을 원샷으로 덮어쓰기
            tokenClient.callback = (tokenResponse) => {
                if (tokenResponse.error) {
                    reject(new Error(tokenResponse.error));
                    return;
                }
                accessToken = tokenResponse.access_token;
                resolve(accessToken);
            };
        }

        // 토큰 만료 체크: 이전 토큰이 있으면 갱신 시도
        if (accessToken) {
            tokenClient.requestAccessToken({ prompt: '' });
        } else {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        }
    });
}

/**
 * Google Picker를 열고 사용자가 선택한 파일 목록을 반환합니다.
 * @param {string} token - OAuth access_token
 * @returns {Promise<Array<{id: string, name: string, mimeType: string, sizeBytes: number}>>}
 */
function openPicker(token) {
    const { apiKey } = getDriveConfig();

    return new Promise((resolve, reject) => {
        // 지원 파일 확장자 기반 뷰 구성
        const docsView = new google.picker.DocsView()
            .setIncludeFolders(true)
            .setSelectFolderEnabled(false);

        // Google Sheets, Docs도 표시 (export로 변환 가능)
        const sheetsView = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS);
        const docsDocView = new google.picker.DocsView(google.picker.ViewId.DOCUMENTS);

        const picker = new google.picker.PickerBuilder()
            .setOAuthToken(token)
            .setDeveloperKey(apiKey)
            .addView(docsView)
            .addView(sheetsView)
            .addView(docsDocView)
            .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
            .setTitle(t('drivePickerTitle') || 'Google Drive에서 파일 선택')
            .setCallback((data) => {
                if (data.action === google.picker.Action.PICKED) {
                    const files = data.docs.map(doc => ({
                        id: doc.id,
                        name: doc.name,
                        mimeType: doc.mimeType,
                        sizeBytes: doc.sizeBytes || 0,
                    }));
                    resolve(files);
                } else if (data.action === google.picker.Action.CANCEL) {
                    resolve([]); // 취소 시 빈 배열
                }
            })
            .build();

        picker.setVisible(true);
    });
}

/**
 * 구글 드라이브에서 파일 콘텐츠를 다운로드합니다.
 * Google Workspace 문서는 export, 일반 파일은 직접 다운로드.
 *
 * @param {Object} driveFile - { id, name, mimeType, sizeBytes }
 * @param {string} token - OAuth access_token
 * @param {Function} onProgress - 진행률 콜백 (0~100)
 * @returns {Promise<File>} 브라우저 File 객체
 */
async function downloadFile(driveFile, token, onProgress) {
    const { id, name, mimeType } = driveFile;
    let url, fileName;

    // Google Workspace 문서인지 확인
    if (SUPPORTED_WORKSPACE_MIMES.includes(mimeType)) {
        const exportMime = EXPORT_MIME_MAP[mimeType];
        const ext = EXPORT_EXT_MAP[mimeType];
        // files.export 엔드포인트
        url = `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(exportMime)}`;
        // 파일명에 확장자 추가 (예: "매출현황" → "매출현황.xlsx")
        fileName = name.endsWith(ext) ? name : `${name}${ext}`;
    } else {
        // 일반 파일 (xlsx, csv, pdf 등)
        url = `https://www.googleapis.com/drive/v3/files/${id}?alt=media`;
        fileName = name;
    }

    // 파일 확장자 검증 (지원 가능한 포맷인지)
    const ext = '.' + fileName.split('.').pop().toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext) && !SUPPORTED_WORKSPACE_MIMES.includes(mimeType)) {
        throw new Error(`${t('driveUnsupported') || '지원하지 않는 파일 형식입니다'}: ${ext}`);
    }

    logger.info(`Google Drive 다운로드 시작: ${fileName} (${mimeType})`);
    if (onProgress) onProgress(0);

    // fetch로 다운로드 (Authorization 헤더에 Bearer 토큰)
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        // 10MB export 제한 등 에러 처리
        if (response.status === 403 && errorText.includes('exportSizeLimitExceeded')) {
            throw new Error(t('driveExportLimit') || '파일이 너무 큽니다 (내보내기 10MB 제한)');
        }
        throw new Error(`${t('driveError') || 'Google Drive 다운로드 실패'}: ${response.status} ${response.statusText}`);
    }

    // 진행률 추적 (Content-Length가 있는 경우만)
    const contentLength = response.headers.get('Content-Length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (onProgress && total > 0) {
            onProgress(Math.round((received / total) * 100));
        }
    }

    // 청크를 Blob → File로 변환
    const blob = new Blob(chunks);
    const file = new File([blob], fileName, {
        type: mimeType,
        lastModified: Date.now(),
    });

    if (onProgress) onProgress(100);
    logger.info(`Google Drive 다운로드 완료: ${fileName} (${(blob.size / 1024).toFixed(1)}KB)`);
    return file;
}

/**
 * Google Drive 연동 메인 플로우:
 * 설정 확인 → OAuth → Picker → 다운로드 → File[] 반환
 *
 * @param {Object} callbacks
 * @param {Function} callbacks.onSettingsNeeded - 설정 모달을 열어야 할 때
 * @param {Function} callbacks.onStatus - 상태 메시지 업데이트
 * @param {Function} callbacks.onProgress - 진행률 (0~100)
 * @param {Function} callbacks.onFilesReady - File[] 다운로드 완료 시
 * @param {Function} callbacks.onError - 에러 발생 시
 */
async function connectAndPickFiles(callbacks) {
    const { onSettingsNeeded, onStatus, onProgress, onFilesReady, onError } = callbacks;

    try {
        // 1. 설정 확인
        if (!isConfigured()) {
            if (onSettingsNeeded) onSettingsNeeded();
            return;
        }

        // 2. Picker API 로드
        if (onStatus) onStatus(t('driveConnecting') || 'Google Drive 연결 중...', true, 10);
        await loadPickerApi();

        // 3. OAuth 토큰 요청
        if (onStatus) onStatus(t('driveLoginRequired') || 'Google 로그인 중...', true, 20);
        const token = await requestToken();
        if (!token) {
            if (onError) onError(t('driveLoginRequired') || 'Google 로그인이 필요합니다');
            return;
        }

        // 4. Picker 열기
        if (onStatus) onStatus(t('drivePickerOpen') || '파일을 선택하세요...', true, 30);
        const pickedFiles = await openPicker(token);
        if (pickedFiles.length === 0) {
            if (onStatus) onStatus('', false);
            return; // 사용자가 취소
        }

        // 5. 파일 다운로드
        const totalFiles = pickedFiles.length;
        const downloadedFiles = [];
        const failedFiles = [];

        for (let i = 0; i < totalFiles; i++) {
            const driveFile = pickedFiles[i];
            const pct = Math.round(30 + ((i + 1) / totalFiles) * 60);

            if (onStatus) {
                onStatus(
                    `${t('driveDownloading') || '다운로드 중'}: ${driveFile.name} (${i + 1}/${totalFiles})`,
                    true, pct
                );
            }

            try {
                const file = await downloadFile(driveFile, token, (filePct) => {
                    if (onProgress) onProgress(filePct);
                });
                downloadedFiles.push(file);
            } catch (err) {
                logger.error(`다운로드 실패: ${driveFile.name}`, err.message);
                failedFiles.push({ name: driveFile.name, reason: err.message });
            }
        }

        // 6. 결과 전달
        if (downloadedFiles.length > 0) {
            if (onStatus) {
                onStatus(
                    `✅ ${t('driveDownloadComplete') || '다운로드 완료'}: ${downloadedFiles.length}${t('files') || '개'}`,
                    true, 95
                );
            }
            if (onFilesReady) onFilesReady(downloadedFiles);
        }

        // 실패 파일 알림
        if (failedFiles.length > 0) {
            const failMsg = failedFiles.map(f => `${f.name}: ${f.reason}`).join('\n');
            logger.warn('Google Drive 다운로드 실패 목록:', failMsg);
            if (onError) {
                onError(`${failedFiles.length}${t('files') || '개'} ${t('driveError') || '다운로드 실패'}:\n${failedFiles.map(f => f.name).join(', ')}`);
            }
        }

    } catch (err) {
        logger.error('Google Drive 연동 오류:', err);
        if (onError) onError(err.message || t('driveError') || 'Google Drive 오류');
        if (onStatus) onStatus('', false);
    }
}

export {
    getDriveConfig,
    saveDriveConfig,
    isConfigured,
    connectAndPickFiles,
};
