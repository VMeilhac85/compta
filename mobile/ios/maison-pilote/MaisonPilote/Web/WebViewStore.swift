import Combine
import Foundation
import UIKit
import WebKit

@MainActor
final class WebViewStore: NSObject, ObservableObject {
    @Published private(set) var isLoading = true
    @Published private(set) var errorMessage: String?

    let webView: WKWebView

    private let router: ScriptMessageRouter
    private let speechBridge = SpeechRecognitionBridge()
    private let biometricBridge = BiometricAuthenticationBridge()
    private let secureSessionStore = SecureSessionStore.shared
    private let pushCoordinator = MobilePushCoordinator.shared
    private let shareInbox = ShareInbox()
    private let outgoingDocumentBridge = OutgoingDocumentBridge()
    private var cancellables = Set<AnyCancellable>()
    private var started = false
    private var pageReady = false
    private var contentVisible = false
    private var nativePresentationVisible = false

    private var effectiveContentVisible: Bool {
        contentVisible && !nativePresentationVisible
    }
    private let navigationInbox = NativeNavigationInbox.shared
    private let secureDraftStore = SecureDraftStore()
    private let nativeCaptureStore = NativeCaptureStore()
    private var deliveredNavigationIDs = Set<UUID>()

    private static var homeTextScale: Double {
        Double(UIFont.preferredFont(forTextStyle: .body).pointSize / 17)
    }

