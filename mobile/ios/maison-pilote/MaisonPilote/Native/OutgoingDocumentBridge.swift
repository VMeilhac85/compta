import Foundation
import QuickLook
import UIKit
import WebKit

@MainActor
protocol OutgoingDocumentBridgeDelegate: AnyObject {
    func outgoingDocumentBridge(
        _ bridge: OutgoingDocumentBridge,
        emit eventName: String,
        detail: [String: Any]
    )
}

/// Reçoit un document produit par le runtime web sans autoriser de navigation
/// `blob:`. Les octets ne quittent jamais le répertoire temporaire privé avant
/// que l’utilisateur ouvre explicitement Quick Look ou la feuille de partage.
@MainActor
final class OutgoingDocumentBridge: NSObject {
    static let maximumChunkLength = 256 * 1024
    static let maximumDocumentLength: Int64 = 100 * 1024 * 1024

    weak var delegate: OutgoingDocumentBridgeDelegate?

    private let fileManager = FileManager.default
    private let manifestName = "transfer.json"
    private let maximumTransfers = 2
    private let maximumManifestLength = 4 * 1024
    private var activePresentation: ActivePresentation?

    private struct TransferManifest: Codable, Equatable {
        let version: Int
        let transferID: String
        let fileName: String
        let mimeType: String
        let totalSize: Int64
    }

    private struct ActivePresentation {
        let transferID: String
        let requestID: String
        let mode: String
        let controller: UIViewController
        var cancelRequestID: String?
    }

    private enum BridgeError: Error {
        case invalidRequest
        case invalidTransfer
        case invalidFileName
        case invalidMimeType
        case invalidSize
        case invalidChunk
        case offsetMismatch(Int64)
        case transferLimit
        case transferConflict
        case transferNotFound
        case transferUnsafe
        case transferIncomplete(Int64)
        case presentationBusy
        case presentationUnavailable
        case previewUnavailable
        case storageUnavailable

        var code: String {
            switch self {
            case .invalidRequest: return "invalid_request"
            case .invalidTransfer: return "invalid_transfer"
            case .invalidFileName: return "invalid_file_name"
            case .invalidMimeType: return "invalid_mime_type"
            case .invalidSize: return "invalid_size"
            case .invalidChunk: return "invalid_chunk"
            case .offsetMismatch: return "offset_mismatch"
            case .transferLimit: return "transfer_limit"
            case .transferConflict: return "transfer_conflict"
            case .transferNotFound: return "transfer_not_found"
            case .transferUnsafe: return "transfer_unsafe"
            case .transferIncomplete: return "transfer_incomplete"
            case .presentationBusy: return "presentation_busy"
            case .presentationUnavailable: return "presentation_unavailable"
            case .previewUnavailable: return "preview_unavailable"
            case .storageUnavailable: return "storage_unavailable"
            }
        }

        var message: String {
            switch self {
            case .invalidRequest:
                return "La demande de document est invalide."
            case .invalidTransfer:
                return "L’identifiant de transfert est invalide."
            case .invalidFileName:
                return "Le nom du document est invalide."
            case .invalidMimeType:
                return "Le type du document est invalide."
            case .invalidSize:
                return "La taille du document est invalide ou dépasse 100 Mio."
            case .invalidChunk:
                return "Le bloc reçu est invalide ou dépasse 256 Kio."
            case .offsetMismatch:
                return "Le bloc ne commence pas à la position attendue."
            case .transferLimit:
                return "Trop de documents sont déjà en préparation."
            case .transferConflict:
                return "Ce transfert existe déjà avec d’autres métadonnées."
            case .transferNotFound:
                return "Ce transfert temporaire n’est plus disponible."
            case .transferUnsafe:
                return "Le fichier temporaire n’a pas pu être validé."
            case .transferIncomplete:
                return "Le document n’a pas encore été reçu entièrement."
            case .presentationBusy:
                return "Un autre document est déjà affiché."
            case .presentationUnavailable:
                return "L’écran natif ne peut pas afficher ce document maintenant."
            case .previewUnavailable:
                return "Ce type de fichier ne peut pas être prévisualisé sur cet iPhone."
            case .storageUnavailable:
                return "Le stockage temporaire sécurisé n’est pas disponible."
            }
        }

