import Foundation

/// Receives already user-confirmed captures in bounded chunks. No network work occurs here.
@MainActor
final class NativeCaptureStore {
    private struct Manifest: Codable, Equatable {
        let batchID: String
        let fileID: String
        let fileName: String
        let mimeType: String
        let totalSize: Int64
        let context: ShareInboxContext
        let purpose: String
        let forceJPEG: Bool
    }

    enum Failure: Error {
        case invalid, missing, contextChanged, incomplete, offset(Int64)
        var message: String {
            switch self {
            case .invalid: return "La capture ne peut pas être conservée : les informations reçues sont invalides."
            case .missing: return "La capture en préparation n’est plus disponible."
            case .contextChanged: return "Le compte ou l’entreprise a changé. Revenez au contexte de cette capture."
            case .incomplete: return "La capture n’a pas encore été reçue entièrement sur l’iPhone."
            case .offset: return "Un bloc de la capture doit être retransmis."
            }
        }
    }

    init() { SharedInboxStorage.maintain() }

    static func context(scope: String, dossierID: Int64, ownerID: String,
                        type: String = "shared_file", contextID: Int64? = nil, folderID: Int64? = nil,
                        allowNoDossier: Bool = false) throws -> ShareInboxContext {
        let parts = scope.split(separator: ":", omittingEmptySubsequences: false)
        let types = ["missing_item", "task", "expense_report", "absence", "mileage_registration",
                     "quick_action", "documents", "documents_folder", "shared_file", "shared_file_folder", "personal_documents"]
        guard scope.utf8.count <= 256, parts.count == 4, String(parts[0]) == ownerID,
              !scope.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains),
              Int64(parts[1]).map({ $0 > 0 }) == true, dossierID >= (allowNoDossier ? 0 : 1), Int64(parts[3]) == dossierID,
              types.contains(type), contextID.map({ $0 > 0 }) ?? true, folderID.map({ $0 > 0 }) ?? true else {
            throw Failure.contextChanged
        }
        return ShareInboxContext(identityScope: scope, dossierId: dossierID,
                                 contextType: type, contextId: contextID, folderId: folderID)
    }

    func handle(action: String, body: [String: Any], ownerID: String) throws -> [String: Any] {
        guard let rawID = body["batchId"] as? String, let id = UUID(uuidString: rawID)?.uuidString.lowercased() else { throw Failure.invalid }
        let root = try SharedInboxStorage.root(named: "CaptureStaging")
        let directory = root.appendingPathComponent(id, isDirectory: true)
        let manifestURL = directory.appendingPathComponent("capture.json")
        let payloadURL = directory.appendingPathComponent("capture.part")
        let finalRoot = try SharedInboxStorage.root()
        let finalDirectory = finalRoot.appendingPathComponent(id, isDirectory: true)
        let finalManifestURL = finalDirectory.appendingPathComponent("payload.json")
        if FileManager.default.fileExists(atPath: finalManifestURL.path) {
            guard let count = try? size(of: finalManifestURL), (1...262_144).contains(count),
                  let data = try? Data(contentsOf: finalManifestURL),
                  let batch = try? JSONDecoder().decode(ShareInboxBatch.self, from: data), batch.id == id,
                  batch.confirmedContext?.ownerID == ownerID else { throw Failure.contextChanged }
            if action == "capture.begin", body["identityScope"] as? String != batch.confirmedContext?.identityScope {
                throw Failure.contextChanged
            }
            if action == "capture.cancel" { return ["batch_id": id, "cancelled": false, "already_finalized": true] }
            guard ["capture.begin", "capture.finish"].contains(action) else { throw Failure.invalid }
            return try completedResult(batch)
        }
        if action == "capture.begin" {
            guard let scope = body["identityScope"] as? String, let dossierID = integer(body["dossierId"]),
                  let filename = body["fileName"] as? String, !filename.isEmpty, filename.utf8.count <= 180,
                  filename != ".", filename != "..", !filename.contains("/"), !filename.contains("\\"),
                  !filename.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains),
                  let mime = body["mimeType"] as? String, mime.range(of: "^[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+$", options: .regularExpression) != nil,
                  let total = integer(body["totalSize"]), (1...SharedInboxStorage.maximumFileBytes).contains(total) else { throw Failure.invalid }
            let purpose = (body["purpose"] as? String) ?? "capture"
            guard ["capture", "image_conversion"].contains(purpose) else { throw Failure.invalid }
            let type = (body["contextType"] as? String) ?? "quick_action"
            let context = try Self.context(scope: scope, dossierID: dossierID, ownerID: ownerID, type: type,
                contextID: integer(body["contextId"]).flatMap { $0 > 0 ? $0 : nil },
                folderID: integer(body["folderId"]).flatMap { $0 > 0 ? $0 : nil },
                allowNoDossier: purpose == "image_conversion" || type == "personal_documents")
            let existing = try? load(at: manifestURL)
            let manifest = Manifest(batchID: id, fileID: existing?.fileID ?? UUID().uuidString.lowercased(),
                fileName: filename, mimeType: mime, totalSize: total, context: context, purpose: purpose,
                forceJPEG: (body["forceJPEG"] as? Bool) ?? false)
            if let existing {
                guard existing == manifest else { throw Failure.contextChanged }
                return ["batch_id": id, "next_offset": try size(of: payloadURL)]
            }
            try SharedInboxStorage.validateSpace(for: total)
            try SharedInboxStorage.createProtectedDirectory(directory)
            try JSONEncoder().encode(manifest).write(to: manifestURL, options: [.atomic, .completeFileProtection])
            try Data().write(to: payloadURL, options: [.atomic, .completeFileProtection])
            return ["batch_id": id, "next_offset": 0]
        }
        let manifest = try load(at: manifestURL)
        guard manifest.batchID == id, manifest.context.ownerID == ownerID else { throw Failure.contextChanged }
        if action == "capture.cancel" {
            try FileManager.default.removeItem(at: directory)
            return ["batch_id": id, "cancelled": true]
        }
        if action == "capture.append" {
            guard let offset = integer(body["offset"]), let encoded = body["dataBase64"] as? String,
                  encoded.utf8.count <= 4 * ((512 * 1024 + 2) / 3),
                  let data = Data(base64Encoded: encoded), !data.isEmpty, data.count <= 512 * 1024 else { throw Failure.invalid }
            let currentSize = try size(of: payloadURL)
            guard offset == currentSize else { throw Failure.offset(currentSize) }
            guard offset + Int64(data.count) <= manifest.totalSize else { throw Failure.invalid }
            try SharedInboxStorage.validateSpace(for: Int64(data.count))
            let handle = try FileHandle(forWritingTo: payloadURL)
            defer { try? handle.close() }
            try handle.seekToEnd()
            try handle.write(contentsOf: data)
            try handle.synchronize()
            return ["batch_id": id, "next_offset": offset + Int64(data.count)]
        }
        guard action == "capture.finish", try size(of: payloadURL) == manifest.totalSize else { throw Failure.incomplete }
        try SharedInboxStorage.validateSpace(for: manifest.totalSize)
        try SharedInboxStorage.createProtectedDirectory(finalDirectory)
        var name = manifest.fileName
        var mime = manifest.mimeType
        let converted = manifest.forceJPEG || SharedInboxStorage.isHEIC(URL(fileURLWithPath: name), mimeType: mime)
        if converted { name = (name as NSString).deletingPathExtension + ".jpg"; mime = "image/jpeg" }
        let storedName = manifest.fileID + "." + ((name as NSString).pathExtension.isEmpty ? "bin" : (name as NSString).pathExtension)
        let target = finalDirectory.appendingPathComponent(storedName)
        if converted { try SharedInboxStorage.jpeg(from: payloadURL, to: target) }
        else {
            if FileManager.default.fileExists(atPath: target.path) { try FileManager.default.removeItem(at: target) }
            try FileManager.default.copyItem(at: payloadURL, to: target)
            try SharedInboxStorage.protect(target)
        }
        let batch = ShareInboxBatch(id: id, createdAtUTC: ISO8601DateFormatter().string(from: Date()),
            files: [ShareInboxFile(id: manifest.fileID, displayName: name, mimeType: mime, relativePath: storedName, size: try size(of: target))],
            intakeResult: nil, confirmedContext: manifest.context, purpose: manifest.purpose, sourceSize: manifest.totalSize)
        try JSONEncoder().encode(batch).write(to: finalDirectory.appendingPathComponent("payload.json"), options: [.atomic, .completeFileProtection])
        try? FileManager.default.removeItem(at: directory)
        return try completedResult(batch)
    }

    private func completedResult(_ batch: ShareInboxBatch) throws -> [String: Any] {
        let object = try JSONSerialization.jsonObject(with: JSONEncoder().encode(ShareInbox.publicBatch(batch)))
        return ["batch_id": batch.id, "batch": object, "next_offset": batch.sourceSize ?? batch.files.first?.size ?? 0]
    }

    private func load(at url: URL) throws -> Manifest {
        guard let count = try? size(of: url), (1...8192).contains(count),
              let data = try? Data(contentsOf: url), let manifest = try? JSONDecoder().decode(Manifest.self, from: data) else { throw Failure.missing }
        return manifest
    }

    private func size(of url: URL) throws -> Int64 {
        let values = try url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey, .isSymbolicLinkKey])
        guard values.isRegularFile == true, values.isSymbolicLink != true else { throw Failure.invalid }
        return Int64(values.fileSize ?? 0)
    }

    private func integer(_ input: Any?) -> Int64? {
        guard let value = input as? NSNumber, String(cString: value.objCType) != "c",
              value.doubleValue.isFinite, value.doubleValue.rounded(.towardZero) == value.doubleValue,
              value.doubleValue >= 0, value.doubleValue < Double(Int64.max) else { return nil }
        return value.int64Value
    }
}
