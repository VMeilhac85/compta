import Foundation
import Security

/// Navigation is acknowledged by the authenticated runtime, never by JavaScript delivery.
/// Keychain keeps the bounded inbox across process termination without backing it up.
@MainActor
final class NativeNavigationInbox {
    static let shared = NativeNavigationInbox()

    struct Pending: Codable {
        let id: UUID
        var identity: String?
        let createdAt: Date
        var detail: [String: String]
        var openedByUser: Bool
        let isPush: Bool

        var eventName: String {
            !isPush || (openedByUser && detail["deep_link"] != nil)
                ? "maisonpilote:deep-link"
                : "maisonpilote:push-notification"
        }
    }

    private struct State: Codable {
        var lastIdentity: String?
        var pending: [Pending] = []
    }

    private var state = State()
    private var storageLoaded = false
    private(set) var confirmedIdentity: String?
    private let maximumAge: TimeInterval = 7 * 24 * 60 * 60
    private let maximumItems = 20
    private let maximumStoredLength = 256 * 1_024

    private init() {
        _ = restoreIfNeeded()
    }

    private func restoreIfNeeded() -> Bool {
        if storageLoaded { return true }
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound {
            storageLoaded = true
            return true
        }
        guard status == errSecSuccess,
           let data = result as? Data,
           data.count <= maximumStoredLength,
           let restored = try? JSONDecoder().decode(State.self, from: data)
        else { return false }
        state = restored
        storageLoaded = true
        prune()
        return true
    }

    func enqueue(url: URL) {
        guard restoreIfNeeded() else { return }
        guard !state.pending.contains(where: {
            !$0.isPush && $0.identity == state.lastIdentity
                && $0.detail["url"] == url.absoluteString
        }) else { return }
        append(Pending(
            id: UUID(), identity: state.lastIdentity, createdAt: Date(),
            detail: ["url": String(url.absoluteString.prefix(2_048))],
            openedByUser: true, isPush: false
        ))
    }

    func enqueuePush(detail: [String: String], openedByUser: Bool) {
        // APNs may arrive before the first unlock. Do not invent a new anonymous
        // owner when protected storage is temporarily unavailable; the system
        // notification remains available and its explicit opening is redelivered.
        guard restoreIfNeeded() else { return }
        if let notificationID = detail["notification_id"],
           let index = state.pending.firstIndex(where: {
               $0.isPush && $0.identity == state.lastIdentity
                   && $0.detail["notification_id"] == notificationID
           }) {
            if openedByUser {
                state.pending[index].openedByUser = true
                state.pending[index].detail = detail
                persist()
            }
            return
        }
        append(Pending(
            id: UUID(), identity: state.lastIdentity, createdAt: Date(),
            detail: detail, openedByUser: openedByUser, isPush: true
        ))
    }

    @discardableResult
    func bindIdentity(_ value: String) -> Bool {
        guard restoreIfNeeded() else { return false }
        let identity = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !identity.isEmpty, identity.utf8.count <= 128,
              !identity.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains)
        else { return false }
        // Only items received before the first known account may bind on first login.
        state.pending.removeAll { $0.identity != nil && $0.identity != identity }
        for index in state.pending.indices {
            state.pending[index].identity = identity
        }
        confirmedIdentity = identity
        state.lastIdentity = identity
        prune()
        persist()
        return true
    }

    func suspendIdentity() {
        confirmedIdentity = nil
    }

    func clear() {
        confirmedIdentity = nil
        guard restoreIfNeeded() else { return }
        state.pending.removeAll()
        // Retain the last owner: a delayed APNs delivery after logout must never
        // silently attach itself to the next account signing in on this device.
        persist()
    }

    func next() -> Pending? {
        guard let identity = confirmedIdentity else { return nil }
        prune()
        return state.pending.first { $0.identity == identity }
    }

    @discardableResult
    func acknowledge(id: UUID) -> Bool {
        guard let identity = confirmedIdentity,
              let index = state.pending.firstIndex(where: {
                  $0.id == id && $0.identity == identity
              }) else { return false }
        state.pending.remove(at: index)
        persist()
        return true
    }

    private func append(_ pending: Pending) {
        prune()
        if state.pending.count >= maximumItems {
            let index = state.pending.firstIndex(where: { !$0.openedByUser }) ?? 0
            state.pending.remove(at: index)
        }
        state.pending.append(pending)
        persist()
    }

    private func prune() {
        let oldest = Date().addingTimeInterval(-maximumAge)
        state.pending.removeAll { $0.createdAt < oldest || $0.createdAt > Date().addingTimeInterval(60) }
        if state.pending.count > maximumItems {
            state.pending.removeFirst(state.pending.count - maximumItems)
        }
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(state),
              data.count <= maximumStoredLength else { return }
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemUpdate(baseQuery as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var insertion = baseQuery
            attributes.forEach { insertion[$0.key] = $0.value }
            SecItemAdd(insertion as CFDictionary, nil)
        }
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "expert.meilhac.maisonpilote.navigation",
            kSecAttrAccount as String: "pending-navigation-v1",
        ]
    }
}
