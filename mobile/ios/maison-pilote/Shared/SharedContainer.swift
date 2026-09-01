import Foundation

enum SharedContainer {
    private static let pendingAssistantRequestKey = "pending-assistant-request-v1"
    private static let maximumPromptLength = 20_000
    private static let requestLifetime: TimeInterval = 15 * 60

    static var appGroupIdentifier: String {
        let configured = Bundle.main.object(forInfoDictionaryKey: "MaisonPiloteAppGroupIdentifier") as? String
        return configured?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty
            ?? "group.expert.meilhac.maisonpilote"
    }

    static var defaults: UserDefaults? {
        UserDefaults(suiteName: appGroupIdentifier)
    }

    static var containerURL: URL? {
        FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupIdentifier
        )
    }

    @discardableResult
    static func storePendingAssistantRequest(prompt: String) -> Bool {
        let normalized = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return false }

        let request = PendingAssistantRequest(
            id: UUID().uuidString.lowercased(),
            prompt: String(normalized.prefix(maximumPromptLength)),
            requestedAtUTC: ISO8601DateFormatter().string(from: Date())
        )
        guard let payload = try? JSONEncoder().encode(request) else { return false }
        defaults?.set(payload, forKey: pendingAssistantRequestKey)
        return defaults != nil
    }

    static func pendingAssistantRequest() -> PendingAssistantRequest? {
        guard let payload = defaults?.data(forKey: pendingAssistantRequestKey),
              let request = try? JSONDecoder().decode(PendingAssistantRequest.self, from: payload),
              UUID(uuidString: request.id) != nil,
              let date = ISO8601DateFormatter().date(from: request.requestedAtUTC),
              abs(date.timeIntervalSinceNow) <= requestLifetime else {
            clearPendingAssistantRequest()
            return nil
        }
        if let normalizedPayload = try? JSONEncoder().encode(request) {
            defaults?.set(normalizedPayload, forKey: pendingAssistantRequestKey)
        }
        return request
    }

    static func clearPendingAssistantRequest() {
        defaults?.removeObject(forKey: pendingAssistantRequestKey)
    }
}

struct PendingAssistantRequest: Codable {
    let id: String
    let prompt: String
    let requestedAtUTC: String

    private enum CodingKeys: String, CodingKey {
        case id
        case prompt
        case requestedAtUTC
    }

    init(id: String, prompt: String, requestedAtUTC: String) {
        self.id = id
        self.prompt = prompt
        self.requestedAtUTC = requestedAtUTC
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
            ?? UUID().uuidString.lowercased()
        prompt = try container.decode(String.self, forKey: .prompt)
        requestedAtUTC = try container.decode(String.self, forKey: .requestedAtUTC)
    }
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}
