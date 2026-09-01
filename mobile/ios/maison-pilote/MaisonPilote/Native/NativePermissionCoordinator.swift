import AVFoundation
import Foundation
import WebKit

enum NativePermissionCoordinator {
    static func request(_ type: WKMediaCaptureType, completion: @escaping (Bool) -> Void) {
        switch type {
        case .camera:
            requestCamera(completion)
        case .microphone:
            requestMicrophone(completion)
        case .cameraAndMicrophone:
            let group = DispatchGroup()
            var camera = false
            var microphone = false
            group.enter()
            requestCamera { camera = $0; group.leave() }
            group.enter()
            requestMicrophone { microphone = $0; group.leave() }
            group.notify(queue: .main) { completion(camera && microphone) }
        @unknown default:
            completion(false)
        }
    }

    private static func requestCamera(_ completion: @escaping (Bool) -> Void) {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            completion(true)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async { completion(granted) }
            }
        default:
            completion(false)
        }
    }

    private static func requestMicrophone(_ completion: @escaping (Bool) -> Void) {
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted:
            completion(true)
        case .undetermined:
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                DispatchQueue.main.async { completion(granted) }
            }
        case .denied:
            completion(false)
        @unknown default:
            completion(false)
        }
    }
}
