import Foundation
import Security
import UIKit
import UserNotifications

extension Notification.Name {
    static let maisonPilotePushStateChanged = Notification.Name(
        "expert.meilhac.maisonpilote.push-state-changed"
    )
}

@MainActor
final class MobilePushCoordinator {
    static let shared = MobilePushCoordinator()

    private let tokenStore = ApnsTokenStore.shared
    private(set) var currentToken: String?
    var displayedContextKeys: Set<String> = []
    var displayedContextKey: String?
    var contentVisible = false
    private(set) var authorization = "unknown"
    private(set) var registration = "idle"
    private(set) var lastError: [String: String]?

    var publicState: [String: Any] {
        ["authorization": authorization, "registration": registration,
         "error": lastError.map { $0 as Any } ?? NSNull(), "can_open_settings": true]
    }

    private init() {
        currentToken = tokenStore.load()
    }

    var environment: String {
#if DEBUG
        return "sandbox"
#else
        return "production"
#endif
    }

    func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        ) { granted, error in
            Task { @MainActor in
                if error != nil {
                    self.lastError = ["code": "authorization_failed",
                                      "message": "L’autorisation des notifications n’a pas pu être vérifiée."]
                }
                self.registerIfAuthorized()
            }
        }
    }

    func registerIfAuthorized() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            Task { @MainActor in
                switch settings.authorizationStatus {
                case .notDetermined: self.authorization = "not_determined"
                case .denied: self.authorization = "denied"
                case .authorized: self.authorization = "authorized"
                case .provisional: self.authorization = "provisional"
                case .ephemeral: self.authorization = "ephemeral"
                @unknown default: self.authorization = "unknown"
                }
                if ["authorized", "provisional", "ephemeral"].contains(self.authorization) {
                    self.registration = "registering"
                    self.lastError = nil
                    UIApplication.shared.registerForRemoteNotifications()
                } else {
                    self.registration = "idle"
                    if self.authorization == "denied" { self.lastError = nil }
                }
                self.publishState()
            }
        }
    }

    func didRegister(deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        guard ApnsTokenStore.isValid(token), tokenStore.store(token) else {
            registration = "failed"
            lastError = ["code": "token_storage_failed",
                         "message": "L’inscription aux notifications n’a pas pu être conservée sur cet iPhone."]
            publishState()
            return
        }
        currentToken = token
        registration = "registered"
        lastError = nil
        publishState()
    }

    func didFailRegistration() {
        registration = "failed"
        lastError = ["code": "registration_failed",
                     "message": "L’iPhone n’a pas pu s’inscrire aux notifications. Réessayez avec une connexion disponible."]
        publishState()
    }

    private func publishState() {
        NotificationCenter.default.post(name: .maisonPilotePushStateChanged, object: nil)
    }

    func receive(payload: [String: String], openedByUser: Bool) {
        var normalized = payload
        if let rawDeepLink = payload["deep_link"],
           let candidate = URL(string: rawDeepLink),
           let deepLink = AppEnvironment.normalizedDeepLink(candidate) {
            normalized["deep_link"] = deepLink.absoluteString
        } else {
            normalized.removeValue(forKey: "deep_link")
        }
        NativeNavigationInbox.shared.enqueuePush(detail: normalized, openedByUser: openedByUser)
        NotificationCenter.default.post(name: .maisonPilotePushStateChanged, object: nil)
    }

}

final class MaisonPiloteAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Task { @MainActor in
            MobilePushCoordinator.shared.registerIfAuthorized()
        }
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            MobilePushCoordinator.shared.didRegister(deviceToken: deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        Task { @MainActor in
            MobilePushCoordinator.shared.didFailRegistration()
        }
    }

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        let payload = Self.safePayload(from: userInfo)
        Task { @MainActor in
            MobilePushCoordinator.shared.receive(payload: payload, openedByUser: false)
            completionHandler(payload.isEmpty ? .noData : .newData)
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let payload = Self.safePayload(from: notification.request.content.userInfo)
        Task { @MainActor in
            MobilePushCoordinator.shared.receive(payload: payload, openedByUser: false)
            let coordinator = MobilePushCoordinator.shared
            let key = payload["context_key"] ?? ""
            let alreadyDisplayed = coordinator.contentVisible && !key.isEmpty && (coordinator.displayedContextKey == key || coordinator.displayedContextKeys.contains(key))
            completionHandler(alreadyDisplayed ? [] : [.banner, .list, .sound, .badge])
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let payload = Self.safePayload(from: response.notification.request.content.userInfo)
        Task { @MainActor in
            MobilePushCoordinator.shared.receive(payload: payload, openedByUser: true)
            completionHandler()
        }
    }

    private static func safePayload(from userInfo: [AnyHashable: Any]) -> [String: String] {
        let nested = userInfo["maison_pilote"] as? [String: Any]
        var payload: [String: String] = [:]
        for key in ["notification_id", "notification_ref", "context_key", "schema_version", "category", "dossier_id", "type", "action_type", "deep_link"] {
            let value = nested?[key] ?? userInfo[key]
            if let string = value as? String, !string.isEmpty {
                payload[key] = String(string.prefix(2_048))
            } else if let number = value as? NSNumber {
                payload[key] = number.stringValue
            }
        }
        return payload
    }
}

private final class ApnsTokenStore {
    static let shared = ApnsTokenStore()

    private let service = "expert.meilhac.maisonpilote.apns-token"
    private let account = "apns-device-token-v1"

    private init() {}

    func load() -> String? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8),
              Self.isValid(token) else { return nil }
        return token
    }

    @discardableResult
    func store(_ token: String) -> Bool {
        guard Self.isValid(token), let data = token.data(using: .utf8) else { return false }
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemUpdate(baseQuery as CFDictionary, attributes as CFDictionary)
        if status == errSecSuccess {
            return true
        }
        guard status == errSecItemNotFound else { return false }
        var insertion = baseQuery
        attributes.forEach { insertion[$0.key] = $0.value }
        return SecItemAdd(insertion as CFDictionary, nil) == errSecSuccess
    }

    static func isValid(_ token: String) -> Bool {
        token.range(of: "^[a-f0-9]{64,200}$", options: .regularExpression) != nil
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}
