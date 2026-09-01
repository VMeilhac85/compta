import Combine
import Foundation
import WatchConnectivity

@MainActor
final class WatchAssistantViewModel: ObservableObject {
    @Published var draft = ""
    @Published private(set) var available: Bool?
    @Published private(set) var prompt = ""
    @Published private(set) var busy = false
    @Published private(set) var status = ""
    @Published private(set) var statusMessage = ""
    @Published private(set) var model = ""
    @Published private(set) var reasoning = ""
    @Published private(set) var response: String?
    @Published private(set) var cancellable = false
    @Published private(set) var error = ""

    private var runID: Int?
    private var pollingTask: Task<Void, Never>?
    private var started = false

    var hasRun: Bool { runID != nil || !status.isEmpty }
    var hasOpenRun: Bool { ["pending", "running"].contains(status) }
    var canSubmit: Bool {
        available == true && !busy && !hasOpenRun
            && !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
    var showsProgress: Bool { available == nil || busy || hasOpenRun }
    var headline: String {
        if available == nil { return "Vérification de l’accès…" }
        if available == false { return "Assistant réservé aux administrateurs" }
        if !statusMessage.isEmpty { return statusMessage }
        return "Dictez ou saisissez votre demande à Codex Compta"
    }

    deinit {
        pollingTask?.cancel()
    }

    func start() {
        guard !started else { return }
        started = true
        checkAvailability()
    }

    func checkAvailability() {
        guard !busy else { return }
        pollingTask?.cancel()
        busy = true
        available = nil
        error = ""
        Task {
            do {
                let payload = try await WatchPhoneRelay.shared.request(action: "availability")
                try validate(payload)
                available = payload["available"] as? Bool ?? false
            } catch {
                available = nil
                self.error = message(for: error)
            }
            busy = false
        }
    }

    func submit() {
        let normalizedPrompt = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard canSubmit, normalizedPrompt.count <= 8_000 else {
            if normalizedPrompt.count > 8_000 {
                error = "La demande ne peut pas dépasser 8 000 caractères."
            }
            return
        }
        pollingTask?.cancel()
        busy = true
        error = ""
        response = nil
        prompt = normalizedPrompt
        status = ""
        statusMessage = "Transmission à Codex…"
        Task {
            do {
                let payload = try await WatchPhoneRelay.shared.request(
                    action: "submit",
                    values: ["prompt": normalizedPrompt]
                )
                try apply(payload)
                draft = ""
            } catch {
                self.error = message(for: error)
                statusMessage = ""
            }
            busy = false
            schedulePollIfNeeded()
        }
    }

    func cancel() {
        guard let runID, runID > 0, cancellable, !busy else { return }
        pollingTask?.cancel()
        busy = true
        error = ""
        Task {
            do {
                let payload = try await WatchPhoneRelay.shared.request(
                    action: "cancel",
                    values: ["run_id": runID]
                )
                try apply(payload)
            } catch {
                self.error = message(for: error)
            }
            busy = false
            schedulePollIfNeeded()
        }
    }

    private func refreshStatus() async {
        guard let runID, runID > 0 else { return }
        do {
            let payload = try await WatchPhoneRelay.shared.request(
                action: "status",
                values: ["run_id": runID]
            )
            try apply(payload)
            error = ""
        } catch {
            self.error = message(for: error)
        }
        schedulePollIfNeeded()
    }

    private func schedulePollIfNeeded() {
        pollingTask?.cancel()
        guard hasOpenRun, runID != nil else { return }
        pollingTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            guard !Task.isCancelled else { return }
            await self?.refreshStatus()
        }
    }

    private func apply(_ payload: [String: Any]) throws {
        try validate(payload)
        guard let id = (payload["run_id"] as? NSNumber)?.intValue, id > 0 else {
            throw WatchRelayError.invalidResponse
        }
        runID = id
        status = payload["status"] as? String ?? ""
        statusMessage = (payload["status_message"] as? String)?.nonEmpty ?? statusLabel(status)
        model = payload["model"] as? String ?? ""
        reasoning = payload["reasoning"] as? String ?? ""
        response = payload["response"] as? String
        cancellable = payload["cancellable"] as? Bool ?? false
    }

    private func validate(_ payload: [String: Any]) throws {
        guard payload["ok"] as? Bool == true else {
            let message = payload["error"] as? String ?? "La demande a échoué."
            throw WatchRelayError.server(message)
        }
    }

    private func message(for error: Error) -> String {
        if let error = error as? WatchRelayError { return error.message }
        return "Le téléphone ne répond pas. Ouvrez Maison Pilote sur l’iPhone."
    }

    private func statusLabel(_ status: String) -> String {
        switch status {
        case "pending": return "Codex démarre…"
        case "running": return "Codex travaille…"
        case "completed": return "Traitement terminé"
        case "requires_confirmation": return "Confirmation requise"
        case "cancelled": return "Traitement arrêté"
        case "error": return "Le traitement a échoué"
        default: return "Demande transmise"
        }
    }
}

private enum WatchRelayError: Error {
    case unsupported
    case phoneUnavailable
    case invalidResponse
    case server(String)

    var message: String {
        switch self {
        case .unsupported:
            return "Cette Apple Watch ne permet pas la liaison avec l’iPhone."
        case .phoneUnavailable:
            return "Le téléphone ne répond pas. Ouvrez Maison Pilote sur l’iPhone."
        case .invalidResponse:
            return "La réponse de l’iPhone est illisible."
        case .server(let message):
            return message
        }
    }
}

private final class WatchPhoneRelay: NSObject, WCSessionDelegate {
    static let shared = WatchPhoneRelay()

    private let session: WCSession?

    private override init() {
        if WCSession.isSupported() {
            session = WCSession.default
        } else {
            session = nil
        }
        super.init()
        session?.delegate = self
        session?.activate()
    }

    func request(action: String, values: [String: Any] = [:]) async throws -> [String: Any] {
        guard let session else { throw WatchRelayError.unsupported }
        for _ in 0..<20 where session.activationState != .activated {
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        guard session.activationState == .activated, session.isReachable else {
            throw WatchRelayError.phoneUnavailable
        }
        var message = values
        message["action"] = action
        let requestID = UUID().uuidString.lowercased()
        message["request_id"] = requestID
        return try await withCheckedThrowingContinuation { continuation in
            session.sendMessage(message) { response in
                guard response["request_id"] as? String == requestID else {
                    continuation.resume(throwing: WatchRelayError.invalidResponse)
                    return
                }
                continuation.resume(returning: response)
            } errorHandler: { _ in
                continuation.resume(throwing: WatchRelayError.phoneUnavailable)
            }
        }
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}
