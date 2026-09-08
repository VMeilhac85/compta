// Outil de capture uniquement. Ce fichier n'appartient à aucune cible Xcode.
import UIKit
import Security
import WebKit

final class SessionSeedDelegate: UIResponder, UIApplicationDelegate, WKNavigationDelegate {
    var window: UIWindow?
    var webView: WKWebView?
    var seedStatus: OSStatus = errSecParam
    var remainingURLs = [
        "https://maisonpilote.meilhac.expert/api/application-ios/test?native=1",
        "https://maisonpilote.fr/api/application-ios/test?native=1",
    ]

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
        seedStatus = raw.isEmpty ? errSecParam : SecItemAdd(insertion as CFDictionary, nil)
        let session = (try? JSONSerialization.jsonObject(with: Data(raw.utf8))) as? [String: Any]
        let deviceID = session?["deviceID"] as? String ?? ""
        let preferenceData = try! JSONSerialization.data(withJSONObject: ["installationUuid": deviceID, "theme": "light"])
        let preferences = String(data: preferenceData, encoding: .utf8)!
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.addUserScript(WKUserScript(
            source: "localStorage.setItem('maison-pilote:mobile-emulator:preferences:ios:ios:v1', JSON.stringify(\(preferences)));",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        webView = WKWebView(frame: UIScreen.main.bounds, configuration: configuration)
        webView?.navigationDelegate = self
        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = UIViewController()
        window?.rootViewController?.view = webView
        window?.makeKeyAndVisible()
        loadNextOrigin()
        return true
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loadNextOrigin()
    }

    private func loadNextOrigin() {
        if !remainingURLs.isEmpty {
            webView?.load(URLRequest(url: URL(string: remainingURLs.removeFirst())!))
            return
        }
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        try? Data("{\"status\":\(seedStatus)}".utf8).write(to: documents.appendingPathComponent("seed-status.json"))
    }
}

UIApplicationMain(CommandLine.argc, CommandLine.unsafeArgv, nil, NSStringFromClass(SessionSeedDelegate.self))
