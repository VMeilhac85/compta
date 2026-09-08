// Outil de capture uniquement. Ce fichier n'appartient à aucune cible Xcode.
import UIKit
import Security

final class SessionSeedDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let raw = ProcessInfo.processInfo.environment["IOS_SCREENSHOT_SESSION"] ?? ""
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "expert.meilhac.maisonpilote.web-session",
            kSecAttrAccount as String: "web-session-v1",
        ]
        SecItemDelete(query as CFDictionary)
        var insertion = query
        insertion[kSecValueData as String] = Data(raw.utf8)
        insertion[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = raw.isEmpty ? errSecParam : SecItemAdd(insertion as CFDictionary, nil)
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        try? Data("{\"status\":\(status)}".utf8).write(to: documents.appendingPathComponent("seed-status.json"))
        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = UIViewController()
        window?.makeKeyAndVisible()
        return true
    }
}

UIApplicationMain(CommandLine.argc, CommandLine.unsafeArgv, nil, NSStringFromClass(SessionSeedDelegate.self))
