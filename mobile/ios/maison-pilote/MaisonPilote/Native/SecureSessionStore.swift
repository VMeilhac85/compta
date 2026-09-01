import Foundation
import Security

struct SecureWebSession: Codable {
    let token: String
    let expiresAt: String?
    let deviceID: String?
}

final class SecureSessionStore {
    static let shared = SecureSessionStore()

    private let service = "expert.meilhac.maisonpilote.web-session"
    private let account = "web-session-v1"
    private let maximumTokenLength = 65_536
    private let maximumExpirationLength = 256

    private init() {}

    func load() -> SecureWebSession? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let session = try? JSONDecoder().decode(SecureWebSession.self, from: data),
              !session.token.isEmpty else { return nil }

        if let expiresAt = session.expiresAt,
           let expirationDate = Self.date(from: expiresAt),
           expirationDate <= Date() {
            clear()
            return nil
        }
        return session
    }

    @discardableResult
    func store(token: String, expiresAt: String?, deviceID: String? = nil) -> Bool {
        let normalizedToken = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedToken.isEmpty,
              normalizedToken.count <= maximumTokenLength else { return false }

        let normalizedExpiration = expiresAt.map {
            String(
                $0.trimmingCharacters(in: .whitespacesAndNewlines)
                    .prefix(maximumExpirationLength)
            )
        }.flatMap { $0.isEmpty ? nil : $0 }
        if let normalizedExpiration {
            guard let date = Self.date(from: normalizedExpiration), date > Date() else {
                return false
            }
        }
        let normalizedDeviceID: String?
        if let deviceID {
            guard let validDeviceID = Self.normalizedDeviceID(deviceID) else { return false }
            normalizedDeviceID = validDeviceID
        } else {
            normalizedDeviceID = load()?.deviceID
        }
        let session = SecureWebSession(
            token: normalizedToken,
            expiresAt: normalizedExpiration,
            deviceID: normalizedDeviceID
        )
        return replace(with: session)
    }

    @discardableResult
    func bindDeviceID(_ deviceID: String) -> Bool {
        guard let normalizedDeviceID = Self.normalizedDeviceID(deviceID),
              let current = load() else { return false }
        return replace(with: SecureWebSession(
            token: current.token,
            expiresAt: current.expiresAt,
            deviceID: normalizedDeviceID
        ))
    }

    private func replace(with session: SecureWebSession) -> Bool {
        guard let data = try? JSONEncoder().encode(session) else { return false }

        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let updateStatus = SecItemUpdate(
            baseQuery as CFDictionary,
            attributes as CFDictionary
        )
        if updateStatus == errSecSuccess {
            return true
        }
        guard updateStatus == errSecItemNotFound else { return false }

        var insertion = baseQuery
        attributes.forEach { insertion[$0.key] = $0.value }
        return SecItemAdd(insertion as CFDictionary, nil) == errSecSuccess
    }

    func clear() {
        SecItemDelete(baseQuery as CFDictionary)
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    private static func date(from value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) {
            return date
        }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }

    private static func normalizedDeviceID(_ value: String) -> String? {
        let candidate = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard candidate.count == 36, UUID(uuidString: candidate) != nil else { return nil }
        return candidate.lowercased()
    }
}
