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
    private var pendingDeepLinks: [URL] = []

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
                pendingSharedFiles: !ShareInbox().publicBatches().isEmpty
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
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.keyboardDismissMode = .interactive
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        NotificationCenter.default.publisher(for: .maisonPilotePushStateChanged)
            .sink { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard self?.pageReady == true else { return }
                    self?.deliverPendingNativePayloads()
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
            pendingDeepLinks.removeAll(where: AppEnvironment.isSignatureURL)
            errorMessage = nil
            pageReady = false
            started = true
            load(signatureURL)
            return
        }
        if !AppEnvironment.isShellURL(url), !pendingDeepLinks.contains(url) {
            pendingDeepLinks.append(url)
            if pendingDeepLinks.count > 20 {
                pendingDeepLinks.removeFirst(pendingDeepLinks.count - 20)
            }
        }
        errorMessage = nil
        if !started {
            started = true
            load(AppEnvironment.initialURL)
        } else if pageReady {
            deliverPendingDeepLinks()
        }
    }

    func applicationDidBecomeActive() {
        pushCoordinator.registerIfAuthorized()
        guard pageReady else { return }
        deliverPendingNativePayloads()
    }

    fileprivate func receiveScriptMessage(_ message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.request.url.map(AppEnvironment.isTrusted) == true,
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        if message.name == "speechRecognition" {
            switch action {
            case "start":
                speechBridge.start(language: body["language"] as? String ?? "fr-FR")
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
                refreshSecureSessionInjection(secureSessionStore.load())
                if pageReady { deliverShareInbox() }
            case "bindDevice":
                guard let deviceID = body["deviceId"] as? String,
                      secureSessionStore.bindDeviceID(deviceID) else { return }
            case "clear":
                secureSessionStore.clear()
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
        case "ready":
            pageReady = true
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
        case "openExternal":
            guard let rawURL = body["url"] as? String,
                  let url = URL(string: rawURL),
                  AppEnvironment.canOpenExternally(url),
                  !AppEnvironment.isTrusted(url) else { return }
            UIApplication.shared.open(url)
        default:
            break
        }
    }

    private func load(_ url: URL) {
        guard AppEnvironment.isTrusted(url) else { return }
        var request = URLRequest(url: url)
        request.cachePolicy = .useProtocolCachePolicy
        request.timeoutInterval = 60
        webView.load(request)
    }

    private func deliverPendingNativePayloads() {
        deliverApnsToken()
        deliverPendingPush()
        deliverPendingAssistantRequest()
        deliverShareInbox()
        deliverPendingDeepLinks()
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

    private func deliverPendingPush() {
        guard let push = pushCoordinator.pendingPush else { return }
        var detail: [String: Any] = push.detail
        detail["opened_by_user"] = push.openedByUser
        let eventName = push.openedByUser && push.detail["deep_link"] != nil
            ? "maisonpilote:deep-link"
            : "maisonpilote:push-notification"
        if let deepLink = push.detail["deep_link"] {
            detail["url"] = deepLink
        }
        dispatchEvent(name: eventName, detail: detail) { [weak self] delivered in
            guard delivered else { return }
            Task { @MainActor [weak self] in
                self?.pushCoordinator.acknowledge(pushID: push.id)
            }
        }
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
            : shareInbox.publicBatches()
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

    private func deliverPendingDeepLinks() {
        guard pageReady, let url = pendingDeepLinks.first else { return }
        dispatchEvent(
            name: "maisonpilote:deep-link",
            detail: ["url": url.absoluteString]
        ) { [weak self] success in
            guard success, let self else { return }
            if self.pendingDeepLinks.first == url {
                self.pendingDeepLinks.removeFirst()
            }
            self.deliverPendingDeepLinks()
        }
    }

    private func dispatchEvent(
        name: String,
        detail: Any,
        completion: ((Bool) -> Void)? = nil
    ) {
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
        let contentController = webView.configuration.userContentController
        contentController.removeAllUserScripts()
        contentController.addUserScript(WKUserScript(
            source: NativeBridgeScript.documentStart(
                secureSession: session,
                pendingSharedFiles: !shareInbox.publicBatches().isEmpty
            ),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        contentController.addUserScript(WKUserScript(
            source: NativeBridgeScript.documentEnd,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        ))
        webView.evaluateJavaScript(NativeBridgeScript.secureSessionAssignment(session))
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
                return .allow
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
        isLoading = true
        pageReady = false
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isLoading = false
        errorMessage = nil
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
        if AppEnvironment.isShellURL(url) {
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
            && origin.host.lowercased() == AppEnvironment.trustedHost
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
            detail: ["transcript": transcript]
        )
    }

    func speechRecognitionBridge(
        _ bridge: SpeechRecognitionBridge,
        didFail code: String,
        message: String
    ) {
        dispatchEvent(
            name: "maisonpilote:speech-error",
            detail: ["code": code, "message": message]
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
