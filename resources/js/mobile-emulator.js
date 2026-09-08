import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';
import './mobile-emulator-host';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

const root = document.querySelector('[data-mobile-emulator]:not([data-mobile-emulator-loader])');

if (root) {
    const app = root.querySelector('[data-emulator-app]');
    const screen = root.querySelector('[data-emulator-screen]');
    const device = root.querySelector('[data-emulator-device]');
    const systemNavigationBar = root.querySelector('[data-emulator-navigation-bar]');
    const requestLog = root.querySelector('[data-emulator-request-log]');
    const uploadStatus = root.querySelector('[data-emulator-upload-status]');
    const networkStatus = root.querySelector('[data-emulator-network-status]');
    const connectivityStatus = root.querySelector('[data-emulator-connectivity]');
    const identityStatus = root.querySelector('[data-emulator-identity]');
    const dossierStatus = root.querySelector('[data-emulator-active-dossier]');
    const safetyBar = root.querySelector('[data-emulator-safety-bar]');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
    const apiBaseUrl = root.dataset.apiBaseUrl.replace(/\/$/, '');
    const runtimePlatform = ['android', 'ios'].includes(String(root.dataset.emulatorPlatform || root.dataset.runtimePlatform || '').toLowerCase())
        ? String(root.dataset.emulatorPlatform || root.dataset.runtimePlatform).toLowerCase()
        : 'android';
    const runtimeSource = String(root.dataset.runtimeSource || (root.dataset.emulatorEmbedded === '1' ? 'app-emulator' : 'browser-emulator'));
    const iosNativeRuntime = runtimePlatform === 'ios' && runtimeSource === 'ios';
    const iosPwaRuntime = runtimePlatform === 'ios' && runtimeSource === 'ios-pwa';
    const iosRuntime = iosNativeRuntime || iosPwaRuntime;
    const nativeSecureSessionBridgeAvailable = iosNativeRuntime && Boolean(window.webkit?.messageHandlers?.secureSession);
    const nativeBiometricBridgeAvailable = iosNativeRuntime && Boolean(window.webkit?.messageHandlers?.biometricAuthentication);
    const nativeShareBridgeAvailable = iosNativeRuntime && Boolean(window.webkit?.messageHandlers?.maisonPiloteNative);
    const nativeOutgoingDocumentBridgeAvailable = iosNativeRuntime && Boolean(window.webkit?.messageHandlers?.outgoingDocument);
    const runtimeStorageScope = `${runtimeSource}:${runtimePlatform}`;
    const preferencesStorageKey = `maison-pilote:mobile-emulator:preferences:${runtimeStorageScope}:v1`;
    const legacyPreferencesStorageKey = 'maison-pilote:mobile-emulator:preferences:v1';
    const legacyIosPwaPreferencesStorageKey = 'maison-pilote:mobile-emulator:preferences:ios:ios:v1';
    const runtimeSessionStorageKey = `maison-pilote:mobile-emulator:runtime-session:${runtimeStorageScope}`;
    const transientBackgroundStorageKey = `maison-pilote:mobile-emulator:temporary-session-backgrounded-at:${runtimeStorageScope}`;
    const sessionPublicId = String(root.dataset.sessionPublicId || '');
    const navigationSessionStorageKey = `maison-pilote:mobile-emulator:navigation:${runtimeStorageScope}:${sessionPublicId}`;
    const pendingSiteLoginStorageKey = `maison-pilote:mobile-emulator:site-login:${runtimeStorageScope}:${sessionPublicId}`;
    const mobileAccessSessionStorageKey = `maison-pilote:mobile-access:${runtimeStorageScope}:v1`;
    const nativeShareAttemptsStorageKey = `maison-pilote:native-share-attempts:${runtimeStorageScope}:v1`;
    const nativeShareMaximumChunkLength = 512 * 1024;
    const offlineCacheDatabaseName = 'maison-pilote-mobile-offline-v1';
    const offlineCacheResponseStore = 'responses';
    const offlineCacheMetadataStore = 'metadata';
    const offlineCacheMaximumPayloadBytes = 512 * 1024;
    const offlineCacheLifetimeMs = 7 * 24 * 60 * 60 * 1000;
    const pendingSiteLoginLifetimeMs = 5 * 60 * 1000;
    const restorableRoutes = new Set([
        'home', 'documents', 'hr', 'hr_pending', 'tasks', 'more', 'notifications', 'payslips', 'leave_balances',
        'employee_documents', 'absences', 'absence_create', 'expenses', 'expense_create', 'expense_item_create',
        'mileage', 'mileage_create', 'mileage_submit', 'mileage_settings', 'payslip_latest',
        'sales_revenue', 'employee_mobile_access', 'reports', 'report_create', 'contacts', 'messages',
        'task_create', 'user_settings', 'desktop',
    ]);
    const grhRoutes = new Set([
        'hr', 'hr_pending', 'employee_documents', 'absences', 'absence_create',
        'expenses', 'expense_create', 'expense_item_create', 'mileage', 'mileage_create',
        'mileage_submit', 'mileage_settings', 'sales_revenue', 'employee_mobile_access',
    ]);
    const taskRoutes = new Set(['tasks', 'task_create']);
    const salariedRestrictedRoutes = new Set([
        'hr', 'hr_pending', 'employee_documents', 'sales_revenue', 'employee_mobile_access',
        'notes', 'contacts', 'messages', 'support', 'more', 'footer_settings',
    ]);
    const grhAccessCapabilities = new Set([
        'absences.list_own', 'absences.create', 'absences.approve', 'expenses.create', 'expenses.approve',
        'mileage.create', 'mileage.manage_own', 'employee_mobile_access.manage',
    ]);
    const salariedRestrictedNotificationPreferenceCategories = new Set();
    const versionControl = root.querySelector('[data-emulator-version-code]');
    const nativeAppMetadata = iosRuntime && window.__MAISON_PILOTE_IOS_APP__ && typeof window.__MAISON_PILOTE_IOS_APP__ === 'object'
        ? window.__MAISON_PILOTE_IOS_APP__
        : null;
    let updatePromptSuppressedForSharedFiles = iosNativeRuntime
        && window.__MAISON_PILOTE_IOS_PENDING_SHARE__ === true;
    const currentVersionCode = Math.max(1, Number(nativeAppMetadata?.versionCode ?? root.dataset.currentVersionCode) || 1);
    const currentVersionName = String(nativeAppMetadata?.versionName || root.dataset.currentVersionName || '1.0.0').slice(0, 40);
    let mobileSelectSequence = 0;
    let activeMobileSelect = null;
    let activeMobileSelectMenu = null;
    const absencePreviewTimers = new WeakMap();
    const absencePreviewRequests = new WeakMap();
    const absencePreviewSequences = new WeakMap();
    let quickActionDrag = null;
    let cameraTextPaletteDrag = null;
    let pullToRefreshGesture = null;
    let suppressClickAfterPullRefresh = false;
    let documentLongPressGesture = null;
    let suppressDocumentClick = false;
    const uploadAbortControllers = new Map();
    const uploadDismissTimers = new Map();
    const taskCompletionDismissTimers = new Map();
    const uploadPreviewUrls = new Map();
    const nativeShareChunkRequests = new Map();
    const nativeShareDiscardRequests = new Map();
    const nativeShareBatchControllers = new Map();
    const nativeSharePausedBatchIds = new Set();
    const nativeShareCancelledBatchIds = new Set();
    const nativeOutgoingDocumentRequests = new Map();
    const nativeOutgoingDocumentMaximumChunkLength = 256 * 1024;
    const nativeOutgoingDocumentMaximumLength = 100 * 1024 * 1024;
    let nativeShareInboxBatches = [];
    let nativeShareProcessing = false;
    let nativeShareProcessingRequested = false;
    let nativeShareProcessingIdentityScope = '';
    let nativeShareAttemptCounters = readNativeShareAttemptCounters();
    let offlineCacheDatabasePromise = null;
    let offlineCacheIdentityScope = '';
    const publishedVersions = Array.from(versionControl?.options || []).map((option) => ({
        code: Math.max(0, Number(option.value) || 0),
        name: String(option.dataset.versionName || option.textContent || '').trim(),
    })).filter((version) => version.name !== '');
    const embeddedEmulatorFrame = root.dataset.emulatorEmbedded === '1' && window.parent !== window;
    let embeddedRuntimeReady = false;
    let nativeBiometricRequest = null;

    function postToEmulatorHost(type, payload = {}) {
        if (!embeddedEmulatorFrame) return;
        window.parent.postMessage({ type, platform: runtimePlatform, ...payload }, window.location.origin);
    }

    function readMobileAccessSession() {
        if (!iosNativeRuntime) {
            if (iosPwaRuntime) {
                // Supprime la persistance bearer de l'ancienne PWA. La coque
                // native conserve son bearer exclusivement dans le Trousseau.
                try {
                    localStorage.removeItem(mobileAccessSessionStorageKey);
                    localStorage.removeItem('maison-pilote:mobile-access:ios:ios:v1');
                } catch (_) { /* Le cookie HttpOnly serveur reste la seule session PWA. */ }
            }
            return null;
        }
        const injected = window.__MAISON_PILOTE_IOS_SESSION__;
        let parsed = injected && typeof injected === 'object' ? injected : null;
        try { localStorage.removeItem(mobileAccessSessionStorageKey); } catch (_) { /* Aucun bearer natif ne persiste dans le stockage web. */ }
        const token = String(parsed?.token || '').trim();
        const expiresAt = String(parsed?.expiresAt || parsed?.expires_at_utc || '').trim();
        const expiresAtMs = Date.parse(expiresAt);
        if (token.length < 40 || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now() + 30000) {
            try { localStorage.removeItem(mobileAccessSessionStorageKey); } catch (_) { /* No usable browser session exists. */ }
            return null;
        }

        return { token, expiresAt };
    }

    let mobileAccessSession = readMobileAccessSession();
    let iosPwaSessionExpiresAt = null;
    let iosPwaSessionRestoreAttempted = false;

    function captureIosPwaAuthentication(payload) {
        if (!iosPwaRuntime) return;
        const expiresAt = String(payload?.authentication?.expires_at_utc || '').trim();
        iosPwaSessionExpiresAt = Number.isFinite(Date.parse(expiresAt)) ? expiresAt : null;
    }

    function persistMobileAccessSession(payload) {
        if (!iosNativeRuntime) return;
        const token = String(payload?.token || '').trim();
        const expiresAt = String(payload?.expires_at_utc || payload?.expiresAt || '').trim();
        if (token.length < 40 || !Number.isFinite(Date.parse(expiresAt))) return;
        mobileAccessSession = { token, expiresAt };
        try { localStorage.removeItem(mobileAccessSessionStorageKey); } catch (_) { /* Le Trousseau reste l'unique stockage durable. */ }
        try {
            window.webkit?.messageHandlers?.secureSession?.postMessage({
                action: 'store',
                token,
                expiresAt,
                deviceId: installationUuid,
            });
        } catch (_) {
            // The installable web app has no native Keychain bridge.
        }
    }

    function clearMobileAccessSession() {
        if (!iosRuntime) return;
        mobileAccessSession = null;
        iosPwaSessionExpiresAt = null;
        try { localStorage.removeItem(mobileAccessSessionStorageKey); } catch (_) { /* The in-memory session is already cleared. */ }
        if (iosNativeRuntime) {
            try { window.webkit?.messageHandlers?.secureSession?.postMessage({ action: 'clear' }); } catch (_) { /* Trousseau déjà vide. */ }
        }
    }

    async function refreshMobileAccessSessionIfNeeded() {
        if (!iosRuntime) return;
        const expiresAt = Date.parse(String(iosPwaRuntime ? iosPwaSessionExpiresAt : mobileAccessSession?.expiresAt || ''));
        const refreshWindowMs = 7 * 24 * 60 * 60 * 1000;
        if (Number.isFinite(expiresAt) && expiresAt > Date.now() + refreshWindowMs) return;
        if (iosNativeRuntime && !mobileAccessSession?.token) return;
        const response = await api('/auth/refresh', { method: 'POST' });
        if (iosPwaRuntime) captureIosPwaAuthentication(response.data);
        else persistMobileAccessSession(response.data);
    }

    function refreshNativePushRegistration({ requestAuthorization = false } = {}) {
        if (!iosRuntime || !window.MaisonPiloteNative?.pushNotifications) return;
        try {
            if (requestAuthorization) window.MaisonPiloteNative.pushNotifications.requestAuthorization();
            else window.MaisonPiloteNative.pushNotifications.refresh();
        } catch (_) {
            // Le centre de notifications serveur reste disponible sans APNs.
        }
    }

    function registerNativePushToken(event) {
        const pushToken = String(event?.detail?.token || event?.detail || '').trim();
        if (!iosRuntime || !state.authenticated || pushToken.length < 20) return;
        void api('/devices/push-token', {
            method: 'POST',
            body: { push_token: pushToken, push_enabled: true },
        }).catch(() => {});
    }

    function readStoredPreferences() {
        const keys = runtimeSource === 'app-emulator'
            ? [preferencesStorageKey, legacyPreferencesStorageKey]
            : (iosPwaRuntime ? [preferencesStorageKey, legacyIosPwaPreferencesStorageKey] : [preferencesStorageKey]);
        for (const key of keys) {
            try {
                const parsed = JSON.parse(localStorage.getItem(key) || 'null');
                if (parsed && typeof parsed === 'object') return parsed;
            } catch (_) {
                // Ignore this key and try the legacy/default value.
            }
        }

        return {};
    }

    function normalizeStoredRouteParams(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

        const params = {};
        const id = Number(value.id);
        if (Number.isSafeInteger(id) && id > 0) params.id = id;
        if (typeof value.q === 'string') params.q = value.q.slice(0, 255);
        if (['personal', 'team', 'unassigned', 'all'].includes(value.scope)) params.scope = value.scope;
        for (const key of ['period', 'status', 'year', 'month', 'from', 'to', 'group', 'module', 'category', 'due', 'archive', 'due_until']) {
            if (typeof value[key] === 'string') params[key] = value[key].slice(0, 32);
        }
        for (const key of ['reportId', 'lockVersion', 'employeeId', 'assigneeId']) {
            const number = Number(value[key]);
            if (Number.isSafeInteger(number) && number >= 0) params[key] = number;
        }
        for (const key of ['includeSnoozed', 'hideWithoutDue', 'hideOverdue']) {
            if (value[key] === true) params[key] = true;
        }

        return params;
    }

    function normalizeStoredRouteEntry(value) {
        if (!value || typeof value !== 'object' || !restorableRoutes.has(value.route)) return null;

        return {
            route: value.route,
            params: normalizeStoredRouteParams(value.params),
        };
    }

    function readStoredNavigation() {
        try {
            const parsed = JSON.parse(sessionStorage.getItem(navigationSessionStorageKey) || 'null');
            const current = normalizeStoredRouteEntry(parsed);
            if (!current) return null;

            const activeDossierId = Number(parsed.activeDossierId);
            const messageConversationId = Number(parsed.messageConversationId);

            return {
                route: current.route,
                routeParams: current.params,
                routeHistory: Array.isArray(parsed.routeHistory)
                    ? parsed.routeHistory.map(normalizeStoredRouteEntry).filter(Boolean).slice(-50)
                    : [],
                activeDossierId: Number.isSafeInteger(activeDossierId) && activeDossierId > 0 ? activeDossierId : null,
                messageConversationId: Number.isSafeInteger(messageConversationId) && messageConversationId > 0 ? messageConversationId : null,
            };
        } catch (_) {
            return null;
        }
    }

    const storedPreferences = readStoredPreferences();
    const installationUuid = typeof storedPreferences.installationUuid === 'string' && storedPreferences.installationUuid
        ? storedPreferences.installationUuid
        : crypto.randomUUID();
    if (iosNativeRuntime && nativeSecureSessionBridgeAvailable && mobileAccessSession) {
        try {
            window.webkit.messageHandlers.secureSession.postMessage({
                action: 'bindDevice',
                deviceId: installationUuid,
            });
        } catch (_) {
            // Le relais Apple Watch restera indisponible jusqu’à la prochaine connexion native.
        }
    }
    const serverAuthenticated = iosNativeRuntime ? mobileAccessSession !== null : root.dataset.authenticated === '1';
    const serverRememberConnection = iosRuntime || root.dataset.rememberConnection === '1';
    const serverOwner = root.dataset.owner === '1';
    const canRestoreNavigation = serverAuthenticated;
    const storedNavigation = canRestoreNavigation ? readStoredNavigation() : null;
    if (!canRestoreNavigation) {
        try { sessionStorage.removeItem(navigationSessionStorageKey); } catch (_) { /* The logged-out screen remains authoritative. */ }
    }
    // Une mise à jour native conserve le stockage WKWebView : la version signée
    // injectée par Swift doit donc toujours primer sur une ancienne préférence.
    const storedVersionCode = iosRuntime
        ? currentVersionCode
        : Math.max(0, Number(storedPreferences.versionCode) || currentVersionCode);
    const installedVersion = iosRuntime
        ? { code: currentVersionCode, name: currentVersionName }
        : (publishedVersions.find((version) => version.code === storedVersionCode)
            || publishedVersions.find((version) => version.code === currentVersionCode)
            || { code: currentVersionCode, name: currentVersionName });
    const restoredPendingSiteLogin = readPendingSiteLogin();
    const messageRefreshIntervalMs = 3000;
    const leaveBalanceRefreshIntervalMs = 15000;
    const defaultSharedDocumentText = (companyName = '') => {
        const company = String(companyName || '').trim();
        return company
            ? `Veuillez trouver ci-joint un document de l’entreprise ${company}, partagé depuis Maison Pilote.`
            : 'Veuillez trouver ci-joint un document partagé depuis Maison Pilote.';
    };

    const state = {
        bootstrap: null,
        config: null,
        activeDossierId: storedNavigation?.activeDossierId || null,
        route: storedNavigation?.route || 'home',
        routeParams: storedNavigation?.routeParams || {},
        routeHistory: storedNavigation?.routeHistory || [],
        versionCode: installedVersion.code,
        versionName: installedVersion.name,
        offline: iosRuntime ? navigator.onLine === false : Boolean(storedPreferences.offline),
        latency: Math.max(0, Number(storedPreferences.latency) || 0),
        themePreference: ['light', 'dark', 'system'].includes(storedPreferences.theme) ? storedPreferences.theme : 'system',
        deviceProfile: typeof storedPreferences.deviceProfile === 'string' ? storedPreferences.deviceProfile : (iosRuntime ? '430x932' : '412x915'),
        orientation: storedPreferences.orientation === 'landscape' ? 'landscape' : 'portrait',
        authenticated: serverAuthenticated,
        rememberConnection: serverAuthenticated || serverRememberConnection,
        biometricEnabled: (!iosRuntime || nativeBiometricBridgeAvailable) && storedPreferences.biometricEnabled === true,
        biometricPromptSuppressed: storedPreferences.biometricPromptSuppressed === true,
        biometricOfferPending: !iosRuntime && storedPreferences.biometricOfferPending !== false,
        biometricForcedRemember: storedPreferences.biometricForcedRemember === true,
        biometricLocked: (!iosRuntime || nativeBiometricBridgeAvailable) && storedPreferences.biometricEnabled === true && serverAuthenticated,
        owner: serverOwner,
        needsTransientLogout: false,
        readOnly: iosRuntime ? false : !(serverOwner && canRestoreNavigation),
        writesUntil: null,
        cameleonSessionId: null,
        cameleonSearchTimer: null,
        cameleonRequestSequence: 0,
        applicationBackgrounded: false,
        backgroundResetPending: false,
        backgroundResetPromise: null,
        backgroundResumePromise: null,
        documentSearchTimer: null,
        documentSearchRequestSequence: 0,
        documentFolderExpandedIds: new Set([0]),
        documentSortMode: ['name_asc', 'name_desc', 'date_desc', 'date_asc'].includes(storedPreferences.documentSortMode)
            ? storedPreferences.documentSortMode
            : 'date_desc',
        documentSelectionMode: false,
        selectedDocumentItems: new Set(),
        documentDeletionBusy: false,
        diagnostics: [],
        requestSequence: 0,
        messageRefreshTimer: null,
        messageRefreshGeneration: 0,
        messageRefreshInFlight: false,
        messageSendInFlight: false,
        messageEditInFlight: false,
        messageDeleteInFlight: false,
        messageDeletingId: null,
        messageRequestSequence: 0,
        messageListSignature: '',
        messagePayload: null,
        messageActionsKey: null,
        messageEditingId: null,
        messageEditingBody: '',
        messageConversationId: storedNavigation?.messageConversationId || null,
        messageSelectorSearchTimer: null,
        messageSelectorRequestSequence: 0,
        assistantPrompt: '',
        assistantRun: null,
        assistantSubmitting: false,
        assistantCancelling: false,
        assistantCancellationFailed: false,
        assistantListening: false,
        assistantError: '',
        assistantPollingTimer: null,
        assistantFeedbackDismissed: true,
        assistantFeedbackDismissTimer: null,
        assistantFeedbackDismissExpiresAt: 0,
        pendingNativeAssistantRequest: null,
        taskCreationOptions: null,
        notesPayload: null,
        notesActiveTab: 'personal',
        notesDrafts: {},
        notesSaveTimers: {},
        notesSavingCount: 0,
        notesMessage: '',
        notesPasswordQuery: '',
        notesPasswordAddExpanded: false,
        footerNavigationKeys: [],
        footerNavigationDraftKeys: [],
        footerNavigationSaving: false,
        footerNavigationMessage: '',
        downloadedDocumentKeys: new Set(),
        supportStatuses: ['pending', 'in_progress', 'awaiting_requester'],
        supportSearch: '',
        supportSearchTimer: null,
        supportRequestSequence: 0,
        supportDetailRequestSequence: 0,
        supportCreateExpanded: false,
        supportStatusSelectorOpen: false,
        supportSelectedTicketId: null,
        supportReplyExpanded: false,
        supportCancelConfirmation: false,
        employeeMobileAccessCount: null,
        hrPendingValidationCount: 0,
        hrPendingValidations: null,
        homeQuickActionCatalog: [],
        homeQuickActionKeys: [],
        homeQuickActionInitialKeys: [],
        homeRequestSequence: 0,
        homeQuickActionsEditable: false,
        quickActionsEditing: false,
        quickActionsDialogOpen: false,
        quickActionsSaving: false,
        quickActionsError: '',
        notificationItems: [],
        notificationPreferences: [],
        notificationPreferencesOpen: false,
        notificationPreferencesSaving: false,
        notificationPreferencesError: '',
        notificationPreferencesRefreshTimer: null,
        notificationPreferencesRefreshInFlight: false,
        notificationPreferencesRevision: 0,
        reportRefreshTimer: null,
        reportRefreshInFlight: false,
        payslipItems: [],
        payslipDownloadAllUrl: '',
        leaveBalanceRefreshTimer: null,
        leaveBalanceRefreshGeneration: 0,
        leaveBalanceRefreshInFlight: false,
        passwordResetIdentifier: '',
        passwordResetMessage: '',
        passwordResetCooldownSeconds: 0,
        passwordResetCooldownTimer: null,
        pendingSiteLogin: restoredPendingSiteLogin,
        siteLoginCompletionInFlight: false,
        siteLoginSuccessNoticeExpiresAt: 0,
        photoEditorFonts: storedPreferences.photoEditorFonts && typeof storedPreferences.photoEditorFonts === 'object'
            ? { ...storedPreferences.photoEditorFonts }
            : {},
        photoEditorTextSizes: storedPreferences.photoEditorTextSizes && typeof storedPreferences.photoEditorTextSizes === 'object'
            ? { ...storedPreferences.photoEditorTextSizes }
            : {},
        moduleFilterStatuses: storedPreferences.moduleFilterStatuses && typeof storedPreferences.moduleFilterStatuses === 'object'
            ? { ...storedPreferences.moduleFilterStatuses }
            : {},
        taskFiltersByDossier: storedPreferences.taskFiltersByDossier && typeof storedPreferences.taskFiltersByDossier === 'object'
            ? { ...storedPreferences.taskFiltersByDossier }
            : {},
        mileageDistanceTimer: null,
        mileageDistanceSequence: 0,
        expenseItemDrafts: {},
        expenseDraftCreationPromise: null,
        externalApplication: null,
        signatureExperience: null,
        uploadFeedbacks: [],
        offlineCacheActive: false,
        offlineCacheSavedAtUtc: null,
        transientSessionExpiryTimer: null,
    };

    function openOfflineCacheDatabase() {
        if (!('indexedDB' in window)) return Promise.resolve(null);
        if (offlineCacheDatabasePromise) return offlineCacheDatabasePromise;

        offlineCacheDatabasePromise = new Promise((resolve) => {
            const request = window.indexedDB.open(offlineCacheDatabaseName, 1);
            request.onupgradeneeded = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(offlineCacheResponseStore)) {
                    const responses = database.createObjectStore(offlineCacheResponseStore, { keyPath: 'key' });
                    responses.createIndex('runtime', 'runtime', { unique: false });
                    responses.createIndex('identity', ['runtime', 'identityScope'], { unique: false });
                }
                if (!database.objectStoreNames.contains(offlineCacheMetadataStore)) {
                    const metadata = database.createObjectStore(offlineCacheMetadataStore, { keyPath: 'key' });
                    metadata.createIndex('runtime', 'runtime', { unique: false });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
            request.onblocked = () => resolve(null);
        });

        return offlineCacheDatabasePromise;
    }

    function offlineMetadataKey() {
        return `${runtimeStorageScope}:${installationUuid}:identity`;
    }

    function offlineCanonicalPath(path) {
        const url = new URL(path, window.location.origin);
        const query = new URLSearchParams();
        Array.from(url.searchParams.entries())
            .sort(([leftKey, leftValue], [rightKey, rightValue]) => (
                leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
            ))
            .forEach(([key, value]) => query.append(key, value));
        const serializedQuery = query.toString();
        return `${url.pathname}${serializedQuery ? `?${serializedQuery}` : ''}`;
    }

    function offlineCacheKind(path, { method = 'GET', binary = false } = {}) {
        if (String(method).toUpperCase() !== 'GET' || binary) return null;
        const url = new URL(path, window.location.origin);

        // Allowlist stricte : aucune donnée de document, de paie, de GRH, de
        // messagerie, d'authentification, de terminal ou de Codex ne peut entrer
        // dans IndexedDB, même si un nouvel appel API est ajouté plus tard.
        if (url.pathname === `${new URL(`${apiBaseUrl}/`, window.location.origin).pathname}config`) return 'config';
        if (url.pathname === `${new URL(`${apiBaseUrl}/`, window.location.origin).pathname}bootstrap`) return 'bootstrap';
        if (/\/dossiers\/\d+\/home\/?$/.test(url.pathname)) return 'home';
        return null;
    }

    function offlineIdentityFromBootstrap(bootstrap) {
        if (!bootstrap || typeof bootstrap !== 'object' || bootstrap.cameleon || bootstrap.profile?.is_impersonating) return '';
        const ownerId = Number(bootstrap.profile?.owner_user_id) || 0;
        const actingId = Number(bootstrap.profile?.id) || 0;
        if (!Number.isSafeInteger(ownerId) || ownerId < 1 || !Number.isSafeInteger(actingId) || actingId < 1) return '';
        return `${ownerId}:${actingId}`;
    }

    function currentOfflineIdentityScope() {
        return offlineIdentityFromBootstrap(state.bootstrap) || offlineCacheIdentityScope;
    }

    function readOfflineMetadata() {
        return openOfflineCacheDatabase().then((database) => {
            if (!database) return null;
            return new Promise((resolve) => {
                const transaction = database.transaction(offlineCacheMetadataStore, 'readonly');
                const request = transaction.objectStore(offlineCacheMetadataStore).get(offlineMetadataKey());
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => resolve(null);
                transaction.onabort = () => resolve(null);
            });
        }).catch(() => null);
    }

    async function resolveOfflineIdentityScope() {
        const current = currentOfflineIdentityScope();
        if (current) return current;
        // Un cache persistant n'est jamais ouvert sur la seule foi d'une valeur
        // IndexedDB : la page doit déjà posséder une session serveur/native valide.
        if (!state.authenticated) return '';
        const metadata = await readOfflineMetadata();
        const scope = String(metadata?.identityScope || '');
        if (!/^\d+:\d+$/.test(scope)) return '';
        offlineCacheIdentityScope = scope;
        return scope;
    }

    async function writeOfflineMetadata(identityScope) {
        const database = await openOfflineCacheDatabase();
        if (!database) return;
        await new Promise((resolve) => {
            const transaction = database.transaction(offlineCacheMetadataStore, 'readwrite');
            transaction.objectStore(offlineCacheMetadataStore).put({
                key: offlineMetadataKey(),
                runtime: runtimeStorageScope,
                identityScope,
                updatedAtUtc: new Date().toISOString(),
            });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve();
            transaction.onabort = () => resolve();
        });
    }

    async function purgeOfflineCache() {
        offlineCacheIdentityScope = '';
        state.offlineCacheActive = false;
        state.offlineCacheSavedAtUtc = null;
        const database = await openOfflineCacheDatabase();
        if (!database) return;
        await new Promise((resolve) => {
            const transaction = database.transaction(
                [offlineCacheResponseStore, offlineCacheMetadataStore],
                'readwrite',
            );
            for (const storeName of [offlineCacheResponseStore, offlineCacheMetadataStore]) {
                const index = transaction.objectStore(storeName).index('runtime');
                const cursorRequest = index.openCursor(IDBKeyRange.only(runtimeStorageScope));
                cursorRequest.onsuccess = () => {
                    const cursor = cursorRequest.result;
                    if (!cursor) return;
                    cursor.delete();
                    cursor.continue();
                };
            }
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve();
            transaction.onabort = () => resolve();
        });
    }

    async function adoptOfflineIdentity(identityScope) {
        if (!identityScope) return false;
        const previous = currentOfflineIdentityScope() || String((await readOfflineMetadata())?.identityScope || '');
        if (previous && previous !== identityScope) await purgeOfflineCache();
        offlineCacheIdentityScope = identityScope;
        await writeOfflineMetadata(identityScope);
        return true;
    }

    function sanitizeOfflinePayload(payload) {
        const secretKey = /(?:password|secret|token|authorization|cookie|credential|session|csrf|api[_-]?key|request[_-]?id)/i;
        const privateField = /^(?:email|phone|telephone|address|download_url|preview_url|content_url|document_url)$/i;
        const seen = new WeakSet();
        let serialized;
        try {
            serialized = JSON.stringify(payload, (key, value) => {
                if (key && (secretKey.test(key) || privateField.test(key))) return undefined;
                if (typeof value === 'string' && /^Bearer\s+/i.test(value)) return undefined;
                if (key && /_url$/i.test(key) && typeof value === 'string') {
                    try {
                        const url = new URL(value, window.location.origin);
                        const hasSecretQuery = Array.from(url.searchParams.keys()).some((name) => secretKey.test(name));
                        if (url.username || url.password || hasSecretQuery) return undefined;
                    } catch (_) {
                        return undefined;
                    }
                }
                if (typeof value === 'object' && value !== null) {
                    if (value instanceof Blob || value instanceof FormData || value instanceof ArrayBuffer) return undefined;
                    if (seen.has(value)) return undefined;
                    seen.add(value);
                }
                return value;
            });
        } catch (_) {
            return null;
        }
        if (!serialized || new TextEncoder().encode(serialized).byteLength > offlineCacheMaximumPayloadBytes) return null;
        try { return JSON.parse(serialized); }
        catch (_) { return null; }
    }

    async function offlineCacheDescriptor(path, kind, payload = null) {
        if (!kind) return null;
        if (kind === 'config') {
            return { identityScope: 'public', dossierId: 0, route: offlineCanonicalPath(path) };
        }

        if (payload?.data?.cameleon || state.cameleonSessionId || state.bootstrap?.cameleon) return null;
        const identityScope = kind === 'bootstrap' && payload
            ? offlineIdentityFromBootstrap(payload.data)
            : await resolveOfflineIdentityScope();
        if (!identityScope) return null;

        const url = new URL(path, window.location.origin);
        const dossierMatch = url.pathname.match(/\/dossiers\/(\d+)\//);
        const dossierId = Number(dossierMatch?.[1] || url.searchParams.get('dossier_id') || payload?.data?.active_dossier_id || state.activeDossierId || 0);
        return {
            identityScope,
            dossierId: Number.isSafeInteger(dossierId) && dossierId > 0 ? dossierId : 0,
            route: offlineCanonicalPath(path),
        };
    }

    function offlineCacheKey(descriptor) {
        return [runtimeStorageScope, descriptor.identityScope, descriptor.dossierId, descriptor.route].join('|');
    }

    async function storeOfflineResponse(path, kind, payload) {
        if (!kind) return;
        const descriptor = await offlineCacheDescriptor(path, kind, payload);
        if (!descriptor) {
            if (kind === 'bootstrap' && payload?.data?.cameleon) await purgeOfflineCache();
            return;
        }
        if (descriptor.identityScope !== 'public' && !await adoptOfflineIdentity(descriptor.identityScope)) return;
        const safePayload = sanitizeOfflinePayload(payload);
        if (!safePayload) return;
        const database = await openOfflineCacheDatabase();
        if (!database) return;
        await new Promise((resolve) => {
            const transaction = database.transaction(offlineCacheResponseStore, 'readwrite');
            transaction.objectStore(offlineCacheResponseStore).put({
                key: offlineCacheKey(descriptor),
                runtime: runtimeStorageScope,
                identityScope: descriptor.identityScope,
                dossierId: descriptor.dossierId,
                route: descriptor.route,
                payload: safePayload,
                savedAtUtc: new Date().toISOString(),
            });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => resolve();
            transaction.onabort = () => resolve();
        });
    }

    async function readOfflineResponse(path, kind) {
        const descriptor = await offlineCacheDescriptor(path, kind);
        if (!descriptor) return null;
        const database = await openOfflineCacheDatabase();
        if (!database) return null;
        const entry = await new Promise((resolve) => {
            const transaction = database.transaction(offlineCacheResponseStore, 'readonly');
            const request = transaction.objectStore(offlineCacheResponseStore).get(offlineCacheKey(descriptor));
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => resolve(null);
            transaction.onabort = () => resolve(null);
        });
        const savedAt = Date.parse(String(entry?.savedAtUtc || ''));
        if (!entry?.payload || !Number.isFinite(savedAt) || savedAt < Date.now() - offlineCacheLifetimeMs) return null;
        const payload = sanitizeOfflinePayload(entry.payload);
        if (!payload) return null;
        payload.meta = {
            ...(payload.meta && typeof payload.meta === 'object' ? payload.meta : {}),
            offline_cache: true,
            offline_saved_at_utc: entry.savedAtUtc,
        };
        state.offlineCacheActive = true;
        state.offlineCacheSavedAtUtc = entry.savedAtUtc;
        return payload;
    }

    function offlineUnavailableError() {
        const error = new Error('Ce contenu n’est pas disponible hors ligne. Reconnectez-vous pour le charger.');
        error.code = 'network_unavailable';
        error.retryable = true;
        return error;
    }

    function clearTransientBackgroundMarker() {
        if (state.transientSessionExpiryTimer !== null) {
            window.clearTimeout(state.transientSessionExpiryTimer);
            state.transientSessionExpiryTimer = null;
        }
        try { sessionStorage.removeItem(transientBackgroundStorageKey); } catch (_) { /* The in-memory session remains usable. */ }
    }

    function transientSessionBackgroundedAt() {
        try { return Math.max(0, Number(sessionStorage.getItem(transientBackgroundStorageKey)) || 0); }
        catch (_) { return 0; }
    }

    function transientSessionHasExpired(backgroundedAt = transientSessionBackgroundedAt()) {
        if (backgroundedAt <= 0) return false;
        return false;
    }

    function expireTransientSession() {
        if (!state.authenticated || state.rememberConnection) return;
        state.needsTransientLogout = true;
        void start();
    }

    function markTransientSessionBackgrounded() {
        if (!state.authenticated || state.rememberConnection) return;
        const backgroundedAt = Date.now();
        try { sessionStorage.setItem(transientBackgroundStorageKey, String(backgroundedAt)); } catch (_) { /* The in-memory session remains usable. */ }
    }

    function resumeTransientSession() {
        if (!state.authenticated || state.rememberConnection) {
            clearTransientBackgroundMarker();
            return true;
        }
        clearTransientBackgroundMarker();
        return true;
    }

    function persistPreferences() {
        try {
            localStorage.setItem(preferencesStorageKey, JSON.stringify({
                installationUuid,
                versionCode: state.versionCode,
                versionName: state.versionName,
                offline: state.offline,
                latency: state.latency,
                theme: state.themePreference,
                deviceProfile: state.deviceProfile,
                orientation: state.orientation,
                biometricEnabled: state.biometricEnabled,
                biometricPromptSuppressed: state.biometricPromptSuppressed,
                biometricOfferPending: state.biometricOfferPending,
                biometricForcedRemember: state.biometricForcedRemember,
                photoEditorFonts: state.photoEditorFonts,
                photoEditorTextSizes: state.photoEditorTextSizes,
                moduleFilterStatuses: state.moduleFilterStatuses,
                taskFiltersByDossier: state.taskFiltersByDossier,
                documentSortMode: state.documentSortMode,
            }));
        } catch (_) {
            // Les réglages restent utilisables pour la page courante.
        }
    }

    function clearStoredNavigation() {
        try { sessionStorage.removeItem(navigationSessionStorageKey); } catch (_) { /* Navigation simply remains in memory. */ }
    }

    function persistNavigation() {
        if (!state.authenticated) {
            clearStoredNavigation();
            return;
        }

        try {
            sessionStorage.setItem(navigationSessionStorageKey, JSON.stringify({
                route: state.route,
                params: normalizeStoredRouteParams(state.routeParams),
                routeHistory: state.routeHistory.slice(-50).map((entry) => ({
                    route: entry.route,
                    params: normalizeStoredRouteParams(entry.params),
                })),
                activeDossierId: state.activeDossierId,
                messageConversationId: state.messageConversationId,
            }));
        } catch (_) {
            // La navigation reste utilisable pour la page courante.
        }
    }

    persistPreferences();

    const escapeHtml = (value) => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    const normalizeSearchValue = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('fr-FR')
        .trim();
    const compactHeaderDisplayName = (value) => {
        const fullName = String(value || '').trim();
        const nameParts = fullName.split(/\s+/u).filter(Boolean);
        if (nameParts.length < 2) return fullName;

        const firstNameParts = nameParts.shift().split(/[-‐‑‒–—]+/u).filter(Boolean);
        const initials = firstNameParts
            .map((part) => `${Array.from(part)[0]?.toLocaleUpperCase('fr-FR') || ''}.`)
            .join('');

        return initials ? `${initials} ${nameParts.join(' ')}` : fullName;
    };
    const syncHeaderDisplayName = () => {
        const name = app.querySelector('[data-mobile-header-user-name]');
        if (!(name instanceof HTMLElement)) return;

        const fullName = String(name.dataset.fullName || '').trim();
        name.textContent = fullName;
        name.removeAttribute('title');
        if (name.scrollWidth <= name.clientWidth + 1) return;

        const compactName = compactHeaderDisplayName(fullName);
        if (compactName !== fullName) {
            name.textContent = compactName;
            name.title = fullName;
        }
    };
    const syncDossierLogoAlignment = () => {
        const logo = app.querySelector('.mobile-app-topbar__dossier-logo');
        const company = app.querySelector('.mobile-app-topbar__company');
        const text = company?.querySelector('.mobile-app-topbar__dossier-button > span')
            || company?.querySelector('.mobile-app-topbar__dossier-button.is-static');
        if (!(logo instanceof HTMLElement) || !(text instanceof HTMLElement)) return;

        const textRect = text.getBoundingClientRect();
        const logoRect = logo.getBoundingClientRect();
        const styles = window.getComputedStyle(text);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context || textRect.width <= 0 || logoRect.width <= 0) return;
        context.font = `${styles.fontStyle} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
        const renderedWidth = Math.min(textRect.width, context.measureText(String(text.textContent || '').trim()).width);
        const renderedCenter = textRect.right - (renderedWidth / 2);
        const logoCenter = logoRect.left + (logoRect.width / 2);
        logo.style.setProperty('--mobile-dossier-logo-offset', `${renderedCenter - logoCenter}px`);
    };
    const formatPhoneValue = (value) => {
        const raw = String(value ?? '').trim();
        const prefix = raw.startsWith('+') ? '+' : '';
        const digits = raw.replace(/\D+/g, '').slice(0, 20);

        return `${prefix}${digits.match(/.{1,2}/g)?.join(' ') ?? ''}`;
    };
    const phoneCaretPosition = (value, originalCaret) => {
        const beforeCaret = String(value ?? '').slice(0, Math.max(0, originalCaret));
        const digitCount = (beforeCaret.match(/\d/g) || []).length;
        const keepsInternationalPrefix = String(value ?? '').trimStart().startsWith('+');

        if (digitCount === 0) return keepsInternationalPrefix ? 1 : 0;

        return digitCount + Math.floor((digitCount - 1) / 2) + (keepsInternationalPrefix ? 1 : 0);
    };
    const syncPhoneSpacing = (input) => {
        const previous = input.value;
        const caret = input.selectionStart ?? previous.length;
        const formatted = formatPhoneValue(previous);

        if (formatted === previous) return;

        input.value = formatted;
        const nextCaret = Math.min(formatted.length, phoneCaretPosition(previous, caret));
        input.setSelectionRange(nextCaret, nextCaret);
    };

    const logoMarkup = () => `<span class="mobile-app-brand" aria-label="Maison Pilote">
        <img class="mobile-app-brand__color" src="/images/maison-pilote/logo-couleur.png" alt="">
        <img class="mobile-app-brand__light" src="/images/maison-pilote/logo-clair.png" alt="">
    </span>`;
    const headerLogoMarkup = () => {
        const destination = profileLandingRoute();
        const label = destination === 'payslips' ? 'Aller aux bulletins' : 'Aller à l’accueil';
        const title = destination === 'payslips' ? 'Bulletins' : 'Accueil';

        return `<button class="mobile-app-brand mobile-app-topbar__brand" type="button" data-mobile-route="${destination}" aria-label="${label}" title="${title}">
            <img class="mobile-app-brand__color" src="/images/maison-pilote/logo-header-embleme.png" alt="">
            <img class="mobile-app-brand__light" src="/images/maison-pilote/logo-header-embleme-clair.png" alt="">
        </button>`;
    };
    const passwordIcon = (visible = false) => visible
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3.7 4.3 2.4l17.3 17.3-1.3 1.3-3.1-3.1A10.8 10.8 0 0 1 12 19C6.5 19 2.3 15.5.8 12c.7-1.7 2.1-3.5 4.2-4.9L3 3.7Zm5.1 6.6a4 4 0 0 0 5.6 5.6l-5.6-5.6ZM12 5c5.5 0 9.7 3.5 11.2 7a13.3 13.3 0 0 1-3.3 4.4l-2.7-2.7a5.5 5.5 0 0 0-6.9-6.9L8.8 5.3A11 11 0 0 1 12 5Z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c5.5 0 9.7 3.5 11.2 7-1.5 3.5-5.7 7-11.2 7S2.3 15.5.8 12C2.3 8.5 6.5 5 12 5Zm0 2c-3.9 0-7.2 2.3-9 5 1.8 2.7 5.1 5 9 5s7.2-2.3 9-5c-1.8-2.7-5.1-5-9-5Zm0 1.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Z"/></svg>';
    const biometricIcon = () => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a8 8 0 0 0-8 8v2h2v-2a6 6 0 0 1 12 0v2h2v-2a8 8 0 0 0-8-8Zm0 4a4 4 0 0 0-4 4v3.5h2V10a2 2 0 1 1 4 0v4.4c0 2.2-.8 4.3-2.2 6l1.5 1.3a11.2 11.2 0 0 0 2.7-7.3V10a4 4 0 0 0-4-4Zm-8 8v.5c0 2.8.9 5.5 2.6 7.6l1.6-1.2A10.4 10.4 0 0 1 6 14.5V14H4Zm4 0v.5c0 2 .6 3.9 1.8 5.5l1.6-1.2a7.2 7.2 0 0 1-1.4-4.3V14H8Zm10 0v.4c0 3.2-1.1 6.2-3 8.5l1.5 1.3A15.4 15.4 0 0 0 20 14.4V14h-2Z"/></svg>';

    const sleep = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
    const isWriteMethod = (method) => !['GET', 'HEAD', 'OPTIONS'].includes(String(method).toUpperCase());
    const activeDossier = () => state.bootstrap?.dossiers?.find((item) => Number(item.id) === Number(state.activeDossierId)) || null;
    const capabilities = () => new Set(activeDossier()?.capabilities || state.bootstrap?.capabilities || []);
    const can = (capability) => capabilities().has(capability);
    const isAdminUser = () => String(state.bootstrap?.profile?.role || '') === 'admin';
    const isSalariedUser = () => String(state.bootstrap?.profile?.role || '') === 'salarie';
    const isSalariedOnlyUser = () => Boolean(state.bootstrap?.profile?.is_salaried_only) || isSalariedUser();
    const profileLandingRoute = () => 'home';
    const normalizeProfileRoute = (route) => route;
    const hasGrhAccess = () => !isSalariedUser() && (state.bootstrap?.dossiers || []).some((dossier) =>
        (dossier.capabilities || []).some((capability) => grhAccessCapabilities.has(capability)));
    const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const moneyFormatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
    const leaveDayFormatter = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const formatLeaveDays = (value) => {
        const days = Number(value) || 0;
        return `${leaveDayFormatter.format(days)} ${Math.abs(days) === 1 ? 'jour' : 'jours'}`;
    };
    const quickActionIcons = {
        add: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></svg>',
        camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20,5h-3.17L15,3H9L7.17,5H4c-1.1,0 -2,0.9 -2,2v12c0,1.1 0.9,2 2,2h16c1.1,0 2,-0.9 2,-2V7c0,-1.1 -0.9,-2 -2,-2ZM20,19H4V7h4.05l1.83,-2h4.24l1.83,2H20v12ZM12,8c-2.76,0 -5,2.24 -5,5s2.24,5 5,5 5,-2.24 5,-5 -2.24,-5 -5,-5ZM12,16c-1.65,0 -3,-1.35 -3,-3s1.35,-3 3,-3 3,1.35 3,3 -1.35,3 -3,3Z"/></svg>',
        file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14,2H6c-1.1,0 -2,0.9 -2,2v16c0,1.1 0.89,2 1.99,2H18c1.1,0 2,-0.9 2,-2V8l-6,-6ZM15,9V3.5L18.5,9H15ZM11,18v-4H8l4,-4 4,4h-3v4h-2Z"/></svg>',
        task: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4,4h11v2H6v12h12v-7h2v9H4V4ZM18,6V3h2v3h3v2h-3v3h-2V8h-3V6h3ZM10,15l-3,-3 1.4,-1.4 1.6,1.6 3.6,-3.6L15,10l-5,5Z"/></svg>',
        absence: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19,4h-1V2h-2v2H8V2H6v2H5a3,3 0,0 0,-3 3v12a3,3 0,0 0,3 3h14a3,3 0,0 0,3 -3V7a3,3 0,0 0,-3 -3ZM20,19a1,1 0,0 1,-1 1H5a1,1 0,0 1,-1 -1v-9h16v9ZM4,8V7a1,1 0,0 1,1 -1h1v2h2V6h8v2h2V6h1a1,1 0,0 1,1 1v1H4ZM8,13h8v2H8v-2Z"/></svg>',
        expense: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6,2h12a2,2 0,0 1,2 2v18l-3,-2 -2,2 -3,-2 -3,2 -2,-2 -3,2V4a2,2 0,0 1,2 -2ZM6,4v14.3l1,-0.7 2,2 3,-2 3,2 2,-2 1,0.7V4H6ZM9,7h6v2H9V7ZM9,11h6v2H9v-2ZM9,15h4v2H9v-2Z"/></svg>',
        mileage: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.92,6.01A1.5,1.5 0,0 0,17.5 5h-11a1.5,1.5 0,0 0,-1.42 1.01L3,12v8c0,0.55 0.45,1 1,1h1c0.55,0 1,-0.45 1,-1v-1h12v1c0,0.55 0.45,1 1,1h1c0.55,0 1,-0.45 1,-1v-8l-2.08,-5.99ZM6.5,16A1.5,1.5 0,1 1,6.5 13a1.5,1.5 0,0 1,0 3ZM17.5,16a1.5,1.5 0,1 1,0 -3,1.5 1.5,0 0,1 0,3ZM5,11l1.5,-4.5h11L19,11H5Z"/></svg>',
        delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12Zm3-9h2v8H9v-8Zm4 0h2v8h-2v-8Zm2.5-6-1-1h-5l-1 1H5v2h14V4h-3.5Z"/></svg>',
        share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3.4 3.4 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 5.2L15 19a3 3 0 1 0 3-3Zm0-10a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM6 12a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm12 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/></svg>',
        approve: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.2 16.6-4.4-4.4 1.4-1.4 3 3 8.6-8.6 1.4 1.4-10 10Z"/></svg>',
        reject: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z"/></svg>',
        open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3ZM5 5h6v2H7v10h10v-4h2v6H5V5Z"/></svg>',
        contact: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19,3H5a2,2 0,0 0,-2 2v14a2,2 0,0 0,2 2h14a2,2 0,0 0,2 -2V5a2,2 0,0 0,-2 -2ZM19,19H5V5h14v14ZM12,12a3,3 0,1 0,0 -6,3 3,0 0,0 0,6ZM12,8a1,1 0,1 1,0 2,1 1,0 0,1 0,-2ZM6,17c0.5,-2.4 2.6,-4 6,-4s5.5,1.6 6,4h-2.1c-0.5,-1.2 -1.8,-2 -3.9,-2s-3.4,0.8 -3.9,2H6Z"/></svg>',
        notes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16v18H4V3Zm2 2v14h12V5H6Zm2 3h8v2H8V8Zm0 4h8v2H8v-2Zm0 4h5v2H8v-2Z"/></svg>',
        notifications: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.4-2h-4.8a2.5 2.5 0 0 0 2.4 2Zm7-6v-5a7 7 0 0 0-5.5-6.8V3a1.5 1.5 0 0 0-3 0v1.2A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Zm-12 1 1-1v-5a5 5 0 0 1 10 0v5l1 1H7Z"/></svg>',
        support: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a8 8 0 0 0-8 8v5a3 3 0 0 0 3 3h2v-7H6v-1a6 6 0 0 1 12 0v1h-3v7h3a3 3 0 0 0 3-3v-5a9 9 0 0 0-9-8Zm-5 11v3a1 1 0 0 1-1-1v-2h1Zm10 3v-3h1v2a1 1 0 0 1-1 1Zm-7-4h4v2h-4v-2Zm0 4h4v2h-4v-2Z"/></svg>',
        assistant: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Zm-2-8a2 2 0 1 1 4 0v4a2 2 0 1 1-4 0V6Zm-5 4H3a9 9 0 0 0 8 8.9V22h2v-3.1A9 9 0 0 0 21 10h-2a7 7 0 1 1-14 0Z"/></svg>',
        tune: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10v2H4V7Zm14 0h2v2h-2V7Zm-4-2h4v6h-4V5ZM4 15h2v2H4v-2Zm6 0h10v2H10v-2Zm-4-2h4v6H6v-6Z"/></svg>',
    };
    const documentDownloadIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3h2v10.2l3.6-3.6 1.4 1.4-6 6-6-6 1.4-1.4 3.6 3.6V3ZM4 19h16v2H4v-2Z"/></svg>';
    const documentScopeIcons = {
        current: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2Zm10 14H4V8h16v10Z"/></svg>',
        all: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-3a15.7 15.7 0 0 0-1.4-3.2A8.1 8.1 0 0 1 18.9 8ZM12 4c.8 1 1.5 2.3 1.8 4h-3.6C10.5 6.3 11.2 5 12 4ZM9.5 4.8A15.7 15.7 0 0 0 8.1 8h-3a8.1 8.1 0 0 1 4.4-3.2ZM4.3 10h3.5a16.3 16.3 0 0 0 0 4H4.3a8.1 8.1 0 0 1 0-4Zm.8 6h3a15.7 15.7 0 0 0 1.4 3.2A8.1 8.1 0 0 1 5.1 16Zm6.9 4c-.8-1-1.5-2.3-1.8-4h3.6c-.3 1.7-1 3-1.8 4Zm2.2-6H9.8a14.3 14.3 0 0 1 0-4h4.4a14.3 14.3 0 0 1 0 4Zm.3 5.2a15.7 15.7 0 0 0 1.4-3.2h3a8.1 8.1 0 0 1-4.4 3.2Zm1.7-5.2a16.3 16.3 0 0 0 0-4h3.5a8.1 8.1 0 0 1 0 4h-3.5Z"/></svg>',
        personal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-2a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm0 3c-4.4 0-8 2.2-8 5v3h16v-3c0-2.8-3.6-5-8-5Zm-6 5c0-1 2.4-3 6-3s6 2 6 3v1H6v-1Z"/></svg>',
    };
    const documentSearchIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4a6 6 0 1 0 3.8 10.6L19.2 20l1.4-1.4-5.4-5.4A6 6 0 0 0 10 4Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"/></svg>';
    const documentSortModes = [
        ['name_asc', 'Tri alphabétique de A à Z', 'A', '↑'],
        ['name_desc', 'Tri alphabétique de Z à A', 'A', '↓'],
        ['date_desc', 'Tri chronologique du plus récent au plus ancien', 'date', '↓'],
        ['date_asc', 'Tri chronologique du plus ancien au plus récent', 'date', '↑'],
    ];
    const externalApplicationCatalog = {
        phone: {
            name: 'Téléphone',
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 2h3l1.2 5-2.1 1.3a15.7 15.7 0 0 0 7 7l1.3-2.1 5 1.2v3c0 2.5-2 4.6-4.5 4.6C9 22 2 15 2 6.5 2 4 4.1 2 6.6 2Z"/></svg>',
        },
        email: {
            name: 'Application e-mail',
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v14H3V5Zm2 2v.4l7 4.7 7-4.7V7H5Zm14 10V9.8l-7 4.7-7-4.7V17h14Z"/></svg>',
        },
        whatsapp: {
            name: 'WhatsApp',
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2Zm0 2a8 8 0 1 1-4.4 14.7l-.4-.2-2.2.6.7-2.1-.3-.4A8 8 0 0 1 12 4Zm-3.3 3.2h1.8l.7 2.7-1.2.8a7 7 0 0 0 3.3 3.3l.8-1.2 2.7.7v1.8c0 1-.8 1.7-1.8 1.7A8 8 0 0 1 7 9c0-1 .8-1.8 1.7-1.8Z"/></svg>',
        },
        messages: {
            name: 'Messages',
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16v14H8l-4 4V3Zm2 2v11.2L7.2 15H18V5H6Z"/></svg>',
        },
        maps: {
            name: 'Cartes',
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/></svg>',
        },
        camera: {
            name: 'Appareil photo',
            icon: quickActionIcons.camera,
        },
        files: {
            name: 'Fichiers',
            icon: quickActionIcons.file,
        },
        document: {
            name: 'Visionneuse de documents',
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l5 5v15H6V2Zm8 2.8V8h3.2L14 4.8ZM8 11v2h8v-2H8Zm0 4v2h8v-2H8Z"/></svg>',
        },
        browser: {
            name: 'Navigateur web',
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6 6h-3a15.5 15.5 0 0 0-1.3-3A8.1 8.1 0 0 1 18 8Zm-6-4c.8 1 1.5 2.3 1.8 4h-3.6C10.5 6.3 11.2 5 12 4ZM6 16h3a15.5 15.5 0 0 0 1.3 3A8.1 8.1 0 0 1 6 16Zm3.8-2a14.3 14.3 0 0 1 0-4h4.4a14.3 14.3 0 0 1 0 4H9.8Zm4.5 5a15.5 15.5 0 0 0 1.3-3h3a8.1 8.1 0 0 1-4.3 3Z"/></svg>',
        },
    };
    quickActionIcons.documents = quickActionIcons.file;
    quickActionIcons.tasks = quickActionIcons.task;
    quickActionIcons.hr = quickActionIcons.absence;
    quickActionIcons.reports = quickActionIcons.file;
    quickActionIcons.messages = quickActionIcons.contact;
    quickActionIcons.last_payslip = quickActionIcons.file;
    quickActionIcons.mileage_submit = quickActionIcons.mileage;

    const decodeExternalValue = (value) => {
        try {
            return decodeURIComponent(String(value || ''));
        } catch (_) {
            return String(value || '');
        }
    };

    function externalApplicationFromHref(anchor) {
        const href = String(anchor?.getAttribute('href') || '').trim();
        if (!href || href === '#') return null;

        const loweredHref = href.toLocaleLowerCase('fr-FR');
        if (loweredHref.startsWith('tel:')) {
            return {
                kind: 'phone',
                action: 'Démarrer un appel',
                details: [{ label: 'Numéro', value: decodeExternalValue(href.slice(4)) }],
            };
        }
        if (loweredHref.startsWith('mailto:')) {
            const [recipient, query = ''] = href.slice(7).split('?', 2);
            const subject = new URLSearchParams(query).get('subject');
            return {
                kind: 'email',
                action: 'Rédiger un e-mail',
                details: [
                    { label: 'Destinataire', value: decodeExternalValue(recipient) },
                    ...(subject ? [{ label: 'Objet', value: subject }] : []),
                ],
            };
        }
        if (loweredHref.startsWith('sms:')) {
            return {
                kind: 'messages',
                action: 'Rédiger un SMS',
                details: [{ label: 'Destinataire', value: decodeExternalValue(href.slice(4).split('?')[0]) }],
            };
        }
        if (loweredHref.startsWith('geo:')) {
            return {
                kind: 'maps',
                action: 'Afficher un emplacement',
                details: [{ label: 'Destination', value: decodeExternalValue(href.slice(4)) }],
            };
        }

        let url;
        try {
            url = new URL(href, window.location.origin);
        } catch (_) {
            return null;
        }
        const host = url.hostname.replace(/^www\./, '');
        if (host === 'wa.me' || host.endsWith('.whatsapp.com')) {
            const number = url.pathname.replace(/\D+/g, '');
            return {
                kind: 'whatsapp',
                action: 'Ouvrir une conversation',
                details: number ? [{ label: 'Destinataire', value: `+${number}` }] : [],
            };
        }
        if (host.includes('maps.google.') || host === 'maps.apple.com' || host === 'waze.com') {
            return {
                kind: 'maps',
                action: 'Afficher un emplacement',
                details: [{ label: 'Service demandé', value: host }],
            };
        }
        if (['http:', 'https:', 'blob:'].includes(url.protocol)) {
            return {
                kind: url.protocol === 'blob:' ? 'document' : 'browser',
                action: url.protocol === 'blob:' ? 'Ouvrir un document' : 'Ouvrir une page web',
                details: host ? [{ label: 'Destination', value: host }] : [],
            };
        }

        return null;
    }

    function formatDate(value, withTime = false) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return escapeHtml(value);
        return (withTime ? dateTimeFormatter : dateFormatter).format(date);
    }

    function formatCivilDate(value) {
        if (!value) return '';
        const [year, month, day] = String(value).split('-');
        return year && month && day ? `${day}/${month}/${year}` : escapeHtml(value);
    }

    function mobileDateIso(value) {
        const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || '').trim());
        if (!match) return '';
        const [, day, month, year] = match;
        const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
        if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return '';
        return `${year}-${month}-${day}`;
    }

    function mobilePastedIsoDate(value) {
        const text = String(value || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return mobileDateIso(formatCivilDate(text));

        const direct = mobileDateIso(text.replace(/[.\s-]+/g, '/'));
        if (direct) return direct;

        const digits = text.replace(/\D+/g, '');
        if (digits.length === 8) {
            return mobileDateIso(`${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`);
        }

        return '';
    }

    function mobileDateParts(value) {
        const segments = String(value || '').replace(/[^\d/]/g, '').split('/', 3);
        return [
            String(segments[0] || '').slice(0, 2),
            String(segments[1] || '').slice(0, 2),
            String(segments[2] || '').slice(0, 4),
        ];
    }

    function renderMobileDateParts(parts) {
        const normalized = [
            String(parts[0] || '').slice(0, 2),
            String(parts[1] || '').slice(0, 2),
            String(parts[2] || '').slice(0, 4),
        ];
        const lastFilled = normalized.reduce((last, part, index) => (part !== '' ? index : last), -1);
        if (lastFilled < 0) return '';

        let rendered = normalized[0];
        if (normalized[0].length === 2 || lastFilled >= 1) rendered += `/${normalized[1]}`;
        if (normalized[1].length === 2 || lastFilled >= 2) rendered += `/${normalized[2]}`;
        return rendered;
    }

    function mobileDateSegmentRange(value, segment) {
        const parts = mobileDateParts(value);
        const index = Math.max(0, Math.min(2, Number(segment) || 0));
        const start = index === 0 ? 0 : parts.slice(0, index).reduce((length, part) => length + part.length + 1, 0);
        return [start, start + parts[index].length];
    }

    function mobileDateSegmentAt(value, position) {
        const text = String(value || '');
        const firstSeparator = text.indexOf('/');
        const secondSeparator = firstSeparator < 0 ? -1 : text.indexOf('/', firstSeparator + 1);
        if (firstSeparator < 0 || position <= firstSeparator) return 0;
        if (secondSeparator < 0 || position <= secondSeparator) return 1;
        return 2;
    }

    function enhanceMobileDateFields(rootNode = app) {
        rootNode.querySelectorAll('input[type="date"]:not([data-mobile-date-picker])').forEach((source) => {
            if (!(source instanceof HTMLInputElement) || source.dataset.mobileDateEnhanced === '1') return;
            source.dataset.mobileDateEnhanced = '1';
            const required = source.required;
            const minimum = source.min;
            const maximum = source.max;
            const disabled = source.disabled;
            const quickEdit = source.hasAttribute('data-mobile-quick-entry');
            const label = String(source.closest('.mobile-app-field')?.querySelector('label')?.textContent || 'Date').trim();
            const wrapper = document.createElement('div');
            wrapper.className = 'mobile-app-date-entry';
            const display = document.createElement('input');
            display.type = 'text';
            display.inputMode = 'numeric';
            display.autocomplete = 'off';
            display.placeholder = 'jj/mm/aaaa';
            display.value = /^\d{4}-\d{2}-\d{2}$/.test(source.value) ? formatCivilDate(source.value) : '';
            display.required = required;
            display.disabled = disabled;
            display.setAttribute('aria-label', label);
            display.dataset.mobileDateDisplay = '1';
            if (source.id) {
                display.id = source.id;
                source.removeAttribute('id');
            }
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mobile-app-date-entry__calendar';
            button.disabled = disabled;
            button.setAttribute('aria-label', `Choisir ${label.toLocaleLowerCase('fr-FR')}`);
            button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h2a3 3 0 0 1 3 3v13H2V7a3 3 0 0 1 3-3h2V2Zm12 8H5v8h14v-8ZM5 8h14V7a1 1 0 0 0-1-1h-1v2h-2V6H9v2H7V6H5a1 1 0 0 0-1 1v1Z"/></svg>';
            const picker = document.createElement('input');
            picker.type = 'date';
            picker.value = source.value;
            picker.min = minimum;
            picker.max = maximum;
            picker.disabled = disabled;
            picker.tabIndex = -1;
            picker.dataset.mobileDatePicker = '1';
            picker.setAttribute('aria-hidden', 'true');
            source.type = 'hidden';
            source.required = false;
            source.removeAttribute('min');
            source.removeAttribute('max');
            source.replaceWith(wrapper);
            wrapper.append(source, display, button, picker);

            let activeSegment = 0;
            let segmentBuffer = '';
            let draftParts = mobileDateParts(display.value);
            let pointerFocusPending = false;
            let quickEditSelection = false;

            const setSegment = (segment, { select = true } = {}) => {
                activeSegment = Math.max(0, Math.min(2, Number(segment) || 0));
                segmentBuffer = '';
                window.requestAnimationFrame(() => {
                    if (document.activeElement !== display) return;
                    const [start, end] = mobileDateSegmentRange(display.value, activeSegment);
                    display.setSelectionRange(select && end > start ? start : end, end);
                });
            };

            const renderDraft = ({ select = true } = {}) => {
                display.value = renderMobileDateParts(draftParts);
                const [start, end] = mobileDateSegmentRange(display.value, activeSegment);
                display.setSelectionRange(select && end > start ? start : end, end);
            };

            const draftIsComplete = () => draftParts[0].length === 2
                && draftParts[1].length === 2
                && draftParts[2].length === 4;

            const commit = (notify = true) => {
                if (display.value.trim() === '' && !required) {
                    const changed = source.value !== '';
                    display.setCustomValidity('');
                    source.value = '';
                    picker.value = '';
                    if (notify && changed) source.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
                const iso = mobileDateIso(display.value);
                const inBounds = iso !== '' && (!minimum || iso >= minimum) && (!maximum || iso <= maximum);
                display.setCustomValidity(inBounds ? '' : 'Saisissez une date valide au format jj/mm/aaaa.');
                if (!inBounds) {
                    source.value = '';
                    picker.value = '';
                    return false;
                }
                const changed = source.value !== iso;
                source.value = iso;
                picker.value = iso;
                if (notify && changed) source.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            };
            const completeActiveSegment = () => {
                if (activeSegment < 2 && segmentBuffer.length === 1) {
                    segmentBuffer = segmentBuffer.padStart(2, '0');
                    draftParts[activeSegment] = segmentBuffer;
                    renderDraft();
                }
            };
            display.addEventListener('pointerdown', (event) => {
                if (quickEdit && document.activeElement !== display && display.value !== '') {
                    event.preventDefault();
                    quickEditSelection = true;
                    pointerFocusPending = false;
                    display.focus({ preventScroll: true });
                    display.select();
                    return;
                }
                if (quickEditSelection) quickEditSelection = false;
                pointerFocusPending = true;
            });
            display.addEventListener('focus', () => {
                if (quickEditSelection) return;
                const focusedByPointer = pointerFocusPending;
                draftParts = mobileDateParts(display.value);
                activeSegment = mobileDateSegmentAt(
                    display.value,
                    focusedByPointer ? (display.selectionStart ?? 0) : display.value.length,
                );
                segmentBuffer = '';
                if (!focusedByPointer) {
                    window.requestAnimationFrame(() => {
                        if (document.activeElement !== display) return;
                        const caret = display.value.length;
                        display.setSelectionRange(caret, caret);
                    });
                }
            });
            display.addEventListener('click', () => {
                if (quickEditSelection) return;
                pointerFocusPending = false;
                draftParts = mobileDateParts(display.value);
                setSegment(mobileDateSegmentAt(display.value, display.selectionStart ?? 0));
            });
            const writeDigit = (digit) => {
                if (quickEditSelection) {
                    quickEditSelection = false;
                    draftParts = ['', '', ''];
                    activeSegment = 0;
                    segmentBuffer = '';
                }
                const length = activeSegment === 2 ? 4 : 2;
                segmentBuffer = segmentBuffer === '' ? digit : `${segmentBuffer}${digit}`.slice(0, length);
                draftParts[activeSegment] = segmentBuffer;
                renderDraft({ select: false });
                display.setCustomValidity('');
                if (segmentBuffer.length === length) {
                    if (draftIsComplete()) commit();
                    else {
                        source.value = '';
                        picker.value = '';
                    }
                    if (activeSegment < 2) {
                        const nextSegment = activeSegment + 1;
                        setSegment(nextSegment, { select: draftParts[nextSegment].length > 0 });
                    } else {
                        segmentBuffer = '';
                    }
                } else {
                    source.value = '';
                    picker.value = '';
                }
            };
            display.addEventListener('keydown', (event) => {
                if (/^\d$/.test(event.key)) {
                    event.preventDefault();
                    writeDigit(event.key);
                    return;
                }
                if (event.key === '/' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    completeActiveSegment();
                    if (draftIsComplete()) commit();
                    else {
                        display.setCustomValidity('');
                        source.value = '';
                        picker.value = '';
                    }
                    const nextSegment = Math.min(2, activeSegment + 1);
                    setSegment(nextSegment, { select: draftParts[nextSegment].length > 0 });
                    return;
                }
                if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    const previousSegment = Math.max(0, activeSegment - 1);
                    setSegment(previousSegment, { select: draftParts[previousSegment].length > 0 });
                    return;
                }
                if (event.key === 'Backspace' || event.key === 'Delete') {
                    event.preventDefault();
                    if (event.key === 'Delete') {
                        draftParts[activeSegment] = '';
                        segmentBuffer = '';
                    } else if (segmentBuffer.length > 0) {
                        segmentBuffer = segmentBuffer.slice(0, -1);
                        draftParts[activeSegment] = segmentBuffer;
                    } else if (draftParts[activeSegment].length > 0) {
                        draftParts[activeSegment] = '';
                    } else if (activeSegment > 0) {
                        activeSegment -= 1;
                        draftParts[activeSegment] = '';
                        segmentBuffer = '';
                    }
                    renderDraft({ select: false });
                    display.setCustomValidity('');
                    source.value = '';
                    picker.value = '';
                    return;
                }
                if (event.key === 'Enter') {
                    completeActiveSegment();
                    if (commit()) display.blur();
                }
            });
            display.addEventListener('beforeinput', (event) => {
                const digits = String(event.data || '').replace(/\D+/g, '');
                if (!digits || event.defaultPrevented) return;
                event.preventDefault();
                Array.from(digits).forEach(writeDigit);
            });
            display.addEventListener('paste', (event) => {
                const pastedText = event.clipboardData?.getData('text');
                const iso = mobilePastedIsoDate(pastedText);
                event.preventDefault();
                if (!iso) {
                    display.setCustomValidity('Saisissez une date valide au format jj/mm/aaaa.');
                    return;
                }
                display.value = formatCivilDate(iso);
                draftParts = mobileDateParts(display.value);
                commit();
                activeSegment = 2;
                segmentBuffer = '';
                display.setSelectionRange(display.value.length, display.value.length);
            });
            display.addEventListener('blur', () => {
                pointerFocusPending = false;
                quickEditSelection = false;
                completeActiveSegment();
                commit();
            });
            picker.addEventListener('change', () => {
                if (!picker.value) return;
                display.value = formatCivilDate(picker.value);
                draftParts = mobileDateParts(display.value);
                commit();
                activeSegment = 2;
                segmentBuffer = '';
            });
            button.addEventListener('click', () => {
                if (picker.disabled) return;
                if (typeof picker.showPicker === 'function') picker.showPicker();
                else picker.click();
            });
            commit(false);
        });
    }

    function enhanceMobileTextFields(rootNode = app) {
        rootNode.querySelectorAll('.mobile-app-field:not([data-mobile-material-field])').forEach((field) => {
            if (!(field instanceof HTMLElement)) return;
            if (field.closest('.mobile-app-notes__password-card, .mobile-app-task-filters, .mobile-app-hr-page-selector, .mobile-app-mileage-filters')) return;

            const directControl = Array.from(field.children).find((child) => child.matches?.('input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea'));
            const nestedControl = field.querySelector(':scope > .mobile-app-password-control > input, :scope > .mobile-app-date-entry > input[data-mobile-date-display]');
            const control = directControl || nestedControl;
            const label = Array.from(field.children).find((child) => child instanceof HTMLLabelElement);
            if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) || !(label instanceof HTMLLabelElement)) return;

            field.dataset.mobileMaterialField = '1';
            field.classList.add('is-material-text-field');
            control.dataset.mobileMaterialControl = '1';

            const syncValueState = () => {
                field.classList.toggle('has-value', String(control.value || '').trim() !== '');
            };
            control.addEventListener('input', syncValueState);
            control.addEventListener('change', syncValueState);
            syncValueState();
        });
    }

    function formatPayslipMonth(value) {
        const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(value || ''));
        if (!match) return String(value || '');
        const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        return `${monthNames[Number(match[2]) - 1]} ${match[1]}`;
    }

    function formatMoney(value) {
        const number = Number(value);
        return Number.isFinite(number) ? moneyFormatter.format(number) : escapeHtml(value);
    }

    function humanStatus(value) {
        const labels = {
            draft: 'Brouillon', submitted: 'Transmis', under_review: 'En cours de vérification',
            accepted: 'Accepté', approved: 'Validé', rejected: 'Refusé', to_correct: 'À corriger',
            to_provide: 'À fournir', draft_received: 'Réponse reçue', not_applicable: 'Non applicable',
            cancelled: 'Annulé', queued: 'En attente', running: 'En cours', ready: 'Prêt', failed: 'Échec',
            pending: 'En attente', in_progress: 'En cours', done: 'Terminée', completed: 'Terminé', duplicate: 'Doublon détecté',
        };
        return labels[value] || String(value || 'Inconnu').replaceAll('_', ' ');
    }

    function mobileCardInteractionAttributes(interaction) {
        if (!interaction || typeof interaction !== 'object') return '';
        return `data-mobile-card-interaction="${escapeHtml(encodeURIComponent(JSON.stringify(interaction)))}"`;
    }

    function mobileCardInteraction(element) {
        try {
            return JSON.parse(decodeURIComponent(String(element?.dataset?.mobileCardInteraction || '')));
        } catch (_) {
            return {};
        }
    }

    function closeMobileActionFallback() {
        app.querySelector('[data-mobile-action-fallback]')?.remove();
    }

    function openMobileActionFallback(interaction) {
        closeMobileActionFallback();
        const title = String(interaction?.fallback_title || 'Continuer sur le site');
        const message = String(interaction?.fallback_message || 'Rendez-vous sur le site depuis un ordinateur pour poursuivre.');
        const shortUrl = String(interaction?.short_url || '').trim();
        const visibleUrl = shortUrl.replace(/^https?:\/\//i, '');
        const copyIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h11v13H8V7Zm2 2v9h7V9h-7ZM5 4h11v2H7v9H5V4Z"/></svg>';
        const shareIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3.4 3.4 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 5.2L15 19a3 3 0 1 0 3-3Zm0-10a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM6 12a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm12 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/></svg>';
        const linkActions = shortUrl ? `<div class="mobile-app-action-fallback__link-row"><span class="mobile-app-action-fallback__link" title="${escapeHtml(visibleUrl)}">${escapeHtml(visibleUrl)}</span><button class="mobile-app-action-fallback__icon" type="button" data-mobile-action-fallback-copy="${escapeHtml(shortUrl)}" aria-label="Copier le lien" title="Copier le lien">${copyIcon}</button><button class="mobile-app-action-fallback__icon" type="button" data-mobile-action-fallback-share="${escapeHtml(shortUrl)}" aria-label="Partager le lien" title="Partager le lien">${shareIcon}</button></div>` : '';
        app.insertAdjacentHTML('beforeend', `<div class="mobile-app-dialog-backdrop" data-mobile-action-fallback role="presentation"><section class="mobile-app-quick-actions-dialog mobile-app-action-fallback" role="dialog" aria-modal="true" aria-labelledby="mobile-action-fallback-title"><header><h3 id="mobile-action-fallback-title">${escapeHtml(title)}</h3><button type="button" data-mobile-action-fallback-close aria-label="Fermer">×</button></header><div class="mobile-app-quick-actions-dialog__body"><p>${escapeHtml(message)}</p>${linkActions}</div></section></div>`);
        window.setTimeout(() => app.querySelector('[data-mobile-action-fallback-close]')?.focus({ preventScroll: true }), 0);
    }

    async function handleMobileCardInteraction(element) {
        const interaction = mobileCardInteraction(element);
        const routeParams = normalizedNotificationRouteParams(interaction.route_params);
        if (interaction.mobile_action === 'start_cameleon') {
            const targetUserId = Number(interaction.cameleon_target_user_id) || 0;
            if (targetUserId > 0) {
                await startCameleonSession(targetUserId, String(interaction.mobile_destination || 'notifications'), routeParams);
                return;
            }
        }
        const targetDossierId = Number(interaction.dossier_id || routeParams.dossierId) || 0;
        if (targetDossierId > 0 && targetDossierId !== Number(state.activeDossierId)) {
            await api(`/dossiers/${targetDossierId}/activate`, { method: 'POST' });
            state.activeDossierId = targetDossierId;
            await loadBootstrap();
            state.documentFolderExpandedIds = new Set([0]);
            state.messageConversationId = null;
        }
        if (interaction.mobile_action === 'navigate' && interaction.mobile_destination) {
            await navigate(notificationDestinationRoute(String(interaction.mobile_destination)), routeParams);
            return;
        }
        if (interaction.mobile_action === 'open_deep_link' && interaction.url) {
            if (openSignatureExperience(String(interaction.url))) return;
        }
        if (['open_document', 'open_external_document'].includes(interaction.mobile_action) && interaction.document_url) {
            await openBinary(String(interaction.document_url));
            return;
        }
        openMobileActionFallback(interaction);
    }

    function diagnosticEntry({ method, path, status, duration, requestId }) {
        state.diagnostics.unshift({ method, path, status, duration, requestId });
        state.diagnostics = state.diagnostics.slice(0, 30);
        renderDiagnostics();
    }

    function renderDiagnostics() {
        if (!state.diagnostics.length) {
            requestLog.innerHTML = '<p class="small text-muted mb-0">Aucun appel.</p>';
            return;
        }
        requestLog.innerHTML = state.diagnostics.map((entry) => `
            <div class="mobile-emulator-request">
                <strong>${escapeHtml(entry.method)}</strong>
                <span>${escapeHtml(entry.status)}</span>
                <span>${escapeHtml(entry.duration)} ms</span>
                <code>${escapeHtml(entry.path)}</code>
                ${entry.requestId ? `<button type="button" class="btn btn-link" data-copy-request-id="${escapeHtml(entry.requestId)}">Copier request_id</button>` : ''}
            </div>
        `).join('');
    }

    let iosPwaCsrfRequest = null;

    function browserCookie(name) {
        const prefix = `${encodeURIComponent(name)}=`;
        const item = String(document.cookie || '').split('; ').find((entry) => entry.startsWith(prefix));
        if (!item) return '';
        try { return decodeURIComponent(item.slice(prefix.length)); }
        catch (_) { return ''; }
    }

    async function ensureIosPwaCsrfCookie() {
        if (!iosPwaRuntime) return;
        if (browserCookie('XSRF-TOKEN')) return;
        if (!iosPwaCsrfRequest) {
            iosPwaCsrfRequest = fetch(new URL('/sanctum/csrf-cookie', window.location.origin), {
                method: 'GET',
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
                cache: 'no-store',
            }).then((response) => {
                if (!response.ok) {
                    const error = new Error('La session de sécurité PWA n’a pas pu être initialisée.');
                    error.status = response.status;
                    error.code = 'csrf_session_unavailable';
                    throw error;
                }
            }).finally(() => {
                iosPwaCsrfRequest = null;
            });
        }

        await iosPwaCsrfRequest;
    }

    const mobileErrorFieldLabels = new Map([
        ['amount including tax', 'le montant TTC'],
        ['attachment ged document id', 'le justificatif'],
        ['business purpose', 'la nature de la dépense'],
        ['default departure', 'l’adresse de départ'],
        ['device name', 'le nom de l’appareil'],
        ['distance km', 'la distance'],
        ['effective from', 'la date d’application'],
        ['employee comment', 'le commentaire'],
        ['end segment', 'la période de fin'],
        ['ends on', 'la date de fin'],
        ['expense date', 'la date des frais'],
        ['fiscal power', 'la puissance fiscale'],
        ['lock version', 'la version de la fiche'],
        ['payroll employee id', 'le salarié'],
        ['payroll leave type id', 'le type d’absence'],
        ['period end', 'la fin de période'],
        ['period start', 'le début de période'],
        ['receipt ged document id', 'le justificatif'],
        ['receipt missing reason', 'le motif d’absence du justificatif'],
        ['registration ged document id', 'la carte grise'],
        ['remove registration', 'la suppression de la carte grise'],
        ['start segment', 'la période de début'],
        ['starts on', 'la date de début'],
        ['vat amount', 'le montant de TVA'],
    ]);

    function mobileErrorFallback(status = 0, code = '') {
        if (status === 401 || code === 'authentication_required') return 'Votre session a expiré. Reconnectez-vous.';
        if (status === 403 || code === 'forbidden') return 'Vous n’êtes pas autorisé à effectuer cette action.';
        if (status === 404 || code === 'not_found') return 'La ressource demandée est introuvable.';
        if (status === 409 || code === 'conflict') return 'Les données ont été modifiées. Actualisez puis réessayez.';
        if (status === 413 || code === 'file_too_large') return 'Ce fichier dépasse la taille autorisée.';
        if (status === 419 || code === 'session_expired') return 'La session de sécurité a expiré. Réessayez.';
        if (status === 422 || code === 'validation_failed') return 'Certaines informations saisies sont invalides.';
        if (status === 429 || code === 'rate_limited') return 'Trop de tentatives. Réessayez dans quelques instants.';
        if (status >= 500 || code === 'server_error') return 'Une erreur serveur est survenue. Réessayez dans quelques instants.';
        if (['network_unavailable', 'network_failure'].includes(code)) return 'La connexion au serveur a échoué.';
        return 'Cette opération n’a pas pu être effectuée.';
    }

    function mobileErrorFieldLabel(raw) {
        const normalized = String(raw || '').replace(/[_.]/g, ' ').trim().toLowerCase().replace(/\s+/g, ' ');
        return mobileErrorFieldLabels.get(normalized) || 'ce champ';
    }

    function localizedMobileErrorMessage(rawMessage, status = 0, code = '') {
        let message = String(rawMessage || '').replace(/<[^>]+>/g, '').trim();
        const exact = new Map([
            ['Unauthenticated.', 'Votre session a expiré. Reconnectez-vous.'],
            ['Unauthorized.', 'Vous n’êtes pas autorisé à effectuer cette action.'],
            ['Forbidden.', 'Vous n’êtes pas autorisé à effectuer cette action.'],
            ['Not Found.', 'La ressource demandée est introuvable.'],
            ['Page Expired.', 'Votre session a expiré. Reconnectez-vous.'],
            ['CSRF token mismatch.', 'La session de sécurité a expiré. Réessayez.'],
            ['Too Many Requests.', 'Trop de tentatives. Réessayez dans quelques instants.'],
            ['Method Not Allowed.', 'Cette action n’est pas disponible.'],
            ['Server Error.', 'Une erreur serveur est survenue.'],
            ['Internal Server Error.', 'Une erreur serveur est survenue.'],
            ['Network Error', 'La connexion au serveur a échoué.'],
            ['Failed to fetch', 'La connexion au serveur a échoué.'],
            ['Load failed', 'La connexion au serveur a échoué.'],
            ['The operation was aborted.', 'L’opération a été interrompue.'],
        ]);
        if (exact.has(message)) return exact.get(message);
        let match = /^The (.+) field is required\.?$/i.exec(message);
        if (match) message = `${mobileErrorFieldLabel(match[1]).replace(/^./, (letter) => letter.toUpperCase())} est obligatoire.`;
        match = /^The selected (.+) is invalid\.?$/i.exec(message);
        if (match) message = `La valeur sélectionnée pour ${mobileErrorFieldLabel(match[1])} est invalide.`;
        mobileErrorFieldLabels.forEach((label, identifier) => {
            const words = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const underscored = identifier.replace(/ /g, '_').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            message = message.replace(new RegExp(`\\b${words}\\b`, 'gi'), label);
            message = message.replace(new RegExp(`\\b${underscored}\\b`, 'gi'), label);
        });
        const englishError = /\b(the|field|must|should|required|invalid|failed|failure|error|not found|unauthorized|forbidden|unexpected|cannot|could not|timeout|too many requests|bad request|unprocessable|unavailable|unsupported|permission|denied|quota|aborted|offline|malformed|missing|no value)\b/i.test(message);
        return !message || englishError ? mobileErrorFallback(Number(status) || 0, String(code || '')) : message;
    }

    function localizedMobileErrorFields(fields, status = 422, code = 'validation_failed') {
        return Object.fromEntries(Object.entries(fields || {}).map(([field, messages]) => [
            field,
            (Array.isArray(messages) ? messages : [messages]).map((message) => localizedMobileErrorMessage(message, status, code)),
        ]));
    }

    async function api(path, options = {}) {
        const method = String(options.method || 'GET').toUpperCase();
        const requestId = crypto.randomUUID();
        const startedAt = performance.now();
        const normalizedPath = path.startsWith('http') ? new URL(path).pathname + new URL(path).search : path;
        const url = path.startsWith('http') ? path : `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
        const resolvedUrl = new URL(url, window.location.origin);
        const resolvedApiBaseUrl = new URL(`${apiBaseUrl}/`, window.location.origin);
        const trustedMobileApiTarget = resolvedUrl.origin === resolvedApiBaseUrl.origin
            && resolvedUrl.pathname.startsWith(resolvedApiBaseUrl.pathname);
        const offlineKind = trustedMobileApiTarget
            ? offlineCacheKind(resolvedUrl.href, { method, binary: options.binary === true })
            : null;
        if (state.offline) {
            const cached = await readOfflineResponse(resolvedUrl.href, offlineKind);
            diagnosticEntry({
                method,
                path: normalizedPath,
                status: cached ? 'cache hors ligne' : 'hors ligne',
                duration: Math.round(performance.now() - startedAt),
                requestId,
            });
            if (cached) return cached;
            throw offlineUnavailableError();
        }
        if (state.latency > 0) await sleep(state.latency);
        if (iosPwaRuntime && trustedMobileApiTarget && isWriteMethod(method)) {
            await ensureIosPwaCsrfCookie();
        }

        const headers = new Headers(options.headers || {});
        headers.set('Accept', options.binary ? '*/*' : 'application/json');
        headers.set('X-Request-Id', requestId);
        headers.set('X-App-Source', iosPwaRuntime ? 'ios-pwa' : (iosNativeRuntime ? 'ios' : 'app-emulator'));
        headers.set('X-App-Version-Code', String(state.versionCode));
        headers.set('X-App-Version-Name', state.versionName);
        headers.set('X-Device-Id', installationUuid);
        headers.set('X-Device-Name', iosRuntime ? 'Maison Pilote - iPhone ou iPad' : 'Navigateur Admin');
        if (iosRuntime) {
            headers.set('X-OS-Version', String(navigator.userAgent || navigator.platform || 'iOS').slice(0, 60));
            headers.set('X-Mobile-Session-Transport', iosPwaRuntime ? 'cookie' : 'bearer');
            if (iosNativeRuntime && !options.publicAuth && trustedMobileApiTarget && mobileAccessSession?.token) {
                headers.set('Authorization', `Bearer ${mobileAccessSession.token}`);
            }
            if (iosPwaRuntime && isWriteMethod(method)) {
                const xsrfToken = browserCookie('XSRF-TOKEN');
                if (xsrfToken) headers.set('X-XSRF-TOKEN', xsrfToken);
            }
        } else {
            headers.set('X-Android-Version', 'Émulateur navigateur');
            if (csrfToken) headers.set('X-CSRF-TOKEN', csrfToken);
        }
        if (state.cameleonSessionId) headers.set('X-Cameleon-Session', state.cameleonSessionId);
        if (isWriteMethod(method)) headers.set('Idempotency-Key', options.idempotencyKey || crypto.randomUUID());

        let body = options.body;
        if (body && !(body instanceof FormData) && !(body instanceof Blob) && typeof body !== 'string') {
            headers.set('Content-Type', 'application/json');
            body = JSON.stringify(body);
        }

        let response;
        try {
            response = await fetch(url, {
                method,
                headers,
                body,
                credentials: iosNativeRuntime ? 'omit' : 'same-origin',
                cache: 'no-store',
                keepalive: options.keepalive === true,
                ...(options.signal ? { signal: options.signal } : {}),
            });
        } catch (cause) {
            const cached = await readOfflineResponse(resolvedUrl.href, offlineKind);
            diagnosticEntry({
                method,
                path: normalizedPath,
                status: cached ? 'cache hors ligne' : 'réseau',
                duration: Math.round(performance.now() - startedAt),
                requestId,
            });
            if (cached) return cached;
            const error = offlineUnavailableError();
            error.code = 'network_failure';
            error.cause = cause;
            throw error;
        }

        const duration = Math.round(performance.now() - startedAt);
        if (options.binary && response.ok) {
            const blob = await response.blob();
            diagnosticEntry({ method, path: normalizedPath, status: response.status, duration, requestId: response.headers.get('X-Request-Id') || requestId });
            return { blob, response };
        }

        let payload = null;
        try { payload = await response.json(); } catch (_) { payload = null; }
        const correlatedId = payload?.meta?.request_id || response.headers.get('X-Request-Id') || requestId;
        diagnosticEntry({ method, path: normalizedPath, status: response.status, duration, requestId: correlatedId });

        if (!response.ok) {
            if ([500, 502, 503, 504].includes(response.status)) {
                const cached = await readOfflineResponse(resolvedUrl.href, offlineKind);
                if (cached) {
                    diagnosticEntry({ method, path: normalizedPath, status: 'cache hors ligne', duration, requestId: correlatedId });
                    return cached;
                }
            }
            const errorCode = payload?.error?.code || `http_${response.status}`;
            const error = new Error(localizedMobileErrorMessage(payload?.error?.message, response.status, errorCode));
            error.code = errorCode;
            error.status = response.status;
            error.retryable = Boolean(payload?.error?.retryable);
            error.fields = localizedMobileErrorFields(payload?.error?.fields, response.status, errorCode);
            error.requestId = correlatedId;
            error.payload = payload;
            throw error;
        }
        await storeOfflineResponse(resolvedUrl.href, offlineKind, payload);
        return payload;
    }

    async function controlRequest(url, { method = 'POST', body = null, respectOffline = true } = {}) {
        const requestId = crypto.randomUUID();
        const startedAt = performance.now();
        const normalizedUrl = new URL(url, window.location.origin);
        if (respectOffline && state.offline) {
            const error = new Error('Aucune connexion réseau.');
            error.code = 'network_unavailable';
            error.retryable = true;
            throw error;
        }
        if (respectOffline && state.latency > 0) await sleep(state.latency);

        let response;
        try {
            response = await fetch(normalizedUrl, {
                method,
                credentials: 'same-origin',
                cache: 'no-store',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Request-Id': requestId,
                },
                body: body === null ? null : JSON.stringify(body),
            });
        } catch (cause) {
            diagnosticEntry({ method, path: normalizedUrl.pathname, status: 'réseau', duration: Math.round(performance.now() - startedAt), requestId });
            const error = new Error('La connexion au serveur a échoué.');
            error.code = 'network_failure';
            error.retryable = true;
            error.cause = cause;
            throw error;
        }

        const payload = await response.json().catch(() => null);
        const correlatedId = payload?.meta?.request_id || response.headers.get('X-Request-Id') || requestId;
        diagnosticEntry({ method, path: normalizedUrl.pathname, status: response.status, duration: Math.round(performance.now() - startedAt), requestId: correlatedId });
        if (!response.ok) {
            const firstFieldError = Object.values(payload?.errors || {}).flat().find(Boolean);
            const errorCode = payload?.error?.code || `http_${response.status}`;
            const error = new Error(localizedMobileErrorMessage(payload?.error?.message || firstFieldError || payload?.message, response.status, errorCode));
            error.status = response.status;
            error.code = errorCode;
            error.requestId = correlatedId;
            throw error;
        }

        return payload;
    }

    function prepareMaisonPiloteRender() {
        state.externalApplication = null;
        state.signatureExperience = null;
        screen.classList.remove('is-external-application');
        screen.classList.remove('is-signature-experience');
        delete screen.dataset.externalApplication;
        delete screen.dataset.signatureExperience;
        app.setAttribute('aria-label', 'Maison Pilote');
    }

    function signatureExperienceUrl(raw) {
        let url;
        try {
            url = new URL(String(raw || ''), root.dataset.siteUrl);
        } catch (_) {
            return null;
        }
        const trustedOrigin = new URL(root.dataset.siteUrl).origin;
        const segments = url.pathname.split('/').filter(Boolean);
        const token = String(segments[1] || '');
        if (url.origin !== trustedOrigin
            || segments[0] !== 'signature'
            || token.length < 40
            || token.length > 100
            || !/^[A-Za-z0-9]+$/.test(token)) {
            return null;
        }
        url.searchParams.set('mobile_app', '1');
        url.searchParams.set('mobile_emulator', '1');
        return url;
    }

    function openSignatureExperience(raw) {
        const url = signatureExperienceUrl(raw);
        if (!url) return false;
        closeMobileSelect();
        stopMessagePolling();
        pauseUploadFeedbackDismissals();
        state.signatureExperience = url.toString();
        screen.classList.add('is-signature-experience');
        screen.dataset.signatureExperience = '1';
        app.setAttribute('aria-label', 'Signature électronique Maison Pilote');
        app.innerHTML = `<section class="mobile-signature-experience" data-mobile-signature-experience>
            <header class="mobile-signature-experience__header">
                <span><small>Maison Pilote</small><strong>Signature électronique</strong></span>
                <button type="button" data-mobile-signature-close aria-label="Fermer">×</button>
            </header>
            <iframe
                class="mobile-signature-experience__frame"
                src="${escapeHtml(url.toString())}"
                title="Signature électronique"
                sandbox="allow-downloads allow-forms allow-same-origin allow-scripts"
            ></iframe>
        </section>`;
        return true;
    }

    async function closeSignatureExperience() {
        if (!state.signatureExperience) return;
        state.signatureExperience = null;
        screen.classList.remove('is-signature-experience');
        delete screen.dataset.signatureExperience;
        if (state.authenticated) await navigate(state.route, state.routeParams, false);
        else renderLogin();
    }

    const cameraEditorFonts = [
        { key: 'sans', label: 'Sans', css: '700 1px system-ui, sans-serif' },
        { key: 'serif', label: 'Serif', css: '700 1px Georgia, serif' },
        { key: 'mono', label: 'Mono', css: '700 1px ui-monospace, monospace' },
        { key: 'cursive', label: 'Manuscrite', css: '400 1px cursive' },
    ];
    const cameraEditorColors = [
        { key: 'auto', label: 'Auto', value: null },
        { key: 'black', label: 'Noir', value: '#000000' },
        { key: 'white', label: 'Blanc', value: '#ffffff' },
        { key: 'red', label: 'Rouge', value: '#c62828' },
        { key: 'blue', label: 'Bleu', value: '#1565c0' },
        { key: 'green', label: 'Vert', value: '#2e7d32' },
        { key: 'yellow', label: 'Jaune', value: '#ffd600' },
    ];
    const cameraEditorMinimumCrop = .12;

    function cameraEditorUserKey() {
        return String(Math.max(0, Number(state.bootstrap?.profile?.id) || 0));
    }

    function defaultCameraEditor() {
        const rememberedFont = String(state.photoEditorFonts[cameraEditorUserKey()] || 'sans');
        const rememberedTextSize = Math.max(2, Math.min(50, Math.round(Number(state.photoEditorTextSizes[cameraEditorUserKey()]) || 18)));
        return {
            crop: { left: 0, top: 0, right: 1, bottom: 1 },
            texts: [],
            selectedTextId: null,
            imageRotation: 0,
            drag: null,
            paletteOffset: { x: 0, y: 0 },
            defaultFont: cameraEditorFonts.some(({ key }) => key === rememberedFont)
                ? rememberedFont
                : 'sans',
            defaultTextSize: rememberedTextSize,
        };
    }

    function normalizeCameraCrop(value) {
        const source = value && typeof value === 'object' ? value : {};
        const left = Math.max(0, Math.min(1 - cameraEditorMinimumCrop, Number(source.left) || 0));
        const top = Math.max(0, Math.min(1 - cameraEditorMinimumCrop, Number(source.top) || 0));
        const right = Math.max(left + cameraEditorMinimumCrop, Math.min(1, Number(source.right) || 1));
        const bottom = Math.max(top + cameraEditorMinimumCrop, Math.min(1, Number(source.bottom) || 1));
        return { left, top, right, bottom };
    }

    function cameraCropIsFull(value) {
        const crop = normalizeCameraCrop(value);
        return crop.left <= .001 && crop.top <= .001 && crop.right >= .999 && crop.bottom >= .999;
    }

    function cameraEditorFontCss(font, size) {
        const definition = cameraEditorFonts.find(({ key }) => key === font) || cameraEditorFonts[0];
        return definition.css.replace('1px', `${size}px`);
    }

    function normalizeCameraDegrees(value) {
        return ((Number(value) % 360) + 360) % 360;
    }

    function shortestCameraAngleDelta(from, to) {
        return ((to - from + 540) % 360) - 180;
    }

    function magneticCameraRotation(value, drag) {
        const normalized = normalizeCameraDegrees(value);
        const target = ((Math.round(normalized / 90) * 90) % 360 + 360) % 360;
        const delta = shortestCameraAngleDelta(normalized, target);
        const distance = Math.abs(delta);
        let result = normalized;
        let activeTarget = null;
        if (distance <= 6) {
            result = target;
            activeTarget = target;
        } else if (distance < 16) {
            const attraction = Math.max(0, Math.min(1, (16 - distance) / 10)) * .58;
            result = normalizeCameraDegrees(normalized + delta * attraction);
        }
        if (drag && activeTarget !== null && drag.magneticTarget !== activeTarget) {
            try { window.navigator.vibrate?.(10); } catch (_) { /* Le retour aimanté reste facultatif. */ }
        }
        if (drag) drag.magneticTarget = activeTarget;
        return result;
    }

    function cameraTextGeometry(canvas, crop, overlay) {
        const cropWidth = (crop.right - crop.left) * canvas.width;
        const cropHeight = (crop.bottom - crop.top) * canvas.height;
        const centerX = crop.left * canvas.width + Math.max(0, Math.min(1, Number(overlay.x) || 0)) * cropWidth;
        const centerY = crop.top * canvas.height + Math.max(0, Math.min(1, Number(overlay.y) || 0)) * cropHeight;
        const fontSize = Math.max(18, Math.min(640, cropWidth * Math.max(2, Math.min(50, Number(overlay.sizePercent) || 18)) / 100));
        const font = cameraEditorFontCss(overlay.font, fontSize);
        const measure = document.createElement('canvas').getContext('2d');
        measure.font = font;
        const lines = String(overlay.text ?? '').split('\n');
        const lineMetrics = lines.map((line) => measure.measureText(line || ' '));
        const metrics = lineMetrics[0] || measure.measureText(' ');
        const ascent = metrics.actualBoundingBoxAscent || fontSize * .82;
        const descent = metrics.actualBoundingBoxDescent || fontSize * .22;
        const lineHeight = (ascent + descent) * 1.15;
        return {
            centerX,
            centerY,
            width: Math.max(12, ...lineMetrics.map((line) => line.width)),
            height: Math.max(12, lineHeight * lines.length),
            ascent,
            descent,
            lines,
            lineHeight,
            font,
            rotation: normalizeCameraDegrees(overlay.rotation),
        };
    }

    function rotateCameraPoint(x, y, centerX, centerY, degrees) {
        const radians = degrees * Math.PI / 180;
        const dx = x - centerX;
        const dy = y - centerY;
        return {
            x: centerX + dx * Math.cos(radians) - dy * Math.sin(radians),
            y: centerY + dx * Math.sin(radians) + dy * Math.cos(radians),
        };
    }

    function cameraTextContains(canvas, crop, overlay, x, y) {
        const geometry = cameraTextGeometry(canvas, crop, overlay);
        const local = rotateCameraPoint(x, y, geometry.centerX, geometry.centerY, -geometry.rotation);
        return local.x >= geometry.centerX - geometry.width / 2 - 10
            && local.x <= geometry.centerX + geometry.width / 2 + 10
            && local.y >= geometry.centerY - geometry.height / 2 - 10
            && local.y <= geometry.centerY + geometry.height / 2 + 10;
    }

    function cameraTextRotationHandle(canvas, crop, overlay) {
        const geometry = cameraTextGeometry(canvas, crop, overlay);
        return rotateCameraPoint(
            geometry.centerX,
            geometry.centerY - geometry.height / 2 - Math.max(28, canvas.width * .09),
            geometry.centerX,
            geometry.centerY,
            geometry.rotation,
        );
    }

    function cameraTextControlPoints(canvas, crop, overlay) {
        const geometry = cameraTextGeometry(canvas, crop, overlay);
        const rotation = geometry.rotation * Math.PI / 180;
        const rotationHandle = cameraTextRotationHandle(canvas, crop, overlay);
        const spacing = Math.max(34, canvas.width * .085);
        const horizontal = { x: Math.cos(rotation) * spacing, y: Math.sin(rotation) * spacing };
        return {
            delete: { x: rotationHandle.x - horizontal.x, y: rotationHandle.y - horizontal.y },
            rotation: rotationHandle,
            move: { x: rotationHandle.x + horizontal.x, y: rotationHandle.y + horizontal.y },
        };
    }

    function adaptiveCameraLetterColor(imageData, canvas, geometry, characterLeft, characterWidth, lineCenterY, fixedColor) {
        if (fixedColor) return fixedColor;
        let luminance = 0;
        let samples = 0;
        [.2, .5, .8].forEach((vertical) => {
            [.2, .5, .8].forEach((horizontal) => {
                const point = rotateCameraPoint(
                    characterLeft + characterWidth * horizontal,
                    lineCenterY - geometry.lineHeight / 2 + geometry.lineHeight * vertical,
                    geometry.centerX,
                    geometry.centerY,
                    geometry.rotation,
                );
                const x = Math.max(0, Math.min(canvas.width - 1, Math.round(point.x)));
                const y = Math.max(0, Math.min(canvas.height - 1, Math.round(point.y)));
                const index = (y * canvas.width + x) * 4;
                luminance += (.2126 * imageData[index] + .7152 * imageData[index + 1] + .0722 * imageData[index + 2]) / 255;
                samples += 1;
            });
        });
        return luminance / Math.max(1, samples) < .52 ? '#ffffff' : '#000000';
    }

    function drawCameraEditorTexts(canvas, context, texts, crop) {
        texts.filter((overlay) => String(overlay.text || '').trim()).forEach((overlay) => {
            const value = String(overlay.text || '').slice(0, 120);
            const geometry = cameraTextGeometry(canvas, crop, overlay);
            const background = context.getImageData(0, 0, canvas.width, canvas.height).data;
            const fixedColor = cameraEditorColors.find(({ key }) => key === overlay.color)?.value || null;
            context.save();
            context.translate(geometry.centerX, geometry.centerY);
            context.rotate(geometry.rotation * Math.PI / 180);
            context.translate(-geometry.centerX, -geometry.centerY);
            context.font = geometry.font;
            context.textAlign = 'left';
            context.textBaseline = 'alphabetic';
            const lines = value.split('\n');
            const blockTop = geometry.centerY - geometry.lineHeight * lines.length / 2;
            lines.forEach((line, lineIndex) => {
                const characters = Array.from(line);
                const widths = characters.map((character) => context.measureText(character).width);
                let cursor = geometry.centerX - widths.reduce((total, width) => total + width, 0) / 2;
                const lineCenterY = blockTop + geometry.lineHeight * (lineIndex + .5);
                const baseline = lineCenterY + (geometry.ascent - geometry.descent) / 2;
                characters.forEach((character, index) => {
                    const width = widths[index];
                    if (!/\s/u.test(character)) {
                        context.fillStyle = adaptiveCameraLetterColor(background, canvas, geometry, cursor, width, lineCenterY, fixedColor);
                        context.fillText(character, cursor, baseline);
                    }
                    cursor += width;
                });
            });
            context.restore();
        });
    }

    function drawCameraRotationHandle(context, centerX, centerY, radius) {
        context.save();
        context.fillStyle = 'rgba(0, 0, 0, .34)';
        context.beginPath();
        context.arc(centerX, centerY, radius * 1.08, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#7e3eb2';
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#ffffff';
        context.translate(centerX - radius * .68, centerY - radius * .68);
        context.scale(radius * 1.36 / 24, radius * 1.36 / 24);
        context.fill(new Path2D('M15.55 5.55 11 1v3.07C7.06 4.56 4 7.92 4 12s3.05 7.44 7 7.93v-2.02C8.16 17.43 6 14.97 6 12s2.16-5.43 5-5.91V10l4.55-4.45z'));
        context.restore();
    }

    function drawCameraCropOverlay(canvas, context, crop, editor) {
        const left = crop.left * canvas.width;
        const top = crop.top * canvas.height;
        const right = crop.right * canvas.width;
        const bottom = crop.bottom * canvas.height;
        context.save();
        context.fillStyle = 'rgba(0, 0, 0, .58)';
        context.fillRect(0, 0, canvas.width, top);
        context.fillRect(0, bottom, canvas.width, canvas.height - bottom);
        context.fillRect(0, top, left, bottom - top);
        context.fillRect(right, top, canvas.width - right, bottom - top);
        context.strokeStyle = '#ffffff';
        context.lineWidth = Math.max(2.5, canvas.width / 380);
        context.strokeRect(left, top, right - left, bottom - top);
        const outerRadius = Math.max(8, canvas.width / 95);
        const innerRadius = outerRadius * .62;
        [[left, top], [right, top], [left, bottom], [right, bottom]].forEach(([x, y]) => {
            context.beginPath();
            context.fillStyle = '#7e3eb2';
            context.arc(x, y, outerRadius, 0, Math.PI * 2);
            context.fill();
            context.beginPath();
            context.fillStyle = '#ffffff';
            context.arc(x, y, innerRadius, 0, Math.PI * 2);
            context.fill();
        });

        const selected = editor.texts.find((overlay) => String(overlay.id) === String(editor.selectedTextId));
        if (selected && String(selected.text || '').trim()) {
            const geometry = cameraTextGeometry(canvas, crop, selected);
            const corners = [
                [geometry.centerX - geometry.width / 2, geometry.centerY - geometry.height / 2],
                [geometry.centerX + geometry.width / 2, geometry.centerY - geometry.height / 2],
                [geometry.centerX + geometry.width / 2, geometry.centerY + geometry.height / 2],
                [geometry.centerX - geometry.width / 2, geometry.centerY + geometry.height / 2],
            ].map(([x, y]) => rotateCameraPoint(x, y, geometry.centerX, geometry.centerY, geometry.rotation));
            context.beginPath();
            context.moveTo(corners[0].x, corners[0].y);
            corners.slice(1).forEach((point) => context.lineTo(point.x, point.y));
            context.closePath();
            context.stroke();
            const topCenter = { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 };
            const handle = cameraTextRotationHandle(canvas, crop, selected);
            context.beginPath();
            context.moveTo(topCenter.x, topCenter.y);
            context.lineTo(handle.x, handle.y);
            context.stroke();
            corners.forEach((corner) => {
                context.beginPath();
                context.fillStyle = '#7e3eb2';
                context.arc(corner.x, corner.y, outerRadius * .82, 0, Math.PI * 2);
                context.fill();
                context.beginPath();
                context.fillStyle = '#ffffff';
                context.arc(corner.x, corner.y, innerRadius * .72, 0, Math.PI * 2);
                context.fill();
            });
        }
        context.restore();
    }

    async function renderCameraEditorCanvas(file, editor, { cropOutput = false, showCrop = true } = {}) {
        const invocation = state.externalApplication;
        let bitmap = invocation?.cameraEditorBitmap?.file === file ? invocation.cameraEditorBitmap.bitmap : null;
        let releaseBitmap = false;
        if (!bitmap) {
            bitmap = await createImageBitmap(file);
            if (invocation?.kind === 'camera') {
                invocation.cameraEditorBitmap?.bitmap?.close?.();
                invocation.cameraEditorBitmap = { file, bitmap };
            } else releaseBitmap = true;
        }
        const crop = normalizeCameraCrop(editor.crop);
        const sourceLeft = cropOutput ? crop.left * bitmap.width : 0;
        const sourceTop = cropOutput ? crop.top * bitmap.height : 0;
        const sourceWidth = cropOutput ? (crop.right - crop.left) * bitmap.width : bitmap.width;
        const sourceHeight = cropOutput ? (crop.bottom - crop.top) * bitmap.height : bitmap.height;
        const maximumDimension = cropOutput ? 2200 : 1050;
        const scale = Math.min(1, maximumDimension / Math.max(sourceWidth, sourceHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(sourceWidth * scale));
        canvas.height = Math.max(1, Math.round(sourceHeight * scale));
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(
            bitmap,
            sourceLeft,
            sourceTop,
            sourceWidth,
            sourceHeight,
            0,
            0,
            canvas.width,
            canvas.height,
        );
        const effectiveCrop = cropOutput ? { left: 0, top: 0, right: 1, bottom: 1 } : crop;
        drawCameraEditorTexts(canvas, context, editor.texts || [], effectiveCrop);
        if (!cropOutput && showCrop) drawCameraCropOverlay(canvas, context, crop, editor);
        if (releaseBitmap) bitmap.close();
        if (!cropOutput) return canvas;

        const rotation = normalizeCameraDegrees(editor.imageRotation);
        if (rotation < .01 || rotation > 359.99) return canvas;
        const radians = rotation * Math.PI / 180;
        const rotatedWidth = Math.abs(canvas.width * Math.cos(radians)) + Math.abs(canvas.height * Math.sin(radians));
        const rotatedHeight = Math.abs(canvas.width * Math.sin(radians)) + Math.abs(canvas.height * Math.cos(radians));
        const rotated = document.createElement('canvas');
        rotated.width = Math.max(1, Math.ceil(rotatedWidth));
        rotated.height = Math.max(1, Math.ceil(rotatedHeight));
        const rotatedContext = rotated.getContext('2d');
        rotatedContext.fillStyle = '#ffffff';
        rotatedContext.fillRect(0, 0, rotated.width, rotated.height);
        rotatedContext.translate(rotated.width / 2, rotated.height / 2);
        rotatedContext.rotate(radians);
        rotatedContext.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
        return rotated;
    }

    function cameraEditorVisualMetrics(canvas) {
        const preview = canvas.closest('[data-mobile-camera-editor-preview]');
        const editor = state.externalApplication?.cameraEditor || defaultCameraEditor();
        if (!preview) return null;
        const previewRect = preview.getBoundingClientRect();
        const width = Math.max(1, canvas.offsetWidth);
        const height = Math.max(1, canvas.offsetHeight);
        const radians = normalizeCameraDegrees(editor.imageRotation) * Math.PI / 180;
        const rotatedWidth = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians));
        const rotatedHeight = Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians));
        const scale = Math.min(1, (preview.clientWidth - 8) / Math.max(1, rotatedWidth), (preview.clientHeight - 8) / Math.max(1, rotatedHeight));
        return {
            preview,
            previewRect,
            width,
            height,
            scale,
            rotation: normalizeCameraDegrees(editor.imageRotation),
            centerX: previewRect.left + previewRect.width / 2,
            centerY: previewRect.top + previewRect.height / 2,
        };
    }

    function updateCameraEditorVisualTransform() {
        const canvas = app.querySelector('[data-mobile-camera-editor-canvas]');
        if (!(canvas instanceof HTMLCanvasElement)) return;
        const metrics = cameraEditorVisualMetrics(canvas);
        if (!metrics) return;
        canvas.style.transform = `rotate(${metrics.rotation}deg) scale(${metrics.scale})`;
        positionCameraInlineTextEditor(canvas, metrics);
        positionCameraImageRotationHandle(canvas, metrics);
        positionCameraCropHandles(canvas, metrics);
        positionCameraTextControls(canvas, metrics);
        positionCameraTextPalette(canvas, metrics);
    }

    function positionCameraImageRotationHandle(canvas, metrics = cameraEditorVisualMetrics(canvas)) {
        const handle = app.querySelector('[data-mobile-camera-image-rotation]');
        if (!(handle instanceof HTMLElement) || !metrics) return;
        const displayInset = 19;
        const rawInset = displayInset * canvas.height / Math.max(1, metrics.height * metrics.scale);
        const point = cameraEditorPointToClient(canvas, canvas.width / 2, Math.min(canvas.height, rawInset), metrics);
        handle.style.left = `${point.x - metrics.previewRect.left}px`;
        handle.style.top = `${point.y - metrics.previewRect.top}px`;
    }

    function positionCameraCropHandles(canvas, metrics = cameraEditorVisualMetrics(canvas)) {
        const editor = state.externalApplication?.cameraEditor;
        if (!editor || !metrics) return;
        const crop = normalizeCameraCrop(editor.crop);
        const points = {
            'top-left': [crop.left * canvas.width, crop.top * canvas.height],
            'top-right': [crop.right * canvas.width, crop.top * canvas.height],
            'bottom-left': [crop.left * canvas.width, crop.bottom * canvas.height],
            'bottom-right': [crop.right * canvas.width, crop.bottom * canvas.height],
        };
        app.querySelectorAll('[data-mobile-camera-crop-handle]').forEach((handle) => {
            const raw = points[handle.dataset.mobileCameraCropHandle];
            if (!raw) return;
            const point = cameraEditorPointToClient(canvas, raw[0], raw[1], metrics);
            handle.style.left = `${point.x - metrics.previewRect.left}px`;
            handle.style.top = `${point.y - metrics.previewRect.top}px`;
        });
    }

    function positionCameraTextControls(canvas, metrics = cameraEditorVisualMetrics(canvas)) {
        const editor = state.externalApplication?.cameraEditor;
        const overlay = editor?.texts?.find((item) => String(item.id) === String(editor.selectedTextId));
        if (!overlay || !metrics) return;
        const crop = normalizeCameraCrop(editor.crop);
        const geometry = cameraTextGeometry(canvas, crop, overlay);
        const corners = [
            [geometry.centerX - geometry.width / 2, geometry.centerY - geometry.height / 2],
            [geometry.centerX + geometry.width / 2, geometry.centerY - geometry.height / 2],
            [geometry.centerX + geometry.width / 2, geometry.centerY + geometry.height / 2],
            [geometry.centerX - geometry.width / 2, geometry.centerY + geometry.height / 2],
        ].map(([x, y]) => rotateCameraPoint(x, y, geometry.centerX, geometry.centerY, geometry.rotation));
        app.querySelectorAll('[data-mobile-camera-text-resize]').forEach((handle, index) => {
            const raw = corners[index];
            if (!raw) return;
            const point = cameraEditorPointToClient(canvas, raw.x, raw.y, metrics);
            handle.style.left = `${point.x - metrics.previewRect.left}px`;
            handle.style.top = `${point.y - metrics.previewRect.top}px`;
        });
        const rotationRaw = cameraTextRotationHandle(canvas, crop, overlay);
        const rotationPoint = cameraEditorPointToClient(canvas, rotationRaw.x, rotationRaw.y, metrics);
        const radians = (metrics.rotation + geometry.rotation) * Math.PI / 180;
        const spacing = 29;
        const points = {
            delete: { x: rotationPoint.x - Math.cos(radians) * spacing, y: rotationPoint.y - Math.sin(radians) * spacing },
            rotation: rotationPoint,
            move: { x: rotationPoint.x + Math.cos(radians) * spacing, y: rotationPoint.y + Math.sin(radians) * spacing },
        };
        [
            ['[data-mobile-camera-editor-delete-text]', points.delete],
            ['[data-mobile-camera-text-rotation]', points.rotation],
            ['[data-mobile-camera-text-move]', points.move],
        ].forEach(([selector, raw]) => {
            const handle = app.querySelector(selector);
            if (!(handle instanceof HTMLElement)) return;
            handle.style.left = `${raw.x - metrics.previewRect.left}px`;
            handle.style.top = `${raw.y - metrics.previewRect.top}px`;
        });
    }

    function positionCameraTextPalette(canvas, metrics = cameraEditorVisualMetrics(canvas)) {
        const palette = app.querySelector('[data-mobile-camera-text-palette]');
        const editor = state.externalApplication?.cameraEditor;
        const overlay = editor?.texts?.find((item) => String(item.id) === String(editor.selectedTextId));
        if (!(palette instanceof HTMLElement) || !overlay || !metrics) return;
        const geometry = cameraTextGeometry(canvas, normalizeCameraCrop(editor.crop), overlay);
        const rawCorners = [
            [geometry.centerX - geometry.width / 2, geometry.centerY - geometry.height / 2],
            [geometry.centerX + geometry.width / 2, geometry.centerY - geometry.height / 2],
            [geometry.centerX + geometry.width / 2, geometry.centerY + geometry.height / 2],
            [geometry.centerX - geometry.width / 2, geometry.centerY + geometry.height / 2],
        ].map(([x, y]) => rotateCameraPoint(x, y, geometry.centerX, geometry.centerY, geometry.rotation))
            .map((point) => cameraEditorPointToClient(canvas, point.x, point.y, metrics));
        const localCorners = rawCorners.map((point) => ({ x: point.x - metrics.previewRect.left, y: point.y - metrics.previewRect.top }));
        const centerX = localCorners.reduce((sum, point) => sum + point.x, 0) / localCorners.length;
        const top = Math.min(...localCorners.map((point) => point.y));
        const bottom = Math.max(...localCorners.map((point) => point.y));
        const margin = 6;
        const width = Math.min(340, metrics.preview.clientWidth - margin * 2);
        palette.style.width = `${Math.max(1, width)}px`;
        const height = palette.offsetHeight || 96;
        const crop = normalizeCameraCrop(editor.crop);
        const displayInset = 19 * canvas.height / Math.max(1, metrics.height * metrics.scale);
        const controls = cameraTextControlPoints(canvas, crop, overlay);
        const protectedRaw = [
            [crop.left * canvas.width, crop.top * canvas.height],
            [crop.right * canvas.width, crop.top * canvas.height],
            [crop.left * canvas.width, crop.bottom * canvas.height],
            [crop.right * canvas.width, crop.bottom * canvas.height],
            [canvas.width / 2, Math.min(canvas.height, displayInset)],
            ...rawCorners.map((point) => {
                const raw = cameraEditorClientToPoint(canvas, point.x, point.y, metrics);
                return [raw.pixelX, raw.pixelY];
            }),
            [controls.delete.x, controls.delete.y],
            [controls.rotation.x, controls.rotation.y],
            [controls.move.x, controls.move.y],
        ];
        const protectedPoints = protectedRaw.map(([x, y]) => cameraEditorPointToClient(canvas, x, y, metrics))
            .map((point) => ({ x: point.x - metrics.previewRect.left, y: point.y - metrics.previewRect.top }));
        const protection = 29;
        const avoidsHandles = (candidate) => protectedPoints.every((point) => point.x < candidate.left - protection
            || point.x > candidate.left + width + protection
            || point.y < candidate.top - protection
            || point.y > candidate.top + height + protection);
        const viewportBottom = window.visualViewport
            ? window.visualViewport.offsetTop + window.visualViewport.height
            : window.innerHeight;
        const availableBottom = Math.min(metrics.preview.clientHeight - margin, viewportBottom - metrics.previewRect.top - margin);
        const clampVisible = (left, candidateTop) => ({
            left: Math.max(margin, Math.min(metrics.preview.clientWidth - width - margin, left)),
            top: Math.max(margin, Math.min(availableBottom - height, candidateTop)),
        });
        const controlRects = [
            '[data-mobile-camera-editor-delete-text]',
            '[data-mobile-camera-text-rotation]',
            '[data-mobile-camera-text-move]',
        ].map((selector) => app.querySelector(selector)?.getBoundingClientRect()).filter(Boolean);
        const controlsTop = controlRects.length
            ? Math.min(...controlRects.map((rect) => rect.top - metrics.previewRect.top))
            : top;
        const controlsBottom = controlRects.length
            ? Math.max(...controlRects.map((rect) => rect.bottom - metrics.previewRect.top))
            : top;
        const desiredLeft = centerX - width / 2;
        const bottomTop = Math.max(bottom, controlsBottom) + 8;
        const topTop = Math.min(top, controlsTop) - height - 18;
        const bottomCandidate = clampVisible(desiredLeft, bottomTop);
        const topCandidate = clampVisible(desiredLeft, topTop);
        const bottomFits = bottomTop + height <= availableBottom && avoidsHandles(bottomCandidate);
        const topFits = topTop >= margin && avoidsHandles(topCandidate);
        const automaticPosition = bottomFits ? bottomCandidate : topFits ? topCandidate : topCandidate;
        palette.dataset.automaticLeft = String(automaticPosition.left);
        palette.dataset.automaticTop = String(automaticPosition.top);
        const offset = editor.paletteOffset && typeof editor.paletteOffset === 'object' ? editor.paletteOffset : { x: 0, y: 0 };
        const position = clampVisible(
            automaticPosition.left + (Number(offset.x) || 0),
            automaticPosition.top + (Number(offset.y) || 0),
        );
        palette.style.left = `${position.left}px`;
        palette.style.top = `${position.top}px`;
        palette.dataset.placement = bottomFits ? 'bottom' : 'top';
    }

    function positionCameraInlineTextEditor(canvas, metrics = cameraEditorVisualMetrics(canvas)) {
        const input = app.querySelector('[data-mobile-camera-inline-text]');
        const editor = state.externalApplication?.cameraEditor;
        const overlay = editor?.texts?.find((item) => String(item.id) === String(editor.selectedTextId));
        if (!(input instanceof HTMLTextAreaElement) || !overlay || !metrics) return;
        const crop = normalizeCameraCrop(editor.crop);
        const geometry = cameraTextGeometry(canvas, crop, overlay);
        const rawX = (geometry.centerX / canvas.width - .5) * metrics.width;
        const rawY = (geometry.centerY / canvas.height - .5) * metrics.height;
        const rotated = rotateCameraPoint(rawX, rawY, 0, 0, metrics.rotation);
        const left = metrics.previewRect.width / 2 + rotated.x * metrics.scale;
        const top = metrics.previewRect.height / 2 + rotated.y * metrics.scale;
        input.style.left = `${left}px`;
        input.style.top = `${top}px`;
        input.style.width = `${Math.max(72, geometry.width * metrics.width / canvas.width * metrics.scale + 28)}px`;
        input.style.height = `${Math.max(34, geometry.height * metrics.height / canvas.height * metrics.scale + 18)}px`;
        input.style.font = cameraEditorFontCss(overlay.font, Math.max(12, geometry.lineHeight * metrics.height / canvas.height * metrics.scale * .8));
        input.style.lineHeight = '1.15';
        input.style.transform = `translate(-50%, -50%) rotate(${normalizeCameraDegrees(metrics.rotation + Number(overlay.rotation || 0))}deg)`;
    }

    function cameraEditorPointToClient(canvas, x, y, metrics = cameraEditorVisualMetrics(canvas)) {
        if (!metrics) return { x: 0, y: 0 };
        const rawX = (x / canvas.width - .5) * metrics.width;
        const rawY = (y / canvas.height - .5) * metrics.height;
        const rotated = rotateCameraPoint(rawX, rawY, 0, 0, metrics.rotation);
        return { x: metrics.centerX + rotated.x * metrics.scale, y: metrics.centerY + rotated.y * metrics.scale };
    }

    function cameraEditorClientToPoint(canvas, clientX, clientY, metrics = cameraEditorVisualMetrics(canvas)) {
        if (!metrics) return { x: 0, y: 0, rect: { width: 1, height: 1 } };
        const unrotated = rotateCameraPoint(
            (clientX - metrics.centerX) / metrics.scale,
            (clientY - metrics.centerY) / metrics.scale,
            0,
            0,
            -metrics.rotation,
        );
        const localX = unrotated.x + metrics.width / 2;
        const localY = unrotated.y + metrics.height / 2;
        return {
            x: Math.max(0, Math.min(1, localX / metrics.width)),
            y: Math.max(0, Math.min(1, localY / metrics.height)),
            pixelX: Math.max(0, Math.min(canvas.width, localX * canvas.width / metrics.width)),
            pixelY: Math.max(0, Math.min(canvas.height, localY * canvas.height / metrics.height)),
            rect: { width: metrics.width * metrics.scale, height: metrics.height * metrics.scale },
            metrics,
        };
    }

    async function drawCameraEditorPreview() {
        const invocation = state.externalApplication;
        const pages = Array.isArray(invocation?.cameraPages) ? invocation.cameraPages : [];
        const selectedIndex = Math.max(0, Math.min(pages.length - 1, Math.trunc(Number(invocation?.cameraSelectedIndex) || 0)));
        const file = pages[selectedIndex];
        const target = app.querySelector('[data-mobile-camera-editor-canvas]');
        if (!invocation || invocation.kind !== 'camera' || !file || !(target instanceof HTMLCanvasElement)) return;
        const renderId = (invocation.cameraEditorRenderId || 0) + 1;
        invocation.cameraEditorRenderId = renderId;
        try {
            const rendered = await renderCameraEditorCanvas(file, invocation.cameraEditor || defaultCameraEditor());
            if (state.externalApplication !== invocation || invocation.cameraEditorRenderId !== renderId || !target.isConnected) return;
            target.width = rendered.width;
            target.height = rendered.height;
            target.getContext('2d').drawImage(rendered, 0, 0);
            target.classList.remove('is-loading');
            updateCameraEditorVisualTransform();
        } catch (error) {
            const status = app.querySelector('.mobile-external-application__status');
            if (status) status.textContent = error?.message || 'L’aperçu n’a pas pu être préparé.';
        }
    }

    async function applyCameraPageEdits(file, editor) {
        if (!(file instanceof File)) throw new Error('Photographiez une image avant de la transmettre.');
        const hasText = Array.isArray(editor?.texts) && editor.texts.some((overlay) => String(overlay.text || '').trim());
        if (cameraCropIsFull(editor?.crop) && !hasText && Math.abs(normalizeCameraDegrees(editor?.imageRotation || 0)) < .01) return file;
        const rendered = await renderCameraEditorCanvas(file, editor || defaultCameraEditor(), { cropOutput: true, showCrop: false });
        return canvasFile(rendered, `edited-${Date.now()}.jpg`, 'image/jpeg', .92);
    }

    function scheduleCameraEditorPreview() {
        const invocation = state.externalApplication;
        if (!invocation || invocation.kind !== 'camera' || invocation.cameraEditorPreviewScheduled) return;
        invocation.cameraEditorPreviewScheduled = true;
        window.requestAnimationFrame(() => {
            if (state.externalApplication !== invocation) return;
            invocation.cameraEditorPreviewScheduled = false;
            void drawCameraEditorPreview();
        });
    }

    function changeSelectedCameraTextSize(step) {
        const invocation = state.externalApplication;
        const editor = invocation?.cameraEditor;
        const overlay = editor?.texts?.find((item) => String(item.id) === String(editor.selectedTextId));
        if (!overlay) return;
        overlay.sizePercent = Math.max(2, Math.min(50, Math.round(Number(overlay.sizePercent) || 18) + step));
        editor.defaultTextSize = overlay.sizePercent;
        state.photoEditorTextSizes[cameraEditorUserKey()] = overlay.sizePercent;
        persistPreferences();
        const input = app.querySelector('[data-mobile-camera-editor-size]');
        if (input instanceof HTMLInputElement) input.value = String(overlay.sizePercent);
        updateCameraEditorVisualTransform();
        scheduleCameraEditorPreview();
    }

    function startCameraTextSizeStep(button, event) {
        const editor = state.externalApplication?.cameraEditor;
        if (!editor || (event.pointerType === 'mouse' && event.button !== 0)) return false;
        finishCameraTextSizeStep();
        const step = Number(button.dataset.mobileCameraEditorSizeStep);
        if (!Number.isFinite(step) || step === 0) return false;
        changeSelectedCameraTextSize(step);
        let interval = 185;
        const hold = { pointerId: event.pointerId, button, timer: 0 };
        const repeat = () => {
            if (state.externalApplication?.cameraEditor?.sizeStepHold !== hold) return;
            changeSelectedCameraTextSize(step);
            interval = Math.max(42, interval * .82);
            hold.timer = window.setTimeout(repeat, interval);
        };
        hold.timer = window.setTimeout(repeat, 360);
        editor.sizeStepHold = hold;
        button.setPointerCapture?.(event.pointerId);
        return true;
    }

    function finishCameraTextSizeStep(event = null) {
        const editor = state.externalApplication?.cameraEditor;
        const hold = editor?.sizeStepHold;
        if (!hold || (event && hold.pointerId !== event.pointerId)) return false;
        window.clearTimeout(hold.timer);
        if (hold.button?.hasPointerCapture?.(hold.pointerId)) hold.button.releasePointerCapture(hold.pointerId);
        editor.sizeStepHold = null;
        return true;
    }

    function cameraEditorPointerPosition(canvas, event) {
        return cameraEditorClientToPoint(canvas, event.clientX, event.clientY);
    }

    function cameraCropDragTarget(point, crop) {
        const threshold = Math.min(.12, 28 / Math.max(1, Math.min(point.rect.width, point.rect.height)));
        const corners = [
            ['top-left', crop.left, crop.top],
            ['top-right', crop.right, crop.top],
            ['bottom-left', crop.left, crop.bottom],
            ['bottom-right', crop.right, crop.bottom],
        ];
        const nearest = corners.reduce((best, candidate) => {
            const distance = Math.abs(point.x - candidate[1]) + Math.abs(point.y - candidate[2]);
            return !best || distance < best.distance ? { candidate, distance } : best;
        }, null)?.candidate;
        return nearest && Math.abs(point.x - nearest[1]) <= threshold && Math.abs(point.y - nearest[2]) <= threshold ? nearest[0] : null;
    }

    function cameraEditorHitText(canvas, editor, point) {
        const crop = normalizeCameraCrop(editor.crop);
        return [...(editor.texts || [])].reverse().find((overlay) => String(overlay.text || '').trim()
            && cameraTextContains(canvas, crop, overlay, point.pixelX, point.pixelY)) || null;
    }

    function cameraEditorPointerAngle(centerX, centerY, point) {
        return Math.atan2(point.pixelY - centerY, point.pixelX - centerX) * 180 / Math.PI;
    }

    function updateCameraEditorPointer(event, begin = false) {
        const invocation = state.externalApplication;
        const editor = invocation?.cameraEditor;
        const canvas = app.querySelector('[data-mobile-camera-editor-canvas]');
        if (!invocation || invocation.kind !== 'camera' || !editor || !(canvas instanceof HTMLCanvasElement)) return false;
        if (event.pointerType === 'mouse' && event.button !== 0 && begin) return false;
        const point = cameraEditorPointerPosition(canvas, event);
        const crop = normalizeCameraCrop(editor.crop);
        if (begin) {
            const threshold = 30 * canvas.width / Math.max(1, point.rect.width);
            const selected = (editor.texts || []).find((overlay) => String(overlay.id) === String(editor.selectedTextId));
            const textHandle = selected ? cameraTextRotationHandle(canvas, crop, selected) : null;
            const distance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);
            const explicitCropTarget = event.target.closest('[data-mobile-camera-crop-handle]')?.dataset.mobileCameraCropHandle || null;
            const explicitTextResize = event.target.closest('[data-mobile-camera-text-resize]')?.dataset.mobileCameraTextResize || null;
            const cropTarget = explicitCropTarget || cameraCropDragTarget(point, crop);
            const hitText = event.target.closest('[data-mobile-camera-inline-text]') ? selected : cameraEditorHitText(canvas, editor, point);
            if (event.target.closest('[data-mobile-camera-image-rotation]')) {
                const metrics = point.metrics || cameraEditorVisualMetrics(canvas);
                editor.drag = {
                    pointerId: event.pointerId,
                    target: 'image-rotation',
                    centerClientX: metrics?.centerX || event.clientX,
                    centerClientY: metrics?.centerY || event.clientY,
                    startAngle: Math.atan2(event.clientY - (metrics?.centerY || event.clientY), event.clientX - (metrics?.centerX || event.clientX)) * 180 / Math.PI,
                    startRotation: Number(editor.imageRotation) || 0,
                };
            } else if (explicitCropTarget) {
                editor.drag = { pointerId: event.pointerId, target: explicitCropTarget, crop: { ...crop } };
            } else if (selected && explicitTextResize) {
                const geometry = cameraTextGeometry(canvas, crop, selected);
                editor.drag = {
                    pointerId: event.pointerId,
                    target: 'text-resize',
                    textId: selected.id,
                    centerX: geometry.centerX,
                    centerY: geometry.centerY,
                    startDistance: Math.max(1, Math.hypot(point.pixelX - geometry.centerX, point.pixelY - geometry.centerY)),
                    startSize: Math.max(2, Math.min(50, Number(selected.sizePercent) || 18)),
                };
            } else if (selected && event.target.closest('[data-mobile-camera-text-move]')) {
                editor.drag = {
                    pointerId: event.pointerId,
                    target: 'text-move-handle',
                    textId: selected.id,
                    startPointX: point.x,
                    startPointY: point.y,
                    startX: Number(selected.x) || .5,
                    startY: Number(selected.y) || .5,
                };
            } else if (selected && event.target.closest('[data-mobile-camera-text-rotation]')) {
                const geometry = cameraTextGeometry(canvas, crop, selected);
                editor.drag = {
                    pointerId: event.pointerId,
                    target: 'text-rotation',
                    textId: selected.id,
                    centerX: geometry.centerX,
                    centerY: geometry.centerY,
                    startAngle: cameraEditorPointerAngle(geometry.centerX, geometry.centerY, point),
                    startRotation: Number(selected.rotation) || 0,
                };
            } else if (textHandle && distance(textHandle, { x: point.pixelX, y: point.pixelY }) <= threshold) {
                editor.drag = {
                    pointerId: event.pointerId,
                    target: 'text-rotation',
                    textId: selected.id,
                    centerX: cameraTextGeometry(canvas, crop, selected).centerX,
                    centerY: cameraTextGeometry(canvas, crop, selected).centerY,
                    startAngle: cameraEditorPointerAngle(cameraTextGeometry(canvas, crop, selected).centerX, cameraTextGeometry(canvas, crop, selected).centerY, point),
                    startRotation: Number(selected.rotation) || 0,
                };
            } else if (cropTarget) {
                editor.drag = { pointerId: event.pointerId, target: cropTarget, crop: { ...crop } };
            } else if (hitText) {
                editor.selectedTextId = hitText.id;
                editor.drag = {
                    pointerId: event.pointerId,
                    target: 'text-pending',
                    textId: hitText.id,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    fromInlineEditor: event.target.closest('[data-mobile-camera-inline-text]') !== null,
                    longPressTimer: window.setTimeout(() => {
                        if (editor.drag?.pointerId === event.pointerId && editor.drag.target === 'text-pending') {
                            editor.drag.target = 'text-move';
                            try { window.navigator.vibrate?.(12); } catch (_) { /* Optional haptic feedback. */ }
                        }
                    }, 420),
                };
                scheduleCameraEditorPreview();
            } else {
                editor.selectedTextId = null;
                renderExternalCameraReview();
                return false;
            }
            const captureElement = event.target instanceof Element ? event.target : canvas;
            captureElement.setPointerCapture?.(event.pointerId);
            editor.drag.captureElement = captureElement;
        } else if (!editor.drag || editor.drag.pointerId !== event.pointerId) {
            return false;
        }

        if (editor.drag.target === 'text-pending') {
            if (Math.hypot(event.clientX - editor.drag.startClientX, event.clientY - editor.drag.startClientY) > 12) {
                window.clearTimeout(editor.drag.longPressTimer);
            }
            return true;
        }
        if (editor.drag.target === 'text-move' || editor.drag.target === 'text-move-handle') {
            const overlay = editor.texts.find((item) => String(item.id) === String(editor.drag.textId));
            if (overlay) {
                const geometry = cameraTextGeometry(canvas, crop, overlay);
                const radians = geometry.rotation * Math.PI / 180;
                const rotatedWidth = Math.abs(geometry.width * Math.cos(radians)) + Math.abs(geometry.height * Math.sin(radians));
                const rotatedHeight = Math.abs(geometry.width * Math.sin(radians)) + Math.abs(geometry.height * Math.cos(radians));
                const marginX = Math.min(.49, rotatedWidth / Math.max(1, 2 * (crop.right - crop.left) * canvas.width));
                const marginY = Math.min(.49, rotatedHeight / Math.max(1, 2 * (crop.bottom - crop.top) * canvas.height));
                const desiredX = editor.drag.target === 'text-move-handle'
                    ? editor.drag.startX + (point.x - editor.drag.startPointX) / Math.max(.001, crop.right - crop.left)
                    : (point.x - crop.left) / Math.max(.001, crop.right - crop.left);
                const desiredY = editor.drag.target === 'text-move-handle'
                    ? editor.drag.startY + (point.y - editor.drag.startPointY) / Math.max(.001, crop.bottom - crop.top)
                    : (point.y - crop.top) / Math.max(.001, crop.bottom - crop.top);
                overlay.x = Math.max(marginX, Math.min(1 - marginX, desiredX));
                overlay.y = Math.max(marginY, Math.min(1 - marginY, desiredY));
            }
        } else if (editor.drag.target === 'image-rotation') {
            const angle = Math.atan2(event.clientY - editor.drag.centerClientY, event.clientX - editor.drag.centerClientX) * 180 / Math.PI;
            editor.imageRotation = magneticCameraRotation(editor.drag.startRotation + shortestCameraAngleDelta(editor.drag.startAngle, angle), editor.drag);
        } else if (editor.drag.target === 'text-rotation') {
            const overlay = editor.texts.find((item) => String(item.id) === String(editor.drag.textId));
            if (overlay) {
                const angle = cameraEditorPointerAngle(editor.drag.centerX, editor.drag.centerY, point);
                overlay.rotation = magneticCameraRotation(editor.drag.startRotation + shortestCameraAngleDelta(editor.drag.startAngle, angle), editor.drag);
            }
        } else if (editor.drag.target === 'text-resize') {
            const overlay = editor.texts.find((item) => String(item.id) === String(editor.drag.textId));
            if (overlay) {
                const distance = Math.max(1, Math.hypot(point.pixelX - editor.drag.centerX, point.pixelY - editor.drag.centerY));
                overlay.sizePercent = Math.max(2, Math.min(50, Math.round(editor.drag.startSize * distance / editor.drag.startDistance)));
                editor.defaultTextSize = overlay.sizePercent;
                state.photoEditorTextSizes[cameraEditorUserKey()] = overlay.sizePercent;
                const sizeInput = app.querySelector('[data-mobile-camera-editor-size]');
                if (sizeInput instanceof HTMLInputElement) sizeInput.value = String(overlay.sizePercent);
            }
        } else {
            const source = editor.drag.crop;
            const next = { ...source };
            switch (editor.drag.target) {
                case 'top-left':
                    next.left = Math.max(0, Math.min(source.right - cameraEditorMinimumCrop, point.x));
                    next.top = Math.max(0, Math.min(source.bottom - cameraEditorMinimumCrop, point.y));
                    break;
                case 'top-right':
                    next.right = Math.max(source.left + cameraEditorMinimumCrop, Math.min(1, point.x));
                    next.top = Math.max(0, Math.min(source.bottom - cameraEditorMinimumCrop, point.y));
                    break;
                case 'bottom-left':
                    next.left = Math.max(0, Math.min(source.right - cameraEditorMinimumCrop, point.x));
                    next.bottom = Math.max(source.top + cameraEditorMinimumCrop, Math.min(1, point.y));
                    break;
                case 'bottom-right':
                    next.right = Math.max(source.left + cameraEditorMinimumCrop, Math.min(1, point.x));
                    next.bottom = Math.max(source.top + cameraEditorMinimumCrop, Math.min(1, point.y));
                    break;
                default: break;
            }
            editor.crop = normalizeCameraCrop(next);
        }
        if (['image-rotation', 'text-move', 'text-move-handle', 'text-rotation', 'text-resize'].includes(editor.drag.target)) {
            updateCameraEditorVisualTransform();
        }
        scheduleCameraEditorPreview();
        return true;
    }

    function finishCameraEditorPointer(event) {
        const editor = state.externalApplication?.cameraEditor;
        if (!editor?.drag || editor.drag.pointerId !== event.pointerId) return false;
        const wasPendingText = editor.drag.target === 'text-pending';
        const resizedText = editor.drag.target === 'text-resize';
        const tappedTextId = editor.drag.textId;
        const fromInlineEditor = editor.drag.fromInlineEditor === true;
        if (editor.drag.longPressTimer) window.clearTimeout(editor.drag.longPressTimer);
        const captureElement = editor.drag.captureElement;
        if (captureElement?.hasPointerCapture?.(event.pointerId)) {
            captureElement.releasePointerCapture(event.pointerId);
        }
        editor.drag = null;
        if (resizedText) persistPreferences();
        if (wasPendingText && tappedTextId != null && !fromInlineEditor) {
            editor.selectedTextId = tappedTextId;
            renderExternalCameraReview();
            window.requestAnimationFrame(() => {
                const input = app.querySelector('[data-mobile-camera-inline-text]');
                input?.focus({ preventScroll: true });
                input?.select?.();
            });
        }
        return true;
    }

    function cameraDossierSelectorMarkup() {
        if ((state.bootstrap?.dossiers || []).length <= 1) return '';

        return `<div class="mobile-external-application__dossier">
            <label for="mobile-camera-dossier">Entreprise</label>
            <select id="mobile-camera-dossier" data-mobile-camera-dossier>
                ${(state.bootstrap?.dossiers || []).map((dossier) => `<option value="${Number(dossier.id)}"${Number(dossier.id) === Number(state.activeDossierId) ? ' selected' : ''}>${escapeHtml(dossier.name)}</option>`).join('')}
            </select>
            <small data-mobile-camera-dossier-status>Le PDF sera rattaché à cette entreprise.</small>
        </div>`;
    }

    function renderExternalCameraCapture() {
        const invocation = state.externalApplication;
        const content = app.querySelector('.mobile-external-application__content');
        if (!invocation || invocation.kind !== 'camera' || !content) return;
        invocation.cameraReview = false;
        const pageCount = Array.isArray(invocation.cameraPages) ? invocation.cameraPages.length : 0;
        content.innerHTML = `<span class="mobile-external-application__status">Maison Pilote est en arrière-plan</span>
            ${cameraDossierSelectorMarkup()}
            <div class="mobile-external-application__hero-icon">${quickActionIcons.camera}</div>
            <div class="mobile-external-application__card">
                <p>Prise de vue externe</p>
                <h1 id="mobile-external-application-title">Appareil photo du téléphone</h1>
                <strong>${pageCount ? `${pageCount} image${pageCount > 1 ? 's' : ''} déjà ajoutée${pageCount > 1 ? 's' : ''}` : 'Prenez le document en photo avec l’appareil'}</strong>
            </div>
            <input class="visually-hidden" type="file" accept="image/*" capture="environment" data-mobile-device-camera-input aria-label="Prendre une photo avec l’appareil photo du téléphone">
            <div class="mobile-external-application__actions mobile-external-camera__capture-actions">
                <button class="mobile-external-application__return" type="button" data-mobile-camera-capture>${quickActionIcons.camera}<span>Ouvrir l’appareil photo</span></button>
                <button class="mobile-external-application__return mobile-external-application__return--secondary" type="button" data-mobile-external-return><span>Retour à Maison Pilote</span></button>
            </div>
            <p class="mobile-external-application__notice">La prise de vue est réalisée par l’interface caméra de l’appareil, puis la photo revient dans Maison Pilote pour être vérifiée.</p>`;
        content.querySelector('[data-mobile-camera-capture]')?.focus({ preventScroll: true });
    }

    function launchDeviceCameraPicker() {
        const input = app.querySelector('[data-mobile-device-camera-input]');
        if (!(input instanceof HTMLInputElement) || input.disabled) return false;
        input.value = '';
        input.click();
        return true;
    }

    function renderExternalCameraReview() {
        const invocation = state.externalApplication;
        const content = app.querySelector('.mobile-external-application__content');
        const pages = Array.isArray(invocation?.cameraPages) ? invocation.cameraPages : [];
        const selectedIndex = Math.max(0, Math.min(pages.length - 1, Math.trunc(Number(invocation?.cameraSelectedIndex) || 0)));
        const current = pages[selectedIndex];
        if (!invocation || invocation.kind !== 'camera' || !content || !current) return;
        invocation.cameraReview = true;
        invocation.cameraSelectedIndex = selectedIndex;
        const editor = invocation.cameraEditor || defaultCameraEditor();
        invocation.cameraEditor = editor;
        const selectedText = (editor.texts || []).find((overlay) => String(overlay.id) === String(editor.selectedTextId));
        content.innerHTML = `<span class="mobile-external-application__status">Aperçu de l’image ${selectedIndex + 1}</span>
            ${cameraDossierSelectorMarkup()}
            <div class="mobile-external-camera__editor-preview" data-mobile-camera-editor-preview>
                <canvas class="mobile-external-camera__preview is-loading is-direct-editor" data-mobile-camera-editor-canvas aria-label="Aperçu modifiable de la page ${pages.length}"></canvas>
                <button type="button" class="mobile-external-camera__rotation-handle mobile-external-camera__rotation-handle--image" data-mobile-camera-image-rotation aria-label="Faire pivoter la photo">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.55 5.55 11 1v3.07C7.06 4.56 4 7.92 4 12s3.05 7.44 7 7.93v-2.02C8.16 17.43 6 14.97 6 12s2.16-5.43 5-5.91V10l4.55-4.45Z"/></svg>
                </button>
                ${['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => `<button type="button" class="mobile-external-camera__crop-hit" data-mobile-camera-crop-handle="${corner}" aria-label="Recadrer la photo"></button>`).join('')}
                ${selectedText ? `<textarea class="mobile-external-camera__inline-text" maxlength="120" aria-label="Modifier le texte sur la photo" data-mobile-camera-inline-text>${escapeHtml(selectedText.text)}</textarea>
                ${['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((corner) => `<button type="button" class="mobile-external-camera__text-resize" data-mobile-camera-text-resize="${corner}" aria-label="Redimensionner le texte"></button>`).join('')}
                <button type="button" class="mobile-external-camera__text-control mobile-external-camera__text-control--delete" data-mobile-camera-editor-delete-text aria-label="Supprimer ce texte">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10l-1 14H8L7 7Zm2-4h6l1 2h4v2H4V5h4l1-2Z"/></svg>
                </button>
                <button type="button" class="mobile-external-camera__text-control mobile-external-camera__text-control--rotation" data-mobile-camera-text-rotation aria-label="Faire pivoter le texte">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.55 5.55 11 1v3.07C7.06 4.56 4 7.92 4 12s3.05 7.44 7 7.93v-2.02C8.16 17.43 6 14.97 6 12s2.16-5.43 5-5.91V10l4.55-4.45Z"/></svg>
                </button>
                <button type="button" class="mobile-external-camera__text-control mobile-external-camera__text-control--move" data-mobile-camera-text-move aria-label="Déplacer le texte">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 4 4h-3v5h5V8l4 4-4 4v-3h-5v5h3l-4 4-4-4h3v-5H6v3l-4-4 4-4v3h5V6H8l4-4Z"/></svg>
                </button>` : ''}
                ${selectedText ? `<div class="mobile-external-camera__text-palette" data-mobile-camera-text-palette data-mobile-camera-selected-text="${escapeHtml(selectedText.id)}">
                    <div class="mobile-external-camera__text-palette-grip" data-mobile-camera-text-palette-grip aria-label="Déplacer les paramètres du texte">
                        <span aria-hidden="true"></span>
                    </div>
                    <button type="button" class="mobile-external-camera__text-palette-close" data-mobile-camera-text-palette-close aria-label="Fermer les paramètres du texte">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z"/></svg>
                    </button>
                    <div class="mobile-external-camera__text-options">
                        <label><span>Police</span><select data-mobile-camera-editor-font>${cameraEditorFonts.map((choice) => `<option value="${choice.key}"${selectedText.font === choice.key ? ' selected' : ''}>${escapeHtml(choice.label)}</option>`).join('')}</select></label>
                        <label><span>Couleur</span><select data-mobile-camera-editor-color>${cameraEditorColors.map((choice) => `<option value="${choice.key}"${selectedText.color === choice.key ? ' selected' : ''}>${escapeHtml(choice.label)}</option>`).join('')}</select></label>
                        <label><span>Taille</span><span class="mobile-external-camera__size-control"><button type="button" data-mobile-camera-editor-size-step="-1" aria-label="Réduire la taille">−</button><input type="number" min="2" max="50" inputmode="numeric" value="${Math.max(2, Math.min(50, Number(selectedText.sizePercent) || 18))}" data-mobile-camera-editor-size data-mobile-quick-entry><button type="button" data-mobile-camera-editor-size-step="1" aria-label="Augmenter la taille">+</button></span></label>
                    </div>
                    <label class="mobile-external-camera__text-palette-entry"><span>Texte</span><textarea maxlength="120" data-mobile-camera-menu-text data-mobile-quick-entry>${escapeHtml(selectedText.text)}</textarea></label>
                </div>` : ''}
            </div>
            <div class="mobile-external-camera__editor" data-mobile-camera-editor>
                <div class="mobile-external-camera__editor-title-row">
                    <div class="mobile-external-camera__count">
                        <label class="mobile-external-camera__image-selector">
                            <span class="visually-hidden">Choisir l’image à modifier ou à reprendre</span>
                            <select data-mobile-camera-page-selector aria-label="Choisir l’image à modifier ou à reprendre">
                                ${pages.map((_, index) => `<option value="${index}"${index === selectedIndex ? ' selected' : ''}>Image ${index + 1}</option>`).join('')}
                            </select>
                        </label>
                        <span> / ${pages.length} au total</span>
                    </div>
                    <button type="button" class="mobile-external-camera__add-text" data-mobile-camera-editor-add-text>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v3h5v13h4V7h5V4H5Z"/></svg><span>Nouveau texte</span>
                    </button>
                </div>
            </div>
            <div class="mobile-external-application__actions mobile-external-camera__review-actions">
                <button class="mobile-external-application__return mobile-external-application__return--secondary" type="button" data-mobile-camera-retake>Reprendre</button>
                <button class="mobile-external-application__return mobile-external-application__return--secondary" type="button" data-mobile-camera-add>Ajouter une image</button>
                <button class="mobile-external-application__return" type="button" data-mobile-camera-use>${pages.length === 1 ? 'Transmettre' : 'Transmettre en PDF'}</button>
            </div>`;
        void drawCameraEditorPreview();
        window.requestAnimationFrame(() => content.querySelector('[data-mobile-camera-use]')?.focus({ preventScroll: true }));
    }

    function openExternalApplication(invocation, trigger = null) {
        const definition = externalApplicationCatalog[invocation?.kind] || externalApplicationCatalog.browser;
        const kind = externalApplicationCatalog[invocation?.kind] ? invocation.kind : 'browser';
        const canReturnFile = kind === 'camera' || kind === 'files';
        const details = (Array.isArray(invocation?.details) ? invocation.details : [])
            .filter((detail) => String(detail?.value || '').trim() !== '')
            .slice(0, 4);
        const cameraDossierSelector = kind === 'camera' ? cameraDossierSelectorMarkup() : '';
        app.querySelector('[data-mobile-external-application]')?.remove();

        closeMobileSelect();
        stopMessagePolling();
        pauseUploadFeedbackDismissals();
        markTransientSessionBackgrounded();
        state.externalApplication = {
            kind,
            trigger,
            canReturnFile,
            fileDestination: String(invocation?.fileDestination || '').trim(),
            uploadContext: {
                ...(invocation?.uploadContext || {}),
                expectedIdentityScope: currentUploadIdentityScope(),
            },
            cameraPages: [],
            cameraSelectedIndex: 0,
            cameraReplacingIndex: null,
            cameraPreviewUrl: null,
            cameraEditor: kind === 'camera' ? defaultCameraEditor() : null,
            cameraEditorRenderId: 0,
        };
        screen.classList.add('is-external-application');
        screen.dataset.externalApplication = kind;
        app.setAttribute('aria-label', definition.name);
        Array.from(app.children).forEach((child) => {
            child.inert = true;
            child.setAttribute('aria-hidden', 'true');
            child.dataset.mobileExternalBackground = '1';
        });

        app.insertAdjacentHTML('beforeend', `<section class="mobile-external-application mobile-external-application--${escapeHtml(kind)}" data-mobile-external-application aria-labelledby="mobile-external-application-title">
            <header class="mobile-external-application__header">
                <span class="mobile-external-application__header-icon">${definition.icon}</span>
                <span><small>Application externe</small><strong>${escapeHtml(definition.name)}</strong></span>
            </header>
            <main class="mobile-external-application__content" ${kind === 'camera' ? 'data-mobile-camera-content' : ''}>
                ${kind === 'camera' ? '' : `
                <span class="mobile-external-application__status">Maison Pilote est en arrière-plan</span>
                ${cameraDossierSelector}
                <div class="mobile-external-application__hero-icon">${definition.icon}</div>
                <div class="mobile-external-application__card">
                    <p>Application appelée</p>
                    <h1 id="mobile-external-application-title">${escapeHtml(definition.name)}</h1>
                    <strong>${escapeHtml(invocation?.action || 'Ouvrir cette application')}</strong>
                    ${details.length ? `<dl>${details.map((detail) => `<div><dt>${escapeHtml(detail.label)}</dt><dd>${escapeHtml(detail.value)}</dd></div>`).join('')}</dl>` : ''}
                </div>
                <div class="mobile-external-application__actions">
                    ${canReturnFile ? `<button class="mobile-external-application__return" type="button" data-mobile-external-return-file>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h10l4 4v14H5V3Zm9 2H7v14h10V8h-3V5Zm-4 7 1.4 1.4L14.8 10l1.4 1.4-4.8 4.8L9 13.8l1-1.8Z"/></svg>
                        <span>Retour avec un fichier</span>
                    </button>${kind === 'files' ? `<button class="mobile-external-application__return" type="button" data-mobile-external-return-files>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h12v14H3V5Zm4-3h12v14h-2V4H7V2Zm2 7h4V7h2v2h4v2h-4v4h-2v-4H9V9Z"/></svg>
                        <span>Retour avec plusieurs fichiers</span>
                    </button>` : ''}` : ''}
                    <button class="mobile-external-application__return ${canReturnFile ? 'mobile-external-application__return--secondary' : ''}" type="button" data-mobile-external-return>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7 1.5-1.5-5.5-5.5 5.5-5.5L14.5 5Z"/></svg>
                        <span>Retour à Maison Pilote</span>
                    </button>
                </div>
                <p class="mobile-external-application__notice">Simulation de l’application du téléphone - aucune application de l’ordinateur n’a été ouverte.</p>
                `}
            </main>
        </section>`);
        if (kind === 'camera') {
            renderExternalCameraCapture();
            launchDeviceCameraPicker();
            return;
        }
        window.requestAnimationFrame(() => app.querySelector(canReturnFile
            ? '[data-mobile-external-return-file]'
            : '[data-mobile-external-return]')?.focus({ preventScroll: true }));
    }

    function closeExternalApplication() {
        const origin = state.externalApplication?.trigger;
        if (state.externalApplication?.cameraPreviewUrl) URL.revokeObjectURL(state.externalApplication.cameraPreviewUrl);
        state.externalApplication?.cameraEditorBitmap?.bitmap?.close?.();
        app.querySelector('[data-mobile-external-application]')?.remove();
        app.querySelectorAll('[data-mobile-external-background]').forEach((child) => {
            child.inert = false;
            child.removeAttribute('aria-hidden');
            delete child.dataset.mobileExternalBackground;
        });
        prepareMaisonPiloteRender();
        if (!resumeTransientSession()) return;
        resumeUploadFeedbackDismissals();
        if (state.route === 'messages') startMessagePolling();
        if (origin instanceof HTMLElement && origin.isConnected) {
            window.requestAnimationFrame(() => origin.focus({ preventScroll: true }));
        }
    }

    function createReturnedTestFile(index = 0) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const context = canvas.getContext('2d');
        context.fillStyle = '#050505';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#ffffff';
        context.font = '700 52px system-ui, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(index > 0 ? `Fichier test ${index}` : 'Fichier test', canvas.width / 2, canvas.height / 2);
        const encoded = canvas.toDataURL('image/png').split(',')[1];
        const binary = window.atob(encoded);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

        return new File([bytes], index > 0 ? `fichier-test-${index}.png` : 'fichier-test.png', {
            type: 'image/png',
            lastModified: Date.now(),
        });
    }

    function createReturnedTestFiles() {
        return [1, 2, 3].map((index) => createReturnedTestFile(index));
    }

    function photoUploadFilename(extension = 'pdf') {
        const rawUser = String(state.bootstrap?.profile?.display_name || state.bootstrap?.profile?.name || 'utilisateur').trim();
        const user = rawUser.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Za-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 70) || 'utilisateur';
        const timestamp = new Date().toISOString()
            .replace(/[-:]/g, '')
            .replace(/\.\d{3}Z$/, 'Z')
            .replace('T', '-');
        return `Photo-app_${user}_${timestamp}.${String(extension).toLowerCase()}`;
    }

    function canvasFile(canvas, filename, type = 'image/jpeg', quality = .92) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('L’image photographiée n’a pas pu être préparée.'));
                    return;
                }
                resolve(new File([blob], filename, { type, lastModified: Date.now() }));
            }, type, quality);
        });
    }

    function immediateCanvasFile(canvas, filename, type = 'image/jpeg', quality = .9) {
        const encoded = canvas.toDataURL(type, quality).split(',')[1] || '';
        if (!encoded) throw new Error('L’image photographiée n’a pas pu être préparée.');
        const binary = window.atob(encoded);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        return new File([bytes], filename, { type, lastModified: Date.now() });
    }

    async function createSinglePhotoPng(file, signal = null) {
        if (!(file instanceof File)) throw new Error('Photographiez une image avant de la transmettre.');
        if (signal?.aborted) throw new DOMException('Envoi annulé.', 'AbortError');
        const bitmap = await createImageBitmap(file);
        try {
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            canvas.getContext('2d').drawImage(bitmap, 0, 0);
            const prepared = await canvasFile(canvas, photoUploadFilename('png'), 'image/png', 1);
            if (signal?.aborted) throw new DOMException('Envoi annulé.', 'AbortError');
            return prepared;
        } finally {
            bitmap.close();
        }
    }

    async function createPhotoPdf(imageFiles, signal = null, onProgress = () => {}) {
        if (!Array.isArray(imageFiles) || imageFiles.length === 0) {
            throw new Error('Photographiez au moins une image avant de transmettre le PDF.');
        }

        const encoder = new TextEncoder();
        const chunks = [];
        const offsets = new Map();
        let byteOffset = 0;
        const append = (part) => {
            const bytes = typeof part === 'string' ? encoder.encode(part) : new Uint8Array(part);
            chunks.push(bytes);
            byteOffset += bytes.byteLength;
        };
        const objectStart = (number) => {
            offsets.set(number, byteOffset);
            append(`${number} 0 obj\n`);
        };
        const pageObjects = imageFiles.map((_, index) => ({
            page: 3 + (index * 3),
            content: 4 + (index * 3),
            image: 5 + (index * 3),
        }));

        append('%PDF-1.4\n%MaisonPilote\n');
        objectStart(1);
        append('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
        objectStart(2);
        append(`<< /Type /Pages /Count ${pageObjects.length} /Kids [${pageObjects.map((item) => `${item.page} 0 R`).join(' ')}] >>\nendobj\n`);

        for (let index = 0; index < imageFiles.length; index += 1) {
            if (signal?.aborted) throw new DOMException('Envoi annulé.', 'AbortError');
            const file = imageFiles[index];
            const object = pageObjects[index];
            const bitmap = await createImageBitmap(file);
            const imageWidth = bitmap.width;
            const imageHeight = bitmap.height;
            bitmap.close();
            const jpeg = await file.arrayBuffer();
            const scale = Math.min(523 / imageWidth, 770 / imageHeight);
            const width = imageWidth * scale;
            const height = imageHeight * scale;
            const left = (595 - width) / 2;
            const bottom = (842 - height) / 2;
            const commands = `q\n${width.toFixed(3)} 0 0 ${height.toFixed(3)} ${left.toFixed(3)} ${bottom.toFixed(3)} cm\n/Im0 Do\nQ\n`;
            const commandBytes = encoder.encode(commands);

            objectStart(object.page);
            append(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${object.image} 0 R >> >> /Contents ${object.content} 0 R >>\nendobj\n`);
            objectStart(object.content);
            append(`<< /Length ${commandBytes.byteLength} >>\nstream\n`);
            append(commandBytes);
            append('endstream\nendobj\n');
            objectStart(object.image);
            append(`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.byteLength} >>\nstream\n`);
            append(jpeg);
            append('\nendstream\nendobj\n');
            onProgress(Math.round(((index + 1) / imageFiles.length) * 100));
            await sleep(0);
        }

        const xrefOffset = byteOffset;
        const objectCount = 2 + (imageFiles.length * 3);
        append(`xref\n0 ${objectCount + 1}\n`);
        append('0000000000 65535 f \n');
        for (let number = 1; number <= objectCount; number += 1) {
            append(`${String(offsets.get(number) || 0).padStart(10, '0')} 00000 n \n`);
        }
        append(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
        return new File(chunks, photoUploadFilename('pdf'), { type: 'application/pdf', lastModified: Date.now() });
    }

    function assistantFeedbackMarkup() {
        if (state.assistantFeedbackDismissed) return '';
        const run = state.assistantRun && typeof state.assistantRun === 'object' ? state.assistantRun : null;
        const status = String(run?.status || '');
        const open = assistantOpenStatuses.has(status);
        const cancellationError = Boolean(state.assistantCancellationFailed && open);
        const terminalWithCountdown = ['completed', 'cancelled'].includes(status);
        const visible = state.assistantListening
            || state.assistantSubmitting
            || Boolean(run)
            || Boolean(state.assistantError);
        if (!visible) return '';

        let title = 'Demande envoyée à Codex';
        if (state.assistantListening) title = 'Écoute en cours…';
        else if (state.assistantSubmitting) title = 'Envoi à Codex en cours';
        else if (cancellationError) title = 'Annulation impossible';
        else if (status === 'cancelled') title = 'Demande annulée';
        else if (run?.cancel_requested) title = 'Annulation en cours…';
        else if (status === 'error') title = 'Traitement Codex interrompu';
        else if (status === 'requires_confirmation') title = 'Confirmation requise dans Codex';

        const prompt = String(state.assistantPrompt || '').trim();
        const detail = state.assistantListening
            ? 'Parlez maintenant. Votre demande sera envoyée directement à Codex.'
            : (prompt ? `« ${prompt} »` : (state.assistantError || 'Demande vocale Maison Pilote'));
        let action = '';
        if (state.assistantListening) {
            action = '<button class="mobile-app-external-file-feedback__cancel" type="button" data-mobile-assistant-listen-cancel>Annuler</button>';
        } else if (open && run?.cancellable) {
            action = `<button class="mobile-app-external-file-feedback__cancel" type="button" data-mobile-assistant-cancel ${state.assistantCancelling ? 'disabled' : ''}>${state.assistantCancelling ? 'Annulation…' : (cancellationError ? 'Réessayer' : 'Annuler')}</button>`;
        } else if (state.assistantError || ['error', 'requires_confirmation'].includes(status)) {
            action = '<button class="mobile-app-external-file-feedback__cancel" type="button" data-mobile-assistant-dismiss>Retirer</button>';
        }
        const active = state.assistantListening || state.assistantSubmitting || open;
        const progress = terminalWithCountdown
            ? '<span class="mobile-app-external-file-feedback__countdown" aria-hidden="true"></span>'
            : (active ? '<span class="mobile-app-external-file-feedback__progress" aria-hidden="true"><span></span></span>' : '');
        const visualStatus = cancellationError || state.assistantError || ['error', 'requires_confirmation'].includes(status)
            ? 'error'
            : (terminalWithCountdown ? 'success' : 'pending');

        return `<section class="mobile-app-external-file-feedback is-assistant is-${visualStatus}${state.assistantListening ? ' is-assistant-listening' : ''}" data-mobile-assistant-feedback role="status" aria-live="polite">
            <span class="mobile-app-external-file-feedback__file-icon">${quickActionIcons.assistant}</span>
            <div class="mobile-app-external-file-feedback__copy"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p></div>
            ${action}
            ${progress}
        </section>`;
    }

    function dismissAssistantFeedback() {
        if (state.assistantFeedbackDismissTimer !== null) {
            window.clearTimeout(state.assistantFeedbackDismissTimer);
            state.assistantFeedbackDismissTimer = null;
        }
        state.assistantFeedbackDismissExpiresAt = 0;
        state.assistantFeedbackDismissed = true;
        renderUploadFeedbacks();
    }

    function scheduleAssistantFeedbackDismissal() {
        if (state.assistantFeedbackDismissed) return;
        if (!uploadFeedbackCanCountDown()) return;
        if (!['completed', 'cancelled'].includes(String(state.assistantRun?.status || ''))) return;
        const element = app.querySelector('[data-mobile-assistant-feedback]');
        if (!element) return;
        if (state.assistantFeedbackDismissTimer !== null) {
            element.style.setProperty('--mobile-upload-countdown-duration', `${Math.max(1, state.assistantFeedbackDismissExpiresAt - Date.now())}ms`);
            element.classList.add('is-counting-down');
            return;
        }
        state.assistantFeedbackDismissExpiresAt = Date.now() + 3000;
        element.style.setProperty('--mobile-upload-countdown-duration', '3000ms');
        element.classList.add('is-counting-down');
        state.assistantFeedbackDismissTimer = window.setTimeout(dismissAssistantFeedback, 3000);
    }

    function uploadFeedbacksMarkup() {
        return state.uploadFeedbacks.filter((feedback) => !['expense_report', 'mileage_registration'].includes(String(feedback.contextType || ''))).map((feedback) => {
            const active = ['pending', 'converting', 'uploading'].includes(feedback.status);
            const progress = Math.max(0, Math.min(100, Number(feedback.progress) || 0));
            const pageCount = Math.max(1, Number(feedback.pageCount) || 1);
            const preview = feedback.previewUrl
                ? `<span class="mobile-app-external-file-feedback__preview${pageCount > 1 ? ' is-stacked' : ''}${feedback.isPdf ? ' is-pdf' : ''}">
                    ${pageCount > 1 ? '<i aria-hidden="true"></i><i aria-hidden="true"></i>' : ''}
                    <img src="${escapeHtml(feedback.previewUrl)}" alt="${escapeHtml(feedback.isPdf ? `Aperçu de la première page de ${feedback.filename || 'ce PDF'}` : `Aperçu de ${feedback.filename || 'la photographie'}`)}">
                </span>`
                : `<span class="mobile-app-external-file-feedback__file-icon">${quickActionIcons.file}</span>`;
            const action = active || ['success', 'cancel_error'].includes(feedback.status)
                ? `<button class="mobile-app-external-file-feedback__cancel" type="button" data-mobile-upload-cancel="${escapeHtml(feedback.id)}">${feedback.status === 'cancel_error' ? 'Réessayer' : 'Annuler'}</button>`
                : (feedback.status === 'error'
                    ? (feedback.nativeShareBatchId
                        ? `<button class="mobile-app-external-file-feedback__cancel" type="button" data-mobile-native-share-retry="${escapeHtml(feedback.id)}">Réessayer</button>`
                        : `<button class="mobile-app-external-file-feedback__cancel" type="button" data-mobile-upload-remove="${escapeHtml(feedback.id)}">Retirer</button>`)
                    : '');
            const progressLine = feedback.status === 'success'
                ? '<span class="mobile-app-external-file-feedback__countdown" aria-hidden="true"></span>'
                : (active ? `<span class="mobile-app-external-file-feedback__progress" aria-hidden="true"><span style="width:${progress}%"></span></span>` : '');
            return `<section class="mobile-app-external-file-feedback is-${escapeHtml(feedback.status)}" data-mobile-returned-file-feedback data-upload-feedback-id="${escapeHtml(feedback.id)}" role="status">
                ${preview}
                <div class="mobile-app-external-file-feedback__copy"><strong>${escapeHtml(feedback.title)}</strong><p>${escapeHtml(feedback.detail)}</p></div>
                ${action}
                ${progressLine}
            </section>`;
        }).join('');
    }

    function renderUploadFeedbacks() {
        const assistantButton = app.querySelector('[data-mobile-assistant-listen]');
        if (assistantButton instanceof HTMLButtonElement) {
            const busy = state.readOnly
                || state.assistantListening
                || state.assistantSubmitting
                || assistantOpenStatuses.has(String(state.assistantRun?.status || ''));
            assistantButton.disabled = busy;
            assistantButton.classList.toggle('is-active', busy && !state.readOnly);
        }
        let overlay = app.querySelector('[data-mobile-upload-overlay]');
        if (!overlay) {
            const shell = app.querySelector('.mobile-app-shell');
            if (!shell) return;
            shell.insertAdjacentHTML('beforeend', '<div class="mobile-app-upload-overlay" data-mobile-upload-overlay></div>');
            overlay = shell.querySelector('[data-mobile-upload-overlay]');
        }
        overlay.innerHTML = `${assistantFeedbackMarkup()}${uploadFeedbacksMarkup()}`;
        state.uploadFeedbacks.filter((feedback) => feedback.status === 'success').forEach((feedback) => {
            const countdown = uploadDismissTimers.get(feedback.id);
            if (countdown) {
                const element = overlay.querySelector(`[data-upload-feedback-id="${CSS.escape(feedback.id)}"]`);
                element?.style.setProperty('--mobile-upload-countdown-duration', `${Math.max(1, countdown.expiresAt - Date.now())}ms`);
                element?.classList.add('is-counting-down');
            }
        });
        scheduleAssistantFeedbackDismissal();
    }

    function updateUploadFeedback(id, values) {
        state.uploadFeedbacks = state.uploadFeedbacks.map((feedback) => (
            feedback.id === id ? { ...feedback, ...values } : feedback
        ));
        renderUploadFeedbacks();
        if (values.status === 'success') scheduleUploadFeedbackDismissal(id);
    }

    function dismissReturnedFileFeedback(id = '') {
        if (id) {
            state.uploadFeedbacks = state.uploadFeedbacks.filter((feedback) => feedback.id !== id);
            releaseUploadPreview(id);
            uploadAbortControllers.delete(id);
            const countdown = uploadDismissTimers.get(id);
            if (countdown) window.clearTimeout(countdown.timer);
            uploadDismissTimers.delete(id);
        } else {
            state.uploadFeedbacks = [];
            uploadAbortControllers.forEach((controller) => controller.abort());
            uploadAbortControllers.clear();
            uploadDismissTimers.forEach((countdown) => window.clearTimeout(countdown.timer));
            uploadDismissTimers.clear();
            Array.from(uploadPreviewUrls.keys()).forEach(releaseUploadPreview);
        }
        renderUploadFeedbacks();
        window.requestAnimationFrame(() => app.querySelector('[data-upload-file]')?.focus({ preventScroll: true }));
    }

    function releaseUploadPreview(id) {
        const url = uploadPreviewUrls.get(id);
        if (url) URL.revokeObjectURL(url);
        uploadPreviewUrls.delete(id);
    }

    function setUploadPreview(id, previewUrl, pageCount, isPdf, filename) {
        if (!state.uploadFeedbacks.some((feedback) => feedback.id === id)) {
            URL.revokeObjectURL(previewUrl);
            return;
        }
        releaseUploadPreview(id);
        uploadPreviewUrls.set(id, previewUrl);
        updateUploadFeedback(id, { previewUrl, pageCount, isPdf, filename });
    }

    async function createPdfUploadPreview(file, signal = null) {
        if (signal?.aborted) throw new DOMException('Envoi annulé.', 'AbortError');
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
        const pdfDocument = await loadingTask.promise;
        try {
            if (signal?.aborted) throw new DOMException('Envoi annulé.', 'AbortError');
            const page = await pdfDocument.getPage(1);
            const initialViewport = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: Math.min(180 / initialViewport.width, 240 / initialViewport.height) });
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.ceil(viewport.width));
            canvas.height = Math.max(1, Math.ceil(viewport.height));
            const context = canvas.getContext('2d', { alpha: false });
            context.fillStyle = '#fff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: context, viewport }).promise;
            if (signal?.aborted) throw new DOMException('Envoi annulé.', 'AbortError');
            const blob = await new Promise((resolve, reject) => canvas.toBlob(
                (value) => value ? resolve(value) : reject(new Error('L’aperçu du PDF n’a pas pu être généré.')),
                'image/jpeg',
                .82,
            ));
            return { previewUrl: URL.createObjectURL(blob), pageCount: pdfDocument.numPages };
        } finally {
            await pdfDocument.destroy();
        }
    }

    function uploadFeedbackCanCountDown() {
        return !document.hidden && !state.externalApplication && !app.querySelector('[data-mobile-system-overview]');
    }

    function scheduleUploadFeedbackDismissal(id) {
        if (!uploadFeedbackCanCountDown() || uploadDismissTimers.has(id)) return;
        const feedback = state.uploadFeedbacks.find((item) => item.id === id);
        if (feedback?.status !== 'success') return;
        if (['expense_report', 'mileage_registration'].includes(String(feedback.contextType || ''))) return;
        const expiresAt = Date.now() + 3000;
        const element = app.querySelector(`[data-upload-feedback-id="${CSS.escape(id)}"]`);
        element?.style.setProperty('--mobile-upload-countdown-duration', '3000ms');
        element?.classList.add('is-counting-down');
        uploadDismissTimers.set(id, {
            expiresAt,
            timer: window.setTimeout(() => dismissReturnedFileFeedback(id), 3000),
        });
    }

    function pauseUploadFeedbackDismissals() {
        uploadDismissTimers.forEach((countdown) => window.clearTimeout(countdown.timer));
        uploadDismissTimers.clear();
        if (state.assistantFeedbackDismissTimer !== null) {
            window.clearTimeout(state.assistantFeedbackDismissTimer);
            state.assistantFeedbackDismissTimer = null;
            state.assistantFeedbackDismissExpiresAt = 0;
        }
        app.querySelectorAll('[data-upload-feedback-id].is-counting-down').forEach((element) => {
            element.classList.remove('is-counting-down');
        });
        app.querySelector('[data-mobile-assistant-feedback]')?.classList.remove('is-counting-down');
    }

    function resumeUploadFeedbackDismissals() {
        if (!uploadFeedbackCanCountDown()) return;
        state.uploadFeedbacks.filter((feedback) => feedback.status === 'success').forEach((feedback) => {
            scheduleUploadFeedbackDismissal(feedback.id);
        });
        scheduleAssistantFeedbackDismissal();
    }

    async function cancelUploadFeedback(id) {
        const feedback = state.uploadFeedbacks.find((item) => item.id === id);
        if (!feedback) return;
        if (feedback.nativeShareBatchId) {
            const batchId = String(feedback.nativeShareBatchId);
            nativeShareCancelledBatchIds.add(batchId);
            nativeShareBatchControllers.get(batchId)?.forEach((controller) => controller.abort());
        }
        const countdown = uploadDismissTimers.get(id);
        if (countdown) window.clearTimeout(countdown.timer);
        uploadDismissTimers.delete(id);
        app.querySelector(`[data-upload-feedback-id="${CSS.escape(id)}"]`)?.classList.remove('is-counting-down');
        uploadAbortControllers.get(id)?.abort();
        if (Number(feedback.remoteUploadId) > 0 && (feedback.contextType === 'personal_documents' || Number(feedback.dossierId) > 0)) {
            try {
                await api(`${documentUploadEndpoint(feedback.contextType, feedback.dossierId)}/${Number(feedback.remoteUploadId)}`, { method: 'DELETE' });
            } catch (error) {
                if (feedback.nativeShareBatchId) {
                    state.uploadFeedbacks
                        .filter((item) => item.nativeShareBatchId === feedback.nativeShareBatchId && item.id !== id)
                        .map((item) => item.id)
                        .forEach((feedbackId) => dismissReturnedFileFeedback(feedbackId));
                }
                updateUploadFeedback(id, {
                    title: 'Annulation impossible',
                    detail: error?.message || 'Réessayez lorsque le réseau est disponible.',
                    status: 'cancel_error',
                });
                return;
            }
        }
        if (feedback.nativeShareAttemptKey) {
            advanceNativeShareAttempt(String(feedback.nativeShareAttemptKey));
        }
        if (feedback.nativeShareBatchId) {
            state.uploadFeedbacks
                .filter((item) => item.nativeShareBatchId === feedback.nativeShareBatchId)
                .map((item) => item.id)
                .forEach((feedbackId) => dismissReturnedFileFeedback(feedbackId));
        } else {
            dismissReturnedFileFeedback(id);
        }
    }

    function documentUploadEndpoint(contextType, dossierId) {
        return contextType === 'personal_documents' ? '/personal-uploads' : `/dossiers/${Number(dossierId)}/uploads`;
    }

    function canDeleteCurrentDocuments() {
        return !state.readOnly && (state.routeParams?.scope === 'personal' || can('documents.delete'));
    }

    async function uploadFileToGed(
        file,
        dossierId,
        uploadContext,
        onProgress = () => {},
        onRemoteUpload = () => {},
        signal = null,
    ) {
        if (!(file instanceof File) || file.size < 1) throw new Error('Le fichier sélectionné est vide.');
        assertUploadIdentity(uploadContext);
        const idempotencyKey = crypto.randomUUID();
        const startBody = {
            filename: file.name,
            expected_size: file.size,
            ...(Number(uploadContext.folderId) > 0 ? { folder_id: Number(uploadContext.folderId) } : {}),
            ...(uploadContext.contextType ? { context_type: String(uploadContext.contextType) } : {}),
            ...(Number(uploadContext.contextId) > 0 ? { context_id: Number(uploadContext.contextId) } : {}),
        };
        const endpoint = documentUploadEndpoint(uploadContext.contextType, dossierId);
        let upload = null;
        let startFailure = null;
        for (let attempt = 0; attempt < 3 && !upload; attempt += 1) {
            if (signal?.aborted) throw new DOMException('Envoi annulé.', 'AbortError');
            try {
                upload = (await api(endpoint, {
                    method: 'POST',
                    body: startBody,
                    idempotencyKey,
                    signal,
                }))?.data;
            } catch (error) {
                if (signal?.aborted) throw error;
                startFailure = error;
                if (!error?.retryable || attempt === 2) throw error;
                await sleep(600 * (attempt + 1));
            }
        }
        if (!upload?.id) throw startFailure || new Error('Le serveur n’a pas créé la session d’envoi.');
        onRemoteUpload(Number(upload.id));

        let offset = Math.max(0, Number(upload.next_offset) || 0);
        let retryCount = 0;
        while (!['completed', 'duplicate'].includes(String(upload.status)) && offset < file.size) {
            assertUploadIdentity(uploadContext);
            if (signal?.aborted) throw new DOMException('Envoi annulé.', 'AbortError');
            const chunkSize = Math.min(Math.max(64 * 1024, Number(upload.chunk_size) || 5 * 1024 * 1024), 5 * 1024 * 1024);
            const chunk = file.slice(offset, Math.min(file.size, offset + chunkSize), file.type || 'application/octet-stream');
            onProgress(Math.min(99, Math.round(((offset + chunk.size) / file.size) * 100)));
            try {
                upload = (await api(`${endpoint}/${Number(upload.id)}`, {
                    method: 'PATCH',
                    body: chunk,
                    headers: { 'X-Upload-Offset': String(offset) },
                    signal,
                }))?.data;
                if (!upload?.id) throw new Error('Le serveur n’a pas confirmé le bloc transmis.');
                offset = Math.max(0, Number(upload.next_offset) || 0);
                retryCount = 0;
            } catch (error) {
                if (signal?.aborted) throw error;
                const resumable = error?.retryable || Number(error?.status) === 409;
                if (!resumable || retryCount >= 3) throw error;
                retryCount += 1;
                await sleep(750 * retryCount);
                upload = (await api(`${endpoint}/${Number(upload.id)}`, { signal }))?.data;
                if (!upload?.id) throw error;
                offset = Math.max(0, Number(upload.next_offset) || 0);
            }
        }

        if (!upload?.document?.id || !['completed', 'duplicate'].includes(String(upload.status))) {
            throw new Error('Le serveur n’a pas confirmé l’arrivée du document dans la GED.');
        }
        onProgress(100);
        return upload;
    }

    function currentUploadIdentityScope() {
        const profile = state.bootstrap?.profile || {};
        const ownerId = Number(profile.owner_user_id || profile.id) || 0;
        const actingId = Number(profile.id) || ownerId;
        const cameleonId = String(state.cameleonSessionId || state.bootstrap?.cameleon?.session_id || '');
        const dossierId = Number(state.activeDossierId) || 0;
        return `${ownerId}:${actingId}:${cameleonId}:${dossierId}`;
    }

    function assertUploadIdentity(uploadContext) {
        const expected = String(uploadContext?.expectedIdentityScope || '');
        if (!expected || expected === currentUploadIdentityScope()) return;

        const error = new Error('Le profil actif ou l’entreprise a changé. Sélectionnez de nouveau le justificatif.');
        error.code = 'upload_identity_changed';
        error.retryable = false;
        throw error;
    }

    function readNativeShareAttemptCounters() {
        try {
            const parsed = JSON.parse(localStorage.getItem(nativeShareAttemptsStorageKey) || '{}');
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
            return Object.fromEntries(Object.entries(parsed).slice(-250).filter(([key, value]) => (
                typeof key === 'string'
                && key.length <= 320
                && Number.isSafeInteger(Number(value))
                && Number(value) >= 0
                && Number(value) <= 1000
            )).map(([key, value]) => [key, Number(value)]));
        } catch (_) {
            return {};
        }
    }

    function persistNativeShareAttemptCounters() {
        const entries = Object.entries(nativeShareAttemptCounters).slice(-250);
        nativeShareAttemptCounters = Object.fromEntries(entries);
        try { localStorage.setItem(nativeShareAttemptsStorageKey, JSON.stringify(nativeShareAttemptCounters)); }
        catch (_) { /* La reprise reste idempotente pendant la session courante. */ }
    }

    function nativeShareAttemptKey(batch, file, dossierId, uploadContext) {
        return [
            String(batch.id),
            String(file.id),
            String(dossierId),
            String(uploadContext.expectedIdentityScope || ''),
        ].join(':').slice(0, 320);
    }

    function advanceNativeShareAttempt(key) {
        if (!key) return;
        nativeShareAttemptCounters[key] = Math.min(1000, (Number(nativeShareAttemptCounters[key]) || 0) + 1);
        persistNativeShareAttemptCounters();
    }

    function clearNativeShareAttempts(keys) {
        let changed = false;
        keys.forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(nativeShareAttemptCounters, key)) return;
            delete nativeShareAttemptCounters[key];
            changed = true;
        });
        if (changed) persistNativeShareAttemptCounters();
    }

    async function deterministicNativeShareIdempotencyKey(attemptKey) {
        if (!window.crypto?.subtle || typeof TextEncoder !== 'function') {
            throw new Error('La sécurité iOS nécessaire à la reprise de l’envoi n’est pas disponible.');
        }
        const attempt = Math.max(0, Number(nativeShareAttemptCounters[attemptKey]) || 0);
        const digest = new Uint8Array(await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(`maison-pilote-ios-share:v1:${attemptKey}:${attempt}`),
        ));
        const bytes = digest.slice(0, 16);
        bytes[6] = (bytes[6] & 0x0f) | 0x50;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    function nativeShareError(message, code = 'native_share_failed') {
        const error = new Error(message);
        error.code = code;
        error.retryable = false;
        return error;
    }

    function requestNativeShareChunk(batch, file, offset, length, signal = null) {
        const bridge = window.MaisonPiloteNative?.shareInbox?.readChunk;
        if (!nativeShareBridgeAvailable || typeof bridge !== 'function') {
            return Promise.reject(nativeShareError(
                'Cette version de l’application iOS ne peut pas encore lire les fichiers partagés.',
                'native_share_bridge_unavailable',
            ));
        }
        if (signal?.aborted) {
            return Promise.reject(new DOMException('Envoi annulé.', 'AbortError'));
        }

        const requestId = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            let settled = false;
            const cleanup = () => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeout);
                nativeShareChunkRequests.delete(requestId);
                signal?.removeEventListener('abort', abort);
            };
            const finish = (callback, value) => {
                cleanup();
                callback(value);
            };
            const abort = () => finish(reject, new DOMException('Envoi annulé.', 'AbortError'));
            const timeout = window.setTimeout(() => finish(reject, nativeShareError(
                'L’iPhone n’a pas répondu à temps pendant la lecture du partage.',
                'native_share_timeout',
            )), 30000);
            nativeShareChunkRequests.set(requestId, {
                batchId: batch.id,
                fileId: file.id,
                offset,
                length,
                totalSize: file.size,
                resolve: (value) => finish(resolve, value),
                reject: (error) => finish(reject, error),
            });
            signal?.addEventListener('abort', abort, { once: true });
            if (!bridge(batch.id, file.id, offset, length, requestId)) {
                finish(reject, nativeShareError(
                    'La lecture native du partage n’a pas pu démarrer.',
                    'native_share_bridge_unavailable',
                ));
            }
        });
    }

    function acceptNativeShareChunk(detail) {
        const requestId = String(detail?.request_id || '').toLowerCase();
        const pending = nativeShareChunkRequests.get(requestId);
        if (!pending) return;
        if (detail?.error) {
            pending.reject(nativeShareError(
                String(detail.error.message || 'Le fichier partagé n’a pas pu être lu.').slice(0, 255),
                String(detail.error.code || 'native_share_read_failed').slice(0, 80),
            ));
            return;
        }

        try {
            const batchId = String(detail?.batch_id || '').toLowerCase();
            const fileId = String(detail?.file_id || '').toLowerCase();
            const offset = Number(detail?.offset);
            const nextOffset = Number(detail?.next_offset);
            const totalSize = Number(detail?.total_size);
            const encoded = String(detail?.data_base64 || '');
            if (batchId !== pending.batchId || fileId !== pending.fileId
                || !Number.isSafeInteger(offset) || offset !== pending.offset
                || !Number.isSafeInteger(nextOffset) || nextOffset <= offset
                || nextOffset - offset > pending.length
                || !Number.isSafeInteger(totalSize) || totalSize !== pending.totalSize
                || nextOffset > totalSize
                || encoded.length > Math.ceil((pending.length * 4) / 3) + 8) {
                throw nativeShareError('La réponse native de lecture est incohérente.', 'native_share_invalid_response');
            }
            const binary = window.atob(encoded);
            if (binary.length !== nextOffset - offset) {
                throw nativeShareError('Le bloc natif reçu est incomplet.', 'native_share_invalid_response');
            }
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
            if (Boolean(detail?.eof) !== (nextOffset === totalSize)) {
                throw nativeShareError('La fin du fichier partagé est incohérente.', 'native_share_invalid_response');
            }
            pending.resolve({ bytes, offset, nextOffset, totalSize, eof: nextOffset === totalSize });
        } catch (error) {
            pending.reject(error instanceof Error ? error : nativeShareError(
                'Le bloc natif reçu n’a pas pu être décodé.',
                'native_share_invalid_response',
            ));
        }
    }

    function requestNativeShareDiscard(batchId) {
        const bridge = window.MaisonPiloteNative?.shareInbox?.discard;
        if (!nativeShareBridgeAvailable || typeof bridge !== 'function') {
            return Promise.reject(nativeShareError(
                'La confirmation native du partage n’est pas disponible.',
                'native_share_bridge_unavailable',
            ));
        }
        const requestId = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            let settled = false;
            const cleanup = () => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeout);
                nativeShareDiscardRequests.delete(requestId);
            };
            const finish = (callback, value) => {
                cleanup();
                callback(value);
            };
            const timeout = window.setTimeout(() => finish(reject, nativeShareError(
                'L’iPhone n’a pas confirmé la fin du partage.',
                'native_share_discard_timeout',
            )), 15000);
            nativeShareDiscardRequests.set(requestId, {
                batchId,
                resolve: () => finish(resolve),
                reject: (error) => finish(reject, error),
            });
            if (!bridge(batchId, requestId)) {
                finish(reject, nativeShareError(
                    'La finalisation native du partage n’a pas pu démarrer.',
                    'native_share_bridge_unavailable',
                ));
            }
        });
    }

    function acceptNativeShareDiscardResult(detail) {
        const requestId = String(detail?.request_id || '').toLowerCase();
        const pending = nativeShareDiscardRequests.get(requestId);
        if (!pending) return;
        if (String(detail?.batch_id || '').toLowerCase() !== pending.batchId) {
            pending.reject(nativeShareError('La confirmation native du partage est incohérente.', 'native_share_invalid_response'));
            return;
        }
        if (detail?.success === true) {
            pending.resolve();
            return;
        }
        pending.reject(nativeShareError(
            String(detail?.error?.message || 'Le partage transmis n’a pas pu être retiré de l’iPhone.').slice(0, 255),
            String(detail?.error?.code || 'native_share_discard_failed').slice(0, 80),
        ));
    }

    async function uploadNativeSharedFileToGed(
        batch,
        file,
        dossierId,
        uploadContext,
        onProgress = () => {},
        onRemoteUpload = () => {},
        signal = null,
    ) {
        assertUploadIdentity(uploadContext);
        const attemptKey = nativeShareAttemptKey(batch, file, dossierId, uploadContext);
        const idempotencyKey = await deterministicNativeShareIdempotencyKey(attemptKey);
        const startBody = {
            filename: file.displayName,
            expected_size: file.size,
            context_type: 'shared_file',
        };
        let upload = null;
        let startFailure = null;
        for (let attempt = 0; attempt < 3 && !upload; attempt += 1) {
            if (signal?.aborted) throw new DOMException('Envoi annulé.', 'AbortError');
            try {
                upload = (await api(`/dossiers/${dossierId}/uploads`, {
                    method: 'POST',
                    body: startBody,
                    idempotencyKey,
                    signal,
                }))?.data;
            } catch (error) {
                if (signal?.aborted) throw new DOMException('Envoi annulé.', 'AbortError');
                startFailure = error;
                if (!error?.retryable || attempt === 2) throw error;
                await sleep(600 * (attempt + 1));
            }
        }
        if (!upload?.id) throw startFailure || new Error('Le serveur n’a pas créé la session d’envoi.');
        onRemoteUpload(Number(upload.id));

        let offset = Math.max(0, Number(upload.next_offset) || 0);
        let retryCount = 0;
        while (!['completed', 'duplicate'].includes(String(upload.status))) {
            assertUploadIdentity(uploadContext);
            if (signal?.aborted) throw new DOMException('Envoi annulé.', 'AbortError');
            if (!Number.isSafeInteger(offset) || offset < 0 || offset > file.size) {
                throw nativeShareError('La position de reprise du serveur est invalide.', 'upload_offset_invalid');
            }

            const finalizationRetry = offset === file.size && ['receiving', 'failed'].includes(String(upload.status));
            if (offset === file.size && !finalizationRetry) break;
            const serverChunkLength = Math.min(
                Math.max(64 * 1024, Number(upload.chunk_size) || nativeShareMaximumChunkLength),
                nativeShareMaximumChunkLength,
            );
            let chunk = new Blob([], { type: file.mimeType });
            let expectedNextOffset = offset;
            if (!finalizationRetry) {
                const requestedLength = Math.min(serverChunkLength, file.size - offset);
                const nativeChunk = await requestNativeShareChunk(batch, file, offset, requestedLength, signal);
                chunk = new Blob([nativeChunk.bytes], { type: file.mimeType || 'application/octet-stream' });
                expectedNextOffset = nativeChunk.nextOffset;
                onProgress(Math.min(99, Math.round((expectedNextOffset / file.size) * 100)));
            }

            try {
                upload = (await api(`/dossiers/${dossierId}/uploads/${Number(upload.id)}`, {
                    method: 'PATCH',
                    body: chunk,
                    headers: { 'X-Upload-Offset': String(offset) },
                    signal,
                }))?.data;
                if (!upload?.id) throw new Error('Le serveur n’a pas confirmé le bloc transmis.');
                const confirmedOffset = Math.max(0, Number(upload.next_offset) || 0);
                if (!finalizationRetry && confirmedOffset !== expectedNextOffset) {
                    throw nativeShareError('Le serveur n’a pas confirmé la totalité du bloc transmis.', 'upload_offset_invalid');
                }
                offset = confirmedOffset;
                retryCount = 0;
            } catch (error) {
                if (signal?.aborted) throw new DOMException('Envoi annulé.', 'AbortError');
                const resumable = error?.retryable || Number(error?.status) === 409;
                if (!resumable || retryCount >= 3) throw error;
                retryCount += 1;
                await sleep(750 * retryCount);
                upload = (await api(`/dossiers/${dossierId}/uploads/${Number(upload.id)}`, { signal }))?.data;
                if (!upload?.id) throw error;
                offset = Math.max(0, Number(upload.next_offset) || 0);
            }
        }

        if (!upload?.document?.id || !['completed', 'duplicate'].includes(String(upload.status))) {
            throw new Error('Le serveur n’a pas confirmé l’arrivée du document dans la GED.');
        }
        onProgress(100);
        return { upload, attemptKey };
    }

    function normalizeNativeShareInbox(value) {
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const batches = [];
        const batchIDs = new Set();
        (Array.isArray(value) ? value : []).slice(0, 50).forEach((candidate) => {
            const id = String(candidate?.id || '').toLowerCase();
            if (!uuid.test(id) || batchIDs.has(id)) return;
            const fileIDs = new Set();
            const files = (Array.isArray(candidate?.files) ? candidate.files : []).slice(0, 20).flatMap((item) => {
                const fileID = String(item?.id || '').toLowerCase();
                const size = Number(item?.size);
                if (!uuid.test(fileID) || fileIDs.has(fileID)
                    || !Number.isSafeInteger(size) || size < 1) return [];
                fileIDs.add(fileID);
                const rawName = String(item?.displayName || item?.display_name || 'Document partagé')
                    .split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g, '').trim();
                const mimeType = String(item?.mimeType || item?.mime_type || 'application/octet-stream')
                    .trim().slice(0, 128) || 'application/octet-stream';
                return [{
                    id: fileID,
                    displayName: (rawName || 'Document partagé').slice(0, 180),
                    mimeType,
                    size,
                }];
            });
            if (!files.length) return;
            batchIDs.add(id);
            batches.push({
                id,
                createdAtUTC: String(candidate?.createdAtUTC || candidate?.created_at_utc || '').slice(0, 64),
                files,
            });
        });
        return batches;
    }

    function showNativeShareBatchError(batch, message) {
        const existing = state.uploadFeedbacks.some((feedback) => (
            feedback.nativeShareBatchId === batch.id && feedback.status === 'error'
        ));
        if (existing) return;
        const count = batch.files.length;
        state.uploadFeedbacks = [...state.uploadFeedbacks, {
            id: crypto.randomUUID(),
            title: 'Envoi du partage interrompu',
            detail: String(message || `${count} ${count === 1 ? 'document partagé reste' : 'documents partagés restent'} sur l’iPhone.`).slice(0, 255),
            status: 'error',
            progress: 0,
            dossierId: Number(state.activeDossierId) || 0,
            remoteUploadId: null,
            previewUrl: null,
            pageCount: 1,
            isPdf: false,
            filename: count === 1 ? batch.files[0].displayName : `${count} documents partagés`,
            contextType: 'shared_file',
            contextId: null,
            nativeShareBatchId: batch.id,
        }];
        renderUploadFeedbacks();
    }

    async function processNativeShareFile(batch, file, dossierId, uploadContext) {
        const feedbackId = crypto.randomUUID();
        const controller = new AbortController();
        const attemptKey = nativeShareAttemptKey(batch, file, dossierId, uploadContext);
        const batchControllers = nativeShareBatchControllers.get(batch.id) || new Set();
        batchControllers.add(controller);
        nativeShareBatchControllers.set(batch.id, batchControllers);
        uploadAbortControllers.set(feedbackId, controller);
        state.uploadFeedbacks = [...state.uploadFeedbacks, {
            id: feedbackId,
            title: 'Envoi du partage en cours - 0 %',
            detail: file.displayName,
            status: 'uploading',
            progress: 0,
            dossierId,
            remoteUploadId: null,
            previewUrl: null,
            pageCount: 1,
            isPdf: file.mimeType === 'application/pdf' || file.displayName.toLowerCase().endsWith('.pdf'),
            filename: file.displayName,
            contextType: 'shared_file',
            contextId: null,
            nativeShareBatchId: batch.id,
            nativeShareFileId: file.id,
            nativeShareAttemptKey: attemptKey,
        }];
        renderUploadFeedbacks();

        try {
            const result = await uploadNativeSharedFileToGed(
                batch,
                file,
                dossierId,
                uploadContext,
                (progress) => updateUploadFeedback(feedbackId, {
                    title: progress >= 99 && progress < 100
                        ? 'Vérification du document partagé'
                        : `Envoi du partage en cours - ${progress} %`,
                    progress,
                }),
                (remoteUploadId) => updateUploadFeedback(feedbackId, { remoteUploadId }),
                controller.signal,
            );
            if (controller.signal.aborted || nativeShareCancelledBatchIds.has(batch.id)) {
                throw new DOMException('Envoi annulé.', 'AbortError');
            }
            updateUploadFeedback(feedbackId, {
                title: 'Document partagé transmis',
                detail: `${file.displayName} a été ajouté à la GED.`,
                status: 'success',
                progress: 100,
                remoteDocumentId: Number(result.upload.document?.id) || null,
            });
            return result;
        } catch (error) {
            if (controller.signal.aborted || nativeShareCancelledBatchIds.has(batch.id)) {
                throw new DOMException('Envoi annulé.', 'AbortError');
            }
            updateUploadFeedback(feedbackId, {
                title: 'Envoi du partage interrompu',
                detail: error?.message || 'Le document partagé n’a pas pu être transmis à la GED.',
                status: 'error',
            });
            if (error && typeof error === 'object') error.nativeShareFeedbackShown = true;
            throw error;
        } finally {
            uploadAbortControllers.delete(feedbackId);
            batchControllers.delete(controller);
            if (!batchControllers.size) nativeShareBatchControllers.delete(batch.id);
        }
    }

    async function processNativeShareInbox() {
        if (!iosRuntime || !state.authenticated || !state.bootstrap
            || state.applicationBackgrounded || !nativeShareInboxBatches.length) return;
        if (nativeShareProcessing) {
            nativeShareProcessingRequested = true;
            return;
        }

        const identityScope = currentUploadIdentityScope();
        if (identityScope !== nativeShareProcessingIdentityScope) {
            nativeSharePausedBatchIds.clear();
            nativeShareCancelledBatchIds.clear();
            nativeShareProcessingIdentityScope = identityScope;
        }

        const candidates = nativeShareInboxBatches.filter((batch) => !nativeSharePausedBatchIds.has(batch.id));
        if (!candidates.length) return;
        nativeShareProcessing = true;
        try {
            const dossierId = Number(state.activeDossierId) || 0;
            const allowed = can('documents.upload') || can('documents.list');
            for (const batch of candidates) {
                if (!nativeShareBridgeAvailable || typeof window.MaisonPiloteNative?.shareInbox?.readChunk !== 'function') {
                    nativeSharePausedBatchIds.add(batch.id);
                    showNativeShareBatchError(batch, 'Mettez à jour l’application iOS pour transmettre ce partage.');
                    continue;
                }
                if (dossierId < 1 || !allowed) {
                    nativeSharePausedBatchIds.add(batch.id);
                    showNativeShareBatchError(batch, dossierId < 1
                        ? 'Aucune entreprise active ne permet de recevoir ce partage.'
                        : 'Vous n’avez pas le droit de déposer ce partage dans l’entreprise active.');
                    continue;
                }

                nativeShareCancelledBatchIds.delete(batch.id);
                const uploadContext = {
                    contextType: 'shared_file',
                    expectedIdentityScope: currentUploadIdentityScope(),
                };
                const attemptKeys = [];
                try {
                    for (const file of batch.files) {
                        const result = await processNativeShareFile(batch, file, dossierId, uploadContext);
                        attemptKeys.push(result.attemptKey);
                    }
                    if (nativeShareCancelledBatchIds.has(batch.id)) {
                        throw new DOMException('Envoi annulé.', 'AbortError');
                    }
                    await requestNativeShareDiscard(batch.id);
                    clearNativeShareAttempts(attemptKeys);
                    nativeSharePausedBatchIds.add(batch.id);
                    if (state.route === 'documents' && Number(state.activeDossierId) === dossierId) {
                        await renderDocuments(state.routeParams || {});
                    }
                } catch (error) {
                    nativeSharePausedBatchIds.add(batch.id);
                    if (error?.name !== 'AbortError' && !error?.nativeShareFeedbackShown) {
                        showNativeShareBatchError(batch, error?.message);
                    }
                }
            }
        } finally {
            nativeShareProcessing = false;
            if (nativeShareProcessingRequested) {
                nativeShareProcessingRequested = false;
                window.queueMicrotask(() => { void processNativeShareInbox(); });
            }
        }
    }

    async function completeCameraPhotoReturn(imageFiles) {
        const invocation = state.externalApplication;
        if (!invocation?.canReturnFile || !Array.isArray(imageFiles) || imageFiles.length === 0) return;
        const destination = invocation.fileDestination;
        const uploadContext = { ...(invocation.uploadContext || {}) };
        const uploadDossierId = Number(state.activeDossierId) || 0;
        const pdf = imageFiles.length > 1;
        const id = crypto.randomUUID();
        const controller = new AbortController();
        uploadAbortControllers.set(id, controller);
        const previewUrl = URL.createObjectURL(imageFiles[0]);
        uploadPreviewUrls.set(id, previewUrl);
        state.uploadFeedbacks = [...state.uploadFeedbacks, {
            id,
            title: pdf ? 'Conversion des images en PDF' : 'Préparation de l’image',
            detail: pdf ? `${imageFiles.length} images - conversion en cours` : 'Préparation de la photographie en cours',
            status: 'converting',
            progress: 0,
            dossierId: uploadDossierId,
            remoteUploadId: null,
            previewUrl,
            pageCount: imageFiles.length,
            isPdf: pdf,
            filename: photoUploadFilename(pdf ? 'pdf' : 'png'),
            contextType: String(uploadContext.contextType || ''),
            contextId: Number(uploadContext.contextId) || null,
        }];
        closeExternalApplication();
        renderUploadFeedbacks();
        if (app.querySelector('[data-mobile-quick-creation="expense"]') && uploadContext.contextType === 'expense_report') {
            await refreshQuickExpenseDetail(Number(uploadContext.contextId));
        } else if (state.route === 'expense_item_create' && uploadContext.contextType === 'expense_report') {
            await renderExpenseItemForm(state.routeParams || {});
        } else if (app.querySelector('[data-mobile-quick-creation="mileage-settings"]') && uploadContext.contextType === 'mileage_registration') {
            await openQuickMileageSettings();
        } else if (state.route === 'mileage_settings' && uploadContext.contextType === 'mileage_registration') {
            showMileageRegistrationUploadLoading(state.uploadFeedbacks.find((feedback) => feedback.id === id));
            await renderMileageSettings();
        }

        try {
            const file = pdf
                ? await createPhotoPdf(imageFiles, controller.signal, (progress) => {
                    updateUploadFeedback(id, {
                        title: 'Conversion des images en PDF',
                        detail: `${imageFiles.length} images - conversion en cours`,
                        progress,
                    });
                })
                : await createSinglePhotoPng(imageFiles[0], controller.signal);
            if (controller.signal.aborted) return;
            updateUploadFeedback(id, {
                title: 'Envoi du document en cours - 0 %',
                detail: `${file.name}${destination ? ` - ${destination}` : ''}`,
                status: 'uploading',
                progress: 0,
            });
            if (uploadDossierId < 1) throw new Error('Aucune entreprise active ne permet de recevoir ce document.');
            const uploaded = await uploadFileToGed(file, uploadDossierId, uploadContext, (progress) => {
                updateUploadFeedback(id, {
                    title: progress >= 99 && progress < 100 ? 'Vérification du document' : `Envoi du document en cours - ${progress} %`,
                    progress,
                });
            }, (remoteUploadId) => updateUploadFeedback(id, { remoteUploadId }), controller.signal);
            updateUploadFeedback(id, {
                title: 'Document transmis',
                detail: `${file.name}${destination ? ` a été déposé dans ${destination}.` : ' a été ajouté à la GED.'}`,
                status: 'success',
                progress: 100,
                remoteDocumentId: Number(uploaded.document?.id) || null,
            });
            if (app.querySelector('[data-mobile-quick-creation="expense"]') && uploadContext.contextType === 'expense_report') {
                await refreshQuickExpenseDetail(Number(uploadContext.contextId));
            } else if (state.route === 'documents' && Number(state.activeDossierId) === uploadDossierId) {
                await renderDocuments(state.routeParams || {});
            } else if (state.route === 'expense_item_create' && uploadContext.contextType === 'expense_report') {
                await renderExpenseItemForm(state.routeParams || {});
            } else if (app.querySelector('[data-mobile-quick-creation="mileage-settings"]') && uploadContext.contextType === 'mileage_registration') {
                await openQuickMileageSettings();
            } else if (state.route === 'mileage_settings' && uploadContext.contextType === 'mileage_registration') {
                await renderMileageSettings();
            }
        } catch (error) {
            if (!controller.signal.aborted) {
                updateUploadFeedback(id, {
                    title: 'Envoi interrompu',
                    detail: error?.message || 'Le document n’a pas pu être préparé ou transmis à la GED.',
                    status: 'error',
                });
                if (app.querySelector('[data-mobile-quick-creation="expense"]') && uploadContext.contextType === 'expense_report') {
                    await refreshQuickExpenseDetail(Number(uploadContext.contextId));
                } else if (state.route === 'expense_item_create' && uploadContext.contextType === 'expense_report') {
                    await renderExpenseItemForm(state.routeParams || {});
                } else if (app.querySelector('[data-mobile-quick-creation="mileage-settings"]') && uploadContext.contextType === 'mileage_registration') {
                    await openQuickMileageSettings();
                } else if (state.route === 'mileage_settings' && uploadContext.contextType === 'mileage_registration') {
                    await renderMileageSettings();
                }
            }
        } finally {
            uploadAbortControllers.delete(id);
        }
    }

    async function completeExternalFileReturn(explicitFiles = null) {
        const invocation = state.externalApplication;
        if (!invocation?.canReturnFile) return;

        const origin = invocation.trigger;
        const destination = invocation.fileDestination;
        const uploadContext = { ...(invocation.uploadContext || {}) };
        const uploadDossierId = Number(state.activeDossierId) || 0;
        const returnedFiles = (Array.isArray(explicitFiles) ? explicitFiles : [explicitFiles])
            .filter((file) => file instanceof File);
        if (!returnedFiles.length) returnedFiles.push(createReturnedTestFile());

        closeExternalApplication();

        if (!uploadContext.uploadToGed) {
            if (origin instanceof HTMLInputElement && origin.type === 'file') {
                const field = origin.closest('.mobile-app-field');
                field?.querySelector('[data-mobile-returned-file-name]')?.remove();
                field?.insertAdjacentHTML('beforeend', `<small class="mobile-app-returned-file-name" data-mobile-returned-file-name>${escapeHtml(returnedFiles.map((file) => file.name).join(', '))}</small>`);
            }
            return;
        }

        const feedbacks = returnedFiles.map((file) => ({
            id: crypto.randomUUID(),
            file,
            title: 'Envoi en cours - 0 %',
            detail: `${file.name}${destination ? ` - ${destination}` : ''}`,
            status: 'pending',
            progress: 0,
            dossierId: uploadDossierId,
            remoteUploadId: null,
            previewUrl: null,
            pageCount: 1,
            isPdf: file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
            filename: file.name,
            contextType: String(uploadContext.contextType || ''),
            contextId: Number(uploadContext.contextId) || null,
        }));
        feedbacks.forEach((feedback) => {
            if (!feedback.file.type.startsWith('image/')) return;
            feedback.previewUrl = URL.createObjectURL(feedback.file);
            uploadPreviewUrls.set(feedback.id, feedback.previewUrl);
        });
        state.uploadFeedbacks = [...state.uploadFeedbacks, ...feedbacks.map(({ file, ...feedback }) => feedback)];
        renderUploadFeedbacks();
        if (app.querySelector('[data-mobile-quick-creation="expense"]') && uploadContext.contextType === 'expense_report') {
            await refreshQuickExpenseDetail(Number(uploadContext.contextId));
        } else if (state.route === 'expense_item_create' && uploadContext.contextType === 'expense_report') {
            await renderExpenseItemForm(state.routeParams || {});
        } else if (app.querySelector('[data-mobile-quick-creation="mileage-settings"]') && uploadContext.contextType === 'mileage_registration') {
            await openQuickMileageSettings();
        } else if (state.route === 'mileage_settings' && uploadContext.contextType === 'mileage_registration') {
            await renderMileageSettings();
        }

        const results = await Promise.allSettled(feedbacks.map(async ({ id, file }) => {
            const controller = new AbortController();
            uploadAbortControllers.set(id, controller);
            try {
                if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                    void createPdfUploadPreview(file, controller.signal)
                        .then(({ previewUrl, pageCount }) => setUploadPreview(id, previewUrl, pageCount, true, file.name))
                        .catch(() => {});
                }
                if (uploadDossierId < 1) throw new Error('Aucune entreprise active ne permet de recevoir ce document.');
                updateUploadFeedback(id, { status: 'uploading' });
                const uploaded = await uploadFileToGed(file, uploadDossierId, uploadContext, (progress) => {
                    updateUploadFeedback(id, {
                        title: progress >= 99 && progress < 100 ? 'Vérification du document' : `Envoi en cours - ${progress} %`,
                        progress,
                    });
                }, (remoteUploadId) => updateUploadFeedback(id, { remoteUploadId }), controller.signal);
                updateUploadFeedback(id, {
                    title: 'Document transmis',
                    detail: `${file.name}${destination ? ` a été déposé dans ${destination}.` : ' a été ajouté à la GED.'}`,
                    status: 'success',
                    progress: 100,
                    remoteDocumentId: Number(uploaded.document?.id) || null,
                });
            } catch (error) {
                if (controller.signal.aborted) return;
                updateUploadFeedback(id, {
                    title: 'Envoi interrompu',
                    detail: error?.message || 'Le document n’a pas pu être transmis à la GED.',
                    status: 'error',
                });
                throw error;
            } finally {
                uploadAbortControllers.delete(id);
            }
        }));
        if (app.querySelector('[data-mobile-quick-creation="expense"]') && uploadContext.contextType === 'expense_report') {
            await refreshQuickExpenseDetail(Number(uploadContext.contextId));
        } else if (results.some((result) => result.status === 'fulfilled') && state.route === 'documents' && Number(state.activeDossierId) === uploadDossierId) {
            await renderDocuments(state.routeParams || {});
        } else if (state.route === 'expense_item_create' && uploadContext.contextType === 'expense_report') {
            await renderExpenseItemForm(state.routeParams || {});
        } else if (app.querySelector('[data-mobile-quick-creation="mileage-settings"]') && uploadContext.contextType === 'mileage_registration') {
            await openQuickMileageSettings();
        } else if (state.route === 'mileage_settings' && uploadContext.contextType === 'mileage_registration') {
            await renderMileageSettings();
        }
    }

    function stopPasswordResetCountdown() {
        if (state.passwordResetCooldownTimer !== null) {
            window.clearInterval(state.passwordResetCooldownTimer);
            state.passwordResetCooldownTimer = null;
        }
    }

    function startPasswordResetCountdown() {
        stopPasswordResetCountdown();
        if (state.passwordResetCooldownSeconds <= 0) return;

        state.passwordResetCooldownTimer = window.setInterval(() => {
            state.passwordResetCooldownSeconds = Math.max(0, state.passwordResetCooldownSeconds - 1);
            const countdown = app.querySelector('[data-mobile-password-reset-countdown]');
            if (countdown) countdown.textContent = String(state.passwordResetCooldownSeconds);
            if (state.passwordResetCooldownSeconds > 0) return;

            stopPasswordResetCountdown();
            const resend = app.querySelector('[data-mobile-password-reset-resend]');
            if (resend) {
                resend.disabled = false;
                resend.textContent = 'Renvoyer un lien';
            }
        }, 1000);
    }

    function requestNativeBiometricAuthentication() {
        if (!nativeBiometricBridgeAvailable) {
            return Promise.reject(new Error("La biométrie native n'est pas disponible sur cet appareil."));
        }
        if (nativeBiometricRequest) return nativeBiometricRequest.promise;

        let resolveRequest;
        let rejectRequest;
        const promise = new Promise((resolve, reject) => {
            resolveRequest = resolve;
            rejectRequest = reject;
        });
        const timeout = window.setTimeout(() => {
            if (!nativeBiometricRequest) return;
            nativeBiometricRequest = null;
            rejectRequest(new Error("La vérification biométrique n'a pas répondu."));
        }, 60000);
        nativeBiometricRequest = {
            promise,
            resolve: () => {
                window.clearTimeout(timeout);
                nativeBiometricRequest = null;
                resolveRequest(true);
            },
            reject: (message) => {
                window.clearTimeout(timeout);
                nativeBiometricRequest = null;
                rejectRequest(new Error(String(message || 'Vérification biométrique refusée.')));
            },
        };
        try {
            window.webkit.messageHandlers.biometricAuthentication.postMessage({ action: 'authenticate' });
        } catch (_) {
            nativeBiometricRequest.reject("La biométrie native n'a pas pu démarrer.");
        }

        return promise;
    }

    async function setBiometricEnabled(enabled) {
        const nextEnabled = Boolean(enabled);
        if (iosRuntime) {
            if (nextEnabled) await requestNativeBiometricAuthentication();
            state.biometricEnabled = nextEnabled;
            state.biometricOfferPending = false;
            state.rememberConnection = true;
            state.biometricLocked = false;
            state.biometricForcedRemember = false;
            persistPreferences();
            return;
        }
        const response = await controlRequest(root.dataset.biometricUrl, {
            method: 'PATCH',
            respectOffline: false,
            body: {
                enabled: nextEnabled,
                remember_connection: true,
            },
        });
        state.biometricEnabled = nextEnabled;
        state.biometricOfferPending = false;
        state.rememberConnection = Boolean(response.data?.remember_connection);
        state.biometricLocked = false;
        state.biometricForcedRemember = false;
        if (state.rememberConnection) clearTransientBackgroundMarker();
        persistPreferences();
        app.querySelector('[data-mobile-biometric-offer]')?.remove();
    }

    function showBiometricActivationTest(source = 'offer') {
        if (state.biometricEnabled || !state.authenticated || app.querySelector('[data-mobile-biometric-activation-test]')) return;
        const safeSource = source === 'settings' ? 'settings' : 'offer';
        app.insertAdjacentHTML('beforeend', `<div class="mobile-app-dialog-backdrop" data-mobile-biometric-activation-test data-source="${safeSource}">
            <section class="mobile-app-biometric-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-biometric-activation-title">
                <header>
                    <h3 id="mobile-biometric-activation-title">Vérifier la biométrie</h3>
                    <button type="button" data-mobile-biometric-activation-close aria-label="Fermer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
                </header>
                <div class="mobile-app-biometric-dialog__body">
                    <span class="mobile-app-biometric-dialog__icon">${biometricIcon()}</span>
                    <p>La connexion biométrique sera activée uniquement après un test réussi.</p>
                    <label class="mobile-app-biometric-simulator">
                        <input type="checkbox" data-mobile-biometric-activation-confirm>
                        <span class="mobile-app-biometric-simulator__icon">${biometricIcon()}<span class="mobile-app-biometric-simulator__check">✓</span></span>
                        <span><strong>Simuler le test biométrique</strong><small>Cochez pour confirmer une vérification réussie.</small></span>
                    </label>
                </div>
            </section>
        </div>`);
    }

    function showBiometricPrompt() {
        if (iosRuntime) return;
        if (!state.biometricEnabled || !state.authenticated || app.querySelector('[data-mobile-biometric-prompt]')) return;
        app.insertAdjacentHTML('beforeend', `<div class="mobile-app-dialog-backdrop" data-mobile-biometric-prompt>
            <section class="mobile-app-biometric-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-biometric-prompt-title">
                <header>
                    <h3 id="mobile-biometric-prompt-title">Connexion biométrique</h3>
                    <button type="button" data-mobile-biometric-prompt-close aria-label="Fermer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
                </header>
                <div class="mobile-app-biometric-dialog__body">
                    <span class="mobile-app-biometric-dialog__icon">${biometricIcon()}</span>
                    <label class="mobile-app-biometric-simulator">
                        <input type="checkbox" data-mobile-biometric-unlock>
                        <span class="mobile-app-biometric-simulator__icon">${biometricIcon()}<span class="mobile-app-biometric-simulator__check">✓</span></span>
                        <span><strong>Simuler la biométrie</strong><small>Cochez pour valider l’empreinte ou le visage.</small></span>
                    </label>
                </div>
            </section>
        </div>`);
    }

    function renderBiometricLock() {
        renderLogin();
        showBiometricPrompt();
    }

    function maybeShowBiometricOffer() {
        if (!state.authenticated
            || state.biometricEnabled
            || state.biometricPromptSuppressed
            || !state.biometricOfferPending
            || app.querySelector('[data-mobile-biometric-offer]')) return;

        state.biometricOfferPending = false;
        persistPreferences();
        app.insertAdjacentHTML('beforeend', `<div class="mobile-app-dialog-backdrop" data-mobile-biometric-offer>
            <section class="mobile-app-biometric-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-biometric-offer-title">
                <header>
                    <h3 id="mobile-biometric-offer-title">Activer la connexion biométrique ?</h3>
                    <button type="button" data-mobile-biometric-offer-close aria-label="Fermer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
                </header>
                <div class="mobile-app-biometric-dialog__body">
                    <span class="mobile-app-biometric-dialog__icon">${biometricIcon()}</span>
                    <p>Utilisez votre empreinte, votre visage ou le verrouillage de l’appareil pour ouvrir Maison Pilote plus rapidement.</p>
                    <label class="mobile-app-settings-check"><input type="checkbox" data-mobile-biometric-never-offer> <span>Ne plus proposer</span></label>
                    <button class="mobile-app-primary-button" type="button" data-mobile-biometric-offer-enable>Activer la biométrie</button>
                </div>
            </section>
        </div>`);
        window.requestAnimationFrame(() => app.querySelector('[data-mobile-biometric-offer-enable]')?.focus({ preventScroll: true }));
    }

    function siteLoginAuthorizationFromUrl(value) {
        try {
            const url = new URL(value, root.dataset.siteUrl);
            const expectedHost = new URL(root.dataset.siteUrl).hostname;
            const expectedHosts = new Set([
                expectedHost,
                'maisonpilote.fr',
                'maisonpilote.meilhac.expert',
            ]);
            if (url.protocol !== 'https:' || !expectedHosts.has(url.hostname) || url.pathname !== '/app/connexion-site') return null;
            const legacyParameters = new URLSearchParams(url.hash.replace(/^#/, ''));
            const requestId = String(url.searchParams.get('request') || legacyParameters.get('request') || '');
            const token = String(url.searchParams.get('token') || legacyParameters.get('token') || '');
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
                || !/^[A-Za-z0-9]{80}$/.test(token)) return null;
            return { requestId, token, createdAt: Date.now() };
        } catch (_) {
            return null;
        }
    }

    function readPendingSiteLogin() {
        try {
            const stored = JSON.parse(sessionStorage.getItem(pendingSiteLoginStorageKey) || 'null');
            const elapsed = Date.now() - Number(stored?.createdAt || 0);
            if (elapsed < 0 || elapsed > pendingSiteLoginLifetimeMs) {
                sessionStorage.removeItem(pendingSiteLoginStorageKey);
                return null;
            }
            const requestId = String(stored?.requestId || '');
            const token = String(stored?.token || '');
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
                || !/^[A-Za-z0-9]{80}$/.test(token)) {
                sessionStorage.removeItem(pendingSiteLoginStorageKey);
                return null;
            }
            return { requestId, token, createdAt: Number(stored.createdAt) };
        } catch (_) {
            try { sessionStorage.removeItem(pendingSiteLoginStorageKey); } catch (_) { /* Memory-only fallback. */ }
            return null;
        }
    }

    function rememberPendingSiteLogin(authorization) {
        state.pendingSiteLogin = authorization;
        try {
            sessionStorage.setItem(pendingSiteLoginStorageKey, JSON.stringify({
                requestId: authorization.requestId,
                token: authorization.token,
                createdAt: Number(authorization.createdAt) || Date.now(),
            }));
        } catch (_) { /* The current page still retains the request in memory. */ }
    }

    function clearPendingSiteLogin(authorization) {
        if (authorization && state.pendingSiteLogin !== authorization) return;
        state.pendingSiteLogin = null;
        try { sessionStorage.removeItem(pendingSiteLoginStorageKey); } catch (_) { /* The in-memory state remains authoritative. */ }
    }

    let siteLoginRetryTimer = null;
    let siteLoginSuccessNoticeTimer = null;

    function renderSiteLoginSuccessNotice() {
        const expiresAt = Number(state.siteLoginSuccessNoticeExpiresAt) || 0;
        const remaining = expiresAt - Date.now();
        if (remaining <= 0) {
            state.siteLoginSuccessNoticeExpiresAt = 0;
            return;
        }

        showQuickCreationNotice('Connexion réussie sur l’autre appareil.', remaining);
    }

    function showSiteLoginSuccessNotice() {
        state.siteLoginSuccessNoticeExpiresAt = Date.now() + 3000;
        window.clearTimeout(siteLoginSuccessNoticeTimer);
        renderSiteLoginSuccessNotice();
        siteLoginSuccessNoticeTimer = window.setTimeout(() => {
            state.siteLoginSuccessNoticeExpiresAt = 0;
            app.querySelector('[data-mobile-quick-creation-notice]')?.remove();
        }, 3050);
    }

    async function completePendingSiteLogin() {
        if (!state.authenticated || state.biometricLocked || !state.pendingSiteLogin) return false;
        if (state.siteLoginCompletionInFlight) return true;

        const pendingAge = Date.now() - Number(state.pendingSiteLogin.createdAt || 0);
        if (pendingAge < 0 || pendingAge > pendingSiteLoginLifetimeMs) {
            clearPendingSiteLogin(state.pendingSiteLogin);
            return false;
        }

        window.clearTimeout(siteLoginRetryTimer);
        siteLoginRetryTimer = null;
        state.siteLoginCompletionInFlight = true;
        app.querySelector('[data-mobile-biometric-offer]')?.remove();
        const authorization = state.pendingSiteLogin;
        let succeeded = false;

        try {
            await api('/auth/site-login/approve', {
                method: 'POST',
                body: {
                    request_id: authorization.requestId,
                    token: authorization.token,
                },
            });
            clearPendingSiteLogin(authorization);
            succeeded = true;
            showSiteLoginSuccessNotice();
            window.setTimeout(() => {
                if (!state.pendingSiteLogin) maybeShowBiometricOffer();
            }, 3000);
        } catch (error) {
            if (state.pendingSiteLogin === authorization && Number(error?.status) === 422) {
                clearPendingSiteLogin(authorization);
            } else if (state.pendingSiteLogin === authorization) {
                siteLoginRetryTimer = window.setTimeout(() => completePendingSiteLogin(), 8000);
            }
        } finally {
            state.siteLoginCompletionInFlight = false;
        }

        if (state.pendingSiteLogin && state.pendingSiteLogin !== authorization) {
            void completePendingSiteLogin();
        }

        return succeeded || state.pendingSiteLogin !== null;
    }

    async function completeAuthenticatedStart() {
        const normalizedRoute = normalizeProfileRoute(state.route);
        if (normalizedRoute !== state.route) {
            state.route = normalizedRoute;
            state.routeParams = {};
            state.routeHistory = state.routeHistory.filter((entry) => !['home', 'more'].includes(entry.route));
            persistNavigation();
        }
        await navigate(state.route, state.routeParams, false);
        const nativeAssistantRequest = state.pendingNativeAssistantRequest;
        if (nativeAssistantRequest && isAdminUser()) {
            state.pendingNativeAssistantRequest = null;
            state.assistantPrompt = nativeAssistantRequest.prompt;
            window.setTimeout(() => submitAssistantPrompt(nativeAssistantRequest.source, nativeAssistantRequest.id), 150);
        } else if (nativeAssistantRequest && !isAdminUser()) {
            window.MaisonPiloteNative?.assistantRequest?.acknowledge?.(nativeAssistantRequest.id);
            state.pendingNativeAssistantRequest = null;
            state.assistantPrompt = '';
        }
        void processNativeShareInbox();
        if (!await completePendingSiteLogin()) maybeShowBiometricOffer();
    }

    function renderLogin(error = null) {
        stopPasswordResetCountdown();
        state.passwordResetMessage = '';
        state.passwordResetCooldownSeconds = 0;
        prepareMaisonPiloteRender();
        const message = error?.message ? `<div class="mobile-app-auth-error" role="alert">${escapeHtml(error.message)}</div>` : '';
        const biometricLogin = state.biometricEnabled && state.authenticated
            ? '<button class="mobile-app-auth__biometric" type="button" data-mobile-biometric-login>Se connecter par biométrie</button>'
            : '';
        const browserLogin = iosRuntime
            ? ''
            : '<button class="mobile-app-auth__browser" type="button" data-mobile-browser-login>Se connecter avec le site</button>';
        app.innerHTML = `<div class="mobile-app-auth">
            ${logoMarkup()}
            <div class="mobile-app-auth__heading"><h1>Connexion</h1></div>
            <form class="mobile-app-auth__form" data-mobile-login autocomplete="on">
                <div class="mobile-app-field"><label for="mobile-login-email">Identifiant ou adresse e-mail</label><input id="mobile-login-email" type="text" name="login" autocomplete="username" required maxlength="255"></div>
                <div class="mobile-app-field"><label for="mobile-login-password">Mot de passe</label><div class="mobile-app-password-control"><input id="mobile-login-password" type="password" name="password" autocomplete="current-password" required maxlength="4096" data-compta-password-reveal="off"><button type="button" data-mobile-password-toggle aria-label="Afficher le mot de passe">${passwordIcon()}</button></div></div>
                <div class="mobile-app-auth__links">
                    ${browserLogin}
                    <button class="mobile-app-auth__browser" type="button" data-mobile-forgot-password>Mot de passe oublié ?</button>
                </div>
                <p class="mobile-app-auth__persistence">Connexion conservée pendant 30 jours.</p>
                ${message}
                <button class="mobile-app-primary-button" type="submit">Se connecter</button>
                ${biometricLogin}
                ${mobilePrivacyLink()}
            </form>
        </div>`;
        enhanceMobileTextFields(app);
        identityStatus.textContent = 'Non connecté';
        dossierStatus.textContent = 'Aucun dossier';
    }

    function mobilePrivacyLink() {
        return '<a class="mobile-app-privacy-link" href="https://maisonpilote.fr/confidentialite" target="_blank" rel="noopener noreferrer">Politique de confidentialité</a>';
    }

    function renderPasswordReset(error = null) {
        prepareMaisonPiloteRender();
        const errorMarkup = error?.message ? `<div class="mobile-app-auth-error" role="alert">${escapeHtml(error.message)}</div>` : '';
        const success = state.passwordResetMessage !== '';
        const content = success ? `
            <div class="mobile-app-auth-success" role="status">${escapeHtml(state.passwordResetMessage)}</div>
            <p class="mobile-app-auth__help">Consultez votre boîte de réception. Si vous ne voyez pas l’e-mail, vérifiez aussi les courriers indésirables.</p>
            <div class="mobile-app-auth__form">
                <button class="mobile-app-primary-button" type="button" data-mobile-password-reset-back>Revenir à la connexion</button>
                <button class="mobile-app-auth__secondary" type="button" data-mobile-password-reset-resend ${state.passwordResetCooldownSeconds > 0 ? 'disabled' : ''}>${state.passwordResetCooldownSeconds > 0 ? `Renvoyer un lien dans <span data-mobile-password-reset-countdown>${state.passwordResetCooldownSeconds}</span> s` : 'Renvoyer un lien'}</button>
            </div>` : `
            <form class="mobile-app-auth__form" data-mobile-password-reset autocomplete="on">
                <div class="mobile-app-field"><label for="mobile-password-reset-login">Identifiant ou adresse e-mail</label><input id="mobile-password-reset-login" type="text" name="login" value="${escapeHtml(state.passwordResetIdentifier)}" autocomplete="username" required maxlength="255"></div>
                ${errorMarkup}
                <button class="mobile-app-primary-button" type="submit">Envoyer un lien de réinitialisation</button>
                <button class="mobile-app-auth__browser" type="button" data-mobile-password-reset-back>Revenir à la connexion</button>
            </form>`;

        app.innerHTML = `<div class="mobile-app-auth">
            ${logoMarkup()}
            <div class="mobile-app-auth__heading"><h1>Réinitialisation du mot de passe</h1></div>
            ${content}
        </div>`;
        enhanceMobileTextFields(app);
        identityStatus.textContent = 'Non connecté';
        dossierStatus.textContent = 'Aucun dossier';
        if (success) startPasswordResetCountdown();
        else window.requestAnimationFrame(() => app.querySelector('#mobile-password-reset-login')?.focus({ preventScroll: true }));
    }

    async function sendPasswordResetLink(form) {
        const button = form.querySelector('button[type="submit"]');
        const login = String(new FormData(form).get('login') || '').trim();
        if (!login || button?.disabled) return;
        state.passwordResetIdentifier = login;
        if (button) {
            button.disabled = true;
            button.textContent = 'Envoi…';
        }

        try {
            const response = await api('/auth/password/email', { method: 'POST', publicAuth: true, body: { login } });
            state.passwordResetMessage = String(response.data?.message || 'Votre lien de réinitialisation a bien été envoyé par e-mail.');
            state.passwordResetCooldownSeconds = Math.max(1, Number(response.data?.cooldown_seconds) || 60);
            renderPasswordReset();
        } catch (failure) {
            state.passwordResetMessage = '';
            state.passwordResetCooldownSeconds = 0;
            renderPasswordReset(failure);
        }
    }

    async function login(form) {
        const button = form.querySelector('button[type="submit"]');
        const login = String(new FormData(form).get('login') || '').trim();
        const password = String(new FormData(form).get('password') || '');
        const rememberConnection = true;
        const authenticatedBeforeAttempt = state.authenticated;
        if (!login || !password || button?.disabled) return;
        if (button) { button.disabled = true; button.textContent = 'Connexion…'; }
        try {
            const response = iosRuntime
                ? await api('/auth/login', {
                    method: 'POST',
                    publicAuth: true,
                    body: { login, password, model: 'iPhone ou iPad' },
                })
                : await controlRequest(root.dataset.authenticationUrl, {
                    body: { login, password, remember_connection: rememberConnection },
                });
            if (iosNativeRuntime) persistMobileAccessSession(response.data);
            if (iosPwaRuntime) {
                captureIosPwaAuthentication(response.data);
                iosPwaSessionRestoreAttempted = true;
            }
            state.authenticated = true;
            state.rememberConnection = iosRuntime || Boolean(response.data?.remember_connection);
            state.biometricOfferPending = !iosRuntime;
            state.biometricLocked = false;
            state.owner = Boolean(iosRuntime ? response.data?.bootstrap?.profile?.is_owner : response.data?.is_owner);
            state.readOnly = iosRuntime ? false : !state.owner;
            state.writesUntil = null;
            state.needsTransientLogout = false;
            syncSafetyBar();
            try { sessionStorage.setItem(runtimeSessionStorageKey, sessionPublicId); } catch (_) { /* Current page still owns the in-memory session. */ }
            clearTransientBackgroundMarker();
            if (!iosRuntime && state.biometricEnabled) {
                state.biometricForcedRemember = false;
                await setBiometricEnabled(true);
            } else {
                persistPreferences();
            }
            clearStoredNavigation();
            resetMobileNotesState();
            state.bootstrap = null;
            state.activeDossierId = null;
            state.route = 'home';
            state.routeParams = {};
            state.routeHistory = [];
            state.messageConversationId = null;
            await start();
            refreshNativePushRegistration({ requestAuthorization: true });
            postToEmulatorHost('mobile-emulator:session-changed', {
                authenticated: state.authenticated,
                owner: state.owner,
            });
        } catch (failure) {
            state.authenticated = authenticatedBeforeAttempt;
            if (!authenticatedBeforeAttempt) {
                state.rememberConnection = rememberConnection;
                state.owner = false;
                state.readOnly = !iosRuntime;
                state.writesUntil = null;
                if (iosRuntime) clearMobileAccessSession();
                await purgeOfflineCache();
            }
            syncSafetyBar();
            renderLogin(failure);
        }
    }

    async function logout() {
        await flushMobileNotes();
        stopMessagePolling();
        stopLeaveBalancePolling();
        try {
            if (iosRuntime) await api('/auth/logout', { method: 'POST' });
            else await controlRequest(root.dataset.logoutUrl, { method: 'DELETE', respectOffline: false });
        } catch (error) {
            if (iosPwaRuntime) {
                renderError(error, state.route);
                return;
            }
            // La déconnexion locale reste possible si le réseau est indisponible.
        } finally {
            if (iosNativeRuntime) clearMobileAccessSession();
        }
        if (iosPwaRuntime) clearMobileAccessSession();
        await purgeOfflineCache();
        state.authenticated = false;
        if (iosPwaRuntime) iosPwaSessionRestoreAttempted = true;
        state.rememberConnection = false;
        state.biometricLocked = false;
        state.owner = false;
        state.readOnly = !iosRuntime;
        state.writesUntil = null;
        state.bootstrap = null;
        state.activeDossierId = null;
        state.routeHistory = [];
        state.messageConversationId = null;
        state.cameleonSessionId = null;
        resetMobileNotesState();
        clearStoredNavigation();
        try { sessionStorage.removeItem(runtimeSessionStorageKey); } catch (_) { /* No persistent secret is involved. */ }
        clearTransientBackgroundMarker();
        syncSafetyBar();
        renderLogin();
        postToEmulatorHost('mobile-emulator:session-changed', {
            authenticated: false,
            owner: false,
        });
    }

    function mobileNavigationCatalog() {
        return [
            ['home', 'Accueil', '⌂', 'Revenir à l’accueil de l’application'],
            ['documents', 'Documents', '', 'Consulter les documents du dossier'],
            ['reports', 'États', '', 'Générer et télécharger les états comptables'],
            ['payslips', 'Bulletins', '', 'Consulter les bulletins de paie'],
            ['leave_balances', 'Solde CP', '', 'Consulter les soldes de congés'],
            ['absences', 'Absences', '', 'Consulter et gérer les absences'],
            ['expenses', 'Frais', '', 'Consulter et gérer les notes de frais'],
            ['mileage', 'IK', '', 'Consulter les indemnités kilométriques'],
            ['hr', 'GRH', '♙', 'Accéder à la gestion des ressources humaines'],
            ['tasks', 'Tâches', '', 'Consulter et gérer les tâches du dossier'],
            ['notes', 'Notes', '', 'Retrouver les notes et mots de passe'],
            ['notifications', 'Notifs', '', 'Consulter les dernières notifications reçues'],
            ['contacts', 'Référent', '', ''],
            ['support', 'Support', '', 'Rechercher, consulter ou créer un ticket'],
            ['more', 'Plus', '', 'Accéder aux autres pages'],
        ].filter(([route]) => (!isSalariedUser() || !['hr', 'notes', 'contacts', 'support', 'more'].includes(route))
            && (route !== 'documents' || can('documents.list'))
            && (route !== 'reports' || can('reports.generate') || can('reports.download'))
            && (route !== 'payslips' || (isSalariedUser() && can('payslips.view_own')))
            && (route !== 'leave_balances' || can('leave_balances.view_own'))
            && (route !== 'absences' || (isSalariedUser() && can('absences.list_own')))
            && (route !== 'expenses' || can('expenses.manage_own') || can('expenses.create'))
            && (route !== 'mileage' || can('mileage.manage_own') || can('mileage.create'))
            && (route !== 'hr' || hasGrhAccess())
            && (route !== 'tasks' || (!isSalariedOnlyUser() && can('tasks.list')))
            && (route !== 'contacts' || can('contacts.view')));
    }

    function footerStoredKey(route) {
        return route === 'leave_balances' ? 'leave-balances' : route;
    }

    function footerRoute(key) {
        return normalizeDestination(String(key || ''));
    }

    function defaultFooterRoutes() {
        const available = mobileNavigationCatalog().map(([route]) => route);
        const preferred = isSalariedUser()
            ? available
            : available.filter((route) => !['tasks', 'notes', 'notifications', 'contacts', 'support'].includes(route));
        return preferred.filter((route) => available.includes(route));
    }

    function footerNavigationRoutes() {
        const available = mobileNavigationCatalog().map(([route]) => route);
        if (isSalariedUser()) {
            return available.filter((route) => route !== 'leave_balances' || !can('absences.list_own'));
        }
        const stored = state.footerNavigationKeys.map(footerRoute).filter((route) => available.includes(route));
        const routes = stored.length ? stored : defaultFooterRoutes();
        if (!routes.includes('home')) routes.unshift('home');
        if (!routes.includes('more')) routes.push('more');
        return [...new Set(routes)].filter((route) => available.includes(route));
    }

    function navigationBar(current) {
        const catalog = mobileNavigationCatalog();
        const footerRoutes = footerNavigationRoutes();
        const tabs = footerRoutes.map((route) => catalog.find(([candidate]) => candidate === route)).filter(Boolean);
        const selectedRoute = footerRoutes.includes(current)
            ? current
            : (current === 'leave_balances' && footerRoutes.includes('absences'))
                ? 'absences'
                : (current === 'messages' && footerRoutes.includes('contacts'))
                    ? 'contacts'
                    : profileLandingRoute();
        return `<nav class="mobile-app-nav" aria-label="Navigation principale" style="--mobile-main-navigation-count:${tabs.length}">${tabs.map(([route, label, icon]) => `
            <button type="button" data-mobile-route="${route}" data-icon="${icon}" ${selectedRoute === route ? 'aria-current="page"' : ''}>${label}</button>
        `).join('')}</nav>`;
    }

    function mobileSelectLabel(select) {
        return String(select.selectedOptions?.[0]?.textContent || '').trim() || 'Choisir';
    }

    function mobileSelectAccessibleLabel(select) {
        const explicitLabel = String(select.getAttribute('aria-label') || '').trim();
        if (explicitLabel) return explicitLabel;
        if (select.id) {
            const associatedLabel = Array.from(app.querySelectorAll('label[for]'))
                .find((label) => label.htmlFor === select.id);
            if (associatedLabel) return String(associatedLabel.textContent || '').trim();
        }

        return String(select.closest('.mobile-app-field')?.querySelector('label')?.textContent || '').trim();
    }

    function closeMobileSelect(restoreFocus = false) {
        const trigger = activeMobileSelect?.trigger;
        trigger?.setAttribute('aria-expanded', 'false');
        trigger?.closest('.mobile-app-select')?.classList.remove('is-open');
        activeMobileSelectMenu?.remove();
        activeMobileSelect = null;
        activeMobileSelectMenu = null;
        if (restoreFocus && trigger instanceof HTMLButtonElement) trigger.focus({ preventScroll: true });
    }

    function refreshMobileSelect(select) {
        if (!(select instanceof HTMLSelectElement)) return;
        const wrapper = select.closest('.mobile-app-select');
        const trigger = wrapper?.querySelector('[data-mobile-select-trigger]');
        if (!(trigger instanceof HTMLButtonElement)) return;
        const value = mobileSelectLabel(select);
        const label = mobileSelectAccessibleLabel(select);
        const valueElement = trigger.querySelector('[data-mobile-select-value]');
        if (valueElement) valueElement.textContent = value;
        trigger.disabled = select.disabled;
        trigger.setAttribute('aria-label', label ? `${label} : ${value}` : value);
        wrapper.classList.toggle('is-disabled', select.disabled);
        if (select.validity.valid) wrapper.classList.remove('is-invalid');
    }

    function openMobileSelect(select, trigger) {
        if (!(select instanceof HTMLSelectElement) || !(trigger instanceof HTMLButtonElement) || select.disabled) return;
        if (activeMobileSelect?.select === select) {
            closeMobileSelect(true);
            return;
        }
        closeMobileSelect();
        const shell = select.closest('.mobile-app-shell');
        if (!(shell instanceof HTMLElement)) return;

        const menu = document.createElement('div');
        menu.className = 'mobile-app-select-menu';
        menu.setAttribute('role', 'listbox');
        menu.setAttribute('aria-label', mobileSelectAccessibleLabel(select) || 'Choisir une option');
        const optionsMarkup = Array.from(select.options).map((option, index) => ({ option, index }))
            .filter(({ option }) => !option.hidden)
            .map(({ option, index }) => `
            <button class="mobile-app-select-menu__option ${option.selected ? 'is-selected' : ''}" type="button" role="option" aria-selected="${option.selected ? 'true' : 'false'}" data-mobile-select-option="${index}" ${option.disabled ? 'disabled' : ''}>
                <span>${escapeHtml(option.textContent || '')}</span>
                ${option.selected ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4 4 9-9 1.5 1.5-10.5 10.5-5.5-5.5 1.5-1.5Z"/></svg>' : ''}
            </button>
        `).join('');
        const searchable = select.dataset.mobileSelectSearchable === '1';
        menu.dataset.searchable = searchable ? 'true' : 'false';
        menu.innerHTML = searchable
            ? `<div class="mobile-app-select-menu__search"><input type="search" placeholder="${escapeHtml(select.dataset.mobileSelectSearchPlaceholder || 'Rechercher')}" aria-label="${escapeHtml(select.dataset.mobileSelectSearchPlaceholder || 'Rechercher')}" autocomplete="off" data-mobile-select-search></div>${optionsMarkup}<p class="mobile-app-select-menu__empty" data-mobile-select-empty hidden>Aucun type d’absence trouvé.</p>`
            : optionsMarkup;
        shell.append(menu);

        const searchInput = menu.querySelector('[data-mobile-select-search]');
        if (searchInput instanceof HTMLInputElement) {
            searchInput.addEventListener('input', () => {
                const query = normalizeSearchValue(searchInput.value);
                let visible = 0;
                menu.querySelectorAll('[data-mobile-select-option]').forEach((option) => {
                    const matches = normalizeSearchValue(option.textContent).includes(query);
                    option.hidden = !matches;
                    if (matches) visible += 1;
                });
                const empty = menu.querySelector('[data-mobile-select-empty]');
                if (empty) empty.hidden = visible > 0;
            });
        }

        const shellRect = shell.getBoundingClientRect();
        const triggerRect = trigger.getBoundingClientRect();
        const scaleX = shellRect.width > 0 ? shell.clientWidth / shellRect.width : 1;
        const scaleY = shellRect.height > 0 ? shell.clientHeight / shellRect.height : 1;
        const spaceBelow = Math.max(0, (shellRect.bottom - triggerRect.bottom) * scaleY - 12);
        const spaceAbove = Math.max(0, (triggerRect.top - shellRect.top) * scaleY - 12);
        const preferredHeight = Math.min(260, menu.scrollHeight || 260);
        const opensUpward = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
        const availableHeight = opensUpward ? spaceAbove : spaceBelow;

        const menuMinimumWidth = Math.max(0, Number(select.dataset.mobileSelectMenuMinWidth) || 0);
        const menuWidth = Math.min(Math.max(triggerRect.width * scaleX, menuMinimumWidth), shell.clientWidth - 16);
        const triggerLeft = (triggerRect.left - shellRect.left) * scaleX;
        const menuLeft = Math.min(Math.max(8, triggerLeft), Math.max(8, shell.clientWidth - menuWidth - 8));
        menu.style.left = `${menuLeft}px`;
        menu.style.width = `${menuWidth}px`;
        if (menuMinimumWidth > 0) menu.dataset.singleLine = 'true';
        menu.style.maxHeight = `${Math.max(96, Math.min(260, availableHeight))}px`;
        if (opensUpward) {
            menu.style.bottom = `${Math.max(8, (shellRect.bottom - triggerRect.top) * scaleY + 6)}px`;
            menu.dataset.placement = 'top';
        } else {
            menu.style.top = `${Math.max(8, (triggerRect.bottom - shellRect.top) * scaleY + 6)}px`;
            menu.dataset.placement = 'bottom';
        }

        activeMobileSelect = { select, trigger };
        activeMobileSelectMenu = menu;
        trigger.setAttribute('aria-expanded', 'true');
        trigger.closest('.mobile-app-select')?.classList.add('is-open');
        window.requestAnimationFrame(() => {
            if (searchInput instanceof HTMLInputElement) {
                searchInput.focus({ preventScroll: true });
                return;
            }
            const selectedOption = menu.querySelector('[aria-selected="true"]');
            (selectedOption || menu.querySelector('[role="option"]'))?.focus({ preventScroll: true });
        });
    }

    function enhanceMobileSelects(container = app) {
        container.querySelectorAll('select:not([multiple]):not([data-mobile-select-enhanced])').forEach((select) => {
            if (!(select instanceof HTMLSelectElement) || !select.parentNode) return;
            mobileSelectSequence += 1;
            const wrapper = document.createElement('div');
            wrapper.className = 'mobile-app-select';
            select.parentNode.insertBefore(wrapper, select);
            wrapper.append(select);
            select.dataset.mobileSelectEnhanced = '1';
            select.classList.add('mobile-app-select__native');
            select.tabIndex = -1;

            const trigger = document.createElement('button');
            trigger.className = 'mobile-app-select__trigger';
            trigger.type = 'button';
            trigger.dataset.mobileSelectTrigger = String(mobileSelectSequence);
            trigger.setAttribute('aria-haspopup', 'listbox');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.innerHTML = '<span data-mobile-select-value></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9.5 5 5 5-5 1.4 1.4-6.4 6.4-6.4-6.4L7 9.5Z"/></svg>';
            wrapper.append(trigger);

            const label = select.id
                ? Array.from(app.querySelectorAll('label[for]')).find((candidate) => candidate.htmlFor === select.id)
                : select.closest('.mobile-app-field')?.querySelector('label');
            label?.addEventListener('click', (event) => {
                event.preventDefault();
                if (!trigger.disabled) trigger.click();
            });

            select.addEventListener('change', () => refreshMobileSelect(select));
            select.addEventListener('invalid', () => {
                wrapper.classList.add('is-invalid');
                trigger.focus({ preventScroll: true });
            });
            new MutationObserver(() => refreshMobileSelect(select)).observe(select, {
                attributes: true,
                attributeFilter: ['disabled'],
                childList: true,
                subtree: true,
                characterData: true,
            });
            refreshMobileSelect(select);
        });
    }

    function documentFolderSelectorMarkup(folders, currentFolderId, allFolders = false, personalDocuments = false) {
        const availableFolders = Array.isArray(folders) && folders.length
            ? folders
            : [{ id: 0, name: 'Racine', path: 'Racine' }];
        const currentFolder = availableFolders.find((folder) => Number(folder.id) === Number(currentFolderId))
            || availableFolders.find((folder) => Number(folder.id) === 0)
            || availableFolders[0];
        const currentFolderLabel = String(currentFolder.name || 'Racine');
        const displayedFolderLabel = allFolders ? 'Tous les dossiers' : currentFolderLabel;
        const folderById = new Map(availableFolders.map((folder) => [Number(folder.id) || 0, folder]));
        const parentIdFor = (folder) => {
            const folderId = Number(folder?.id) || 0;
            if (folderId === 0) return null;
            const candidate = folder?.parent_id === null || folder?.parent_id === undefined
                ? 0
                : Number(folder.parent_id);
            return folderById.has(candidate) ? candidate : 0;
        };
        const childrenByParentId = new Map();
        availableFolders.forEach((folder) => {
            const parentId = parentIdFor(folder);
            const children = childrenByParentId.get(parentId) || [];
            children.push(folder);
            childrenByParentId.set(parentId, children);
        });

        state.documentFolderExpandedIds.add(0);
        const visitedAncestors = new Set();
        let ancestor = currentFolder;
        while (ancestor && Number(ancestor.id) !== 0 && !visitedAncestors.has(Number(ancestor.id))) {
            visitedAncestors.add(Number(ancestor.id));
            const parentId = parentIdFor(ancestor);
            if (parentId === null) break;
            state.documentFolderExpandedIds.add(parentId);
            ancestor = folderById.get(parentId);
        }

        const rows = [];
        const visitedFolders = new Set();
        const appendFolder = (folder, depth, visible) => {
            const folderId = Number(folder.id) || 0;
            if (visitedFolders.has(folderId)) return;
            visitedFolders.add(folderId);
            const children = childrenByParentId.get(folderId) || [];
            const expanded = state.documentFolderExpandedIds.has(folderId);
            const name = String(folder.name || 'Racine');
            const parentId = parentIdFor(folder);
            rows.push(`<div class="mobile-app-document-folder-tree__row" style="--document-folder-indent:${Math.max(0, depth) * 0.7}rem" data-mobile-document-folder-node data-document-folder-id="${folderId}" data-document-folder-parent-id="${parentId ?? ''}" data-document-folder-name="${escapeHtml(name)}" ${visible ? '' : 'hidden'}>${children.length > 0
                ? `<button class="mobile-app-document-folder-tree__toggle" type="button" data-mobile-document-folder-expand="${folderId}" aria-expanded="${expanded ? 'true' : 'false'}" aria-label="${expanded ? 'Replier' : 'Déplier'} ${escapeHtml(name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7V5Z"/></svg></button>`
                : '<span class="mobile-app-document-folder-tree__spacer" aria-hidden="true"></span>'}<button class="mobile-app-document-folder-tree__option" type="button" role="menuitemradio" aria-checked="${folderId === Number(currentFolder.id) ? 'true' : 'false'}" data-mobile-document-folder-option="${folderId}"><span data-mobile-document-folder-label>${escapeHtml(name)}</span></button></div>`);
            children.forEach((child) => appendFolder(child, depth + 1, visible && expanded));
        };
        (childrenByParentId.get(null) || []).forEach((folder) => appendFolder(folder, 0, true));
        availableFolders.forEach((folder) => {
            if (!visitedFolders.has(Number(folder.id) || 0)) appendFolder(folder, 0, true);
        });
        const options = rows.join('');

        return `<div class="mobile-app-dossier-selector mobile-app-document-folder-selector"><button class="mobile-app-topbar__dossier-button" type="button" data-mobile-document-folder-menu-toggle data-current-document-folder-label="${escapeHtml(currentFolderLabel)}" aria-haspopup="menu" aria-expanded="false" aria-label="Dossier de documents : ${escapeHtml(displayedFolderLabel)}"><span class="mobile-app-document-folder-selector__icon" aria-hidden="true">${documentScopeIcons[personalDocuments ? 'personal' : 'current']}</span><span data-mobile-document-current-label>${escapeHtml(displayedFolderLabel)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9.5 5 5 5-5 1.4 1.4-6.4 6.4-6.4-6.4L7 9.5Z"/></svg></button><div class="mobile-app-dossier-menu" role="menu" data-mobile-document-folder-menu hidden><div class="mobile-app-dossier-menu__search"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.4 21.8-5.7-5.7a8 8 0 1 1 1.4-1.4l5.7 5.7-1.4 1.4ZM9.8 15.6a5.8 5.8 0 1 0 0-11.6 5.8 5.8 0 0 0 0 11.6Z"/></svg><input type="search" placeholder="Rechercher un dossier" aria-label="Rechercher un dossier de documents" autocomplete="off" data-mobile-document-folder-search></div><div class="mobile-app-dossier-menu__list" data-mobile-document-folder-list>${options}<p data-mobile-document-folder-empty hidden>Aucun dossier trouvé.</p></div></div></div>`;
    }

    function refreshDocumentFolderTree(query = '') {
        const normalizedQuery = normalizeSearchValue(query);
        const nodes = Array.from(app.querySelectorAll('[data-mobile-document-folder-node]'));
        const nodesById = new Map(nodes.map((node) => [Number(node.dataset.documentFolderId) || 0, node]));
        let visibleFolderIds = null;

        if (normalizedQuery) {
            visibleFolderIds = new Set();
            nodes.forEach((node) => {
                if (!normalizeSearchValue(node.dataset.documentFolderName).includes(normalizedQuery)) return;
                let cursor = node;
                const visited = new Set();
                while (cursor) {
                    const folderId = Number(cursor.dataset.documentFolderId) || 0;
                    if (visited.has(folderId)) break;
                    visited.add(folderId);
                    visibleFolderIds.add(folderId);
                    const parentValue = cursor.dataset.documentFolderParentId;
                    cursor = parentValue === '' ? null : nodesById.get(Number(parentValue));
                }
            });
        }

        let visible = 0;
        nodes.forEach((node) => {
            const folderId = Number(node.dataset.documentFolderId) || 0;
            let isVisible = visibleFolderIds ? visibleFolderIds.has(folderId) : true;
            if (!visibleFolderIds) {
                let parentValue = node.dataset.documentFolderParentId;
                const visited = new Set();
                while (isVisible && parentValue !== '') {
                    const parentId = Number(parentValue) || 0;
                    if (visited.has(parentId)) break;
                    visited.add(parentId);
                    if (!state.documentFolderExpandedIds.has(parentId)) isVisible = false;
                    parentValue = nodesById.get(parentId)?.dataset.documentFolderParentId ?? '';
                }
            }
            node.hidden = !isVisible;
            if (isVisible) visible += 1;
            const toggle = node.querySelector('[data-mobile-document-folder-expand]');
            if (toggle) {
                const expanded = Boolean(normalizedQuery) || state.documentFolderExpandedIds.has(folderId);
                toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
                toggle.setAttribute('aria-label', `${expanded ? 'Replier' : 'Déplier'} ${node.dataset.documentFolderName || 'le dossier'}`);
            }
        });
        const empty = app.querySelector('[data-mobile-document-folder-empty]');
        if (empty) empty.hidden = visible > 0;
    }

    function syncDocumentFolderSelectorScope(scope, folderId) {
        const allFolders = scope === 'all';
        const toggle = app.querySelector('[data-mobile-document-folder-menu-toggle]');
        if (!toggle) return;
        const label = allFolders
            ? 'Tous les dossiers'
            : String(toggle.dataset.currentDocumentFolderLabel || 'Racine');
        const copy = toggle.querySelector('[data-mobile-document-current-label]');
        if (copy) copy.textContent = label;
        toggle.setAttribute('aria-label', `Dossier de documents : ${label}`);
        app.querySelectorAll('[data-mobile-document-folder-option]').forEach((option) => {
            option.setAttribute('aria-checked', !allFolders && Number(option.dataset.mobileDocumentFolderOption) === Number(folderId) ? 'true' : 'false');
        });
    }

    function showQuickCreationNotice(message, duration = 2000) {
        app.querySelector('[data-mobile-quick-creation-notice]')?.remove();
        const notice = document.createElement('div');
        notice.className = 'mobile-app-quick-creation-notice';
        notice.dataset.mobileQuickCreationNotice = '';
        notice.setAttribute('role', 'status');
        notice.setAttribute('aria-live', 'polite');
        notice.textContent = message;
        app.appendChild(notice);
        window.requestAnimationFrame(() => notice.classList.add('is-visible'));
        const normalizedDuration = Math.max(900, Number(duration) || 2000);
        window.setTimeout(() => notice.classList.remove('is-visible'), Math.max(600, normalizedDuration - 300));
        window.setTimeout(() => notice.remove(), normalizedDuration);
    }

    function renderFrame(title, content, options = {}) {
        prepareMaisonPiloteRender();
        closeMobileSelect();
        const dossier = activeDossier();
        const activeTab = options.tab || (['home', 'documents', 'reports', 'payslips', 'leave_balances', 'expenses', 'mileage', 'hr', 'tasks', 'more'].includes(state.route) ? state.route : 'more');
        const updateBanner = state.config?.update_mode === 'optional' && !updatePromptSuppressedForSharedFiles
            ? `<div class="mobile-app-update-banner" data-mobile-update-banner="version">Version ${escapeHtml(state.config.latest_version_name)} disponible</div>`
            : '';
        const offlineSavedAt = state.offlineCacheSavedAtUtc ? formatDate(state.offlineCacheSavedAtUtc, true) : '';
        const offlineBanner = state.offlineCacheActive
            ? `<div class="mobile-app-update-banner" role="status">Hors ligne - copie enregistrée${offlineSavedAt ? ` le ${escapeHtml(offlineSavedAt)}` : ''} - lecture seule</div>`
            : '';
        const banners = `${offlineBanner}${updateBanner}`;
        const dossierOptions = (state.bootstrap?.dossiers || []).map((item) => `<button type="button" role="menuitemradio" aria-checked="${Number(item.id) === Number(state.activeDossierId) ? 'true' : 'false'}" data-mobile-dossier-option="${item.id}"><span data-mobile-dossier-label>${escapeHtml(item.name)}</span></button>`).join('');
        const dossierControl = state.bootstrap?.dossiers?.length > 1
            ? `<div class="mobile-app-dossier-selector"><button class="mobile-app-topbar__dossier-button" type="button" data-mobile-dossier-menu-toggle aria-haspopup="menu" aria-expanded="false"><span>${escapeHtml(dossier?.name || 'Maison Pilote')}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9.5 5 5 5-5 1.4 1.4-6.4 6.4-6.4-6.4L7 9.5Z"/></svg></button><div class="mobile-app-dossier-menu" role="menu" data-mobile-dossier-menu hidden><div class="mobile-app-dossier-menu__search"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.4 21.8-5.7-5.7a8 8 0 1 1 1.4-1.4l5.7 5.7-1.4 1.4ZM9.8 15.6a5.8 5.8 0 1 0 0-11.6 5.8 5.8 0 0 0 0 11.6Z"/></svg><input type="search" placeholder="Rechercher un dossier" aria-label="Rechercher un dossier" autocomplete="off" data-mobile-dossier-search></div><div class="mobile-app-dossier-menu__list" data-mobile-dossier-list>${dossierOptions}<p data-mobile-dossier-empty hidden>Aucun dossier trouvé.</p></div></div></div>`
            : `<span class="mobile-app-topbar__dossier-button is-static">${escapeHtml(dossier?.name || 'Maison Pilote')}</span>`;
        const hasCustomContextControl = typeof options.contextControl === 'string';
        const dossierLogoUrl = String(dossier?.logo_url || '').trim();
        const hideHeaderContext = options.hideHeaderContext === true;
        const contextControl = hideHeaderContext
            ? ''
            : (hasCustomContextControl
                ? options.contextControl
                : (dossierLogoUrl ? `<img class="mobile-app-topbar__dossier-logo" src="${escapeHtml(dossierLogoUrl)}" alt="Logo du dossier sélectionné">` : ''));
        const assistantBusy = state.readOnly
            || state.assistantListening
            || state.assistantSubmitting
            || assistantOpenStatuses.has(String(state.assistantRun?.status || ''));
        const assistantControl = isAdminUser()
            ? `<button class="mobile-app-topbar__assistant${assistantBusy ? ' is-active' : ''}" type="button" data-mobile-assistant-listen aria-label="Dicter une demande à Codex" title="Dicter une demande à Codex" ${assistantBusy ? 'disabled' : ''}>${quickActionIcons.assistant}</button>`
            : '';
        const companyControl = hideHeaderContext ? '' : dossierControl;
        const headerTitle = String(title || '').trim();
        const headerSubtitle = String(options.subtitle || state.bootstrap?.profile?.display_name || '').trim();
        const profileRole = String(state.bootstrap?.profile?.role || '').trim();
        const headerRole = String(state.bootstrap?.profile?.role_label || ({
            admin: 'Administrateur',
            comptable: 'Comptable',
            client: 'Client',
            salarie: 'Salarié',
        })[profileRole] || 'Client').trim();
        const bottomPanel = String(options.bottomPanel || '').trim();
        const contentClass = String(options.contentClass || '').trim();
        const hrSelector = !isSalariedUser()
            && options.tab === 'hr'
            && managerHrEntries().some(([route]) => route === state.route)
            ? managerHrPageSelectorMarkup(state.route)
            : '';
        const cameleonActive = Boolean(state.bootstrap?.cameleon);
        const hasCameleonPicker = Boolean(state.owner) && (cameleonActive || can('cameleon.use'));
        const cameleonReturnControl = cameleonActive
            ? '<button type="button" role="menuitem" data-cameleon-stop><svg class="mobile-app-user-menu__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h9l-2.5-2.5L16 3l5 5-5 5-1.5-1.5L17 9H8V7Zm8 10H7l2.5 2.5L8 21l-5-5 5-5 1.5 1.5L7 15h9v2Z"/></svg><span>Redevenir Valentin</span></button>'
            : '';
        const cameleonPickerControl = hasCameleonPicker
            ? `<button type="button" role="menuitem" data-mobile-cameleon-menu-toggle aria-expanded="false"><svg class="mobile-app-user-menu__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h9l-2.5-2.5L16 3l5 5-5 5-1.5-1.5L17 9H8V7Zm8 10H7l2.5 2.5L8 21l-5-5 5-5 1.5 1.5L7 15h9v2Z"/></svg><span>${cameleonActive ? 'Utilisateur à usurper' : 'Mode caméléon'}</span><svg class="mobile-app-user-menu__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9.5 5 5 5-5 1.4 1.4-6.4 6.4-6.4-6.4L7 9.5Z"/></svg></button><div class="mobile-app-cameleon-menu" data-mobile-cameleon-menu hidden><input type="search" placeholder="Rechercher une personne" aria-label="Rechercher une personne" autocomplete="off" data-mobile-cameleon-search><div class="mobile-app-cameleon-menu__results" data-mobile-cameleon-results><p>Chargement…</p></div></div>`
            : '';
        const cameleonMenuControl = `${cameleonReturnControl}${cameleonPickerControl}`;
        const quickThemeControl = `<div class="mobile-app-theme-quick" role="group" aria-label="Thème"><span class="mobile-app-theme-quick__label">Thème</span><div class="mobile-app-theme-quick__options">${[
            ['light', 'Clair'],
            ['dark', 'Sombre'],
            ['system', 'Appareil'],
        ].map(([value, label]) => `<button type="button" data-mobile-quick-theme="${value}" aria-pressed="${state.themePreference === value ? 'true' : 'false'}" class="${state.themePreference === value ? 'is-selected' : ''}">${label}</button>`).join('')}</div></div>`;
        const identityControl = headerSubtitle ? `<div class="mobile-app-topbar__identity"><button class="mobile-app-topbar__user${cameleonActive ? ' is-cameleon' : ''}" type="button" data-mobile-user-menu-toggle aria-haspopup="menu" aria-expanded="false"><span class="mobile-app-topbar__user-copy"><span class="mobile-app-topbar__user-name" data-mobile-header-user-name data-full-name="${escapeHtml(headerSubtitle)}">${escapeHtml(headerSubtitle)}</span><span class="mobile-app-topbar__user-role">${escapeHtml(headerRole)}</span></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9.5 5 5 5-5 1.4 1.4-6.4 6.4-6.4-6.4L7 9.5Z"/></svg></button><div class="mobile-app-user-menu" role="menu" data-mobile-user-menu hidden><button type="button" role="menuitem" data-mobile-route="user_settings"><svg class="mobile-app-user-menu__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13a7.8 7.8 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.6 7.6 0 0 0-1.7-1L15 3.2h-4L10.6 6a7.6 7.6 0 0 0-1.7 1l-2.5-1-2 3.5L6.5 11a7.8 7.8 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.6 7.6 0 0 0 1.7 1l.4 2.8h4l.4-2.8a7.6 7.6 0 0 0 1.7-1l2.5 1 2-3.5-2.2-1.6ZM13 19h-1l-.3-2.4-.7-.3a5.6 5.6 0 0 1-1.3-.8l-.6-.5-2.2.9-.5-.9 1.9-1.4-.1-.8a5.7 5.7 0 0 1 0-1.6l.1-.8L6.4 9l.5-.9 2.2.9.6-.5a5.6 5.6 0 0 1 1.3-.8l.7-.3L12 5h1l.3 2.4.7.3a5.6 5.6 0 0 1 1.3.8l.6.5 2.2-.9.5.9-1.9 1.4.1.8a5.7 5.7 0 0 1 0 1.6l-.1.8 1.9 1.4-.5.9-2.2-.9-.6.5a5.6 5.6 0 0 1-1.3.8l-.7.3L13 19Zm-.5-3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-2a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/></svg><span>Paramètres utilisateur</span></button><button type="button" role="menuitem" data-mobile-logout><svg class="mobile-app-user-menu__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5v-2H7V6h3V4Zm5.6 3.4L14.2 8.8l2.2 2.2H9v2h7.4l-2.2 2.2 1.4 1.4 4.6-4.6-4.6-4.6Z"/></svg><span>Se déconnecter</span></button>${cameleonMenuControl}</div></div>` : '';
        const identityControlWithTheme = identityControl
            .replace('class="mobile-app-user-menu"', 'class="mobile-app-user-menu has-theme-quick"')
            .replace('<span>Se déconnecter</span></button>', `<span>Se déconnecter</span></button>${quickThemeControl}`);
        const raisedHeaderLogo = headerTitle.length > 20;
        app.innerHTML = `<div class="mobile-app-shell ${bottomPanel ? 'has-bottom-panel' : ''}">
            <div>${banners}<header class="mobile-app-topbar ${raisedHeaderLogo ? 'is-logo-raised' : ''}"><div class="mobile-app-topbar__heading">${identityControlWithTheme}</div>
                <div class="mobile-app-topbar__center">${headerLogoMarkup()}</div>
                ${companyControl ? `<div class="mobile-app-topbar__company">${companyControl}</div>` : ''}
                <div class="mobile-app-topbar__context${state.bootstrap?.dossiers?.length > 1 && !hasCustomContextControl ? ' has-dossier-chevron' : ''}">${assistantControl}${contextControl}</div>
                ${headerTitle ? `<h1 class="mobile-app-topbar__title">${escapeHtml(headerTitle)}</h1>` : ''}
            </header><div class="mobile-app-pull-refresh" data-mobile-pull-refresh aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5M4 18v-5h5M18.5 9A7 7 0 0 0 6.7 6.7L4 9m16 6-2.7 2.3A7 7 0 0 1 5.5 15"/></svg></div></div>
            <div class="mobile-app-upload-overlay" data-mobile-upload-overlay>${uploadFeedbacksMarkup()}</div>
            <main class="mobile-app-content ${escapeHtml(contentClass)}">${hrSelector}${content}</main>
            ${bottomPanel ? `<div class="mobile-app-bottom-panel">${bottomPanel}</div>` : ''}
            ${navigationBar(activeTab)}
        </div>`;
        if (hasCameleonPicker) {
            app.querySelector('[data-mobile-user-menu]')?.classList.add('has-cameleon-picker');
        }
        renderUploadFeedbacks();
        resumeUploadFeedbackDismissals();
        window.requestAnimationFrame(() => {
            syncHeaderDisplayName();
            syncDossierLogoAlignment();
        });
        enhanceMobileSelects(app);
        enhanceMobileDateFields(app);
        enhanceMobileTextFields(app);
        renderSiteLoginSuccessNotice();
        identityStatus.textContent = state.bootstrap?.profile?.display_name || 'Non connecté';
        dossierStatus.textContent = dossier?.name || 'Aucun dossier';
    }

    function cameleonTargetsMarkup(targets) {
        if (!Array.isArray(targets) || targets.length === 0) {
            return '<p>Aucune personne trouvée.</p>';
        }

        return targets.map((target) => {
            const details = [target.email, target.dossier_name]
                .map((value) => String(value || '').trim())
                .filter(Boolean)
                .join(' - ') || String(target.type || '').trim();
            return `<button type="button" role="menuitem" data-cameleon-target="${Number(target.id)}"><span>${escapeHtml(target.display_name)}</span>${details ? `<small>${escapeHtml(details)}</small>` : ''}</button>`;
        }).join('');
    }

    async function loadCameleonMenuTargets(query = '') {
        const results = app.querySelector('[data-mobile-cameleon-results]');
        if (!results) return;
        const normalizedQuery = String(query || '').trim();
        if (normalizedQuery.length === 1) {
            results.innerHTML = '<p>Saisissez au moins 2 caractères.</p>';
            return;
        }

        const requestSequence = ++state.cameleonRequestSequence;
        results.innerHTML = '<p>Chargement…</p>';
        try {
            const suffix = normalizedQuery ? `?q=${encodeURIComponent(normalizedQuery)}` : '';
            const response = await api(`/cameleon/targets${suffix}`);
            if (requestSequence !== state.cameleonRequestSequence) return;
            results.innerHTML = cameleonTargetsMarkup(response.data || []);
        } catch (error) {
            if (requestSequence !== state.cameleonRequestSequence) return;
            results.innerHTML = `<p class="is-error">${escapeHtml(error?.message || 'La recherche a échoué.')}</p><button type="button" data-mobile-cameleon-retry>Réessayer</button>`;
        }
    }

    function cameleonNotificationTargetFromUrl(rawValue) {
        let pathname = '';
        let params = {};
        try {
            const parsed = new URL(String(rawValue || ''), root.dataset.siteUrl);
            pathname = parsed.pathname;
            params = normalizedNotificationRouteParams(Object.fromEntries(parsed.searchParams.entries()));
        } catch (_) {
            pathname = String(rawValue || '');
        }
        const segments = pathname.split('/').filter(Boolean);
        const marker = segments.indexOf('cameleon');
        if (marker < 0 || marker + 2 >= segments.length) return null;
        const userId = Math.max(0, Number(segments[marker + 1]) || 0);
        if (userId < 1) return null;
        let destination = segments[marker + 2];
        try { destination = decodeURIComponent(destination); } catch (_) { /* La valeur brute reste exploitable. */ }
        destination = String(destination || '').trim() || 'notifications';

        return { userId, destination, params };
    }

    function normalizedNotificationRouteParams(raw = {}) {
        if (!raw || typeof raw !== 'object') return {};
        const params = {};
        const integerKeys = ['dossierId', 'employeeId', 'absenceId', 'reportId', 'taskId', 'documentId', 'folder', 'payslipId', 'conversationId', 'messageId', 'ticketId'];
        integerKeys.forEach((key) => {
            const value = Math.max(0, Number(raw[key]) || 0);
            if (value > 0) params[key] = value;
        });
        const year = String(raw.year || '').trim();
        const month = String(raw.month || '').trim();
        const section = String(raw.section || '').trim();
        if (/^\d{4}$/.test(year)) params.year = year;
        if (/^\d{4}-\d{2}$/.test(month)) params.month = month;
        if (/^[a-z_]{2,40}$/.test(section)) params.section = section;
        return params;
    }

    function notificationDestinationRoute(destination) {
        const value = String(destination || 'notifications').trim().toLowerCase();
        if (value.startsWith('employee_documents') || value.startsWith('employee-documents')) return 'employee_documents';
        if (value.startsWith('documents')) return 'documents';
        if (value.startsWith('payslips')) return 'payslips';
        if (value.startsWith('leave-balances') || value.startsWith('leave_balances') || value.startsWith('solde-cp')) return 'leave_balances';
        if (value.startsWith('tasks')) return 'tasks';
        if (value.startsWith('notes')) return 'notes';
        if (value.startsWith('expenses')) return 'expenses';
        if (value.startsWith('mileage')) return 'mileage';
        if (value.startsWith('absences')) return 'absences';
        if (value.startsWith('rh') || value.startsWith('hr')) return 'hr';
        if (['notifications', 'reports', 'contacts', 'messages', 'support', 'user_settings', 'user-settings'].includes(value)) {
            return value.replaceAll('-', '_');
        }

        return profileLandingRoute();
    }

    async function startCameleonSession(targetId, destination = '', routeParams = {}) {
        await flushMobileNotes();
        const response = await api('/cameleon/session', { method: 'POST', body: { target_id: Number(targetId) } });
        await purgeOfflineCache();
        resetMobileNotesState();
        state.cameleonSessionId = response.data.session_id;
        state.homeRequestSequence += 1;
        state.messageConversationId = null;
        state.routeHistory = [];
        state.route = 'home';
        state.routeParams = {};
        state.homeQuickActionCatalog = [];
        state.homeQuickActionKeys = [];
        state.homeQuickActionInitialKeys = [];
        state.bootstrap = null;
        await loadBootstrap();

        const targetDossierId = Math.max(0, Number(routeParams?.dossierId) || 0);
        if (targetDossierId > 0 && targetDossierId !== Number(state.activeDossierId)) {
            await api(`/dossiers/${targetDossierId}/activate`, { method: 'POST' });
            state.activeDossierId = targetDossierId;
            await loadBootstrap();
        }

        return navigate(destination ? notificationDestinationRoute(destination) : profileLandingRoute(), normalizedNotificationRouteParams(routeParams), false);
    }

    function renderLoading(title = 'Chargement') {
        renderFrame(title, '<div class="mobile-app-loading"><span>Chargement…</span></div>');
    }

    function renderError(error, retryRoute = state.route) {
        const requestId = error?.requestId ? `<small>request_id : ${escapeHtml(error.requestId)}</small>` : '';
        const offlineFailure = ['network_unavailable', 'network_failure'].includes(String(error?.code || ''));
        const title = offlineFailure ? 'Contenu indisponible hors ligne' : 'Un problème est survenu';
        const guidance = offlineFailure
            ? 'Seules les pages non sensibles déjà enregistrées sur cet appareil sont consultables hors ligne.'
            : (error?.retryable ? 'Vous pouvez réessayer sans risque.' : 'Vérifiez vos droits ou les données saisies.');
        const message = localizedMobileErrorMessage(error?.message, Number(error?.status) || 0, String(error?.code || ''));
        renderFrame(title, `<div class="mobile-app-error"><strong>${escapeHtml(message)}</strong><p>${escapeHtml(guidance)}</p>${requestId}<div class="mt-3"><button class="mobile-app-secondary-button" type="button" data-mobile-route="${escapeHtml(retryRoute)}">Réessayer</button></div></div>`);
    }

    function emptyState(title, message) {
        return `<div class="mobile-app-empty"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>`;
    }

    function writeButton(label, attributes = '') {
        return `<button class="mobile-app-primary-button" type="submit" ${state.readOnly ? 'disabled title="Action indisponible en lecture seule"' : ''} ${attributes}>${escapeHtml(label)}</button>`;
    }

    async function restoreIosPwaSession() {
        if (!iosPwaRuntime || iosPwaSessionRestoreAttempted || state.authenticated) return state.authenticated;
        iosPwaSessionRestoreAttempted = true;
        try {
            const response = await api('/auth/session');
            captureIosPwaAuthentication(response.data);
            state.authenticated = true;
            state.rememberConnection = true;
            state.owner = Boolean(response.data?.profile?.is_owner);
            state.readOnly = false;
            state.writesUntil = null;
            syncSafetyBar();
            return true;
        } catch (error) {
            if (Number(error?.status) !== 401) throw error;
            clearMobileAccessSession();
            await purgeOfflineCache();
            return false;
        }
    }

    async function start() {
        const sequence = ++state.requestSequence;
        state.offlineCacheActive = false;
        state.offlineCacheSavedAtUtc = null;
        try {
            if (state.backgroundResetPending) {
                await finishApplicationBackgroundReset();
                if (state.backgroundResetPending) {
                    const resetFailure = new Error('Le retour au compte propriétaire n’a pas encore pu être confirmé.');
                    resetFailure.code = 'cameleon_reset_pending';
                    resetFailure.retryable = true;
                    throw resetFailure;
                }
            }
            if (state.needsTransientLogout) {
                await controlRequest(root.dataset.logoutUrl, { method: 'DELETE', respectOffline: false });
                state.needsTransientLogout = false;
                state.authenticated = false;
                state.owner = false;
                state.readOnly = true;
                state.writesUntil = null;
                syncSafetyBar();
                clearStoredNavigation();
                try { sessionStorage.removeItem(runtimeSessionStorageKey); } catch (_) { /* The server session is already disconnected. */ }
                clearTransientBackgroundMarker();
            }
            if (!state.authenticated) {
                if (state.offline) {
                    const offline = new Error('Aucune connexion réseau. Les données déjà chargées restent disponibles.');
                    offline.code = 'network_unavailable';
                    offline.retryable = true;
                    renderLogin(offline);
                    return;
                }
                renderLogin();
            } else {
                renderLoading('Maison Pilote');
            }
            const configResponse = await api('/config', {
                publicAuth: iosRuntime && state.biometricLocked,
            });
            if (sequence !== state.requestSequence) return;
            state.config = configResponse.data;
            if (state.config?.maintenance) {
                renderFrame('Maintenance', `<div class="mobile-app-error"><strong>Maison Pilote est temporairement indisponible</strong><p>${escapeHtml(state.config.maintenance_message || 'Réessayez dans quelques instants.')}</p><button class="mobile-app-secondary-button" type="button" data-mobile-restart>Réessayer</button></div>`);
                return;
            }
            if (state.config?.update_mode === 'mandatory') {
                renderMandatoryUpdate();
                return;
            }
            if (!state.authenticated && iosPwaRuntime) {
                if (await restoreIosPwaSession()) renderLoading('Maison Pilote');
            }
            if (!state.authenticated) {
                return;
            }
            if (state.biometricLocked) {
                renderBiometricLock();
                return;
            }
            if (!state.offline) await refreshMobileAccessSessionIfNeeded();
            if (!await loadBootstrap(sequence)) return;
            await completeAuthenticatedStart();
        } catch (error) {
            if (sequence !== state.requestSequence) return;
            const authenticationFailure = iosRuntime
                ? Number(error?.status) === 401
                : [401, 403].includes(Number(error?.status));
            if (!state.authenticated || authenticationFailure) {
                state.authenticated = false;
                if (iosRuntime) clearMobileAccessSession();
                await purgeOfflineCache();
                clearStoredNavigation();
                try { sessionStorage.removeItem(runtimeSessionStorageKey); } catch (_) { /* The login screen remains authoritative. */ }
                clearTransientBackgroundMarker();
                renderLogin(error);
            } else {
                renderError(error, 'home');
            }
        }
    }

    async function loadBootstrap(sequence = null) {
        const query = state.activeDossierId ? `?dossier_id=${encodeURIComponent(state.activeDossierId)}` : '';
        const response = await api(`/bootstrap${query}`);
        if (sequence !== null && sequence !== state.requestSequence) return false;
        state.bootstrap = response.data;
        if (iosRuntime) {
            state.owner = Boolean(response.data?.profile?.is_owner);
            state.readOnly = false;
            state.writesUntil = null;
            syncSafetyBar();
        }
        state.footerNavigationKeys = Array.isArray(response.data.footer_navigation_keys)
            ? response.data.footer_navigation_keys.map(String)
            : [];
        state.activeDossierId = response.data.active_dossier_id || response.data.dossiers?.[0]?.id || null;
        state.config = response.data.config || state.config;
        state.cameleonSessionId = response.data.cameleon?.session_id || null;
        return true;
    }

    function renderMandatoryUpdate() {
        prepareMaisonPiloteRender();
        app.innerHTML = `<div class="mobile-app-update-screen">${logoMarkup()}<h1>Mise à jour requise</h1><p>La version installée (${escapeHtml(state.versionName)}) n’est plus compatible. Installez la version ${escapeHtml(state.config?.latest_version_name || '')} pour continuer.</p><button class="mobile-app-primary-button mobile-app-update-screen__action" type="button" data-mobile-update>Mettre à jour maintenant</button><p class="mobile-app-update-screen__help">Vérifiez votre connexion puis relancez le téléchargement si nécessaire.</p><button class="mobile-app-secondary-button" type="button" data-mobile-restart>Réessayer</button><button class="mobile-app-secondary-button" type="button" data-mobile-help>Aide</button></div>`;
    }

    function beginApplicationBackground() {
        if (state.applicationBackgrounded) return;
        state.applicationBackgrounded = true;
        const cameleonActive = Boolean(state.cameleonSessionId || state.bootstrap?.cameleon);
        if (iosRuntime && nativeBiometricBridgeAvailable && state.biometricEnabled) {
            state.biometricLocked = true;
            state.bootstrap = null;
        }
        if (!cameleonActive) return;

        // L'identité caméléon ne survit jamais à une sortie de l'application.
        // Le bootstrap associé est également oublié pour ne pas réafficher une
        // identité usurpée depuis le cache pendant une reprise hors ligne.
        state.cameleonSessionId = null;
        state.bootstrap = null;
        void purgeOfflineCache();
        state.backgroundResetPending = true;
        state.backgroundResetPromise = api('/cameleon/sessions', {
            method: 'DELETE',
            keepalive: true,
        }).then(() => {
            state.backgroundResetPending = false;
        }).catch(() => {
            // La reprise réessaiera avant tout nouveau bootstrap authentifié.
        }).finally(() => {
            state.backgroundResetPromise = null;
        });
    }

    async function finishApplicationBackgroundReset() {
        if (state.backgroundResetPromise) await state.backgroundResetPromise;
        if (!state.backgroundResetPending || state.offline) return;
        try {
            await api('/cameleon/sessions', { method: 'DELETE' });
            await purgeOfflineCache();
            state.backgroundResetPending = false;
        } catch (_) {
            // Tant que la révocation ne peut pas être confirmée, aucun
            // bootstrap potentiellement caméléon n'est restauré.
        }
    }

    async function resumeApplicationFromBackground() {
        if (!state.applicationBackgrounded) return false;
        if (state.backgroundResumePromise) {
            await state.backgroundResumePromise;
            return true;
        }

        state.applicationBackgrounded = false;
        state.backgroundResumePromise = (async () => {
            if (!resumeTransientSession()) return;
            await finishApplicationBackgroundReset();
            if (state.authenticated && (state.biometricLocked || !state.bootstrap)) await start();
            if (state.authenticated && state.bootstrap) void processNativeShareInbox();
        })().finally(() => {
            state.backgroundResumePromise = null;
        });
        await state.backgroundResumePromise;
        return true;
    }

    function renderSystemOverview() {
        beginApplicationBackground();
        pauseUploadFeedbackDismissals();
        prepareMaisonPiloteRender();
        app.innerHTML = `<div class="mobile-app-system-overview" data-mobile-system-overview>
            <p>Applications récentes</p>
            <button class="mobile-app-system-overview__card" type="button" data-mobile-resume>
                <span>Maison Pilote</span>
                <strong>Toucher pour revenir à l’application</strong>
            </button>
        </div>`;
    }

    async function restoreCurrentScreen() {
        if (await resumeApplicationFromBackground()) return;
        if (!state.authenticated) {
            renderLogin();
            return;
        }
        if (!state.bootstrap) {
            await start();
            return;
        }
        await navigate(state.route, state.routeParams, false);
    }

    async function navigate(route, params = {}, remember = true) {
        state.offlineCacheActive = false;
        state.offlineCacheSavedAtUtc = null;
        const assistantRequested = route === 'assistant';
        if (assistantRequested) {
            route = state.route && state.route !== 'assistant' ? state.route : profileLandingRoute();
            params = {};
            remember = false;
            state.route = route;
            state.routeParams = {};
            state.routeHistory = state.routeHistory.filter((entry) => entry.route !== 'assistant');
        }
        if (state.route === 'notes' && route !== 'notes') await flushMobileNotes();
        if (state.route === 'documents' && route !== 'documents') {
            state.documentSelectionMode = false;
            state.selectedDocumentItems.clear();
        }
        stopMessagePolling();
        stopLeaveBalancePolling();
        stopNotificationPreferencesPolling();
        if (state.documentSearchTimer !== null) window.clearTimeout(state.documentSearchTimer);
        state.documentSearchTimer = null;
        state.documentSearchRequestSequence += 1;
        if (route !== 'notifications') state.notificationPreferencesOpen = false;

        const normalizedRoute = normalizeProfileRoute(route);
        if (normalizedRoute !== route) {
            route = normalizedRoute;
            params = {};
            state.route = route;
            state.routeParams = {};
            state.routeHistory = state.routeHistory.filter((entry) => !['home', 'more'].includes(entry.route));
        }

        if (state.bootstrap && grhRoutes.has(route) && !isSalariedUser() && !hasGrhAccess()) {
            route = profileLandingRoute();
            params = {};
            state.route = route;
            state.routeParams = {};
            state.routeHistory = state.routeHistory.filter((entry) => !grhRoutes.has(entry.route));
        }
        if (state.bootstrap && isSalariedUser() && salariedRestrictedRoutes.has(route)) {
            route = profileLandingRoute();
            params = {};
            state.route = route;
            state.routeParams = {};
            state.routeHistory = state.routeHistory.filter((entry) => !salariedRestrictedRoutes.has(entry.route));
        }
        if (state.bootstrap && route === 'payslips' && !can('payslips.view_own')) {
            route = profileLandingRoute();
            params = {};
            state.route = route;
            state.routeParams = {};
            state.routeHistory = state.routeHistory.filter((entry) => entry.route !== 'payslips');
        }
        if (state.bootstrap && route === 'leave_balances' && !can('leave_balances.view_own')) {
            route = profileLandingRoute();
            params = {};
            state.route = route;
            state.routeParams = {};
            state.routeHistory = state.routeHistory.filter((entry) => entry.route !== 'leave_balances');
        }
        if (state.bootstrap && route === 'absence_create' && !(can('absences.create') || can('absences.approve'))) {
            route = can('absences.list_own') ? 'absences' : profileLandingRoute();
            params = {};
            state.route = route;
            state.routeParams = {};
            state.routeHistory = state.routeHistory.filter((entry) => entry.route !== 'absence_create');
        }
        if (state.bootstrap && ['expenses', 'expense_create', 'expense_item_create'].includes(route)
            && !(can('expenses.manage_own') || can('expenses.create') || can('expenses.approve'))) {
            route = profileLandingRoute();
            params = {};
            state.route = route;
            state.routeParams = {};
            state.routeHistory = state.routeHistory.filter((entry) => !['expenses', 'expense_create', 'expense_item_create'].includes(entry.route));
        }
        if (state.bootstrap && ['mileage', 'mileage_create', 'mileage_submit', 'mileage_settings'].includes(route)
            && !(can('mileage.manage_own') || can('mileage.create'))) {
            route = profileLandingRoute();
            params = {};
            state.route = route;
            state.routeParams = {};
            state.routeHistory = state.routeHistory.filter((entry) => !String(entry.route).startsWith('mileage'));
        }
        if (state.bootstrap && route === 'employee_mobile_access' && !can('employee_mobile_access.manage')) {
            route = profileLandingRoute();
            params = {};
            state.route = route;
            state.routeParams = {};
            state.routeHistory = state.routeHistory.filter((entry) => entry.route !== 'employee_mobile_access');
        }
        if (state.bootstrap && route === 'documents' && !can('documents.list')) {
            route = profileLandingRoute();
            params = {};
            state.route = route;
            state.routeParams = {};
            state.routeHistory = state.routeHistory.filter((entry) => entry.route !== 'documents');
        }
        if (state.bootstrap && taskRoutes.has(route) && isSalariedOnlyUser()) {
            route = profileLandingRoute();
            params = {};
            state.route = route;
            state.routeParams = {};
            state.routeHistory = state.routeHistory.filter((entry) => !taskRoutes.has(entry.route));
        }

        if (remember) {
            const nextParams = { ...params };
            const routeChanged = state.route !== route
                || JSON.stringify(state.routeParams) !== JSON.stringify(nextParams);

            if (routeChanged) {
                state.routeHistory.push({
                    route: state.route,
                    params: { ...state.routeParams },
                });
                state.routeHistory = state.routeHistory.slice(-50);
            }

            state.route = route;
            state.routeParams = nextParams;
        }
        persistNavigation();
        if (!state.bootstrap && route !== 'home') return start();
        renderLoading(routeTitle(route));
        try {
            if (grhRoutes.has(route) && (can('absences.approve') || can('expenses.approve'))) {
                try {
                    await loadHrPendingValidations();
                } catch (error) {
                    state.hrPendingValidationCount = 0;
                    state.hrPendingValidations = null;
                    if (route === 'hr_pending') throw error;
                }
            }
            switch (route) {
                case 'home': await renderHome(); break;
                case 'documents': await renderDocuments(params); break;
                case 'hr': await renderHr(params); break;
                case 'hr_pending': await renderHrPendingValidations(); break;
                case 'tasks': await renderTasks(params); break;
                case 'notes': await renderNotes(); break;
                case 'more': renderMore(); break;
                case 'footer_settings': renderFooterNavigationSettings(true); break;
                case 'support':
                    state.supportSelectedTicketId = Math.max(0, Number(params.ticketId) || 0) || null;
                    state.supportReplyExpanded = false;
                    state.supportCancelConfirmation = false;
                    if (state.supportSelectedTicketId) await renderSupportDetail();
                    else await renderSupport();
                    break;
                case 'notifications': await renderNotifications(); break;
                case 'payslips': await renderPayslips(params); break;
                case 'leave_balances': await renderLeaveBalances(); break;
                case 'employee_documents': await renderEmployeeDocuments(params); break;
                case 'absences': await renderAbsences(params); break;
                case 'absence_create': await renderAbsenceForm(params); break;
                case 'expenses': await renderExpenses(params); break;
                case 'expense_create': await renderExpenseForm(params); break;
                case 'expense_item_create': await renderExpenseItemForm(params); break;
                case 'mileage': await renderMileage(params); break;
                case 'mileage_create': await renderMileageTripForm(params); break;
                case 'mileage_submit': await renderMileageSubmission(params); break;
                case 'mileage_settings': await renderMileageSettings(); break;
                case 'payslip_latest': await renderLatestPayslipDownload(); break;
                case 'sales_revenue': await renderSalesRevenue(); break;
                case 'employee_mobile_access': await renderEmployeeMobileAccess(params); break;
                case 'reports': await renderReports(); break;
                case 'report_create': await renderReportForm(); break;
                case 'contacts': await renderContacts(); break;
                case 'messages': await renderMessages(params); break;
                case 'task_create': await renderTaskForm(); break;
                case 'user_settings': await renderUserSettings(); break;
                case 'desktop': renderDesktopLink(); break;
                default: await renderHome();
            }
            if (assistantRequested && isAdminUser()) window.setTimeout(startAssistantRecognition, 150);
        } catch (error) {
            if (error.status === 426) {
                state.config = error.payload?.error?.fields?.config?.[0] || state.config;
                renderMandatoryUpdate();
            } else {
                renderError(error, route);
            }
        }
    }

    async function navigateBack() {
        const previousRoute = state.routeHistory.pop();

        if (!previousRoute) {
            return;
        }

        state.route = previousRoute.route;
        state.routeParams = previousRoute.params;
        persistNavigation();
        await navigate(previousRoute.route, previousRoute.params, false);
    }

    function routeTitle(route) {
        if (route === 'employee_mobile_access') return employeeMobileAccessTitle();
        return ({ home: 'Accueil', documents: 'Documents', hr: 'GRH', hr_pending: 'À valider', tasks: 'Tâches', notes: 'Notes', more: 'Plus', footer_settings: 'Pied de page', support: 'Support', notifications: 'Historique des notifications', payslips: 'Bulletins', payslip_latest: 'Bulletins', leave_balances: 'Solde CP', employee_documents: 'Autres documents', absences: 'Absences', expenses: 'Notes de frais', expense_create: 'Nouvelle note de frais', expense_item_create: 'Nouvelle dépense', mileage: 'IK', mileage_create: 'Nouveau voyage', mileage_submit: 'Envoyer en validation', mileage_settings: 'Ma situation', sales_revenue: 'Chiffre d’affaires VRP', reports: 'États comptables', report_create: 'Générer un état comptable', contacts: mobileReferentContactLabel(), messages: 'Messagerie', user_settings: 'Paramètres utilisateur' })[route] || 'Maison Pilote';
    }

    function mobileReferentContactLabel() {
        const firstName = mobileReferentFirstName();
        if (firstName) return `Contacter ${firstName}`;
        const fullName = String(state.bootstrap?.primary_accounting_referent_name || '').trim();
        return fullName ? `Contacter ${fullName.split(/\s+/u)[0]}` : 'Contacter le référent';
    }

    function mobileReferentFirstName() {
        const explicit = String(state.bootstrap?.primary_accounting_referent_first_name || '').trim();
        if (explicit) return explicit;
        return String(state.bootstrap?.primary_accounting_referent_name || '').trim().split(/\s+/u)[0] || '';
    }

    const assistantOpenStatuses = new Set(['pending', 'running']);

    function stopAssistantPolling() {
        if (state.assistantPollingTimer !== null) window.clearTimeout(state.assistantPollingTimer);
        state.assistantPollingTimer = null;
    }

    function scheduleAssistantPolling() {
        stopAssistantPolling();
        const runId = Math.max(0, Number(state.assistantRun?.id) || 0);
        if (runId < 1 || !assistantOpenStatuses.has(String(state.assistantRun?.status || ''))) return;
        state.assistantPollingTimer = window.setTimeout(() => refreshAssistantRun(runId), 3000);
    }

    function resetAssistantFeedbackDismissal() {
        if (state.assistantFeedbackDismissTimer !== null) {
            window.clearTimeout(state.assistantFeedbackDismissTimer);
            state.assistantFeedbackDismissTimer = null;
        }
        state.assistantFeedbackDismissExpiresAt = 0;
        state.assistantFeedbackDismissed = false;
    }

    async function submitAssistantPrompt(sourceOverride = null, nativeRequestId = null) {
        const prompt = String(state.assistantPrompt || '').trim();
        if (!prompt || state.assistantSubmitting || state.readOnly) return;
        stopAssistantPolling();
        resetAssistantFeedbackDismissal();
        state.assistantSubmitting = true;
        state.assistantError = '';
        state.assistantCancellationFailed = false;
        state.assistantRun = null;
        renderUploadFeedbacks();
        try {
            const requestedSource = String(sourceOverride || '').trim();
            const source = ['ios_voice_assistant', 'siri_app_intent', 'watchos_voice_assistant'].includes(requestedSource)
                ? requestedSource
                : (iosRuntime ? 'ios_voice_assistant' : 'web_emulator_voice_assistant');
            const response = await api('/assistant/codex/runs', {
                method: 'POST',
                idempotencyKey: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(nativeRequestId || ''))
                    ? String(nativeRequestId)
                    : undefined,
                body: { prompt, source },
            });
            state.assistantRun = response.data || null;
            if (nativeRequestId) {
                window.MaisonPiloteNative?.assistantRequest?.acknowledge?.(String(nativeRequestId));
            }
        } catch (error) {
            state.assistantError = error?.message || "La demande n'a pas pu être transmise.";
        } finally {
            state.assistantSubmitting = false;
            renderUploadFeedbacks();
            scheduleAssistantPolling();
        }
    }

    async function refreshAssistantRun(runId = Number(state.assistantRun?.id) || 0) {
        if (runId < 1) return;
        stopAssistantPolling();
        try {
            const response = await api(`/assistant/codex/runs/${runId}`);
            state.assistantRun = response.data || state.assistantRun;
            state.assistantError = '';
        } catch (error) {
            state.assistantError = error?.message || 'Le suivi est momentanément indisponible.';
        }
        renderUploadFeedbacks();
        scheduleAssistantPolling();
    }

    async function cancelAssistantRun() {
        const runId = Math.max(0, Number(state.assistantRun?.id) || 0);
        if (runId < 1 || state.assistantCancelling) return;
        state.assistantCancelling = true;
        state.assistantError = '';
        state.assistantCancellationFailed = false;
        renderUploadFeedbacks();
        try {
            const response = await api(`/assistant/codex/runs/${runId}`, { method: 'DELETE' });
            state.assistantRun = response.data || state.assistantRun;
        } catch (error) {
            state.assistantError = error?.message || "L'annulation n'a pas pu être demandée.";
            state.assistantCancellationFailed = true;
        } finally {
            state.assistantCancelling = false;
            renderUploadFeedbacks();
            scheduleAssistantPolling();
        }
    }

    function cancelAssistantListening() {
        const recognition = state.assistantRecognition;
        state.assistantListening = false;
        state.assistantRecognition = null;
        state.assistantError = '';
        state.assistantCancellationFailed = false;
        state.assistantFeedbackDismissed = true;
        try { recognition?.abort(); } catch (_) { /* La session est déjà terminée. */ }
        if (iosRuntime) {
            try { window.webkit?.messageHandlers?.speechRecognition?.postMessage({ action: 'cancel' }); } catch (_) { /* Web Speech handles browser cancellation. */ }
        }
        renderUploadFeedbacks();
    }

    async function acceptAssistantTranscript(value) {
        if (!state.assistantListening) return;
        const transcript = String(value || '').trim();
        state.assistantListening = false;
        state.assistantRecognition = null;
        if (!transcript) {
            state.assistantError = "Aucune demande n'a été reconnue. Vous pouvez recommencer.";
            renderUploadFeedbacks();
            return;
        }
        state.assistantPrompt = transcript;
        renderUploadFeedbacks();
        await submitAssistantPrompt();
    }

    function startAssistantRecognition() {
        if (state.assistantListening || state.assistantSubmitting || assistantOpenStatuses.has(String(state.assistantRun?.status || ''))) return;
        resetAssistantFeedbackDismissal();
        state.assistantPrompt = '';
        state.assistantRun = null;
        state.assistantError = '';
        state.assistantCancellationFailed = false;
        if (state.readOnly) {
            state.assistantError = "L'émulateur est en lecture seule.";
            renderUploadFeedbacks();
            return;
        }
        const nativeSpeechRecognition = iosRuntime && window.webkit?.messageHandlers?.speechRecognition;
        if (nativeSpeechRecognition) {
            state.assistantListening = true;
            renderUploadFeedbacks();
            try {
                nativeSpeechRecognition.postMessage({ action: 'start', language: 'fr-FR' });
            } catch (_) {
                state.assistantListening = false;
                state.assistantError = "La dictée n'a pas pu démarrer.";
                renderUploadFeedbacks();
            }
            return;
        }
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Recognition) {
            state.assistantError = "La reconnaissance vocale n'est pas disponible sur cet appareil.";
            renderUploadFeedbacks();
            return;
        }
        const recognition = new Recognition();
        recognition.lang = 'fr-FR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 3;
        state.assistantRecognition = recognition;
        state.assistantListening = true;
        state.assistantError = '';
        renderUploadFeedbacks();
        recognition.onresult = async (event) => {
            await acceptAssistantTranscript(event.results?.[0]?.[0]?.transcript);
        };
        recognition.onerror = (event) => {
            if (!state.assistantListening) return;
            state.assistantListening = false;
            state.assistantRecognition = null;
            state.assistantError = event.error === 'not-allowed'
                ? "Autorisez le microphone pour utiliser la dictée."
                : "La dictée n'a pas pu aboutir.";
            renderUploadFeedbacks();
        };
        recognition.onend = () => {
            if (!state.assistantListening) return;
            state.assistantListening = false;
            state.assistantRecognition = null;
            state.assistantError = "Aucune demande n'a été reconnue.";
            renderUploadFeedbacks();
        };
        try {
            recognition.start();
        } catch (_) {
            state.assistantListening = false;
            state.assistantRecognition = null;
            state.assistantError = "La dictée n'a pas pu démarrer.";
            renderUploadFeedbacks();
        }
    }

    function renderMore() {
        const footerRoutes = footerNavigationRoutes();
        const firstName = mobileReferentFirstName();
        const icons = {
            home: quickActionIcons.documents,
            documents: quickActionIcons.documents,
            reports: quickActionIcons.reports,
            payslips: quickActionIcons.last_payslip,
            leave_balances: quickActionIcons.absence,
            absences: quickActionIcons.absence,
            expenses: quickActionIcons.expense,
            mileage: quickActionIcons.mileage,
            hr: quickActionIcons.hr,
            tasks: quickActionIcons.task,
            notes: quickActionIcons.notes,
            notifications: quickActionIcons.notifications,
            contacts: quickActionIcons.contact,
            support: quickActionIcons.support,
        };
        const actions = mobileNavigationCatalog()
            .filter(([route]) => !footerRoutes.includes(route) && !['home', 'more'].includes(route))
            .map(([route, label, , subtitle]) => [
                route,
                route === 'contacts' ? mobileReferentContactLabel() : label,
                route === 'contacts'
                    ? (firstName ? `Consulter les coordonnées de ${firstName}` : 'Consulter les coordonnées du référent principal')
                    : subtitle,
                icons[route] || quickActionIcons.documents,
            ]);
        const footerSettings = `<button class="mobile-app-secondary-button mobile-app-more-footer-settings-button" type="button" data-mobile-route="footer_settings">
            <span aria-hidden="true">${quickActionIcons.tune}</span>
            <span>Personnaliser le pied de page</span>
        </button>`;
        const content = `<div class="mobile-app-more-list">${actions.map(([route, label, subtitle, icon]) => `
            <button class="mobile-app-more-action" type="button" data-mobile-route="${route}">
                <span class="mobile-app-more-action__icon">${icon}</span>
                <span class="mobile-app-more-action__copy"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(subtitle)}</span></span>
            </button>
        `).join('')}</div>${footerSettings}`;
        renderFrame('Plus', content, { tab: 'more' });
    }

    function renderFooterNavigationSettings(reset = false) {
        const catalog = mobileNavigationCatalog();
        if (reset || !state.footerNavigationDraftKeys.length) {
            state.footerNavigationDraftKeys = footerNavigationRoutes();
            state.footerNavigationMessage = '';
        }
        const selected = state.footerNavigationDraftKeys
            .map((route) => catalog.find(([candidate]) => candidate === route))
            .filter(Boolean);
        const hidden = catalog.filter(([route]) => !state.footerNavigationDraftKeys.includes(route));
        const row = ([route, label], index, isSelected) => {
            const required = ['home', 'more'].includes(route);
            return `<article class="mobile-app-footer-setting-row">
                <span class="mobile-app-footer-setting-row__icon" data-route="${escapeHtml(route)}"></span>
                <span class="mobile-app-footer-setting-row__copy"><strong>${escapeHtml(label)}</strong>${required ? '<small>Toujours affiché</small>' : ''}</span>
                ${isSelected ? `<button type="button" data-mobile-footer-move="up" data-mobile-footer-route="${escapeHtml(route)}" aria-label="Monter ${escapeHtml(label)}" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-mobile-footer-move="down" data-mobile-footer-route="${escapeHtml(route)}" aria-label="Descendre ${escapeHtml(label)}" ${index === selected.length - 1 ? 'disabled' : ''}>↓</button>` : ''}
                <button type="button" data-mobile-footer-toggle="${escapeHtml(route)}" aria-label="${isSelected ? 'Retirer' : 'Ajouter'} ${escapeHtml(label)}" ${required ? 'disabled' : ''}>${isSelected ? '−' : '+'}</button>
            </article>`;
        };
        const message = state.footerNavigationMessage
            ? `<p class="mobile-app-footer-settings__message ${state.footerNavigationMessage.startsWith('Impossible') ? 'is-error' : ''}" role="status">${escapeHtml(state.footerNavigationMessage)}</p>`
            : '';
        const content = `<div class="mobile-app-footer-settings">
            <section><h2>Boutons affichés</h2><div class="mobile-app-footer-settings__list">${selected.map((entry, index) => row(entry, index, true)).join('')}</div></section>
            ${hidden.length ? `<section><h2>Disponibles dans Plus</h2><div class="mobile-app-footer-settings__list">${hidden.map((entry, index) => row(entry, index, false)).join('')}</div></section>` : ''}
            ${message}
            <button class="mobile-app-primary-button" type="button" data-mobile-footer-save ${state.readOnly || state.footerNavigationSaving ? 'disabled' : ''}>${state.footerNavigationSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>`;
        renderFrame('Pied de page', content, { tab: 'more' });
    }

    async function renderSupport(message = '') {
        const requestSequence = ++state.supportRequestSequence;
        const statuses = state.supportStatuses.length
            ? state.supportStatuses
            : ['pending', 'in_progress', 'awaiting_requester'];
        const query = new URLSearchParams({ statuses: statuses.join(',') });
        if (state.supportSearch.trim()) query.set('q', state.supportSearch.trim());
        const response = await api(`/support/tickets?${query.toString()}`);
        if (requestSequence !== state.supportRequestSequence || state.route !== 'support' || state.supportSelectedTicketId !== null) return;
        const data = response.data || {};
        const statusOptions = Array.isArray(data.status_options) ? data.status_options : [];
        const typeOptions = Array.isArray(data.type_options) ? data.type_options : [];
        const dossiers = Array.isArray(data.dossiers) ? data.dossiers : [];
        const tickets = Array.isArray(data.tickets) ? data.tickets : [];
        const selectedLabels = statusOptions.filter((option) => statuses.includes(String(option.key))).map((option) => option.label);
        const defaultStatuses = ['pending', 'in_progress', 'awaiting_requester'];
        const onlyOngoingStatuses = statuses.length === defaultStatuses.length
            && defaultStatuses.every((status) => statuses.includes(status));
        const filterLabel = onlyOngoingStatuses
            ? 'En cours'
            : (selectedLabels.length === 1 ? selectedLabels[0] : `${selectedLabels.length} statuts sélectionnés`);
        const statusSelector = `<details class="mobile-app-support-status-selector" ${state.supportStatusSelectorOpen ? 'open' : ''}><summary>${escapeHtml(filterLabel)}</summary><div>${statusOptions.map((option) => {
            const checked = statuses.includes(String(option.key));
            return `<label><input type="checkbox" value="${escapeHtml(option.key)}" data-mobile-support-status ${checked ? 'checked' : ''}><span>${escapeHtml(option.label)}</span></label>`;
        }).join('')}</div></details>`;
        const search = `<div class="mobile-app-support-search"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 3a6.5 6.5 0 1 0 3.9 11.7l5.45 5.45 1.3-1.3-5.45-5.45A6.5 6.5 0 0 0 9.5 3Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"/></svg><input class="mobile-app-search" type="search" maxlength="120" value="${escapeHtml(state.supportSearch)}" placeholder="Rechercher un ticket" aria-label="Rechercher un ticket" autocomplete="off" data-mobile-support-search-entry></div>`;
        const createForm = state.supportCreateExpanded ? `<form class="mobile-app-form-panel mobile-app-support-create" data-mobile-support-create>
            <div class="mobile-app-field"><label>Type de demande</label><select name="type" required>${typeOptions.map((option) => `<option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>`).join('')}</select></div>
            <div class="mobile-app-field"><label>Dossier concerné</label><select name="dossier_id"><option value="" selected>Aucun dossier en particulier</option>${dossiers.map((dossier) => `<option value="${Number(dossier.id)}">${escapeHtml(dossier.name)}</option>`).join('')}</select></div>
            <div class="mobile-app-field"><label>Objet</label><input name="subject" maxlength="140" required></div>
            <div class="mobile-app-field"><label>Message</label><textarea name="message" maxlength="5000" rows="4" required></textarea></div>
            ${writeButton('Envoyer le ticket')}
        </form>` : '';
        const createToggle = `<button class="mobile-app-secondary-button mobile-app-support-create-toggle" type="button" data-mobile-support-create-toggle aria-expanded="${state.supportCreateExpanded ? 'true' : 'false'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></svg><span>${state.supportCreateExpanded ? 'Masquer la création' : 'Créer un nouveau ticket'}</span></button>`;
        const list = tickets.length ? `<div class="mobile-app-support-list"><p class="mobile-app-support-count">${tickets.length} ${tickets.length === 1 ? 'ticket' : 'tickets'}</p>${tickets.map((ticket) => {
            const dossier = String(ticket.dossier?.name || '');
            const meta = [ticket.reference, ticket.type_label, dossier].filter(Boolean).join(' - ');
            return `<button class="mobile-app-support-ticket" type="button" data-mobile-support-ticket="${Number(ticket.id)}" aria-label="Consulter ${escapeHtml(ticket.display_title || ticket.subject || ticket.type_label)}">
                <header><h3>${escapeHtml(ticket.display_title || ticket.subject || ticket.type_label)}</h3><span data-tone="${escapeHtml(ticket.status_tone || 'default')}">${escapeHtml(ticket.status_label)}</span></header>
                <p class="mobile-app-support-ticket__meta">${escapeHtml(meta)}</p>
                ${ticket.last_message_preview ? `<p>${escapeHtml(ticket.last_message_preview)}</p>` : ''}
                <time datetime="${escapeHtml(ticket.updated_at_utc || '')}">Mis à jour le ${escapeHtml(formatDate(ticket.updated_at_utc, true))}</time>
            </button>`;
        }).join('')}</div>` : emptyState('Aucun ticket', state.supportSearch.trim()
            ? 'Aucun ticket ne correspond à la recherche.'
            : 'Aucun ticket ne correspond aux statuts sélectionnés.');
        const alert = message ? `<div class="mobile-app-settings-message is-success" role="status">${escapeHtml(message)}</div>` : '';
        renderFrame('Support', `${alert}${createToggle}${createForm}${search}${statusSelector}${list}`, { tab: 'support' });
    }

    function supportDetailMarkup(ticket, message = '', messageTone = 'success') {
        const dossier = String(ticket.dossier?.name || 'Aucun dossier en particulier');
        const meta = [ticket.reference, ticket.type_label, dossier].filter(Boolean).join(' - ');
        const alert = message
            ? `<div class="mobile-app-settings-message ${messageTone === 'error' ? 'is-error' : 'is-success'}" role="status">${escapeHtml(message)}</div>`
            : '';
        const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
        const history = messages.length ? `<div class="mobile-app-support-thread">${messages.map((entry) => {
            const attachments = Array.isArray(entry.attachments) ? entry.attachments : [];
            return `<article class="mobile-app-support-message ${entry.is_mine ? 'is-mine' : ''}">
                <header><strong>${escapeHtml(entry.author_label || 'Intervenant')}</strong><time datetime="${escapeHtml(entry.created_at_utc || '')}">${escapeHtml(formatDate(entry.created_at_utc, true))}</time></header>
                <p>${escapeHtml(entry.body || '')}</p>
                ${attachments.length ? `<div class="mobile-app-support-attachments">${attachments.map((attachment) => `<button class="mobile-app-secondary-button mobile-app-support-attachment" type="button" data-open-binary="${escapeHtml(attachment.content_url || '')}" title="Ouvrir ${escapeHtml(attachment.filename || 'Image jointe')}">${quickActionIcons.file}<span>${escapeHtml(attachment.filename || 'Image jointe')}</span></button>`).join('')}</div>` : ''}
                ${entry.is_mine ? '<small>Envoyé par vous</small>' : ''}
            </article>`;
        }).join('')}</div>` : emptyState('Aucun échange', 'Aucun message n’est encore associé à ce ticket.');
        const reply = ticket.can_reply ? (state.supportReplyExpanded ? `<form class="mobile-app-form-panel mobile-app-support-reply" data-mobile-support-reply="${Number(ticket.id)}">
            <header><strong>Votre précision</strong><button type="button" data-mobile-support-reply-close aria-label="Fermer">×</button></header>
            <div class="mobile-app-field"><label>Message</label><textarea name="message" maxlength="5000" rows="4" required data-mobile-support-reply-message></textarea></div>
            <div class="mobile-app-field"><label>Images jointes</label><input type="file" name="attachments[]" accept="image/*" multiple></div>
            <p class="mobile-app-support-form-note">5 images maximum - 5 Mo par image</p>
            <p class="mobile-app-support-form-feedback" data-mobile-support-reply-feedback role="status"></p>
            ${writeButton('Envoyer')}
        </form>` : `<button class="mobile-app-primary-button mobile-app-support-detail-action" type="button" data-mobile-support-reply-toggle>Ajouter une précision</button>`) : '';
        const cancellation = ticket.can_cancel ? (state.supportCancelConfirmation ? `<section class="mobile-app-form-panel mobile-app-support-cancel-confirmation" data-mobile-support-cancel-confirmation="${Number(ticket.id)}">
            <header><strong>Annuler ce ticket ?</strong><button type="button" data-mobile-support-cancel-close aria-label="Fermer">×</button></header>
            <p>Cette action ferme le ticket. Son historique restera consultable.</p>
            <p class="mobile-app-support-form-feedback" data-mobile-support-cancel-feedback role="status"></p>
            <button class="mobile-app-danger-button" type="button" data-mobile-support-cancel-confirm>Confirmer l’annulation</button>
        </section>` : `<button class="mobile-app-secondary-button mobile-app-support-detail-action is-danger" type="button" data-mobile-support-cancel-toggle>Annuler le ticket</button>`) : '';

        return `${alert}<button class="mobile-app-secondary-button mobile-app-support-back" type="button" data-mobile-support-back>← Retour aux tickets</button>
            <article class="mobile-app-support-detail-header">
                <header><h2>${escapeHtml(ticket.display_title || ticket.subject || ticket.type_label || 'Ticket support')}</h2><span data-tone="${escapeHtml(ticket.status_tone || 'default')}">${escapeHtml(ticket.status_label || '')}</span></header>
                <p>${escapeHtml(meta)}</p>
                <time datetime="${escapeHtml(ticket.created_at_utc || '')}">Ouvert le ${escapeHtml(formatDate(ticket.created_at_utc, true))}</time>
            </article>
            ${history}${reply}${cancellation}`;
    }

    async function renderSupportDetail(message = '', messageTone = 'success', ticketOverride = null) {
        const ticketId = Number(state.supportSelectedTicketId) || 0;
        if (!ticketId) return renderSupport();
        const requestSequence = ++state.supportDetailRequestSequence;
        const ticket = ticketOverride || (await api(`/support/tickets/${ticketId}`)).data?.ticket;
        if (requestSequence !== state.supportDetailRequestSequence || state.route !== 'support' || Number(state.supportSelectedTicketId) !== ticketId) return;
        if (!ticket) {
            renderFrame('Support', emptyState('Ticket introuvable', 'Ce ticket n’est plus disponible.'), { tab: 'support' });
            return;
        }
        renderFrame('Support', supportDetailMarkup(ticket, message, messageTone), { tab: 'support' });
    }

    async function renderHome() {
        const requestSequence = ++state.homeRequestSequence;
        if (!state.activeDossierId) {
            renderFrame('Accueil', emptyState('Aucun dossier', 'Aucun dossier autorisé n’est disponible pour ce profil.'), { tab: 'home' });
            return;
        }
        const requestedIdentity = `${Number(state.bootstrap?.profile?.id) || 0}:${String(state.cameleonSessionId || '')}:${Number(state.activeDossierId) || 0}`;
        const response = await api(`/dossiers/${state.activeDossierId}/home`);
        const currentIdentity = `${Number(state.bootstrap?.profile?.id) || 0}:${String(state.cameleonSessionId || '')}:${Number(state.activeDossierId) || 0}`;
        if (requestSequence !== state.homeRequestSequence || requestedIdentity !== currentIdentity) return;
        const hideRestrictedAction = (action) => isSalariedOnlyUser()
            && (['task', 'tasks', 'contact', 'messages', 'hr'].includes(String(action?.key || ''))
                || /^(tasks|contacts|messages|hr)(\/|$)/.test(String(action?.destination || '')));
        state.homeQuickActionCatalog = (Array.isArray(response.data.quick_action_catalog)
            ? response.data.quick_action_catalog
            : (response.data.quick_actions || []))
            .filter((action) => !hideRestrictedAction(action));
        state.homeQuickActionKeys = (response.data.quick_actions || [])
            .filter((action) => !hideRestrictedAction(action))
            .map((action) => String(action.key));
        state.homeQuickActionInitialKeys = [...state.homeQuickActionKeys];
        state.homeQuickActionsEditable = Boolean(response.data.quick_actions_editable) && !state.readOnly;
        state.quickActionsEditing = false;
        state.quickActionsDialogOpen = false;
        state.quickActionsSaving = false;
        state.quickActionsError = '';
        renderQuickActionsHome();
    }

    function mobileNotesPath(suffix = '') {
        const path = `/notes${suffix}`;
        return state.activeDossierId ? `${path}?dossier_id=${Number(state.activeDossierId)}` : path;
    }

    function resetMobileNotesState({ preserveActiveTab = false } = {}) {
        const activeTab = state.notesActiveTab;
        Object.values(state.notesSaveTimers).forEach((timer) => window.clearTimeout(timer));
        state.notesPayload = null;
        state.notesDrafts = {};
        state.notesSaveTimers = {};
        state.notesSavingCount = 0;
        state.notesMessage = '';
        state.notesActiveTab = preserveActiveTab ? activeTab : 'personal';
        state.notesPasswordQuery = '';
        state.notesPasswordAddExpanded = false;
    }

    function mobileNotesTabs() {
        return state.notesPayload?.tabs && typeof state.notesPayload.tabs === 'object'
            ? state.notesPayload.tabs
            : {};
    }

    function mobileNotesAvailableTabs() {
        const tabs = mobileNotesTabs();
        return ['personal', 'dossier', 'ai_dossier', 'passwords', 'admin']
            .filter((key) => Boolean(tabs[key]?.available))
            .map((key) => [key, String(tabs[key]?.label || key)]);
    }

    function mobileNotesWritable(tab) {
        return Boolean(tab?.available) && tab?.writable !== false && !state.readOnly;
    }

    function mobileNotesMeta(tab) {
        const date = String(tab?.updated_at_label || '').trim();
        const author = String(tab?.updated_by_label || '').trim();
        if (!date) return 'Aucune modification.';
        return `Mis à jour le ${date}${author ? ` - ${author}` : ''}`;
    }

    function mobilePasswordMeta(tab) {
        const count = Array.isArray(tab?.rows) ? tab.rows.length : 0;
        const label = count === 1 ? '1 mot de passe' : `${count} mots de passe`;
        return mobileNotesWritable(tab) ? label : `${label} - Consultation uniquement.`;
    }

    function setMobileNotesStatus(message = '') {
        state.notesMessage = message;
        const status = app.querySelector('[data-mobile-notes-status]');
        if (!status) return;
        status.textContent = state.notesSavingCount > 0 ? 'Sauvegarde…' : (message || 'À jour');
        status.classList.toggle('is-error', /impossible|obligatoire|indisponible/i.test(message));
    }

    function mobileNotePane(key, tab) {
        const writable = mobileNotesWritable(tab);
        const body = Object.prototype.hasOwnProperty.call(state.notesDrafts, key)
            ? String(state.notesDrafts[key])
            : String(tab?.body || '');
        return `<div class="mobile-app-notes__pane">
            <div class="mobile-app-field mobile-app-notes__body">
                <label for="mobile-notes-body">${escapeHtml(tab?.label || 'Notes')}</label>
                <textarea id="mobile-notes-body" maxlength="20000" data-mobile-notes-body="${escapeHtml(key)}" ${writable ? '' : 'readonly aria-readonly="true"'}>${escapeHtml(body)}</textarea>
            </div>
            <p class="mobile-app-notes__meta">${escapeHtml(mobileNotesMeta(tab))}</p>
        </div>`;
    }

    function mobilePasswordField(name, value, label, { required = false, readonly = false, rowId = 0 } = {}) {
        const password = name === 'password';
        const identifier = `mobile-notes-${rowId || 'new'}-${name}`;
        return `<div class="mobile-app-field${password ? ' mobile-app-notes__password-field' : ''}">
            <label for="${identifier}">${escapeHtml(label)}</label>
            <span>${password ? `<input id="${identifier}" type="password" name="${name}" value="${escapeHtml(value)}" data-original-value="${escapeHtml(value)}" maxlength="2000" autocomplete="off" ${required ? 'required' : ''} ${readonly ? 'readonly aria-readonly="true"' : ''}><button type="button" data-mobile-notes-password-toggle aria-label="Afficher le mot de passe" title="Afficher le mot de passe">◉</button>` : `<input id="${identifier}" type="text" name="${name}" value="${escapeHtml(value)}" data-original-value="${escapeHtml(value)}" maxlength="255" autocomplete="off" ${required ? 'required' : ''} ${readonly ? 'readonly aria-readonly="true"' : ''}>`}</span>
        </div>`;
    }

    function mobilePasswordsPane(tab) {
        const writable = mobileNotesWritable(tab);
        const rows = Array.isArray(tab?.rows) ? tab.rows : [];
        const normalizedQuery = normalizeSearchValue(state.notesPasswordQuery);
        const visibleRows = rows.filter((row) => normalizeSearchValue(`${row.site || ''} ${row.username || ''}`).includes(normalizedQuery));
        const addForm = writable && state.notesPasswordAddExpanded ? `<form class="mobile-app-form-panel mobile-app-notes__password-card" data-mobile-notes-password-add autocomplete="off">
            <div class="mobile-app-notes__password-card-heading"><h2>Ajouter un mot de passe</h2><button type="button" data-mobile-notes-password-add-toggle aria-label="Fermer" title="Fermer">×</button></div>
            ${mobilePasswordField('site', '', 'Site', { required: true })}
            ${mobilePasswordField('username', '', 'Identifiant')}
            ${mobilePasswordField('password', '', 'Mot de passe', { required: true })}
            <button class="mobile-app-primary-button" type="submit" disabled>Ajouter</button>
        </form>` : '';
        const rowMarkup = rows.length ? rows.map((row) => {
            const matches = normalizeSearchValue(`${row.site || ''} ${row.username || ''}`).includes(normalizedQuery);
            return `<form class="mobile-app-form-panel mobile-app-notes__password-card" data-mobile-notes-password-row="${Number(row.id) || 0}" data-mobile-notes-password-search="${escapeHtml(`${row.site || ''} ${row.username || ''}`)}" autocomplete="off" ${matches ? '' : 'hidden'}>
            ${mobilePasswordField('site', row.site || '', 'Site', { required: true, readonly: !writable, rowId: Number(row.id) || 0 })}
            ${mobilePasswordField('username', row.username || '', 'Identifiant', { readonly: !writable, rowId: Number(row.id) || 0 })}
            ${mobilePasswordField('password', row.password || '', 'Mot de passe', { required: true, readonly: !writable, rowId: Number(row.id) || 0 })}
            ${writable ? '<button class="mobile-app-primary-button" type="submit" disabled>Enregistrer</button>' : ''}
        </form>`;
        }).join('') : '<p class="mobile-app-notes__empty">Aucune entrée.</p>';
        const filteredEmpty = rows.length
            ? `<p class="mobile-app-notes__empty" data-mobile-notes-password-empty ${visibleRows.length ? 'hidden' : ''}>Aucun mot de passe ne correspond à la recherche.</p>`
            : '';
        return `<div class="mobile-app-notes__passwords">${addForm}${rowMarkup}${filteredEmpty}<p class="mobile-app-notes__meta">${escapeHtml(mobilePasswordMeta(tab))}</p></div>`;
    }

    function filterMobileNotesPasswords(query) {
        const normalizedQuery = normalizeSearchValue(query);
        let visible = 0;
        app.querySelectorAll('[data-mobile-notes-password-row]').forEach((row) => {
            const matches = normalizeSearchValue(row.dataset.mobileNotesPasswordSearch).includes(normalizedQuery);
            row.hidden = !matches;
            if (matches) visible += 1;
        });
        const empty = app.querySelector('[data-mobile-notes-password-empty]');
        if (empty) empty.hidden = visible > 0;
    }

    function renderMobileNotesContent() {
        const availableTabs = mobileNotesAvailableTabs();
        if (!availableTabs.some(([key]) => key === state.notesActiveTab)) {
            state.notesActiveTab = availableTabs[0]?.[0] || 'personal';
        }
        const tabs = mobileNotesTabs();
        const active = tabs[state.notesActiveTab] || null;
        const options = availableTabs.map(([key, label]) => `<option value="${escapeHtml(key)}" ${key === state.notesActiveTab ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
        const passwordSearch = state.notesActiveTab === 'passwords' && active
            ? `<div class="mobile-app-notes__password-search"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.4 21.8-5.7-5.7a8 8 0 1 1 1.4-1.4l5.7 5.7-1.4 1.4ZM9.8 15.6a5.8 5.8 0 1 0 0-11.6 5.8 5.8 0 0 0 0 11.6Z"/></svg><input type="search" value="${escapeHtml(state.notesPasswordQuery)}" placeholder="Rechercher un mot de passe" aria-label="Rechercher un mot de passe" autocomplete="off" data-mobile-notes-password-query>${state.notesPasswordQuery ? '<button type="button" data-mobile-notes-password-search-clear aria-label="Effacer la recherche" title="Effacer la recherche">×</button>' : ''}</div>`
            : '';
        const passwordAddToggle = state.notesActiveTab === 'passwords' && active && mobileNotesWritable(active)
            ? `<button class="mobile-app-secondary-button mobile-app-notes__password-add-toggle" type="button" data-mobile-notes-password-add-toggle aria-expanded="${state.notesPasswordAddExpanded ? 'true' : 'false'}">${quickActionIcons.add}<span>${state.notesPasswordAddExpanded ? 'Masquer l’ajout' : 'Ajouter un mot de passe'}</span></button>`
            : '';
        const content = active
            ? (state.notesActiveTab === 'passwords' ? mobilePasswordsPane(active) : mobileNotePane(state.notesActiveTab, active))
            : '<p class="mobile-app-notes__empty">Aucune note disponible.</p>';
        renderFrame('Notes', `<div class="mobile-app-notes">
            <div class="mobile-app-field"><label for="mobile-notes-tab">Type de notes</label><select id="mobile-notes-tab" data-mobile-notes-tab ${availableTabs.length <= 1 ? 'disabled' : ''}>${options}</select></div>
            ${passwordSearch}
            ${passwordAddToggle}
            <p class="mobile-app-notes__status${/impossible|obligatoire|indisponible/i.test(state.notesMessage) ? ' is-error' : ''}" data-mobile-notes-status>${escapeHtml(state.notesSavingCount > 0 ? 'Sauvegarde…' : (state.notesMessage || 'À jour'))}</p>
            ${content}
        </div>`, { tab: 'notes', contentClass: 'mobile-app-notes-content' });
    }

    async function renderNotes() {
        const response = await api(mobileNotesPath());
        state.notesPayload = response.data || {};
        state.notesDrafts = {};
        state.notesMessage = '';
        renderMobileNotesContent();
    }

    function syncMobileNotesPasswordForm(form) {
        if (!(form instanceof HTMLFormElement)) return;
        const site = form.querySelector('input[name="site"]');
        const password = form.querySelector('input[name="password"]');
        const button = form.querySelector('button[type="submit"]');
        if (!(site instanceof HTMLInputElement) || !(password instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) return;
        const valid = site.value.trim() !== '' && password.value !== '';
        const dirty = form.matches('[data-mobile-notes-password-add]')
            || Array.from(form.querySelectorAll('input[name]')).some((input) => input.value !== String(input.dataset.originalValue || ''));
        button.disabled = state.readOnly || state.notesSavingCount > 0 || !valid || !dirty;
    }

    async function saveMobileNote(scope) {
        if (state.notesSaveTimers[scope]) {
            window.clearTimeout(state.notesSaveTimers[scope]);
            delete state.notesSaveTimers[scope];
        }
        const tab = mobileNotesTabs()[scope];
        if (!mobileNotesWritable(tab) || !Object.prototype.hasOwnProperty.call(state.notesDrafts, scope)) return;
        const submittedBody = String(state.notesDrafts[scope]);
        if (submittedBody === String(tab?.body || '')) return;
        state.notesSavingCount += 1;
        setMobileNotesStatus();
        try {
            const response = await api(mobileNotesPath(`/${encodeURIComponent(scope)}`), {
                method: 'PATCH',
                body: { body: submittedBody },
            });
            if (response.data?.tab) mobileNotesTabs()[scope] = response.data.tab;
            if (String(state.notesDrafts[scope]) === submittedBody) delete state.notesDrafts[scope];
            setMobileNotesStatus('À jour');
        } catch (error) {
            setMobileNotesStatus(error?.message || 'Sauvegarde impossible.');
        } finally {
            state.notesSavingCount = Math.max(0, state.notesSavingCount - 1);
            setMobileNotesStatus(state.notesMessage);
        }
    }

    async function flushMobileNotes() {
        const pendingScopes = Object.keys(state.notesDrafts);
        await Promise.all(pendingScopes.map((scope) => saveMobileNote(scope)));
    }

    function quickActionContent(action) {
        return `<span class="mobile-app-action__icon">${quickActionIcons[action.key] || quickActionIcons.task}</span><span class="mobile-app-action__copy"><span class="mobile-app-action__label">${escapeHtml(action.label)}</span>${action.subtitle ? `<span class="mobile-app-action__subtitle">${escapeHtml(action.subtitle)}</span>` : ''}</span>`;
    }

    function quickActionMarkup(action) {
        if (state.quickActionsEditing) {
            return `<div class="mobile-app-action is-editing" data-quick-action-key="${escapeHtml(action.key)}" role="group" aria-label="${escapeHtml(action.label)}">${quickActionContent(action)}<button class="mobile-app-action__remove" type="button" data-quick-action-remove="${escapeHtml(action.key)}" aria-label="Supprimer ${escapeHtml(action.label)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`;
        }

        const destination = action.key === 'camera' || action.key === 'file'
            ? `data-upload-file data-upload-mode="${escapeHtml(action.key)}"`
            : `data-mobile-route="${escapeHtml(normalizeDestination(action.destination))}"`;

        return `<button class="mobile-app-action" type="button" ${destination}>${quickActionContent(action)}</button>`;
    }

    function quickActionDialogMarkup() {
        if (!state.quickActionsDialogOpen) return '';

        const remaining = state.homeQuickActionCatalog.filter((action) => !state.homeQuickActionKeys.includes(String(action.key)));
        const body = remaining.length
            ? remaining.map((action) => `<button class="mobile-app-quick-actions-dialog__item" type="button" data-quick-action-add="${escapeHtml(action.key)}">${quickActionContent(action)}</button>`).join('')
            : '<p class="mobile-app-quick-actions-dialog__empty">Toutes les actions disponibles sont déjà affichées.</p>';

        return `<div class="mobile-app-dialog-backdrop" data-quick-actions-dialog role="presentation"><section class="mobile-app-quick-actions-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-quick-actions-dialog-title"><header><h3 id="mobile-quick-actions-dialog-title">Ajouter une action</h3><button type="button" data-quick-actions-dialog-close aria-label="Fermer">×</button></header><div class="mobile-app-quick-actions-dialog__body">${body}</div></section></div>`;
    }

    function renderQuickActionsHome() {
        const catalog = new Map(state.homeQuickActionCatalog.map((action) => [String(action.key), action]));
        const actions = state.homeQuickActionKeys.map((key) => catalog.get(key)).filter(Boolean);
        const editButton = state.homeQuickActionsEditable
            ? `<button class="mobile-app-quick-actions-edit" type="button" data-quick-actions-edit ${state.quickActionsSaving ? 'disabled' : ''}>${state.quickActionsSaving ? 'Enregistrement…' : (state.quickActionsEditing ? 'Terminer' : 'Modifier')}</button>`
            : '';
        const empty = actions.length === 0
            ? '<div class="mobile-app-quick-actions-empty">Aucune action rapide n’est affichée.</div>'
            : '';
        const content = `<div class="mobile-app-section-title"><h2>Actions rapides</h2>${editButton}</div>
            ${state.quickActionsEditing ? '<p class="mobile-app-quick-actions-hint">Maintenez une action appuyée puis faites-la glisser pour la déplacer.</p>' : ''}
            <div class="mobile-app-action-row ${state.quickActionsEditing ? 'is-editing' : ''}">${actions.map(quickActionMarkup).join('')}</div>
            ${empty}
            ${state.quickActionsEditing ? `${state.quickActionsError ? `<p class="mobile-app-quick-actions-error" role="alert">${escapeHtml(state.quickActionsError)}</p>` : ''}<button class="mobile-app-quick-actions-add" type="button" data-quick-actions-add>+ Ajouter une action</button>` : ''}
            ${quickActionDialogMarkup()}`;
        renderFrame('Accueil', content, { tab: 'home', subtitle: state.bootstrap.profile?.display_name });

        window.requestAnimationFrame(() => {
            const actionGroup = app.querySelector('.mobile-app-action-row');
            const actionElements = actionGroup ? Array.from(actionGroup.querySelectorAll('.mobile-app-action')) : [];
            if (!actionGroup || actionElements.length === 0) return;

            const naturalWidths = actionElements.map((action) => {
                const probe = action.cloneNode(true);
                probe.style.position = 'fixed';
                probe.style.visibility = 'hidden';
                probe.style.width = 'max-content';
                probe.style.maxWidth = 'none';
                probe.style.inset = '0 auto auto 0';
                document.body.appendChild(probe);
                const width = Math.ceil(probe.getBoundingClientRect().width);
                probe.remove();
                return width;
            });
            const naturalWidth = Math.max(...naturalWidths);
            const updateActionWidths = () => {
                const availableWidth = actionGroup.clientWidth;
                const horizontalGap = Number.parseFloat(window.getComputedStyle(actionGroup).columnGap) || 0;
                const maximumColumnCount = Math.max(1, Math.min(
                    actionElements.length,
                    Math.floor((availableWidth + horizontalGap) / (naturalWidth + horizontalGap)),
                ));
                let columnCount = maximumColumnCount;
                while (columnCount > 1 && actionElements.length % columnCount !== 0) columnCount -= 1;

                actionGroup.classList.toggle('is-too-narrow-for-one-line', naturalWidth > availableWidth);
                const commonWidth = Math.floor(
                    (availableWidth - (horizontalGap * (columnCount - 1))) / columnCount,
                );
                actionElements.forEach((action) => { action.style.width = `${commonWidth}px`; });
            };

            updateActionWidths();
            if ('ResizeObserver' in window) {
                const resizeObserver = new ResizeObserver(updateActionWidths);
                resizeObserver.observe(actionGroup);
            }
        });
    }

    function normalizeDestination(destination) {
        const value = String(destination || 'home');
        if (value.startsWith('assistant-vocal') || value.startsWith('assistant_voice')) return 'assistant';
        if (value.startsWith('tasks/create')) return 'task_create';
        if (value.startsWith('absences/create')) return 'absence_create';
        if (value.startsWith('expenses/create')) return 'expense_create';
        if (value.startsWith('mileage/create')) return 'mileage_create';
        if (value.startsWith('mileage/submit')) return 'mileage_submit';
        if (value.startsWith('reports/create')) return 'report_create';
        if (value.startsWith('payslips/latest/download')) return 'payslip_latest';
        if (value === 'contacts') return 'contacts';
        return value.replaceAll('-', '_');
    }

    function equalizeResponsiveFlowItems(group, itemSelector, minimumColumnCount = 1) {
        const items = group ? Array.from(group.querySelectorAll(itemSelector)) : [];
        if (!group || items.length === 0) return;

        const naturalWidths = items.map((item) => {
            const probe = item.cloneNode(true);
            probe.style.position = 'fixed';
            probe.style.visibility = 'hidden';
            probe.style.width = 'max-content';
            probe.style.maxWidth = 'none';
            probe.style.inset = '0 auto auto 0';
            group.appendChild(probe);
            const width = Math.ceil(probe.getBoundingClientRect().width);
            probe.remove();
            return width;
        });
        const naturalWidth = Math.max(...naturalWidths);
        const updateWidths = () => {
            const availableWidth = group.clientWidth;
            const horizontalGap = Number.parseFloat(window.getComputedStyle(group).columnGap) || 0;
            const requiredColumnCount = Math.max(1, Math.floor(Number(minimumColumnCount) || 1));
            const naturalColumnCount = Math.max(1, Math.min(
                items.length,
                Math.floor((availableWidth + horizontalGap) / (naturalWidth + horizontalGap)),
            ));
            let columnCount = Math.max(requiredColumnCount, naturalColumnCount);
            while (columnCount > requiredColumnCount && items.length % columnCount !== 0) columnCount -= 1;

            const commonWidth = Math.floor(
                (availableWidth - (horizontalGap * (columnCount - 1))) / columnCount,
            );
            items.forEach((item) => { item.style.width = `${commonWidth}px`; });
        };

        updateWidths();
        if ('ResizeObserver' in window) {
            const resizeObserver = new ResizeObserver(() => {
                if (!group.isConnected) {
                    resizeObserver.disconnect();
                    return;
                }
                updateWidths();
            });
            resizeObserver.observe(group);
        }
    }

    function enhanceDocumentFolderFlow(root = app) {
        const group = root.querySelector('.mobile-app-document-folder-grid');
        equalizeResponsiveFlowItems(group, '.mobile-app-document-folder-card', 2);
    }

    function documentSelectionKey(type, id) {
        return `${type}:${Math.max(0, Number(id) || 0)}`;
    }

    function documentSelectionCheckbox(type, id, canDelete = true) {
        const key = documentSelectionKey(type, id);
        const checked = state.selectedDocumentItems.has(key);
        return `<button class="mobile-app-document-selection-checkbox" type="button" data-mobile-document-selection-toggle="${escapeHtml(key)}" role="checkbox" aria-checked="${checked ? 'true' : 'false'}" aria-label="${checked ? 'Retirer de la sélection' : 'Ajouter à la sélection'}" ${canDelete ? '' : 'disabled'}><span aria-hidden="true">${checked ? '✓' : ''}</span></button>`;
    }

    function documentSortButtonMarkup() {
        const mode = documentSortModes.find(([value]) => value === state.documentSortMode) || documentSortModes[2];
        const [, label, kind, direction] = mode;
        const icon = kind === 'date'
            ? `<svg class="mobile-app-document-sort__main" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h1a3 3 0 0 1 3 3v13H3V7a3 3 0 0 1 3-3h1V2Zm12 8H5v8h14v-8ZM6 6a1 1 0 0 0-1 1v1h14V7a1 1 0 0 0-1-1H6Z"/></svg>`
            : `<span class="mobile-app-document-sort__main mobile-app-document-sort__letters" aria-hidden="true">AZ</span>`;
        return `<button class="mobile-app-document-sort" type="button" data-mobile-document-sort aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${icon}<span class="mobile-app-document-sort__direction" aria-hidden="true">${direction}</span></button>`;
    }

    function documentSelectionToolbarMarkup() {
        const count = state.selectedDocumentItems.size;
        const label = count === 1 ? '1 élément sélectionné' : `${count} éléments sélectionnés`;
        return `<div class="mobile-app-document-selection-toolbar" data-mobile-document-selection-toolbar ${state.documentSelectionMode ? '' : 'hidden'}><button type="button" data-mobile-document-selection-close aria-label="Quitter le mode suppression">×</button><strong data-mobile-document-selection-count>${escapeHtml(label)}</strong><button type="button" class="mobile-app-document-selection-delete" data-mobile-document-selection-delete aria-label="Supprimer la sélection" title="Supprimer la sélection" ${count > 0 && !state.documentDeletionBusy ? '' : 'disabled'}>${quickActionIcons.delete}</button></div>`;
    }

    function documentListMarkup(items, childFolders = [], showFolderPath = false, hasSearch = false, personalDocuments = false) {
        const folderItems = (Array.isArray(childFolders) ? childFolders : []).map((folder) => {
            const name = folder.name || folder.path || 'Dossier';
            const id = Number(folder.id) || 0;
            const key = documentSelectionKey('folder', id);
            return `<article class="mobile-app-document-folder-card ${state.selectedDocumentItems.has(key) ? 'is-selected' : ''}" data-mobile-document-selectable="${escapeHtml(key)}" data-mobile-document-can-delete="${folder.can_delete ? '1' : '0'}">${documentSelectionCheckbox('folder', id, folder.can_delete === true)}<button class="mobile-app-document-folder-card__open" type="button" data-mobile-document-child-folder="${id}" aria-label="Ouvrir le dossier ${escapeHtml(name)}"><span class="mobile-app-document-folder-card__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 5h7l2 2h9v12H3V5Zm2 4v8h14V9H5Z"/></svg></span><strong title="${escapeHtml(name)}">${escapeHtml(name)}</strong></button></article>`;
        }).join('');
        const folderMarkup = folderItems ? `<div class="mobile-app-document-folder-grid">${folderItems}</div>` : '';
        const documentMarkup = (Array.isArray(items) ? items : []).map((document) => {
                const location = [
                    showFolderPath ? (document.folder?.path || document.folder?.name || 'Racine') : '',
                    formatDate(document.created_at_utc),
                ].filter(Boolean).join(' - ');
                const filename = String(document.filename || document.title || 'document');
                const mimeType = String(document.mime_type || 'application/octet-stream');
                const companyName = personalDocuments
                    ? 'Documents personnels'
                    : String(document.dossier?.name || activeDossier()?.name || '');
                const id = Number(document.id) || 0;
                const key = documentSelectionKey('document', id);
                const canDelete = document.can_delete === true;
                return `<article class="mobile-app-list-item mobile-app-document-item ${state.selectedDocumentItems.has(key) ? 'is-selected' : ''}" data-mobile-document-selectable="${escapeHtml(key)}" data-mobile-document-can-delete="${canDelete ? '1' : '0'}">
                    ${documentSelectionCheckbox('document', id, canDelete)}
                    <button class="mobile-app-list-button mobile-app-document-open" type="button" data-open-binary="${escapeHtml(document.content_url)}" aria-label="Ouvrir ${escapeHtml(document.title || filename)}">
                        <h3 title="${escapeHtml(document.title || filename)}">${escapeHtml(document.title || filename)}</h3><p>${escapeHtml(location)}</p>
                    </button>
                    <span class="mobile-app-document-actions">
                        <button type="button" data-download-binary="${escapeHtml(document.content_url)}" data-download-filename="${escapeHtml(filename)}" data-download-preview="off" aria-label="Télécharger ${escapeHtml(document.title || filename)}" title="Télécharger">${documentDownloadIcon}</button>
                        <button type="button" data-share-binary="${escapeHtml(document.content_url)}" data-share-filename="${escapeHtml(filename)}" data-share-mime="${escapeHtml(mimeType)}" data-share-company="${escapeHtml(companyName)}" aria-label="Partager ${escapeHtml(document.title || filename)}" title="Partager">${quickActionIcons.share}</button>
                    </span>
                    <span class="mobile-app-badge">${escapeHtml((document.extension || 'fichier').toUpperCase())}</span>
                </article>`;
            }).join('');
        return folderMarkup || documentMarkup
            ? `${folderMarkup}${documentMarkup ? `<div class="mobile-app-list">${documentMarkup}</div>` : ''}`
            : emptyState('Aucun document', hasSearch
                ? 'Aucun document autorisé ne correspond à la recherche.'
                : personalDocuments
                    ? 'Aucun document personnel n’est disponible.'
                    : showFolderPath
                    ? 'Aucun document n’est disponible dans l’entreprise.'
                    : 'Ce dossier de documents est vide.');
    }

    function documentSearchScopeMarkup(scope) {
        const labels = {
            current: 'Mode dossier - appuyer pour afficher tous les documents',
            all: 'Mode global - appuyer pour afficher les documents personnels',
            personal: 'Mode personnel - appuyer pour revenir au dossier courant',
        };
        const label = labels[scope] || labels.current;
        return `<button class="mobile-app-document-mode" type="button" data-mobile-document-scope-toggle aria-label="${label}" title="${label}">${documentScopeIcons[scope] || documentScopeIcons.current}</button>`;
    }

    function rememberCurrentDocumentFolder() {
        const form = app.querySelector('[data-mobile-search="documents"]');
        const folderId = Math.max(0, Number(form?.dataset.documentFolderId) || 0);
        state.routeHistory.push({
            route: 'documents',
            params: {
                ...(folderId > 0 ? { folder: String(folderId) } : {}),
                ...(form?.dataset.documentSearchScope === 'personal' ? { scope: 'personal' } : {}),
            },
        });
        state.routeHistory = state.routeHistory.slice(-50);
    }

    async function loadDocumentSearch(query, scope, requestSequence) {
        const results = app.querySelector('[data-mobile-documents-results]');
        if (!results || state.route !== 'documents') return;

        results.setAttribute('aria-busy', 'true');
        try {
            const form = app.querySelector('[data-mobile-search="documents"]');
            const folderId = Math.max(0, Number(form?.dataset.documentFolderId) || 0);
            const allFolders = scope === 'all';
            const personalDocuments = scope === 'personal';
            const parameters = new URLSearchParams({ folder_id: String(folderId) });
            parameters.set('sort', state.documentSortMode);
            if (query) parameters.set('q', query);
            if (allFolders) parameters.set('search_scope', 'all');
            const endpoint = personalDocuments
                ? '/personal-documents'
                : `/dossiers/${state.activeDossierId}/documents`;
            const response = await api(`${endpoint}?${parameters.toString()}`);
            if (requestSequence !== state.documentSearchRequestSequence || state.route !== 'documents') return;
            const childFolders = Array.isArray(response.meta?.child_document_folders) ? response.meta.child_document_folders : [];
            results.innerHTML = documentListMarkup(response.data || [], childFolders, allFolders || personalDocuments, query.length > 0, personalDocuments);
            results.classList.toggle('is-selection-mode', state.documentSelectionMode);
            window.requestAnimationFrame(() => enhanceDocumentFolderFlow(results));
            syncDocumentFolderSelectorScope(scope, folderId);
        } catch (error) {
            if (requestSequence !== state.documentSearchRequestSequence || state.route !== 'documents') return;
            results.innerHTML = emptyState('Recherche indisponible', error?.message || 'La recherche des documents a échoué.');
        } finally {
            if (requestSequence === state.documentSearchRequestSequence) {
                state.documentSearchTimer = null;
                results.removeAttribute('aria-busy');
            }
        }
    }

    async function renderDocuments(params = {}) {
        const search = String(params.q || '').slice(0, 120);
        const scope = ['all', 'personal'].includes(params.scope) ? params.scope : 'current';
        const requestedFolderId = Math.max(0, Number(params.folder) || 0);
        const allFolders = scope === 'all';
        const personalDocuments = scope === 'personal';
        const parameters = new URLSearchParams({ folder_id: String(requestedFolderId) });
        parameters.set('sort', state.documentSortMode);
        if (search) parameters.set('q', search);
        if (allFolders) parameters.set('search_scope', 'all');
        const endpoint = personalDocuments
            ? '/personal-documents'
            : `/dossiers/${state.activeDossierId}/documents`;
        const response = await api(`${endpoint}?${parameters.toString()}`);
        const items = response.data || [];
        const folders = Array.isArray(response.meta?.document_folders) ? response.meta.document_folders : [];
        const childFolders = Array.isArray(response.meta?.child_document_folders) ? response.meta.child_document_folders : [];
        const currentFolder = response.meta?.current_document_folder || folders.find((folder) => Number(folder.id) === requestedFolderId) || { id: 0, name: 'Racine', path: 'Racine' };
        const folderId = Math.max(0, Number(currentFolder.id) || 0);
        state.documentFolders = folders;
        state.routeParams = {
            ...(folderId > 0 ? { folder: String(folderId) } : {}),
            ...(search ? { q: search } : {}),
            ...(scope !== 'current' ? { scope } : {}),
        };
        persistNavigation();
        const list = documentListMarkup(items, childFolders, allFolders || personalDocuments, search.length > 0, personalDocuments);
        const uploadDisabled = state.readOnly;
        const folderSelector = `<div class="mobile-app-document-folder-context">${documentFolderSelectorMarkup(folders, folderId, allFolders, personalDocuments)}</div>`;
        const personalUploadAttributes = personalDocuments ? `data-upload-context-type="personal_documents" data-upload-folder-id="${folderId}" data-upload-destination="${escapeHtml(currentFolder.path || 'Documents personnels')}"` : '';
        const actions = `<button class="mobile-app-documents-action" type="button" data-upload-file ${personalUploadAttributes} aria-label="Envoyer un fichier" title="Envoyer un fichier" ${uploadDisabled ? 'disabled' : ''}>${quickActionIcons.file}</button><button class="mobile-app-documents-action" type="button" data-upload-file data-upload-mode="camera" ${personalUploadAttributes} aria-label="Prendre une photo" title="Prendre une photo" ${uploadDisabled ? 'disabled' : ''}>${quickActionIcons.camera}</button>`;
        const searchLabel = personalDocuments
            ? 'Recherche perso'
            : (allFolders ? 'Recherche globale' : 'Recherche locale');
        renderFrame('Documents', `<div class="mobile-app-documents-toolbar">${folderSelector}${actions}</div><form data-mobile-search="documents" data-document-search-scope="${scope}" data-document-folder-id="${folderId}"><div class="mobile-app-document-search-row"><div class="mobile-app-document-search"><span class="mobile-app-document-search__icon">${documentSearchIcon}</span><input class="mobile-app-search" name="q" value="${escapeHtml(search)}" maxlength="120" placeholder="${searchLabel}" aria-label="${searchLabel}" autocomplete="off"></div>${documentSortButtonMarkup()}${documentSearchScopeMarkup(scope)}</div></form><div data-mobile-documents-results class="${state.documentSelectionMode ? 'is-selection-mode' : ''}" aria-live="polite">${list}</div>${documentSelectionToolbarMarkup()}`, {
            tab: 'documents',
        });
        window.requestAnimationFrame(() => enhanceDocumentFolderFlow());
    }

    function syncDocumentSelectionUi() {
        const results = app.querySelector('[data-mobile-documents-results]');
        results?.classList.toggle('is-selection-mode', state.documentSelectionMode);
        app.querySelectorAll('[data-mobile-document-selectable]').forEach((item) => {
            const key = String(item.dataset.mobileDocumentSelectable || '');
            const checked = state.selectedDocumentItems.has(key);
            item.classList.toggle('is-selected', checked);
            const checkbox = item.querySelector('[data-mobile-document-selection-toggle]');
            checkbox?.setAttribute('aria-checked', checked ? 'true' : 'false');
            const indicator = checkbox?.querySelector('span');
            if (indicator) indicator.textContent = checked ? '✓' : '';
        });
        const toolbar = app.querySelector('[data-mobile-document-selection-toolbar]');
        if (toolbar) toolbar.hidden = !state.documentSelectionMode;
        const count = state.selectedDocumentItems.size;
        const countLabel = app.querySelector('[data-mobile-document-selection-count]');
        if (countLabel) countLabel.textContent = count === 1 ? '1 élément sélectionné' : `${count} éléments sélectionnés`;
        const deleteButton = app.querySelector('[data-mobile-document-selection-delete]');
        if (deleteButton) deleteButton.disabled = count === 0 || state.documentDeletionBusy;
    }

    function closeDocumentSelectionMode() {
        state.documentSelectionMode = false;
        state.selectedDocumentItems.clear();
        syncDocumentSelectionUi();
    }

    function enterDocumentSelectionMode(item) {
        if (!canDeleteCurrentDocuments() || !(item instanceof HTMLElement) || item.dataset.mobileDocumentCanDelete !== '1') return;
        state.documentSelectionMode = true;
        const key = String(item.dataset.mobileDocumentSelectable || '');
        if (key) state.selectedDocumentItems.add(key);
        syncDocumentSelectionUi();
    }

    function showDocumentDeletionDialog() {
        if (!state.documentSelectionMode || state.selectedDocumentItems.size === 0) return;
        app.querySelector('[data-mobile-document-deletion-dialog]')?.remove();
        const count = state.selectedDocumentItems.size;
        const message = count === 1
            ? 'Cet élément sera placé dans la corbeille Documents.'
            : `Ces ${count} éléments seront placés dans la corbeille Documents.`;
        app.insertAdjacentHTML('beforeend', `<div class="mobile-app-dialog-backdrop" data-mobile-document-deletion-dialog role="presentation"><section class="mobile-app-quick-actions-dialog mobile-app-document-deletion-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-document-deletion-title"><header><h3 id="mobile-document-deletion-title">Supprimer la sélection</h3><button type="button" data-mobile-document-deletion-close aria-label="Fermer">×</button></header><div class="mobile-app-quick-actions-dialog__body"><p>${escapeHtml(message)}</p><p class="mobile-app-quick-actions-error" data-mobile-document-deletion-error role="alert"></p><button class="mobile-app-danger-button" type="button" data-mobile-document-deletion-confirm>${quickActionIcons.delete}<span>Supprimer</span></button></div></section></div>`);
        app.querySelector('[data-mobile-document-deletion-confirm]')?.focus({ preventScroll: true });
    }

    async function deleteSelectedDocuments() {
        if (state.documentDeletionBusy || state.selectedDocumentItems.size === 0) return;
        const button = app.querySelector('[data-mobile-document-deletion-confirm]');
        const errorNode = app.querySelector('[data-mobile-document-deletion-error]');
        const items = [...state.selectedDocumentItems].map((key) => {
            const [type, rawId] = key.split(':');
            return { type, id: Math.max(0, Number(rawId) || 0) };
        }).filter((item) => ['folder', 'document'].includes(item.type) && item.id > 0);
        if (!items.length) return;
        state.documentDeletionBusy = true;
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span>Suppression…</span>';
        }
        try {
            await api(state.routeParams?.scope === 'personal' ? '/personal-documents/trash' : `/dossiers/${state.activeDossierId}/documents/trash`, { method: 'POST', body: { items } });
            app.querySelector('[data-mobile-document-deletion-dialog]')?.remove();
            closeDocumentSelectionMode();
            await renderDocuments(state.routeParams || {});
        } catch (error) {
            if (errorNode) errorNode.textContent = error?.message || 'La suppression n’a pas pu être effectuée.';
        } finally {
            state.documentDeletionBusy = false;
            if (button?.isConnected) {
                button.disabled = false;
                button.innerHTML = `${quickActionIcons.delete}<span>Supprimer</span>`;
            }
            syncDocumentSelectionUi();
        }
    }

    function showDocumentUploadDestinationDialog(uploadButton) {
        app.querySelector('[data-mobile-document-upload-destination-dialog]')?.remove();
        const searchForm = app.querySelector('[data-mobile-search="documents"]');
        const allFolders = searchForm?.dataset.documentSearchScope === 'all';
        const currentFolderId = allFolders
            ? 0
            : Math.max(0, Number(searchForm?.dataset.documentFolderId) || 0);
        const selectorLabel = app.querySelector('[data-mobile-document-folder-menu-toggle]')
            ?.dataset.currentDocumentFolderLabel;
        const currentFolderLabel = allFolders
            ? 'Racine'
            : String(selectorLabel || 'Racine');
        const currentFolderTitle = currentFolderId === 0 || currentFolderLabel.trim().toLocaleLowerCase('fr') === 'racine'
            ? 'À la racine'
            : `Dans ${currentFolderLabel}`;
        const referent = String(state.bootstrap?.primary_accounting_referent_name || '').trim()
            || 'votre comptable référent principal';
        const cameraMode = uploadButton?.dataset.uploadMode === 'camera';
        const actionLabel = cameraMode ? 'la photo' : 'le fichier';
        const folderOptions = (Array.isArray(state.documentFolders) && state.documentFolders.length
            ? state.documentFolders
            : [{ id: 0, name: 'Racine', path: 'Racine' }])
            .map((folder) => `<option value="${Math.max(0, Number(folder.id) || 0)}">${escapeHtml(folder.path || folder.name || 'Racine')}</option>`)
            .join('');

        app.insertAdjacentHTML('beforeend', `<div class="mobile-app-dialog-backdrop" data-mobile-document-upload-destination-dialog role="presentation"><section class="mobile-app-quick-actions-dialog mobile-app-document-upload-destination" role="dialog" aria-modal="true" aria-labelledby="mobile-document-upload-destination-title" data-upload-mode="${cameraMode ? 'camera' : 'file'}" data-folder-id="${currentFolderId}" data-folder-label="${escapeHtml(currentFolderLabel)}"><header><h3 id="mobile-document-upload-destination-title">Choisir la destination</h3><button type="button" data-mobile-document-upload-destination-close aria-label="Fermer">×</button></header><div class="mobile-app-quick-actions-dialog__body"><p>Où souhaitez-vous envoyer ${actionLabel} ?</p><button class="mobile-app-document-upload-destination__choice" type="button" data-mobile-document-upload-destination="processing"><strong>À ${escapeHtml(referent)}</strong><span>Pour analyse et traitement</span></button><button class="mobile-app-document-upload-destination__choice" type="button" data-mobile-document-upload-destination="folder"><strong>${escapeHtml(currentFolderTitle)}</strong><span>Conserver dans le dossier courant</span></button><div class="mobile-app-document-upload-destination__choice is-selector"><strong>Dans un autre dossier</strong><span>Choisir l’emplacement de destination</span><select aria-label="Choisir un autre dossier" data-mobile-document-upload-folder><option value="" selected disabled>Choisir un dossier</option>${folderOptions}</select></div></div></section></div>`);
        enhanceMobileSelects(app.querySelector('[data-mobile-document-upload-destination-dialog]'));
        window.setTimeout(() => app.querySelector('[data-mobile-document-upload-destination]')?.focus(), 0);
    }

    function openDocumentUploadApplication(dialog, destinationMode) {
        const cameraMode = dialog?.dataset.uploadMode === 'camera';
        const otherFolder = destinationMode === 'other_folder'
            ? dialog?.querySelector('[data-mobile-document-upload-folder]')
            : null;
        const folderId = Math.max(0, Number(otherFolder?.value ?? dialog?.dataset.folderId) || 0);
        const folderLabel = String(otherFolder?.selectedOptions?.[0]?.textContent || dialog?.dataset.folderLabel || 'Racine');
        const forProcessing = destinationMode === 'processing';
        const referent = String(state.bootstrap?.primary_accounting_referent_name || '').trim()
            || 'votre comptable référent principal';
        const fileDestination = forProcessing
            ? `${referent} pour analyse et traitement`
            : folderLabel;
        dialog?.closest('[data-mobile-document-upload-destination-dialog]')?.remove();
        openExternalApplication({
            kind: cameraMode ? 'camera' : 'files',
            action: cameraMode ? 'Prendre une photo' : 'Choisir un fichier',
            fileDestination,
            uploadContext: {
                uploadToGed: true,
                contextType: forProcessing ? 'documents' : 'documents_folder',
                ...(forProcessing || folderId < 1 ? {} : { folderId }),
                returnRoute: 'documents',
            },
            details: [{
                label: 'Destination',
                value: forProcessing
                    ? `Transmettre à ${referent}`
                    : `Enregistrer dans ${folderLabel}`,
            }],
        });
    }

    function employeeMobileAccessTitle(count = state.employeeMobileAccessCount) {
        return Number(count) === 1 ? 'Accès application salarié' : 'Accès application salariés';
    }

    function managerHrEntries() {
        return [
            ['hr_pending', 'À valider', state.hrPendingValidationCount > 0 && (can('absences.approve') || can('expenses.approve'))],
            ['payslips', 'Bulletins', can('payslips.view_own')],
            ['employee_documents', 'Autres documents', can('employee_documents.view_own')],
            ['absences', 'Absences', can('absences.list_own') || can('absences.manage_own') || can('absences.approve')],
            ['expenses', 'Notes de frais', can('expenses.manage_own') || can('expenses.create') || can('expenses.approve')],
            ['mileage', 'Kilomètres', can('mileage.create')],
            ['sales_revenue', 'CA VRP', can('sales_revenue.create') || can('sales_revenue.manage_own')],
            ['employee_mobile_access', employeeMobileAccessTitle(), can('employee_mobile_access.manage')],
        ].filter(([, , available]) => available);
    }

    function managerHrPageSelectorMarkup(activeRoute) {
        const entries = managerHrEntries();
        return `<div class="mobile-app-form-panel mobile-app-hr-page-selector"><div class="mobile-app-field"><label for="mobile-hr-page">Page</label><select id="mobile-hr-page" data-mobile-hr-page-selector>${entries.map(([route, label]) => `<option value="${route}" ${route === activeRoute ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></div></div>`;
    }

    async function renderHr(params = {}) {
        const entries = managerHrEntries();
        if (entries.length) {
            const requestedSection = String(params.section || '').trim();
            const destination = entries.some(([route]) => route === requestedSection)
                ? requestedSection
                : entries[0][0];
            state.route = destination;
            state.routeParams = { ...params };
            persistNavigation();
            await navigate(destination, params, false);
            return;
        }
        renderFrame('GRH', emptyState('Aucun accès GRH', 'Ce dossier ne donne accès à aucune fonction GRH mobile.'), { tab: 'hr' });
    }

    async function loadHrPendingValidations() {
        if (!(can('absences.approve') || can('expenses.approve'))) {
            state.hrPendingValidationCount = 0;
            state.hrPendingValidations = null;
            return null;
        }
        const response = await api(`/dossiers/${state.activeDossierId}/hr/pending-validations`);
        state.hrPendingValidations = response.data || {};
        state.hrPendingValidationCount = Math.max(0, Number(response.data?.total_count) || 0);
        return state.hrPendingValidations;
    }

    async function renderHrPendingValidations() {
        const pending = state.hrPendingValidations || await loadHrPendingValidations() || {};
        const absences = Array.isArray(pending.absences) ? pending.absences : [];
        const expenseReports = Array.isArray(pending.expense_reports) ? pending.expense_reports : [];
        const mileage = expenseReports.filter((report) => report.expense_kind === 'mileage');
        const expenses = expenseReports.filter((report) => report.expense_kind !== 'mileage');
        state.hrPendingValidationCount = absences.length + expenseReports.length;
        if (state.hrPendingValidationCount < 1) {
            await renderHr();
            return;
        }
        const group = (title, items, markup) => items.length
            ? `<section class="mobile-app-validation-group"><div class="mobile-app-validation-section-title"><h2>${escapeHtml(title)}</h2><span>${items.length} ${items.length === 1 ? 'demande' : 'demandes'}</span></div><div class="mobile-app-list mobile-app-validation-list">${items.map(markup).join('')}</div></section>`
            : '';
        state.routeParams = {};
        persistNavigation();
        renderFrame('À valider', [
            group('Absences', absences, (item) => mobileAbsenceItemMarkup(item, true)),
            group('Notes de frais', expenses, (item) => mobileExpenseItemMarkup(item, true)),
            group('Indemnités kilométriques', mileage, (item) => mobileExpenseItemMarkup(item, true)),
        ].join(''), { tab: 'hr' });
    }

    async function renderEmployeeMobileAccess(params = {}, message = '') {
        const response = await api(`/dossiers/${state.activeDossierId}/employee-mobile-access`);
        const employees = Array.isArray(response.data?.employees) ? response.data.employees : [];
        state.employeeMobileAccessCount = employees.length;
        const pageTitle = employeeMobileAccessTitle(employees.length);
        if (!employees.length) {
            renderFrame(pageTitle, emptyState('Aucun salarié', 'Aucun salarié dont vous êtes valideur n’est disponible.'), { tab: 'hr' });
            return;
        }

        const requestedId = Number(params.employeeId) || 0;
        const employee = employees.find((item) => Number(item.id) === requestedId) || employees[0];
        const employeeId = Number(employee.id) || 0;
        const disabled = state.readOnly ? 'disabled' : '';
        const employeeOptions = employees.map((item) => `<option value="${Number(item.id)}" ${Number(item.id) === employeeId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
        const accessSwitch = (key, title, description) => `
            <label class="mobile-app-biometric-switch mobile-app-employee-access-switch">
                <span class="mobile-app-biometric-switch__copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span>
                <input type="checkbox" data-mobile-employee-access-page="${key}" data-mobile-employee-id="${employeeId}" ${employee.access?.[key] ? 'checked' : ''} ${disabled}>
                <span class="mobile-app-biometric-switch__track" aria-hidden="true"><span></span></span>
            </label>`;
        const feedback = message ? `<div class="mobile-app-settings-message is-success" role="status">${escapeHtml(message)}</div>` : '';

        renderFrame(pageTitle, `
            <div class="mobile-app-field mobile-app-employee-access-selector">
                <label for="mobile-employee-access-employee">Salarié</label>
                <select id="mobile-employee-access-employee" data-mobile-employee-access-employee>${employeeOptions}</select>
            </div>
            <div class="mobile-app-form-panel mobile-app-employee-access-options">
                ${accessSwitch('absences', 'Absences', 'Autoriser la pose de nouvelles absences depuis l’application. La liste reste toujours consultable.')}
                ${accessSwitch('expenses', 'Notes de frais', 'Créer et suivre ses demandes de remboursement depuis l’application.')}
                ${accessSwitch('mileage', 'Indemnités kilométriques', 'Saisir ses voyages et les transmettre pour validation depuis l’application.')}
            </div>
            ${feedback}`, { tab: 'hr' });
    }

    function mobileTaskFilterParams(form) {
        if (!(form instanceof HTMLFormElement)) return {};
        const values = new FormData(form);
        const q = String(values.get('q') || '').trim().slice(0, 100);
        const dueUntil = String(values.get('due_until') || '').slice(0, 10);
        return {
            q,
            group: String(values.get('group') || 'ready'),
            module: String(values.get('module') || ''),
            category: String(values.get('category') || ''),
            includeSnoozed: values.has('include_snoozed'),
            hideWithoutDue: values.has('hide_without_due'),
            due_until: /^\d{4}-\d{2}-\d{2}$/.test(dueUntil) ? dueUntil : '',
            hideOverdue: values.has('hide_overdue'),
            dueUntilAutomatic: values.has('due_until_automatic'),
            dueUntilDays: Math.max(0, Math.min(3650, Number.parseInt(String(values.get('due_until_days') || 30), 10) || 0)),
            filtersOpen: form.dataset.filtersOpen === '1',
            dueSettingsOpen: form.dataset.dueSettingsOpen === '1',
        };
    }

    function localIsoDate(value = new Date()) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function automaticMobileTaskDueUntil(days, maximum = '') {
        const date = new Date();
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() + Math.max(0, Math.min(3650, Number(days) || 0)));
        const computed = localIsoDate(date);
        return /^\d{4}-\d{2}-\d{2}$/.test(maximum) && computed > maximum ? maximum : computed;
    }

    async function renderTasks(params = {}) {
        const optionsResponse = await api(`/dossiers/${state.activeDossierId}/tasks/options`);
        const options = optionsResponse.data || {};
        state.taskCreationOptions = options;
        const filters = options.filters || {};
        const groups = Array.isArray(filters.groups) && filters.groups.length
            ? filters.groups
            : [{ value: 'ready', label: 'À faire' }, { value: 'waiting', label: 'En attente' }, { value: 'done', label: 'Terminé' }];
        const modules = Array.isArray(filters.modules) ? filters.modules : [];
        const categories = Array.isArray(filters.categories) ? filters.categories : [];
        const valueIn = (candidate, choices, fallback = '') => choices.some((choice) => String(choice.value) === String(candidate))
            ? String(candidate)
            : String(fallback);
        const maximumDueOn = String(filters.due_on_max || options.due_on_max || '');
        const preferenceKey = 'global';
        const saved = state.taskFiltersByDossier[preferenceKey] && typeof state.taskFiltersByDossier[preferenceKey] === 'object'
            ? state.taskFiltersByDossier[preferenceKey]
            : {};
        const defaults = {
            q: '', group: 'ready', module: '', category: '', includeSnoozed: false, hideWithoutDue: false,
            due_until: '', hideOverdue: false, dueUntilAutomatic: true, dueUntilDays: 30,
        };
        const taskId = Math.max(0, Number(params.taskId) || 0);
        const requested = taskId > 0
            ? { ...defaults, group: 'all', dueUntilAutomatic: false }
            : (params.resetTaskFilters === true ? defaults : { ...defaults, ...saved, ...params });
        const group = taskId > 0 ? 'all' : valueIn(requested.group, groups, 'ready');
        const module = valueIn(requested.module, modules, '');
        const visibleCategories = categories.filter((choice) => !module || String(choice.module) === module);
        const category = valueIn(requested.category, visibleCategories, '');
        const dueUntilAutomatic = requested.dueUntilAutomatic !== false;
        const dueUntilDays = Math.max(0, Math.min(3650, Number.parseInt(String(requested.dueUntilDays ?? 30), 10) || 0));
        const manualDueUntil = /^\d{4}-\d{2}-\d{2}$/.test(String(requested.due_until || '')) ? String(requested.due_until) : '';
        const dueUntil = dueUntilAutomatic
            ? automaticMobileTaskDueUntil(dueUntilDays, maximumDueOn)
            : (maximumDueOn && manualDueUntil > maximumDueOn ? maximumDueOn : manualDueUntil);
        const q = String(requested.q || '').trim().slice(0, 100);
        const includeSnoozed = requested.includeSnoozed === true;
        const hideWithoutDue = requested.hideWithoutDue === true;
        const hideOverdue = requested.hideOverdue === true;
        const filtersOpen = params.filtersOpen === true;
        const dueSettingsOpen = filtersOpen && params.dueSettingsOpen === true;
        const selectOptions = (choices, selected, blank = null) => `${blank ? `<option value="" ${selected === '' ? 'selected' : ''}>${escapeHtml(blank)}</option>` : ''}${choices.map((choice) => `<option value="${escapeHtml(choice.value)}" ${String(choice.value) === selected ? 'selected' : ''}>${escapeHtml(choice.label)}</option>`).join('')}`;
        const query = new URLSearchParams({
            per_page: '50',
            group,
            scope: 'personal',
            archive: 'all',
            ...(q ? { q } : {}),
            ...(module ? { module } : {}),
            ...(category ? { category } : {}),
            ...(includeSnoozed ? { include_snoozed: '1' } : {}),
            ...(hideWithoutDue ? { hide_without_due: '1' } : {}),
            ...(dueUntil ? { due_until: dueUntil } : {}),
            ...(hideOverdue ? { hide_overdue: '1' } : {}),
            ...(taskId > 0 ? { task_id: String(taskId) } : {}),
        });
        const response = await api(`/dossiers/${state.activeDossierId}/tasks?${query}`);
        const items = response.data || [];
        const normalizedParams = {
            q, group, module, category, includeSnoozed, hideWithoutDue, due_until: dueUntil, hideOverdue,
            dueUntilAutomatic, dueUntilDays,
        };
        if (taskId < 1) state.taskFiltersByDossier[preferenceKey] = normalizedParams;
        state.routeParams = { ...normalizedParams, ...(taskId > 0 ? { taskId } : {}), ...(filtersOpen ? { filtersOpen: true } : {}), ...(dueSettingsOpen ? { dueSettingsOpen: true } : {}) };
        if (taskId < 1) persistPreferences();
        persistNavigation();
        const filterIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
        const settingsIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-2.5.1-1-.1-1 2-1.6-2-3.4-2.5 1a8 8 0 0 0-1.7-1L14.8 3h-4l-.4 3a8 8 0 0 0-1.7 1l-2.5-1-2 3.4 2 1.6-.1 1 .1 1-2 1.6 2 3.4 2.5-1a8 8 0 0 0 1.7 1l.4 3h4l.4-3a8 8 0 0 0 1.7-1l2.5 1 2-3.4-2-1.6Z"/></svg>';
        const filterForm = `<form class="mobile-app-task-filters" data-mobile-task-filters data-filters-open="${filtersOpen ? '1' : '0'}" data-due-settings-open="${dueSettingsOpen ? '1' : '0'}">
            <div class="mobile-app-task-filters__attachment">
                <div class="mobile-app-task-filters__search-row">
                    <input class="mobile-app-search" name="q" value="${escapeHtml(q)}" maxlength="100" placeholder="Rechercher une tâche" aria-label="Rechercher une tâche">
                    <button class="mobile-app-task-filters__toggle ${filtersOpen ? 'is-open' : ''}" type="button" data-mobile-task-filters-toggle aria-expanded="${filtersOpen ? 'true' : 'false'}" aria-label="${filtersOpen ? 'Fermer les filtres' : 'Ouvrir les filtres'}">${filtersOpen ? '<span aria-hidden="true">×</span>' : filterIcon}</button>
                </div>
                ${filtersOpen ? `<section class="mobile-app-task-filters__advanced" aria-label="Filtres des tâches">
                <div class="mobile-app-task-filters__grid">
                    <div class="mobile-app-field"><label for="mobile-task-filter-module">Module</label><select id="mobile-task-filter-module" name="module" data-mobile-task-filter>${selectOptions(modules, module, 'Tous')}</select></div>
                    <div class="mobile-app-field"><label for="mobile-task-filter-category">Catégorie</label><select id="mobile-task-filter-category" name="category" data-mobile-task-filter>${selectOptions(visibleCategories, category, 'Toutes')}</select></div>
                    <div class="mobile-app-task-filters__date-row">
                        <div class="mobile-app-field"><label for="mobile-task-filter-until">Échéance jusqu’au</label>${dueUntilAutomatic
                            ? `<input id="mobile-task-filter-until" type="text" value="${escapeHtml(`${formatCivilDate(dueUntil)} (auto)`)}" disabled aria-label="Échéance jusqu’au, date automatique">`
                            : `<input id="mobile-task-filter-until" type="date" lang="fr" name="due_until" value="${escapeHtml(dueUntil)}" max="${escapeHtml(maximumDueOn)}" data-mobile-task-filter>`}</div>
                        ${dueUntilAutomatic ? `<input type="hidden" name="due_until" value="${escapeHtml(dueUntil)}">` : ''}
                        <button class="mobile-app-task-filters__settings-button ${dueUntilAutomatic ? 'is-automatic' : ''}" type="button" data-mobile-task-due-settings-toggle aria-expanded="${dueSettingsOpen ? 'true' : 'false'}" aria-label="Paramétrer l’échéance automatique">${settingsIcon}</button>
                    </div>
                    ${dueSettingsOpen ? `<div class="mobile-app-task-filters__settings">
                        <header><strong>Date automatique</strong><button type="button" data-mobile-task-due-settings-close aria-label="Fermer">×</button></header>
                        <label class="mobile-app-task-switch"><strong>Activer la date automatique</strong><input type="checkbox" name="due_until_automatic" value="1" data-mobile-task-filter ${dueUntilAutomatic ? 'checked' : ''}><span aria-hidden="true"><span></span></span></label>
                        ${dueUntilAutomatic ? `<div class="mobile-app-task-filters__automatic-days"><input type="number" min="0" max="3650" inputmode="numeric" name="due_until_days" value="${dueUntilDays}" data-mobile-task-filter><span>${dueUntilDays === 1 ? 'jour à venir' : 'jours à venir'}</span></div>` : `<input type="hidden" name="due_until_days" value="${dueUntilDays}">`}
                    </div>` : `<input type="hidden" name="due_until_automatic" value="${dueUntilAutomatic ? '1' : ''}" ${dueUntilAutomatic ? '' : 'disabled'}><input type="hidden" name="due_until_days" value="${dueUntilDays}">`}
                </div>
                <div class="mobile-app-task-filters__switches">
                    <label class="mobile-app-task-switch"><strong>Inclure les tâches reportées</strong><input type="checkbox" name="include_snoozed" value="1" data-mobile-task-filter ${includeSnoozed ? 'checked' : ''}><span aria-hidden="true"><span></span></span></label>
                    <label class="mobile-app-task-switch"><strong>Masquer sans échéance</strong><input type="checkbox" name="hide_without_due" value="1" data-mobile-task-filter ${hideWithoutDue ? 'checked' : ''}><span aria-hidden="true"><span></span></span></label>
                    <label class="mobile-app-task-switch"><strong>Masquer les tâches en retard</strong><input type="checkbox" name="hide_overdue" value="1" data-mobile-task-filter ${hideOverdue ? 'checked' : ''}><span aria-hidden="true"><span></span></span></label>
                </div>
                <button class="mobile-app-secondary-button" type="button" data-mobile-task-filter-reset>Réinitialiser les filtres</button>
            </section>` : ''}
            </div>
            <div class="mobile-app-field mobile-app-task-filters__group"><label for="mobile-task-filter-group">État</label><select id="mobile-task-filter-group" name="group" data-mobile-task-filter>${selectOptions(groups, group)}</select></div>
        </form>`;
        const list = items.length ? `<div class="mobile-app-task-list">${items.map((task) => {
            const metadata = [task.dossier_name, task.due_label || (task.due_on ? formatCivilDate(task.due_on) : '')].filter(Boolean).join(' - ');
            const permissions = task.permissions && typeof task.permissions === 'object' ? task.permissions : {};
            const taskAttributes = `data-task-dossier="${Number(task.dossier_id) || Number(state.activeDossierId)}" data-task-version="${Math.max(1, Number(task.version) || 1)}"`;
            const action = String(task.status) === 'done' && permissions.transition !== false
                ? `<button class="mobile-app-secondary-button mobile-app-task-card__action is-undo" type="button" data-mobile-task-undo="${Number(task.id)}" ${taskAttributes} ${state.readOnly ? 'disabled' : ''}>Annuler</button>`
                : (!['done', 'cancelled'].includes(String(task.status)) && permissions.complete !== false
                    ? `<button class="mobile-app-primary-button mobile-app-task-card__action" type="button" data-mobile-task-complete="${Number(task.id)}" ${taskAttributes} ${state.readOnly ? 'disabled' : ''}>Terminer</button>`
                    : '');
            return `<article class="mobile-app-task-card" data-mobile-task-card="${Number(task.id)}" ${mobileCardInteractionAttributes(task.interaction)} role="button" tabindex="0" aria-label="Ouvrir la tâche ${escapeHtml(task.title)}"><div class="mobile-app-task-card__heading"><h3>${escapeHtml(task.title)}</h3>${action}</div>${metadata ? `<small>${escapeHtml(metadata)}</small>` : ''}${task.description ? `<p>${escapeHtml(task.description)}</p>` : ''}</article>`;
        }).join('')}</div>` : emptyState('Aucune tâche', 'Aucune tâche ne correspond aux filtres sélectionnés.');
        const createAction = can('tasks.create') && options.can_create !== false
            ? `<button class="mobile-app-primary-button mobile-app-task-create" type="button" data-mobile-route="task_create" ${state.readOnly ? 'disabled' : ''}>Créer une tâche</button>`
            : '';
        renderFrame('Tâches', `${filterForm}${createAction}${list}`, { tab: 'tasks', hideHeaderContext: true });
    }

    function taskModuleOptions(moduleValue) {
        const modules = Array.isArray(state.taskCreationOptions?.modules) ? state.taskCreationOptions.modules : [];
        return modules.find((module) => String(module.value) === String(moduleValue)) || modules[0] || null;
    }

    function syncMobileTaskCategoryOptions(form) {
        const moduleSelect = form?.querySelector('[data-mobile-task-module]');
        const categorySelect = form?.querySelector('[data-mobile-task-category]');
        if (!(moduleSelect instanceof HTMLSelectElement) || !(categorySelect instanceof HTMLSelectElement)) return;

        const module = taskModuleOptions(moduleSelect.value);
        const categories = Array.isArray(module?.categories) ? module.categories : [];
        const previous = categorySelect.value || String(state.taskCreationOptions?.defaults?.category || 'custom');
        categorySelect.innerHTML = categories.map((category) => `<option value="${escapeHtml(category.value)}">${escapeHtml(category.label)}</option>`).join('');
        const fallback = String(state.taskCreationOptions?.defaults?.category || 'custom');
        categorySelect.value = categories.some((category) => String(category.value) === previous)
            ? previous
            : (categories.some((category) => String(category.value) === fallback) ? fallback : String(categories[0]?.value || ''));
    }

    function syncMobileTaskRecurrence(form) {
        const toggle = form?.querySelector('[data-mobile-task-recurrence]');
        const fields = form?.querySelector('[data-mobile-task-recurrence-fields]');
        const interval = form?.querySelector('[name="recurrence_interval"]');
        const unit = form?.querySelector('[name="recurrence_unit"]');
        const dueOn = form?.querySelector('[name="due_on"]');
        const enabled = toggle instanceof HTMLInputElement && toggle.checked;
        if (fields instanceof HTMLElement) fields.hidden = !enabled;
        fields?.querySelectorAll('input, select').forEach((field) => { field.disabled = !enabled; });
        if (dueOn instanceof HTMLInputElement) dueOn.required = enabled;
        if (interval instanceof HTMLInputElement) interval.required = enabled;
        if (unit instanceof HTMLSelectElement) unit.required = enabled;
        if (unit instanceof HTMLSelectElement) {
            const count = Math.max(1, Number.parseInt(String(interval?.value || 1), 10) || 1);
            const day = Array.from(unit.options).find((option) => option.value === 'day');
            if (day) day.textContent = count === 1 ? 'jour' : 'jours';
        }
    }

    function syncMobileTaskReminder(form) {
        const toggle = form?.querySelector('[data-mobile-task-reminder]');
        const fields = form?.querySelector('[data-mobile-task-reminder-fields]');
        const daysInput = form?.querySelector('[name="reminder_days_before"]');
        const unit = form?.querySelector('[data-mobile-task-reminder-unit]');
        const enabled = toggle instanceof HTMLInputElement && toggle.checked;
        if (fields instanceof HTMLElement) fields.hidden = !enabled;
        fields?.querySelectorAll('input, select').forEach((field) => { field.disabled = !enabled; });
        if (daysInput instanceof HTMLInputElement) daysInput.required = enabled;
        if (unit instanceof HTMLElement) {
            const days = Math.max(0, Number.parseInt(String(daysInput?.value || 0), 10) || 0);
            unit.textContent = `${days === 1 ? 'jour' : 'jours'} avant l’échéance`;
        }
    }

    function mobileTaskFormMarkup(options, { quickOrigin = false } = {}) {
        const modules = Array.isArray(options.modules) ? options.modules : [];
        const recurrenceUnits = Array.isArray(options.recurrence_units) ? options.recurrence_units : [];
        const linkedDossiers = Array.isArray(options.linked_dossiers) && options.linked_dossiers.length
            ? options.linked_dossiers
            : [{ value: '', label: 'Aucun dossier lié' }];
        const requestedDossierId = String(options.defaults?.dossier_id ?? '');
        const defaultDossierId = linkedDossiers.some((dossier) => String(dossier.value) === requestedDossierId)
            ? requestedDossierId
            : '';
        const defaultModule = modules.some((module) => module.value === options.defaults?.module)
            ? options.defaults.module
            : String(modules[0]?.value || 'general');
        const defaultRecurrenceInterval = Math.max(1, Number(options.defaults?.recurrence_interval) || 1);
        const defaultRecurrenceUnit = String(options.defaults?.recurrence_unit || recurrenceUnits[0]?.value || 'day');
        const defaultReminderDays = Math.max(0, Number(options.reminder?.default_days_before) || 0);
        const maximumReminderDays = Math.max(defaultReminderDays, Number(options.reminder?.maximum_days_before) || 999);
        return `<form class="mobile-app-form-panel" data-mobile-form="task" ${quickOrigin ? 'data-mobile-quick-origin="home"' : ''}>
            <div class="mobile-app-field mobile-app-task-closed-field"><label for="mobile-task-title">Titre</label><input id="mobile-task-title" name="title" required maxlength="255"></div>
            <div class="mobile-app-field mobile-app-task-due mobile-app-task-closed-field"><label for="mobile-task-due">Échéance</label><input id="mobile-task-due" type="date" lang="fr" name="due_on" max="${escapeHtml(options.due_on_max || '')}"></div>
            <div class="mobile-app-field mobile-app-task-dossier" aria-labelledby="mobile-task-dossier-label">
                <span class="mobile-app-field__label" id="mobile-task-dossier-label">Dossier lié</span>
                <select id="mobile-task-dossier" name="dossier_id" aria-label="Dossier lié">${linkedDossiers.map((dossier) => `<option value="${escapeHtml(dossier.value)}" ${String(dossier.value) === defaultDossierId ? 'selected' : ''}>${escapeHtml(dossier.label)}</option>`).join('')}</select>
            </div>
            <div class="mobile-app-task-options-row">
                <section class="mobile-app-task-option">
                    <label class="mobile-app-task-switch" for="mobile-task-recurrence"><strong>Récurrence</strong><input id="mobile-task-recurrence" type="checkbox" name="is_recurring" value="1" data-mobile-task-recurrence><span aria-hidden="true"><span></span></span></label>
                    <div class="mobile-app-task-option__fields" data-mobile-task-recurrence-fields hidden>
                        <span>Répéter tous les</span>
                        <div class="mobile-app-task-inline-fields"><input type="number" name="recurrence_interval" min="1" max="36" value="${defaultRecurrenceInterval}" inputmode="numeric" aria-label="Intervalle de récurrence" disabled><select name="recurrence_unit" aria-label="Unité de récurrence" disabled>${recurrenceUnits.map((unit) => `<option value="${escapeHtml(unit.value)}" ${unit.value === defaultRecurrenceUnit ? 'selected' : ''}>${escapeHtml(unit.label)}</option>`).join('')}</select></div>
                    </div>
                </section>
                <section class="mobile-app-task-option">
                    <label class="mobile-app-task-switch" for="mobile-task-reminder"><strong>Rappel par e-mail</strong><input id="mobile-task-reminder" type="checkbox" name="reminder_enabled" value="1" data-mobile-task-reminder><span aria-hidden="true"><span></span></span></label>
                    <div class="mobile-app-task-option__fields" data-mobile-task-reminder-fields hidden>
                        <div class="mobile-app-task-reminder-delay"><input type="number" name="reminder_days_before" min="0" max="${maximumReminderDays}" value="${defaultReminderDays}" inputmode="numeric" aria-label="Délai du rappel" disabled><span data-mobile-task-reminder-unit>jours avant l’échéance</span></div>
                    </div>
                </section>
            </div>
            <div class="mobile-app-task-description-categories">
                <div class="mobile-app-field mobile-app-task-description mobile-app-task-closed-field"><label for="mobile-task-description">Description générale</label><input id="mobile-task-description" name="description" maxlength="5000"></div>
                <div class="mobile-app-field mobile-app-task-categories" aria-labelledby="mobile-task-categories-title">
                    <span class="mobile-app-field__label" id="mobile-task-categories-title">Catégories</span>
                    <div class="mobile-app-task-categories__row">
                        <select id="mobile-task-module" name="module" data-mobile-task-module required aria-label="Catégorie principale">${modules.map((module) => `<option value="${escapeHtml(module.value)}" ${module.value === defaultModule ? 'selected' : ''}>${escapeHtml(module.label)}</option>`).join('')}</select>
                        <select id="mobile-task-category" name="category" data-mobile-task-category required aria-label="Catégorie secondaire"></select>
                    </div>
                </div>
            </div>
            ${writeButton('Créer la tâche')}
        </form>`;
    }

    function initializeMobileTaskForm(root = app) {
        const form = root?.querySelector('[data-mobile-form="task"]');
        if (!form) return;
        syncMobileTaskCategoryOptions(form);
        syncMobileTaskRecurrence(form);
        syncMobileTaskReminder(form);
    }

    async function taskCreationOptions() {
        const response = await api(`/dossiers/${state.activeDossierId}/tasks/options`);
        state.taskCreationOptions = response.data || {};
        return state.taskCreationOptions;
    }

    async function renderTaskForm() {
        const options = await taskCreationOptions();
        renderFrame('Nouvelle tâche', mobileTaskFormMarkup(options), { tab: 'tasks' });
        initializeMobileTaskForm();
    }

    async function openQuickTaskCreation() {
        const options = await taskCreationOptions();
        openQuickCreationDialog('task', 'Nouvelle tâche', mobileTaskFormMarkup(options, { quickOrigin: true }));
        initializeMobileTaskForm(app.querySelector('[data-mobile-quick-creation="task"]'));
    }

    function notificationPreferencesDialogMarkup() {
        if (!state.notificationPreferencesOpen) return '';

        const preferences = state.notificationPreferences.map((preference) => {
            const category = escapeHtml(preference.category);
            const disabled = state.readOnly || state.notificationPreferencesSaving ? 'disabled' : '';
            const emailSwitch = String(preference.category) === 'payroll_hr'
                && Object.prototype.hasOwnProperty.call(preference, 'email_enabled')
                ? `<label class="mobile-app-task-switch mobile-app-notification-preference__switch"><strong>Notification par e-mail</strong><input type="checkbox" data-notification-preference-category="${category}" data-notification-preference-field="email_enabled" ${preference.email_enabled ? 'checked' : ''} ${disabled}><span aria-hidden="true"><span></span></span></label>`
                : '';
            return `<article class="mobile-app-notification-preference">
                <h4>${escapeHtml(preference.label || preference.category)}</h4>
                <label class="mobile-app-task-switch mobile-app-notification-preference__switch"><strong>Sur cet appareil</strong><input type="checkbox" data-notification-preference-category="${category}" data-notification-preference-field="device_enabled" ${preference.device_enabled ? 'checked' : ''} ${disabled}><span aria-hidden="true"><span></span></span></label>
                ${emailSwitch}
            </article>`;
        }).join('');
        const message = state.notificationPreferencesError
            ? `<p class="mobile-app-quick-actions-error" role="alert">${escapeHtml(state.notificationPreferencesError)}</p>`
            : state.notificationPreferencesSaving
                ? '<p class="mobile-app-quick-actions-hint" role="status">Enregistrement…</p>'
                : '';

        return `<div class="mobile-app-dialog-backdrop" data-notification-preferences-dialog role="presentation"><section class="mobile-app-quick-actions-dialog mobile-app-notification-preferences-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-notification-preferences-title"><header><h3 id="mobile-notification-preferences-title">Paramétrage des notifications</h3><button type="button" data-notification-preferences-close aria-label="Fermer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header><div class="mobile-app-notification-preferences-dialog__body">${message}${preferences || '<p class="mobile-app-quick-actions-dialog__empty">Aucune préférence disponible.</p>'}</div></section></div>`;
    }

    function notificationPreferencesEndpoint() {
        const query = state.activeDossierId
            ? `?dossier_id=${encodeURIComponent(state.activeDossierId)}`
            : '';

        return `/notification-preferences${query}`;
    }

    function stopNotificationPreferencesPolling() {
        if (state.notificationPreferencesRefreshTimer !== null) {
            window.clearInterval(state.notificationPreferencesRefreshTimer);
        }
        state.notificationPreferencesRefreshTimer = null;
    }

    async function refreshNotificationPreferences() {
        if (!state.notificationPreferencesOpen
            || state.route !== 'notifications'
            || state.notificationPreferencesSaving
            || state.notificationPreferencesRefreshInFlight
            || document.hidden) {
            return;
        }

        state.notificationPreferencesRefreshInFlight = true;
        const revision = state.notificationPreferencesRevision;
        try {
            const response = await api(notificationPreferencesEndpoint());
            if (revision !== state.notificationPreferencesRevision || state.notificationPreferencesSaving) return;
            const preferences = (response.data || []).filter((preference) => !isSalariedUser()
                || !salariedRestrictedNotificationPreferenceCategories.has(String(preference?.category || '')));
            if (JSON.stringify(preferences) === JSON.stringify(state.notificationPreferences)) return;

            const scrollTop = app.querySelector('.mobile-app-notification-preferences-dialog__body')?.scrollTop || 0;
            state.notificationPreferences = preferences;
            renderNotificationsContent();
            const body = app.querySelector('.mobile-app-notification-preferences-dialog__body');
            if (body) body.scrollTop = scrollTop;
        } catch (_) {
            // Le prochain contrôle périodique réessaiera sans perturber la fenêtre ouverte.
        } finally {
            state.notificationPreferencesRefreshInFlight = false;
        }
    }

    function startNotificationPreferencesPolling() {
        stopNotificationPreferencesPolling();
        refreshNotificationPreferences();
        state.notificationPreferencesRefreshTimer = window.setInterval(refreshNotificationPreferences, 2000);
    }

    function notificationPeriod(createdAtUtc) {
        const date = new Date(String(createdAtUtc || ''));
        if (Number.isNaN(date.getTime())) return { key: 'older', label: 'Plus anciennes' };
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        if (itemDay.getTime() === startOfToday.getTime()) return { key: 'today', label: 'Aujourd’hui' };
        const monday = new Date(startOfToday);
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        if (itemDay >= monday) return { key: 'week', label: 'Cette semaine' };
        if (itemDay.getFullYear() === today.getFullYear() && itemDay.getMonth() === today.getMonth()) {
            return { key: 'month', label: 'Ce mois' };
        }
        const offset = Math.max(1, ((today.getFullYear() - itemDay.getFullYear()) * 12) + today.getMonth() - itemDay.getMonth());
        return { key: `month-${offset}`, label: `Mois M-${offset}` };
    }

    function renderNotificationsContent() {
        const uniqueItems = new Map();
        state.notificationItems.forEach((item) => {
            const key = Number(item?.id) > 0
                ? `id-${Number(item.id)}`
                : `${String(item?.created_at_utc || '')}-${String(item?.title || '')}-${String(item?.body || '')}`;
            if (!uniqueItems.has(key)) uniqueItems.set(key, item);
        });
        const items = [...uniqueItems.values()].sort((left, right) => {
            const dateOrder = String(right.created_at_utc || '').localeCompare(String(left.created_at_utc || ''));
            return dateOrder || (Number(right.id) - Number(left.id));
        });
        const settingsIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M14 4v6M4 17h2M10 17h10M10 14v6"/></svg>';
        const grouped = new Map([
            ['today', { label: 'Aujourd’hui', items: [] }],
            ['week', { label: 'Cette semaine', items: [] }],
            ['month', { label: 'Ce mois', items: [] }],
        ]);
        items.forEach((item) => {
            const period = notificationPeriod(item.created_at_utc);
            if (!grouped.has(period.key)) grouped.set(period.key, { label: period.label, items: [] });
            grouped.get(period.key).items.push(item);
        });
        const list = items.length ? `<div class="mobile-app-notification-groups">${[...grouped.values()].map((group) => `<section class="mobile-app-notification-group"><h2>${escapeHtml(group.label)}</h2>${group.items.length ? `<div class="mobile-app-list mobile-app-notifications-list">${group.items.map((item) => `<article class="mobile-app-list-item mobile-app-notification-item"><button class="mobile-app-notification-open" type="button" data-notification-open="${escapeHtml(item.id)}" ${mobileCardInteractionAttributes(item.interaction)}><span class="mobile-app-list-item__top"><h3>${escapeHtml(item.title)}</h3><time datetime="${escapeHtml(item.created_at_utc || '')}">${escapeHtml(formatDate(item.created_at_utc, true))}</time></span><span>${escapeHtml(item.body)}</span></button></article>`).join('')}</div>` : '<p class="mobile-app-notification-group__empty">Aucune notification</p>'}</section>`).join('')}</div>` : emptyState('Aucune notification', 'Aucune notification n’a encore été enregistrée.');
        const settings = `<div class="mobile-app-notifications-actions"><button class="mobile-app-secondary-button mobile-app-notification-action" type="button" data-notification-preferences-open>${settingsIcon}<span>Paramétrer les notifications</span></button></div>`;
        renderFrame('Historique des notifications', `${settings}${list}${notificationPreferencesDialogMarkup()}`, { tab: 'notifications' });
    }

    async function renderNotifications() {
        refreshNativePushRegistration({ requestAuthorization: true });
        const [notificationsResponse, preferencesResponse] = await Promise.all([
            api('/notifications?history=1&per_page=50'),
            api(notificationPreferencesEndpoint()),
        ]);
        state.notificationItems = notificationsResponse.data || [];
        state.notificationPreferences = (preferencesResponse.data || []).filter((preference) => !isSalariedUser()
            || !salariedRestrictedNotificationPreferenceCategories.has(String(preference?.category || '')));
        state.notificationPreferencesError = '';
        renderNotificationsContent();
    }

    function renderEmployeePayslips(selectedYear = String(new Date().getFullYear())) {
        const items = [...state.payslipItems].sort((left, right) => {
            const periodOrder = String(right.period_end || '').localeCompare(String(left.period_end || ''));
            return periodOrder || (Number(right.id) - Number(left.id));
        });
        const currentYear = String(new Date().getFullYear());
        const years = [...new Set([currentYear, ...items.map((item) => String(item.period_end || '').slice(0, 4)).filter((year) => /^\d{4}$/.test(year))])]
            .sort((left, right) => right.localeCompare(left));
        const requestedYear = String(selectedYear || currentYear);
        const year = requestedYear === 'all' ? 'all' : (years.includes(requestedYear) ? requestedYear : currentYear);
        const visibleItems = year === 'all' ? items : items.filter((item) => String(item.period_end || '').startsWith(year));
        const yearOptions = `<option value="all" ${year === 'all' ? 'selected' : ''}>Toutes les années</option>${years.map((value) => `<option value="${value}" ${year === value ? 'selected' : ''}>${value}</option>`).join('')}`;
        const downloadAllUrl = `${state.payslipDownloadAllUrl || `/dossiers/${state.activeDossierId}/payslips/download-all`}${year !== 'all' ? `?year=${encodeURIComponent(year)}` : ''}`;
        const downloadAllButton = visibleItems.length > 1
            ? `<button class="mobile-app-primary-button mobile-app-payslips-download-all" type="button" data-download-binary="${escapeHtml(downloadAllUrl)}" data-download-filename="${escapeHtml(year !== 'all' ? `bulletins-${year}.zip` : 'bulletins.zip')}">Tout télécharger</button>`
            : '';
        const downloadIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3h2v10.2l3.6-3.6L18 11l-6 6-6-6 1.4-1.4 3.6 3.6V3ZM5 19h14v2H5v-2Z"/></svg>';
        const list = visibleItems.length ? `<div class="mobile-app-list mobile-app-payslips-list">${visibleItems.map((item) => {
            const periodMonth = String(item.period_end || '').slice(0, 7);
            const isTese = String(item.source || '') === 'tese';
            const employeeName = String(item.employee?.display_name || '');
            const title = String(item.display_label || '').trim() || `${employeeName} - ${formatPayslipMonth(periodMonth) || periodMonth}`.replace(/^\s*-\s*/, '');
            const downloadUrl = item.download_url || `${item.content_url}${String(item.content_url || '').includes('?') ? '&' : '?'}download=1`;
            const filename = `bulletin-${isTese ? 'tese-' : ''}${periodMonth || 'periode'}-${item.id}.pdf`;
            return `<article class="mobile-app-list-item mobile-app-payslip-item"><button class="mobile-app-payslip-open" type="button" data-open-binary="${escapeHtml(item.content_url)}" aria-label="Ouvrir ${escapeHtml(title)}"><span class="mobile-app-payslip-item__copy"><h3>${escapeHtml(title)}</h3></span></button><button class="mobile-app-secondary-button mobile-app-payslip-download" type="button" data-download-binary="${escapeHtml(downloadUrl)}" data-download-filename="${escapeHtml(filename)}" aria-label="Télécharger ${escapeHtml(title)}" title="Télécharger">${downloadIcon}</button></article>`;
        }).join('')}</div>` : emptyState('Aucun bulletin', year !== 'all' ? 'Aucun bulletin publié n’est disponible pour cette année.' : 'Aucun bulletin publié n’est disponible.');
        const toolbar = `<div class="mobile-app-payslips-toolbar"><div class="mobile-app-field"><label for="mobile-payslip-year">Année</label><select id="mobile-payslip-year" data-mobile-payslip-year>${yearOptions}</select></div>${downloadAllButton}</div>`;
        state.routeParams = { year };
        persistNavigation();
        renderFrame('Bulletins', `${toolbar}${list}`, { tab: 'payslips' });
    }

    function renderManagerPayslips(selectedEmployeeId = 0, selectedMonth = 'all') {
        const items = [...state.payslipItems].sort((left, right) => String(right.period_end || '').localeCompare(String(left.period_end || '')) || Number(right.id) - Number(left.id));
        const employees = [...new Map(items.map((item) => [Number(item.employee?.id) || 0, String(item.employee?.display_name || '')]).filter(([id]) => id > 0)).entries()]
            .sort((left, right) => left[1].localeCompare(right[1], 'fr', { sensitivity: 'base' }));
        const employeeId = employees.some(([id]) => id === Number(selectedEmployeeId))
            ? Number(selectedEmployeeId)
            : (employees.length === 1 ? employees[0][0] : 0);
        const employeeItems = employeeId > 0 ? items.filter((item) => Number(item.employee?.id) === employeeId) : items;
        const months = [...new Set(employeeItems.map((item) => String(item.period_end || '').slice(0, 7)).filter((value) => /^\d{4}-\d{2}$/.test(value)))]
            .sort((left, right) => right.localeCompare(left));
        const month = months.includes(String(selectedMonth))
            ? String(selectedMonth)
            : (months.length === 1 ? months[0] : 'all');
        const visibleItems = month === 'all' ? employeeItems : employeeItems.filter((item) => String(item.period_end || '').startsWith(month));
        const employeeOptions = `${employees.length === 1 ? '' : `<option value="0" ${employeeId === 0 ? 'selected' : ''}>Tous</option>`}${employees.map(([id, name]) => `<option value="${id}" ${employeeId === id ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}`;
        const monthOptions = `${months.length === 1 ? '' : `<option value="all" ${month === 'all' ? 'selected' : ''}>Tous les mois</option>`}${months.map((value) => `<option value="${value}" ${month === value ? 'selected' : ''}>${escapeHtml(formatPayslipMonth(value))}</option>`).join('')}`;
        const selector = `<div class="mobile-app-form-panel mobile-app-hr-list-filters"><div class="mobile-app-field"><label for="mobile-payslip-employee">Salarié</label><select id="mobile-payslip-employee" data-mobile-payslip-employee data-mobile-select-menu-min-width="240">${employeeOptions}</select></div><div class="mobile-app-field"><label for="mobile-payslip-month">Mois</label><select id="mobile-payslip-month" data-mobile-payslip-month>${monthOptions}</select></div></div>`;
        const list = visibleItems.length ? `<div class="mobile-app-list mobile-app-payslips-list">${visibleItems.map((item) => {
            const employeeName = String(item.employee?.display_name || '');
            const periodMonth = String(item.period_end || '').slice(0, 7);
            const title = String(item.display_label || '').trim() || `${employeeName} - ${formatPayslipMonth(periodMonth) || periodMonth}`.replace(/^\s*-\s*/, '');
            return `<article class="mobile-app-list-item"><button class="mobile-app-list-button" type="button" data-open-binary="${escapeHtml(item.content_url)}"><h3>${escapeHtml(title)}</h3></button></article>`;
        }).join('')}</div>` : emptyState('Aucun bulletin', 'Aucun bulletin publié ne correspond aux filtres sélectionnés.');
        state.routeParams = { employeeId, month };
        persistNavigation();
        renderFrame('Bulletins', `${selector}${list}`, { tab: 'hr' });
    }

    async function renderPayslips(params = {}) {
        const response = await api(`/dossiers/${state.activeDossierId}/payslips?all=1`);
        const items = response.data || [];
        state.payslipItems = items;
        if (isSalariedUser()) {
            state.payslipDownloadAllUrl = String(response.meta?.download_all_url || '');
            renderEmployeePayslips(params.year || String(new Date().getFullYear()));
            return;
        }
        renderManagerPayslips(Number(params.employeeId) || 0, params.month || 'all');
    }

    async function renderLatestPayslipDownload() {
        const response = await api(`/dossiers/${state.activeDossierId}/payslips?all=1`);
        const items = [...(response.data || [])].sort((left, right) => String(right.period_end || '').localeCompare(String(left.period_end || '')) || Number(right.id) - Number(left.id));
        state.route = 'payslips';
        state.routeParams = { year: 'all' };
        state.payslipItems = items;
        state.payslipDownloadAllUrl = String(response.meta?.download_all_url || '');
        persistNavigation();
        renderEmployeePayslips('all');
        const latest = items[0];
        if (!latest) return;
        const periodMonth = String(latest.period_end || '').slice(0, 7);
        const downloadUrl = latest.download_url || `${latest.content_url}${String(latest.content_url || '').includes('?') ? '&' : '?'}download=1`;
        await downloadBinary(downloadUrl, `bulletin-${periodMonth || 'dernier'}.pdf`);
    }

    async function openLatestPayslipFromHome(trigger) {
        const response = await api(`/dossiers/${state.activeDossierId}/payslips?all=1`);
        const latest = [...(response.data || [])]
            .sort((left, right) => String(right.period_end || '').localeCompare(String(left.period_end || '')) || Number(right.id) - Number(left.id))[0];
        if (!latest) {
            showQuickCreationNotice('Aucun bulletin publié n’est disponible.');
            return;
        }

        await openBinary(String(latest.content_url || latest.download_url || ''), trigger);
    }

    function leaveBalanceMarkup(data) {
        const periods = Array.isArray(data?.periods) ? data.periods : [];
        const deadlineApprovalNote = String(data?.deadline_approval_note || '').trim() || '(sauf validation du responsable)';
        const periodCards = periods.map((period) => {
            const takenDetails = Array.isArray(period.taken_details) ? period.taken_details : [];
            const takenDetailList = takenDetails.length ? `<section class="mobile-app-leave-balance-taken">
                <h3>Détail des jours pris</h3>
                <ul>${takenDetails.map((detail) => {
                    const startsOn = String(detail.starts_on || '');
                    const endsOn = String(detail.ends_on || startsOn);
                    const dateLabel = detail.kind === 'expiry'
                        ? `Expiration le ${formatCivilDate(startsOn)}`
                        : startsOn && endsOn && startsOn !== endsOn
                            ? `Du ${formatCivilDate(startsOn)} au ${formatCivilDate(endsOn)}`
                            : `Le ${formatCivilDate(startsOn)}`;
                    return `<li><span>${escapeHtml(dateLabel)}</span><strong>${escapeHtml(formatLeaveDays(detail.quantity))}</strong></li>`;
                }).join('')}</ul>
            </section>` : '';
            const normalUseUntil = period.normal_use_until || period.expires_on;
            const deadline = normalUseUntil
                ? `<p class="mobile-app-leave-balance-card__expiry">Solde disponible à prendre avant le ${formatCivilDate(normalUseUntil)} ${escapeHtml(deadlineApprovalNote)}</p>`
                : '';
            return `<article class="mobile-app-leave-balance-card">
                <h2>${escapeHtml(period.label || 'Congés payés')}</h2>
                <dl>
                    <div><dt>Acquis</dt><dd>${escapeHtml(formatLeaveDays(period.acquired))}</dd></div>
                    <div><dt>Pris</dt><dd>${escapeHtml(formatLeaveDays(period.taken))}</dd></div>
                    <div><dt>Planifiés</dt><dd>${escapeHtml(formatLeaveDays(period.planned))}</dd></div>
                    <div class="is-available"><dt>Disponible</dt><dd>${escapeHtml(formatLeaveDays(period.available))}</dd></div>
                </dl>
                ${deadline}
                ${takenDetailList}
            </article>`;
        }).join('');
        const body = periodCards
            ? `<div class="mobile-app-leave-balance-list">${periodCards}</div>`
            : emptyState('Aucun solde disponible', 'Vos compteurs de congés payés ne sont pas encore initialisés.');
        const refreshedAt = String(data?.refreshed_at_label || '').trim();

        return `<section class="mobile-app-leave-balance-summary">
            <span>Solde disponible</span>
            <strong>${escapeHtml(formatLeaveDays(data?.total_available))}</strong>
        </section>
        ${body}
        <footer class="mobile-app-leave-balance-live">
            <span><i aria-hidden="true"></i>Mise à jour automatique</span>
            ${refreshedAt ? `<time>${escapeHtml(`Actualisé le ${refreshedAt}`)}</time>` : ''}
        </footer>`;
    }

    function stopLeaveBalancePolling() {
        if (state.leaveBalanceRefreshTimer !== null) {
            window.clearInterval(state.leaveBalanceRefreshTimer);
            state.leaveBalanceRefreshTimer = null;
        }
        state.leaveBalanceRefreshGeneration += 1;
        state.leaveBalanceRefreshInFlight = false;
    }

    async function refreshLeaveBalances(generation) {
        if (generation !== state.leaveBalanceRefreshGeneration
            || state.leaveBalanceRefreshInFlight
            || state.route !== 'leave_balances'
            || state.offline
            || document.hidden
            || app.querySelector('[data-mobile-system-overview]')) return;

        state.leaveBalanceRefreshInFlight = true;
        try {
            const response = await api(`/dossiers/${state.activeDossierId}/leave-balances`);
            const container = app.querySelector('[data-mobile-leave-balances]');
            if (container && generation === state.leaveBalanceRefreshGeneration && state.route === 'leave_balances') {
                container.innerHTML = leaveBalanceMarkup(response.data || {});
            }
        } catch (_) {
            // La prochaine actualisation reprendra automatiquement après un échec ponctuel.
        } finally {
            state.leaveBalanceRefreshInFlight = false;
        }
    }

    async function renderLeaveBalances() {
        const response = await api(`/dossiers/${state.activeDossierId}/leave-balances`);
        renderFrame('Solde CP', `<div data-mobile-leave-balances>${leaveBalanceMarkup(response.data || {})}</div>`, { tab: 'leave_balances' });
        const generation = ++state.leaveBalanceRefreshGeneration;
        state.leaveBalanceRefreshTimer = window.setInterval(
            () => refreshLeaveBalances(generation),
            leaveBalanceRefreshIntervalMs,
        );
    }

    function employeeDocumentMonth(item) {
        return ['period_end', 'document_date', 'period_start']
            .map((key) => String(item?.[key] || '').slice(0, 7))
            .find((value) => /^\d{4}-\d{2}$/.test(value)) || '';
    }

    function employeeDocumentDisplayLabel(item) {
        const label = String(item?.label || '').trim();
        if (String(item?.category || '') !== 'expense_report') return label || 'Document';
        return label.replace(/^notes?\s+de\s+frais(?:\s*[-–—:]\s*|\s+|$)/i, '').trim() || 'Document';
    }

    async function renderEmployeeDocuments(params = {}) {
        const response = await api(`/dossiers/${state.activeDossierId}/employee-documents?all=1`);
        const allItems = [...(response.data || [])].sort((left, right) => employeeDocumentMonth(right).localeCompare(employeeDocumentMonth(left)) || Number(right.id) - Number(left.id));
        const employees = [...new Map(allItems.map((item) => [Number(item.employee?.id) || 0, String(item.employee?.display_name || '')]).filter(([id]) => id > 0)).entries()]
            .sort((left, right) => left[1].localeCompare(right[1], 'fr', { sensitivity: 'base' }));
        const employeeId = employees.some(([id]) => id === Number(params.employeeId))
            ? Number(params.employeeId)
            : (employees.length === 1 ? employees[0][0] : 0);
        const employeeItems = employeeId > 0 ? allItems.filter((item) => Number(item.employee?.id) === employeeId) : allItems;
        const months = [...new Set(employeeItems.map(employeeDocumentMonth).filter(Boolean))].sort((left, right) => right.localeCompare(left));
        const month = months.includes(String(params.month))
            ? String(params.month)
            : (months.length === 1 ? months[0] : 'all');
        const items = month === 'all' ? employeeItems : employeeItems.filter((item) => employeeDocumentMonth(item) === month);
        const employeeOptions = `${employees.length === 1 ? '' : `<option value="0" ${employeeId === 0 ? 'selected' : ''}>Tous</option>`}${employees.map(([id, name]) => `<option value="${id}" ${employeeId === id ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}`;
        const monthOptions = `${months.length === 1 ? '' : `<option value="all" ${month === 'all' ? 'selected' : ''}>Tous les mois</option>`}${months.map((value) => `<option value="${value}" ${month === value ? 'selected' : ''}>${escapeHtml(formatPayslipMonth(value))}</option>`).join('')}`;
        const filters = `<div class="mobile-app-form-panel mobile-app-hr-list-filters"><div class="mobile-app-field"><label for="mobile-employee-document-employee">Salarié</label><select id="mobile-employee-document-employee" data-mobile-employee-document-filter="employee" data-mobile-select-menu-min-width="240">${employeeOptions}</select></div><div class="mobile-app-field"><label for="mobile-employee-document-month">Mois</label><select id="mobile-employee-document-month" data-mobile-employee-document-filter="month">${monthOptions}</select></div></div>`;
        const list = items.length ? `<div class="mobile-app-list">${items.map((item) => `<article class="mobile-app-list-item"><button class="mobile-app-list-button" type="button" data-open-binary="${escapeHtml(item.download_url || item.content_url)}"><h3>${escapeHtml(employeeDocumentDisplayLabel(item))}</h3></button></article>`).join('')}</div>` : emptyState('Aucun autre document', 'Aucun autre document ne correspond aux filtres sélectionnés.');
        state.routeParams = { employeeId, month };
        persistNavigation();
        renderFrame('Autres documents', `${filters}${list}`, { tab: 'hr' });
    }

    function mobileValidationSectionTitle(count) {
        return `<div class="mobile-app-validation-section-title"><h2>À valider</h2><span>${count} ${count === 1 ? 'demande' : 'demandes'}</span></div>`;
    }

    function mobileValidationActions(kind, item) {
        const label = kind === 'absence' ? 'la demande d’absence' : 'la note de frais';
        const approve = item.can_approve
            ? `<button class="mobile-app-icon-button is-approve" type="button" data-hr-transition="approve" data-hr-kind="${kind}" data-hr-id="${Number(item.id)}" data-hr-lock-version="${Number(item.lock_version) || 0}" aria-label="Valider ${label}" title="Valider" ${state.readOnly ? 'disabled' : ''}>${quickActionIcons.approve}</button>`
            : '';
        const reject = item.can_reject
            ? `<button class="mobile-app-icon-button is-reject" type="button" data-hr-reject="${kind}" data-hr-id="${Number(item.id)}" data-hr-lock-version="${Number(item.lock_version) || 0}" aria-label="Refuser ${label}" title="Refuser" ${state.readOnly ? 'disabled' : ''}>${quickActionIcons.reject}</button>`
            : '';
        return `<span class="mobile-app-validation-actions">
            ${approve}${reject}
        </span>`;
    }

    function mobileDetailValidationActions(kind, item) {
        if (String(item.status) !== 'submitted' || (!item.can_approve && !item.can_reject)) return '';
        const reject = item.can_reject
            ? `<button class="mobile-app-secondary-button" type="button" data-hr-reject="${kind}" data-hr-id="${Number(item.id)}" data-hr-lock-version="${Number(item.lock_version) || 0}" ${state.readOnly ? 'disabled' : ''}>Refuser</button>`
            : '';
        const approve = item.can_approve
            ? `<button class="mobile-app-primary-button" type="button" data-hr-transition="approve" data-hr-kind="${kind}" data-hr-id="${Number(item.id)}" data-hr-lock-version="${Number(item.lock_version) || 0}" ${state.readOnly ? 'disabled' : ''}>${quickActionIcons.approve}<span>Valider</span></button>`
            : '';
        return `<div class="mobile-app-detail-validation-actions">${reject}${approve}</div>`;
    }

    function mobileAbsenceItemMarkup(item, canValidate = false) {
        const title = [item.employee?.display_name, item.leave_type?.label || 'Absence'].filter(Boolean).join(' - ');
        const detail = `${formatCivilDate(item.starts_on)} - ${formatCivilDate(item.ends_on)} - ${item.status_label || humanStatus(item.status)}`;
        const cancelAction = !canValidate && item.can_withdraw && item.status === 'submitted'
            ? `<button class="mobile-app-icon-button mobile-app-absence-cancel" type="button" data-hr-transition="withdraw" data-hr-kind="absence" data-hr-id="${Number(item.id)}" data-hr-lock-version="${Number(item.lock_version) || 0}" aria-label="Annuler la demande" title="Annuler la demande" ${state.readOnly ? 'disabled' : ''}>${quickActionIcons.reject}</button>`
            : '';
        if (canValidate) {
            return `<article class="mobile-app-list-item mobile-app-list-button mobile-app-two-line-item" role="button" tabindex="0" data-absence-detail="${Number(item.id)}">
                <div class="mobile-app-list-item__top"><h3>${escapeHtml(title)}</h3>${mobileValidationActions('absence', item)}</div>
                <p>${escapeHtml(detail)}</p>
            </article>`;
        }

        return `<article class="mobile-app-list-item mobile-app-list-button mobile-app-two-line-item mobile-app-absence-item${cancelAction ? ' is-withdrawable' : ''}" role="button" tabindex="0" data-absence-detail="${Number(item.id)}">
            <div class="mobile-app-absence-item__text"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p></div>${cancelAction}
        </article>`;
    }

    function mobileAbsenceQuantityLabel(value, unit) {
        const amount = Number(value);
        const rendered = Number.isFinite(amount) ? leaveDayFormatter.format(amount) : String(value || '');
        const singular = Math.abs(amount) === 1;
        const unitLabel = ({
            working_days: singular ? 'jour ouvré' : 'jours ouvrés',
            business_days: singular ? 'jour ouvrable' : 'jours ouvrables',
            calendar_days: singular ? 'jour calendaire' : 'jours calendaires',
            hours: singular ? 'heure' : 'heures',
            months: 'mois',
        })[String(unit || '')] || String(unit || '');
        return [rendered, unitLabel].filter(Boolean).join(' ');
    }

    async function openAbsenceDetail(absenceId) {
        const response = await api(`/dossiers/${state.activeDossierId}/absences/${Number(absenceId)}`);
        const absence = response.data || {};
        const title = [absence.employee?.display_name, absence.leave_type?.label || 'Absence'].filter(Boolean).join(' - ');
        const comments = [
            absence.employee_comment ? `<div class="mobile-app-detail-line"><small>Commentaire</small><p>${escapeHtml(absence.employee_comment)}</p></div>` : '',
            absence.rejection_comment ? `<div class="mobile-app-detail-line"><small>Motif du refus</small><p>${escapeHtml(absence.rejection_comment)}</p></div>` : '',
        ].join('');
        const attachment = absence.has_attachment ? '<p class="mobile-app-detail-emphasis">Justificatif joint</p>' : '';
        app.querySelector('[data-absence-detail-dialog]')?.remove();
        app.insertAdjacentHTML('beforeend', `<div class="mobile-app-dialog-backdrop" data-absence-detail-dialog role="presentation"><section class="mobile-app-quick-actions-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-absence-detail-title"><header><h3 id="mobile-absence-detail-title">Détail de l’absence</h3><button type="button" data-absence-detail-close aria-label="Fermer">×</button></header><div class="mobile-app-quick-actions-dialog__body"><strong>${escapeHtml(title)}</strong><div class="mobile-app-detail-line"><small>Période</small><p>${formatCivilDate(absence.starts_on)} - ${formatCivilDate(absence.ends_on)}</p></div><div class="mobile-app-detail-line"><small>Quantité demandée</small><p>${escapeHtml(mobileAbsenceQuantityLabel(absence.requested_quantity, absence.unit))}</p></div><div class="mobile-app-detail-line"><small>Statut</small><p>${escapeHtml(absence.status_label || humanStatus(absence.status))}</p></div>${comments}${attachment}${mobileDetailValidationActions('absence', absence)}</div></section></div>`);
    }

    function openHrRejectionDialog(kind, itemId, lockVersion) {
        const expense = kind === 'expense';
        app.querySelector('[data-hr-reject-dialog]')?.remove();
        app.insertAdjacentHTML('beforeend', `<div class="mobile-app-dialog-backdrop" data-hr-reject-dialog role="presentation"><section class="mobile-app-quick-actions-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-hr-reject-title"><header><h3 id="mobile-hr-reject-title">${expense ? 'Refuser la note de frais' : 'Refuser la demande'}</h3><button type="button" data-hr-reject-close aria-label="Fermer">×</button></header><div class="mobile-app-quick-actions-dialog__body"><div class="mobile-app-field"><label for="mobile-hr-reject-reason">Motif du refus</label><textarea id="mobile-hr-reject-reason" maxlength="2000" rows="4" data-hr-reject-reason></textarea></div><button class="mobile-app-primary-button" type="button" data-hr-reject-confirm data-hr-kind="${expense ? 'expense' : 'absence'}" data-hr-id="${Number(itemId)}" data-hr-lock-version="${Number(lockVersion) || 0}" disabled>Confirmer le refus</button></div></section></div>`);
        window.requestAnimationFrame(() => app.querySelector('[data-hr-reject-reason]')?.focus({ preventScroll: true }));
    }

    async function renderAbsences(params = {}) {
        const currentYear = String(new Date().getFullYear());
        const year = String(params.year || currentYear) === 'all' ? 'all' : (/^\d{4}$/.test(String(params.year || '')) ? String(params.year) : currentYear);
        const requestedEmployeeId = Math.max(0, Number(params.employeeId) || 0);
        const query = new URLSearchParams({ per_page: '50', ...(year !== 'all' ? { year } : {}), ...(requestedEmployeeId > 0 ? { employee_id: String(requestedEmployeeId) } : {}) });
        const pendingQuery = new URLSearchParams({ status: 'submitted', approval_scope: '1', per_page: '50', ...(year !== 'all' ? { year } : {}), ...(requestedEmployeeId > 0 ? { employee_id: String(requestedEmployeeId) } : {}) });
        const [absenceResponse, pendingResponse, contextResponse] = await Promise.all([
            api(`/dossiers/${state.activeDossierId}/absences?${query}`),
            can('absences.approve')
                ? api(`/dossiers/${state.activeDossierId}/absences?${pendingQuery}`).catch(() => ({ data: [] }))
                : Promise.resolve({ data: [] }),
            api(`/dossiers/${state.activeDossierId}/hr/context?employee_id=${requestedEmployeeId}`),
        ]);
        const context = contextResponse.data || {};
        const employees = Array.isArray(context.employees) ? context.employees : [];
        const employeeId = context.mode === 'employee'
            ? Math.max(0, Number(context.selected_employee_id) || 0)
            : (employees.some((employee) => Number(employee.id) === requestedEmployeeId)
                ? requestedEmployeeId
                : (employees.length === 1 ? Number(employees[0].id) : 0));
        const employeeOptions = `${context.mode === 'validator' && employees.length !== 1 ? `<option value="0" ${employeeId === 0 ? 'selected' : ''}>Tous</option>` : ''}${employees.map((employee) => `<option value="${Number(employee.id)}" ${employeeId === Number(employee.id) ? 'selected' : ''}>${escapeHtml(employee.display_name)}</option>`).join('')}`;
        const years = ['all', ...Array.from({ length: 6 }, (_, index) => String(Number(currentYear) - index))];
        const filters = `<div class="mobile-app-form-panel mobile-app-hr-list-filters"><div class="mobile-app-field"><label for="mobile-absence-employee">Salarié</label><select id="mobile-absence-employee" data-mobile-absence-filter="employee" data-mobile-select-menu-min-width="240">${employeeOptions}</select></div><div class="mobile-app-field"><label for="mobile-absence-year">Année</label><select id="mobile-absence-year" data-mobile-absence-filter="year">${years.map((value) => `<option value="${value}" ${year === value ? 'selected' : ''}>${value === 'all' ? 'Toutes les années' : value}</option>`).join('')}</select></div></div>`;
        const balance = context.paid_leave_balance;
        const availableDays = Number(balance?.available) || 0;
        const balanceContent = `<span>Solde CP</span><strong>${balance?.initialized && balance.available !== null ? `${escapeHtml(formatLeaveDays(balance.available))} ${Math.abs(availableDays) === 1 ? 'disponible' : 'disponibles'}` : 'Non initialisé'}</strong>`;
        const balanceMarkup = balance
            ? (isSalariedUser() && can('leave_balances.view_own')
                ? `<button class="mobile-app-compact-summary mobile-app-absence-balance is-action" type="button" data-mobile-route="leave_balances" aria-label="Consulter le solde CP">${balanceContent}</button>`
                : `<section class="mobile-app-compact-summary mobile-app-absence-balance">${balanceContent}</section>`)
            : '';
        const canValidate = can('absences.approve');
        const pendingItems = canValidate ? (pendingResponse.data || []).filter((item) => String(item.status) === 'submitted') : [];
        const pendingIds = new Set(pendingItems.map((item) => Number(item.id)));
        const items = (absenceResponse.data || []).filter((item) => String(item.status) !== 'cancelled' && !pendingIds.has(Number(item.id)));
        const pendingList = pendingItems.length ? `${mobileValidationSectionTitle(pendingItems.length)}<div class="mobile-app-list mobile-app-two-line-list mobile-app-validation-list">${pendingItems.map((item) => mobileAbsenceItemMarkup(item, true)).join('')}</div>` : '';
        const historyTitle = pendingItems.length && items.length ? '<div class="mobile-app-section-title mobile-app-validation-history-title"><h2>Historique</h2></div>' : '';
        const list = items.length ? `${historyTitle}<div class="mobile-app-list mobile-app-two-line-list">${items.map((item) => mobileAbsenceItemMarkup(item)).join('')}</div>` : (pendingItems.length ? '' : emptyState('Aucune absence', 'Aucune demande d’absence ne correspond aux filtres sélectionnés.'));
        const canCreate = can('absences.create') || can('absences.approve');
        const actions = canCreate ? `<button class="mobile-app-primary-button mb-3" type="button" data-mobile-absence-create data-employee-id="${employeeId}" data-year="${escapeHtml(year)}" ${state.readOnly ? 'disabled' : ''}>Poser une absence</button>` : '';
        const absenceId = Math.max(0, Number(params.absenceId) || 0);
        state.routeParams = { employeeId, year, ...(absenceId > 0 ? { absenceId } : {}) };
        persistNavigation();
        renderFrame('Absences', `${actions}${filters}${balanceMarkup}${pendingList}${list}`, { tab: employeeModuleTab('absences') });
        if (absenceId > 0) window.requestAnimationFrame(async () => {
            const target = app.querySelector(`[data-absence-detail="${absenceId}"]`);
            target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target?.focus({ preventScroll: true });
            if (target) {
                try { await openAbsenceDetail(absenceId); }
                catch (error) { renderError(error, 'absences'); }
            }
        });
    }

    function mobileAbsenceBalance(context, employeeId, counter) {
        return context?.leave_balances_by_employee?.[String(Number(employeeId) || 0)]?.[String(counter || '').toUpperCase()] || null;
    }

    function mobileAbsenceBalanceLabel(balance) {
        if (!balance?.initialized || balance.available === null || balance.available === undefined || balance.available === '') {
            return 'non initialisé';
        }
        const amount = Number(balance.available);
        if (!Number.isFinite(amount)) return 'non initialisé';
        return `${leaveDayFormatter.format(amount)} ${Math.abs(amount) === 1 ? 'jour' : 'jours'}`;
    }

    function mobileAbsenceTypeLabel(context, type, employeeId) {
        const label = String(type?.label || 'Absence');
        const counter = String(type?.counter_type || '').toUpperCase();
        if (!['CP', 'RTT', 'JNT'].includes(counter)) {
            const duration = String(type?.duration_limit_label || '').trim();
            return duration ? `${label} - ${duration}` : label;
        }
        return `${label} - solde : ${mobileAbsenceBalanceLabel(mobileAbsenceBalance(context, employeeId, counter))}`;
    }

    function mobileAbsenceEmployeeBalanceAttributes(context, employeeId) {
        return ['CP', 'RTT', 'JNT'].map((counter) => {
            const balance = mobileAbsenceBalance(context, employeeId, counter);
            const key = counter.toLowerCase();
            return `data-mobile-absence-balance-${key}-initialized="${balance?.initialized ? '1' : '0'}" data-mobile-absence-balance-${key}-available="${escapeHtml(balance?.available ?? '')}"`;
        }).join(' ');
    }

    function mobileAbsenceSelectedEmployeeControl(form) {
        const control = form?.elements?.namedItem('payroll_employee_id');
        if (control instanceof HTMLSelectElement) return control.selectedOptions[0] || null;
        return control instanceof HTMLInputElement ? control : null;
    }

    function syncMobileAbsenceTypeLabels(form) {
        if (!(form instanceof HTMLFormElement)) return;
        const employee = mobileAbsenceSelectedEmployeeControl(form);
        const select = form.elements.namedItem('payroll_leave_type_id');
        if (!(select instanceof HTMLSelectElement)) return;
        Array.from(select.options).forEach((option) => {
            const label = String(option.dataset.mobileAbsenceTypeLabel || option.textContent || 'Absence');
            const counter = String(option.dataset.mobileAbsenceCounter || '').toUpperCase();
            if (!['CP', 'RTT', 'JNT'].includes(counter)) {
                const duration = String(option.dataset.mobileAbsenceDurationLabel || '').trim();
                option.hidden = false;
                option.disabled = false;
                option.textContent = duration ? `${label} - ${duration}` : label;
                return;
            }
            const key = counter.toLowerCase();
            const initialized = employee?.getAttribute(`data-mobile-absence-balance-${key}-initialized`) === '1';
            const available = employee?.getAttribute(`data-mobile-absence-balance-${key}-available`);
            const hiddenBecauseUninitialized = ['RTT', 'JNT'].includes(counter) && !initialized;
            option.hidden = hiddenBecauseUninitialized;
            option.disabled = hiddenBecauseUninitialized;
            option.textContent = `${label} - solde : ${mobileAbsenceBalanceLabel({ initialized, available })}`;
        });
        if (select.selectedOptions[0]?.hidden || select.selectedOptions[0]?.disabled) {
            const firstAvailable = Array.from(select.options).find((option) => !option.hidden && !option.disabled);
            select.value = firstAvailable?.value || '';
        }
        if (activeMobileSelect?.select === select) closeMobileSelect();
        refreshMobileSelect(select);
    }

    function mobileAbsenceErrorMessage(error, fallback = 'La demande d’absence n’a pas pu être transmise.') {
        const fieldMessage = Object.values(error?.fields || {})
            .flatMap((messages) => Array.isArray(messages) ? messages : [messages])
            .map((message) => String(message || '').trim())
            .find(Boolean);
        return fieldMessage || String(error?.message || '').trim() || fallback;
    }

    function setMobileAbsenceFormError(form, message = '') {
        const feedback = form?.querySelector('[data-mobile-absence-form-error]');
        if (!feedback) return;
        feedback.textContent = String(message || '');
        feedback.hidden = feedback.textContent === '';
    }

    function scheduleMobileAbsencePreview(form, { immediate = false } = {}) {
        if (!(form instanceof HTMLFormElement)) return;
        window.clearTimeout(absencePreviewTimers.get(form));
        absencePreviewRequests.get(form)?.abort();
        const sequence = (absencePreviewSequences.get(form) || 0) + 1;
        absencePreviewSequences.set(form, sequence);
        syncMobileAbsenceTypeLabels(form);

        const employeeId = Number(form.elements.namedItem('payroll_employee_id')?.value) || 0;
        const leaveTypeId = Number(form.elements.namedItem('payroll_leave_type_id')?.value) || 0;
        const startsOn = String(form.elements.namedItem('starts_on')?.value || '');
        const endsOn = String(form.elements.namedItem('ends_on')?.value || '');
        const startSegment = String(form.elements.namedItem('start_segment')?.value || 'am');
        const endSegment = String(form.elements.namedItem('end_segment')?.value || 'pm');
        const count = form.querySelector('[data-mobile-absence-count-label]');
        const detail = form.querySelector('[data-mobile-absence-count-detail]');
        const button = form.querySelector('[data-mobile-absence-submit]');
        form.dataset.mobileAbsenceCanSubmit = '0';
        if (button instanceof HTMLButtonElement) button.disabled = true;
        setMobileAbsenceFormError(form);

        const validDates = /^\d{4}-\d{2}-\d{2}$/.test(startsOn)
            && /^\d{4}-\d{2}-\d{2}$/.test(endsOn)
            && endsOn >= startsOn;
        const validSegmentOrder = startsOn !== endsOn || startSegment !== 'pm' || endSegment !== 'am';
        if (employeeId < 1 || leaveTypeId < 1 || !validDates || !validSegmentOrder) {
            if (count) count.textContent = 'Sélectionnez une période valide pour calculer les journées nécessaires.';
            if (detail) detail.hidden = true;
            if (startsOn && endsOn && endsOn < startsOn) {
                setMobileAbsenceFormError(form, 'La date de fin doit être postérieure ou égale à la date de début.');
            } else if (!validSegmentOrder) {
                setMobileAbsenceFormError(form, 'Pour une seule date, la fin ne peut pas précéder le début.');
            }
            return;
        }

        if (count) count.textContent = 'Calcul des journées nécessaires…';
        if (detail) detail.hidden = true;
        const timer = window.setTimeout(async () => {
            const controller = new AbortController();
            absencePreviewRequests.set(form, controller);
            const query = new URLSearchParams({
                payroll_employee_id: String(employeeId),
                payroll_leave_type_id: String(leaveTypeId),
                starts_on: startsOn,
                ends_on: endsOn,
                start_segment: startSegment,
                end_segment: endSegment,
            });
            try {
                const response = await api(`/dossiers/${state.activeDossierId}/absences/preview?${query}`, { signal: controller.signal });
                if (!form.isConnected || absencePreviewSequences.get(form) !== sequence) return;
                const preview = response.data || {};
                const quantity = Number(preview.quantity) || 0;
                if (count) count.textContent = String(preview.quantity_label || `${leaveDayFormatter.format(quantity)} ${Math.abs(quantity) === 1 ? 'journée nécessaire' : 'journées nécessaires'}`);
                if (detail) {
                    detail.textContent = String(preview.detail_label || '');
                    detail.hidden = detail.textContent === '';
                }
                setMobileAbsenceFormError(form, preview.blocking_message || '');
                const canSubmit = preview.can_submit === true && !state.readOnly;
                form.dataset.mobileAbsenceCanSubmit = canSubmit ? '1' : '0';
                if (button instanceof HTMLButtonElement) button.disabled = !canSubmit;
            } catch (error) {
                if (error?.name === 'AbortError' || !form.isConnected || absencePreviewSequences.get(form) !== sequence) return;
                if (count) count.textContent = 'Calcul des journées nécessaires indisponible.';
                if (detail) detail.hidden = true;
                setMobileAbsenceFormError(form, mobileAbsenceErrorMessage(error, 'Le décompte des journées n’a pas pu être calculé.'));
            } finally {
                if (absencePreviewRequests.get(form) === controller) absencePreviewRequests.delete(form);
            }
        }, immediate ? 0 : 220);
        absencePreviewTimers.set(form, timer);
    }

    function mobileAbsenceFormMarkup(context, selectedEmployeeId, { origin = '' } = {}) {
        const employees = Array.isArray(context.employees) ? context.employees : [];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const employeeSelector = context.mode === 'validator'
            ? `<div class="mobile-app-field"><label>Salarié</label><select name="payroll_employee_id" required>${employees.map((employee) => `<option value="${employee.id}" ${mobileAbsenceEmployeeBalanceAttributes(context, employee.id)} ${selectedEmployeeId === Number(employee.id) ? 'selected' : ''}>${escapeHtml(employee.display_name)}</option>`).join('')}</select></div>`
            : `<input type="hidden" name="payroll_employee_id" value="${selectedEmployeeId}" ${mobileAbsenceEmployeeBalanceAttributes(context, selectedEmployeeId)}>`;
        const leaveTypes = Array.isArray(context.leave_types) ? context.leave_types : [];
        const leaveTypeOptions = leaveTypes.map((type) => `<option value="${type.id}" data-mobile-absence-type-label="${escapeHtml(type.label)}" data-mobile-absence-counter="${escapeHtml(String(type.counter_type || '').toUpperCase())}" data-mobile-absence-duration-label="${escapeHtml(type.duration_limit_label || '')}">${escapeHtml(mobileAbsenceTypeLabel(context, type, selectedEmployeeId))}</option>`).join('');
        return `<form class="mobile-app-form-panel" data-mobile-form="absence" data-mobile-absence-can-submit="0" ${origin ? `data-mobile-quick-origin="${escapeHtml(origin)}"` : ''}>
            ${employeeSelector}
            <div class="mobile-app-field"><label>Type d’absence</label><select name="payroll_leave_type_id" data-mobile-select-searchable="1" data-mobile-select-search-placeholder="Rechercher un type d’absence" required>${leaveTypeOptions}</select></div>
            <div class="mobile-app-form-row">
                <div class="mobile-app-field"><label>Début</label><input type="date" lang="fr" name="starts_on" value="${tomorrow}" required></div>
                <div class="mobile-app-field"><label>Départ</label><select name="start_segment" aria-label="Départ"><option value="am" selected>Matin</option><option value="pm">Après-midi</option></select></div>
            </div>
            <div class="mobile-app-form-row">
                <div class="mobile-app-field"><label>Fin</label><input type="date" lang="fr" name="ends_on" value="${tomorrow}" required></div>
                <div class="mobile-app-field"><label>Retour</label><select name="end_segment" aria-label="Retour"><option value="am">Matin</option><option value="pm" selected>Après-midi</option></select></div>
            </div>
            <div class="mobile-app-field"><label>Commentaire (facultatif)</label><textarea name="employee_comment" maxlength="600"></textarea></div>
            <div class="mobile-app-absence-count" aria-live="polite"><span data-mobile-absence-count-label>Calcul des journées nécessaires…</span><small data-mobile-absence-count-detail hidden></small></div>
            <p class="mobile-app-form-error" data-mobile-absence-form-error role="alert" hidden></p>
            <input type="hidden" name="submit" value="1">
            ${writeButton('Transmettre la demande', 'data-mobile-absence-submit disabled')}
        </form>`;
    }

    async function absenceCreationContext(params = {}) {
        const requestedEmployeeId = Math.max(0, Number(params.employeeId) || 0);
        const response = await api(`/dossiers/${state.activeDossierId}/hr/context?employee_id=${requestedEmployeeId}`);
        const context = response.data || {};
        const employees = Array.isArray(context.employees) ? context.employees : [];
        const selectedEmployeeId = employees.some((employee) => Number(employee.id) === requestedEmployeeId)
            ? requestedEmployeeId
            : Math.max(0, Number(context.selected_employee_id) || Number(employees[0]?.id) || 0);
        return { context, selectedEmployeeId };
    }

    async function renderAbsenceForm(params = {}) {
        const { context, selectedEmployeeId } = await absenceCreationContext(params);
        renderFrame('Nouvelle absence', mobileAbsenceFormMarkup(context, selectedEmployeeId), { tab: 'hr' });
        scheduleMobileAbsencePreview(app.querySelector('[data-mobile-form="absence"]'), { immediate: true });
    }

    async function openQuickAbsenceCreation(params = {}, origin = 'home') {
        const { context, selectedEmployeeId } = await absenceCreationContext(params);
        openQuickCreationDialog('absence', 'Nouvelle absence', mobileAbsenceFormMarkup(context, selectedEmployeeId, { origin }));
        scheduleMobileAbsencePreview(app.querySelector('[data-mobile-quick-creation="absence"] [data-mobile-form="absence"]'), { immediate: true });
        window.requestAnimationFrame(() => {
            const dialog = app.querySelector('[data-mobile-quick-creation="absence"]');
            dialog?.querySelector('select:not([type="hidden"]), input:not([type="hidden"]), textarea')?.focus({ preventScroll: true });
        });
    }

    const employeeModuleTab = (route) => isSalariedUser() ? route : 'hr';
    const successfulUpload = (contextType, contextId = null) => [...state.uploadFeedbacks].reverse().find((item) => item.status === 'success'
        && String(item.contextType || '') === String(contextType)
        && (contextId === null || Number(item.contextId) === Number(contextId))
        && Number(item.remoteDocumentId) > 0) || null;
    const contextualUpload = (contextType, contextId = null) => [...state.uploadFeedbacks].reverse().find((item) =>
        String(item.status || '') !== 'cancelled'
        && String(item.contextType || '') === String(contextType)
        && (contextId === null || Number(item.contextId) === Number(contextId))) || null;
    const dismissContextualUpload = (contextType, contextId = null) => {
        const upload = contextualUpload(contextType, contextId);
        if (upload?.id) dismissReturnedFileFeedback(String(upload.id));
    };

    function mobileExpenseItemMarkup(item, canValidate = false) {
        const cancelAction = !canValidate && item.can_cancel && item.status === 'submitted'
            ? `<button class="mobile-app-icon-button mobile-app-expense-cancel" type="button" data-expense-cancel="${Number(item.id)}" aria-label="Retirer la demande" title="Retirer la demande" ${state.readOnly ? 'disabled' : ''}>${quickActionIcons.delete}</button>`
            : '';
        const title = [item.employee?.display_name, item.title || item.reference].filter(Boolean).join(' - ');
        const detail = [item.expense_kind_label || 'Dépense', formatCivilDate(item.period_end), formatMoney(item.requested_total), item.status_label || humanStatus(item.status)].filter(Boolean).join(' - ');
        return `<article class="mobile-app-list-item mobile-app-list-button mobile-app-two-line-item" role="button" tabindex="0" data-expense-detail="${Number(item.id)}"><div class="mobile-app-list-item__top"><h3>${escapeHtml(title)}</h3>${canValidate ? mobileValidationActions('expense', item) : cancelAction}</div><p>${escapeHtml(detail)}</p></article>`;
    }

    async function renderExpenses(params = {}) {
        const currentYear = String(new Date().getFullYear());
        const year = String(params.year || currentYear) === 'all' ? 'all' : (/^\d{4}$/.test(String(params.year || '')) ? String(params.year) : currentYear);
        const requestedEmployeeId = Math.max(0, Number(params.employeeId) || 0);
        const query = new URLSearchParams({ status: 'all', per_page: '50', ...(year !== 'all' ? { year } : {}), ...(requestedEmployeeId > 0 ? { employee_id: String(requestedEmployeeId) } : {}) });
        const pendingQuery = new URLSearchParams({ status: 'submitted', approval_scope: '1', per_page: '50', ...(year !== 'all' ? { year } : {}), ...(requestedEmployeeId > 0 ? { employee_id: String(requestedEmployeeId) } : {}) });
        const [response, pendingResponse, contextResponse] = await Promise.all([
            api(`/dossiers/${state.activeDossierId}/expense-reports?${query}`),
            can('expenses.approve')
                ? api(`/dossiers/${state.activeDossierId}/expense-reports?${pendingQuery}`).catch(() => ({ data: [] }))
                : Promise.resolve({ data: [] }),
            api(`/dossiers/${state.activeDossierId}/hr/context?employee_id=${requestedEmployeeId}`),
        ]);
        const context = contextResponse.data || {};
        const employees = Array.isArray(context.employees) ? context.employees : [];
        const employeeId = context.mode === 'employee'
            ? Math.max(0, Number(context.selected_employee_id) || 0)
            : (employees.some((employee) => Number(employee.id) === requestedEmployeeId)
                ? requestedEmployeeId
                : (employees.length === 1 ? Number(employees[0].id) : 0));
        const canValidate = can('expenses.approve');
        const pendingItems = canValidate ? (pendingResponse.data || []).filter((item) => String(item.status) === 'submitted') : [];
        const pendingIds = new Set(pendingItems.map((item) => Number(item.id)));
        const items = (response.data || []).filter((item) => !pendingIds.has(Number(item.id)));
        const yearChoices = ['all', ...Array.from({ length: 6 }, (_, index) => String(Number(currentYear) - index))];
        const employeeOptions = `${context.mode === 'validator' && employees.length !== 1 ? `<option value="0" ${employeeId === 0 ? 'selected' : ''}>Tous</option>` : ''}${employees.map((employee) => `<option value="${Number(employee.id)}" ${employeeId === Number(employee.id) ? 'selected' : ''}>${escapeHtml(employee.display_name)}</option>`).join('')}`;
        const filters = `<div class="mobile-app-form-panel mobile-app-hr-list-filters"><div class="mobile-app-field"><label for="mobile-expense-employee">Salarié</label><select id="mobile-expense-employee" data-mobile-expense-filter="employee" data-mobile-select-menu-min-width="240">${employeeOptions}</select></div><div class="mobile-app-field"><label for="mobile-expense-year">Année</label><select id="mobile-expense-year" data-mobile-expense-filter="year">${yearChoices.map((value) => `<option value="${value}" ${year === value ? 'selected' : ''}>${value === 'all' ? 'Toutes les années' : value}</option>`).join('')}</select></div></div>`;
        const actions = can('expenses.create') ? `<div class="mobile-app-module-actions is-single"><button class="mobile-app-primary-button" type="button" data-mobile-route="expense_create" ${state.readOnly ? 'disabled' : ''}>Demander un remboursement de frais</button></div>` : '';
        const pendingList = pendingItems.length ? `${mobileValidationSectionTitle(pendingItems.length)}<div class="mobile-app-list mobile-app-validation-list">${pendingItems.map((item) => mobileExpenseItemMarkup(item, true)).join('')}</div>` : '';
        const historyTitle = pendingItems.length && items.length ? '<div class="mobile-app-section-title mobile-app-validation-history-title"><h2>Historique</h2></div>' : '';
        const list = items.length ? `${historyTitle}<div class="mobile-app-list">${items.map((item) => mobileExpenseItemMarkup(item)).join('')}</div>` : (pendingItems.length ? '' : emptyState('Aucune note de frais', 'Aucune note ne correspond à ces filtres.'));
        const reportId = Math.max(0, Number(params.reportId) || 0);
        state.routeParams = { employeeId, year, ...(reportId > 0 ? { reportId } : {}) };
        persistNavigation();
        renderFrame('Notes de frais', `${actions}${filters}${pendingList}${list}`, { tab: employeeModuleTab('expenses') });
        if (reportId > 0) window.requestAnimationFrame(async () => {
            const target = app.querySelector(`[data-expense-detail="${reportId}"]`);
            target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target?.focus({ preventScroll: true });
            if (target) {
                try { await openExpenseDetail(reportId); }
                catch (error) { renderError(error, 'expenses'); }
            }
        });
    }

    function closeExpenseDetailDialog() {
        const dialog = app.querySelector('[data-expense-detail-dialog]');
        dialog?.querySelectorAll('[data-mobile-expense-thumbnail-object-url]').forEach((image) => {
            URL.revokeObjectURL(image.dataset.mobileExpenseThumbnailObjectUrl || '');
        });
        dialog?.remove();
    }

    async function hydrateExpenseReceiptThumbnails(dialog) {
        await Promise.allSettled(Array.from(dialog?.querySelectorAll('[data-mobile-expense-receipt-thumbnail]') || []).map(async (image) => {
            const url = image.dataset.mobileExpenseReceiptThumbnail;
            if (!url) return;
            const { blob } = await api(url, { binary: true });
            if (!dialog.isConnected) return;
            const objectUrl = URL.createObjectURL(blob);
            image.src = objectUrl;
            image.dataset.mobileExpenseThumbnailObjectUrl = objectUrl;
            image.hidden = false;
            const placeholder = image.parentElement?.querySelector('[data-mobile-expense-receipt-placeholder]');
            if (placeholder) placeholder.hidden = true;
        }));
    }

    async function openExpenseDetail(reportId) {
        const response = await api(`/dossiers/${state.activeDossierId}/expense-reports/${Number(reportId)}`);
        const report = response.data || {};
        const items = Array.isArray(report.items) ? report.items : [];
        const title = String(report.title || report.reference || 'Note de frais');
        const isMileage = report.expense_kind === 'mileage';
        const itemMarkup = items.length ? items.map((item) => {
            const purpose = String(item.business_purpose || 'Dépense');
            const showPurpose = items.length > 1 || purpose.localeCompare(title, 'fr', { sensitivity: 'base' }) !== 0;
            const showSummary = items.length > 1 || String(item.expense_date || '') !== String(report.period_end || '') || Number(item.amount_including_tax) !== Number(report.requested_total);
            const vat = item.vat_amount !== null && item.vat_amount !== undefined && String(item.vat_amount) !== ''
                ? `<small>TVA - ${formatMoney(item.vat_amount)}</small>`
                : '';
            const comment = item.comment ? `<small>${escapeHtml(item.comment)}</small>` : '';
            const receipt = item.has_receipt
                ? `<button class="mobile-app-expense-receipt" type="button" data-open-binary="${escapeHtml(item.receipt_url || '')}" data-open-binary-title="${escapeHtml(item.receipt_filename || 'Justificatif')}"><span class="mobile-app-expense-receipt__preview"><img data-mobile-expense-receipt-thumbnail="${escapeHtml(item.receipt_thumbnail_url || '')}" alt="Aperçu du justificatif" hidden><span data-mobile-expense-receipt-placeholder>${quickActionIcons.file}</span></span><span class="mobile-app-expense-receipt__copy"><strong>${escapeHtml(item.receipt_filename || 'Justificatif')}</strong><small>Toucher pour ouvrir</small></span>${quickActionIcons.open}</button>`
                : (isMileage
                    ? `<small>${escapeHtml(item.receipt_missing_reason || 'Carte grise enregistrée dans la situation du salarié.')}</small>`
                    : `<small>Justificatif absent - ${escapeHtml(item.receipt_missing_reason || 'motif non renseigné')}</small>`);
            return `<article class="mobile-app-list-item mobile-app-expense-detail-item">${showPurpose ? `<strong>${escapeHtml(purpose)}</strong>` : ''}${showSummary ? `<p>${formatCivilDate(item.expense_date)} - ${formatMoney(item.amount_including_tax)}</p>` : ''}${vat}${comment}${receipt}</article>`;
        }).join('') : '<p class="mobile-app-quick-actions-dialog__empty">Aucune dépense dans cette note.</p>';
        const heading = [report.employee?.display_name, title].filter(Boolean).join(' - ');
        closeExpenseDetailDialog();
        app.insertAdjacentHTML('beforeend', `<div class="mobile-app-dialog-backdrop" data-expense-detail-dialog role="presentation"><section class="mobile-app-quick-actions-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-expense-detail-title"><header><h3 id="mobile-expense-detail-title">${isMileage ? 'Détail des voyages' : 'Détail de la note'}</h3><button type="button" data-expense-detail-close aria-label="Fermer">×</button></header><div class="mobile-app-quick-actions-dialog__body"><strong>${escapeHtml(heading)}</strong><p>${formatCivilDate(report.period_end)} - ${escapeHtml(report.status_label || humanStatus(report.status))}</p><div class="mobile-app-settings-message is-success">Total demandé - ${formatMoney(report.requested_total)}</div><div class="mobile-app-list">${itemMarkup}</div>${mobileDetailValidationActions('expense', report)}</div></section></div>`);
        hydrateExpenseReceiptThumbnails(app.querySelector('[data-expense-detail-dialog]'));
    }

    function openExpenseCancelDialog(reportId) {
        app.querySelector('[data-expense-cancel-dialog]')?.remove();
        app.insertAdjacentHTML('beforeend', `<div class="mobile-app-dialog-backdrop" data-expense-cancel-dialog="${Number(reportId)}" role="presentation"><section class="mobile-app-quick-actions-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-expense-cancel-title"><header><h3 id="mobile-expense-cancel-title">Retirer la demande</h3><button type="button" data-expense-cancel-close aria-label="Fermer">×</button></header><div class="mobile-app-quick-actions-dialog__body"><p>Cette demande n’a pas encore été validée. Elle sera retirée du circuit de validation.</p><button class="mobile-app-primary-button is-danger" type="button" data-expense-cancel-confirm="${Number(reportId)}">${quickActionIcons.delete}<span>Supprimer la demande</span></button></div></section></div>`);
    }

    async function renderExpenseForm(params = {}) {
        const reportId = Number(params.reportId) || 0;
        if (!reportId) {
            renderFrame('Dépôt du justificatif', '<div class="mobile-app-loading"><span>Préparation de la demande…</span></div>', { tab: employeeModuleTab('expenses') });
            try {
                const report = await createExpenseDraft();
                if (state.route !== 'expense_create') {
                    await api(`/dossiers/${state.activeDossierId}/expense-reports/${Number(report.id) || 0}`, { method: 'DELETE' }).catch(() => {});
                    return;
                }
                await navigate('expense_item_create', {
                    reportId: Number(report.id) || 0,
                    lockVersion: Number(report.lock_version) || 0,
                    step: 'receipt',
                }, false);
            } catch (error) {
                renderError(error, 'expense_create');
            }
            return;
        }
        const report = reportId
            ? (await api(`/dossiers/${state.activeDossierId}/expense-reports/${reportId}`)).data || {}
            : null;
        await navigate('expense_item_create', {
            reportId: Number(report.id) || 0,
            lockVersion: Number(report.lock_version) || 0,
            step: 'detail',
        }, false);
    }

    function openQuickCreationDialog(kind, title, content) {
        app.querySelector('[data-mobile-quick-creation]')?.remove();
        app.insertAdjacentHTML('beforeend', `<div class="mobile-app-dialog-backdrop mobile-app-dialog-backdrop--creation" data-mobile-quick-creation="${escapeHtml(kind)}" role="presentation"><section class="mobile-app-quick-actions-dialog mobile-app-quick-actions-dialog--creation" role="dialog" aria-modal="true"><header><h3>${escapeHtml(title)}</h3><button type="button" data-mobile-quick-creation-close aria-label="Fermer">×</button></header><div class="mobile-app-quick-actions-dialog__body">${content}</div></section></div>`);
        enhanceMobileSelects(app.querySelector('[data-mobile-quick-creation]'));
        enhanceMobileDateFields(app.querySelector('[data-mobile-quick-creation]'));
        enhanceMobileTextFields(app.querySelector('[data-mobile-quick-creation]'));
    }

    async function createExpenseDraft() {
        if (state.expenseDraftCreationPromise) return state.expenseDraftCreationPromise;
        const today = new Date().toISOString().slice(0, 10);
        state.expenseDraftCreationPromise = api(`/dossiers/${state.activeDossierId}/expense-reports`, {
            method: 'POST',
            body: { title: 'Dépense à compléter', period_start: today, period_end: today, submit: false },
        }).then((response) => response.data || {});
        try {
            return await state.expenseDraftCreationPromise;
        } finally {
            state.expenseDraftCreationPromise = null;
        }
    }

    async function startQuickExpenseCreation() {
        openQuickCreationDialog('expense', 'Dépôt du justificatif', '<div class="mobile-app-loading"><span>Préparation de la demande…</span></div>');
        const preparingDialog = app.querySelector('[data-mobile-quick-creation="expense"]');
        const report = await createExpenseDraft();
        if (!preparingDialog?.isConnected) {
            await api(`/dossiers/${state.activeDossierId}/expense-reports/${Number(report.id) || 0}`, { method: 'DELETE' }).catch(() => {});
            return;
        }
        openQuickExpenseReceipt(report);
    }

    function expenseItemDraftKey(reportId) {
        return `${Number(state.activeDossierId) || 0}:${Number(reportId) || 0}`;
    }

    function expenseItemDraft(reportId) {
        return state.expenseItemDrafts[expenseItemDraftKey(reportId)] || {
            nature: '',
            date: '',
            amount: '',
            vat: '',
            comment: '',
            missingReason: '',
            ocrMessage: '',
        };
    }

    function captureExpenseItemDraft(form = app.querySelector('[data-mobile-expense-draft]')) {
        if (!(form instanceof HTMLFormElement)) return;
        const reportId = Number(form.elements.namedItem('report_id')?.value) || 0;
        if (reportId < 1) return;
        const previous = expenseItemDraft(reportId);
        state.expenseItemDrafts[expenseItemDraftKey(reportId)] = {
            nature: String(form.elements.namedItem('title')?.value ?? previous.nature ?? ''),
            date: String(form.elements.namedItem('period_start')?.value ?? previous.date ?? ''),
            amount: String(form.elements.namedItem('amount_including_tax')?.value ?? previous.amount ?? ''),
            vat: String(form.elements.namedItem('vat_amount')?.value ?? previous.vat ?? ''),
            comment: String(form.elements.namedItem('comment')?.value ?? previous.comment ?? ''),
            missingReason: String(form.elements.namedItem('receipt_missing_reason')?.value ?? previous.missingReason ?? ''),
            ocrMessage: String(previous.ocrMessage || ''),
        };
    }

    function clearExpenseItemDraft(reportId) {
        delete state.expenseItemDrafts[expenseItemDraftKey(reportId)];
    }

    function expenseReceiptStatusMarkup(upload) {
        const uploadReady = Number(upload?.remoteDocumentId) > 0 && upload?.status === 'success';
        const preview = upload?.previewUrl ? `<img class="mobile-app-context-upload-preview" src="${escapeHtml(upload.previewUrl)}" alt="Aperçu du justificatif">` : quickActionIcons.file;
        const uploadFailed = ['error', 'cancel_error'].includes(String(upload?.status || ''));
        return upload
            ? `<div class="mobile-app-context-upload ${uploadReady ? 'is-success' : (uploadFailed ? 'is-error' : '')}">${preview}<span><strong>${uploadReady ? 'Justificatif joint' : (uploadFailed ? 'Échec de l’envoi' : 'Justificatif en cours d’envoi')}</strong><small>${escapeHtml(uploadFailed ? (upload.detail || 'Sélectionnez à nouveau le document.') : (upload.filename || 'Document en préparation'))}</small></span></div>`
            : '';
    }

    function expenseReceiptStepMarkup(report, quickOrigin = false) {
        const reportId = Number(report.id) || 0;
        const draft = expenseItemDraft(reportId);
        const upload = contextualUpload('expense_report', reportId);
        const uploadReady = Number(upload?.remoteDocumentId) > 0 && upload?.status === 'success';
        const uploadFailed = ['error', 'cancel_error'].includes(String(upload?.status || ''));
        const disabled = upload ? !uploadReady : draft.missingReason.trim() === '';
        return `<p class="mobile-app-quick-actions-hint">Ajoutez le justificatif ou indiquez le motif de son absence.</p><div class="mobile-app-module-actions"><button class="mobile-app-secondary-button" type="button" data-upload-file data-upload-mode="camera" data-upload-context-type="expense_report" data-upload-context-id="${reportId}" data-upload-destination="Justificatif de note de frais">${quickActionIcons.camera} Photo</button><button class="mobile-app-secondary-button" type="button" data-upload-file data-upload-mode="file" data-upload-context-type="expense_report" data-upload-context-id="${reportId}" data-upload-destination="Justificatif de note de frais">${quickActionIcons.file} Fichier</button></div>${expenseReceiptStatusMarkup(upload)}<form class="mobile-app-form-panel mt-3" data-mobile-expense-draft data-mobile-expense-receipt-step data-receipt-ready="${uploadReady ? '1' : '0'}"><input type="hidden" name="report_id" value="${reportId}"><input type="hidden" name="lock_version" value="${Number(report.lock_version) || 0}">${upload ? '' : `<div class="mobile-app-field"><label>Motif d’absence de justificatif</label><textarea name="receipt_missing_reason" maxlength="500" data-mobile-quick-entry required>${escapeHtml(draft.missingReason)}</textarea></div>`}<button class="mobile-app-primary-button mobile-app-button-with-icon" type="button" data-mobile-expense-receipt-continue="${reportId}" data-mobile-quick-origin="${quickOrigin ? 'home' : ''}" ${disabled ? 'disabled' : ''}>Continuer<span aria-hidden="true">→</span></button></form>`;
    }

    function expenseDetailMarkup(report, quickOrigin = false) {
        const reportId = Number(report.id) || 0;
        const draft = expenseItemDraft(reportId);
        const upload = contextualUpload('expense_report', reportId);
        const uploadReady = Number(upload?.remoteDocumentId) > 0 && upload?.status === 'success';
        const nature = draft.nature || (report?.title === 'Dépense à compléter' ? '' : report?.title || '');
        const date = String(draft.date || report?.period_end || new Date().toISOString().slice(0, 10));
        const ocrMessage = draft.ocrMessage ? `<p class="mobile-app-quick-actions-hint" role="status">${escapeHtml(draft.ocrMessage)}</p>` : '';
        const back = `<button class="mobile-app-inline-back" type="button" data-mobile-expense-detail-back="${reportId}" data-mobile-quick-origin="${quickOrigin ? 'home' : ''}" aria-label="Retour au dépôt du justificatif">← <span>Dépôt du justificatif</span></button>`;
        return `${back}${ocrMessage}${expenseReceiptStatusMarkup(upload)}<form class="mobile-app-form-panel mt-3" data-mobile-form="expense_item" data-mobile-expense-draft ${quickOrigin ? 'data-mobile-quick-origin="home"' : ''}><input type="hidden" name="report_id" value="${reportId}"><input type="hidden" name="lock_version" value="${Number(report.lock_version) || 0}"><input type="hidden" name="category" value="other">${uploadReady ? `<input type="hidden" name="receipt_ged_document_id" value="${upload.remoteDocumentId}">` : `<input type="hidden" name="receipt_missing" value="1"><input type="hidden" name="receipt_missing_reason" value="${escapeHtml(draft.missingReason)}">`}<div class="mobile-app-field"><label>Nature de la dépense</label><input name="title" value="${escapeHtml(nature)}" maxlength="160" data-mobile-quick-entry required></div><div class="mobile-app-field"><label>Date des frais</label><input type="date" lang="fr" name="period_start" value="${escapeHtml(date)}" data-mobile-quick-entry required></div><div class="mobile-app-form-row"><div class="mobile-app-field"><label>Montant TTC</label><input type="number" name="amount_including_tax" value="${escapeHtml(draft.amount)}" min="0.01" step="0.01" inputmode="decimal" data-mobile-quick-entry required></div><div class="mobile-app-field"><label>TVA</label><input type="number" name="vat_amount" value="${escapeHtml(draft.vat)}" min="0" step="0.01" inputmode="decimal" data-mobile-quick-entry></div></div><div class="mobile-app-field"><label>Commentaire (facultatif)</label><textarea name="comment" maxlength="1000" data-mobile-quick-entry>${escapeHtml(draft.comment)}</textarea></div><button class="mobile-app-primary-button" type="submit">Demander le remboursement</button></form>`;
    }

    function openQuickExpenseReceipt(report) {
        openQuickCreationDialog('expense', 'Dépôt du justificatif', expenseReceiptStepMarkup(report, true));
        app.querySelector('[data-mobile-quick-creation="expense"]')?.setAttribute('data-mobile-expense-report-id', String(Number(report.id) || 0));
        app.querySelector('[data-mobile-quick-creation="expense"]')?.setAttribute('data-mobile-expense-step', 'receipt');
    }

    function openQuickExpenseDetail(report) {
        openQuickCreationDialog('expense', 'Détail de la dépense', expenseDetailMarkup(report, true));
        app.querySelector('[data-mobile-quick-creation="expense"]')?.setAttribute('data-mobile-expense-report-id', String(Number(report.id) || 0));
        app.querySelector('[data-mobile-quick-creation="expense"]')?.setAttribute('data-mobile-expense-step', 'detail');
    }

    async function refreshQuickExpenseDetail(reportId) {
        const dialog = app.querySelector('[data-mobile-quick-creation="expense"]');
        if (!dialog) return;
        captureExpenseItemDraft();
        const response = await api(`/dossiers/${state.activeDossierId}/expense-reports/${Number(reportId)}`);
        if (dialog.dataset.mobileExpenseStep === 'detail') openQuickExpenseDetail(response.data || {});
        else openQuickExpenseReceipt(response.data || {});
    }

    async function analyzeExpenseReceipt(report) {
        const reportId = Number(report.id) || 0;
        const upload = contextualUpload('expense_report', reportId);
        const documentId = Number(upload?.remoteDocumentId) || 0;
        if (documentId < 1 || upload?.status !== 'success') return;
        const response = await api(`/dossiers/${state.activeDossierId}/expense-reports/${reportId}/receipt-ocr`, {
            method: 'POST',
            body: {
                lock_version: Number(report.lock_version) || 0,
                receipt_ged_document_id: documentId,
            },
        });
        const result = response.data || {};
        const draft = expenseItemDraft(reportId);
        state.expenseItemDrafts[expenseItemDraftKey(reportId)] = {
            ...draft,
            date: String(result.expense_date || draft.date || ''),
            amount: draft.amount || String(result.amount_including_tax || ''),
            vat: draft.vat || String(result.vat_amount || ''),
            ocrMessage: String(result.message || ''),
        };
    }

    function roundedKilometers(value, fallback = '0') {
        const amount = Number(String(value ?? '').replace(',', '.'));
        return Number.isFinite(amount) ? String(Math.round(amount)) : (String(value || '').trim() || fallback);
    }

    function mileageTripFormMarkup(trip = null, quickOrigin = false) {
        const today = new Date().toISOString().slice(0, 10);
        const addressKey = `${String(trip?.departure || '').trim()}|${String(trip?.arrival || '').trim()}`;
        return `<form class="mobile-app-form-panel" data-mobile-form="mileage_trip" ${quickOrigin ? 'data-mobile-quick-origin="home"' : ''}><input type="hidden" name="trip_id" value="${trip?.id || ''}"><input type="hidden" name="lock_version" value="${trip?.lock_version || 0}"><div class="mobile-app-field mobile-app-address-field"><label>Départ</label><input name="departure" value="${escapeHtml(trip?.departure || '')}" autocomplete="off" maxlength="255" data-mileage-address-input="departure" data-mobile-quick-entry required><div class="mobile-app-address-suggestions" data-mileage-address-suggestions="departure"></div></div><div class="mobile-app-field mobile-app-address-field"><label>Arrivée</label><input name="arrival" value="${escapeHtml(trip?.arrival || '')}" autocomplete="off" maxlength="255" data-mileage-address-input="arrival" data-mobile-quick-entry required><div class="mobile-app-address-suggestions" data-mileage-address-suggestions="arrival"></div></div><div class="mobile-app-form-row"><div class="mobile-app-field"><label>Date</label><input type="date" lang="fr" name="expense_date" value="${escapeHtml(trip?.expense_date || today)}" required></div><div class="mobile-app-field"><label>Distance A/R - km</label><input type="number" name="distance_km" value="${escapeHtml(trip ? roundedKilometers(trip.distance_km, '') : '')}" min="1" max="99999" step="1" inputmode="numeric" data-mobile-quick-entry ${trip ? `data-mileage-manual-key="${escapeHtml(addressKey)}"` : ''} required></div></div><small class="mobile-app-route-distance-status" data-mileage-distance-status aria-live="polite"></small><div class="mobile-app-field"><label>Motif</label><input name="purpose" value="${escapeHtml(trip?.purpose || '')}" maxlength="255" enterkeyhint="done" required></div>${writeButton(trip ? 'Enregistrer les modifications' : 'Créer le voyage')}</form>`;
    }

    function scheduleMileageDistance(form) {
        if (!(form instanceof HTMLFormElement)) return;
        const departure = String(form.elements.departure?.value || '').trim();
        const arrival = String(form.elements.arrival?.value || '').trim();
        const distance = form.elements.distance_km;
        const status = form.querySelector('[data-mileage-distance-status]');
        window.clearTimeout(state.mileageDistanceTimer);
        if (!(distance instanceof HTMLInputElement) || departure.length < 3 || arrival.length < 3) {
            if (status) status.textContent = '';
            return;
        }
        const key = `${departure}|${arrival}`;
        const sequence = ++state.mileageDistanceSequence;
        if (status) status.textContent = 'Calcul de l’itinéraire…';
        state.mileageDistanceTimer = window.setTimeout(async () => {
            try {
                const query = new URLSearchParams({ departure, arrival });
                const response = await api(`/mileage/distance?${query}`);
                if (sequence !== state.mileageDistanceSequence || !form.isConnected) return;
                if (String(distance.dataset.mileageManualKey || '') !== key) {
                    const roundedDistance = Math.round(Number(response.data?.distance_km));
                    distance.value = Number.isFinite(roundedDistance) && roundedDistance > 0 ? String(roundedDistance) : '';
                }
                if (status) status.textContent = 'Distance routière aller-retour calculée automatiquement.';
            } catch (_) {
                if (sequence !== state.mileageDistanceSequence || !form.isConnected) return;
                if (status) status.textContent = 'Distance automatique indisponible - saisie manuelle possible.';
            }
        }, 520);
    }

    function openQuickMileageCreation() {
        openQuickCreationDialog('mileage', 'Nouveau voyage', mileageTripFormMarkup(null, true));
        window.requestAnimationFrame(() => {
            const departure = app.querySelector('[data-mobile-quick-creation="mileage"] [data-mileage-address-input="departure"]');
            if (!(departure instanceof HTMLInputElement)) return;
            departure.focus({ preventScroll: true });
            departure.select();
            departure.dataset.mobileQuickEntrySelected = '1';
        });
    }

    async function renderExpenseItemForm(params = {}) {
        const reportId = Number(params.reportId) || 0;
        if (!reportId) return navigate('expense_create');
        captureExpenseItemDraft();
        const response = await api(`/dossiers/${state.activeDossierId}/expense-reports/${reportId}`);
        const report = response.data || {};
        const step = params.step === 'detail' ? 'detail' : 'receipt';
        state.routeParams = { reportId, lockVersion: Number(report.lock_version) || 0, step };
        persistNavigation();
        renderFrame(
            step === 'detail' ? 'Détail de la dépense' : 'Dépôt du justificatif',
            step === 'detail' ? expenseDetailMarkup(report) : expenseReceiptStepMarkup(report),
            { tab: employeeModuleTab('expenses') },
        );
    }

    async function renderMileage(params = {}) {
        const today = new Date().toISOString().slice(0, 10);
        let period = ['month', 'year', 'all'].includes(params.period) ? params.period : 'all';
        const month = /^\d{4}-\d{2}$/.test(String(params.month || '')) ? params.month : today.slice(0, 7);
        const year = /^\d{4}$/.test(String(params.year || '')) ? params.year : today.slice(0, 4);
        const statusKey = `mileage:${state.activeDossierId}`;
        const rememberedStatus = state.moduleFilterStatuses[statusKey];
        const status = ['unvalidated', 'validated', 'all'].includes(params.status)
            ? params.status
            : (['unvalidated', 'validated', 'all'].includes(rememberedStatus) ? rememberedStatus : 'all');
        state.moduleFilterStatuses[statusKey] = status;
        persistPreferences();
        const [configResponse, tripsResponse] = await Promise.all([
            api(`/dossiers/${state.activeDossierId}/mileage/config`),
            api(`/dossiers/${state.activeDossierId}/mileage/trips?period=all&status=all`),
        ]);
        const config = configResponse.data || {};
        const allTrips = Array.isArray(tripsResponse.data) ? tripsResponse.data : [];
        const availableByYear = new Map();
        const availableMonths = Array.isArray(config.available_period_months)
            ? config.available_period_months
            : allTrips.map((trip) => String(trip?.expense_date || '').slice(0, 7));
        availableMonths.forEach((value) => {
            const tripMonth = String(value || '');
            if (!/^\d{4}-\d{2}$/.test(tripMonth)) return;
            const tripYear = tripMonth.slice(0, 4);
            if (!availableByYear.has(tripYear)) availableByYear.set(tripYear, new Set());
            availableByYear.get(tripYear).add(tripMonth);
        });
        const availableValues = new Set(['all']);
        availableByYear.forEach((months, tripYear) => {
            availableValues.add(`year:${tripYear}`);
            months.forEach((tripMonth) => availableValues.add(`month:${tripMonth}`));
        });
        let periodValue = period === 'month' ? `month:${month}` : (period === 'year' ? `year:${year}` : 'all');
        if (!availableValues.has(periodValue)) {
            period = 'all';
            periodValue = 'all';
        }
        const periodOptions = `<option value="all" ${periodValue === 'all' ? 'selected' : ''}>Toute période</option>${[...availableByYear.entries()]
            .sort(([left], [right]) => right.localeCompare(left))
            .map(([tripYear, months]) => `<optgroup label="${escapeHtml(tripYear)}"><option value="year:${escapeHtml(tripYear)}" ${periodValue === `year:${tripYear}` ? 'selected' : ''}>${escapeHtml(tripYear)} - Toute l’année</option>${[...months]
                .sort((left, right) => right.localeCompare(left))
                .map((tripMonth) => {
                    const date = new Date(`${tripMonth}-01T12:00:00`);
                    const label = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(date).replace(/^./, (letter) => letter.toUpperCase());
                    return `<option value="month:${escapeHtml(tripMonth)}" ${periodValue === `month:${tripMonth}` ? 'selected' : ''}>${escapeHtml(tripYear)} - ${escapeHtml(label)}</option>`;
                }).join('')}</optgroup>`).join('')}`;
        const trips = allTrips.filter((trip) => {
            const tripDate = String(trip?.expense_date || '');
            const periodMatches = period === 'month' ? tripDate.startsWith(`${month}-`) : (period === 'year' ? tripDate.startsWith(`${year}-`) : true);
            const statusMatches = status === 'validated' ? trip.status === 'validated' : (status === 'unvalidated' ? trip.status !== 'validated' : true);
            return periodMatches && statusMatches;
        });
        const filters = `<div class="mobile-app-form-panel mobile-app-mileage-filters"><div class="mobile-app-field"><label>Période</label><select data-mobile-mileage-filter="period">${periodOptions}</select></div><div class="mobile-app-field"><label>Statut</label><select data-mobile-mileage-filter="status"><option value="all" ${status === 'all' ? 'selected' : ''}>Tous les statuts</option><option value="unvalidated" ${status === 'unvalidated' ? 'selected' : ''}>Non validés</option><option value="validated" ${status === 'validated' ? 'selected' : ''}>Validés</option></select></div></div>`;
        const situation = config.situation_configured ? '' : '<div class="mobile-app-settings-message is-warning">Renseignez votre carte grise et votre puissance fiscale avant tout envoi en validation.</div>';
        const submissionAttributes = config.situation_configured
            ? 'data-mobile-route="mileage_submit"'
            : 'data-mileage-submit-guard aria-disabled="true"';
        const actions = `<div class="mobile-app-mileage-actions"><button class="mobile-app-primary-button" type="button" data-mobile-route="mileage_create" ${state.readOnly ? 'disabled' : ''}>Créer un voyage</button><div><button class="mobile-app-secondary-button" type="button" ${submissionAttributes} ${state.readOnly ? 'disabled' : ''}>${quickActionIcons.send || '↗'} Transmettre pour validation</button><button class="mobile-app-icon-button" type="button" data-mobile-route="mileage_settings" data-mileage-settings-trigger aria-label="Paramétrer la situation" title="Paramétrer la situation">${quickActionIcons.settings || '⚙'}</button></div></div>`;
        const list = trips.length ? `<div class="mobile-app-list">${trips.map((trip) => `<article class="mobile-app-list-item"><div class="mobile-app-list-item__top"><h3>${escapeHtml(trip.departure)} - ${escapeHtml(trip.arrival)}</h3><span class="mobile-app-badge">${escapeHtml(trip.status_label || humanStatus(trip.status))}</span></div><p>${formatCivilDate(trip.expense_date)} - ${escapeHtml(roundedKilometers(trip.distance_km))} km A/R</p><small>${escapeHtml(trip.purpose)}</small>${trip.editable ? `<button class="mobile-app-secondary-button mt-2" type="button" data-mobile-route="mileage_create" data-mobile-id="${trip.id}">Modifier</button>` : ''}${trip.submission_cancellable ? `<button class="mobile-app-secondary-button mt-2" type="button" data-mileage-withdraw-submission="${Number(trip.id) || 0}" data-lock-version="${Number(trip.lock_version) || 0}">Annuler l’envoi</button>` : ''}</article>`).join('')}</div>` : emptyState('Aucun voyage', 'Aucun voyage ne correspond à ces filtres.');
        state.routeParams = { period, month, year, status };
        persistNavigation();
        renderFrame('IK', `${actions}${situation}${filters}${list}`, { tab: employeeModuleTab('mileage') });
    }

    async function renderMileageTripForm(params = {}) {
        let trip = null;
        if (Number(params.id) > 0) {
            const response = await api(`/dossiers/${state.activeDossierId}/mileage/trips?period=all&status=all`);
            trip = (response.data || []).find((item) => Number(item.id) === Number(params.id)) || null;
        }
        if (trip && !trip.editable) {
            state.route = 'mileage';
            state.routeParams = {};
            persistNavigation();
            await renderMileage();
            showQuickCreationNotice('Ce voyage est en validation et ne peut pas être modifié.');
            return;
        }
        renderFrame(trip ? 'Modifier le voyage' : 'Nouveau voyage', mileageTripFormMarkup(trip), { tab: employeeModuleTab('mileage') });
    }

    function mileageSubmissionMarkup(preview, from, to, quickOrigin = false) {
        const trips = preview.trips || [];
        const validator = preview.validator?.display_name || preview.validator?.name || 'Aucun valideur configuré';
        const missingSituation = String(preview.blocking_message || '').toLowerCase().includes('ne sont couverts par aucune situation complète');
        const blocking = preview.blocking_message ? `<div class="mobile-app-settings-message is-warning">${escapeHtml(preview.blocking_message)}${missingSituation ? '<button class="mobile-app-secondary-button mt-2" type="button" data-mileage-open-settings-from-submission>Paramétrer ma situation</button>' : ''}</div>` : '';
        const list = trips.length ? `<div class="mobile-app-list">${trips.map((trip) => `<div class="mobile-app-list-item"><strong>${formatCivilDate(trip.expense_date)} - ${escapeHtml(trip.purpose)}</strong><p>${escapeHtml(trip.departure)} - ${escapeHtml(trip.arrival)} - ${escapeHtml(roundedKilometers(trip.distance_km))} km - ${formatMoney(trip.simulated_amount_eur || 0)}</p><small>${escapeHtml(trip.fiscal_power || '')} CV - ${escapeHtml(roundedKilometers(trip.annual_distance_before_km))} km parcourus avant ce trajet</small></div>`).join('')}</div>` : emptyState('Aucun voyage', 'Aucun voyage à valider dans ces bornes.');
        const annual = (preview.annual_calculations || []).map((item) => `<small>${escapeHtml(item.year)} - ${escapeHtml(roundedKilometers(item.previous_distance_km))} km déjà parcourus, ${escapeHtml(roundedKilometers(item.resulting_distance_km))} km après transmission</small>`).join('');
        return `<form class="mobile-app-form-panel" data-mobile-form="mileage_submit" ${quickOrigin ? 'data-mobile-quick-origin="home"' : ''}><div class="mobile-app-field"><label>Borne minimale</label><input type="date" lang="fr" name="from" value="${escapeHtml(from)}" data-mobile-mileage-submission-bound required></div><div class="mobile-app-field"><label>Borne maximale</label><input type="date" lang="fr" name="to" value="${escapeHtml(to)}" data-mobile-mileage-submission-bound required></div><div class="mobile-app-validator-line">Valideur : ${escapeHtml(validator)}</div>${blocking}<div class="mobile-app-settings-message is-success"><strong>Estimation du remboursement - ${formatMoney(preview.total_amount_eur || 0)}</strong>${annual}</div><div class="mobile-app-section-title mt-3"><h2>${trips.length} ${trips.length === 1 ? 'voyage sera envoyé' : 'voyages seront envoyés'} - ${escapeHtml(roundedKilometers(preview.total_distance_km))} km</h2></div>${list}<p class="mobile-app-form-error" data-mobile-mileage-submit-error hidden></p><button class="mobile-app-primary-button" type="submit" ${preview.can_submit ? '' : 'disabled'}>Envoyer en validation</button></form>`;
    }

    async function mileageSubmissionPreview(params = {}) {
        const query = new URLSearchParams({ ...(params.from ? { from: params.from } : {}), ...(params.to ? { to: params.to } : {}) });
        const response = await api(`/dossiers/${state.activeDossierId}/mileage/submission-preview?${query}`);
        const preview = response.data || {};
        return {
            preview,
            from: params.from || preview.default_from || '',
            to: params.to || preview.default_to || '',
        };
    }

    async function renderMileageSubmission(params = {}) {
        const { preview, from, to } = await mileageSubmissionPreview(params);
        state.routeParams = { from, to };
        persistNavigation();
        renderFrame('Envoyer en validation', mileageSubmissionMarkup(preview, from, to), { tab: employeeModuleTab('mileage'), contentClass: 'mobile-app-content--mileage-submission' });
    }

    async function openQuickMileageSubmission(params = {}) {
        const { preview, from, to } = await mileageSubmissionPreview(params);
        openQuickCreationDialog('mileage-submit', 'Transmettre les IK', mileageSubmissionMarkup(preview, from, to, true));
    }

    async function mileageSettingsMarkup(quickOrigin = false) {
        const [configResponse, vehiclesResponse] = await Promise.all([
            api(`/dossiers/${state.activeDossierId}/mileage/config`),
            api(`/dossiers/${state.activeDossierId}/mileage/vehicles`),
        ]);
        const config = configResponse.data || {};
        const vehicles = vehiclesResponse.data || [];
        const current = config.current_vehicle || vehicles[0] || {};
        const upload = contextualUpload('mileage_registration');
        const today = config.suggested_situation_effective_from || new Date().toISOString().slice(0, 10);
        const uploadReady = upload?.status === 'success' && Number(upload?.remoteDocumentId) > 0;
        const currentDocumentId = Number(current.registration_document_id) || 0;
        const documentId = uploadReady ? Number(upload.remoteDocumentId) : currentDocumentId || '';
        const documentName = upload?.filename || current.registration_filename || '';
        const previewUrl = upload?.previewUrl || (String(current.registration_mime_type || '').startsWith('image/') ? current.registration_url : '');
        const uploadInProgress = upload && ['pending', 'converting', 'uploading'].includes(String(upload.status || ''));
        const uploadFailed = upload && String(upload.status || '') === 'error';
        const registrationPreview = uploadInProgress
            ? mileageRegistrationUploadLoadingMarkup(upload)
            : (documentId
                ? `<div class="mobile-app-context-upload is-success" data-mileage-registration-slot data-mileage-registration-preview>${previewUrl ? `<img class="mobile-app-context-upload-preview" src="${escapeHtml(previewUrl)}" alt="Aperçu de la carte grise">` : quickActionIcons.file}<span><strong>${uploadReady ? 'Nouveau document prêt à enregistrer' : 'Carte grise enregistrée'}</strong><small>${escapeHtml(documentName)}</small></span></div>`
                : `<div class="mobile-app-settings-message ${uploadFailed ? 'is-warning' : ''}" data-mileage-registration-slot>${uploadFailed ? 'La photo n’a pas pu être préparée ou transmise. Réessayez.' : 'Une carte grise est obligatoire.'}</div>`);
        const history = vehicles.length ? `<div class="mobile-app-section-title mt-3"><h2>Historique daté</h2></div><div class="mobile-app-list">${vehicles.map((vehicle) => `<div class="mobile-app-list-item"><strong>${escapeHtml(vehicle.fiscal_power)} CV</strong><p>Applicable depuis le ${formatCivilDate(vehicle.effective_from)}</p><small>${escapeHtml(vehicle.registration_filename || '')}</small></div>`).join('')}</div>` : '';
        const currentSummary = current.id ? `<p class="mobile-app-situation-current">Situation actuelle - ${escapeHtml(current.fiscal_power)} CV depuis le ${formatCivilDate(current.effective_from)}</p>` : '';
        return `<form class="mobile-app-form-panel" data-mobile-form="mileage_vehicle" ${quickOrigin ? 'data-mobile-quick-origin="mileage-submission-settings"' : ''}><input type="hidden" name="registration_ged_document_id" value="${documentId}"><input type="hidden" name="label" value="Véhicule personnel">${currentSummary}<div class="mobile-app-field"><label>Date d’application du changement</label><input type="date" lang="fr" name="effective_from" value="${escapeHtml(today)}" required></div><div class="mobile-app-field"><label>Puissance fiscale - case P.6</label><input type="number" name="fiscal_power" value="${escapeHtml(current.fiscal_power || '')}" min="1" max="20" step="1" inputmode="numeric" data-mobile-quick-entry required></div><div class="mobile-app-section-title mt-1"><h2>Carte grise</h2></div><div class="mobile-app-module-actions"><button class="mobile-app-secondary-button" type="button" data-upload-file data-upload-mode="camera" data-upload-context-type="mileage_registration" data-upload-destination="Carte grise">${quickActionIcons.camera} Photo</button><button class="mobile-app-secondary-button" type="button" data-upload-file data-upload-mode="file" data-upload-context-type="mileage_registration" data-upload-destination="Carte grise">${quickActionIcons.file} Fichier</button></div>${registrationPreview}${history}<button class="mobile-app-primary-button" type="submit" ${documentId && (!upload || uploadReady) ? '' : 'disabled'}>Enregistrer la situation</button></form>`;
    }

    async function renderMileageSettings() {
        renderFrame('Ma situation', await mileageSettingsMarkup(), { tab: employeeModuleTab('mileage') });
    }

    async function openQuickMileageSettings() {
        openQuickCreationDialog('mileage-settings', 'Ma situation', await mileageSettingsMarkup(true));
    }

    function mileageRegistrationUploadLoadingMarkup(upload = {}) {
        const progress = Math.max(0, Math.min(99, Number(upload.progress) || 0));
        const preview = upload.previewUrl
            ? `<div class="mobile-app-context-upload__preview-loading"><img class="mobile-app-context-upload-preview" src="${escapeHtml(upload.previewUrl)}" alt="Aperçu de la carte grise en préparation"><i class="mobile-app-context-upload__spinner" aria-hidden="true"></i></div>`
            : `<div class="mobile-app-context-upload__loading-icon"><i class="mobile-app-context-upload__spinner" aria-hidden="true"></i></div>`;
        const detail = String(upload.status || '') === 'uploading'
            ? `Envoi en cours - ${progress} %`
            : 'L’aperçu va apparaître dans un instant.';

        return `<div class="mobile-app-context-upload is-loading" data-mileage-registration-slot role="status" aria-live="polite" aria-busy="true">${preview}<span><strong>Préparation de la photo…</strong><small>${escapeHtml(detail)}</small></span></div>`;
    }

    function showMileageRegistrationUploadLoading(upload) {
        const slot = app.querySelector('[data-mobile-form="mileage_vehicle"] [data-mileage-registration-slot]');
        if (!slot) return;
        slot.outerHTML = mileageRegistrationUploadLoadingMarkup(upload);
        const submit = app.querySelector('[data-mobile-form="mileage_vehicle"] button[type="submit"]');
        if (submit) submit.disabled = true;
    }

    async function renderSalesRevenue() {
        const response = await api(`/dossiers/${state.activeDossierId}/sales-revenue`);
        const data = response.data;
        const declarations = data.declarations || [];
        renderFrame('Chiffre d’affaires VRP', `<form class="mobile-app-form-panel" data-mobile-form="sales"><div class="mobile-app-field"><label>Période</label><input type="month" name="period_month" value="${escapeHtml(data.default_period_month)}" required></div><div class="mobile-app-field"><label>Chiffre d’affaires</label><input type="number" name="revenue_amount" min="0" step="0.01" required></div><div class="mobile-app-field"><label>Commentaire</label><textarea name="comment"></textarea></div><input type="hidden" name="submit" value="1">${writeButton('Transmettre')}</form>${declarations.length ? `<div class="mobile-app-section-title mt-3"><h2>Historique</h2></div><div class="mobile-app-list">${declarations.map((item) => `<div class="mobile-app-list-item"><div class="mobile-app-list-item__top"><strong>${escapeHtml(item.period_month || item.period_label)}</strong><span class="mobile-app-badge">${escapeHtml(humanStatus(item.status))}</span></div><p>${formatMoney(item.revenue_amount)}</p></div>`).join('')}</div>` : ''}`, { tab: 'hr' });
    }

    async function renderReports() { await renderReportForm(); }

    function syncMobileReportFields(form) {
        if (!(form instanceof HTMLFormElement)) return;
        const type = String(form.elements.report_type?.value || 'balance');
        const snapshot = ['immobilisations', 'loans'].includes(type);
        form.querySelectorAll('[data-mobile-report-type-choice]').forEach((button) => {
            const selected = button.dataset.mobileReportTypeChoice === type;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        form.querySelectorAll('[data-report-field]').forEach((field) => {
            const visible = field.dataset.reportField === type;
            field.hidden = !visible;
            field.querySelectorAll('input, select, button').forEach((input) => { input.disabled = !visible; });
        });
        form.querySelectorAll('[data-report-filters]').forEach((filters) => {
            const visible = filters.dataset.reportFilters === type;
            filters.hidden = !visible;
            filters.querySelectorAll('input').forEach((input) => { input.disabled = !visible; });
        });
        const period = form.querySelector('[data-report-period]');
        const asOf = form.querySelector('[data-report-as-of]');
        if (period) {
            period.hidden = snapshot;
            period.querySelectorAll('input').forEach((input) => { input.disabled = snapshot; });
        }
        if (asOf) {
            asOf.hidden = !snapshot;
            asOf.querySelectorAll('input').forEach((input) => { input.disabled = !snapshot; });
        }
        syncMobileReportSelectionActions(form);
    }

    function syncMobileReportSelectionActions(form) {
        if (!(form instanceof HTMLFormElement)) return;
        form.querySelectorAll('[data-report-selection]').forEach((selection) => {
            if (selection.hidden) return;
            const checkboxes = Array.from(selection.querySelectorAll('input[type="checkbox"]:not(:disabled)'));
            const selected = checkboxes.filter((checkbox) => checkbox.checked).length;
            const selectAll = selection.querySelector('[data-report-select-all]');
            const deselectAll = selection.querySelector('[data-report-deselect-all]');
            if (selectAll) selectAll.hidden = checkboxes.length > 0 && selected === checkboxes.length;
            if (deselectAll) deselectAll.hidden = selected === 0;
        });
    }

    function mobileReportSelectionMarkup(type, items, valueKey, label) {
        const name = type === 'general_ledger' ? 'accounts[]' : 'journals[]';
        return `<section class="mobile-app-report-selection" data-report-field="${type}" data-report-selection hidden>
            <div class="mobile-app-report-selection__toolbar">
                <strong>${escapeHtml(label)}</strong>
                <span><button type="button" data-report-select-all hidden>Tout sélectionner</button><button type="button" data-report-deselect-all>Tout désélectionner</button></span>
            </div>
            <div class="mobile-app-report-selection__items">${items.map((item) => {
                const value = String(item[valueKey] || '');
                const itemLabel = type === 'general_ledger' ? `${value} - ${item.label || ''}` : `${value} - ${item.label || value}`;
                return `<label><input type="checkbox" name="${name}" value="${escapeHtml(value)}" checked><span>${escapeHtml(itemLabel)}</span></label>`;
            }).join('')}</div>
        </section>`;
    }

    function mobileReportFiltersMarkup(report) {
        const type = String(report.key || report.type || '');
        const filters = Array.isArray(report.filters) ? report.filters : [];
        if (!filters.length) return '';
        return `<section class="mobile-app-report-filters" data-report-filters="${escapeHtml(type)}" hidden><h2>Filtres</h2>${filters.map((filter) => `<label class="mobile-app-task-switch"><strong>${escapeHtml(filter.label || filter.key)}</strong><input type="checkbox" name="${escapeHtml(filter.key)}" value="1" ${filter.default ? 'checked' : ''} disabled><span aria-hidden="true"><span></span></span></label>`).join('')}</section>`;
    }

    function mobileReportHistoryMarkup(reports) {
        if (!reports.length) return emptyState('Aucun état généré', 'Les états générés pour ce dossier apparaîtront ici.');
        const pdfIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v15H6V2Zm2 2v16h10V8h-4V4H8Zm2 8h2.2c1.8 0 2.8 1 2.8 2.5S14 17 12.2 17H12v2h-2v-7Zm2 2v1h.2c.5 0 .8-.2.8-.5s-.3-.5-.8-.5H12Z"/></svg>';
        const sheetIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 2h10l4 4v16H5V2Zm2 2v16h10V7h-3V4H7Zm2 7h6v2H9v-2Zm0 4h6v2H9v-2Z"/></svg>';
        return `<div class="mobile-app-report-history">${reports.map((report) => {
            const ready = report.status === 'ready' && report.content_url;
            const processing = ['queued', 'running'].includes(String(report.status || ''));
            const name = report.display_name || report.file_name || 'État comptable';
            const generatedAt = formatDate(report.created_at_utc, true);
            return `<article class="mobile-app-report-history__item ${ready ? 'is-ready' : ''}">
                <button type="button" class="mobile-app-report-history__open" ${ready ? `data-open-binary="${escapeHtml(report.content_url)}"` : 'disabled'} aria-label="Ouvrir ${escapeHtml(name)}">
                    <span class="mobile-app-report-history__icon is-${report.format === 'xlsx' ? 'xlsx' : 'pdf'}">${report.format === 'xlsx' ? sheetIcon : pdfIcon}</span>
                    <span class="mobile-app-report-history__copy"><strong title="${escapeHtml(name)}">${escapeHtml(name)}</strong><time datetime="${escapeHtml(report.created_at_utc || '')}">${escapeHtml(generatedAt)}</time></span>
                </button>
                ${processing ? `<span class="mobile-app-report-history__spinner" role="status" aria-label="Génération de ${escapeHtml(name)} en cours"></span>` : (!ready ? `<span class="mobile-app-report-history__status">${escapeHtml(humanStatus(report.status))}</span>` : '')}
                <span class="mobile-app-report-history__actions">
                    <button type="button" class="mobile-app-report-history__action" data-share-binary="${escapeHtml(report.content_url || '')}" data-share-filename="${escapeHtml(report.file_name || name)}" data-share-mime="${escapeHtml(report.mime_type || '')}" data-share-company="${escapeHtml(activeDossier()?.name || '')}" aria-label="Partager ${escapeHtml(name)}" title="Partager" ${ready ? '' : 'disabled'}>${quickActionIcons.share}</button>
                    <button type="button" class="mobile-app-report-history__action" data-report-delete="${Number(report.id)}" aria-label="Supprimer ${escapeHtml(name)}" title="Supprimer" ${report.can_delete ? '' : 'disabled'}>${quickActionIcons.delete}</button>
                </span>
            </article>`;
        }).join('')}</div>`;
    }

    function scheduleMobileReportRefresh(reports) {
        if (state.reportRefreshTimer !== null) window.clearTimeout(state.reportRefreshTimer);
        state.reportRefreshTimer = null;
        const processing = reports.some((report) => ['queued', 'running'].includes(String(report.status || '')));
        if (!processing || state.route !== 'reports') return;
        state.reportRefreshTimer = window.setTimeout(async () => {
            state.reportRefreshTimer = null;
            if (state.route !== 'reports' || state.reportRefreshInFlight) return;
            state.reportRefreshInFlight = true;
            try {
                const response = await api(`/dossiers/${state.activeDossierId}/reports`);
                const refreshed = Array.isArray(response.data) ? response.data : [];
                const current = app.querySelector('.mobile-app-report-history');
                if (current) current.outerHTML = mobileReportHistoryMarkup(refreshed);
                scheduleMobileReportRefresh(refreshed);
            } catch (_) {
                scheduleMobileReportRefresh(reports);
            } finally {
                state.reportRefreshInFlight = false;
            }
        }, 2000);
    }

    function mobileReportCreationForm(data, { formOpen = false, quickOrigin = false } = {}) {
        const catalog = Array.isArray(data) ? data : (data.reports || []);
        const accounts = Array.isArray(data.accounts) ? data.accounts : [];
        const journals = Array.isArray(data.journals) ? data.journals : [];
        const availableCatalog = catalog.filter((item) => {
            const parameters = Array.isArray(item.parameters) ? item.parameters : [];
            return (!parameters.includes('accounts') || accounts.length > 0)
                && (!parameters.includes('journals') || journals.length > 0);
        });
        const periodStart = String(data.default_period?.start || '');
        const periodEnd = String(data.default_period?.end || '');
        const supplementalFields = `${accounts.length ? mobileReportSelectionMarkup('general_ledger', accounts, 'number', 'Comptes du grand livre') : ''}${journals.length ? mobileReportSelectionMarkup('journal', journals, 'code', 'Journaux') : ''}`;
        const periodFields = `<div class="mobile-app-form-row" data-report-period><div class="mobile-app-field"><label>Du</label><input type="date" lang="fr" name="period_start" value="${escapeHtml(periodStart)}" required></div><div class="mobile-app-field"><label>Au</label><input type="date" lang="fr" name="period_end" value="${escapeHtml(periodEnd)}" required></div></div><div class="mobile-app-field" data-report-as-of hidden><label>En date du</label><input type="date" lang="fr" name="as_of" value="${escapeHtml(periodEnd)}" required disabled></div>`;
        const initialType = String(availableCatalog[0]?.key || availableCatalog[0]?.type || 'balance');
        const typeChoices = `<div class="mobile-app-field"><label>Type d’état</label><div class="mobile-app-report-types">${availableCatalog.map((item, index) => `<button type="button" data-mobile-report-type-choice="${escapeHtml(item.key || item.type)}" class="${index === 0 ? 'is-selected' : ''}" aria-pressed="${index === 0 ? 'true' : 'false'}">${escapeHtml(item.label || item.name || item.key)}</button>`).join('')}</div><input type="hidden" name="report_type" value="${escapeHtml(initialType)}"></div>`;
        const filters = availableCatalog.map(mobileReportFiltersMarkup).join('');
        return `<form class="mobile-app-form-panel mobile-app-report-form" data-mobile-form="report" ${quickOrigin ? 'data-mobile-quick-origin="home"' : ''} ${formOpen ? '' : 'hidden'}>${typeChoices}<div class="mobile-app-field"><label>Format</label><select name="format"><option value="pdf">PDF</option><option value="xlsx">Excel</option></select></div>${filters}${supplementalFields}${periodFields}${writeButton('Lancer la génération')}</form>`;
    }

    async function renderReportForm(message = '', formOpen = false) {
        const [catalogResponse, historyResponse] = await Promise.all([
            api(`/dossiers/${state.activeDossierId}/reports/catalog`),
            api(`/dossiers/${state.activeDossierId}/reports`),
        ]);
        const data = catalogResponse.data || {};
        const history = Array.isArray(historyResponse.data) ? historyResponse.data : [];
        const form = mobileReportCreationForm(data, { formOpen });
        const toggle = `<button class="mobile-app-primary-button mobile-app-report-create-toggle" type="button" data-report-create-toggle aria-expanded="${formOpen ? 'true' : 'false'}"><span>Générer un nouvel état</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9.5 5 5 5-5 1.4 1.4-6.4 6.4-6.4-6.4L7 9.5Z"/></svg></button>`;
        renderFrame('États comptables', `${message ? `<div class="mobile-app-settings-message is-success" role="status">${escapeHtml(message)}</div>` : ''}${toggle}${form}<div class="mobile-app-section-title mt-3"><h2>États générés</h2></div>${mobileReportHistoryMarkup(history)}`, { tab: 'reports' });
        syncMobileReportFields(app.querySelector('[data-mobile-form="report"]'));
        scheduleMobileReportRefresh(history);
    }

    async function openQuickReportCreation() {
        const response = await api(`/dossiers/${state.activeDossierId}/reports/catalog`);
        const form = mobileReportCreationForm(response.data || {}, { formOpen: true, quickOrigin: true });
        openQuickCreationDialog('report', 'Générer un état comptable', form);
        const dialogForm = app.querySelector('[data-mobile-quick-creation="report"] [data-mobile-form="report"]');
        syncMobileReportFields(dialogForm);
        window.requestAnimationFrame(() => dialogForm?.querySelector('[data-mobile-report-type-choice]')?.focus({ preventScroll: true }));
    }

    async function renderContacts() {
        const response = await api(`/dossiers/${state.activeDossierId}/referents`);
        const contact = (response.data.accounting_referents || []).find((item) => item.is_primary)
            || (response.data.accounting_referents || [])[0]
            || null;
        const title = String(response.data.title || '').trim() || 'Contacter le référent';
        const email = String(contact?.professional_email || '').trim();
        const phone = String(contact?.professional_phone || contact?.professional_mobile || '').trim();
        const whatsappNumber = (() => {
            const digits = phone.replace(/\D+/g, '');
            let international = digits.startsWith('00')
                ? digits.slice(2)
                : (phone.startsWith('+') ? digits : (digits.startsWith('0') ? `33${digits.slice(1)}` : digits));
            if (/^330[1-9]\d{8}$/.test(international)) international = `33${international.slice(3)}`;
            return international.length >= 8 ? international : '';
        })();
        const emailIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v14H3V5Zm2 2v.4l7 4.7 7-4.7V7H5Zm14 10V9.8l-7 4.7-7-4.7V17h14Z"/></svg>';
        const phoneIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 2h3l1.2 5-2.1 1.3a15.7 15.7 0 0 0 7 7l1.3-2.1 5 1.2v3c0 2.5-2 4.6-4.5 4.6C9 22 2 15 2 6.5 2 4 4.1 2 6.6 2Zm1.5 2H6.6C5.2 4 4 5.1 4 6.5 4 13.9 10.1 20 17.5 20c1.4 0 2.5-1.2 2.5-2.6v-1.5l-2-.5-1.5 2.4-.8-.3a17.7 17.7 0 0 1-9.2-9.2l-.3-.8L8.6 6l-.5-2Z"/></svg>';
        const whatsappIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.4A10 10 0 1 0 12 2Zm0 2a8 8 0 1 1-4.4 14.7l-.4-.2-2.2.6.7-2.1-.3-.4A8 8 0 0 1 12 4Z"/><path d="M8.7 7.2h1.8l.7 2.7-1.2.8a7 7 0 0 0 3.3 3.3l.8-1.2 2.7.7v1.8c0 1-.8 1.7-1.8 1.7A8 8 0 0 1 7 9c0-1 .8-1.8 1.7-1.8Z"/></svg>';
        const messageIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16v14H8l-4 4V3Zm2 2v11.2L7.2 15H18V5H6Zm2 3h8v2H8V8Zm0 4h6v2H8v-2Z"/></svg>';
        const contactAction = (tag, attributes, icon, label, value) => `<${tag} class="mobile-app-contact-action" ${attributes}>
            <span class="mobile-app-contact-action__icon">${icon}</span>
            <span class="mobile-app-contact-action__copy"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></span>
        </${tag}>`;
        const actions = [
            email ? contactAction('a', `href="mailto:${escapeHtml(email)}"`, emailIcon, 'Envoyer un E-mail', email) : '',
            phone ? contactAction('a', `href="tel:${escapeHtml(phone.replace(/\s+/g, ''))}"`, phoneIcon, 'Appeler', phone) : '',
            whatsappNumber ? contactAction('a', `href="https://wa.me/${whatsappNumber}" target="_blank" rel="noopener"`, whatsappIcon, 'WhatsApp', phone) : '',
            contact ? contactAction('button', 'type="button" data-mobile-route="messages"', messageIcon, 'Envoyer un message', 'Sur la messagerie Maison Pilote') : '',
        ].filter(Boolean);

        renderFrame(title, actions.length
            ? `<div class="mobile-app-contact-actions">${actions.join('')}</div>`
            : emptyState('Coordonnées indisponibles', 'Les coordonnées du comptable référent principal ne sont pas renseignées.'), { tab: 'more' });

        window.requestAnimationFrame(() => {
            const actionGroup = app.querySelector('.mobile-app-contact-actions');
            equalizeResponsiveFlowItems(actionGroup, '.mobile-app-contact-action');
        });
    }

    function messageConversationEndpoint() {
        const base = `/dossiers/${state.activeDossierId}/referent-conversation`;
        return state.messageConversationId
            ? `${base}?conversation_id=${encodeURIComponent(state.messageConversationId)}`
            : base;
    }

    function messagePresentation(data) {
        const messages = Array.isArray(data.messages) ? data.messages : [];
        const referentName = String(data.conversation?.title || data.referent?.display_name || '').trim() || 'le comptable référent principal';
        const conversationId = Math.max(0, Number(data.conversation?.id) || 0) || null;
        const maxLength = Math.max(0, Number(data.composer?.max_length) || 0);
        const isSelfConversation = Boolean(data.conversation?.is_self_conversation);
        const messageListMarkup = messages.length
            ? messages.flatMap((message) => {
                const attachments = Array.isArray(message.attachments) ? message.attachments : [];
                const attachmentMarkup = attachments.length
                    ? `<div class="mobile-app-message__attachments">${attachments.map((attachment) => `<span>${escapeHtml(attachment.name || 'Pièce jointe')}</span>`).join('')}</div>`
                    : '';
                const messageId = Math.max(0, Number(message.id) || 0);
                const renderBubble = (isOwn, isSelfReceivedCopy = false) => {
                    const actionKey = `${messageId}:${isSelfReceivedCopy ? 'received' : 'primary'}`;
                    const canCopy = String(message.body || '').trim() !== '';
                    const canEdit = !isSelfReceivedCopy && isOwn && Boolean(message.can_edit) && messageId > 0;
                    const canDelete = !isSelfReceivedCopy && Boolean(message.can_delete) && messageId > 0;
                    const isEditing = canEdit && state.messageEditingId === messageId;
                    const editMarkup = isEditing
                        ? `<form class="mobile-app-message-edit" data-mobile-message-edit-form data-mobile-message-id="${messageId}">
                            <label class="visually-hidden" for="mobile-message-edit-${messageId}">Modifier le message</label>
                            <textarea id="mobile-message-edit-${messageId}" name="message" rows="2" required ${maxLength ? `maxlength="${maxLength}"` : ''} data-mobile-message-edit-input>${escapeHtml(state.messageEditingBody)}</textarea>
                            <div class="mobile-app-message-edit__actions">
                                <button type="submit">Enregistrer</button>
                                <button type="button" data-mobile-message-edit-cancel>Annuler</button>
                            </div>
                            <p class="mobile-app-message-edit__error" role="alert" data-mobile-message-edit-error hidden></p>
                        </form>`
                        : (message.body ? `<p>${escapeHtml(message.body)}</p>` : '');
                    const actionMarkup = (canCopy || canEdit || canDelete) && !isEditing
                        ? `<div class="mobile-app-message__actions">
                            ${canCopy ? `<button class="mobile-app-message__copy" type="button" data-mobile-message-copy="${messageId}" aria-label="Copier le message" title="Copier le message"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1Zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm0 16H8V7h11v14Z"/></svg></button>` : ''}
                            ${canEdit ? `<button class="mobile-app-message__edit" type="button" data-mobile-message-edit="${messageId}" aria-label="Modifier le message" title="${state.readOnly ? 'Action indisponible en lecture seule' : 'Modifier le message'}" ${state.readOnly ? 'disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg></button>` : ''}
                            ${canDelete ? `<button class="mobile-app-message__delete" type="button" data-mobile-message-delete="${messageId}" aria-label="Supprimer le message" title="${state.readOnly ? 'Action indisponible en lecture seule' : 'Supprimer le message'}" ${state.readOnly ? 'disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12Zm3-9h2v8H9v-8Zm4 0h2v8h-2v-8Zm2.5-6-1-1h-5l-1 1H5v2h14V4h-3.5Z"/></svg></button>` : ''}
                        </div>`
                        : '';
                    const actionsVisible = actionMarkup !== '' && state.messageActionsKey === actionKey;
                    const codexRun = message.codex_run && typeof message.codex_run === 'object' ? message.codex_run : null;
                    const codexStatusMarkup = codexRun?.status_label
                        ? `<div class="mobile-app-message__codex-status"><span>${escapeHtml(codexRun.status_label)}</span>${codexRun.cancellable ? `<button type="button" data-mobile-codex-cancel="${Math.max(0, Number(codexRun.id) || 0)}">Arrêter</button>` : ''}</div>`
                        : '';
                    const bubbleActionAttributes = actionMarkup !== '' && !isEditing
                        ? `data-mobile-message-actions-toggle="${actionKey}" role="button" tabindex="0" aria-expanded="${actionsVisible ? 'true' : 'false'}" aria-label="${actionsVisible ? 'Masquer' : 'Afficher'} les actions du message"`
                        : '';

                    return `<article class="mobile-app-message ${isOwn ? 'is-own' : ''} ${actionMarkup ? 'has-actions' : ''} ${actionsVisible ? 'is-actions-visible' : ''}" data-mobile-message-id="${messageId}">
                    <div class="mobile-app-message__bubble" ${bubbleActionAttributes}>
                        ${editMarkup}
                        ${attachmentMarkup}
                        ${codexStatusMarkup}
                        <div class="mobile-app-message__footer">
                            ${actionMarkup}
                            <div class="mobile-app-message__meta">
                                <time datetime="${escapeHtml(message.created_at_iso || '')}">${formatDate(message.created_at_iso, true)}</time>
                                ${message.is_edited ? `<span title="${escapeHtml(message.edited_at_label || '')}">modifié</span>` : ''}
                            </div>
                        </div>
                    </div>
                </article>`;
                };
                return isSelfConversation && message.is_own
                    ? [renderBubble(true), renderBubble(false, true)]
                    : [renderBubble(Boolean(message.is_own))];
            }).join('')
            : '<div class="mobile-app-message-empty"><p>Aucun message pour le moment.</p><span>Écrivez ci-dessous pour commencer la conversation.</span></div>';

        return {
            referentName,
            conversationId,
            maxLength,
            messageListMarkup,
            signature: JSON.stringify({
                messages,
                referentName,
                conversationId,
                isSelfConversation,
                editingMessageId: state.messageEditingId,
                actionsKey: state.messageActionsKey,
            }),
        };
    }

    function scrollMessageConversationToBottom() {
        window.requestAnimationFrame(() => {
            const content = app.querySelector('.mobile-app-content');
            if (content) content.scrollTop = content.scrollHeight;
        });
    }

    function updateMessageConversation(data, forceScroll = false) {
        state.messagePayload = data;
        const presentation = messagePresentation(data);
        const messageList = app.querySelector('.mobile-app-message-list');
        if (!messageList) return;
        state.messageConversationId = presentation.conversationId;
        persistNavigation();

        const content = app.querySelector('.mobile-app-content');
        const wasNearBottom = !content
            || content.scrollHeight - content.scrollTop - content.clientHeight <= 80;
        const heading = app.querySelector('[data-mobile-message-heading]');
        if (heading) heading.textContent = presentation.referentName;

        const composer = app.querySelector('#mobile-message-body');
        if (composer instanceof HTMLTextAreaElement) {
            if (presentation.maxLength) composer.maxLength = presentation.maxLength;
            else composer.removeAttribute('maxlength');
        }

        if (presentation.signature !== state.messageListSignature) {
            messageList.innerHTML = presentation.messageListMarkup;
            state.messageListSignature = presentation.signature;
            if (forceScroll || wasNearBottom) scrollMessageConversationToBottom();
        }
    }

    function renderMessageEditingState(focusInput = false) {
        if (!state.messagePayload) return;
        state.messageListSignature = '';
        updateMessageConversation(state.messagePayload);
        if (focusInput) {
            window.requestAnimationFrame(() => {
                const input = app.querySelector('[data-mobile-message-edit-input]');
                if (!(input instanceof HTMLTextAreaElement)) return;
                input.focus({ preventScroll: true });
                input.setSelectionRange(input.value.length, input.value.length);
            });
        }
    }

    function toggleMessageActions(actionKey) {
        state.messageActionsKey = state.messageActionsKey === actionKey ? null : actionKey;
        renderMessageEditingState();
    }

    async function copyMessage(messageId, button) {
        const message = Array.isArray(state.messagePayload?.messages)
            ? state.messagePayload.messages.find((candidate) => Number(candidate.id) === messageId)
            : null;
        const body = String(message?.body || '');
        if (!body.trim()) return;

        try {
            await navigator.clipboard.writeText(body);
        } catch (_) {
            const fallback = document.createElement('textarea');
            fallback.value = body;
            fallback.setAttribute('readonly', '');
            fallback.style.position = 'fixed';
            fallback.style.opacity = '0';
            document.body.appendChild(fallback);
            fallback.select();
            document.execCommand('copy');
            fallback.remove();
        }

        button.setAttribute('aria-label', 'Message copié');
        button.setAttribute('title', 'Message copié');
        window.setTimeout(() => {
            if (!button.isConnected) return;
            button.setAttribute('aria-label', 'Copier le message');
            button.setAttribute('title', 'Copier le message');
        }, 1500);
    }

    function closeMessageDeleteDialog() {
        if (state.messageDeleteInFlight) return;
        app.querySelector('[data-mobile-message-delete-dialog]')?.remove();
        state.messageDeletingId = null;
    }

    function openMessageDeleteDialog(messageId) {
        const message = Array.isArray(state.messagePayload?.messages)
            ? state.messagePayload.messages.find((candidate) => Number(candidate.id) === messageId)
            : null;
        if (!messageId || !message?.can_delete || state.messageDeleteInFlight) return;

        state.messageDeletingId = messageId;
        app.querySelector('[data-mobile-message-delete-dialog]')?.remove();
        app.querySelector('.mobile-app-shell')?.insertAdjacentHTML('beforeend', `
            <div class="mobile-app-message-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="mobile-message-delete-title" data-mobile-message-delete-dialog>
                <section>
                    <header>
                        <h2 id="mobile-message-delete-title">Supprimer le message</h2>
                        <button type="button" aria-label="Fermer" title="Fermer" data-mobile-message-delete-close>&times;</button>
                    </header>
                    <p>Ce message sera supprimé définitivement.</p>
                    <p class="mobile-app-message-delete-dialog__error" role="alert" data-mobile-message-delete-error hidden></p>
                    <footer><button type="button" data-mobile-message-delete-confirm>Supprimer</button></footer>
                </section>
            </div>`);
        window.requestAnimationFrame(() => app.querySelector('[data-mobile-message-delete-close]')?.focus());
    }

    function stopMessagePolling() {
        if (state.messageRefreshTimer !== null) {
            window.clearInterval(state.messageRefreshTimer);
            state.messageRefreshTimer = null;
        }
        if (state.messageSelectorSearchTimer !== null) {
            window.clearTimeout(state.messageSelectorSearchTimer);
            state.messageSelectorSearchTimer = null;
        }
        state.messageRefreshGeneration += 1;
        state.messageRequestSequence += 1;
        state.messageSelectorRequestSequence += 1;
        state.messageListSignature = '';
        state.messagePayload = null;
        state.messageActionsKey = null;
        state.messageEditingId = null;
        state.messageEditingBody = '';
        state.messageEditInFlight = false;
        state.messageDeletingId = null;
        state.messageDeleteInFlight = false;
    }

    async function refreshMessageConversation(generation = state.messageRefreshGeneration) {
        if (
            generation !== state.messageRefreshGeneration
            || state.messageRefreshInFlight
            || state.messageSendInFlight
            || state.messageEditInFlight
            || state.messageDeleteInFlight
            || state.route !== 'messages'
            || state.offline
            || document.hidden
            || app.querySelector('[data-mobile-system-overview]')
        ) return;

        state.messageRefreshInFlight = true;
        const requestSequence = ++state.messageRequestSequence;
        try {
            const response = await api(messageConversationEndpoint());
            if (
                generation === state.messageRefreshGeneration
                && requestSequence === state.messageRequestSequence
                && state.route === 'messages'
            ) {
                updateMessageConversation(response.data || {});
            }
        } catch (_) {
            // La prochaine synchronisation récupérera silencieusement un éventuel échec réseau.
        } finally {
            state.messageRefreshInFlight = false;
        }
    }

    function startMessagePolling() {
        const generation = ++state.messageRefreshGeneration;
        state.messageRefreshTimer = window.setInterval(
            () => refreshMessageConversation(generation),
            messageRefreshIntervalMs,
        );
    }

    function positionMessageSelectorOverlay(selector, trigger) {
        const shell = app.querySelector('.mobile-app-shell');
        const content = app.querySelector('.mobile-app-content--messages');
        const anchor = trigger?.closest('.mobile-app-message-thread__sticky') || trigger;
        if (!selector || !shell || !content || !anchor) return;

        const shellRect = shell.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const anchorRect = anchor.getBoundingClientRect();
        const horizontalInset = 16;
        const top = Math.max(0, anchorRect.bottom - shellRect.top);
        const left = Math.max(0, contentRect.left - shellRect.left + horizontalInset);
        const width = Math.max(0, contentRect.width - (horizontalInset * 2));
        const maxHeight = Math.max(160, Math.min(384, shellRect.height - top - 12));

        if (selector.parentElement !== shell) shell.append(selector);
        selector.classList.add('is-shell-overlay');
        selector.style.top = `${Math.round(top)}px`;
        selector.style.right = 'auto';
        selector.style.left = `${Math.round(left)}px`;
        selector.style.width = `${Math.round(width)}px`;
        selector.style.maxHeight = `${Math.round(maxHeight)}px`;
    }

    function closeMessageSelector() {
        const selector = app.querySelector('[data-mobile-message-selector]');
        const trigger = app.querySelector('[data-mobile-message-selector-toggle]');
        if (selector) selector.hidden = true;
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }

    function renderMessageSelector(data) {
        const users = Array.isArray(data.users) ? data.users : [];
        const conversations = Array.isArray(data.conversations) ? data.conversations : [];
        const codex = data.codex && typeof data.codex === 'object' ? data.codex : null;
        const query = String(data.query || '').trim();
        const userResults = app.querySelector('[data-mobile-message-user-results]');
        const conversationList = app.querySelector('[data-mobile-message-conversations]');
        if (!userResults || !conversationList) return;

        userResults.innerHTML = query.length < 2
            ? '<p>Saisissez au moins 2 caractères pour rechercher un utilisateur.</p>'
            : (users.length
                ? users.map((user) => {
                    const conversationId = Math.max(0, Number(user.conversation_id) || 0);
                    const creationDisabled = conversationId === 0 && state.readOnly;

                    return `<button type="button" data-mobile-message-user="${Number(user.id)}" data-mobile-message-user-conversation="${conversationId}" ${creationDisabled ? 'disabled title="Action indisponible en lecture seule"' : ''}><strong>${escapeHtml(user.name || 'Utilisateur')}</strong><span>${escapeHtml(user.role_label || user.email || '')}</span></button>`;
                }).join('')
                : '<p>Aucun utilisateur trouvé.</p>');
        const codexMarkup = codex?.available && codex?.visible
            ? `<button type="button" data-mobile-message-codex="${Math.max(0, Number(codex.conversation_id) || 0)}" class="${Number(codex.conversation_id) === Number(state.messageConversationId) ? 'is-active' : ''}"><span><strong>${escapeHtml(codex.title || 'Codex')}</strong><small>${escapeHtml(codex.subtitle || 'Assistant Codex Maison Pilote')}</small></span>${Number(codex.unread_count) > 0 ? `<em>${Number(codex.unread_count)}</em>` : ''}</button>`
            : '';
        const conversationMarkup = conversations.map((conversation) => `<button type="button" data-mobile-message-conversation="${Number(conversation.id)}" class="${Number(conversation.id) === Number(state.messageConversationId) ? 'is-active' : ''}"><span><strong>${escapeHtml(conversation.title || 'Conversation')}</strong><small>${escapeHtml(conversation.last_message_preview || 'Conversation ouverte')}</small></span>${Number(conversation.unread_count) > 0 ? `<em>${Number(conversation.unread_count)}</em>` : ''}</button>`).join('');
        conversationList.innerHTML = codexMarkup || conversationMarkup
            ? `${codexMarkup}${conversationMarkup}`
            : `<p>${query ? 'Aucune conversation correspondante.' : 'Aucune conversation existante.'}</p>`;
    }

    async function loadMessageSelector(query = '') {
        const requestSequence = ++state.messageSelectorRequestSequence;
        try {
            const response = await api(`/dossiers/${state.activeDossierId}/referent-conversation/selector?q=${encodeURIComponent(query)}`);
            if (requestSequence === state.messageSelectorRequestSequence && state.route === 'messages') {
                renderMessageSelector(response.data || {});
            }
        } catch (_) {
            const userResults = app.querySelector('[data-mobile-message-user-results]');
            const conversationList = app.querySelector('[data-mobile-message-conversations]');
            if (userResults && requestSequence === state.messageSelectorRequestSequence) {
                userResults.innerHTML = '<p>Impossible de rechercher les utilisateurs.</p>';
            }
            if (conversationList && requestSequence === state.messageSelectorRequestSequence) {
                conversationList.innerHTML = '<p>Impossible de charger les conversations.</p>';
            }
        }
    }

    async function selectMessageConversation(conversationId) {
        if (!conversationId || state.messageSendInFlight) return;
        state.messageEditingId = null;
        state.messageEditingBody = '';
        state.messageActionsKey = null;
        state.messageSendInFlight = true;
        const requestSequence = ++state.messageRequestSequence;
        try {
            const response = await api(`/dossiers/${state.activeDossierId}/referent-conversation?conversation_id=${encodeURIComponent(conversationId)}`);
            if (requestSequence === state.messageRequestSequence && state.route === 'messages') {
                app.querySelector('[data-mobile-message-form]')?.reset();
                updateMessageConversation(response.data || {}, true);
                closeMessageSelector();
            }
        } catch (error) {
            renderError(error, 'messages');
        } finally {
            state.messageSendInFlight = false;
        }
    }

    async function startMessageConversation(userId) {
        userId = Number(userId) || 0;
        if (!userId || state.readOnly || state.messageSendInFlight) return;
        state.messageEditingId = null;
        state.messageEditingBody = '';
        state.messageActionsKey = null;
        state.messageSendInFlight = true;
        const requestSequence = ++state.messageRequestSequence;
        try {
            const response = await api(`/dossiers/${state.activeDossierId}/referent-conversation/start`, {
                method: 'POST',
                body: { target_user_id: userId },
            });
            if (requestSequence === state.messageRequestSequence && state.route === 'messages') {
                app.querySelector('[data-mobile-message-form]')?.reset();
                updateMessageConversation(response.data || {}, true);
                closeMessageSelector();
            }
        } catch (error) {
            renderError(error, 'messages');
        } finally {
            state.messageSendInFlight = false;
        }
    }

    async function startCodexConversation() {
        if (state.readOnly || state.messageSendInFlight) return;
        state.messageEditingId = null;
        state.messageEditingBody = '';
        state.messageActionsKey = null;
        state.messageSendInFlight = true;
        const requestSequence = ++state.messageRequestSequence;
        try {
            const response = await api(`/dossiers/${state.activeDossierId}/referent-conversation/start`, {
                method: 'POST',
                body: { codex: true },
            });
            if (requestSequence === state.messageRequestSequence && state.route === 'messages') {
                app.querySelector('[data-mobile-message-form]')?.reset();
                updateMessageConversation(response.data || {}, true);
                closeMessageSelector();
            }
        } catch (error) {
            renderError(error, 'messages');
        } finally {
            state.messageSendInFlight = false;
        }
    }

    async function renderMessages(params = {}) {
        const requestedConversationId = Math.max(0, Number(params.conversationId) || 0);
        if (requestedConversationId > 0) state.messageConversationId = requestedConversationId;
        const response = await api(messageConversationEndpoint());
        const data = response.data || {};
        const presentation = messagePresentation(data);
        state.messagePayload = data;
        state.messageConversationId = presentation.conversationId;
        state.messageListSignature = presentation.signature;
        persistNavigation();

        const composerMarkup = `<form class="mobile-app-message-composer" data-mobile-message-form>
            <label class="visually-hidden" for="mobile-message-body">Votre message</label>
            <textarea id="mobile-message-body" name="message" rows="2" placeholder="Votre message" required ${presentation.maxLength ? `maxlength="${presentation.maxLength}"` : ''}></textarea>
            <button class="mobile-app-message-send" type="submit" aria-label="Envoyer le message" ${state.readOnly ? 'disabled title="Action indisponible en lecture seule"' : 'title="Envoyer le message"'}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2 .01 7Z"/></svg>
            </button>
        </form>`;

        renderFrame('Messagerie', `<div class="mobile-app-message-thread">
            <div class="mobile-app-message-thread__sticky">
                <div class="mobile-app-message-thread__heading"><span>Conversation avec&nbsp;</span><button type="button" data-mobile-message-selector-toggle aria-expanded="false"><strong data-mobile-message-heading>${escapeHtml(presentation.referentName)}</strong><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9.5 5 5 5-5 1.4 1.4-6.4 6.4-6.4-6.4L7 9.5Z"/></svg></button></div>
                <section class="mobile-app-message-selector" data-mobile-message-selector hidden>
                    <label for="mobile-message-user-search">Rechercher un utilisateur</label>
                    <input id="mobile-message-user-search" type="search" placeholder="Nom ou adresse e-mail" autocomplete="off" data-mobile-message-user-search>
                    <div class="mobile-app-message-selector__users" data-mobile-message-user-results></div>
                    <h3>Conversations existantes</h3>
                    <div class="mobile-app-message-selector__conversations" data-mobile-message-conversations><p>Chargement…</p></div>
                </section>
            </div>
            <div class="mobile-app-message-list">${presentation.messageListMarkup}</div>
        </div>`, {
            tab: 'more',
            bottomPanel: composerMarkup,
            contentClass: 'mobile-app-content--messages',
        });
        scrollMessageConversationToBottom();
        startMessagePolling();
    }

    function selectOptions(options, selected) {
        return Object.entries(options || {}).map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
    }

    async function renderUserSettings(message = '', messageType = 'success') {
        const response = await api('/user-settings');
        const data = response.data || {};
        const profile = data.profile || {};
        const preferences = data.preferences || {};
        const options = data.options || {};
        const disabled = !data.editable || state.readOnly;
        const alert = message ? `<div class="mobile-app-settings-message is-${escapeHtml(messageType)}" role="status">${escapeHtml(message)}</div>` : '';
        const avatar = profile.avatar_url
            ? `<img src="${escapeHtml(profile.avatar_url)}" alt="Photo de profil">`
            : `<span>${escapeHtml(profile.avatar_initials || 'U')}</span>`;
        const pendingEmail = profile.pending_email ? `<div class="mobile-app-list-item"><strong>Adresse e-mail en attente</strong><p>${escapeHtml(profile.pending_email)}${profile.pending_email_requested_at_utc ? ` - demandée le ${formatDate(profile.pending_email_requested_at_utc, true)}` : ''}</p><button class="mobile-app-secondary-button mt-2" type="button" data-mobile-resend-email ${disabled ? 'disabled' : ''}>Renvoyer l’e-mail de validation</button></div>` : '';
        const settingsTheme = data.editable ? state.themePreference : (preferences.theme_mode || 'system');
        const biometricSettings = data.editable && (!iosRuntime || nativeBiometricBridgeAvailable) ? `<div class="mobile-app-section-title mt-3"><h2>Connexion</h2></div>
            <div class="mobile-app-form-panel">
                <label class="mobile-app-biometric-switch">
                    <span class="mobile-app-biometric-switch__copy"><strong>Connexion biométrique</strong><small>Utiliser l’empreinte, le visage ou le verrouillage de l’appareil pour ouvrir Maison Pilote.</small></span>
                    <input type="checkbox" data-mobile-biometric-setting ${state.biometricEnabled ? 'checked' : ''}>
                    <span class="mobile-app-biometric-switch__track" aria-hidden="true"><span></span></span>
                </label>
            </div>` : '';
        const advancedPreferences = data.is_salarie ? `<input type="hidden" name="preferred_consultation_period_mode" value="${escapeHtml(preferences.preferred_consultation_period_mode)}"><input type="hidden" name="preferred_immobilisation_consultation_date_mode" value="${escapeHtml(preferences.preferred_immobilisation_consultation_date_mode)}"><input type="hidden" name="preferred_entry_amount_mode" value="${escapeHtml(preferences.preferred_entry_amount_mode)}"><input type="hidden" name="highlight_abnormal_balance" value="${preferences.highlight_abnormal_balance ? '1' : '0'}">` : `
            <div class="mobile-app-field"><label for="mobile-preference-period">Période de consultation</label><select id="mobile-preference-period" name="preferred_consultation_period_mode" required>${selectOptions(options.preferred_consultation_period_mode, preferences.preferred_consultation_period_mode)}</select></div>
            <div class="mobile-app-field"><label for="mobile-preference-immobilisation">Date de consultation des immobilisations</label><select id="mobile-preference-immobilisation" name="preferred_immobilisation_consultation_date_mode" required>${selectOptions(options.preferred_immobilisation_consultation_date_mode, preferences.preferred_immobilisation_consultation_date_mode)}</select></div>
            <div class="mobile-app-field"><label for="mobile-preference-amount">Saisie des montants</label><select id="mobile-preference-amount" name="preferred_entry_amount_mode" required>${selectOptions(options.preferred_entry_amount_mode, preferences.preferred_entry_amount_mode)}</select></div>
            <div class="mobile-app-field"><label for="mobile-preference-switch">Après un changement de dossier</label><select id="mobile-preference-switch" name="preferred_dossier_switch_destination">${selectOptions(options.preferred_dossier_switch_destination, preferences.preferred_dossier_switch_destination)}</select></div>
            <div class="mobile-app-field"><label for="mobile-preference-home">Accueil d’un dossier</label><select id="mobile-preference-home" name="preferred_home_destination">${selectOptions(options.preferred_home_destination, preferences.preferred_home_destination)}</select></div>
            <label class="mobile-app-settings-check"><input type="checkbox" name="highlight_abnormal_balance" value="1" ${preferences.highlight_abnormal_balance ? 'checked' : ''}> <span>Mettre en évidence les soldes anormaux</span></label>`;

        renderFrame('Paramètres utilisateur', `${alert}${!data.editable ? '<div class="mobile-app-settings-message is-warning">Les paramètres de la personne émulée restent protégés.</div>' : ''}
            <div class="mobile-app-section-title"><h2>Profil</h2></div>
            <form class="mobile-app-form-panel" data-mobile-user-profile>
                <div class="mobile-app-profile-avatar">${avatar}</div>
                <div class="mobile-app-profile-photo-actions"><label class="mobile-app-secondary-button" for="mobile-user-selfie">${quickActionIcons.camera}<span>Selfie</span></label><input id="mobile-user-selfie" type="file" name="selfie_logo" accept="image/*" capture="user" ${disabled ? 'disabled' : ''}><label class="mobile-app-secondary-button" for="mobile-user-logo">${quickActionIcons.file}<span>Import</span></label><input id="mobile-user-logo" type="file" name="logo" accept="image/jpeg,image/png,image/gif,image/bmp,image/webp,image/svg+xml,image/avif" ${disabled ? 'disabled' : ''}></div>
                ${profile.avatar_url ? `<label class="mobile-app-settings-check"><input type="checkbox" name="remove_logo" value="1" ${disabled ? 'disabled' : ''}> <span>Supprimer la photo actuelle</span></label>` : ''}
                <div class="mobile-app-field"><label for="mobile-user-name">Identifiant</label><input id="mobile-user-name" name="name" value="${escapeHtml(profile.name)}" required maxlength="255" ${disabled ? 'disabled' : ''}></div>
                <div class="mobile-app-field"><label for="mobile-user-first-name">Prénom</label><input id="mobile-user-first-name" name="first_name" value="${escapeHtml(profile.first_name)}" maxlength="120" ${disabled ? 'disabled' : ''}></div>
                <div class="mobile-app-field"><label for="mobile-user-last-name">Nom</label><input id="mobile-user-last-name" name="last_name" value="${escapeHtml(profile.last_name)}" required maxlength="120" ${disabled ? 'disabled' : ''}></div>
                <div class="mobile-app-field"><label for="mobile-user-email">Adresse e-mail</label><input id="mobile-user-email" type="email" name="email" value="${escapeHtml(profile.email)}" required maxlength="255" ${disabled ? 'disabled' : ''}></div>
                <div class="mobile-app-field"><label for="mobile-user-phone">Téléphone</label><input id="mobile-user-phone" type="tel" name="phone" value="${escapeHtml(formatPhoneValue(profile.phone))}" maxlength="40" autocomplete="tel" inputmode="tel" data-mobile-phone-spacing data-mobile-quick-entry ${disabled ? 'disabled' : ''}></div>
                <input type="hidden" name="update_email" value="1">
                <button class="mobile-app-primary-button" type="submit" ${disabled ? 'disabled' : ''}>Enregistrer le profil</button>
            </form>
            ${pendingEmail}
            <div class="mobile-app-section-title mt-3"><h2>Mot de passe</h2></div>
            <div class="mobile-app-form-panel"><p class="mb-0">Recevez par e-mail un lien sécurisé pour choisir un nouveau mot de passe.</p><button class="mobile-app-secondary-button" type="button" data-mobile-password-reset ${disabled ? 'disabled' : ''}>Envoyer le lien de réinitialisation</button></div>
            ${biometricSettings}
            <div class="mobile-app-section-title mt-3"><h2>Préférences</h2></div>
            <form class="mobile-app-form-panel" data-mobile-user-preferences>
                <div class="mobile-app-field"><label for="mobile-preference-theme">Apparence</label><select id="mobile-preference-theme" name="theme_mode" ${disabled ? 'disabled' : ''}>${selectOptions(options.theme_mode, settingsTheme)}</select></div>
                ${data.is_salarie ? `<input type="hidden" name="notifications_mode" value="${escapeHtml(preferences.notifications_mode)}">` : `<div class="mobile-app-field"><label for="mobile-preference-notifications">Notifications du site</label><select id="mobile-preference-notifications" name="notifications_mode" ${disabled ? 'disabled' : ''}>${selectOptions(options.notifications_mode, preferences.notifications_mode)}</select></div>`}
                ${advancedPreferences}
                <button class="mobile-app-primary-button" type="submit" ${disabled ? 'disabled' : ''}>Enregistrer les préférences</button>
            </form>${mobilePrivacyLink()}`, { tab: 'more' });
    }

    function renderDesktopLink() {
        renderFrame('Version ordinateur', `<div class="mobile-app-form-panel"><p>Cette fonctionnalité est plutôt conçue pour être utilisée sur un ordinateur. Vous allez ouvrir la version complète de Maison Pilote.</p><button class="mobile-app-primary-button" type="button" data-open-desktop>Ouvrir la version ordinateur</button></div>`, { tab: 'more' });
    }

    function formDataObject(form) {
        const data = {};
        new FormData(form).forEach((value, key) => {
            if (value === '') return;
            if (key.endsWith('[]')) {
                const arrayKey = key.slice(0, -2);
                if (!Array.isArray(data[arrayKey])) data[arrayKey] = [];
                data[arrayKey].push(value);
            } else {
                data[key] = value;
            }
        });
        form.querySelectorAll('input[type="checkbox"]:not([name$="[]"]):not(:disabled)').forEach((input) => {
            if (input.name) data[input.name] = input.checked;
        });
        for (const key of ['payroll_employee_id', 'payroll_leave_type_id', 'fiscal_power', 'vehicle_id', 'recurrence_interval', 'reminder_days_before', 'report_id', 'trip_id', 'lock_version', 'registration_ged_document_id', 'receipt_ged_document_id']) {
            if (data[key] !== undefined && data[key] !== '') data[key] = Number(data[key]);
        }
        return data;
    }

    async function submitMobileForm(form) {
        if (state.readOnly) return;
        const kind = form.dataset.mobileForm;
        if (kind === 'absence' && form.dataset.mobileAbsenceCanSubmit !== '1') return;
        const data = formDataObject(form);
        const quickOrigin = form.dataset.mobileQuickOrigin === 'home';
        const absenceListOrigin = kind === 'absence' && form.dataset.mobileQuickOrigin === 'absences';
        if (kind === 'task') {
            const selectedDossierId = String(form.elements.dossier_id?.value ?? '').trim();
            data.dossier_id = selectedDossierId === '' ? null : Number(selectedDossierId);
        }
        if (kind === 'report') {
            if (['immobilisations', 'loans'].includes(String(data.report_type || ''))) {
                data.period_start = data.as_of;
                data.period_end = data.as_of;
            }
            delete data.as_of;
        }
        if (kind === 'expense_item') {
            const reportId = Number(data.report_id) || 0;
            delete data.report_id;
            if (!reportId) return;
            const button = form.querySelector('button[type="submit"]');
            if (button) { button.disabled = true; button.textContent = 'Enregistrement…'; }
            try {
                const headerResponse = await api(`/dossiers/${state.activeDossierId}/expense-reports/${reportId}`, {
                    method: 'PATCH',
                    body: {
                        lock_version: Number(data.lock_version) || 0,
                        title: String(data.title || '').trim(),
                        period_start: data.period_start,
                        period_end: data.period_start,
                    },
                });
                data.lock_version = Number(headerResponse.data?.lock_version) || 0;
                data.expense_date = data.period_start;
                data.business_purpose = String(data.title || '').trim();
                delete data.title;
                delete data.period_start;
                const response = await api(`/dossiers/${state.activeDossierId}/expense-reports/${reportId}/items`, { method: 'POST', body: data });
                await api(`/dossiers/${state.activeDossierId}/expense-reports/${reportId}/transition`, {
                    method: 'POST',
                    body: { transition: 'submit', lock_version: Number(response.data?.lock_version) || 0 },
                });
                dismissContextualUpload('expense_report', reportId);
                clearExpenseItemDraft(reportId);
                if (quickOrigin) {
                    app.querySelector('[data-mobile-quick-creation]')?.remove();
                    showQuickCreationNotice('Demande de remboursement créée.');
                }
                else await navigate('expenses');
            } catch (error) { renderError(error, state.route); }
            return;
        }
        if (kind === 'mileage_trip') {
            const tripId = Number(data.trip_id) || 0;
            delete data.trip_id;
            if (!tripId) delete data.lock_version;
            const button = form.querySelector('button[type="submit"]');
            if (button) { button.disabled = true; button.textContent = 'Enregistrement…'; }
            try {
                await api(`/dossiers/${state.activeDossierId}/mileage/trips${tripId ? `/${tripId}` : ''}`, { method: tripId ? 'PATCH' : 'POST', body: data });
                if (quickOrigin) {
                    app.querySelector('[data-mobile-quick-creation]')?.remove();
                    showQuickCreationNotice('Voyage créé.');
                }
                else await navigate('mileage');
            } catch (error) { renderError(error, state.route); }
            return;
        }
        if (kind === 'mileage_submit') {
            const button = form.querySelector('button[type="submit"]');
            if (button) { button.disabled = true; button.textContent = 'Envoi…'; }
            try {
                await api(`/dossiers/${state.activeDossierId}/mileage/submit`, { method: 'POST', body: data });
                if (quickOrigin) {
                    app.querySelector('[data-mobile-quick-creation="mileage-submit"]')?.remove();
                    showQuickCreationNotice('IK transmises pour validation.');
                } else {
                    await navigate('mileage', { period: 'all', status: 'unvalidated' });
                }
            } catch (error) {
                if (!quickOrigin) {
                    renderError(error, state.route);
                    return;
                }
                const feedback = form.querySelector('[data-mobile-mileage-submit-error]');
                if (feedback) {
                    feedback.hidden = false;
                    feedback.textContent = error?.message || 'La transmission des IK a échoué.';
                }
                if (button) {
                    button.disabled = false;
                    button.textContent = 'Envoyer en validation';
                }
            }
            return;
        }
        if (kind === 'mileage_vehicle') {
            if (!Number(data.registration_ged_document_id)) return;
            const quickSettings = Boolean(form.closest('[data-mobile-quick-creation="mileage-settings"]'));
            const button = form.querySelector('button[type="submit"]');
            if (button) { button.disabled = true; button.textContent = 'Enregistrement…'; }
            try {
                await api(`/dossiers/${state.activeDossierId}/mileage/vehicles`, { method: 'POST', body: data });
                dismissContextualUpload('mileage_registration');
                if (quickSettings) {
                    app.querySelector('[data-mobile-quick-creation="mileage-settings"]')?.remove();
                    if (state.route === 'mileage') await renderMileage(state.routeParams || {});
                    showQuickCreationNotice('Situation IK enregistrée.');
                } else await navigate('mileage');
            } catch (error) { renderError(error, state.route); }
            return;
        }
        if (kind === 'report') {
            const button = form.querySelector('button[type="submit"]');
            if (button) { button.disabled = true; button.textContent = 'Envoi…'; }
            try {
                await api(`/dossiers/${state.activeDossierId}/reports`, { method: 'POST', body: data });
                if (quickOrigin) {
                    app.querySelector('[data-mobile-quick-creation="report"]')?.remove();
                    await navigate('reports');
                    showQuickCreationNotice('La génération est lancée. Vous recevrez une notification dès que l’état sera prêt.');
                } else {
                    await renderReportForm('La génération est lancée. Vous recevrez une notification dès que l’état sera prêt.');
                }
            } catch (error) {
                if (quickOrigin) {
                    if (button) { button.disabled = false; button.textContent = 'Lancer la génération'; }
                    showQuickCreationNotice(error?.message || 'La génération n’a pas pu être lancée.');
                } else renderError(error, state.route);
            }
            return;
        }
        const routes = {
            task: [`/dossiers/${state.activeDossierId}/tasks`, 'tasks'],
            absence: [`/dossiers/${state.activeDossierId}/absences`, 'absences'],
            sales: [`/dossiers/${state.activeDossierId}/sales-revenue`, 'sales_revenue'],
        };
        const [path, destination] = routes[kind] || [];
        if (!path) return;
        const button = form.querySelector('button[type="submit"]');
        if (kind === 'absence') setMobileAbsenceFormError(form);
        if (button) { button.disabled = true; button.textContent = 'Envoi…'; }
        try {
            await api(path, { method: 'POST', body: data });
            if (quickOrigin) {
                app.querySelector(`[data-mobile-quick-creation="${kind}"]`)?.remove();
                showQuickCreationNotice(kind === 'absence' ? 'Demande d’absence transmise.' : 'Tâche créée.');
            } else if (absenceListOrigin) {
                app.querySelector('[data-mobile-quick-creation="absence"]')?.remove();
                await renderAbsences(state.routeParams || {});
                showQuickCreationNotice('Demande d’absence transmise.');
            } else {
                await navigate(destination, kind === 'absence' ? {
                    employeeId: Number(data.payroll_employee_id) || 0,
                    year: String(data.starts_on || '').slice(0, 4) || String(new Date().getFullYear()),
                } : {});
            }
        } catch (error) {
            if (kind === 'absence') {
                setMobileAbsenceFormError(form, mobileAbsenceErrorMessage(error));
                if (button) {
                    button.disabled = state.readOnly || form.dataset.mobileAbsenceCanSubmit !== '1';
                    button.textContent = 'Transmettre la demande';
                }
                return;
            }
            if (quickOrigin) {
                if (button) {
                    button.disabled = false;
                    button.textContent = kind === 'absence' ? 'Transmettre la demande' : 'Créer la tâche';
                }
                showQuickCreationNotice(error?.message || 'La création n’a pas pu être enregistrée.');
            } else renderError(error, state.route);
        }
    }

    function dismissNotificationsFromBinaryResponse(response) {
        const ids = new Set(String(response?.headers?.get('X-Maison-Pilote-Dismiss-Notifications') || '')
            .split(',')
            .map((value) => Number.parseInt(value.trim(), 10))
            .filter((value) => Number.isFinite(value) && value > 0));
        if (!ids.size) return;

        state.notificationItems = state.notificationItems.filter((item) => !ids.has(Number(item.id)));
        if (state.route === 'notifications') renderNotificationsContent();
    }

    function nativeOutgoingDocumentError(message, code = 'native_document_bridge_unavailable') {
        const error = new Error(message);
        error.name = 'NativeOutgoingDocumentError';
        error.code = code;
        return error;
    }

    function nativeOutgoingDocumentCommand(action, payload = {}) {
        const bridge = window.MaisonPiloteNative?.outgoingDocument;
        const command = bridge?.[action];
        if (!nativeOutgoingDocumentBridgeAvailable || typeof command !== 'function') {
            return Promise.reject(nativeOutgoingDocumentError(
                "L'iPhone ne peut pas ouvrir ce document avec cette version de l'application.",
            ));
        }

        const requestId = crypto.randomUUID().toLowerCase();
        return new Promise((resolve, reject) => {
            const timer = window.setTimeout(() => {
                nativeOutgoingDocumentRequests.delete(requestId);
                reject(nativeOutgoingDocumentError(
                    "L'iPhone n'a pas confirmé la préparation du document.",
                    'native_document_timeout',
                ));
            }, 30_000);
            nativeOutgoingDocumentRequests.set(requestId, { action, resolve, reject, timer });
            try {
                if (command({ ...payload, requestId }) !== true) {
                    throw nativeOutgoingDocumentError(
                        "Le pont documentaire de l'iPhone n'est pas disponible.",
                    );
                }
            } catch (error) {
                window.clearTimeout(timer);
                nativeOutgoingDocumentRequests.delete(requestId);
                reject(error instanceof Error ? error : nativeOutgoingDocumentError('Le document ne peut pas être préparé.'));
            }
        });
    }

    function acceptNativeOutgoingDocumentResult(detail) {
        const requestId = String(detail?.request_id || '').toLowerCase();
        const pending = nativeOutgoingDocumentRequests.get(requestId);
        if (!pending) return;
        window.clearTimeout(pending.timer);
        nativeOutgoingDocumentRequests.delete(requestId);

        if (detail?.success === true && String(detail?.action || '') === pending.action) {
            pending.resolve(detail);
            return;
        }

        const error = nativeOutgoingDocumentError(
            String(detail?.error?.message || 'Le document ne peut pas être préparé sur cet iPhone.'),
            String(detail?.error?.code || 'native_document_failed'),
        );
        error.expectedOffset = Number(detail?.expected_offset);
        error.receivedSize = Number(detail?.received_size);
        pending.reject(error);
    }

    function nativeOutgoingDocumentMimeType(blob, response, requestedMimeType = '') {
        const candidates = [
            requestedMimeType,
            blob?.type,
            response?.headers?.get('Content-Type'),
            'application/octet-stream',
        ];
        for (const candidate of candidates) {
            const normalized = String(candidate || '').split(';', 1)[0].trim().toLowerCase();
            if (/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalized)) return normalized;
        }
        return 'application/octet-stream';
    }

    function nativeOutgoingDocumentFilename(value, mimeType) {
        const extensions = {
            'application/pdf': '.pdf',
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'text/csv': '.csv',
            'application/zip': '.zip',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        };
        let filename = String(value || 'document')
            .normalize('NFC')
            .split(/[\\/]/).pop()
            .replace(/[\u0000-\u001f\u007f:]/g, '-')
            .trim()
            .replace(/^\.+/, '');
        if (!filename || filename.toLowerCase() === 'transfer.json') filename = 'document';
        if (!/\.[a-z0-9]{1,12}$/i.test(filename) && extensions[mimeType]) {
            filename += extensions[mimeType];
        }

        const suffix = /\.[a-z0-9]{1,12}$/i.exec(filename)?.[0] || '';
        const stemCharacters = Array.from(suffix ? filename.slice(0, -suffix.length) : filename);
        const encoder = new TextEncoder();
        while (stemCharacters.length > 1 && encoder.encode(`${stemCharacters.join('')}${suffix}`).length > 180) {
            stemCharacters.pop();
        }
        filename = `${stemCharacters.join('')}${suffix}`;
        return encoder.encode(filename).length <= 180 && filename !== '' ? filename : `document${extensions[mimeType] || ''}`;
    }

    function nativeOutgoingDocumentBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 32_768) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
        }
        return window.btoa(binary);
    }

    async function presentNativeOutgoingDocument(blob, response, fallbackFilename, mode, requestedMimeType = '') {
        if (!(blob instanceof Blob) || !Number.isSafeInteger(blob.size) || blob.size < 1) {
            throw nativeOutgoingDocumentError('Le document reçu est vide ou invalide.', 'invalid_document');
        }
        if (blob.size > nativeOutgoingDocumentMaximumLength) {
            throw nativeOutgoingDocumentError('Le document dépasse la limite de 100 Mio.', 'document_too_large');
        }

        const mimeType = nativeOutgoingDocumentMimeType(blob, response, requestedMimeType);
        const fileName = nativeOutgoingDocumentFilename(
            responseDownloadFilename(response, fallbackFilename),
            mimeType,
        );
        const transferId = crypto.randomUUID().toLowerCase();
        let shouldCancel = false;
        try {
            const started = await nativeOutgoingDocumentCommand('begin', {
                transferId,
                fileName,
                mimeType,
                totalSize: blob.size,
            });
            shouldCancel = true;
            let offset = Number(started?.next_offset);
            if (!Number.isSafeInteger(offset) || offset < 0 || offset > blob.size) {
                throw nativeOutgoingDocumentError('La reprise du document est incohérente.', 'invalid_native_offset');
            }
            const maximumChunkLength = Math.min(
                nativeOutgoingDocumentMaximumChunkLength,
                Math.max(1, Number(started?.max_chunk_size) || nativeOutgoingDocumentMaximumChunkLength),
            );

            while (offset < blob.size) {
                const nextOffset = Math.min(blob.size, offset + maximumChunkLength);
                const buffer = await blob.slice(offset, nextOffset).arrayBuffer();
                const appended = await nativeOutgoingDocumentCommand('append', {
                    transferId,
                    offset,
                    dataBase64: nativeOutgoingDocumentBase64(buffer),
                });
                const acknowledgedOffset = Number(appended?.next_offset);
                if (!Number.isSafeInteger(acknowledgedOffset) || acknowledgedOffset !== nextOffset) {
                    throw nativeOutgoingDocumentError('Un bloc du document n’a pas été confirmé.', 'invalid_native_offset');
                }
                offset = acknowledgedOffset;
            }

            await nativeOutgoingDocumentCommand('finish', { transferId, mode });
            shouldCancel = false;
        } finally {
            if (shouldCancel) {
                await nativeOutgoingDocumentCommand('cancel', { transferId }).catch(() => {});
            }
        }
    }

    async function openBinary(url, trigger = null) {
        if (!url || trigger?.disabled) return;
        const title = String(trigger?.dataset.openBinaryTitle
            || trigger?.querySelector('h3')?.textContent
            || trigger?.closest('article')?.querySelector('h3')?.textContent
            || 'Document sélectionné').trim();
        if (trigger) {
            trigger.disabled = true;
            trigger.setAttribute('aria-busy', 'true');
        }
        try {
            const { blob, response } = await api(url, { binary: true });
            dismissNotificationsFromBinaryResponse(response);
            if (nativeOutgoingDocumentBridgeAvailable) {
                await presentNativeOutgoingDocument(blob, response, title, 'preview');
                return;
            }
            openExternalApplication({
                kind: 'document',
                action: 'Ouvrir un document',
                details: [
                    { label: 'Document', value: title },
                    { label: 'Source', value: String(url || '').startsWith('http') ? new URL(url).hostname : 'Maison Pilote' },
                ],
            }, trigger);
        } catch (error) {
            renderError(error, state.route);
        } finally {
            if (trigger?.isConnected) {
                trigger.disabled = false;
                trigger.removeAttribute('aria-busy');
            }
        }
    }

    function responseDownloadFilename(response, fallback) {
        const disposition = String(response?.headers?.get('Content-Disposition') || '');
        const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
        const regular = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
        let filename = fallback;
        if (encoded) {
            try { filename = decodeURIComponent(encoded); } catch (_) { filename = encoded; }
        } else if (regular) {
            filename = regular;
        }
        return String(filename || 'document').split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g, '') || 'document';
    }

    async function downloadBinary(url, fallbackFilename, trigger = null, previewPdf = true) {
        if (!url || trigger?.disabled) return;
        const downloadKey = previewPdf ? '' : `${String(url)}|${String(fallbackFilename || '')}`;
        if (downloadKey && state.downloadedDocumentKeys.has(downloadKey)) {
            showQuickCreationNotice('Ce fichier a déjà été téléchargé.');
            return;
        }
        const expectsPdf = previewPdf && String(fallbackFilename || '').toLowerCase().endsWith('.pdf');
        const readerWindow = !nativeOutgoingDocumentBridgeAvailable && expectsPdf
            ? window.open('about:blank', '_blank')
            : null;
        if (readerWindow) readerWindow.opener = null;
        if (trigger) {
            trigger.disabled = true;
            trigger.setAttribute('aria-busy', 'true');
        }
        try {
            const { blob, response } = await api(url, { binary: true });
            dismissNotificationsFromBinaryResponse(response);
            if (nativeOutgoingDocumentBridgeAvailable) {
                await presentNativeOutgoingDocument(
                    blob,
                    response,
                    fallbackFilename,
                    expectsPdf ? 'preview' : 'save',
                );
                if (downloadKey) state.downloadedDocumentKeys.add(downloadKey);
                return;
            }
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = responseDownloadFilename(response, fallbackFilename);
            anchor.hidden = true;
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            if (downloadKey) state.downloadedDocumentKeys.add(downloadKey);
            if (expectsPdf) {
                if (readerWindow) readerWindow.location.href = objectUrl;
                else window.open(objectUrl, '_blank', 'noopener');
            }
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), expectsPdf ? 60_000 : 1000);
        } catch (error) {
            readerWindow?.close();
            renderError(error, 'payslips');
        } finally {
            if (trigger?.isConnected) {
                trigger.disabled = false;
                trigger.removeAttribute('aria-busy');
            }
        }
    }

    async function shareBinary(url, fallbackFilename, mimeType, companyName = '', trigger = null) {
        if (!url || trigger?.dataset.shareBusy === 'true') return;
        if (trigger) {
            trigger.dataset.shareBusy = 'true';
            trigger.setAttribute('aria-busy', 'true');
        }
        try {
            const { blob, response } = await api(url, { binary: true });
            dismissNotificationsFromBinaryResponse(response);
            const filename = responseDownloadFilename(response, fallbackFilename);
            if (nativeOutgoingDocumentBridgeAvailable) {
                await presentNativeOutgoingDocument(blob, response, filename, 'share', mimeType);
                return;
            }
            const file = new File([blob], filename, { type: mimeType || blob.type || 'application/octet-stream' });
            const sharedText = defaultSharedDocumentText(companyName);
            const shareData = { title: filename, text: sharedText, files: [file] };
            if (typeof navigator.share === 'function'
                && (typeof navigator.canShare !== 'function' || navigator.canShare(shareData))) {
                await navigator.share(shareData);
            } else {
                openExternalApplication({
                    kind: 'document',
                    action: 'Partager un document',
                    details: [{ label: 'Document', value: filename }, { label: 'Texte', value: sharedText }],
                }, trigger);
            }
        } catch (error) {
            if (error?.name !== 'AbortError') showQuickCreationNotice('Partage indisponible.');
        } finally {
            if (trigger?.isConnected) {
                delete trigger.dataset.shareBusy;
                trigger.removeAttribute('aria-busy');
            }
        }
    }

    function resolvedSiteTheme() {
        const current = document.documentElement.dataset.theme;
        if (current === 'dark' || current === 'light') return current;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function syncEmulatorTheme() {
        const resolved = state.themePreference === 'system' ? resolvedSiteTheme() : state.themePreference;
        screen.dataset.themePreference = state.themePreference;
        screen.dataset.theme = resolved;
        const control = root.querySelector('[data-emulator-theme]');
        if (control && control.value !== state.themePreference) control.value = state.themePreference;
        app.querySelectorAll('[data-mobile-quick-theme]').forEach((button) => {
            const isSelected = button.dataset.mobileQuickTheme === state.themePreference;
            button.classList.toggle('is-selected', isSelected);
            button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
        const settingsTheme = app.querySelector('#mobile-preference-theme');
        if (settingsTheme instanceof HTMLSelectElement && settingsTheme.value !== state.themePreference) {
            settingsTheme.value = state.themePreference;
            refreshMobileSelect(settingsTheme);
        }
    }

    function syncConnectivityStatus() {
        if (!connectivityStatus) return;
        connectivityStatus.classList.toggle('is-offline', state.offline);
        connectivityStatus.setAttribute('aria-label', state.offline ? 'Mode avion' : 'Réseau mobile 5G');
        connectivityStatus.innerHTML = state.offline
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.3 10.8 1.5-1.5 5.1 1.5 3.9-3.9-9-4.2 2-2 11.1 2.1 2.2-2.2c.8-.8 2-.8 2.8 0s.8 2 0 2.8l-2.2 2.2 2.1 11.1-2 2-4.2-9-3.9 3.9 1.5 5.1-1.5 1.5-2.8-4.2-4.2-2.8Z"/></svg>'
            : '<span data-emulator-connectivity-label>5G</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 15.5h2.2v-2.7H3v2.7Zm3.9 0h2.2V10H6.9v5.5Zm3.9 0H13V7.2h-2.2v8.3Zm3.9 0h2.2V4.4h-2.2v11.1Z"/></svg>';
    }

    function applyDeviceSize() {
        const profile = root.querySelector('[data-emulator-profile]');
        const orientation = root.querySelector('[data-emulator-orientation]');
        if (!profile || !orientation) return;
        if ([...profile.options].some((option) => option.value === state.deviceProfile)) profile.value = state.deviceProfile;
        orientation.value = state.orientation;
        const [width, height] = profile.value.split('x').map(Number);
        const landscape = orientation.value === 'landscape';
        screen.dataset.orientation = landscape ? 'landscape' : 'portrait';
        device.style.setProperty('--emulator-width', `${landscape ? height : width}px`);
        device.style.setProperty('--emulator-height', `${landscape ? width : height}px`);
        window.requestAnimationFrame(() => {
            syncHeaderDisplayName();
            const selector = app.querySelector('[data-mobile-message-selector]:not([hidden])');
            const trigger = app.querySelector('[data-mobile-message-selector-toggle]');
            if (selector && trigger) positionMessageSelectorOverlay(selector, trigger);
        });
    }

    function restoreControls() {
        versionControl.value = String(state.versionCode);
        root.querySelector('[data-emulator-latency]').value = String(state.latency);
        root.querySelector('[data-emulator-offline]').checked = state.offline;
        networkStatus.textContent = state.offline ? 'Hors ligne' : 'En ligne';
        networkStatus.className = `badge ${state.offline ? 'text-bg-warning' : 'text-bg-secondary'}`;
        applyDeviceSize();
        syncEmulatorTheme();
        syncConnectivityStatus();
    }

    async function setWritesEnabled(enabled) {
        const startedAt = performance.now();
        const response = await fetch(root.dataset.configUrl, {
            method: 'PATCH', credentials: 'same-origin', cache: 'no-store',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
            body: JSON.stringify({ real_actions: enabled, confirmation: enabled }),
        });
        const payload = await response.json();
        diagnosticEntry({ method: 'PATCH', path: new URL(root.dataset.configUrl).pathname, status: response.status, duration: Math.round(performance.now() - startedAt), requestId: null });
        if (!response.ok) throw new Error(payload?.message || 'Impossible de modifier le mode d’action.');
        const permanentWrites = Boolean(payload.data.real_actions_permanent) || (state.authenticated && state.owner);
        state.readOnly = permanentWrites ? false : Boolean(payload.data.read_only);
        state.writesUntil = permanentWrites ? null : payload.data.writes_enabled_until_utc;
        syncSafetyBar();
        await navigate(state.route, state.routeParams, false);
    }

    function syncSafetyBar() {
        const permanentWrites = state.authenticated && state.owner;
        if (permanentWrites) {
            state.readOnly = false;
            state.writesUntil = null;
        }
        safetyBar.dataset.readOnly = state.readOnly ? '1' : '0';
        safetyBar.querySelector('[data-emulator-mode-label]').textContent = state.readOnly ? 'Lecture seule' : 'Actions réelles actives';
        safetyBar.querySelector('[data-emulator-mode-detail]').textContent = permanentWrites
            ? 'Activation permanente pour Valentin.'
            : state.readOnly
                ? 'Aucune écriture de production n’est autorisée.'
                : `Expiration ${state.writesUntil ? formatDate(state.writesUntil, true) : 'prochaine'}.`;
        safetyBar.querySelector('[data-emulator-enable-writes]').classList.toggle('d-none', permanentWrites || !state.readOnly);
        safetyBar.querySelector('[data-emulator-disable-writes]').classList.toggle('d-none', permanentWrites || state.readOnly);
        postToEmulatorHost('mobile-emulator:status', {
            authenticated: state.authenticated,
            owner: state.owner,
            readOnly: state.readOnly,
            writesUntil: state.writesUntil,
            offline: state.offline,
        });
    }

    systemNavigationBar?.addEventListener('click', async (event) => {
        const control = event.target.closest('[data-emulator-navigation]');
        if (!control) return;

        const action = control.dataset.emulatorNavigation;
        if (action === 'back' && state.signatureExperience) {
            await closeSignatureExperience();
            return;
        }
        if (action === 'back' && state.externalApplication) {
            closeExternalApplication();
            return;
        }
        if (action === 'overview') {
            renderSystemOverview();
            return;
        }
        if (action === 'home') {
            if (state.authenticated) {
                await navigate(profileLandingRoute());
            } else {
                renderLogin();
            }
            return;
        }
        if (app.querySelector('[data-mobile-system-overview]')) {
            await restoreCurrentScreen();
            return;
        }
        if (action === 'back' && state.authenticated) {
            await navigateBack();
        }
    });

    function resetPullToRefreshGesture(event = null) {
        const gesture = pullToRefreshGesture;
        if (!gesture || (event && gesture.pointerId !== event.pointerId)) return false;
        window.clearTimeout(gesture.holdTimer);
        const indicator = app.querySelector('[data-mobile-pull-refresh]');
        indicator?.classList.remove('is-visible', 'is-armed');
        indicator?.style.removeProperty('--mobile-pull-distance');
        if (gesture.content?.hasPointerCapture?.(gesture.pointerId)) {
            gesture.content.releasePointerCapture(gesture.pointerId);
        }
        pullToRefreshGesture = null;
        return true;
    }

    function finishPullToRefreshGesture(event) {
        const gesture = pullToRefreshGesture;
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        const shouldRefresh = gesture.armed;
        resetPullToRefreshGesture(event);
        if (!shouldRefresh || !state.authenticated || state.externalApplication) return;
        suppressClickAfterPullRefresh = true;
        window.setTimeout(() => { suppressClickAfterPullRefresh = false; }, 450);
        void navigate(state.route, state.routeParams, false);
    }

    app.addEventListener('click', (event) => {
        if (!suppressClickAfterPullRefresh) return;
        suppressClickAfterPullRefresh = false;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);

    app.addEventListener('pointerdown', (event) => {
        if (!state.authenticated || state.externalApplication || pullToRefreshGesture) return;
        if (!['touch', 'pen', 'mouse'].includes(event.pointerType)) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (event.target.closest('input, textarea, select, [contenteditable="true"], [data-mobile-camera-editor-canvas], .mobile-app-action.is-editing')) return;
        const content = event.target.closest('.mobile-app-content');
        if (!(content instanceof HTMLElement) || content.scrollTop > 1) return;

        pullToRefreshGesture = {
            pointerId: event.pointerId,
            content,
            startX: event.clientX,
            startY: event.clientY,
            held: false,
            armed: false,
            holdTimer: window.setTimeout(() => {
                if (!pullToRefreshGesture || pullToRefreshGesture.pointerId !== event.pointerId) return;
                pullToRefreshGesture.held = true;
                content.setPointerCapture?.(event.pointerId);
            }, 220),
        };
    });

    app.addEventListener('pointermove', (event) => {
        const gesture = pullToRefreshGesture;
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - gesture.startX;
        const deltaY = event.clientY - gesture.startY;
        if (!gesture.held) {
            if (Math.hypot(deltaX, deltaY) > 10) resetPullToRefreshGesture(event);
            return;
        }
        if (deltaY <= 0 || Math.abs(deltaX) > deltaY * .7) {
            if (deltaY < -8 || Math.abs(deltaX) > 24) resetPullToRefreshGesture(event);
            return;
        }

        event.preventDefault();
        const distance = Math.min(92, deltaY * .58);
        gesture.armed = distance >= 52;
        const indicator = app.querySelector('[data-mobile-pull-refresh]');
        if (!indicator) return;
        indicator.style.setProperty('--mobile-pull-distance', `${distance}px`);
        indicator.classList.toggle('is-visible', distance > 3);
        indicator.classList.toggle('is-armed', gesture.armed);
    }, { passive: false });

    app.addEventListener('pointerup', finishPullToRefreshGesture);
    app.addEventListener('pointercancel', resetPullToRefreshGesture);

    function finishQuickActionDrag() {
        if (!quickActionDrag) return;

        window.clearTimeout(quickActionDrag.holdTimer);
        quickActionDrag.element?.classList.remove('is-dragging');
        quickActionDrag.element?.removeAttribute('aria-grabbed');
        quickActionDrag.element?.style.removeProperty('transform');
        quickActionDrag.element?.closest('.mobile-app-action-row')?.classList.remove('has-dragging-action');
        if (quickActionDrag.element?.hasPointerCapture?.(quickActionDrag.pointerId)) {
            quickActionDrag.element.releasePointerCapture(quickActionDrag.pointerId);
        }
        quickActionDrag = null;
    }

    function activateQuickActionDrag(action, pointerId) {
        if (!quickActionDrag || quickActionDrag.element !== action || !action.isConnected) return;

        quickActionDrag.dragging = true;
        quickActionDrag.compensationX = 0;
        quickActionDrag.compensationY = 0;
        quickActionDrag.slotRect = action.getBoundingClientRect();
        action.classList.add('is-dragging');
        action.setAttribute('aria-grabbed', 'true');
        action.closest('.mobile-app-action-row')?.classList.add('has-dragging-action');
        action.setPointerCapture?.(pointerId);
        try { window.navigator.vibrate?.(15); } catch (_) { /* Le retour haptique reste facultatif. */ }
    }

    function finishCameraTextPaletteDrag(event = null) {
        const drag = cameraTextPaletteDrag;
        if (!drag || (event && drag.pointerId !== event.pointerId)) return false;
        drag.palette.classList.remove('is-dragging');
        if (drag.captureElement?.hasPointerCapture?.(drag.pointerId)) drag.captureElement.releasePointerCapture(drag.pointerId);
        cameraTextPaletteDrag = null;
        return true;
    }

    function updateCameraTextPaletteDrag(event) {
        const drag = cameraTextPaletteDrag;
        if (!drag || drag.pointerId !== event.pointerId) return false;
        drag.latestX = event.clientX;
        drag.latestY = event.clientY;
        const editor = state.externalApplication?.cameraEditor;
        if (!editor) return false;
        editor.paletteOffset = {
            x: drag.startOffsetX + event.clientX - drag.startX,
            y: drag.startOffsetY + event.clientY - drag.startY,
        };
        updateCameraEditorVisualTransform();
        return true;
    }

    app.addEventListener('pointerdown', (event) => {
        const paletteGrip = event.target.closest('[data-mobile-camera-text-palette-grip]');
        const palette = paletteGrip?.closest('[data-mobile-camera-text-palette]');
        if (paletteGrip instanceof HTMLElement && palette instanceof HTMLElement) {
            event.stopPropagation();
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            finishCameraTextPaletteDrag();
            const editor = state.externalApplication?.cameraEditor;
            if (!editor) return;
            const offset = editor.paletteOffset && typeof editor.paletteOffset === 'object' ? editor.paletteOffset : { x: 0, y: 0 };
            cameraTextPaletteDrag = {
                pointerId: event.pointerId,
                palette,
                startX: event.clientX,
                startY: event.clientY,
                latestX: event.clientX,
                latestY: event.clientY,
                startOffsetX: Number(offset.x) || 0,
                startOffsetY: Number(offset.y) || 0,
                captureElement: paletteGrip,
            };
            palette.classList.add('is-dragging');
            paletteGrip.setPointerCapture?.(event.pointerId);
            event.preventDefault();
            return;
        }
        const sizeStep = event.target.closest('[data-mobile-camera-editor-size-step]');
        if (sizeStep && startCameraTextSizeStep(sizeStep, event)) {
            event.preventDefault();
            return;
        }
        const editorTarget = event.target.closest('[data-mobile-camera-editor-canvas], [data-mobile-camera-image-rotation], [data-mobile-camera-crop-handle], [data-mobile-camera-inline-text], [data-mobile-camera-text-rotation], [data-mobile-camera-text-move], [data-mobile-camera-text-resize]');
        if (!editorTarget) return;
        if (updateCameraEditorPointer(event, true) && !event.target.closest('[data-mobile-camera-inline-text]')) event.preventDefault();
    });

    app.addEventListener('pointermove', (event) => {
        if (updateCameraTextPaletteDrag(event)) {
            event.preventDefault();
            return;
        }
        if (updateCameraEditorPointer(event)) event.preventDefault();
    });

    app.addEventListener('pointerup', (event) => {
        finishCameraTextPaletteDrag(event);
        finishCameraTextSizeStep(event);
        finishCameraEditorPointer(event);
    });
    app.addEventListener('pointercancel', (event) => {
        finishCameraTextPaletteDrag(event);
        finishCameraTextSizeStep(event);
        finishCameraEditorPointer(event);
    });

    app.addEventListener('click', (event) => {
        const editor = state.externalApplication?.kind === 'camera' && state.externalApplication.cameraReview
            ? state.externalApplication.cameraEditor
            : null;
        if (!editor?.selectedTextId) return;
        if (event.target.closest([
            '[data-mobile-camera-editor-canvas]',
            '[data-mobile-camera-inline-text]',
            '[data-mobile-camera-image-rotation]',
            '[data-mobile-camera-crop-handle]',
            '[data-mobile-camera-text-rotation]',
            '[data-mobile-camera-text-move]',
            '[data-mobile-camera-text-resize]',
            '[data-mobile-camera-text-palette]',
            '[data-mobile-camera-editor-add-text]',
            '[data-mobile-camera-editor-delete-text]',
            '[data-mobile-camera-editor-font]',
            '[data-mobile-camera-editor-color]',
            '[data-mobile-camera-editor-size]',
            '[data-mobile-camera-editor-size-step]',
            '[data-mobile-camera-page-selector]',
            '[data-mobile-camera-retake]',
            '[data-mobile-camera-add]',
            '[data-mobile-camera-use]',
            '[data-mobile-camera-dossier]',
        ].join(', '))) return;
        window.setTimeout(() => {
            const current = state.externalApplication;
            if (current?.kind !== 'camera' || !current.cameraReview || !current.cameraEditor?.selectedTextId) return;
            current.cameraEditor.selectedTextId = null;
            renderExternalCameraReview();
        }, 0);
    });

    app.addEventListener('pointerdown', (event) => {
        const action = event.target.closest('.mobile-app-action.is-editing[data-quick-action-key]');
        if (!state.quickActionsEditing || !action || event.target.closest('[data-quick-action-remove]')) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        finishQuickActionDrag();
        quickActionDrag = {
            element: action,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            dragging: false,
            holdTimer: null,
        };
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
            event.preventDefault();
            activateQuickActionDrag(action, event.pointerId);
        } else {
            quickActionDrag.holdTimer = window.setTimeout(
                () => activateQuickActionDrag(action, event.pointerId),
                300,
            );
        }
    });

    app.addEventListener('pointermove', (event) => {
        if (!quickActionDrag || quickActionDrag.pointerId !== event.pointerId) return;

        if (!quickActionDrag.dragging) {
            if (Math.hypot(event.clientX - quickActionDrag.startX, event.clientY - quickActionDrag.startY) > 18) {
                finishQuickActionDrag();
            }
            return;
        }

        event.preventDefault();
        const dragged = quickActionDrag.element;
        const applyDraggedTransform = () => {
            const x = event.clientX - quickActionDrag.startX + quickActionDrag.compensationX;
            const y = event.clientY - quickActionDrag.startY + quickActionDrag.compensationY;
            dragged.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.025)`;
        };
        applyDraggedTransform();
        const group = dragged.closest('.mobile-app-action-row');
        const candidates = Array.from(group?.querySelectorAll('.mobile-app-action.is-editing') || [])
            .filter((candidate) => candidate !== dragged);
        if (!group || candidates.length === 0) return;

        const draggedKey = String(dragged.dataset.quickActionKey || '');
        const slots = [
            { element: dragged, key: draggedKey, rect: quickActionDrag.slotRect },
            ...candidates.map((candidate) => ({
                element: candidate,
                key: String(candidate.dataset.quickActionKey || ''),
                rect: candidate.getBoundingClientRect(),
            })),
        ];
        const targetSlot = slots.reduce((nearest, slot) => {
            const x = event.clientX - (slot.rect.left + slot.rect.width / 2);
            const y = event.clientY - (slot.rect.top + slot.rect.height / 2);
            const distance = (x * x) + (y * y);
            return !nearest || distance < nearest.distance ? { ...slot, distance } : nearest;
        }, null);
        if (!targetSlot || targetSlot.key === draggedKey) return;

        const target = targetSlot.element;
        const targetKey = String(target.dataset.quickActionKey || '');
        const fromIndex = state.homeQuickActionKeys.indexOf(draggedKey);
        const targetIndex = state.homeQuickActionKeys.indexOf(targetKey);
        if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return;

        const beforeMove = dragged.getBoundingClientRect();
        if (fromIndex < targetIndex) {
            group.insertBefore(dragged, target.nextSibling);
        } else {
            group.insertBefore(dragged, target);
        }
        const afterMove = dragged.getBoundingClientRect();
        quickActionDrag.compensationX += beforeMove.left - afterMove.left;
        quickActionDrag.compensationY += beforeMove.top - afterMove.top;
        quickActionDrag.slotRect = targetSlot.rect;
        applyDraggedTransform();
        state.homeQuickActionKeys.splice(fromIndex, 1);
        state.homeQuickActionKeys.splice(targetIndex, 0, draggedKey);
    });

    app.addEventListener('pointerup', finishQuickActionDrag);
    app.addEventListener('pointercancel', finishQuickActionDrag);
    app.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || state.route !== 'documents' || !canDeleteCurrentDocuments()) return;
        if (event.target.closest('.mobile-app-document-actions, [data-mobile-document-selection-toggle], [data-mobile-document-sort], [data-mobile-document-scope-toggle]')) return;
        const item = event.target.closest('[data-mobile-document-selectable]');
        if (!item || item.dataset.mobileDocumentCanDelete !== '1') return;
        if (documentLongPressGesture?.timer) window.clearTimeout(documentLongPressGesture.timer);
        const gesture = {
            item,
            x: event.clientX,
            y: event.clientY,
            timer: null,
            fired: false,
        };
        gesture.timer = window.setTimeout(() => {
            gesture.fired = true;
            suppressDocumentClick = true;
            enterDocumentSelectionMode(item);
            if (navigator.vibrate) navigator.vibrate(25);
        }, 520);
        documentLongPressGesture = gesture;
    });
    app.addEventListener('pointermove', (event) => {
        const gesture = documentLongPressGesture;
        if (!gesture || gesture.fired) return;
        if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) {
            window.clearTimeout(gesture.timer);
            documentLongPressGesture = null;
        }
    });
    const finishDocumentLongPress = () => {
        if (!documentLongPressGesture) return;
        window.clearTimeout(documentLongPressGesture.timer);
        documentLongPressGesture = null;
    };
    app.addEventListener('pointerup', finishDocumentLongPress);
    app.addEventListener('pointercancel', finishDocumentLongPress);
    app.addEventListener('contextmenu', (event) => {
        if (externalApplicationFromHref(event.target.closest('a[href]'))) {
            event.preventDefault();
            return;
        }
        if (state.quickActionsEditing && event.target.closest('.mobile-app-action.is-editing')) {
            event.preventDefault();
        }
        const documentItem = event.target.closest('[data-mobile-document-selectable]');
        if (state.route === 'documents' && documentItem?.dataset.mobileDocumentCanDelete === '1' && canDeleteCurrentDocuments()) {
            event.preventDefault();
            enterDocumentSelectionMode(documentItem);
        }
    });

    app.addEventListener('auxclick', (event) => {
        if (event.button !== 1 || state.externalApplication) return;
        const anchor = event.target.closest('a[href]');
        const invocation = externalApplicationFromHref(anchor);
        if (!invocation) return;
        event.preventDefault();
        openExternalApplication(invocation, anchor);
    });

    app.addEventListener('click', async (event) => {
        if (event.target.closest('[data-mobile-signature-close]')) {
            await closeSignatureExperience();
            return;
        }
        if (event.target.closest('[data-mobile-assistant-listen]')) {
            startAssistantRecognition();
            return;
        }
        if (event.target.closest('[data-mobile-assistant-listen-cancel]')) {
            cancelAssistantListening();
            return;
        }
        if (event.target.closest('[data-mobile-assistant-cancel]')) {
            await cancelAssistantRun();
            return;
        }
        if (event.target.closest('[data-mobile-assistant-dismiss]')) {
            dismissAssistantFeedback();
            return;
        }
        const selectedDocumentItem = event.target.closest('[data-mobile-document-selectable]');
        if (suppressDocumentClick && selectedDocumentItem) {
            suppressDocumentClick = false;
            event.preventDefault();
            return;
        }
        const deletionClose = event.target.closest('[data-mobile-document-deletion-close]');
        if (deletionClose) {
            if (!state.documentDeletionBusy) deletionClose.closest('[data-mobile-document-deletion-dialog]')?.remove();
            return;
        }
        if (event.target.closest('[data-mobile-document-deletion-confirm]')) {
            await deleteSelectedDocuments();
            return;
        }
        if (event.target.closest('[data-mobile-document-selection-close]')) {
            closeDocumentSelectionMode();
            return;
        }
        if (event.target.closest('[data-mobile-document-selection-delete]')) {
            showDocumentDeletionDialog();
            return;
        }
        const selectionToggle = event.target.closest('[data-mobile-document-selection-toggle]');
        if (selectionToggle) {
            if (selectionToggle.disabled) return;
            const key = String(selectionToggle.dataset.mobileDocumentSelectionToggle || '');
            if (state.selectedDocumentItems.has(key)) state.selectedDocumentItems.delete(key);
            else state.selectedDocumentItems.add(key);
            syncDocumentSelectionUi();
            return;
        }
        const documentSort = event.target.closest('[data-mobile-document-sort]');
        if (documentSort) {
            const currentIndex = documentSortModes.findIndex(([value]) => value === state.documentSortMode);
            state.documentSortMode = documentSortModes[(currentIndex + 1 + documentSortModes.length) % documentSortModes.length][0];
            persistPreferences();
            closeDocumentSelectionMode();
            await navigate('documents', state.routeParams || {}, false);
            return;
        }
        if (state.documentSelectionMode && selectedDocumentItem) {
            const key = String(selectedDocumentItem.dataset.mobileDocumentSelectable || '');
            if (selectedDocumentItem.dataset.mobileDocumentCanDelete === '1' && key) {
                if (state.selectedDocumentItems.has(key)) state.selectedDocumentItems.delete(key);
                else state.selectedDocumentItems.add(key);
                syncDocumentSelectionUi();
            }
            return;
        }
        const footerMove = event.target.closest('[data-mobile-footer-move]');
        if (footerMove) {
            const route = String(footerMove.dataset.mobileFooterRoute || '');
            const index = state.footerNavigationDraftKeys.indexOf(route);
            const targetIndex = footerMove.dataset.mobileFooterMove === 'up' ? index - 1 : index + 1;
            if (index >= 0 && targetIndex >= 0 && targetIndex < state.footerNavigationDraftKeys.length) {
                const next = [...state.footerNavigationDraftKeys];
                [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
                state.footerNavigationDraftKeys = next;
                renderFooterNavigationSettings();
            }
            return;
        }
        const footerToggle = event.target.closest('[data-mobile-footer-toggle]');
        if (footerToggle) {
            const route = String(footerToggle.dataset.mobileFooterToggle || '');
            if (!route || ['home', 'more'].includes(route)) return;
            state.footerNavigationDraftKeys = state.footerNavigationDraftKeys.includes(route)
                ? state.footerNavigationDraftKeys.filter((candidate) => candidate !== route)
                : [...state.footerNavigationDraftKeys, route];
            renderFooterNavigationSettings();
            return;
        }
        if (event.target.closest('[data-mobile-footer-save]')) {
            if (state.readOnly || state.footerNavigationSaving) return;
            state.footerNavigationSaving = true;
            state.footerNavigationMessage = '';
            renderFooterNavigationSettings();
            try {
                const response = await api('/navigation-preferences/footer', {
                    method: 'PATCH',
                    body: { footer_navigation_keys: state.footerNavigationDraftKeys.map(footerStoredKey) },
                });
                state.footerNavigationKeys = Array.isArray(response.data?.footer_navigation_keys)
                    ? response.data.footer_navigation_keys.map(String)
                    : state.footerNavigationDraftKeys.map(footerStoredKey);
                state.footerNavigationDraftKeys = footerNavigationRoutes();
                state.footerNavigationMessage = 'Pied de page enregistré.';
                state.footerNavigationSaving = false;
                await navigate('more', {}, false);
                return;
            } catch (error) {
                state.footerNavigationMessage = error?.message || 'Impossible d’enregistrer le pied de page.';
                if (!state.footerNavigationMessage.startsWith('Impossible')) {
                    state.footerNavigationMessage = `Impossible d’enregistrer le pied de page. ${state.footerNavigationMessage}`;
                }
            } finally {
                if (state.footerNavigationSaving) {
                    state.footerNavigationSaving = false;
                    renderFooterNavigationSettings();
                }
            }
            return;
        }
        if (event.target.closest('[data-mobile-support-create-toggle]')) {
            state.supportCreateExpanded = !state.supportCreateExpanded;
            await renderSupport();
            if (state.supportCreateExpanded) {
                window.requestAnimationFrame(() => app.querySelector('[data-mobile-support-create] input[name="subject"]')?.focus({ preventScroll: true }));
            }
            return;
        }
        const supportTicket = event.target.closest('[data-mobile-support-ticket]');
        if (supportTicket) {
            state.supportRequestSequence += 1;
            state.supportSelectedTicketId = Number(supportTicket.dataset.mobileSupportTicket) || null;
            state.supportReplyExpanded = false;
            state.supportCancelConfirmation = false;
            try {
                await renderSupportDetail();
            } catch (error) {
                renderError(error, 'support');
            }
            return;
        }
        if (event.target.closest('[data-mobile-support-back]')) {
            state.supportDetailRequestSequence += 1;
            state.supportSelectedTicketId = null;
            state.supportReplyExpanded = false;
            state.supportCancelConfirmation = false;
            await renderSupport();
            return;
        }
        if (event.target.closest('[data-mobile-support-reply-toggle]')) {
            state.supportReplyExpanded = true;
            state.supportCancelConfirmation = false;
            await renderSupportDetail();
            window.requestAnimationFrame(() => app.querySelector('[data-mobile-support-reply-message]')?.focus({ preventScroll: true }));
            return;
        }
        if (event.target.closest('[data-mobile-support-reply-close]')) {
            state.supportReplyExpanded = false;
            await renderSupportDetail();
            return;
        }
        if (event.target.closest('[data-mobile-support-cancel-toggle]')) {
            state.supportCancelConfirmation = true;
            state.supportReplyExpanded = false;
            await renderSupportDetail();
            return;
        }
        if (event.target.closest('[data-mobile-support-cancel-close]')) {
            state.supportCancelConfirmation = false;
            await renderSupportDetail();
            return;
        }
        const supportCancel = event.target.closest('[data-mobile-support-cancel-confirm]');
        if (supportCancel) {
            const confirmation = supportCancel.closest('[data-mobile-support-cancel-confirmation]');
            const feedback = confirmation?.querySelector('[data-mobile-support-cancel-feedback]');
            const ticketId = Number(confirmation?.dataset.mobileSupportCancelConfirmation) || 0;
            if (!ticketId || supportCancel.disabled || state.readOnly) return;
            supportCancel.disabled = true;
            supportCancel.textContent = 'Annulation…';
            if (feedback) feedback.textContent = '';
            try {
                const response = await api(`/support/tickets/${ticketId}/cancel`, { method: 'POST', body: {} });
                state.supportCancelConfirmation = false;
                state.supportReplyExpanded = false;
                await renderSupportDetail(response.data?.message || 'Ticket annulé.', 'success', response.data?.ticket || null);
            } catch (error) {
                if (feedback) feedback.textContent = error?.message || 'Le ticket n’a pas pu être annulé.';
                supportCancel.disabled = false;
                supportCancel.textContent = 'Confirmer l’annulation';
            }
            return;
        }
        const supportStatusSummary = event.target.closest('.mobile-app-support-status-selector > summary');
        if (supportStatusSummary) {
            state.supportStatusSelectorOpen = !supportStatusSummary.parentElement?.open;
            return;
        }
        const taskFiltersToggle = event.target.closest('[data-mobile-task-filters-toggle]');
        if (taskFiltersToggle) {
            const form = taskFiltersToggle.closest('[data-mobile-task-filters]');
            const values = mobileTaskFilterParams(form);
            values.filtersOpen = form?.dataset.filtersOpen !== '1';
            values.dueSettingsOpen = false;
            await navigate('tasks', values, false);
            return;
        }
        const taskDueSettingsToggle = event.target.closest('[data-mobile-task-due-settings-toggle]');
        if (taskDueSettingsToggle) {
            const form = taskDueSettingsToggle.closest('[data-mobile-task-filters]');
            const values = mobileTaskFilterParams(form);
            values.filtersOpen = true;
            values.dueSettingsOpen = form?.dataset.dueSettingsOpen !== '1';
            await navigate('tasks', values, false);
            return;
        }
        if (event.target.closest('[data-mobile-task-due-settings-close]')) {
            const form = event.target.closest('[data-mobile-task-filters]');
            const values = mobileTaskFilterParams(form);
            values.filtersOpen = true;
            values.dueSettingsOpen = false;
            await navigate('tasks', values, false);
            return;
        }
        if (event.target.closest('[data-mobile-task-filter-reset]')) {
            await navigate('tasks', { resetTaskFilters: true, filtersOpen: true }, false);
            return;
        }
        const completedTask = event.target.closest('[data-mobile-task-complete]');
        if (completedTask) {
            completedTask.disabled = true;
            try {
                const taskDossierId = Number(completedTask.dataset.taskDossier) || Number(state.activeDossierId);
                const taskId = Number(completedTask.dataset.mobileTaskComplete);
                const response = await api(`/dossiers/${taskDossierId}/tasks/${taskId}/transition`, {
                    method: 'POST',
                    body: {
                        status: 'done',
                        version: Math.max(1, Number(completedTask.dataset.taskVersion) || 1),
                    },
                });
                const card = completedTask.closest('[data-mobile-task-card]');
                completedTask.className = 'mobile-app-secondary-button mobile-app-task-card__action is-undo';
                completedTask.textContent = 'Annuler';
                completedTask.removeAttribute('data-mobile-task-complete');
                completedTask.dataset.mobileTaskUndo = String(taskId);
                completedTask.dataset.taskVersion = String(Math.max(1, Number(response.data?.version) || (Number(completedTask.dataset.taskVersion) + 1)));
                completedTask.disabled = state.readOnly;
                card?.classList.add('is-completing');
                card?.insertAdjacentHTML('beforeend', '<span class="mobile-app-task-card__countdown" aria-hidden="true"></span>');
                const previousTimer = taskCompletionDismissTimers.get(taskId);
                if (previousTimer) window.clearTimeout(previousTimer);
                taskCompletionDismissTimers.set(taskId, window.setTimeout(() => {
                    taskCompletionDismissTimers.delete(taskId);
                    card?.classList.add('is-dismissed');
                    window.setTimeout(() => card?.remove(), 180);
                }, 3000));
            } catch (error) {
                renderError(error, 'tasks');
            }
            return;
        }
        const undoneTask = event.target.closest('[data-mobile-task-undo]');
        if (undoneTask) {
            undoneTask.disabled = true;
            const taskId = Number(undoneTask.dataset.mobileTaskUndo);
            const countdown = taskCompletionDismissTimers.get(taskId);
            if (countdown) window.clearTimeout(countdown);
            taskCompletionDismissTimers.delete(taskId);
            try {
                const taskDossierId = Number(undoneTask.dataset.taskDossier) || Number(state.activeDossierId);
                await api(`/dossiers/${taskDossierId}/tasks/${taskId}/transition`, {
                    method: 'POST',
                    body: {
                        status: 'ready',
                        version: Math.max(1, Number(undoneTask.dataset.taskVersion) || 1),
                    },
                });
                await renderTasks(state.routeParams || {});
            } catch (error) {
                renderError(error, 'tasks');
            }
            return;
        }
        const mobileCard = event.target.closest('[data-mobile-card-interaction]');
        if (mobileCard) {
            try {
                await handleMobileCardInteraction(mobileCard);
            } catch (error) {
                renderError(error, state.route);
            }
            return;
        }
        if (event.target.closest('[data-mobile-action-fallback-close]')) {
            closeMobileActionFallback();
            return;
        }
        const copyFallbackLink = event.target.closest('[data-mobile-action-fallback-copy]');
        if (copyFallbackLink) {
            try {
                await navigator.clipboard.writeText(String(copyFallbackLink.dataset.mobileActionFallbackCopy || ''));
                showQuickCreationNotice('Lien copié.');
            } catch (_) {
                showQuickCreationNotice('Copie indisponible.');
            }
            return;
        }
        const shareFallbackLink = event.target.closest('[data-mobile-action-fallback-share]');
        if (shareFallbackLink) {
            const url = String(shareFallbackLink.dataset.mobileActionFallbackShare || '');
            try {
                if (typeof navigator.share === 'function') {
                    await navigator.share({ title: 'Maison Pilote', url });
                } else {
                    await navigator.clipboard.writeText(url);
                    showQuickCreationNotice('Lien copié pour être partagé.');
                }
            } catch (error) {
                if (error?.name !== 'AbortError') showQuickCreationNotice('Partage indisponible.');
            }
            return;
        }
        if (event.target.closest('[data-mobile-biometric-activation-close]')) {
            const activationTest = app.querySelector('[data-mobile-biometric-activation-test]');
            const source = activationTest?.dataset.source;
            activationTest?.remove();
            if (source === 'settings') renderUserSettings();
            return;
        }
        if (event.target.closest('[data-mobile-biometric-prompt-close]')) {
            app.querySelector('[data-mobile-biometric-prompt]')?.remove();
            return;
        }
        if (event.target.closest('[data-mobile-biometric-login]')) {
            if (iosRuntime) {
                try {
                    await requestNativeBiometricAuthentication();
                    state.biometricLocked = false;
                    renderLoading('Maison Pilote');
                    await start();
                } catch (error) {
                    state.biometricLocked = true;
                    renderLogin(error);
                }
                return;
            }
            showBiometricPrompt();
            return;
        }
        const biometricOfferClose = event.target.closest('[data-mobile-biometric-offer-close]');
        if (biometricOfferClose) {
            state.biometricPromptSuppressed = app.querySelector('[data-mobile-biometric-never-offer]')?.checked === true;
            persistPreferences();
            app.querySelector('[data-mobile-biometric-offer]')?.remove();
            return;
        }
        const biometricOfferEnable = event.target.closest('[data-mobile-biometric-offer-enable]');
        if (biometricOfferEnable) {
            showBiometricActivationTest('offer');
            return;
        }
        if (event.target.closest('[data-mobile-camera-text-palette-close]') && state.externalApplication?.kind === 'camera') {
            state.externalApplication.cameraEditor.selectedTextId = null;
            document.activeElement?.blur?.();
            renderExternalCameraReview();
            return;
        }
        const cameraEditorAddText = event.target.closest('[data-mobile-camera-editor-add-text]');
        if (cameraEditorAddText && state.externalApplication?.kind === 'camera') {
            const editor = state.externalApplication.cameraEditor || defaultCameraEditor();
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            editor.texts.push({
                id,
                text: 'Texte à remplacer',
                x: .5,
                y: .5,
                font: editor.defaultFont || 'sans',
                color: 'auto',
                sizePercent: Math.max(2, Math.min(50, Number(editor.defaultTextSize) || 18)),
                rotation: 0,
            });
            editor.selectedTextId = id;
            state.externalApplication.cameraEditor = editor;
            renderExternalCameraReview();
            window.requestAnimationFrame(() => {
                const input = app.querySelector('[data-mobile-camera-inline-text]');
                input?.focus({ preventScroll: true });
                input?.select?.();
            });
            return;
        }
        if (event.target.closest('[data-mobile-camera-editor-delete-text]') && state.externalApplication?.kind === 'camera') {
            const editor = state.externalApplication.cameraEditor;
            editor.texts = editor.texts.filter((overlay) => String(overlay.id) !== String(editor.selectedTextId));
            editor.selectedTextId = null;
            renderExternalCameraReview();
            return;
        }
        const cameraCapture = event.target.closest('[data-mobile-camera-capture]');
        if (cameraCapture && state.externalApplication?.kind === 'camera') {
            launchDeviceCameraPicker();
            return;
        }
        if (event.target.closest('[data-mobile-camera-retake]') && state.externalApplication?.kind === 'camera') {
            const pages = state.externalApplication.cameraPages || [];
            state.externalApplication.cameraReplacingIndex = Math.max(0, Math.min(
                pages.length - 1,
                Math.trunc(Number(state.externalApplication.cameraSelectedIndex) || 0),
            ));
            state.externalApplication.cameraEditor = defaultCameraEditor();
            renderExternalCameraCapture();
            launchDeviceCameraPicker();
            return;
        }
        const cameraAdd = event.target.closest('[data-mobile-camera-add]');
        if (cameraAdd && state.externalApplication?.kind === 'camera') {
            const pages = state.externalApplication.cameraPages || [];
            if (!pages.length || cameraAdd.disabled) return;
            cameraAdd.disabled = true;
            try {
                const selectedIndex = Math.max(0, Math.min(pages.length - 1, Math.trunc(Number(state.externalApplication.cameraSelectedIndex) || 0)));
                const prepared = await applyCameraPageEdits(pages[selectedIndex], state.externalApplication.cameraEditor);
                state.externalApplication.cameraPages = pages.map((page, index) => index === selectedIndex ? prepared : page);
                state.externalApplication.cameraSelectedIndex = pages.length;
                state.externalApplication.cameraReplacingIndex = null;
                state.externalApplication.cameraEditor = defaultCameraEditor();
                renderExternalCameraCapture();
            } catch (error) {
                cameraAdd.disabled = false;
                cameraAdd.insertAdjacentHTML('afterend', `<p class="mobile-external-camera__error">${escapeHtml(error?.message || 'La photo n’a pas pu être préparée.')}</p>`);
            }
            return;
        }
        const cameraUse = event.target.closest('[data-mobile-camera-use]');
        if (cameraUse && state.externalApplication?.kind === 'camera') {
            const pages = state.externalApplication.cameraPages || [];
            if (!pages.length || cameraUse.disabled) return;
            const originalMarkup = cameraUse.innerHTML;
            cameraUse.disabled = true;
            cameraUse.setAttribute('aria-busy', 'true');
            cameraUse.innerHTML = '<span class="mobile-external-camera__capture-spinner" aria-hidden="true"></span><span>Préparation de la photo…</span>';
            try {
                await new Promise((resolve) => window.requestAnimationFrame(resolve));
                const selectedIndex = Math.max(0, Math.min(pages.length - 1, Math.trunc(Number(state.externalApplication.cameraSelectedIndex) || 0)));
                const prepared = await applyCameraPageEdits(pages[selectedIndex], state.externalApplication.cameraEditor);
                const finalPages = pages.map((page, index) => index === selectedIndex ? prepared : page);
                state.externalApplication.cameraPages = finalPages;
                await completeCameraPhotoReturn(finalPages);
            } catch (error) {
                cameraUse.disabled = false;
                cameraUse.removeAttribute('aria-busy');
                cameraUse.innerHTML = originalMarkup;
                cameraUse.insertAdjacentHTML('afterend', `<p class="mobile-external-camera__error">${escapeHtml(error?.message || 'La photo n’a pas pu être préparée.')}</p>`);
            }
            return;
        }
        if (event.target.closest('[data-mobile-external-return-files]')) {
            await completeExternalFileReturn(createReturnedTestFiles());
            return;
        }
        if (event.target.closest('[data-mobile-external-return-file]')) {
            await completeExternalFileReturn();
            return;
        }
        if (event.target.closest('[data-mobile-external-return]')) {
            closeExternalApplication();
            return;
        }
        if (state.externalApplication) return;

        const uploadCancel = event.target.closest('[data-mobile-upload-cancel]');
        if (uploadCancel) {
            await cancelUploadFeedback(String(uploadCancel.dataset.mobileUploadCancel || ''));
            return;
        }
        const nativeShareRetry = event.target.closest('[data-mobile-native-share-retry]');
        if (nativeShareRetry) {
            const feedback = state.uploadFeedbacks.find((item) => (
                item.id === String(nativeShareRetry.dataset.mobileNativeShareRetry || '')
            ));
            const batchId = String(feedback?.nativeShareBatchId || '');
            if (!batchId) return;
            state.uploadFeedbacks
                .filter((item) => item.nativeShareBatchId === batchId)
                .map((item) => item.id)
                .forEach((feedbackId) => dismissReturnedFileFeedback(feedbackId));
            nativeSharePausedBatchIds.delete(batchId);
            nativeShareCancelledBatchIds.delete(batchId);
            window.MaisonPiloteNative?.shareInbox?.refresh?.();
            void processNativeShareInbox();
            return;
        }
        const uploadRemove = event.target.closest('[data-mobile-upload-remove]');
        if (uploadRemove) {
            dismissReturnedFileFeedback(String(uploadRemove.dataset.mobileUploadRemove || ''));
            return;
        }

        const externalAnchor = event.target.closest('a[href]');
        const externalInvocation = externalApplicationFromHref(externalAnchor);
        if (externalInvocation) {
            event.preventDefault();
            openExternalApplication(externalInvocation, externalAnchor);
            return;
        }

        const externalFileInput = event.target.closest('input[type="file"]');
        if (externalFileInput instanceof HTMLInputElement) {
            event.preventDefault();
            openExternalApplication({
                kind: externalFileInput.hasAttribute('capture') ? 'camera' : 'files',
                action: externalFileInput.hasAttribute('capture') ? 'Prendre un selfie' : 'Choisir une image',
                details: [{ label: 'Utilisation', value: 'Photo de profil Maison Pilote' }],
            }, externalFileInput);
            return;
        }

        const mobileSelectOption = event.target.closest('[data-mobile-select-option]');
        if (mobileSelectOption && activeMobileSelect?.select) {
            const index = Number(mobileSelectOption.dataset.mobileSelectOption);
            const option = activeMobileSelect.select.options[index];
            if (option && !option.disabled) {
                activeMobileSelect.select.selectedIndex = index;
                activeMobileSelect.select.dispatchEvent(new Event('input', { bubbles: true }));
                activeMobileSelect.select.dispatchEvent(new Event('change', { bubbles: true }));
                closeMobileSelect(true);
            }
            return;
        }
        const mobileSelectTrigger = event.target.closest('[data-mobile-select-trigger]');
        if (mobileSelectTrigger instanceof HTMLButtonElement) {
            const select = mobileSelectTrigger.closest('.mobile-app-select')?.querySelector('select');
            openMobileSelect(select, mobileSelectTrigger);
            return;
        }
        if (activeMobileSelect && !event.target.closest('.mobile-app-select-menu')) closeMobileSelect();

        const quickEntry = event.target.closest('[data-mobile-quick-entry]');
        if ((quickEntry instanceof HTMLInputElement || quickEntry instanceof HTMLTextAreaElement)
            && !quickEntry.disabled
            && !quickEntry.readOnly
            && quickEntry.value !== ''
            && quickEntry.dataset.mobileQuickEntrySelected !== '1') {
            quickEntry.select();
            quickEntry.dataset.mobileQuickEntrySelected = '1';
        }

        if (event.target.closest('[data-mobile-resume]')) {
            await restoreCurrentScreen();
            return;
        }
        const messageActionsToggle = event.target.closest('.mobile-app-message__actions, [data-mobile-codex-cancel]')
            ? null
            : event.target.closest('[data-mobile-message-actions-toggle]');
        if (messageActionsToggle) {
            toggleMessageActions(String(messageActionsToggle.dataset.mobileMessageActionsToggle || ''));
            return;
        }
        const messageCopy = event.target.closest('[data-mobile-message-copy]');
        if (messageCopy) {
            await copyMessage(Number(messageCopy.dataset.mobileMessageCopy) || 0, messageCopy);
            return;
        }
        const messageEdit = event.target.closest('[data-mobile-message-edit]');
        if (messageEdit) {
            if (state.readOnly || state.messageEditInFlight) return;
            const messageId = Number(messageEdit.dataset.mobileMessageEdit) || 0;
            const message = Array.isArray(state.messagePayload?.messages)
                ? state.messagePayload.messages.find((candidate) => Number(candidate.id) === messageId)
                : null;
            if (!messageId || !message?.can_edit) return;
            state.messageActionsKey = null;
            state.messageEditingId = messageId;
            state.messageEditingBody = String(message.body || '');
            renderMessageEditingState(true);
            return;
        }
        if (event.target.closest('[data-mobile-message-edit-cancel]')) {
            if (state.messageEditInFlight) return;
            state.messageEditingId = null;
            state.messageEditingBody = '';
            renderMessageEditingState();
            return;
        }
        const messageDelete = event.target.closest('[data-mobile-message-delete]');
        if (messageDelete) {
            if (state.readOnly || state.messageDeleteInFlight) return;
            const messageId = Number(messageDelete.dataset.mobileMessageDelete) || 0;
            state.messageActionsKey = null;
            renderMessageEditingState();
            openMessageDeleteDialog(messageId);
            return;
        }
        if (event.target.closest('[data-mobile-message-delete-close]')) {
            closeMessageDeleteDialog();
            return;
        }
        const messageDeleteConfirm = event.target.closest('[data-mobile-message-delete-confirm]');
        if (messageDeleteConfirm) {
            if (state.readOnly || state.messageDeleteInFlight) return;
            const messageId = Number(state.messageDeletingId) || 0;
            const message = Array.isArray(state.messagePayload?.messages)
                ? state.messagePayload.messages.find((candidate) => Number(candidate.id) === messageId)
                : null;
            const dialog = app.querySelector('[data-mobile-message-delete-dialog]');
            const errorElement = dialog?.querySelector('[data-mobile-message-delete-error]');
            const closeButton = dialog?.querySelector('[data-mobile-message-delete-close]');
            if (!messageId || !message?.can_delete) {
                if (errorElement) {
                    errorElement.textContent = 'Ce message ne peut plus être supprimé.';
                    errorElement.hidden = false;
                }
                return;
            }

            state.messageDeleteInFlight = true;
            messageDeleteConfirm.disabled = true;
            messageDeleteConfirm.textContent = 'Suppression…';
            if (closeButton) closeButton.disabled = true;
            if (errorElement) errorElement.hidden = true;
            const requestSequence = ++state.messageRequestSequence;
            let deleted = false;
            try {
                const response = await api(`/dossiers/${state.activeDossierId}/referent-conversation/messages/${messageId}`, {
                    method: 'DELETE',
                });
                if (requestSequence === state.messageRequestSequence && state.route === 'messages') {
                    state.messageActionsKey = null;
                    state.messageEditingId = null;
                    state.messageEditingBody = '';
                    updateMessageConversation(response.data || {});
                }
                deleted = true;
            } catch (error) {
                if (errorElement) {
                    errorElement.textContent = error?.message || 'La suppression a échoué.';
                    errorElement.hidden = false;
                }
            } finally {
                state.messageDeleteInFlight = false;
                if (deleted) {
                    closeMessageDeleteDialog();
                } else {
                    messageDeleteConfirm.disabled = false;
                    messageDeleteConfirm.textContent = 'Supprimer';
                    if (closeButton) closeButton.disabled = false;
                }
            }
            return;
        }
        const messageSelectorToggle = event.target.closest('[data-mobile-message-selector-toggle]');
        if (messageSelectorToggle) {
            const selector = app.querySelector('[data-mobile-message-selector]');
            const opening = selector?.hidden !== false;
            if (selector) selector.hidden = !opening;
            messageSelectorToggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
            if (opening) {
                positionMessageSelectorOverlay(selector, messageSelectorToggle);
                await loadMessageSelector(app.querySelector('[data-mobile-message-user-search]')?.value || '');
                window.setTimeout(() => app.querySelector('[data-mobile-message-user-search]')?.focus(), 0);
            }
            return;
        }
        const messageUser = event.target.closest('[data-mobile-message-user]');
        if (messageUser) {
            const conversationId = Number(messageUser.dataset.mobileMessageUserConversation) || 0;
            if (conversationId > 0) {
                await selectMessageConversation(conversationId);
            } else {
                await startMessageConversation(Number(messageUser.dataset.mobileMessageUser));
            }
            return;
        }
        const codexConversation = event.target.closest('[data-mobile-message-codex]');
        if (codexConversation) {
            const conversationId = Number(codexConversation.dataset.mobileMessageCodex) || 0;
            if (conversationId > 0) await selectMessageConversation(conversationId);
            else await startCodexConversation();
            return;
        }
        const existingConversation = event.target.closest('[data-mobile-message-conversation]');
        if (existingConversation) {
            await selectMessageConversation(Number(existingConversation.dataset.mobileMessageConversation));
            return;
        }
        const cancelCodex = event.target.closest('[data-mobile-codex-cancel]');
        if (cancelCodex && !state.readOnly && !state.messageSendInFlight) {
            const runId = Number(cancelCodex.dataset.mobileCodexCancel) || 0;
            if (!runId) return;
            state.messageSendInFlight = true;
            cancelCodex.disabled = true;
            try {
                const response = await api(`/dossiers/${state.activeDossierId}/referent-conversation/codex-runs/${runId}/cancel`, {
                    method: 'POST',
                });
                updateMessageConversation(response.data || {});
            } catch (error) {
                renderError(error, 'messages');
            } finally {
                state.messageSendInFlight = false;
            }
            return;
        }
        const openMessageSelector = app.querySelector('[data-mobile-message-selector]:not([hidden])');
        if (openMessageSelector && !event.target.closest('[data-mobile-message-selector], [data-mobile-message-selector-toggle]')) {
            closeMessageSelector();
        }
        const openUserMenu = app.querySelector('[data-mobile-user-menu]:not([hidden])');
        if (openUserMenu && !event.target.closest('[data-mobile-user-menu], [data-mobile-user-menu-toggle]')) {
            openUserMenu.hidden = true;
            app.querySelector('[data-mobile-user-menu-toggle]')?.setAttribute('aria-expanded', 'false');
            const cameleonMenu = app.querySelector('[data-mobile-cameleon-menu]');
            if (cameleonMenu) {
                cameleonMenu.hidden = true;
                state.cameleonRequestSequence += 1;
            }
            app.querySelector('[data-mobile-cameleon-menu-toggle]')?.setAttribute('aria-expanded', 'false');
        }
        const openDossierMenu = app.querySelector('[data-mobile-dossier-menu]:not([data-mobile-document-folder-menu]):not([hidden])');
        if (openDossierMenu && !event.target.closest('[data-mobile-dossier-menu], [data-mobile-dossier-menu-toggle]')) {
            openDossierMenu.hidden = true;
            app.querySelector('[data-mobile-dossier-menu-toggle]')?.setAttribute('aria-expanded', 'false');
        }
        const openDocumentFolderMenu = app.querySelector('[data-mobile-document-folder-menu]:not([hidden])');
        if (openDocumentFolderMenu && !event.target.closest('[data-mobile-document-folder-menu], [data-mobile-document-folder-menu-toggle]')) {
            openDocumentFolderMenu.hidden = true;
            app.querySelector('[data-mobile-document-folder-menu-toggle]')?.setAttribute('aria-expanded', 'false');
        }
        const documentScopeToggle = event.target.closest('[data-mobile-document-scope-toggle]');
        if (documentScopeToggle) {
            closeDocumentSelectionMode();
            const form = documentScopeToggle.closest('[data-mobile-search="documents"]');
            const input = form?.querySelector('input[name="q"]');
            const folderId = Math.max(0, Number(form?.dataset.documentFolderId) || 0);
            const query = String(input?.value || '').slice(0, 120);
            const currentScope = ['all', 'personal'].includes(form?.dataset.documentSearchScope)
                ? form.dataset.documentSearchScope
                : 'current';
            const scope = currentScope === 'current' ? 'all' : (currentScope === 'all' ? 'personal' : 'current');
            await navigate('documents', {
                ...(query ? { q: query } : {}),
                ...(scope !== 'current' ? { scope } : {}),
            }, false);
            app.querySelector('[data-mobile-search="documents"] input[name="q"]')?.focus({ preventScroll: true });
            return;
        }
        const passwordToggle = event.target.closest('[data-mobile-password-toggle]');
        if (passwordToggle) {
            const password = app.querySelector('#mobile-login-password');
            if (!password) return;
            const visible = password.type === 'password';
            password.type = visible ? 'text' : 'password';
            passwordToggle.setAttribute('aria-label', visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
            passwordToggle.innerHTML = passwordIcon(visible);
            password.focus({ preventScroll: true });
            return;
        }
        if (event.target.closest('[data-mobile-forgot-password]')) {
            const candidate = String(app.querySelector('#mobile-login-email')?.value || '').trim();
            state.passwordResetIdentifier = candidate;
            state.passwordResetMessage = '';
            state.passwordResetCooldownSeconds = 0;
            renderPasswordReset();
            return;
        }
        if (event.target.closest('[data-mobile-password-reset-back]')) {
            renderLogin();
            return;
        }
        if (event.target.closest('[data-mobile-password-reset-resend]')) {
            if (state.passwordResetCooldownSeconds > 0) return;
            state.passwordResetMessage = '';
            renderPasswordReset();
            return;
        }
        if (event.target.closest('[data-mobile-browser-login]')) {
            if (state.offline) {
                const offline = new Error('Aucune connexion réseau. Les données déjà chargées restent disponibles.');
                renderLogin(offline);
                return;
            }
            state.biometricOfferPending = true;
            persistPreferences();
            openExternalApplication({
                kind: 'browser',
                action: 'Ouvrir la connexion sécurisée',
                details: [
                    { label: 'Destination', value: 'Maison Pilote' },
                    { label: 'Session conservée', value: '30 jours' },
                ],
            }, event.target.closest('[data-mobile-browser-login]'));
            return;
        }
        const userMenuToggle = event.target.closest('[data-mobile-user-menu-toggle]');
        if (userMenuToggle) {
            const menu = app.querySelector('[data-mobile-user-menu]');
            const opening = menu?.hidden !== false;
            if (menu) menu.hidden = !opening;
            userMenuToggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
            const cameleonMenu = app.querySelector('[data-mobile-cameleon-menu]');
            const cameleonMenuToggle = app.querySelector('[data-mobile-cameleon-menu-toggle]');
            if (cameleonMenu && cameleonMenuToggle) {
                cameleonMenu.hidden = !opening;
                cameleonMenuToggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
                if (opening) {
                    loadCameleonMenuTargets(app.querySelector('[data-mobile-cameleon-search]')?.value || '');
                } else {
                    state.cameleonRequestSequence += 1;
                }
            }
            const dossierMenu = app.querySelector('[data-mobile-dossier-menu]:not([data-mobile-document-folder-menu])');
            if (dossierMenu) dossierMenu.hidden = true;
            app.querySelector('[data-mobile-dossier-menu-toggle]')?.setAttribute('aria-expanded', 'false');
            return;
        }
        const quickTheme = event.target.closest('[data-mobile-quick-theme]');
        if (quickTheme) {
            state.themePreference = ['light', 'dark', 'system'].includes(quickTheme.dataset.mobileQuickTheme)
                ? quickTheme.dataset.mobileQuickTheme
                : 'system';
            syncEmulatorTheme();
            persistPreferences();
            return;
        }
        const cameleonMenuToggle = event.target.closest('[data-mobile-cameleon-menu-toggle]');
        if (cameleonMenuToggle) {
            const menu = app.querySelector('[data-mobile-cameleon-menu]');
            const opening = menu?.hidden !== false;
            if (menu) menu.hidden = !opening;
            cameleonMenuToggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
            if (opening) {
                const input = app.querySelector('[data-mobile-cameleon-search]');
                loadCameleonMenuTargets(input?.value || '');
                window.setTimeout(() => input?.focus(), 0);
            } else {
                state.cameleonRequestSequence += 1;
            }
            return;
        }
        if (event.target.closest('[data-mobile-cameleon-retry]')) {
            await loadCameleonMenuTargets(app.querySelector('[data-mobile-cameleon-search]')?.value || '');
            return;
        }
        const dossierMenuToggle = event.target.closest('[data-mobile-dossier-menu-toggle]');
        if (dossierMenuToggle) {
            const menu = app.querySelector('[data-mobile-dossier-menu]:not([data-mobile-document-folder-menu])');
            const opening = menu?.hidden !== false;
            if (menu) menu.hidden = !opening;
            dossierMenuToggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
            const userMenu = app.querySelector('[data-mobile-user-menu]');
            if (userMenu) userMenu.hidden = true;
            app.querySelector('[data-mobile-user-menu-toggle]')?.setAttribute('aria-expanded', 'false');
            const cameleonMenu = app.querySelector('[data-mobile-cameleon-menu]');
            if (cameleonMenu) {
                cameleonMenu.hidden = true;
                state.cameleonRequestSequence += 1;
            }
            app.querySelector('[data-mobile-cameleon-menu-toggle]')?.setAttribute('aria-expanded', 'false');
            if (opening) window.setTimeout(() => app.querySelector('[data-mobile-dossier-search]')?.focus(), 0);
            return;
        }
        const dossierOption = event.target.closest('[data-mobile-dossier-option]');
        if (dossierOption) {
            try {
                const id = Number(dossierOption.dataset.mobileDossierOption);
                const currentRoute = state.route;
                const currentRouteParams = { ...state.routeParams };
                await flushMobileNotes();
                await api(`/dossiers/${id}/activate`, { method: 'POST' });
                resetMobileNotesState({ preserveActiveTab: true });
                state.activeDossierId = id;
                state.documentSelectionMode = false;
                state.selectedDocumentItems.clear();
                await loadBootstrap();
                state.documentFolderExpandedIds = new Set([0]);
                state.messageConversationId = null;
                await navigate(currentRoute, currentRouteParams, false);
            } catch (error) { renderError(error, state.route); }
            return;
        }
        const quickActionsEdit = event.target.closest('[data-quick-actions-edit]');
        if (quickActionsEdit && state.homeQuickActionsEditable && !state.quickActionsSaving) {
            if (!state.quickActionsEditing) {
                state.quickActionsEditing = true;
                state.quickActionsError = '';
                renderQuickActionsHome();
                return;
            }

            if (JSON.stringify(state.homeQuickActionKeys) === JSON.stringify(state.homeQuickActionInitialKeys)) {
                state.quickActionsEditing = false;
                state.quickActionsDialogOpen = false;
                renderQuickActionsHome();
                return;
            }

            state.quickActionsSaving = true;
            state.quickActionsDialogOpen = false;
            state.quickActionsError = '';
            renderQuickActionsHome();
            try {
                const response = await api(`/dossiers/${state.activeDossierId}/home/quick-actions`, {
                    method: 'PATCH',
                    body: { action_keys: state.homeQuickActionKeys },
                });
                state.homeQuickActionCatalog = response.data.quick_action_catalog || state.homeQuickActionCatalog;
                state.homeQuickActionKeys = (response.data.quick_actions || []).map((action) => String(action.key));
                state.homeQuickActionInitialKeys = [...state.homeQuickActionKeys];
                state.quickActionsEditing = false;
            } catch (error) {
                state.quickActionsError = error?.message || 'Les actions rapides n’ont pas pu être enregistrées.';
            } finally {
                state.quickActionsSaving = false;
                renderQuickActionsHome();
            }
            return;
        }
        const documentFolderMenuToggle = event.target.closest('[data-mobile-document-folder-menu-toggle]');
        if (documentFolderMenuToggle) {
            const menu = app.querySelector('[data-mobile-document-folder-menu]');
            const opening = menu?.hidden !== false;
            if (menu) menu.hidden = !opening;
            documentFolderMenuToggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
            if (opening) window.setTimeout(() => app.querySelector('[data-mobile-document-folder-search]')?.focus(), 0);
            return;
        }
        const documentFolderExpand = event.target.closest('[data-mobile-document-folder-expand]');
        if (documentFolderExpand) {
            const folderId = Math.max(0, Number(documentFolderExpand.dataset.mobileDocumentFolderExpand) || 0);
            if (state.documentFolderExpandedIds.has(folderId)) {
                state.documentFolderExpandedIds.delete(folderId);
            } else {
                state.documentFolderExpandedIds.add(folderId);
            }
            refreshDocumentFolderTree(app.querySelector('[data-mobile-document-folder-search]')?.value || '');
            return;
        }
        const documentFolderOption = event.target.closest('[data-mobile-document-folder-option]');
        if (documentFolderOption) {
            const folderId = Math.max(0, Number(documentFolderOption.dataset.mobileDocumentFolderOption) || 0);
            const searchForm = app.querySelector('[data-mobile-search="documents"]');
            const currentFolderId = Math.max(0, Number(searchForm?.dataset.documentFolderId) || 0);
            const currentScope = ['all', 'personal'].includes(searchForm?.dataset.documentSearchScope)
                ? searchForm.dataset.documentSearchScope
                : 'current';
            if (folderId === currentFolderId && currentScope !== 'all') {
                const menu = app.querySelector('[data-mobile-document-folder-menu]');
                if (menu) menu.hidden = true;
                app.querySelector('[data-mobile-document-folder-menu-toggle]')?.setAttribute('aria-expanded', 'false');
                return;
            }
            rememberCurrentDocumentFolder();
            closeDocumentSelectionMode();
            await navigate('documents', {
                ...(folderId > 0 ? { folder: String(folderId) } : {}),
                ...(currentScope === 'personal' ? { scope: 'personal' } : {}),
            }, false);
            return;
        }
        const documentChildFolder = event.target.closest('[data-mobile-document-child-folder]');
        if (documentChildFolder) {
            const folderId = Math.max(0, Number(documentChildFolder.dataset.mobileDocumentChildFolder) || 0);
            rememberCurrentDocumentFolder();
            closeDocumentSelectionMode();
            await navigate('documents', {
                ...(folderId > 0 ? { folder: String(folderId) } : {}),
                ...(app.querySelector('[data-mobile-search="documents"]')?.dataset.documentSearchScope === 'personal'
                    ? { scope: 'personal' }
                    : {}),
            }, false);
            return;
        }
        const quickActionRemove = event.target.closest('[data-quick-action-remove]');
        if (quickActionRemove && state.quickActionsEditing && !state.quickActionsSaving) {
            const key = String(quickActionRemove.dataset.quickActionRemove || '');
            state.homeQuickActionKeys = state.homeQuickActionKeys.filter((candidate) => candidate !== key);
            state.quickActionsError = '';
            renderQuickActionsHome();
            return;
        }
        if (event.target.closest('[data-quick-actions-add]') && state.quickActionsEditing && !state.quickActionsSaving) {
            state.quickActionsDialogOpen = true;
            renderQuickActionsHome();
            window.setTimeout(() => app.querySelector('[data-quick-actions-dialog-close]')?.focus(), 0);
            return;
        }
        const quickActionAdd = event.target.closest('[data-quick-action-add]');
        if (quickActionAdd && state.quickActionsEditing && !state.quickActionsSaving) {
            const key = String(quickActionAdd.dataset.quickActionAdd || '');
            if (state.homeQuickActionCatalog.some((action) => String(action.key) === key)
                && !state.homeQuickActionKeys.includes(key)) {
                state.homeQuickActionKeys = [...state.homeQuickActionKeys, key];
            }
            state.quickActionsError = '';
            renderQuickActionsHome();
            window.setTimeout(() => app.querySelector('[data-quick-actions-dialog-close]')?.focus(), 0);
            return;
        }
        if (event.target.closest('[data-quick-actions-dialog-close]')) {
            state.quickActionsDialogOpen = false;
            renderQuickActionsHome();
            window.setTimeout(() => app.querySelector('[data-quick-actions-add]')?.focus(), 0);
            return;
        }
        const addressOption = event.target.closest('[data-mileage-address-option]');
        if (addressOption) {
            const targetName = String(addressOption.dataset.mileageAddressTarget || '');
            const input = app.querySelector(`[data-mileage-address-input="${CSS.escape(targetName)}"]`);
            window.clearTimeout(state.mileageAddressTimer);
            state.mileageAddressSequence = (Number(state.mileageAddressSequence) || 0) + 1;
            if (input instanceof HTMLInputElement) {
                input.value = String(addressOption.dataset.mileageAddressOption || '');
                input.dataset.mileageSuggestionSelected = input.value;
            }
            app.querySelector(`[data-mileage-address-suggestions="${CSS.escape(targetName)}"]`)?.replaceChildren();
            input?.focus({ preventScroll: true });
            if (input instanceof HTMLInputElement) {
                const end = input.value.length;
                input.setSelectionRange(end, end);
                delete input.dataset.mobileQuickEntrySelected;
            }
            scheduleMileageDistance(input?.closest('form'));
            return;
        }
        const hrTransition = event.target.closest('[data-hr-transition]');
        if (hrTransition && !state.readOnly) {
            const returnToPending = state.route === 'hr_pending';
            hrTransition.disabled = true;
            const kind = hrTransition.dataset.hrKind === 'expense' ? 'expense' : 'absence';
            const itemId = Number(hrTransition.dataset.hrId) || 0;
            try {
                await api(`/dossiers/${state.activeDossierId}/${kind === 'expense' ? 'expense-reports' : 'absences'}/${itemId}/transition`, {
                    method: 'POST',
                    body: {
                        transition: String(hrTransition.dataset.hrTransition || 'approve'),
                        lock_version: Number(hrTransition.dataset.hrLockVersion) || 0,
                    },
                });
                if (kind === 'expense') closeExpenseDetailDialog();
                else app.querySelector('[data-absence-detail-dialog]')?.remove();
                const nextParams = { ...(state.routeParams || {}) };
                delete nextParams[kind === 'expense' ? 'reportId' : 'absenceId'];
                if (returnToPending) {
                    await loadHrPendingValidations();
                    await renderHrPendingValidations();
                } else if (kind === 'expense') await renderExpenses(nextParams);
                else await renderAbsences(nextParams);
            } catch (error) { renderError(error, returnToPending ? 'hr_pending' : (kind === 'expense' ? 'expenses' : 'absences')); }
            return;
        }
        const hrReject = event.target.closest('[data-hr-reject]');
        if (hrReject && !state.readOnly) {
            const expense = hrReject.dataset.hrReject === 'expense';
            if (expense) closeExpenseDetailDialog();
            else app.querySelector('[data-absence-detail-dialog]')?.remove();
            const nextParams = { ...(state.routeParams || {}) };
            delete nextParams[expense ? 'reportId' : 'absenceId'];
            state.routeParams = nextParams;
            persistNavigation();
            openHrRejectionDialog(
                expense ? 'expense' : 'absence',
                Number(hrReject.dataset.hrId) || 0,
                Number(hrReject.dataset.hrLockVersion) || 0,
            );
            return;
        }
        if (event.target.closest('[data-hr-reject-close]')) {
            app.querySelector('[data-hr-reject-dialog]')?.remove();
            return;
        }
        const hrRejectConfirm = event.target.closest('[data-hr-reject-confirm]');
        if (hrRejectConfirm && !state.readOnly && !hrRejectConfirm.disabled) {
            const returnToPending = state.route === 'hr_pending';
            const kind = hrRejectConfirm.dataset.hrKind === 'expense' ? 'expense' : 'absence';
            const reason = String(app.querySelector('[data-hr-reject-reason]')?.value || '').trim();
            if (!reason) return;
            hrRejectConfirm.disabled = true;
            try {
                await api(`/dossiers/${state.activeDossierId}/${kind === 'expense' ? 'expense-reports' : 'absences'}/${Number(hrRejectConfirm.dataset.hrId) || 0}/transition`, {
                    method: 'POST',
                    body: {
                        transition: 'reject',
                        comment: reason,
                        lock_version: Number(hrRejectConfirm.dataset.hrLockVersion) || 0,
                    },
                });
                app.querySelector('[data-hr-reject-dialog]')?.remove();
                if (returnToPending) {
                    await loadHrPendingValidations();
                    await renderHrPendingValidations();
                } else if (kind === 'expense') await renderExpenses(state.routeParams || {});
                else await renderAbsences(state.routeParams || {});
            } catch (error) { renderError(error, returnToPending ? 'hr_pending' : (kind === 'expense' ? 'expenses' : 'absences')); }
            return;
        }
        if (event.target.closest('[data-absence-detail-close]')) {
            app.querySelector('[data-absence-detail-dialog]')?.remove();
            const nextParams = { ...(state.routeParams || {}) };
            delete nextParams.absenceId;
            state.routeParams = nextParams;
            persistNavigation();
            return;
        }
        const absenceDetail = event.target.closest('[data-absence-detail]');
        if (absenceDetail && !event.target.closest('[data-hr-transition], [data-hr-reject]')) {
            await openAbsenceDetail(Number(absenceDetail.dataset.absenceDetail));
            return;
        }
        const expenseCancel = event.target.closest('[data-expense-cancel]');
        if (expenseCancel && !state.readOnly) {
            openExpenseCancelDialog(Number(expenseCancel.dataset.expenseCancel));
            return;
        }
        if (event.target.closest('[data-expense-cancel-close]')) {
            app.querySelector('[data-expense-cancel-dialog]')?.remove();
            return;
        }
        const expenseCancelConfirm = event.target.closest('[data-expense-cancel-confirm]');
        if (expenseCancelConfirm && !state.readOnly) {
            expenseCancelConfirm.disabled = true;
            try {
                await api(`/dossiers/${state.activeDossierId}/expense-reports/${Number(expenseCancelConfirm.dataset.expenseCancelConfirm)}`, { method: 'DELETE' });
                app.querySelector('[data-expense-cancel-dialog]')?.remove();
                await renderExpenses(state.routeParams || {});
            } catch (error) { renderError(error, 'expenses'); }
            return;
        }
        if (event.target.closest('[data-expense-detail-close]')) {
            closeExpenseDetailDialog();
            const nextParams = { ...(state.routeParams || {}) };
            delete nextParams.reportId;
            state.routeParams = nextParams;
            persistNavigation();
            return;
        }
        const expenseDetail = event.target.closest('[data-expense-detail]');
        if (expenseDetail && !event.target.closest('[data-hr-transition], [data-hr-reject], [data-expense-cancel]')) {
            await openExpenseDetail(Number(expenseDetail.dataset.expenseDetail));
            return;
        }
        if (event.target.closest('[data-mobile-quick-creation-close]')) {
            const dialog = app.querySelector('[data-mobile-quick-creation]');
            const reportId = Number(dialog?.dataset.mobileExpenseReportId) || 0;
            dialog?.remove();
            if (reportId > 0 && !state.readOnly) {
                clearExpenseItemDraft(reportId);
                try { await api(`/dossiers/${state.activeDossierId}/expense-reports/${reportId}`, { method: 'DELETE' }); }
                catch (_) { /* Le nettoyage serveur sera repris depuis la liste sans bloquer la fermeture. */ }
            }
            return;
        }
        const expenseReceiptContinue = event.target.closest('[data-mobile-expense-receipt-continue]');
        if (expenseReceiptContinue) {
            const reportId = Number(expenseReceiptContinue.dataset.mobileExpenseReceiptContinue) || 0;
            const quickOrigin = expenseReceiptContinue.dataset.mobileQuickOrigin === 'home';
            const form = expenseReceiptContinue.closest('[data-mobile-expense-receipt-step]');
            captureExpenseItemDraft(form);
            expenseReceiptContinue.disabled = true;
            try {
                const response = await api(`/dossiers/${state.activeDossierId}/expense-reports/${reportId}`);
                const report = response.data || {};
                if (Number(contextualUpload('expense_report', reportId)?.remoteDocumentId) > 0) {
                    try {
                        await analyzeExpenseReceipt(report);
                    } catch (_) {
                        const draft = expenseItemDraft(reportId);
                        state.expenseItemDrafts[expenseItemDraftKey(reportId)] = {
                            ...draft,
                            ocrMessage: 'La lecture automatique n’a pas abouti. Saisissez les montants manuellement.',
                        };
                    }
                }
                if (quickOrigin) openQuickExpenseDetail(report);
                else await navigate('expense_item_create', {
                    reportId,
                    lockVersion: Number(report.lock_version) || 0,
                    step: 'detail',
                }, false);
            } catch (error) {
                renderError(error, quickOrigin ? 'home' : state.route);
            }
            return;
        }
        const expenseDetailBack = event.target.closest('[data-mobile-expense-detail-back]');
        if (expenseDetailBack) {
            const reportId = Number(expenseDetailBack.dataset.mobileExpenseDetailBack) || 0;
            const quickOrigin = expenseDetailBack.dataset.mobileQuickOrigin === 'home';
            captureExpenseItemDraft();
            const response = await api(`/dossiers/${state.activeDossierId}/expense-reports/${reportId}`);
            if (quickOrigin) openQuickExpenseReceipt(response.data || {});
            else await navigate('expense_item_create', {
                reportId,
                lockVersion: Number(response.data?.lock_version) || 0,
                step: 'receipt',
            }, false);
            return;
        }
        if (event.target.closest('[data-mileage-submit-guard]')) {
            const settings = app.querySelector('[data-mileage-settings-trigger]');
            settings?.classList.add('is-attention');
            settings?.focus({ preventScroll: true });
            window.setTimeout(() => settings?.classList.remove('is-attention'), 1000);
            return;
        }
        if (event.target.closest('[data-mileage-open-settings-from-submission]')) {
            await openQuickMileageSettings();
            return;
        }
        const mileageWithdrawal = event.target.closest('[data-mileage-withdraw-submission]');
        if (mileageWithdrawal) {
            mileageWithdrawal.disabled = true;
            try {
                await api(`/dossiers/${state.activeDossierId}/mileage/trips/${Number(mileageWithdrawal.dataset.mileageWithdrawSubmission)}/withdraw-submission`, {
                    method: 'POST',
                    body: { lock_version: Number(mileageWithdrawal.dataset.lockVersion) || 0 },
                });
                showQuickCreationNotice('Envoi annulé. Tous les voyages de cette demande sont de nouveau modifiables.');
                await renderMileage(state.routeParams || {});
            } catch (error) {
                showQuickCreationNotice(error?.message || 'L’envoi n’a pas pu être annulé.');
                mileageWithdrawal.disabled = false;
            }
            return;
        }
        const absenceCreate = event.target.closest('[data-mobile-absence-create]');
        if (absenceCreate) {
            await openQuickAbsenceCreation({
                employeeId: Number(absenceCreate.dataset.employeeId) || 0,
                year: String(absenceCreate.dataset.year || ''),
            }, 'absences');
            return;
        }
        const reportCreateToggle = event.target.closest('[data-report-create-toggle]');
        if (reportCreateToggle) {
            const form = app.querySelector('[data-mobile-form="report"]');
            if (form) {
                form.hidden = !form.hidden;
                reportCreateToggle.setAttribute('aria-expanded', form.hidden ? 'false' : 'true');
                if (!form.hidden) window.requestAnimationFrame(() => form.querySelector('[data-mobile-report-type-choice]')?.focus({ preventScroll: true }));
            }
            return;
        }
        const reportTypeChoice = event.target.closest('[data-mobile-report-type-choice]');
        if (reportTypeChoice) {
            const form = reportTypeChoice.closest('[data-mobile-form="report"]');
            if (form?.elements.report_type) {
                form.elements.report_type.value = reportTypeChoice.dataset.mobileReportTypeChoice || 'balance';
                syncMobileReportFields(form);
            }
            return;
        }
        const reportSelectionAction = event.target.closest('[data-report-select-all], [data-report-deselect-all]');
        if (reportSelectionAction) {
            const selection = reportSelectionAction.closest('[data-report-selection]');
            const checked = reportSelectionAction.hasAttribute('data-report-select-all');
            selection?.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach((checkbox) => { checkbox.checked = checked; });
            syncMobileReportSelectionActions(reportSelectionAction.closest('[data-mobile-form="report"]'));
            return;
        }
        const reportDelete = event.target.closest('[data-report-delete]');
        if (reportDelete && !reportDelete.disabled) {
            reportDelete.disabled = true;
            try {
                await api(`/dossiers/${state.activeDossierId}/reports/${Number(reportDelete.dataset.reportDelete)}`, { method: 'DELETE' });
                await renderReportForm();
            } catch (error) {
                reportDelete.disabled = false;
                renderError(error, 'reports');
            }
            return;
        }
        const routeButton = event.target.closest('[data-mobile-route]');
        if (routeButton) {
            event.preventDefault();
            if (state.route === 'home' && routeButton.dataset.mobileRoute === 'payslip_latest') {
                await openLatestPayslipFromHome(routeButton);
                return;
            }
            if (state.route === 'home' && routeButton.dataset.mobileRoute === 'expense_create') {
                try {
                    await startQuickExpenseCreation();
                } catch (error) {
                    app.querySelector('[data-mobile-quick-creation]')?.remove();
                    renderError(error, 'home');
                }
                return;
            }
            if (state.route === 'home' && routeButton.dataset.mobileRoute === 'mileage_create') {
                openQuickMileageCreation();
                return;
            }
            if (state.route === 'home' && routeButton.dataset.mobileRoute === 'mileage_submit') {
                await openQuickMileageSubmission();
                return;
            }
            if (state.route === 'home' && routeButton.dataset.mobileRoute === 'task_create') {
                await openQuickTaskCreation();
                return;
            }
            if (state.route === 'home' && routeButton.dataset.mobileRoute === 'absence_create') {
                await openQuickAbsenceCreation();
                return;
            }
            if (state.route === 'home' && routeButton.dataset.mobileRoute === 'report_create') {
                await openQuickReportCreation();
                return;
            }
            await navigate(routeButton.dataset.mobileRoute, routeButton.dataset.mobileId ? { id: Number(routeButton.dataset.mobileId) } : {});
            return;
        }
        const notesPasswordAddToggle = event.target.closest('[data-mobile-notes-password-add-toggle]');
        if (notesPasswordAddToggle) {
            state.notesPasswordAddExpanded = !state.notesPasswordAddExpanded;
            renderMobileNotesContent();
            if (state.notesPasswordAddExpanded) {
                window.requestAnimationFrame(() => app.querySelector('[data-mobile-notes-password-add] input[name="site"]')?.focus({ preventScroll: true }));
            }
            return;
        }
        const notesPasswordSearchClear = event.target.closest('[data-mobile-notes-password-search-clear]');
        if (notesPasswordSearchClear) {
            state.notesPasswordQuery = '';
            renderMobileNotesContent();
            window.requestAnimationFrame(() => app.querySelector('[data-mobile-notes-password-query]')?.focus({ preventScroll: true }));
            return;
        }
        const notesPasswordToggle = event.target.closest('[data-mobile-notes-password-toggle]');
        if (notesPasswordToggle) {
            const input = notesPasswordToggle.parentElement?.querySelector('input[name="password"]');
            if (input instanceof HTMLInputElement) {
                const visible = input.type === 'text';
                input.type = visible ? 'password' : 'text';
                notesPasswordToggle.setAttribute('aria-label', visible ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
                notesPasswordToggle.title = visible ? 'Afficher le mot de passe' : 'Masquer le mot de passe';
            }
            return;
        }
        if (event.target.closest('[data-mobile-restart]')) return start();
        if (event.target.closest('[data-mobile-update]')) {
            if (iosRuntime) {
                const updateUrl = String(state.config?.update_url || '').trim();
                if (/^https:\/\/testflight\.apple\.com\//i.test(updateUrl)) {
                    window.location.assign(updateUrl);
                } else {
                    renderMandatoryUpdate();
                    const help = app.querySelector('.mobile-app-update-screen__help');
                    if (help) help.textContent = "La version TestFlight n'est pas encore publiée. Réessayez ultérieurement.";
                }
                return;
            }
            app.innerHTML = '<div class="mobile-app-update-screen"><h1>Mise à jour de Maison Pilote</h1><p>Téléchargement et vérification de la nouvelle version…</p><div class="mobile-app-progress"><span style="width:65%"></span></div></div>';
            await sleep(350);
            state.versionCode = Number(state.config?.latest_version_code || 1);
            state.versionName = String(state.config?.latest_version_name || currentVersionName);
            versionControl.value = String(state.versionCode);
            persistPreferences();
            return start();
        }
        if (event.target.closest('[data-mobile-help]')) return renderDesktopLink();
        const download = event.target.closest('[data-download-binary]');
        if (download) {
            event.preventDefault();
            return downloadBinary(
                download.dataset.downloadBinary,
                download.dataset.downloadFilename,
                download,
                download.dataset.downloadPreview !== 'off',
            );
        }
        const shareBinaryButton = event.target.closest('[data-share-binary]');
        if (shareBinaryButton) {
            event.preventDefault();
            return shareBinary(
                shareBinaryButton.dataset.shareBinary,
                shareBinaryButton.dataset.shareFilename,
                shareBinaryButton.dataset.shareMime,
                shareBinaryButton.dataset.shareCompany,
                shareBinaryButton,
            );
        }
        const binary = event.target.closest('[data-open-binary]');
        if (binary) return openBinary(binary.dataset.openBinary, binary);
        const documentUploadDestinationClose = event.target.closest('[data-mobile-document-upload-destination-close]');
        if (documentUploadDestinationClose) {
            documentUploadDestinationClose.closest('[data-mobile-document-upload-destination-dialog]')?.remove();
            window.requestAnimationFrame(() => app.querySelector('[data-upload-file]')?.focus({ preventScroll: true }));
            return;
        }
        const documentUploadDestination = event.target.closest('[data-mobile-document-upload-destination]');
        if (documentUploadDestination) {
            openDocumentUploadApplication(
                documentUploadDestination.closest('.mobile-app-document-upload-destination'),
                String(documentUploadDestination.dataset.mobileDocumentUploadDestination || ''),
            );
            return;
        }
        const upload = event.target.closest('[data-upload-file]');
        if (upload && !state.readOnly) {
            if (state.route === 'documents' && !upload.dataset.uploadContextType) {
                showDocumentUploadDestinationDialog(upload);
                return;
            }
            const cameraMode = upload.dataset.uploadMode === 'camera';
            const quickActionUpload = state.route === 'home';
            const contextType = String(upload.dataset.uploadContextType || (quickActionUpload ? 'quick_action' : 'documents'));
            if (contextType === 'expense_report') captureExpenseItemDraft();
            const contextId = Number(upload.dataset.uploadContextId) || null;
            const fileDestination = String(upload.dataset.uploadDestination || 'Comptabilité et fiscalité/Documents à traiter');
            openExternalApplication({
                kind: cameraMode ? 'camera' : 'files',
                action: cameraMode ? 'Prendre une photo' : 'Choisir un fichier',
                fileDestination,
                uploadContext: {
                    uploadToGed: true,
                    contextType,
                    ...(contextId ? { contextId } : {}),
                    ...(Number(upload.dataset.uploadFolderId) > 0 ? { folderId: Number(upload.dataset.uploadFolderId) } : {}),
                    ...(contextType === 'personal_documents' ? { returnRoute: 'documents' } : {}),
                },
                details: [{
                    label: 'Utilisation',
                    value: `Déposer dans ${fileDestination}`,
                }],
            }, upload);
            return;
        }
        if (event.target.closest('[data-notification-preferences-open]')) {
            state.notificationPreferencesOpen = true;
            state.notificationPreferencesError = '';
            renderNotificationsContent();
            startNotificationPreferencesPolling();
            window.setTimeout(() => app.querySelector('[data-notification-preferences-close]')?.focus(), 0);
            return;
        }
        if (event.target.closest('[data-notification-preferences-close]')) {
            state.notificationPreferencesOpen = false;
            state.notificationPreferencesError = '';
            stopNotificationPreferencesPolling();
            renderNotificationsContent();
            window.setTimeout(() => app.querySelector('[data-notification-preferences-open]')?.focus(), 0);
            return;
        }
        const target = event.target.closest('[data-cameleon-target]');
        if (target) {
            const results = app.querySelector('[data-mobile-cameleon-results]');
            target.disabled = true;
            try {
                return await startCameleonSession(Number(target.dataset.cameleonTarget));
            } catch (error) {
                target.disabled = false;
                if (results) results.insertAdjacentHTML('afterbegin', `<p class="is-error">${escapeHtml(error?.message || 'Le mode caméléon n’a pas pu être activé.')}</p>`);
            }
            return;
        }
        if (event.target.closest('[data-cameleon-stop]')) {
            let stopFailure = null;
            await flushMobileNotes();
            try {
                await api('/cameleon/session', { method: 'DELETE' });
            } catch (error) {
                stopFailure = error;
            }
            resetMobileNotesState();
            state.cameleonSessionId = null;
            state.homeRequestSequence += 1;
            state.messageConversationId = null;
            state.routeHistory = [];
            state.route = 'home';
            state.routeParams = {};
            state.homeQuickActionCatalog = [];
            state.homeQuickActionKeys = [];
            state.homeQuickActionInitialKeys = [];
            state.bootstrap = null;
            await purgeOfflineCache();
            try {
                await loadBootstrap();
                return navigate(profileLandingRoute(), {}, false);
            } catch (error) {
                renderError(stopFailure || error, state.route);
                return;
            }
        }
        const openDesktop = event.target.closest('[data-open-desktop]');
        if (openDesktop) {
            openExternalApplication({
                kind: 'browser',
                action: 'Ouvrir la version ordinateur',
                details: [{ label: 'Destination', value: new URL(root.dataset.siteUrl, window.location.origin).hostname }],
            }, openDesktop);
            return;
        }
        if (event.target.closest('[data-mobile-resend-email]')) {
            try {
                const response = await api('/user-settings/email/resend', { method: 'POST', body: {} });
                await renderUserSettings(response.data?.message || 'E-mail de validation renvoyé.');
            } catch (error) { renderError(error, 'user_settings'); }
            return;
        }
        if (event.target.closest('[data-mobile-password-reset]')) {
            try {
                const response = await api('/user-settings/password/reset', { method: 'POST', body: {} });
                await renderUserSettings(response.data?.message || 'Lien de réinitialisation envoyé.');
            } catch (error) { renderError(error, 'user_settings'); }
            return;
        }
        if (event.target.closest('[data-mobile-logout]')) {
            try { await logout(); } catch (error) { renderError(error, 'user_settings'); }
        }
    });

    app.addEventListener('input', (event) => {
        const noteBody = event.target.closest('[data-mobile-notes-body]');
        if (noteBody instanceof HTMLTextAreaElement) {
            const scope = String(noteBody.dataset.mobileNotesBody || '');
            state.notesDrafts[scope] = noteBody.value.slice(0, 20000);
            if (state.notesSaveTimers[scope]) window.clearTimeout(state.notesSaveTimers[scope]);
            state.notesSaveTimers[scope] = window.setTimeout(() => saveMobileNote(scope), 650);
            setMobileNotesStatus('Sauvegarde automatique en attente');
            return;
        }
        const cameraEditorText = event.target.closest('[data-mobile-camera-inline-text], [data-mobile-camera-menu-text]');
        if ((cameraEditorText instanceof HTMLInputElement || cameraEditorText instanceof HTMLTextAreaElement) && state.externalApplication?.kind === 'camera') {
            const editor = state.externalApplication.cameraEditor;
            const overlay = editor.texts.find((item) => String(item.id) === String(editor.selectedTextId));
            if (overlay) overlay.text = cameraEditorText.value.slice(0, 120);
            const linkedSelector = cameraEditorText.matches('[data-mobile-camera-inline-text]')
                ? '[data-mobile-camera-menu-text]'
                : '[data-mobile-camera-inline-text]';
            const linkedInput = app.querySelector(linkedSelector);
            if ((linkedInput instanceof HTMLInputElement || linkedInput instanceof HTMLTextAreaElement) && linkedInput.value !== cameraEditorText.value) linkedInput.value = cameraEditorText.value;
            updateCameraEditorVisualTransform();
            scheduleCameraEditorPreview();
            return;
        }
        const cameraEditorSize = event.target.closest('[data-mobile-camera-editor-size]');
        if (cameraEditorSize instanceof HTMLInputElement && state.externalApplication?.kind === 'camera') {
            const editor = state.externalApplication.cameraEditor;
            const overlay = editor.texts.find((item) => String(item.id) === String(editor.selectedTextId));
            const size = Number(cameraEditorSize.value);
            if (overlay && Number.isFinite(size)) {
                overlay.sizePercent = Math.max(2, Math.min(50, Math.round(size)));
                editor.defaultTextSize = overlay.sizePercent;
                state.photoEditorTextSizes[cameraEditorUserKey()] = overlay.sizePercent;
                persistPreferences();
            }
            updateCameraEditorVisualTransform();
            scheduleCameraEditorPreview();
            return;
        }

        const messageEditInput = event.target.closest('[data-mobile-message-edit-input]');
        if (messageEditInput instanceof HTMLTextAreaElement) {
            state.messageEditingBody = messageEditInput.value;
            return;
        }

        const phoneInput = event.target.closest('[data-mobile-phone-spacing]');
        if (phoneInput instanceof HTMLInputElement) {
            syncPhoneSpacing(phoneInput);
            return;
        }

        const supportSearchEntry = event.target.closest('[data-mobile-support-search-entry]');
        if (supportSearchEntry instanceof HTMLInputElement) {
            if (state.supportSearchTimer !== null) window.clearTimeout(state.supportSearchTimer);
            state.supportSearch = supportSearchEntry.value.slice(0, 120);
            state.supportRequestSequence += 1;
            const delay = state.supportSearch.trim() ? 280 : 0;
            state.supportSearchTimer = window.setTimeout(async () => {
                state.supportSearchTimer = null;
                if (state.route !== 'support' || state.supportSelectedTicketId !== null) return;
                try {
                    await renderSupport();
                    window.requestAnimationFrame(() => {
                        const input = app.querySelector('[data-mobile-support-search-entry]');
                        if (!(input instanceof HTMLInputElement)) return;
                        input.focus({ preventScroll: true });
                        input.setSelectionRange(input.value.length, input.value.length);
                    });
                } catch (error) {
                    renderError(error, 'support');
                }
            }, delay);
            return;
        }

        const documentSearch = event.target.closest('[data-mobile-search="documents"] input[name="q"]');
        if (documentSearch instanceof HTMLInputElement) {
            if (state.documentSearchTimer !== null) window.clearTimeout(state.documentSearchTimer);
            const query = documentSearch.value.slice(0, 120);
            const form = documentSearch.closest('[data-mobile-search="documents"]');
            const scope = ['all', 'personal'].includes(form?.dataset.documentSearchScope)
                ? form.dataset.documentSearchScope
                : 'current';
            const folderId = Math.max(0, Number(form?.dataset.documentFolderId) || 0);
            const requestSequence = ++state.documentSearchRequestSequence;
            state.routeParams = {
                ...(folderId > 0 ? { folder: String(folderId) } : {}),
                ...(query ? { q: query } : {}),
                ...(scope !== 'current' ? { scope } : {}),
            };
            persistNavigation();
            state.documentSearchTimer = window.setTimeout(
                () => loadDocumentSearch(query, scope, requestSequence),
                query ? 260 : 0,
            );
            return;
        }

        const expenseMissingReason = event.target.closest('[data-mobile-expense-receipt-step] [name="receipt_missing_reason"]');
        if (expenseMissingReason instanceof HTMLTextAreaElement) {
            const form = expenseMissingReason.closest('[data-mobile-expense-receipt-step]');
            const button = form?.querySelector('[data-mobile-expense-receipt-continue]');
            if (button instanceof HTMLButtonElement) button.disabled = expenseMissingReason.value.trim() === '';
            return;
        }

        const cameleonSearch = event.target.closest('[data-mobile-cameleon-search]');
        if (cameleonSearch instanceof HTMLInputElement) {
            if (state.cameleonSearchTimer !== null) window.clearTimeout(state.cameleonSearchTimer);
            const query = cameleonSearch.value.trim();
            const results = app.querySelector('[data-mobile-cameleon-results]');
            if (query.length === 1) {
                state.cameleonRequestSequence += 1;
                if (results) results.innerHTML = '<p>Saisissez au moins 2 caractères.</p>';
                return;
            }
            if (results) results.innerHTML = '<p>Recherche…</p>';
            state.cameleonSearchTimer = window.setTimeout(
                () => loadCameleonMenuTargets(cameleonSearch.value),
                query ? 260 : 0,
            );
            return;
        }

        const messageUserSearch = event.target.closest('[data-mobile-message-user-search]');
        if (messageUserSearch instanceof HTMLInputElement) {
            if (state.messageSelectorSearchTimer !== null) {
                window.clearTimeout(state.messageSelectorSearchTimer);
            }
            const query = messageUserSearch.value.trim();
            const userResults = app.querySelector('[data-mobile-message-user-results]');
            const conversationList = app.querySelector('[data-mobile-message-conversations]');
            if (userResults) {
                userResults.innerHTML = query.length < 2
                    ? '<p>Saisissez au moins 2 caractères pour rechercher un utilisateur.</p>'
                    : '<p>Recherche…</p>';
            }
            if (conversationList) conversationList.innerHTML = '<p>Recherche…</p>';
            state.messageSelectorSearchTimer = window.setTimeout(
                () => loadMessageSelector(messageUserSearch.value),
                query ? 260 : 0,
            );
            return;
        }

        if (event.target.matches('[data-mobile-document-folder-search]')) {
            refreshDocumentFolderTree(event.target.value);
            return;
        }

        if (!event.target.matches('[data-mobile-dossier-search]')) return;
        const query = normalizeSearchValue(event.target.value);
        const options = Array.from(app.querySelectorAll('[data-mobile-dossier-option]'));
        let visible = 0;
        options.forEach((option) => {
            const matches = normalizeSearchValue(option.querySelector('[data-mobile-dossier-label]')?.textContent).includes(query);
            option.hidden = !matches;
            if (matches) visible += 1;
        });
        const empty = app.querySelector('[data-mobile-dossier-empty]');
        if (empty) empty.hidden = visible > 0;
    });

    app.addEventListener('focusout', (event) => {
        const noteBody = event.target.closest('[data-mobile-notes-body]');
        if (noteBody instanceof HTMLTextAreaElement) {
            void saveMobileNote(String(noteBody.dataset.mobileNotesBody || ''));
        }
        const quickEntry = event.target.closest('[data-mobile-quick-entry]');
        if (quickEntry instanceof HTMLInputElement || quickEntry instanceof HTMLTextAreaElement) {
            delete quickEntry.dataset.mobileQuickEntrySelected;
        }
        const addressInput = event.target.closest('[data-mileage-address-input]');
        if (addressInput instanceof HTMLInputElement) {
            const suggestionTarget = event.relatedTarget?.closest?.('[data-mileage-address-option]');
            if (suggestionTarget?.dataset.mileageAddressTarget === addressInput.dataset.mileageAddressInput) return;
            window.clearTimeout(state.mileageAddressTimer);
            state.mileageAddressSequence = (Number(state.mileageAddressSequence) || 0) + 1;
            const targetName = String(addressInput.dataset.mileageAddressInput || '');
            app.querySelector(`[data-mileage-address-suggestions="${CSS.escape(targetName)}"]`)?.replaceChildren();
        }
    });

    app.addEventListener('keydown', (event) => {
        const hrDetailCard = event.target.closest('[data-absence-detail][role="button"], [data-expense-detail][role="button"]');
        if (hrDetailCard && event.target === hrDetailCard && ['Enter', ' '].includes(event.key)) {
            event.preventDefault();
            hrDetailCard.click();
            return;
        }
        const card = event.target.closest('[data-mobile-card-interaction][role="button"]');
        if (card && event.target === card && ['Enter', ' '].includes(event.key)) {
            event.preventDefault();
            card.click();
            return;
        }
        const mileagePurpose = event.target.closest('[data-mobile-form="mileage_trip"] input[name="purpose"]');
        if (mileagePurpose instanceof HTMLInputElement && event.key === 'Enter') {
            event.preventDefault();
            mileagePurpose.blur();
        }
    });

    app.addEventListener('submit', async (event) => {
        const supportReply = event.target.closest('[data-mobile-support-reply]');
        if (supportReply) {
            event.preventDefault();
            if (state.readOnly) return;
            const button = supportReply.querySelector('button[type="submit"]');
            const feedback = supportReply.querySelector('[data-mobile-support-reply-feedback]');
            const ticketId = Number(supportReply.dataset.mobileSupportReply) || 0;
            const message = String(supportReply.querySelector('textarea[name="message"]')?.value || '').trim();
            const fileInput = supportReply.querySelector('input[type="file"][name="attachments[]"]');
            const attachments = Array.from(fileInput?.files || []);
            const invalidAttachment = attachments.find((file) => !String(file.type || '').startsWith('image/') || file.size > 5 * 1024 * 1024);
            if (!ticketId || !message || button?.disabled) return;
            if (attachments.length > 5 || invalidAttachment) {
                if (feedback) {
                    feedback.textContent = attachments.length > 5
                        ? 'Vous pouvez joindre au maximum 5 images.'
                        : 'Chaque pièce jointe doit être une image de 5 Mo maximum.';
                }
                return;
            }
            const body = new FormData();
            body.append('message', message);
            attachments.forEach((file) => body.append('attachments[]', file, file.name));
            if (button) {
                button.disabled = true;
                button.textContent = 'Envoi…';
            }
            if (feedback) feedback.textContent = '';
            try {
                const response = await api(`/support/tickets/${ticketId}/reply`, { method: 'POST', body });
                state.supportReplyExpanded = false;
                state.supportCancelConfirmation = false;
                await renderSupportDetail(response.data?.message || 'Précision envoyée.', 'success', response.data?.ticket || null);
            } catch (error) {
                const fieldMessage = Array.isArray(error?.fields?.message) ? error.fields.message[0] : '';
                if (feedback) feedback.textContent = fieldMessage || error?.message || 'La précision n’a pas pu être envoyée.';
                if (button) {
                    button.disabled = false;
                    button.textContent = 'Envoyer';
                }
            }
            return;
        }
        const supportCreate = event.target.closest('[data-mobile-support-create]');
        if (supportCreate) {
            event.preventDefault();
            if (state.readOnly) return;
            const button = supportCreate.querySelector('button[type="submit"]');
            if (button?.disabled) return;
            if (button) {
                button.disabled = true;
                button.textContent = 'Envoi…';
            }
            const data = formDataObject(supportCreate);
            data.dossier_id = String(data.dossier_id || '').trim() || null;
            try {
                const response = await api('/support/tickets', { method: 'POST', body: data });
                state.supportCreateExpanded = false;
                await renderSupport(response.data?.message || 'Ticket envoyé.');
            } catch (error) {
                renderError(error, 'support');
            }
            return;
        }
        const notesPasswordAdd = event.target.closest('[data-mobile-notes-password-add]');
        if (notesPasswordAdd) {
            event.preventDefault();
            if (state.readOnly || state.notesSavingCount > 0) return;
            const data = formDataObject(notesPasswordAdd);
            if (!String(data.site || '').trim() || !String(data.password || '')) {
                setMobileNotesStatus('Site et mot de passe obligatoires.');
                return;
            }
            state.notesSavingCount += 1;
            setMobileNotesStatus();
            try {
                const response = await api(mobileNotesPath('/dossier-passwords'), { method: 'POST', body: data });
                if (response.data?.tab) mobileNotesTabs().passwords = response.data.tab;
                state.notesMessage = 'Mot de passe ajouté.';
                state.notesPasswordAddExpanded = false;
                renderMobileNotesContent();
            } catch (error) {
                setMobileNotesStatus(error?.message || 'Ajout impossible.');
            } finally {
                state.notesSavingCount = Math.max(0, state.notesSavingCount - 1);
                setMobileNotesStatus(state.notesMessage);
                app.querySelectorAll('[data-mobile-notes-password-add], [data-mobile-notes-password-row]').forEach(syncMobileNotesPasswordForm);
            }
            return;
        }
        const notesPasswordRow = event.target.closest('[data-mobile-notes-password-row]');
        if (notesPasswordRow) {
            event.preventDefault();
            if (state.readOnly || state.notesSavingCount > 0) return;
            const id = Number(notesPasswordRow.dataset.mobileNotesPasswordRow) || 0;
            const data = formDataObject(notesPasswordRow);
            if (!id || !String(data.site || '').trim() || !String(data.password || '')) {
                setMobileNotesStatus('Site et mot de passe obligatoires.');
                return;
            }
            state.notesSavingCount += 1;
            setMobileNotesStatus();
            try {
                const response = await api(mobileNotesPath(`/dossier-passwords/${id}`), { method: 'PATCH', body: data });
                if (response.data?.tab) mobileNotesTabs().passwords = response.data.tab;
                state.notesMessage = 'Mot de passe enregistré.';
                renderMobileNotesContent();
            } catch (error) {
                setMobileNotesStatus(error?.message || 'Sauvegarde impossible.');
            } finally {
                state.notesSavingCount = Math.max(0, state.notesSavingCount - 1);
                setMobileNotesStatus(state.notesMessage);
                app.querySelectorAll('[data-mobile-notes-password-add], [data-mobile-notes-password-row]').forEach(syncMobileNotesPasswordForm);
            }
            return;
        }
        const passwordResetForm = event.target.closest('[data-mobile-password-reset]');
        if (passwordResetForm) {
            event.preventDefault();
            await sendPasswordResetLink(passwordResetForm);
            return;
        }
        const loginForm = event.target.closest('[data-mobile-login]');
        if (loginForm) {
            event.preventDefault();
            await login(loginForm);
            return;
        }
        const taskFilters = event.target.closest('[data-mobile-task-filters]');
        if (taskFilters) {
            event.preventDefault();
            await navigate('tasks', mobileTaskFilterParams(taskFilters), false);
            return;
        }
        const search = event.target.closest('[data-mobile-search]');
        if (search) {
            event.preventDefault();
            const q = new FormData(search).get('q') || '';
            const params = { q: String(q) };
            if (search.dataset.mobileSearch === 'documents') {
                const folderId = Math.max(0, Number(search.dataset.documentFolderId) || 0);
                if (folderId > 0) params.folder = String(folderId);
                if (['all', 'personal'].includes(search.dataset.documentSearchScope)) {
                    params.scope = search.dataset.documentSearchScope;
                }
            }
            await navigate(search.dataset.mobileSearch, params);
            return;
        }
        const profileForm = event.target.closest('[data-mobile-user-profile]');
        if (profileForm) {
            event.preventDefault();
            const button = profileForm.querySelector('button[type="submit"]');
            if (button?.disabled) return;
            button.disabled = true;
            button.textContent = 'Enregistrement…';
            try {
                const body = new FormData(profileForm);
                const selfie = body.get('selfie_logo');
                if (selfie instanceof File && selfie.size > 0) body.set('logo', selfie);
                body.delete('selfie_logo');
                body.set('remove_logo', profileForm.querySelector('[name="remove_logo"]')?.checked ? '1' : '0');
                const response = await api('/user-settings/profile', { method: 'POST', body });
                await loadBootstrap();
                await renderUserSettings(response.data?.message || 'Profil mis à jour.');
            } catch (error) { renderError(error, 'user_settings'); }
            return;
        }
        const preferencesForm = event.target.closest('[data-mobile-user-preferences]');
        if (preferencesForm) {
            event.preventDefault();
            const button = preferencesForm.querySelector('button[type="submit"]');
            if (button?.disabled) return;
            button.disabled = true;
            button.textContent = 'Enregistrement…';
            try {
                const data = formDataObject(preferencesForm);
                if (!('notifications_mode' in data)) data.notifications_mode = 'sound_display';
                const response = await api('/user-settings/preferences', { method: 'PATCH', body: data });
                state.themePreference = ['light', 'dark', 'system'].includes(data.theme_mode) ? data.theme_mode : 'system';
                syncEmulatorTheme();
                persistPreferences();
                await renderUserSettings(response.data?.message || 'Préférences utilisateur enregistrées.');
            } catch (error) { renderError(error, 'user_settings'); }
            return;
        }
        const messageEditForm = event.target.closest('[data-mobile-message-edit-form]');
        if (messageEditForm) {
            event.preventDefault();
            if (state.readOnly || state.messageEditInFlight) return;
            const messageId = Number(messageEditForm.dataset.mobileMessageId) || 0;
            const message = String(new FormData(messageEditForm).get('message') || '').trim();
            const maxLength = Math.max(0, Number(state.messagePayload?.composer?.max_length) || 0);
            const button = messageEditForm.querySelector('button[type="submit"]');
            const errorElement = messageEditForm.querySelector('[data-mobile-message-edit-error]');
            const setError = (value = '') => {
                if (!errorElement) return;
                errorElement.textContent = value;
                errorElement.hidden = value === '';
            };
            setError();
            if (!messageId) {
                setError('Message introuvable.');
                return;
            }
            if (!message) {
                setError('Le message ne peut pas être vide.');
                return;
            }
            if (maxLength && Array.from(message).length > maxLength) {
                setError(`Les messages sont limités à ${maxLength} caractères pour votre compte.`);
                return;
            }

            state.messageEditingBody = message;
            state.messageEditInFlight = true;
            if (button) button.disabled = true;
            const requestSequence = ++state.messageRequestSequence;
            try {
                const response = await api(`/dossiers/${state.activeDossierId}/referent-conversation/messages/${messageId}`, {
                    method: 'PATCH',
                    body: { message },
                });
                if (requestSequence === state.messageRequestSequence && state.route === 'messages') {
                    state.messageEditingId = null;
                    state.messageEditingBody = '';
                    updateMessageConversation(response.data || {});
                }
            } catch (error) {
                const fieldMessage = Array.isArray(error?.fields?.message) ? error.fields.message[0] : '';
                setError(fieldMessage || error?.message || 'La modification a échoué.');
            } finally {
                state.messageEditInFlight = false;
                if (button) button.disabled = false;
            }
            return;
        }
        const messageForm = event.target.closest('[data-mobile-message-form]');
        if (messageForm) {
            event.preventDefault();
            if (state.readOnly) return;
            const message = String(new FormData(messageForm).get('message') || '').trim();
            const button = messageForm.querySelector('button[type="submit"]');
            if (!message || button?.disabled) return;
            button.disabled = true;
            button.setAttribute('aria-label', 'Envoi en cours');
            state.messageSendInFlight = true;
            const requestSequence = ++state.messageRequestSequence;
            try {
                const response = await api(`/dossiers/${state.activeDossierId}/referent-conversation/messages`, {
                    method: 'POST',
                    body: {
                        message,
                        ...(state.messageConversationId ? { conversation_id: state.messageConversationId } : {}),
                    },
                });
                if (requestSequence === state.messageRequestSequence && state.route === 'messages') {
                    messageForm.reset();
                    updateMessageConversation(response.data || {}, true);
                    button.disabled = false;
                    button.setAttribute('aria-label', 'Envoyer le message');
                }
            } catch (error) {
                renderError(error, 'messages');
            } finally {
                state.messageSendInFlight = false;
            }
            return;
        }
        const form = event.target.closest('[data-mobile-form]');
        if (form) { event.preventDefault(); await submitMobileForm(form); }
    });

    app.addEventListener('change', async (event) => {
        const deviceCameraInput = event.target.closest('[data-mobile-device-camera-input]');
        if (deviceCameraInput instanceof HTMLInputElement && state.externalApplication?.kind === 'camera') {
            const capturedPage = deviceCameraInput.files?.[0] || null;
            deviceCameraInput.value = '';
            if (!(capturedPage instanceof File) || capturedPage.size < 1) return;
            const supportedImage = String(capturedPage.type || '').startsWith('image/')
                || /\.(?:avif|heic|heif|jpe?g|png|webp)$/i.test(capturedPage.name || '');
            if (!supportedImage) {
                deviceCameraInput.insertAdjacentHTML('afterend', '<p class="mobile-external-camera__error">Le fichier retourné par l’appareil photo n’est pas une image reconnue.</p>');
                return;
            }

            const invocation = state.externalApplication;
            const pages = Array.isArray(invocation.cameraPages) ? invocation.cameraPages : [];
            const replacementIndex = Number.isInteger(invocation.cameraReplacingIndex)
                ? invocation.cameraReplacingIndex
                : null;
            const nextPages = [...pages];
            if (replacementIndex !== null && replacementIndex >= 0 && replacementIndex < nextPages.length) {
                nextPages[replacementIndex] = capturedPage;
                invocation.cameraSelectedIndex = replacementIndex;
            } else {
                nextPages.push(capturedPage);
                invocation.cameraSelectedIndex = nextPages.length - 1;
            }
            invocation.cameraPages = nextPages;
            invocation.cameraReplacingIndex = null;
            invocation.cameraEditor = defaultCameraEditor();
            renderExternalCameraReview();
            return;
        }

        const supportStatus = event.target.closest('[data-mobile-support-status]');
        if (supportStatus instanceof HTMLInputElement) {
            const checked = Array.from(app.querySelectorAll('[data-mobile-support-status]:checked'))
                .map((input) => String(input.value || ''))
                .filter(Boolean);
            if (!checked.length) {
                supportStatus.checked = true;
                return;
            }
            state.supportStatuses = checked;
            state.supportStatusSelectorOpen = true;
            await renderSupport();
            return;
        }
        const notesTab = event.target.closest('[data-mobile-notes-tab]');
        if (notesTab instanceof HTMLSelectElement) {
            await flushMobileNotes();
            state.notesActiveTab = notesTab.value;
            state.notesMessage = '';
            renderMobileNotesContent();
            return;
        }
        const reportSelection = event.target.closest('[data-report-selection] input[type="checkbox"]');
        if (reportSelection) {
            syncMobileReportSelectionActions(reportSelection.closest('[data-mobile-form="report"]'));
            return;
        }
        const reportType = event.target.closest('[data-mobile-report-type]');
        if (reportType) {
            syncMobileReportFields(reportType.closest('[data-mobile-form="report"]'));
            return;
        }
        const taskFilter = event.target.closest('[data-mobile-task-filter]');
        if (taskFilter) {
            const form = taskFilter.closest('[data-mobile-task-filters]');
            await navigate('tasks', mobileTaskFilterParams(form), false);
            return;
        }
        const cameraPageSelector = event.target.closest('[data-mobile-camera-page-selector]');
        if (cameraPageSelector instanceof HTMLSelectElement && state.externalApplication?.kind === 'camera') {
            const invocation = state.externalApplication;
            const pages = Array.isArray(invocation.cameraPages) ? invocation.cameraPages : [];
            const currentIndex = Math.max(0, Math.min(pages.length - 1, Math.trunc(Number(invocation.cameraSelectedIndex) || 0)));
            const targetIndex = Math.max(0, Math.min(pages.length - 1, Math.trunc(Number(cameraPageSelector.value) || 0)));
            if (targetIndex === currentIndex) return;
            cameraPageSelector.disabled = true;
            try {
                const prepared = await applyCameraPageEdits(pages[currentIndex], invocation.cameraEditor);
                if (state.externalApplication !== invocation) return;
                invocation.cameraPages = pages.map((page, index) => index === currentIndex ? prepared : page);
                invocation.cameraSelectedIndex = targetIndex;
                invocation.cameraEditor = defaultCameraEditor();
                renderExternalCameraReview();
            } catch (error) {
                cameraPageSelector.disabled = false;
                cameraPageSelector.value = String(currentIndex);
                cameraPageSelector.insertAdjacentHTML('afterend', `<span class="mobile-external-camera__error">${escapeHtml(error?.message || 'L’image n’a pas pu être préparée.')}</span>`);
            }
            return;
        }
        const cameraEditorFont = event.target.closest('[data-mobile-camera-editor-font]');
        if (cameraEditorFont instanceof HTMLSelectElement && state.externalApplication?.kind === 'camera') {
            const font = String(cameraEditorFont.value || 'sans');
            if (!cameraEditorFonts.some(({ key }) => key === font)) return;
            const editor = state.externalApplication.cameraEditor;
            const overlay = editor.texts.find((item) => String(item.id) === String(editor.selectedTextId));
            if (overlay) overlay.font = font;
            editor.defaultFont = font;
            state.photoEditorFonts[cameraEditorUserKey()] = font;
            persistPreferences();
            scheduleCameraEditorPreview();
            return;
        }
        const cameraEditorColor = event.target.closest('[data-mobile-camera-editor-color]');
        if (cameraEditorColor instanceof HTMLSelectElement && state.externalApplication?.kind === 'camera') {
            const color = String(cameraEditorColor.value || 'auto');
            if (!cameraEditorColors.some(({ key }) => key === color)) return;
            const editor = state.externalApplication.cameraEditor;
            const overlay = editor.texts.find((item) => String(item.id) === String(editor.selectedTextId));
            if (overlay) overlay.color = color;
            scheduleCameraEditorPreview();
            return;
        }
        const cameraDossier = event.target.closest('[data-mobile-camera-dossier]');
        if (cameraDossier instanceof HTMLSelectElement) {
            const previousDossierId = state.activeDossierId;
            const nextDossierId = Number(cameraDossier.value);
            if (!Number.isSafeInteger(nextDossierId) || nextDossierId < 1 || nextDossierId === Number(previousDossierId)) return;

            const status = cameraDossier.closest('.mobile-external-application__dossier')
                ?.querySelector('[data-mobile-camera-dossier-status]');
            cameraDossier.disabled = true;
            if (status) status.textContent = 'Changement en cours…';
            try {
                await api(`/dossiers/${nextDossierId}/activate`, { method: 'POST' });
                state.activeDossierId = nextDossierId;
                await loadBootstrap();
                state.documentFolderExpandedIds = new Set([0]);
                state.routeParams = {};
                state.messageConversationId = null;
                if (state.externalApplication?.uploadContext?.uploadToGed) {
                    const contextType = String(state.externalApplication.uploadContext.contextType || '');
                    state.externalApplication.uploadContext = {
                        uploadToGed: true,
                        ...(['quick_action', 'documents', 'documents_folder'].includes(contextType)
                            ? { contextType }
                            : {}),
                        expectedIdentityScope: currentUploadIdentityScope(),
                    };
                }
                persistNavigation();
                if (status) status.textContent = 'Entreprise active mise à jour. La photo y sera rattachée.';
            } catch (error) {
                cameraDossier.value = String(previousDossierId || '');
                if (status) status.textContent = error?.message || 'Le changement d’entreprise a échoué.';
            } finally {
                cameraDossier.disabled = false;
            }
            return;
        }

        const biometricActivation = event.target.closest('[data-mobile-biometric-activation-confirm]');
        if (biometricActivation instanceof HTMLInputElement && biometricActivation.checked) {
            const activationTest = biometricActivation.closest('[data-mobile-biometric-activation-test]');
            const source = activationTest?.dataset.source;
            biometricActivation.disabled = true;
            window.setTimeout(async () => {
                try {
                    await setBiometricEnabled(true);
                    activationTest?.remove();
                    if (source === 'settings') renderUserSettings('Connexion biométrique activée après vérification.');
                } catch (error) {
                    biometricActivation.disabled = false;
                    biometricActivation.checked = false;
                    const dialogBody = activationTest?.querySelector('.mobile-app-biometric-dialog__body');
                    dialogBody?.querySelector('.mobile-app-settings-message')?.remove();
                    dialogBody?.insertAdjacentHTML('afterbegin', `<div class="mobile-app-settings-message is-error" role="alert">${escapeHtml(error?.message || 'Activation impossible.')}</div>`);
                }
            }, 350);
            return;
        }

        const biometricUnlock = event.target.closest('[data-mobile-biometric-unlock]');
        if (biometricUnlock instanceof HTMLInputElement && biometricUnlock.checked) {
            biometricUnlock.disabled = true;
            window.setTimeout(async () => {
                state.biometricLocked = false;
                renderLoading('Maison Pilote');
                await completeAuthenticatedStart();
            }, 350);
            return;
        }

        const biometricSetting = event.target.closest('[data-mobile-biometric-setting]');
        if (biometricSetting instanceof HTMLInputElement) {
            const previous = state.biometricEnabled;
            if (iosRuntime) {
                biometricSetting.disabled = true;
                try {
                    await setBiometricEnabled(biometricSetting.checked);
                    await renderUserSettings(biometricSetting.checked
                        ? 'Connexion biométrique activée.'
                        : 'Connexion biométrique désactivée.');
                } catch (error) {
                    state.biometricEnabled = previous;
                    persistPreferences();
                    await renderUserSettings(error?.message || 'Impossible de modifier la connexion biométrique.', 'error');
                }
                return;
            }
            if (biometricSetting.checked && !previous) {
                biometricSetting.checked = false;
                showBiometricActivationTest('settings');
                return;
            }
            biometricSetting.disabled = true;
            setBiometricEnabled(biometricSetting.checked)
                .then(() => renderUserSettings(biometricSetting.checked
                    ? 'Connexion biométrique activée.'
                    : 'Connexion biométrique désactivée.'))
                .catch((error) => {
                    state.biometricEnabled = previous;
                    persistPreferences();
                    renderUserSettings(error?.message || 'Impossible de modifier la connexion biométrique.', 'error');
                });
            return;
        }

        const payslipYear = event.target.closest('[data-mobile-payslip-year]');
        if (payslipYear instanceof HTMLSelectElement) {
            renderEmployeePayslips(payslipYear.value);
            return;
        }

        const payslipEmployee = event.target.closest('[data-mobile-payslip-employee]');
        if (payslipEmployee instanceof HTMLSelectElement) {
            renderManagerPayslips(Number(payslipEmployee.value) || 0, 'all');
            return;
        }

        const payslipMonth = event.target.closest('[data-mobile-payslip-month]');
        if (payslipMonth instanceof HTMLSelectElement) {
            const employeeId = Number(app.querySelector('[data-mobile-payslip-employee]')?.value) || 0;
            renderManagerPayslips(employeeId, payslipMonth.value || 'all');
            return;
        }

        const hrPageSelector = event.target.closest('[data-mobile-hr-page-selector]');
        if (hrPageSelector instanceof HTMLSelectElement) {
            await navigate(hrPageSelector.value, {});
            return;
        }

        const employeeDocumentFilter = event.target.closest('[data-mobile-employee-document-filter]');
        if (employeeDocumentFilter instanceof HTMLSelectElement) {
            const employeeId = Number(app.querySelector('[data-mobile-employee-document-filter="employee"]')?.value) || 0;
            const month = employeeDocumentFilter.dataset.mobileEmployeeDocumentFilter === 'employee'
                ? 'all'
                : (app.querySelector('[data-mobile-employee-document-filter="month"]')?.value || 'all');
            await navigate('employee_documents', { employeeId, month }, false);
            return;
        }

        const absenceFilter = event.target.closest('[data-mobile-absence-filter]');
        if (absenceFilter instanceof HTMLSelectElement) {
            const employeeId = Number(app.querySelector('[data-mobile-absence-filter="employee"]')?.value) || 0;
            const year = app.querySelector('[data-mobile-absence-filter="year"]')?.value || 'all';
            await navigate('absences', { employeeId, year }, false);
            return;
        }

        const absenceFormField = event.target.closest('[data-mobile-form="absence"] [name="payroll_employee_id"], [data-mobile-form="absence"] [name="payroll_leave_type_id"], [data-mobile-form="absence"] [name="starts_on"], [data-mobile-form="absence"] [name="ends_on"], [data-mobile-form="absence"] [name="start_segment"], [data-mobile-form="absence"] [name="end_segment"]');
        if (absenceFormField) {
            scheduleMobileAbsencePreview(absenceFormField.closest('[data-mobile-form="absence"]'));
            return;
        }

        const otherDocumentFolder = event.target.closest('[data-mobile-document-upload-folder]');
        if (otherDocumentFolder instanceof HTMLSelectElement && otherDocumentFolder.value !== '') {
            openDocumentUploadApplication(
                otherDocumentFolder.closest('.mobile-app-document-upload-destination'),
                'other_folder',
            );
            return;
        }

        const mobileAccessEmployee = event.target.closest('[data-mobile-employee-access-employee]');
        if (mobileAccessEmployee instanceof HTMLSelectElement) {
            await navigate('employee_mobile_access', { employeeId: Number(mobileAccessEmployee.value) || 0 }, false);
            return;
        }

        const mobileAccessSwitch = event.target.closest('[data-mobile-employee-access-page]');
        if (mobileAccessSwitch instanceof HTMLInputElement && !state.readOnly) {
            const employeeId = Number(mobileAccessSwitch.dataset.mobileEmployeeId) || 0;
            const switches = Array.from(app.querySelectorAll('[data-mobile-employee-access-page]'));
            switches.forEach((input) => { input.disabled = true; });
            try {
                await api(`/dossiers/${state.activeDossierId}/employee-mobile-access/${employeeId}`, {
                    method: 'PATCH',
                    body: {
                        access: {
                            absences: Boolean(app.querySelector('[data-mobile-employee-access-page="absences"]')?.checked),
                            expenses: Boolean(app.querySelector('[data-mobile-employee-access-page="expenses"]')?.checked),
                            mileage: Boolean(app.querySelector('[data-mobile-employee-access-page="mileage"]')?.checked),
                        },
                    },
                });
                await renderEmployeeMobileAccess({ employeeId }, 'Autorisations enregistrées.');
            } catch (error) {
                renderError(error, 'employee_mobile_access');
            }
            return;
        }

        const expenseFilter = event.target.closest('[data-mobile-expense-filter]');
        if (expenseFilter) {
            const year = app.querySelector('[data-mobile-expense-filter="year"]')?.value || 'all';
            const employeeId = Number(app.querySelector('[data-mobile-expense-filter="employee"]')?.value) || 0;
            await navigate('expenses', { employeeId, year }, false);
            return;
        }

        const mileageFilter = event.target.closest('[data-mobile-mileage-filter]');
        if (mileageFilter) {
            const selectedPeriod = app.querySelector('[data-mobile-mileage-filter="period"]')?.value || 'all';
            const status = app.querySelector('[data-mobile-mileage-filter="status"]')?.value || 'all';
            const period = selectedPeriod.startsWith('month:') ? 'month' : (selectedPeriod.startsWith('year:') ? 'year' : 'all');
            const month = period === 'month' ? selectedPeriod.slice(6) : state.routeParams.month;
            const year = period === 'year' ? selectedPeriod.slice(5) : state.routeParams.year;
            await navigate('mileage', { period, status, month, year }, false);
            return;
        }

        const mileageSubmissionBound = event.target.closest('[data-mobile-mileage-submission-bound]');
        if (mileageSubmissionBound) {
            const form = mileageSubmissionBound.closest('[data-mobile-form="mileage_submit"]');
            const from = form?.querySelector('[name="from"]')?.value || '';
            const to = form?.querySelector('[name="to"]')?.value || '';
            if (form?.dataset.mobileQuickOrigin === 'home') {
                await openQuickMileageSubmission({ from, to });
            } else {
                await navigate('mileage_submit', { from, to }, false);
            }
            return;
        }

        const notificationPreference = event.target.closest('[data-notification-preference-category][data-notification-preference-field]');
        if (notificationPreference instanceof HTMLInputElement
            && !state.readOnly
            && !state.notificationPreferencesSaving) {
            const category = String(notificationPreference.dataset.notificationPreferenceCategory || '');
            const field = String(notificationPreference.dataset.notificationPreferenceField || '');
            if (!['device_enabled', 'email_enabled'].includes(field)) return;

            const previous = state.notificationPreferences.map((preference) => ({ ...preference }));
            state.notificationPreferencesRevision += 1;
            state.notificationPreferences = state.notificationPreferences.map((preference) => String(preference.category) === category
                ? { ...preference, [field]: notificationPreference.checked }
                : preference);
            state.notificationPreferencesSaving = true;
            state.notificationPreferencesError = '';
            const scrollTop = app.querySelector('.mobile-app-notification-preferences-dialog__body')?.scrollTop || 0;
            renderNotificationsContent();
            api(notificationPreferencesEndpoint(), {
                method: 'PATCH',
                body: {
                    preferences: state.notificationPreferences.map((preference) => {
                        const payload = {
                            category: String(preference.category),
                            device_enabled: Boolean(preference.device_enabled),
                        };
                        if (String(preference.category) === 'payroll_hr'
                            && Object.prototype.hasOwnProperty.call(preference, 'email_enabled')) {
                            payload.email_enabled = Boolean(preference.email_enabled);
                        }

                        return payload;
                    }),
                },
            }).then((response) => {
                state.notificationPreferencesRevision += 1;
                state.notificationPreferences = (response.data || state.notificationPreferences)
                    .filter((preference) => !isSalariedUser()
                        || !salariedRestrictedNotificationPreferenceCategories.has(String(preference?.category || '')));
            }).catch((error) => {
                state.notificationPreferencesRevision += 1;
                state.notificationPreferences = previous;
                state.notificationPreferencesError = error?.message || 'Le paramétrage des notifications n’a pas pu être enregistré.';
            }).finally(() => {
                state.notificationPreferencesSaving = false;
                renderNotificationsContent();
                window.setTimeout(() => {
                    const body = app.querySelector('.mobile-app-notification-preferences-dialog__body');
                    if (body) body.scrollTop = scrollTop;
                    app.querySelector(`[data-notification-preference-category="${category}"][data-notification-preference-field="${field}"]`)?.focus();
                }, 0);
            });
            return;
        }

        const taskForm = event.target.closest('[data-mobile-form="task"]');
        if (!taskForm) return;
        if (event.target.matches('[data-mobile-task-module]')) syncMobileTaskCategoryOptions(taskForm);
        if (event.target.matches('[data-mobile-task-recurrence]')) syncMobileTaskRecurrence(taskForm);
        if (event.target.matches('[data-mobile-task-reminder]')) syncMobileTaskReminder(taskForm);
    });

    app.addEventListener('input', (event) => {
        const expenseItemForm = event.target.closest('[data-mobile-form="expense_item"]');
        if (expenseItemForm instanceof HTMLFormElement) {
            captureExpenseItemDraft(expenseItemForm);
            return;
        }
        const hrRejectReason = event.target.closest('[data-hr-reject-reason]');
        if (hrRejectReason instanceof HTMLTextAreaElement) {
            const confirm = app.querySelector('[data-hr-reject-confirm]');
            if (confirm instanceof HTMLButtonElement) confirm.disabled = state.readOnly || hrRejectReason.value.trim() === '';
            return;
        }
        const notesPasswordQuery = event.target.closest('[data-mobile-notes-password-query]');
        if (notesPasswordQuery instanceof HTMLInputElement) {
            state.notesPasswordQuery = notesPasswordQuery.value.slice(0, 255);
            filterMobileNotesPasswords(state.notesPasswordQuery);
            return;
        }
        const addressInput = event.target.closest('[data-mileage-address-input]');
        if (addressInput instanceof HTMLInputElement) {
            delete addressInput.dataset.mileageSuggestionSelected;
            const targetName = String(addressInput.dataset.mileageAddressInput || '');
            const query = addressInput.value.trim();
            window.clearTimeout(state.mileageAddressTimer);
            const sequence = (Number(state.mileageAddressSequence) || 0) + 1;
            state.mileageAddressSequence = sequence;
            const container = app.querySelector(`[data-mileage-address-suggestions="${CSS.escape(targetName)}"]`);
            scheduleMileageDistance(addressInput.closest('form'));
            if (query.length < 3) {
                container?.replaceChildren();
                return;
            }
            state.mileageAddressTimer = window.setTimeout(async () => {
                try {
                    const response = await api(`/mileage/addresses?q=${encodeURIComponent(query)}`);
                    if (sequence !== state.mileageAddressSequence || !container?.isConnected) return;
                    container.innerHTML = (response.data || []).map((item) => `<button type="button" data-mileage-address-option="${escapeHtml(item.label)}" data-mileage-address-target="${escapeHtml(targetName)}">${escapeHtml(item.label)}</button>`).join('');
                } catch (_) { container?.replaceChildren(); }
            }, 280);
            return;
        }
        const notesPasswordForm = event.target.closest('[data-mobile-notes-password-add], [data-mobile-notes-password-row]');
        if (notesPasswordForm instanceof HTMLFormElement) {
            syncMobileNotesPasswordForm(notesPasswordForm);
            return;
        }
        const mileageDistance = event.target.closest('[name="distance_km"]');
        if (mileageDistance instanceof HTMLInputElement) {
            const form = mileageDistance.closest('form');
            const departure = String(form?.elements.departure?.value || '').trim();
            const arrival = String(form?.elements.arrival?.value || '').trim();
            mileageDistance.dataset.mileageManualKey = `${departure}|${arrival}`;
            const status = form?.querySelector('[data-mileage-distance-status]');
            if (status) status.textContent = 'Distance modifiée manuellement.';
            return;
        }
        const taskForm = event.target.closest('[data-mobile-form="task"]');
        if (!taskForm) return;
        if (event.target.matches('[name="recurrence_interval"]')) syncMobileTaskRecurrence(taskForm);
        if (event.target.matches('[name="reminder_days_before"]')) syncMobileTaskReminder(taskForm);
    });

    app.addEventListener('keydown', (event) => {
        const mobileSelectSearch = event.target.closest('[data-mobile-select-search]');
        if (mobileSelectSearch instanceof HTMLInputElement && event.key === 'ArrowDown') {
            event.preventDefault();
            activeMobileSelectMenu?.querySelector('[data-mobile-select-option]:not([hidden]):not(:disabled)')?.focus({ preventScroll: true });
            return;
        }
        const mobileSelectTrigger = event.target.closest('[data-mobile-select-trigger]');
        if (mobileSelectTrigger instanceof HTMLButtonElement && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            const select = mobileSelectTrigger.closest('.mobile-app-select')?.querySelector('select');
            openMobileSelect(select, mobileSelectTrigger);
            return;
        }
        const mobileSelectOption = event.target.closest('[data-mobile-select-option]');
        if (mobileSelectOption && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const options = Array.from(activeMobileSelectMenu?.querySelectorAll('[data-mobile-select-option]:not([hidden]):not(:disabled)') || []);
            const currentIndex = options.indexOf(mobileSelectOption);
            const nextIndex = event.key === 'Home'
                ? 0
                : event.key === 'End'
                    ? options.length - 1
                    : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
            options[nextIndex]?.focus({ preventScroll: true });
            return;
        }
        if (event.key === 'Escape' && activeMobileSelect) {
            event.preventDefault();
            closeMobileSelect(true);
            return;
        }
        if (!['Enter', ' '].includes(event.key)) return;
        if (event.target.closest('.mobile-app-message__actions')) return;
        const messageActionsToggle = event.target.closest('[data-mobile-message-actions-toggle]');
        if (!messageActionsToggle) return;
        event.preventDefault();
        messageActionsToggle.click();
    });

    app.addEventListener('scroll', (event) => {
        if (activeMobileSelect && !event.target.closest?.('.mobile-app-select-menu')) closeMobileSelect();
    }, true);

    async function applyHostedSettings(settings) {
        if (!settings || typeof settings !== 'object') return;
        const nextProfile = String(settings.deviceProfile || '412x915');
        const profileControl = root.querySelector('[data-emulator-profile]');
        const normalizedProfile = Array.from(profileControl?.options || []).some((option) => option.value === nextProfile)
            ? nextProfile
            : '412x915';
        const nextOrientation = settings.orientation === 'landscape' ? 'landscape' : 'portrait';
        const nextTheme = ['light', 'dark', 'system'].includes(settings.theme) ? settings.theme : 'system';
        const nextLatency = Math.max(0, Number(settings.latency) || 0);
        const requestedVersionCode = Math.max(1, Number(settings.versionCode) || currentVersionCode);
        const nextVersion = publishedVersions.find((version) => version.code === requestedVersionCode)
            || publishedVersions.find((version) => version.code === currentVersionCode)
            || { code: currentVersionCode, name: currentVersionName };
        const nextOffline = settings.offline === true;
        const restartRequired = state.versionCode !== nextVersion.code || state.offline !== nextOffline;

        state.deviceProfile = normalizedProfile;
        state.orientation = nextOrientation;
        state.themePreference = nextTheme;
        state.latency = nextLatency;
        state.versionCode = nextVersion.code;
        state.versionName = String(settings.versionName || nextVersion.name || currentVersionName);
        state.offline = nextOffline;
        restoreControls();
        persistPreferences();

        if (restartRequired) {
            await start();
        }
    }

    async function applyHostedWriteState(payload) {
        if (!payload || typeof payload !== 'object') return;
        state.owner = state.authenticated && payload.owner === true;
        state.readOnly = state.owner ? false : payload.readOnly !== false;
        state.writesUntil = state.owner ? null : (payload.writesUntil || null);
        syncSafetyBar();
        if (state.authenticated && state.bootstrap) await navigate(state.route, state.routeParams, false);
    }

    root.querySelector('[data-emulator-profile]').addEventListener('change', (event) => {
        state.deviceProfile = event.target.value;
        applyDeviceSize();
        persistPreferences();
    });
    root.querySelector('[data-emulator-orientation]').addEventListener('change', (event) => {
        state.orientation = event.target.value === 'landscape' ? 'landscape' : 'portrait';
        applyDeviceSize();
        persistPreferences();
    });
    root.querySelector('[data-emulator-theme]').addEventListener('change', (event) => {
        state.themePreference = ['light', 'dark', 'system'].includes(event.target.value) ? event.target.value : 'system';
        syncEmulatorTheme();
        persistPreferences();
    });
    root.querySelector('[data-emulator-latency]').addEventListener('change', (event) => {
        state.latency = Number(event.target.value) || 0;
        persistPreferences();
    });
    versionControl.addEventListener('change', async (event) => {
        state.versionCode = Math.max(0, Number(event.target.value) || 0);
        state.versionName = String(event.target.selectedOptions?.[0]?.dataset.versionName
            || publishedVersions.find((version) => version.code === state.versionCode)?.name
            || (state.versionCode === currentVersionCode ? currentVersionName : `${state.versionCode}.0.0`));
        persistPreferences();
        await start();
    });
    root.querySelector('[data-emulator-offline]').addEventListener('change', async (event) => {
        state.offline = event.target.checked;
        networkStatus.textContent = state.offline ? 'Hors ligne' : 'En ligne';
        networkStatus.className = `badge ${state.offline ? 'text-bg-warning' : 'text-bg-secondary'}`;
        syncConnectivityStatus();
        persistPreferences();
        if (state.offline && state.authenticated && state.bootstrap) {
            await navigate(state.route, state.routeParams, false);
        } else {
            await start();
        }
    });
    root.querySelector('[data-emulator-clear-cache]').addEventListener('click', async () => {
        try {
            if (root.dataset.clearCacheUrl) {
                await controlRequest(root.dataset.clearCacheUrl, { method: 'DELETE', respectOffline: false });
            }
            await purgeOfflineCache();
            localStorage.removeItem(preferencesStorageKey);
            sessionStorage.removeItem(runtimeSessionStorageKey);
            sessionStorage.removeItem(transientBackgroundStorageKey);
            sessionStorage.removeItem(navigationSessionStorageKey);
            sessionStorage.removeItem(pendingSiteLoginStorageKey);
            window.location.reload();
        } catch (error) {
            renderError(error, state.route);
        }
    });
    root.querySelector('[data-emulator-restart]').addEventListener('click', async () => {
        state.bootstrap = null;
        state.biometricLocked = state.authenticated && state.biometricEnabled;
        state.activeDossierId = null;
        state.route = 'home';
        state.routeParams = {};
        state.routeHistory = [];
        state.messageConversationId = null;
        await start();
    });
    root.querySelector('[data-emulator-open-link]').addEventListener('click', async () => {
        const value = root.querySelector('[data-emulator-deep-link]').value;
        if (openSignatureExperience(value)) return;
        let pathname = '';
        const siteLogin = siteLoginAuthorizationFromUrl(value);
        if (siteLogin) {
            window.clearTimeout(siteLoginRetryTimer);
            siteLoginRetryTimer = null;
            rememberPendingSiteLogin(siteLogin);
            if (!state.authenticated) {
                renderLogin();
            } else if (state.biometricLocked) {
                renderBiometricLock();
            } else {
                await completePendingSiteLogin();
            }
            return;
        }
        const cameleonNotification = cameleonNotificationTargetFromUrl(value);
        if (cameleonNotification) {
            try {
                await startCameleonSession(cameleonNotification.userId, cameleonNotification.destination, cameleonNotification.params);
            } catch (error) {
                renderError(error, state.route);
            }
            return;
        }
        let routeParams = {};
        try {
            const parsed = new URL(value, root.dataset.siteUrl);
            pathname = parsed.pathname;
            routeParams = normalizedNotificationRouteParams(Object.fromEntries(parsed.searchParams.entries()));
        } catch (_) { pathname = value; }
        const targetDossierId = Math.max(0, Number(routeParams.dossierId) || 0);
        if (targetDossierId > 0 && targetDossierId !== Number(state.activeDossierId)) {
            await api(`/dossiers/${targetDossierId}/activate`, { method: 'POST' });
            state.activeDossierId = targetDossierId;
            await loadBootstrap();
            state.documentFolderExpandedIds = new Set([0]);
            state.messageConversationId = null;
        }
        const mapping = [
            ['assistant-vocal', 'assistant'],
            ['employee_documents', 'employee_documents'], ['employee-documents', 'employee_documents'],
            ['documents', 'documents'], ['rh/absences', 'absences'], ['absences', 'absences'], ['rh/notes-de-frais', 'expenses'], ['expenses', 'expenses'],
            ['mileage', 'mileage'], ['support', 'support'], ['messages', 'messages'], ['taches', 'tasks'], ['tasks', 'tasks'], ['notes', 'notes'], ['notifications', 'notifications'], ['reports', 'reports'], ['payslips', 'payslips'], ['bulletins', 'payslips'], ['user_settings', 'user_settings'], ['user-settings', 'user_settings'], ['accueil', 'home'],
        ];
        const match = mapping.find(([segment]) => pathname.includes(segment));
        let listen = false;
        try { listen = new URL(value, root.dataset.siteUrl).searchParams.get('listen') === '1'; } catch (_) { /* Le lien brut reste exploitable. */ }
        await navigate(match?.[1] || profileLandingRoute(), { ...routeParams, ...(match?.[1] === 'assistant' && listen ? { listen: true } : {}) });
    });
    root.querySelector('[data-emulator-clear-diagnostics]').addEventListener('click', () => { state.diagnostics = []; renderDiagnostics(); });
    requestLog.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-copy-request-id]');
        if (!button) return;
        await navigator.clipboard.writeText(button.dataset.copyRequestId);
        button.textContent = 'Copié';
    });

    const writeDialog = root.querySelector('[data-emulator-write-dialog]');
    const writeCheckbox = root.querySelector('[data-emulator-write-confirm]');
    const writeConfirm = root.querySelector('[data-emulator-write-confirm-button]');
    root.querySelector('[data-emulator-enable-writes]').addEventListener('click', () => { writeCheckbox.checked = false; writeConfirm.disabled = true; writeDialog.showModal(); });
    root.querySelector('[data-emulator-write-dialog-close]').addEventListener('click', () => writeDialog.close());
    writeCheckbox.addEventListener('change', () => { writeConfirm.disabled = !writeCheckbox.checked; });
    writeConfirm.addEventListener('click', async () => {
        writeConfirm.disabled = true;
        try { await setWritesEnabled(true); writeDialog.close(); } catch (error) { writeConfirm.disabled = false; renderError(error, state.route); }
    });
    root.querySelector('[data-emulator-disable-writes]').addEventListener('click', async () => {
        try { await setWritesEnabled(false); } catch (error) { renderError(error, state.route); }
    });

    window.setInterval(() => {
        if (!state.owner && !state.readOnly && state.writesUntil && new Date(state.writesUntil).getTime() <= Date.now()) {
            state.readOnly = true;
            state.writesUntil = null;
            syncSafetyBar();
            navigate(state.route, state.routeParams, false);
        }
    }, 10000);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pauseUploadFeedbackDismissals();
            markTransientSessionBackgrounded();
            beginApplicationBackground();
            return;
        }
        void resumeApplicationFromBackground().then(() => {
            if (!state.authenticated) return;
            resumeUploadFeedbackDismissals();
            if (state.route === 'messages') refreshMessageConversation();
        });
    });
    window.addEventListener('focus', () => {
        void resumeApplicationFromBackground().then(() => {
            if (!state.authenticated) return;
            resumeUploadFeedbackDismissals();
            if (state.route === 'messages') refreshMessageConversation();
        });
    });
    if (iosRuntime) {
        window.addEventListener('offline', () => {
            state.offline = true;
            networkStatus.textContent = 'Hors ligne';
            networkStatus.className = 'badge text-bg-warning';
            syncConnectivityStatus();
            if (state.authenticated && state.bootstrap) {
                void navigate(state.route, state.routeParams, false);
            }
        });
        window.addEventListener('online', () => {
            if (!state.offline) return;
            state.offline = false;
            networkStatus.textContent = 'En ligne';
            networkStatus.className = 'badge text-bg-secondary';
            syncConnectivityStatus();
            void start();
        });
    }
    const repositionCameraTextPalette = () => {
        if (state.externalApplication?.kind !== 'camera' || !state.externalApplication.cameraReview) return;
        window.requestAnimationFrame(updateCameraEditorVisualTransform);
    };
    window.addEventListener('resize', () => {
        repositionCameraTextPalette();
        window.requestAnimationFrame(syncDossierLogoAlignment);
    });
    window.visualViewport?.addEventListener('resize', repositionCameraTextPalette);
    window.visualViewport?.addEventListener('scroll', repositionCameraTextPalette);

    const mobileDateStateObserver = new MutationObserver((mutations) => {
        mutations.forEach(({ target }) => {
            if (!(target instanceof HTMLInputElement) || target.dataset.mobileDateEnhanced !== '1') return;
            const wrapper = target.closest('.mobile-app-date-entry');
            const display = wrapper?.querySelector('[data-mobile-date-display]');
            const picker = wrapper?.querySelector('[data-mobile-date-picker]');
            const button = wrapper?.querySelector('.mobile-app-date-entry__calendar');
            if (display instanceof HTMLInputElement) display.disabled = target.disabled;
            if (picker instanceof HTMLInputElement) picker.disabled = target.disabled;
            if (button instanceof HTMLButtonElement) button.disabled = target.disabled;
        });
    });
    mobileDateStateObserver.observe(app, { attributes: true, attributeFilter: ['disabled'], subtree: true });

    const siteThemeObserver = new MutationObserver(() => {
        if (state.themePreference === 'system') syncEmulatorTheme();
    });
    siteThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('maisonpilote:speech-result', (event) => {
        void acceptAssistantTranscript(event.detail?.transcript ?? event.detail);
    });
    window.addEventListener('maisonpilote:speech-error', (event) => {
        if (!state.assistantListening) return;
        state.assistantListening = false;
        state.assistantRecognition = null;
        state.assistantError = String(event.detail?.message || event.detail || "La dictée n'a pas pu aboutir.").slice(0, 255);
        renderUploadFeedbacks();
    });
    window.addEventListener('maisonpilote:biometric-result', (event) => {
        if (!nativeBiometricRequest) return;
        if (event.detail?.success === true) nativeBiometricRequest.resolve();
        else nativeBiometricRequest.reject(event.detail?.error || 'Vérification biométrique refusée.');
    });
    window.addEventListener('maisonpilote:native-assistant-request', (event) => {
        const prompt = String(event.detail?.prompt || '').trim().slice(0, 8000);
        if (!iosRuntime || prompt === '') return;
        const id = String(event.detail?.id || '').trim();
        const source = ['siri_app_intent', 'watchos_voice_assistant'].includes(String(event.detail?.source || ''))
            ? String(event.detail.source)
            : 'siri_app_intent';
        state.pendingNativeAssistantRequest = { id, prompt, source };
        if (!state.authenticated || !state.bootstrap) return;
        if (!isAdminUser()) {
            window.MaisonPiloteNative?.assistantRequest?.acknowledge?.(id);
            state.pendingNativeAssistantRequest = null;
            return;
        }
        state.pendingNativeAssistantRequest = null;
        state.assistantPrompt = prompt;
        void submitAssistantPrompt(source, id);
    });
    window.addEventListener('maisonpilote:native-share-chunk', (event) => {
        if (!iosRuntime) return;
        acceptNativeShareChunk(event.detail);
    });
    window.addEventListener('maisonpilote:native-share-discard-result', (event) => {
        if (!iosRuntime) return;
        acceptNativeShareDiscardResult(event.detail);
    });
    window.addEventListener('maisonpilote:native-share-inbox', (event) => {
        if (!iosRuntime) return;
        nativeShareInboxBatches = normalizeNativeShareInbox(event.detail?.batches);
        if (nativeShareInboxBatches.length) {
            updatePromptSuppressedForSharedFiles = true;
            app.querySelector('[data-mobile-update-banner="version"]')?.remove();
        }
        void processNativeShareInbox();
    });
    window.addEventListener('maisonpilote:outgoing-document-result', (event) => {
        if (!iosNativeRuntime) return;
        acceptNativeOutgoingDocumentResult(event.detail);
    });
    window.addEventListener('maisonpilote:outgoing-document-presentation', (event) => {
        if (!iosNativeRuntime || !event.detail?.error?.message) return;
        showQuickCreationNotice(localizedMobileErrorMessage(String(event.detail.error.message)).slice(0, 255));
    });
    window.addEventListener('maisonpilote:deep-link', (event) => {
        const field = root.querySelector('[data-emulator-deep-link]');
        if (field) field.value = String(event.detail?.url || event.detail || '');
        root.querySelector('[data-emulator-open-link]')?.click();
    });
    window.addEventListener('maisonpilote:firebase-token', registerNativePushToken);
    window.addEventListener('maisonpilote:apns-token', registerNativePushToken);
    window.addEventListener('maisonpilote:push-notification', () => {
        if (!iosRuntime || !state.authenticated || state.route !== 'notifications') return;
        void renderNotifications().catch(() => {});
    });
    if (embeddedEmulatorFrame) {
        window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin || event.source !== window.parent) return;
            if (!event.data || typeof event.data !== 'object') return;
            if (event.data.platform && event.data.platform !== runtimePlatform) return;

            if (event.data.type === 'mobile-emulator:host-ready') {
                if (embeddedRuntimeReady) {
                    postToEmulatorHost('mobile-emulator:ready', {
                        authenticated: state.authenticated,
                        owner: state.owner,
                    });
                }
                return;
            }

            if (event.data.type === 'mobile-emulator:settings') {
                void applyHostedSettings(event.data.settings);
                return;
            }
            if (event.data.type === 'mobile-emulator:writes') {
                void applyHostedWriteState(event.data);
                return;
            }
            if (event.data.type === 'mobile-emulator:open-link') {
                const field = root.querySelector('[data-emulator-deep-link]');
                if (field) field.value = String(event.data.url || '');
                root.querySelector('[data-emulator-open-link]')?.click();
                return;
            }
            if (event.data.type === 'mobile-emulator:restart') {
                root.querySelector('[data-emulator-restart]')?.click();
            }
        });
    }
    restoreControls();
    syncSafetyBar();
    if (!document.hidden) resumeTransientSession();
    if (iosRuntime) {
        window.dispatchEvent(new CustomEvent('maisonpilote:native-runtime-ready', {
            detail: { platform: 'ios', runtimeVersion: 1 },
        }));
        if (state.authenticated) refreshNativePushRegistration();
    }
    void start().finally(() => {
        embeddedRuntimeReady = true;
        postToEmulatorHost('mobile-emulator:ready', {
            authenticated: state.authenticated,
            owner: state.owner,
        });
    });
}