        var expectedOffset: Int64? {
            guard case let .offsetMismatch(offset) = self else { return nil }
            return offset
        }

        var receivedSize: Int64? {
            guard case let .transferIncomplete(size) = self else { return nil }
            return size
        }
    }

    override init() {
        super.init()
        // Un transfert ne doit pas survivre à un redémarrage de l’application.
        // Une simple reconstruction du processus WebKit conserve en revanche le
        // même bridge et peut reprendre au dernier offset acquitté.
        resetTemporaryRoot()
    }

    func handle(
        action: String,
        body: [String: Any],
        presentingFrom webView: WKWebView
    ) {
        guard let requestID = validatedUUID(body["request_id"]) else { return }
        let command = action.replacingOccurrences(
            of: "outgoingDocument.",
            with: "",
            options: [.anchored]
        )

        do {
            switch command {
            case "begin":
                try begin(body: body, requestID: requestID)
            case "append":
                try append(body: body, requestID: requestID)
            case "finish":
                try finish(body: body, requestID: requestID, webView: webView)
            case "cancel":
                try cancel(body: body, requestID: requestID)
            case "cleanup":
                try cleanup(body: body, requestID: requestID)
            default:
                throw BridgeError.invalidRequest
            }
        } catch let error as BridgeError {
            emitError(
                requestID: requestID,
                transferID: validatedUUID(body["transfer_id"]),
                action: command,
                error: error
            )
        } catch {
            emitError(
                requestID: requestID,
                transferID: validatedUUID(body["transfer_id"]),
                action: command,
                error: .storageUnavailable
            )
        }
    }

    private func begin(body: [String: Any], requestID: String) throws {
        guard let transferID = validatedUUID(body["transfer_id"]) else {
            throw BridgeError.invalidTransfer
        }
        guard let rawName = body["file_name"] as? String,
              let fileName = validatedFileName(rawName) else {
            throw BridgeError.invalidFileName
        }
        guard let rawMimeType = body["mime_type"] as? String,
              let mimeType = validatedMimeType(rawMimeType) else {
            throw BridgeError.invalidMimeType
        }
        guard let totalSize = exactInteger(body["total_size"]),
              (1...Self.maximumDocumentLength).contains(totalSize) else {
            throw BridgeError.invalidSize
        }

        let manifest = TransferManifest(
            version: 1,
            transferID: transferID,
            fileName: fileName,
            mimeType: mimeType,
            totalSize: totalSize
        )
        let root = try secureRoot()
        let directory = transferDirectory(transferID: transferID, root: root)

        if fileManager.fileExists(atPath: directory.path) {
            let existing = try loadTransfer(transferID: transferID)
            guard existing.manifest == manifest else {
                throw BridgeError.transferConflict
            }
            emitSuccess(
                requestID: requestID,
                transferID: transferID,
                action: "begin",
                state: existing.size == totalSize ? "ready" : "receiving",
                extra: transferProgress(existing.size, totalSize: totalSize)
            )
            return
        }

        guard try transferCount(in: root) < maximumTransfers else {
            throw BridgeError.transferLimit
        }

        do {
            try fileManager.createDirectory(
                at: directory,
                withIntermediateDirectories: false,
                attributes: [.protectionKey: FileProtectionType.complete]
            )
            excludeFromBackup(directory)
            let manifestURL = directory.appendingPathComponent(manifestName, isDirectory: false)
            let manifestData = try JSONEncoder().encode(manifest)
            guard manifestData.count <= maximumManifestLength else {
                throw BridgeError.invalidRequest
            }
            try manifestData.write(to: manifestURL, options: [.atomic])
            try fileManager.setAttributes(
                [.protectionKey: FileProtectionType.complete],
                ofItemAtPath: manifestURL.path
            )
            let payloadURL = try payloadURL(for: manifest, directory: directory)
            guard fileManager.createFile(
                atPath: payloadURL.path,
                contents: Data(),
                attributes: [.protectionKey: FileProtectionType.complete]
            ) else {
                throw BridgeError.storageUnavailable
            }
        } catch {
            try? fileManager.removeItem(at: directory)
            throw error
        }

        emitSuccess(
            requestID: requestID,
            transferID: transferID,
            action: "begin",
            state: "receiving",
            extra: transferProgress(0, totalSize: totalSize)
        )
    }

