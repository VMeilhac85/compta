import Foundation
import UIKit
import WatchConnectivity

final class WatchCodexRelay: NSObject, WCSessionDelegate {
    static let shared = WatchCodexRelay()

    private let api = WatchCodexAPIClient()
    private let secureSessionStore = SecureSessionStore.shared
    private var session: WCSession?

    private override init() {
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        if session == nil {
            let session = WCSession.default
            session.delegate = self
            self.session = session
        }
        session?.activate()
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        Task {
            let response = await response(for: message)
            replyHandler(response)
        }
    }

    private func response(for message: [String: Any]) async -> [String: Any] {
        guard let requestID = normalizedRequestID(message["request_id"]) else {
            return failure(requestID: "", code: "invalid_request", message: "Demande montre illisible.")
        }
        guard let action = message["action"] as? String,
              WatchCodexAction(rawValue: action) != nil else {
            return failure(requestID: requestID, code: "invalid_action", message: "Action montre inconnue.")
        }
        guard let secureSession = secureSessionStore.load(),
              let deviceID = secureSession.deviceID else {
            return failure(
                requestID: requestID,
                code: "authentication_required",
                message: "Ouvrez Maison Pilote sur l’iPhone et connectez-vous avant d’utiliser la montre."
            )
        }

        do {
            switch WatchCodexAction(rawValue: action)! {
            case .availability:
                let available = try await api.isAdmin(
                    session: secureSession,
                    deviceID: deviceID,
                    requestID: requestID
                )
                return [
                    "request_id": requestID,
                    "ok": true,
                    "available": available,
                ]
            case .submit:
                let prompt = (message["prompt"] as? String)?
                    .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                guard !prompt.isEmpty, prompt.count <= 8_000 else {
                    return failure(
                        requestID: requestID,
                        code: "invalid_prompt",
                        message: "La demande doit contenir entre 1 et 8 000 caractères."
                    )
                }
                let run = try await api.submit(
                    prompt: prompt,
                    session: secureSession,
                    deviceID: deviceID,
                    requestID: requestID
                )
                return success(requestID: requestID, run: run)
            case .status:
                guard let runID = positiveRunID(message["run_id"]) else {
                    return failure(requestID: requestID, code: "invalid_run", message: "Demande Codex invalide.")
                }
                let run = try await api.status(
                    runID: runID,
                    session: secureSession,
                    deviceID: deviceID,
                    requestID: requestID
                )
                return success(requestID: requestID, run: run)
            case .cancel:
                guard let runID = positiveRunID(message["run_id"]) else {
                    return failure(requestID: requestID, code: "invalid_run", message: "Demande Codex invalide.")
                }
                let run = try await api.cancel(
                    runID: runID,
                    session: secureSession,
                    deviceID: deviceID,
                    requestID: requestID
                )
                return success(requestID: requestID, run: run)
            }
        } catch let error as WatchCodexAPIError {
            return failure(requestID: requestID, code: error.code, message: error.message)
        } catch {
            return failure(
                requestID: requestID,
                code: "phone_relay_failed",
                message: "L’iPhone n’a pas pu joindre Maison Pilote. Réessayez depuis l’application."
            )
        }
    }

    private func success(requestID: String, run: WatchCodexRun) -> [String: Any] {
        var response: [String: Any] = [
            "request_id": requestID,
            "ok": true,
            "run_id": run.id,
            "status": run.status,
            "status_message": run.statusMessage,
            "model": run.model,
            "reasoning": run.reasoning,
            "requires_confirmation": run.requiresConfirmation,
            "cancel_requested": run.cancelRequested,
            "cancellable": run.cancellable,
        ]
        if let value = run.response, !value.isEmpty {
            let displayed = String(value.prefix(12_000))
            response["response"] = displayed
            response["response_truncated"] = displayed.count < value.count
        }
        return response
    }

    private func failure(requestID: String, code: String, message: String) -> [String: Any] {
        [
            "request_id": requestID,
            "ok": false,
            "error_code": code,
            "error": String(message.prefix(500)),
        ]
    }

