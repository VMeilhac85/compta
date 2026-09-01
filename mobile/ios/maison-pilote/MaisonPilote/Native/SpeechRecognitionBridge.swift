import AVFoundation
import Foundation
import Speech

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
    private var cancelledByUser = false

    func start(language: String) {
        cancel(notify: false)
        cancelledByUser = false
        let safeLanguage = Self.normalizedLanguage(language)

        requestPermissions { [weak self] allowed, code, message in
            guard let self else { return }
            guard allowed else {
                self.delegate?.speechRecognitionBridge(
                    self,
                    didFail: code ?? "permission-denied",
                    message: message ?? "Autorisez le microphone et la reconnaissance vocale."
                )
                return
            }
            self.beginRecognition(language: safeLanguage)
        }
    }

    func cancel(notify: Bool = false) {
        cancelledByUser = true
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        stopAudioSession()
        if notify {
            delegate?.speechRecognitionBridge(
                self,
                didFail: "cancelled",
                message: "Dictée annulée."
            )
        }
    }

    private func requestPermissions(
        completion: @escaping (Bool, String?, String?) -> Void
    ) {
        SFSpeechRecognizer.requestAuthorization { speechStatus in
            DispatchQueue.main.async {
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

    private func beginRecognition(language: String) {
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
                    guard let self else { return }
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