    private func append(body: [String: Any], requestID: String) throws {
        guard let transferID = validatedUUID(body["transfer_id"]) else {
            throw BridgeError.invalidTransfer
        }
        guard let requestedOffset = exactInteger(body["offset"]),
              requestedOffset >= 0,
              let encoded = body["data_base64"] as? String,
              !encoded.isEmpty,
              encoded.utf8.count <= Self.maximumBase64Length,
              let data = Data(base64Encoded: encoded),
              !data.isEmpty,
              data.count <= Self.maximumChunkLength,
              data.base64EncodedString() == encoded else {
            throw BridgeError.invalidChunk
        }

        let transfer = try loadTransfer(transferID: transferID)
        guard requestedOffset == transfer.size else {
            throw BridgeError.offsetMismatch(transfer.size)
        }
        guard transfer.size + Int64(data.count) <= transfer.manifest.totalSize else {
            throw BridgeError.invalidChunk
        }

        do {
            let handle = try FileHandle(forWritingTo: transfer.payloadURL)
            defer { try? handle.close() }
            try handle.seekToEnd()
            try handle.write(contentsOf: data)
            try handle.synchronize()
        } catch {
            throw BridgeError.storageUnavailable
        }

        let nextOffset = transfer.size + Int64(data.count)
        let verified = try validatedRegularFileSize(
            transfer.payloadURL,
            expectedParent: transfer.directory,
            maximum: transfer.manifest.totalSize
        )
        guard verified == nextOffset else { throw BridgeError.storageUnavailable }

        emitSuccess(
            requestID: requestID,
            transferID: transferID,
            action: "append",
            state: nextOffset == transfer.manifest.totalSize ? "ready" : "receiving",
            extra: transferProgress(nextOffset, totalSize: transfer.manifest.totalSize)
        )
    }

    private func finish(
        body: [String: Any],
        requestID: String,
        webView: WKWebView
    ) throws {
        guard let transferID = validatedUUID(body["transfer_id"]) else {
            throw BridgeError.invalidTransfer
        }
        guard activePresentation == nil else { throw BridgeError.presentationBusy }
        let mode = (body["mode"] as? String ?? "preview").lowercased()
        guard ["preview", "share", "save"].contains(mode) else {
            throw BridgeError.invalidRequest
        }

        let transfer = try loadTransfer(transferID: transferID)
        guard transfer.size == transfer.manifest.totalSize else {
            throw BridgeError.transferIncomplete(transfer.size)
        }
        guard let presenter = presentingViewController(for: webView) else {
            throw BridgeError.presentationUnavailable
        }

        if mode == "preview" {
            guard QLPreviewController.canPreview(transfer.payloadURL as NSURL) else {
                throw BridgeError.previewUnavailable
            }
            let preview = QLPreviewController()
            preview.dataSource = self
            preview.delegate = self
            preview.navigationItem.rightBarButtonItem = UIBarButtonItem(
                barButtonSystemItem: .done,
                target: self,
                action: #selector(closePreview)
            )
            let navigation = UINavigationController(rootViewController: preview)
            navigation.modalPresentationStyle = .pageSheet
            activePresentation = ActivePresentation(
                transferID: transferID,
                requestID: requestID,
                mode: mode,
                controller: navigation,
                cancelRequestID: nil
            )
            presenter.present(navigation, animated: true) { [weak self, weak navigation] in
                guard let self,
                      let navigation,
                      self.activePresentation?.controller === navigation else { return }
                navigation.presentationController?.delegate = self
                self.emitPresented(transfer: transfer, requestID: requestID, mode: mode)
            }
            return
        }

        let activity = UIActivityViewController(
            activityItems: [transfer.payloadURL],
            applicationActivities: nil
        )
        if let popover = activity.popoverPresentationController {
            popover.sourceView = webView
            popover.sourceRect = CGRect(
                x: webView.bounds.midX,
                y: webView.bounds.midY,
                width: 1,
                height: 1
            )
            popover.permittedArrowDirections = []
        }
        activity.completionWithItemsHandler = { [weak self] _, completed, _, error in
            DispatchQueue.main.async {
                self?.completePresentation(
                    transferID: transferID,
                    outcome: error == nil ? (completed ? "completed" : "cancelled") : "failed",
                    failed: error != nil
                )
            }
        }
        activePresentation = ActivePresentation(
            transferID: transferID,
            requestID: requestID,
            mode: mode,
            controller: activity,
            cancelRequestID: nil
        )
        presenter.present(activity, animated: true) { [weak self, weak activity] in
            guard let self,
                  let activity,
                  self.activePresentation?.controller === activity else { return }
            activity.presentationController?.delegate = self
            self.emitPresented(transfer: transfer, requestID: requestID, mode: mode)
        }
    }