    override init() {
        let contentController = WKUserContentController()
        let router = ScriptMessageRouter()
        contentController.add(router, name: "speechRecognition")
        contentController.add(router, name: "secureSession")
        contentController.add(router, name: "biometricAuthentication")
        contentController.add(router, name: "outgoingDocument")
        contentController.add(router, name: "maisonPiloteNative")
        contentController.addUserScript(WKUserScript(
            source: NativeBridgeScript.documentStart(
                secureSession: SecureSessionStore.shared.load(),
                pendingSharedFiles: !ShareInbox().publicBatches().isEmpty,
                homeTextScale: Self.homeTextScale
            ),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        contentController.addUserScript(WKUserScript(
            source: NativeBridgeScript.documentEnd,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        ))

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = contentController
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.limitsNavigationsToAppBoundDomains = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.applicationNameForUserAgent = "MaisonPilote-iOS/1"

        self.router = router
        self.webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()

        router.owner = self
        speechBridge.delegate = self
        biometricBridge.delegate = self
        outgoingDocumentBridge.delegate = self
        webView.navigationDelegate = self
        webView.uiDelegate = self
        // The shared runtime owns the route stack and its visible Back control.
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.keyboardDismissMode = .interactive
        // SwiftUI already constrains the web view to the usable safe area.
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        NotificationCenter.default.publisher(for: .maisonPilotePushStateChanged)
            .sink { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard self?.pageReady == true else { return }
                    self?.deliverPendingNativePayloads()
                }
            }
            .store(in: &cancellables)
        NotificationCenter.default.publisher(for: UIContentSizeCategory.didChangeNotification)
            .sink { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard let self else { return }
                    // Actualise aussi les scripts réinjectés après un rechargement.
                    self.refreshSecureSessionInjection(self.secureSessionStore.load())
                }
            }
            .store(in: &cancellables)
#if DEBUG
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }
#endif
    }

    func startIfNeeded() {
        guard !started else { return }
        started = true
        load(AppEnvironment.initialURL)
    }

    func reload() {
        errorMessage = nil
        pageReady = false
        if webView.url == nil {
            load(AppEnvironment.initialURL)
        } else {
            webView.reload()
        }
    }

    func dismissError() {
        errorMessage = nil
    }

    func openDeepLink(_ candidate: URL) {
        guard let url = AppEnvironment.normalizedDeepLink(candidate) else { return }
        if let signatureURL = AppEnvironment.signatureExperienceURL(url) {
            errorMessage = nil
            pageReady = false
            started = true
            load(signatureURL)
            return
        }
        if !AppEnvironment.isShellURL(url) {
            navigationInbox.enqueue(url: url)
        }
        errorMessage = nil
        if !started {
            started = true
            load(AppEnvironment.initialURL)
        } else if pageReady {
            deliverPendingNavigation()
        }
    }

    func updateContentVisibility(_ visible: Bool) {
        guard contentVisible != visible else { return }
        contentVisible = visible
        // Keep future documents consistent with the current native privacy shield.
        replaceDocumentScripts(secureSessionStore.load())
        applyContentVisibility()
    }

    func applicationDidBecomeActive() {
        applyContentVisibility()
        applyHomeTextScale()
        pushCoordinator.registerIfAuthorized()
        deliveredNavigationIDs.removeAll()
        guard pageReady else { return }
        deliverPendingNativePayloads()
    }

    fileprivate func receiveScriptMessage(_ message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.request.url.map(AppEnvironment.isTrusted) == true,
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        let isShell = message.frameInfo.request.url.map(AppEnvironment.isShellURL) == true
        guard isShell || message.name == "outgoingDocument"
                || (message.name == "maisonPiloteNative" && ["openExternal", "openSettings"].contains(action)) else { return }

        if message.name == "speechRecognition" {
            switch action {
            case "start":
                speechBridge.start(language: body["language"] as? String ?? "fr-FR",
                                   requestID: correlationID(body["request_id"]) ?? "")
            case "cancel":
                speechBridge.cancel()
            default:
                dispatchEvent(
                    name: "maisonpilote:speech-error",
                    detail: ["code": "invalid-action", "message": "Action vocale inconnue."]
                )
            }
            return
        }

        if message.name == "secureSession" {
            switch action {
            case "store":
                guard let token = body["token"] as? String,
                      secureSessionStore.store(
                        token: token,
                        expiresAt: body["expiresAt"] as? String,
                        deviceID: body["deviceId"] as? String
                      ) else { return }
                navigationInbox.suspendIdentity()
                deliveredNavigationIDs.removeAll()
                refreshSecureSessionInjection(secureSessionStore.load())
                if pageReady { deliverShareInbox() }
            case "bindDevice":
                guard let deviceID = body["deviceId"] as? String,
                      secureSessionStore.bindDeviceID(deviceID) else { return }
            case "clear":
                secureSessionStore.clear()
                if body["preserve_navigation"] as? Bool == true {
                    navigationInbox.suspendIdentity()
                } else {
                    navigationInbox.clear()
                }
                deliveredNavigationIDs.removeAll()
                refreshSecureSessionInjection(nil)
                if pageReady { deliverShareInbox() }
            default:
                break
            }
            return
        }

        if message.name == "biometricAuthentication" {
            if action == "authenticate" {
                biometricBridge.authenticate()
            } else {
                dispatchBiometricResult(success: false, errorCode: "invalid-action")
            }
            return
        }

        if message.name == "outgoingDocument" {
            outgoingDocumentBridge.handle(
                action: action,
                body: body,
                presentingFrom: webView
            )
            return
        }

        switch action {
        case "capture.begin", "capture.append", "capture.finish", "capture.cancel":
            handleCapture(action: action, body: body)
        case "shareInbox.bindContext":
            handleShareContext(body)
        case "secureDrafts.refresh", "secureDrafts.write", "secureDrafts.remove":
            handleSecureDrafts(action: action, body: body)
        case "navigation.bindIdentity":
            let previousIdentity = navigationInbox.confirmedIdentity
            guard secureSessionStore.load() != nil,
                  let userID = body["user_id"] as? String,
                  navigationInbox.bindIdentity(userID) else { return }
            handleSecureDrafts(action: "secureDrafts.refresh", body: [:])
            if previousIdentity != navigationInbox.confirmedIdentity {
                deliveredNavigationIDs.removeAll()
            }
            deliverPendingNavigation()
            deliverShareInbox()
        case "navigation.ack":
            guard secureSessionStore.load() != nil,
                  body["outcome"] as? String == "completed",
                  let rawID = correlationID(body["request_id"]),
                  let id = UUID(uuidString: rawID),
                  deliveredNavigationIDs.contains(id),
                  navigationInbox.acknowledge(id: id) else { return }
            deliveredNavigationIDs.remove(id)
            deliverPendingNavigation()
        case "navigation.retry":
            deliveredNavigationIDs.removeAll()
            deliverPendingNavigation()
        case "ready":
            deliveredNavigationIDs.removeAll()
            pageReady = true
            applyContentVisibility()
            applyHomeTextScale()
            handleSecureDrafts(action: "secureDrafts.refresh", body: [:])
            deliverPendingNativePayloads()
        case "pushNotifications.requestAuthorization":
            pushCoordinator.requestAuthorization()
        case "pushNotifications.refresh":
            pushCoordinator.registerIfAuthorized()
            deliverApnsToken()
        case "shareInbox.refresh":
            deliverShareInbox()
        case "shareInbox.discard":
            guard let id = body["id"] as? String else { return }
            let discarded = secureSessionStore.load() != nil
                && navigationInbox.confirmedIdentity.map({ shareInbox.canAccess(batchID: id, ownerID: $0, requireContext: false) }) == true
                && shareInbox.discard(batchID: id)
            if let requestID = correlationID(body["request_id"]) {
                var detail: [String: Any] = [
                    "request_id": requestID,
                    "batch_id": id,
                    "success": discarded,
                ]
                if !discarded {
                    detail["error"] = [
                        "code": "discard_failed",
                        "message": "Le partage transmis n’a pas pu être retiré de l’iPhone.",
                    ]
                }
                dispatchEvent(
                    name: "maisonpilote:native-share-discard-result",
                    detail: detail
                )
            }
            deliverShareInbox()
        case "shareInbox.readChunk":
            handleShareInboxChunkRequest(body)
        case "assistantRequest.ack":
            guard let id = body["id"] as? String,
                  SharedContainer.pendingAssistantRequest()?.id == id else { return }
            SharedContainer.clearPendingAssistantRequest()
        case "notification.context":
            pushCoordinator.displayedContextKey = body["key"] as? String
            pushCoordinator.displayedContextKeys = Set(body["keys"] as? [String] ?? [])
            pushCoordinator.contentVisible = effectiveContentVisible
        case "openExternal":
            openExternal(body: body)
        case "openSettings":
            let kind = (body["kind"] as? String) ?? "application"
            let rawURL = kind == "notifications" ? UIApplication.openNotificationSettingsURLString : UIApplication.openSettingsURLString
            guard let url = URL(string: rawURL) else { return }
            openSystemURL(url, requestID: correlationID(body["request_id"]) ?? "")
        default:
            break
        }
    }

    private func openExternal(body: [String: Any]) {
        let requestID = correlationID(body["request_id"]) ?? ""
        guard let raw = body["url"] as? String, !raw.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains),
              let url = URL(string: raw), AppEnvironment.canOpenExternally(url), !AppEnvironment.isShellURL(url) else {
            dispatchEvent(name: "maisonpilote:native-open-result", detail: [
                "request_id": requestID, "success": false,
                "error": ["code": "unsupported_url", "message": "Ce lien ne peut pas être ouvert sur cet iPhone."],
            ])
            return
        }
        openSystemURL(url, requestID: requestID)
    }

    private func openSystemURL(_ url: URL, requestID: String) {
        UIApplication.shared.open(url, options: [:]) { [weak self] success in
            Task { @MainActor in
                var detail: [String: Any] = ["request_id": requestID, "success": success]
                if !success { detail["error"] = ["code": "application_unavailable",
                    "message": "Aucune application disponible ne peut ouvrir ce lien sur cet iPhone."] }
                self?.dispatchEvent(name: "maisonpilote:native-open-result", detail: detail)
            }
        }
    }

    private func handleShareContext(_ body: [String: Any]) {
        let requestID = correlationID(body["request_id"]) ?? ""
        do {
            guard secureSessionStore.load() != nil, let ownerID = navigationInbox.confirmedIdentity,
                  let id = body["batch_id"] as? String, let scope = body["identity_scope"] as? String,
                  let dossierID = exactInteger(body["dossier_id"]) else { throw NativeCaptureStore.Failure.invalid }
            let type = (body["context_type"] as? String) ?? "shared_file"
            guard ["shared_file", "shared_file_folder"].contains(type) else { throw NativeCaptureStore.Failure.invalid }
            let folderID = exactInteger(body["folder_id"]).flatMap { $0 > 0 ? $0 : nil }
            let context = try NativeCaptureStore.context(scope: scope, dossierID: dossierID, ownerID: ownerID,
                                                       type: type, folderID: folderID)
            let batch = try shareInbox.bindContext(batchID: id, context: context)
            dispatchEvent(name: "maisonpilote:native-share-bind-result", detail: [
                "request_id": requestID, "success": true, "batch_id": id,
                "batch": try JSONSerialization.jsonObject(with: JSONEncoder().encode(batch)),
            ])
            deliverShareInbox()
        } catch {
            dispatchEvent(name: "maisonpilote:native-share-bind-result", detail: [
                "request_id": requestID, "success": false,
                "error": ["code": "context_not_bound", "message": "Le compte ou l’entreprise de destination n’a pas pu être confirmé. Le partage reste sur cet iPhone."],
            ])
        }
    }

    private func handleCapture(action: String, body: [String: Any]) {
        let requestID = correlationID(body["requestId"]) ?? ""
        do {
            guard secureSessionStore.load() != nil, let ownerID = navigationInbox.confirmedIdentity else {
                throw NativeCaptureStore.Failure.contextChanged
            }
            var result = try nativeCaptureStore.handle(action: action, body: body, ownerID: ownerID)
            result["request_id"] = requestID
            result["success"] = true
            dispatchEvent(name: "maisonpilote:native-capture-result", detail: result)
            if action == "capture.finish", (result["batch"] as? [String: Any])?["purpose"] as? String != "image_conversion" {
                deliverShareInbox()
            }
        } catch {
            let message = (error as? NativeCaptureStore.Failure)?.message
                ?? (error as? SharedInboxStorage.Failure)?.message
                ?? "La capture n’a pas pu être conservée sur cet iPhone. Vos pages restent disponibles à l’écran."
            var detail: [String: Any] = ["request_id": requestID, "success": false,
                "error": ["code": "capture_failed", "message": message]]
            if let captureError = error as? NativeCaptureStore.Failure, case .offset(let expected) = captureError {
                detail["expected_offset"] = expected
            }
            dispatchEvent(name: "maisonpilote:native-capture-result", detail: detail)
        }
    }

    private func load(_ url: URL) {
        guard AppEnvironment.isTrusted(url) else { return }
        // Signature documents are real web pages outside the runtime route stack.
        webView.allowsBackForwardNavigationGestures = AppEnvironment.isSignatureURL(url)
        var request = URLRequest(url: url)
        request.cachePolicy = .useProtocolCachePolicy
        request.timeoutInterval = 60
        webView.load(request)
    }

    private func deliverPendingNativePayloads() {
        dispatchEvent(name: "maisonpilote:push-state", detail: pushCoordinator.publicState)
        deliverApnsToken()
        deliverPendingAssistantRequest()
        deliverShareInbox()
        deliverPendingNavigation()
    }

    private func deliverApnsToken() {
        guard let token = pushCoordinator.currentToken else { return }
        dispatchEvent(
            name: "maisonpilote:apns-token",
            detail: [
                "token": token,
                "provider": "apns",
                "environment": pushCoordinator.environment,
            ]
        )
    }

    private func deliverPendingAssistantRequest() {
        guard let request = SharedContainer.pendingAssistantRequest() else { return }
        dispatchEvent(
            name: "maisonpilote:native-assistant-request",
            detail: [
                "prompt": request.prompt,
                "id": request.id,
                "source": "siri_app_intent",
                "requested_at_utc": request.requestedAtUTC,
            ]
        )
    }

    private func deliverShareInbox() {
        let batches: [ShareInboxPublicBatch] = secureSessionStore.load() == nil
            ? []
            : shareInbox.publicBatches(ownerID: navigationInbox.confirmedIdentity)
        guard let payload = try? JSONEncoder().encode(batches),
              let object = try? JSONSerialization.jsonObject(with: payload) else { return }
        dispatchEvent(
            name: "maisonpilote:native-share-inbox",
            detail: ["batches": object]
        )
    }

    private func handleShareInboxChunkRequest(_ body: [String: Any]) {
        guard let requestID = correlationID(body["request_id"]) else { return }
        guard secureSessionStore.load() != nil else {
            dispatchShareInboxError(requestID: requestID, error: .authenticationRequired)
            return
        }
        do {
            guard let batchID = body["batch_id"] as? String,
                  let ownerID = navigationInbox.confirmedIdentity,
                  shareInbox.canAccess(batchID: batchID, ownerID: ownerID),
                  let fileID = body["file_id"] as? String,
                  let offset = exactInteger(body["offset"]),
                  let requestedLength = exactInteger(body["length"]),
                  requestedLength <= Int64(Int.max) else {
                throw ShareInboxReadError.invalidRequest
            }
            let chunk = try shareInbox.readChunk(
                batchID: batchID,
                fileID: fileID,
                offset: offset,
                maximumLength: Int(requestedLength)
            )
            dispatchEvent(
                name: "maisonpilote:native-share-chunk",
                detail: [
                    "request_id": requestID,
                    "batch_id": chunk.batchID,
                    "file_id": chunk.fileID,
                    "offset": chunk.offset,
                    "next_offset": chunk.nextOffset,
                    "total_size": chunk.totalSize,
                    "eof": chunk.isEOF,
                    "data_base64": chunk.data.base64EncodedString(),
                ]
            )
        } catch let error as ShareInboxReadError {
            dispatchShareInboxError(requestID: requestID, error: error)
        } catch {
            dispatchShareInboxError(requestID: requestID, error: .readFailed)
        }
    }

    private func dispatchShareInboxError(
        requestID: String,
        error: ShareInboxReadError
    ) {
        dispatchEvent(
            name: "maisonpilote:native-share-chunk",
            detail: [
                "request_id": requestID,
                "error": [
                    "code": error.code,
                    "message": error.message,
                ],
            ]
        )
    }

    private func correlationID(_ value: Any?) -> String? {
        guard let value = value as? String,
              value.count == 36,
              UUID(uuidString: value) != nil else { return nil }
        return value.lowercased()
    }

    private func exactInteger(_ value: Any?) -> Int64? {
        guard let number = value as? NSNumber,
              String(cString: number.objCType) != "c" else { return nil }
        let candidate = number.doubleValue
        guard candidate.isFinite,
              candidate.rounded(.towardZero) == candidate,
              candidate >= Double(Int64.min),
              candidate <= Double(Int64.max) else { return nil }
        return number.int64Value
    }

    private func handleSecureDrafts(action: String, body: [String: Any]) {
        let requestID = correlationID(body["request_id"]) ?? ""
        guard pageReady, secureSessionStore.load() != nil,
              let identity = navigationInbox.confirmedIdentity else {
            dispatchEvent(name: "maisonpilote:secure-drafts-error", detail: [
                "request_id": requestID, "action": action, "success": false,
                "key": body["key"] as? String ?? "", "message": "Reconnectez-vous avant de conserver ce brouillon.",
            ])
            return
        }
        do {
            let drafts: [String: String]
            if action == "secureDrafts.refresh" {
                drafts = try secureDraftStore.read(identity: identity)
            } else {
                guard let key = body["key"] as? String else {
                    throw SecureDraftStore.StorageError.invalid
                }
                let value: String?
                if action == "secureDrafts.remove" {
                    value = nil
                } else {
                    guard let text = body["value"] as? String else {
                        throw SecureDraftStore.StorageError.invalid
                    }
                    value = text
                }
                drafts = try secureDraftStore.write(identity: identity, key: key, value: value)
            }
            dispatchEvent(name: "maisonpilote:secure-drafts", detail: [
                "identity": identity, "drafts": drafts, "request_id": requestID,
                "action": action, "key": body["key"] as? String ?? "", "success": true,
            ])
        } catch {
            let failure = error as? SecureDraftStore.StorageError ?? .unavailable
            dispatchEvent(name: "maisonpilote:secure-drafts-error", detail: [
                "identity": identity, "key": body["key"] as? String ?? "",
                "message": failure.message, "request_id": requestID, "action": action, "success": false,
            ])
        }
    }

    private func deliverPendingNavigation() {
        guard pageReady, secureSessionStore.load() != nil else { return }
        // The runtime serializes these events. An unacknowledged/revoked first
        // destination must not prevent a later, valid opening from reaching it.
        while let pending = navigationInbox.next(excluding: deliveredNavigationIDs) {
            deliveredNavigationIDs.insert(pending.id)
            var detail: [String: Any] = pending.detail
            detail["request_id"] = pending.id.uuidString.lowercased()
            detail["opened_by_user"] = pending.openedByUser
            if let deepLink = pending.detail["deep_link"] { detail["url"] = deepLink }
            dispatchEvent(name: pending.eventName, detail: detail) { [weak self] delivered in
                guard !delivered else { return }
                // Only navigation.ack removes the persistent item. Transport
                // failure makes this UUID eligible for the next explicit retry.
                self?.deliveredNavigationIDs.remove(pending.id)
            }
        }
    }

    private func dispatchEvent(
        name: String,
        detail: Any,
        completion: ((Bool) -> Void)? = nil
    ) {
        let publicEvents = ["maisonpilote:native-open-result", "maisonpilote:outgoing-document-result", "maisonpilote:outgoing-document-presentation"]
        guard webView.url.map(AppEnvironment.isShellURL) == true || publicEvents.contains(name) else {
            completion?(false)
            return
        }
        guard JSONSerialization.isValidJSONObject(detail),
              let detailData = try? JSONSerialization.data(withJSONObject: detail),
              let detailJSON = String(data: detailData, encoding: .utf8),
              let nameData = try? JSONEncoder().encode(name),
              let nameJSON = String(data: nameData, encoding: .utf8) else {
            completion?(false)
            return
        }
        let script = "window.dispatchEvent(new CustomEvent(\(nameJSON), { detail: \(detailJSON) }));"
        webView.evaluateJavaScript(script) { _, error in
            completion?(error == nil)
        }
    }

    private func refreshSecureSessionInjection(_ session: SecureWebSession?) {
        replaceDocumentScripts(session)
        webView.evaluateJavaScript(NativeBridgeScript.secureSessionAssignment(session))
        applyHomeTextScale()
        applyContentVisibility()
    }

    private func replaceDocumentScripts(_ session: SecureWebSession?) {
        let contentController = webView.configuration.userContentController
        contentController.removeAllUserScripts()
        contentController.addUserScript(WKUserScript(
            source: NativeBridgeScript.documentStart(
                secureSession: session,
                pendingSharedFiles: !shareInbox.publicBatches().isEmpty,
                homeTextScale: Self.homeTextScale,
                contentVisible: effectiveContentVisible
            ),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        contentController.addUserScript(WKUserScript(
            source: NativeBridgeScript.documentEnd,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        ))
    }

    private func applyContentVisibility() {
        guard webView.url.map(AppEnvironment.isTrusted) == true else { return }
        webView.evaluateJavaScript(NativeBridgeScript.contentVisibilityAssignment(effectiveContentVisible))
    }

    private func applyHomeTextScale() {
        guard webView.url.map(AppEnvironment.isTrusted) == true else { return }
        webView.evaluateJavaScript(NativeBridgeScript.homeTextScaleAssignment(Self.homeTextScale))
    }

    private func dispatchBiometricResult(success: Bool, errorCode: String?) {
        var detail: [String: Any] = ["success": success]
        if let errorCode {
            detail["error"] = errorCode
        }
        dispatchEvent(name: "maisonpilote:biometric-result", detail: detail)
    }

    private func handleNavigationAction(
        _ navigationAction: WKNavigationAction
    ) -> WKNavigationActionPolicy {
        guard let url = navigationAction.request.url else { return .cancel }
        if url.absoluteString == "about:blank" {
            return .allow
        }
        if ["blob", "data", "file"].contains(url.scheme?.lowercased() ?? "") {
            return .cancel
        }
        if AppEnvironment.isTrusted(url) {
            if AppEnvironment.isSignatureURL(url) {
                if navigationAction.targetFrame?.isMainFrame == true {
                    webView.allowsBackForwardNavigationGestures = true
                }
                return .allow
            }
            if navigationAction.targetFrame?.isMainFrame == true, AppEnvironment.isShellURL(url) {
                webView.allowsBackForwardNavigationGestures = false
            }
            if navigationAction.targetFrame?.isMainFrame == true,
               !AppEnvironment.isShellURL(url) {
                openDeepLink(url)
                return .cancel
            }
            return .allow
        }
        if AppEnvironment.canOpenExternally(url) {
            UIApplication.shared.open(url)
        }
        return .cancel
    }
}

extension WebViewStore: WKNavigationDelegate {
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        decisionHandler(handleNavigationAction(navigationAction))
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        speechBridge.cancel(notify: true)
        isLoading = true
        pageReady = false
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isLoading = false
        errorMessage = nil
        applyContentVisibility()
        applyHomeTextScale()
        // Premier essai après le document, puis nouvel envoi au signal
        // runtime-ready afin d'éviter une course avec les listeners JavaScript.
        deliverApnsToken()
    }

    func webView(
        _ webView: WKWebView,
        didFail navigation: WKNavigation!,
        withError error: Error
    ) {
        presentNavigationError(error)
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        presentNavigationError(error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        pageReady = false
        isLoading = true
        webView.reload()
    }

    private func presentNavigationError(_ error: Error) {
        isLoading = false
        let nsError = error as NSError
        guard nsError.code != NSURLErrorCancelled else { return }
        errorMessage = "Maison Pilote n’est pas joignable. Vérifiez la connexion puis réessayez."
    }
}

extension WebViewStore: WKUIDelegate {
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        guard navigationAction.targetFrame == nil,
              let url = navigationAction.request.url else { return nil }
        if AppEnvironment.isPublicInformationURL(url) {
            UIApplication.shared.open(url)
        } else if AppEnvironment.isShellURL(url) {
            webView.load(navigationAction.request)
        } else if AppEnvironment.isSignatureURL(url) {
            let request = AppEnvironment.signatureExperienceURL(url).map { URLRequest(url: $0) }
                ?? navigationAction.request
            webView.load(request)
        } else if AppEnvironment.isTrusted(url) {
            openDeepLink(url)
        } else if AppEnvironment.canOpenExternally(url) {
            UIApplication.shared.open(url)
        }
        return nil
    }

    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        let trusted = origin.protocol.lowercased() == "https"
            && AppEnvironment.trustedHosts.contains(origin.host.lowercased())
            && (origin.port == 0 || origin.port == 443)
        guard trusted, frame.isMainFrame else {
            decisionHandler(.deny)
            return
        }
        NativePermissionCoordinator.request(type) { granted in
            decisionHandler(granted ? .grant : .deny)
        }
    }
}

