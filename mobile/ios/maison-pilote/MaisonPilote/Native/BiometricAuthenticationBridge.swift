import Foundation
import LocalAuthentication

@MainActor
protocol BiometricAuthenticationBridgeDelegate: AnyObject {
    func biometricAuthenticationBridge(
        _ bridge: BiometricAuthenticationBridge,
        didFinishWithSuccess success: Bool,
        errorCode: String?
    )
}

@MainActor
final class BiometricAuthenticationBridge {
    weak var delegate: BiometricAuthenticationBridgeDelegate?

    private var context: LAContext?

    func authenticate() {
        let context = LAContext()
        context.localizedCancelTitle = "Fermer"
        self.context = context

        var evaluationError: NSError?
        guard context.canEvaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            error: &evaluationError
        ) else {
            finish(success: false, errorCode: Self.errorCode(for: evaluationError))
            return
        }

        context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: "Confirmez votre identité pour accéder à votre session Maison Pilote."
        ) { [weak self] success, error in
            DispatchQueue.main.async {
                self?.finish(success: success, errorCode: success ? nil : Self.errorCode(for: error))
            }
        }
    }

    func cancel() {
        context?.invalidate()
        context = nil
    }

    private func finish(success: Bool, errorCode: String?) {
        context = nil
        delegate?.biometricAuthenticationBridge(
            self,
            didFinishWithSuccess: success,
            errorCode: errorCode
        )
    }

    private static func errorCode(for error: Error?) -> String {
        guard let laError = error as? LAError else { return "biometry-unavailable" }
        switch laError.code {
        case .authenticationFailed:
            return "authentication-failed"
        case .userCancel, .appCancel, .systemCancel:
            return "cancelled"
        case .biometryNotAvailable:
            return "biometry-unavailable"
        case .biometryNotEnrolled:
            return "biometry-not-enrolled"
        case .biometryLockout:
            return "biometry-locked"
        case .invalidContext:
            return "invalid-context"
        case .notInteractive:
            return "not-interactive"
        default:
            return "authentication-failed"
        }
    }
}