    private func cancel(body: [String: Any], requestID: String) throws {
        guard let transferID = validatedUUID(body["transfer_id"]) else {
            throw BridgeError.invalidTransfer
        }
        if var presentation = activePresentation,
           presentation.transferID == transferID {
            presentation.cancelRequestID = requestID
            activePresentation = presentation
            presentation.controller.dismiss(animated: true) { [weak self] in
                self?.completePresentation(
                    transferID: transferID,
                    outcome: "cancelled",
                    failed: false
                )
            }
            return
        }

        try removeTransferIfPresent(transferID: transferID)
        emitSuccess(
            requestID: requestID,
            transferID: transferID,
            action: "cancel",
            state: "cancelled"
        )
    }

    private func cleanup(body: [String: Any], requestID: String) throws {
        guard let transferID = validatedUUID(body["transfer_id"]) else {
            throw BridgeError.invalidTransfer
        }
        if activePresentation?.transferID == transferID {
            throw BridgeError.presentationBusy
        }
        try removeTransferIfPresent(transferID: transferID)
        emitSuccess(
            requestID: requestID,
            transferID: transferID,
            action: "cleanup",
            state: "cleaned"
        )
    }

    private func emitPresented(
        transfer: LoadedTransfer,
        requestID: String,
        mode: String
    ) {
        emitSuccess(
            requestID: requestID,
            transferID: transfer.manifest.transferID,
            action: "finish",
            state: "presented",
            extra: transferProgress(
                transfer.manifest.totalSize,
                totalSize: transfer.manifest.totalSize
            ).merging(["mode": mode]) { _, new in new }
        )
    }

    private func completePresentation(
        transferID: String,
        outcome: String,
        failed: Bool
    ) {
        guard let presentation = activePresentation,
              presentation.transferID == transferID else { return }
        activePresentation = nil
        let cleaned = (try? removeTransferIfPresent(transferID: transferID)) != nil

        var detail: [String: Any] = [
            "request_id": presentation.requestID,
            "transfer_id": presentation.transferID,
            "mode": presentation.mode,
            "outcome": outcome,
            "cleaned": cleaned,
        ]
        if failed {
            detail["error"] = [
                "code": "presentation_failed",
                "message": "Le document n’a pas pu être transmis à l’application choisie.",
            ]
        } else if !cleaned {
            detail["error"] = [
                "code": "cleanup_failed",
                "message": "Le fichier temporaire n’a pas pu être supprimé immédiatement.",
            ]
        }
        emit(name: "maisonpilote:outgoing-document-presentation", detail: detail)

        if let cancelRequestID = presentation.cancelRequestID {
            emitSuccess(
                requestID: cancelRequestID,
                transferID: transferID,
                action: "cancel",
                state: "cancelled"
            )
        }
    }

