import AVFoundation
import Foundation
import Speech
import UIKit

@MainActor
protocol SpeechRecognitionBridgeDelegate: AnyObject {
    func speechRecognitionBridge(_ bridge: SpeechRecognitionBridge, didFinish transcript: String)
    func speechRecognitionBridge(_ bridge: SpeechRecognitionBridge, didFail code: String, message: String)
}

@MainActor
final class SpeechRecognitionBridge: NSObject {
    weak var delegate: SpeechRecognitionBridgeDelegate?

    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var recognizer: SFSpeechRecognizer?
    private var tapInstalled = false
    private var cancelledByUser = true
    private var generation = UUID()
    private var observers: [NSObjectProtocol] = []
    private var recognitionDeadline: DispatchWorkItem?
    private(set) var requestID = ""

    override init() {
        super.init()
        for name in [UIApplication.didEnterBackgroundNotification, AVAudioSession.interruptionNotification] {
            observers.append(NotificationCenter.default.addObserver(
                forName: name, object: nil, queue: .main
            ) { [weak self] _ in
                Task { @MainActor in self?.cancel(notify: true) }
            })
        }
    }

    deinit { observers.forEach(NotificationCenter.default.removeObserver) }

    func start(language: String, requestID: String = "") {
        cancel(notify: false)
        cancelledByUser = false
        self.requestID = requestID
        let invocation = generation
        let safeLanguage = Self.normalizedLanguage(language)

        requestPermissions(generation: invocation) { [weak self] allowed, code, message in
            guard let self, self.generation == invocation, !self.cancelledByUser else { return }
            guard allowed else {
                self.cancel(notify: false)
                self.delegate?.speechRecognitionBridge(
                    self,
                    didFail: code ?? "permission-denied",
                    message: message ?? "Autorisez le microphone et la reconnaissance vocale."
                )
                return
            }
            self.beginRecognition(language: safeLanguage, generation: invocation)
        }
    }

    func cancel(notify: Bool = false) {
        let wasActive = !cancelledByUser
        generation = UUID()
        cancelledByUser = true
        recognitionDeadline?.cancel()
        recognitionDeadline = nil
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        stopAudioSession()
        if notify && wasActive {
            delegate?.speechRecognitionBridge(
                self,
                didFail: "cancelled",
                message: "Dictée annulée."
            )
        }
    }

    private func requestPermissions(
        generation invocation: UUID,
        completion: @escaping (Bool, String?, String?) -> Void
    ) {
        SFSpeechRecognizer.requestAuthorization { [weak self] speechStatus in
            DispatchQueue.main.async {
                guard let self, self.generation == invocation, !self.cancelledByUser else { return }
                guard speechStatus == .authorized else {
                    completion(
                        false,
                        "speech-permission-denied",
                        "Autorisez la reconnaissance vocale dans les réglages de l’iPhone."
                    )
                    return
                }
                NativePermissionCoordinator.request(.microphone) { microphoneAllowed in
                    completion(
                        microphoneAllowed,
                        microphoneAllowed ? nil : "microphone-permission-denied",
                        microphoneAllowed ? nil : "Autorisez le microphone dans les réglages de l’iPhone."
                    )
                }
            }
        }
    }

    private func beginRecognition(language: String, generation invocation: UUID) {
        guard generation == invocation, !cancelledByUser else { return }
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language))
        guard let recognizer, recognizer.isAvailable else {
            delegate?.speechRecognitionBridge(
                self,
                didFail: "recognizer-unavailable",
                message: "La reconnaissance vocale est momentanément indisponible."
            )
            return
        }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: [.duckOthers])
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            request.taskHint = .dictation
            recognitionRequest = request
            self.recognizer = recognizer

            let inputNode = audioEngine.inputNode
            let format = inputNode.outputFormat(forBus: 0)
            guard format.sampleRate > 0 else {
                throw SpeechBridgeError.audioInputUnavailable
            }
            inputNode.installTap(onBus: 0, bufferSize: 1_024, format: format) { buffer, _ in
                request.append(buffer)
            }
            tapInstalled = true

            recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self, self.generation == invocation, !self.cancelledByUser else { return }
                    if let result, result.isFinal {
                        let transcript = result.bestTranscription.formattedString
                            .trimmingCharacters(in: .whitespacesAndNewlines)
                        self.finishRecognition()
                        if transcript.isEmpty {
                            self.delegate?.speechRecognitionBridge(
                                self,
                                didFail: "no-match",
                                message: "Aucune demande n’a été reconnue."
                            )
                        } else {
                            self.delegate?.speechRecognitionBridge(self, didFinish: transcript)
                        }
                        return
                    }
                    if error != nil && !self.cancelledByUser {
                        self.finishRecognition()
                        self.delegate?.speechRecognitionBridge(
                            self,
                            didFail: "recognition-failed",
                            message: "La dictée n’a pas pu aboutir."
                        )
                    }
                }
            }
            audioEngine.prepare()
            try audioEngine.start()
            let deadline = DispatchWorkItem { [weak self] in
                guard let self, self.generation == invocation, !self.cancelledByUser else { return }
                self.cancel(notify: false)
                self.delegate?.speechRecognitionBridge(
                    self, didFail: "recognition-timeout",
                    message: "La dictée a atteint sa durée maximale. Vous pouvez recommencer."
                )
            }
            recognitionDeadline = deadline
            DispatchQueue.main.asyncAfter(deadline: .now() + 60, execute: deadline)
        } catch {
            finishRecognition()
            delegate?.speechRecognitionBridge(
                self,
                didFail: "audio-start-failed",
                message: "La dictée n’a pas pu démarrer."
            )
        }
    }

    private func finishRecognition() {
        generation = UUID()
        cancelledByUser = true
        recognitionDeadline?.cancel()
        recognitionDeadline = nil
        recognitionRequest?.endAudio()
        recognitionTask?.finish()
        recognitionTask = nil
        recognitionRequest = nil
        stopAudioSession()
    }

    private func stopAudioSession() {
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        if tapInstalled {
            audioEngine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        try? AVAudioSession.sharedInstance().setActive(
            false,
            options: .notifyOthersOnDeactivation
        )
        recognizer = nil
    }

    private static func normalizedLanguage(_ language: String) -> String {
        let candidate = language.trimmingCharacters(in: .whitespacesAndNewlines)
        guard candidate.range(of: #"^[A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?$"#, options: .regularExpression) != nil else {
            return "fr-FR"
        }
        return String(candidate.prefix(16))
    }
}

private enum SpeechBridgeError: Error {
    case audioInputUnavailable
}