extension WebViewStore: SpeechRecognitionBridgeDelegate {
    func speechRecognitionBridge(
        _ bridge: SpeechRecognitionBridge,
        didFinish transcript: String
    ) {
        dispatchEvent(
            name: "maisonpilote:speech-result",
            detail: ["transcript": transcript, "request_id": bridge.requestID]
        )
    }

    func speechRecognitionBridge(
        _ bridge: SpeechRecognitionBridge,
        didFail code: String,
        message: String
    ) {
        dispatchEvent(
            name: "maisonpilote:speech-error",
            detail: ["code": code, "message": message, "request_id": bridge.requestID]
        )
    }
}

extension WebViewStore: BiometricAuthenticationBridgeDelegate {
    func biometricAuthenticationBridge(
        _ bridge: BiometricAuthenticationBridge,
        didFinishWithSuccess success: Bool,
        errorCode: String?
    ) {
        dispatchBiometricResult(success: success, errorCode: errorCode)
    }
}

extension WebViewStore: OutgoingDocumentBridgeDelegate {
    func outgoingDocumentBridge(
        _ bridge: OutgoingDocumentBridge,
        presentationVisibilityChanged visible: Bool
    ) {
        guard nativePresentationVisible != visible else { return }
        nativePresentationVisible = visible
        pushCoordinator.contentVisible = effectiveContentVisible
        replaceDocumentScripts(secureSessionStore.load())
        applyContentVisibility()
    }

    func outgoingDocumentBridge(
        _ bridge: OutgoingDocumentBridge,
        emit eventName: String,
        detail: [String: Any]
    ) {
        dispatchEvent(name: eventName, detail: detail)
    }
}

private final class ScriptMessageRouter: NSObject, WKScriptMessageHandler {
    weak var owner: WebViewStore?

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        Task { @MainActor [weak self] in
            self?.owner?.receiveScriptMessage(message)
        }
    }
}