    @objc private func closePreview() {
        guard let presentation = activePresentation,
              presentation.mode == "preview" else { return }
        presentation.controller.dismiss(animated: true) { [weak self] in
            self?.completePresentation(
                transferID: presentation.transferID,
                outcome: "dismissed",
                failed: false
            )
        }
    }

    private struct LoadedTransfer {
        let manifest: TransferManifest
        let directory: URL
        let payloadURL: URL
        let size: Int64
    }

    private func loadTransfer(transferID: String) throws -> LoadedTransfer {
        let root = try secureRoot()
        let directory = transferDirectory(transferID: transferID, root: root)
        let directoryValues: URLResourceValues
        do {
            directoryValues = try directory.resourceValues(forKeys: [
                .isDirectoryKey,
                .isSymbolicLinkKey,
            ])
        } catch {
            throw BridgeError.transferNotFound
        }
        guard directory.deletingLastPathComponent() == root,
              directoryValues.isDirectory == true,
              directoryValues.isSymbolicLink != true else {
            throw BridgeError.transferUnsafe
        }

        let manifestURL = directory.appendingPathComponent(manifestName, isDirectory: false)
        let manifestSize = try validatedRegularFileSize(
            manifestURL,
            expectedParent: directory,
            maximum: Int64(maximumManifestLength)
        )
        guard manifestSize > 0,
              let manifestData = boundedRead(manifestURL, maximum: maximumManifestLength),
              let manifest = try? JSONDecoder().decode(TransferManifest.self, from: manifestData),
              manifest.version == 1,
              manifest.transferID == transferID,
              validatedUUID(manifest.transferID) != nil,
              validatedFileName(manifest.fileName) == manifest.fileName,
              validatedMimeType(manifest.mimeType) == manifest.mimeType,
              (1...Self.maximumDocumentLength).contains(manifest.totalSize) else {
            throw BridgeError.transferUnsafe
        }

        let payloadURL = try payloadURL(for: manifest, directory: directory)
        let size = try validatedRegularFileSize(
            payloadURL,
            expectedParent: directory,
            maximum: manifest.totalSize
        )
        return LoadedTransfer(
            manifest: manifest,
            directory: directory,
            payloadURL: payloadURL,
            size: size
        )
    }

    private func payloadURL(
        for manifest: TransferManifest,
        directory: URL
    ) throws -> URL {
        guard let fileName = validatedFileName(manifest.fileName) else {
            throw BridgeError.invalidFileName
        }
        let target = directory.appendingPathComponent(fileName, isDirectory: false)
            .standardizedFileURL
        guard target.deletingLastPathComponent() == directory.standardizedFileURL,
              target.resolvingSymlinksInPath().deletingLastPathComponent()
                == directory.resolvingSymlinksInPath() else {
            throw BridgeError.transferUnsafe
        }
        return target
    }

    private func validatedRegularFileSize(
        _ url: URL,
        expectedParent: URL,
        maximum: Int64
    ) throws -> Int64 {
        guard url.standardizedFileURL.deletingLastPathComponent()
                == expectedParent.standardizedFileURL,
              url.resolvingSymlinksInPath().deletingLastPathComponent()
                == expectedParent.resolvingSymlinksInPath() else {
            throw BridgeError.transferUnsafe
        }
        let values: URLResourceValues
        do {
            values = try url.resourceValues(forKeys: [
                .isRegularFileKey,
                .isSymbolicLinkKey,
                .fileSizeKey,
            ])
        } catch {
            throw BridgeError.transferNotFound
        }
        guard values.isRegularFile == true,
              values.isSymbolicLink != true,
              let rawSize = values.fileSize else {
            throw BridgeError.transferUnsafe
        }
        let size = Int64(rawSize)
        guard size >= 0, size <= maximum else { throw BridgeError.transferUnsafe }
        return size
    }

    private func boundedRead(_ url: URL, maximum: Int) -> Data? {
        do {
            let handle = try FileHandle(forReadingFrom: url)
            defer { try? handle.close() }
            guard let data = try handle.read(upToCount: maximum + 1),
                  data.count <= maximum else { return nil }
            return data
        } catch {
            return nil
        }
    }