    private func normalizedRequestID(_ value: Any?) -> String? {
        guard let candidate = value as? String,
              candidate.count == 36,
              UUID(uuidString: candidate) != nil else { return nil }
        return candidate.lowercased()
    }

    private func positiveRunID(_ value: Any?) -> Int? {
        guard let number = value as? NSNumber,
              number.int64Value > 0,
              number.int64Value <= Int64(Int.max) else { return nil }
        return Int(number.int64Value)
    }
}

private enum WatchCodexAction: String {
    case availability
    case submit
    case status
    case cancel
}

private struct WatchCodexRun {
    let id: Int
    let status: String
    let statusMessage: String
    let model: String
    let reasoning: String
    let response: String?
    let requiresConfirmation: Bool
    let cancelRequested: Bool
    let cancellable: Bool
}

private struct WatchCodexAPIError: Error {
    let code: String
    let message: String
}

private final class WatchCodexAPIClient {
    private let redirectDelegate = WatchCodexRedirectDelegate()
    private lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 12
        configuration.timeoutIntervalForResource = 15
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.urlCache = nil
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.waitsForConnectivity = false
        return URLSession(configuration: configuration, delegate: redirectDelegate, delegateQueue: nil)
    }()

    func isAdmin(
        session secureSession: SecureWebSession,
        deviceID: String,
        requestID: String
    ) async throws -> Bool {
        let data = try await request(
            path: "bootstrap",
            method: "GET",
            secureSession: secureSession,
            deviceID: deviceID,
            requestID: requestID
        )
        guard let profile = data["profile"] as? [String: Any],
              let role = profile["role"] as? String else {
            throw WatchCodexAPIError(code: "invalid_response", message: "Réponse Maison Pilote incomplète.")
        }
        return role == "admin"
    }

    func submit(
        prompt: String,
        session secureSession: SecureWebSession,
        deviceID: String,
        requestID: String
    ) async throws -> WatchCodexRun {
        let data = try await request(
            path: "assistant/codex/runs",
            method: "POST",
            body: [
                "prompt": prompt,
                "source": "watchos_voice_assistant",
            ],
            secureSession: secureSession,
            deviceID: deviceID,
            requestID: requestID,
            idempotencyKey: requestID
        )
        return try decodeRun(data)
    }

    func status(
        runID: Int,
        session secureSession: SecureWebSession,
        deviceID: String,
        requestID: String
    ) async throws -> WatchCodexRun {
        let data = try await request(
            path: "assistant/codex/runs/\(runID)",
            method: "GET",
            secureSession: secureSession,
            deviceID: deviceID,
            requestID: requestID
        )
        return try decodeRun(data)
    }

    func cancel(
        runID: Int,
        session secureSession: SecureWebSession,
        deviceID: String,
        requestID: String
    ) async throws -> WatchCodexRun {
        let data = try await request(
            path: "assistant/codex/runs/\(runID)",
            method: "DELETE",
            secureSession: secureSession,
            deviceID: deviceID,
            requestID: requestID,
            idempotencyKey: requestID
        )
        return try decodeRun(data)
    }

    private func request(
        path: String,
        method: String,
        body: [String: Any]? = nil,
        secureSession: SecureWebSession,
        deviceID: String,
        requestID: String,
        idempotencyKey: String? = nil
    ) async throws -> [String: Any] {
        guard let url = endpoint(path) else {
            throw WatchCodexAPIError(code: "invalid_endpoint", message: "Configuration Maison Pilote invalide.")
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 12
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(secureSession.token)", forHTTPHeaderField: "Authorization")
        request.setValue("ios", forHTTPHeaderField: "X-App-Source")
        request.setValue(appVersionCode, forHTTPHeaderField: "X-App-Version-Code")
        request.setValue(appVersionName, forHTTPHeaderField: "X-App-Version-Name")
        request.setValue(deviceID, forHTTPHeaderField: "X-Device-Id")
        request.setValue("Maison Pilote - iPhone ou iPad", forHTTPHeaderField: "X-Device-Name")
        request.setValue(UIDevice.current.systemVersion, forHTTPHeaderField: "X-OS-Version")
        request.setValue(requestID, forHTTPHeaderField: "X-Request-Id")
        if let idempotencyKey {
            request.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key")
        }
        if let body {
            guard JSONSerialization.isValidJSONObject(body) else {
                throw WatchCodexAPIError(code: "invalid_request", message: "Demande montre invalide.")
            }
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (payload, response): (Data, URLResponse)
        do {
            (payload, response) = try await session.data(for: request)
        } catch {
            throw WatchCodexAPIError(
                code: "network_unavailable",
                message: "Maison Pilote n’est pas joignable depuis l’iPhone."
            )
        }
        guard payload.count <= 1_048_576,
              let http = response as? HTTPURLResponse else {
            throw WatchCodexAPIError(code: "invalid_response", message: "Réponse Maison Pilote illisible.")
        }
        let rawObject: Any
        do {
            rawObject = try JSONSerialization.jsonObject(with: payload)
        } catch {
            throw WatchCodexAPIError(code: "invalid_response", message: "Réponse Maison Pilote illisible.")
        }
        guard let object = rawObject as? [String: Any] else {
            throw WatchCodexAPIError(code: "invalid_response", message: "Réponse Maison Pilote incomplète.")
        }
        guard (200...299).contains(http.statusCode) else {
            throw serverError(status: http.statusCode, object: object)
        }
        guard let data = object["data"] as? [String: Any] else {
            throw WatchCodexAPIError(code: "invalid_response", message: "Réponse Maison Pilote incomplète.")
        }
        return data
    }

    private func endpoint(_ path: String) -> URL? {
        let normalizedPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !normalizedPath.isEmpty,
              !normalizedPath.contains(".."),
              !normalizedPath.contains("?") else { return nil }
        var components = URLComponents()
        components.scheme = "https"
        components.host = AppEnvironment.trustedHost
        components.path = "/api/mobile/v1/\(normalizedPath)"
        return components.url.flatMap { AppEnvironment.isTrusted($0) ? $0 : nil }
    }

    private var appVersionName: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
    }

    private var appVersionCode: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0"
    }

    private func decodeRun(_ data: [String: Any]) throws -> WatchCodexRun {
        guard let id = (data["id"] as? NSNumber)?.intValue, id > 0,
              let status = data["status"] as? String else {
            throw WatchCodexAPIError(code: "invalid_response", message: "Réponse Codex incomplète.")
        }
        return WatchCodexRun(
            id: id,
            status: status,
            statusMessage: data["status_message"] as? String ?? "",
            model: data["model"] as? String ?? "",
            reasoning: data["reasoning"] as? String ?? "",
            response: data["response"] as? String,
            requiresConfirmation: data["requires_confirmation"] as? Bool ?? false,
            cancelRequested: data["cancel_requested"] as? Bool ?? false,
            cancellable: data["cancellable"] as? Bool ?? false
        )
    }

    private func serverError(status: Int, object: [String: Any]) -> WatchCodexAPIError {
        let nestedMessage = (object["error"] as? [String: Any])?["message"] as? String
        let message = (object["message"] as? String) ?? nestedMessage ?? {
            switch status {
            case 401: return "Reconnectez-vous dans Maison Pilote sur l’iPhone."
            case 403: return "L’assistant est réservé aux administrateurs."
            default: return "Maison Pilote a refusé la demande (\(status))."
            }
        }()
        return WatchCodexAPIError(code: "http_\(status)", message: String(message.prefix(500)))
    }
}

private final class WatchCodexRedirectDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        guard let url = request.url,
              AppEnvironment.isTrusted(url),
              url.path.hasPrefix("/api/mobile/v1/") else {
            completionHandler(nil)
            return
        }
        completionHandler(request)
    }
}
