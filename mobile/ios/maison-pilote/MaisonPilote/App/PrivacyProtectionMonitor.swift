import Combine
import UIKit

@MainActor
final class PrivacyProtectionMonitor: ObservableObject {
    @Published private(set) var isScreenCaptured: Bool

    init(notificationCenter: NotificationCenter = .default) {
        isScreenCaptured = UIScreen.main.isCaptured
        notificationCenter.addObserver(
            forName: UIScreen.capturedDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.isScreenCaptured = UIScreen.main.isCaptured
            }
        }
    }
}