    private func removeTransferIfPresent(transferID: String) throws {
        let root = try secureRoot()
        let directory = transferDirectory(transferID: transferID, root: root)
        guard fileManager.fileExists(atPath: directory.path) else { return }
        guard directory.deletingLastPathComponent() == root else {
            throw BridgeError.transferUnsafe
        }
        let values = try directory.resourceValues(forKeys: [
            .isDirectoryKey,
            .isSymbolicLinkKey,
        ])
        guard values.isDirectory == true, values.isSymbolicLink != true else {
            throw BridgeError.transferUnsafe
        }
        try fileManager.removeItem(at: directory)
    }

    private var temporaryRoot: URL {
        fileManager.temporaryDirectory
            .appendingPathComponent("MaisonPiloteOutgoingDocuments", isDirectory: true)
            .standardizedFileURL
    }

    private func secureRoot() throws -> URL {
        let root = temporaryRoot
        let parent = fileManager.temporaryDirectory.standardizedFileURL
        guard root.deletingLastPathComponent() == parent,
              root.lastPathComponent == "MaisonPiloteOutgoingDocuments" else {
            throw BridgeError.storageUnavailable
        }
        if !fileManager.fileExists(atPath: root.path) {
            try fileManager.createDirectory(
                at: root,
                withIntermediateDirectories: false,
                attributes: [.protectionKey: FileProtectionType.complete]
            )
            excludeFromBackup(root)
        }
        let values = try root.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
        guard values.isDirectory == true, values.isSymbolicLink != true else {
            throw BridgeError.storageUnavailable
        }
        return root
    }

    private func resetTemporaryRoot() {
        let root = temporaryRoot
        let parent = fileManager.temporaryDirectory.standardizedFileURL
        guard root.deletingLastPathComponent() == parent,
              root.lastPathComponent == "MaisonPiloteOutgoingDocuments" else { return }
        if fileManager.fileExists(atPath: root.path) {
            try? fileManager.removeItem(at: root)
        }
        _ = try? secureRoot()
    }

    private func transferDirectory(transferID: String, root: URL) -> URL {
        root.appendingPathComponent(transferID, isDirectory: true).standardizedFileURL
    }

    private func transferCount(in root: URL) throws -> Int {
        let candidates = try fileManager.contentsOfDirectory(
            at: root,
            includingPropertiesForKeys: [.isDirectoryKey, .isSymbolicLinkKey],
            options: [.skipsHiddenFiles]
        )
        return candidates.filter { candidate in
            guard candidate.deletingLastPathComponent() == root,
                  validatedUUID(candidate.lastPathComponent) != nil,
                  let values = try? candidate.resourceValues(forKeys: [
                    .isDirectoryKey,
                    .isSymbolicLinkKey,
                  ]) else { return false }
            return values.isDirectory == true && values.isSymbolicLink != true
        }.count
    }

    private func validatedUUID(_ value: Any?) -> String? {
        guard let value = value as? String,
              value.count == 36,
              let uuid = UUID(uuidString: value),
              uuid.uuidString.lowercased() == value.lowercased() else { return nil }
        return value.lowercased()
    }

