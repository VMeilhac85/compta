import CryptoKit
import Foundation
import Security

/// Text drafts remain on this device, independently of network and WebView lifetime.
/// Each authenticated owner has a distinct Keychain entry; values are never injected
/// before the runtime has confirmed that owner's identity.
@MainActor
final class SecureDraftStore {
    enum StorageError: Error {
        case unavailable, invalid, full

        var message: String {
            switch self {
            case .unavailable: return "Le brouillon n’a pas pu être conservé sur cet iPhone."
            case .invalid: return "Ce brouillon ne peut pas être conservé sur cet iPhone."
            case .full: return "L’espace réservé aux brouillons est plein. Enregistrez les brouillons en attente."
            }
        }
    }

    func read(identity: String) throws -> [String: String] {
        var query = baseQuery(identity: identity)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return [:] }
        guard status == errSecSuccess,
              let data = result as? Data, data.count <= 1_048_576,
              let drafts = try? JSONDecoder().decode([String: String].self, from: data)
        else { throw StorageError.unavailable }
        return drafts
    }

    func write(identity: String, key: String, value: String?) throws -> [String: String] {
        guard !key.isEmpty, key.utf8.count <= 1_024,
              !key.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains),
              value.map({ $0.utf8.count <= 131_072 }) ?? true
        else { throw StorageError.invalid }
        var drafts = try read(identity: identity)
        if let value { drafts[key] = value } else { drafts.removeValue(forKey: key) }
        guard drafts.count <= 64,
              let data = try? JSONEncoder().encode(drafts), data.count <= 1_048_576
        else { throw StorageError.full }
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let query = baseQuery(identity: identity)
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var insertion = query
            attributes.forEach { insertion[$0.key] = $0.value }
            guard SecItemAdd(insertion as CFDictionary, nil) == errSecSuccess
            else { throw StorageError.unavailable }
        } else if status != errSecSuccess {
            throw StorageError.unavailable
        }
        return drafts
    }

    private func baseQuery(identity: String) -> [String: Any] {
        let owner = SHA256.hash(data: Data(identity.utf8))
            .map { String(format: "%02x", $0) }.joined()
        return [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "expert.meilhac.maisonpilote.drafts",
            kSecAttrAccount as String: "owner-v1-" + owner,
        ]
    }
}