    private func validatedFileName(_ value: String) -> String? {
        guard value == value.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty,
              value.utf8.count <= 180,
              value != ".",
              value != "..",
              value.lowercased() != manifestName,
              !value.hasPrefix("."),
              !value.contains("/"),
              !value.contains("\\"),
              !value.contains(":"),
              !value.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains),
              URL(fileURLWithPath: value).lastPathComponent == value else { return nil }
        return value
    }

    private func validatedMimeType(_ value: String) -> String? {
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard value == normalized,
              !normalized.isEmpty,
              normalized.utf8.count <= 128 else { return nil }
        let parts = normalized.split(separator: "/", omittingEmptySubsequences: false)
        guard parts.count == 2,
              parts.allSatisfy({ !$0.isEmpty && $0.allSatisfy(Self.isMimeTokenCharacter) }) else {
            return nil
        }
        return normalized
    }

    private static func isMimeTokenCharacter(_ character: Character) -> Bool {
        character.isASCII && (character.isLetter || character.isNumber
            || "!#$&^_.+-".contains(character))
    }

    private func exactInteger(_ value: Any?) -> Int64? {
        guard let number = value as? NSNumber,
              String(cString: number.objCType) != "c" else { return nil }
        let candidate = number.doubleValue
        guard candidate.isFinite,
              candidate.rounded(.towardZero) == candidate,
              candidate >= 0,
              candidate <= Double(Int64.max) else { return nil }
        return number.int64Value
    }

    private func excludeFromBackup(_ url: URL) {
        var mutableURL = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? mutableURL.setResourceValues(values)
    }

    private func presentingViewController(for webView: WKWebView) -> UIViewController? {
        guard webView.window != nil else { return nil }
        var responder: UIResponder? = webView
        var candidate: UIViewController?
        while let current = responder {
            if let controller = current as? UIViewController {
                candidate = controller
                break
            }
            responder = current.next
        }
        guard var presenter = candidate else { return nil }
        while let presented = presenter.presentedViewController,
              !presented.isBeingDismissed {
            presenter = presented
        }
        guard presenter.viewIfLoaded?.window != nil,
              !presenter.isBeingDismissed,
              !presenter.isBeingPresented else { return nil }
        return presenter
    }

    private func transferProgress(_ offset: Int64, totalSize: Int64) -> [String: Any] {
        [
            "next_offset": offset,
            "total_size": totalSize,
            "max_chunk_size": Self.maximumChunkLength,
        ]
    }

    private func emitSuccess(
        requestID: String,
        transferID: String,
        action: String,
        state: String,
        extra: [String: Any] = [:]
    ) {
        var detail: [String: Any] = [
            "request_id": requestID,
            "transfer_id": transferID,
            "action": action,
            "success": true,
            "state": state,
        ]
        detail.merge(extra) { _, new in new }
        emit(name: "maisonpilote:outgoing-document-result", detail: detail)
    }

    private func emitError(
        requestID: String,
        transferID: String?,
        action: String,
        error: BridgeError
    ) {
        var detail: [String: Any] = [
            "request_id": requestID,
            "action": action,
            "success": false,
            "error": [
                "code": error.code,
                "message": error.message,
            ],
        ]
        if let transferID { detail["transfer_id"] = transferID }
        if let expectedOffset = error.expectedOffset {
            detail["expected_offset"] = expectedOffset
        }
        if let receivedSize = error.receivedSize {
            detail["received_size"] = receivedSize
        }
        emit(name: "maisonpilote:outgoing-document-result", detail: detail)
    }

    private func emit(name: String, detail: [String: Any]) {
        delegate?.outgoingDocumentBridge(self, emit: name, detail: detail)
    }

    private static var maximumBase64Length: Int {
        4 * ((maximumChunkLength + 2) / 3)
    }
}

extension OutgoingDocumentBridge: QLPreviewControllerDataSource, QLPreviewControllerDelegate {
    func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
        activePresentation == nil ? 0 : 1
    }

    func previewController(
        _ controller: QLPreviewController,
        previewItemAt index: Int
    ) -> QLPreviewItem {
        guard index == 0,
              let transferID = activePresentation?.transferID,
              let transfer = try? loadTransfer(transferID: transferID) else {
            return temporaryRoot as NSURL
        }
        return transfer.payloadURL as NSURL
    }

    func previewControllerDidDismiss(_ controller: QLPreviewController) {
        guard let presentation = activePresentation,
              presentation.mode == "preview" else { return }
        completePresentation(
            transferID: presentation.transferID,
            outcome: "dismissed",
            failed: false
        )
    }
}

extension OutgoingDocumentBridge: UIAdaptivePresentationControllerDelegate {
    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        guard let presentation = activePresentation,
              presentation.controller === presentationController.presentedViewController else {
            return
        }
        completePresentation(
            transferID: presentation.transferID,
            outcome: presentation.mode == "preview" ? "dismissed" : "cancelled",
            failed: false
        )
    }
}
