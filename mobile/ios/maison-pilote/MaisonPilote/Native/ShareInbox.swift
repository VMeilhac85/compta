import Foundation

struct ShareInboxPublicFile: Encodable {
    let id: String
    let displayName: String
    let mimeType: String
    let size: Int64
}

struct ShareInboxPublicBatch: Encodable {
    let id: String
    let createdAtUTC: String
    let files: [ShareInboxPublicFile]
}

struct ShareInboxChunk {
    let batchID: String
    let fileID: String
    let offset: Int64
    let nextOffset: Int64
    let totalSize: Int64
    let data: Data

    var isEOF: Bool { nextOffset == totalSize }
}

enum ShareInboxReadError: Error {
    case invalidRequest
    case authenticationRequired
    case inboxUnavailable
    case batchNotFound
    case fileNotFound
    case unsafeFile
    case fileChanged
    case readFailed

    var code: String {
        switch self {
        case .invalidRequest: return "invalid_request"
        case .authenticationRequired: return "authentication_required"
        case .inboxUnavailable: return "inbox_unavailable"
        case .batchNotFound: return "batch_not_found"
        case .fileNotFound: return "file_not_found"
        case .unsafeFile: return "unsafe_file"
        case .fileChanged: return "file_changed"
        case .readFailed: return "read_failed"
        }
    }

    var message: String {
        switch self {
        case .invalidRequest:
            return "La demande de lecture du partage est invalide."
        case .authenticationRequired:
            return "Reconnectez-vous à Maison Pilote pour transmettre ce partage."
        case .inboxUnavailable:
            return "La boîte de partage Maison Pilote n’est pas disponible."
        case .batchNotFound:
            return "Ce partage n’est plus disponible."
        case .fileNotFound:
            return "Ce fichier partagé n’est plus disponible."
        case .unsafeFile:
            return "Le fichier partagé n’a pas pu être validé."
        case .fileChanged:
            return "Le fichier partagé a changé depuis sa préparation."
        case .readFailed:
            return "Le fichier partagé n’a pas pu être lu."
        }
    }
}

final class ShareInbox {
    static let maximumChunkLength = 512 * 1024

    private let fileManager = FileManager.default
    private let maximumManifestLength = 256 * 1024
    private let maximumFilesPerBatch = 20

    func batches() -> [ShareInboxBatch] {
        guard let root = inboxRoot(create: false),
              let directories = try? fileManager.contentsOfDirectory(
                at: root,
                includingPropertiesForKeys: [.isDirectoryKey, .isSymbolicLinkKey],
                options: [.skipsHiddenFiles]
              ) else { return [] }

        return directories.compactMap { directory in
            try? loadBatch(batchID: directory.lastPathComponent, root: root)
        }
        .sorted { $0.createdAtUTC > $1.createdAtUTC }
    }

    func publicBatches() -> [ShareInboxPublicBatch] {
        batches().map { batch in
            ShareInboxPublicBatch(
                id: batch.id,
                createdAtUTC: batch.createdAtUTC,
                files: batch.files.map { file in
                    ShareInboxPublicFile(
                        id: file.id,
                        displayName: file.displayName,
                        mimeType: file.mimeType,
                        size: file.size
                    )
                }
            )
        }
    }

    func readChunk(
        batchID: String,
        fileID: String,
        offset: Int64,
        maximumLength: Int
    ) throws -> ShareInboxChunk {
        guard UUID(uuidString: batchID) != nil,
              UUID(uuidString: fileID) != nil,
              offset >= 0,
              (1...Self.maximumChunkLength).contains(maximumLength) else {
            throw ShareInboxReadError.invalidRequest
        }
        guard let root = inboxRoot(create: false) else {
            throw ShareInboxReadError.inboxUnavailable
        }

        let batch: ShareInboxBatch
        do {
            batch = try loadBatch(batchID: batchID, root: root)
        } catch let error as ShareInboxReadError {
            throw error
        } catch {
            throw ShareInboxReadError.batchNotFound
        }
        guard let file = batch.files.first(where: { $0.id == fileID }) else {
            throw ShareInboxReadError.fileNotFound
        }
        guard offset <= file.size else {
            throw ShareInboxReadError.invalidRequest
        }

        let batchDirectory = try validatedBatchDirectory(batchID: batchID, root: root)
        let target = batchDirectory
            .appendingPathComponent(file.relativePath, isDirectory: false)
            .standardizedFileURL
        guard target.deletingLastPathComponent() == batchDirectory.standardizedFileURL,
              target.resolvingSymlinksInPath().deletingLastPathComponent()
                == batchDirectory.resolvingSymlinksInPath() else {
            throw ShareInboxReadError.unsafeFile
        }

        let values: URLResourceValues
        do {
            values = try target.resourceValues(forKeys: [
                .isRegularFileKey,
                .isSymbolicLinkKey,
                .fileSizeKey,
            ])
        } catch {
            throw ShareInboxReadError.fileNotFound
        }
        guard values.isRegularFile == true, values.isSymbolicLink != true else {
            throw ShareInboxReadError.unsafeFile
        }
        guard Int64(values.fileSize ?? -1) == file.size else {
            throw ShareInboxReadError.fileChanged
        }

        let remaining = file.size - offset
        let requestedLength = Int(min(Int64(maximumLength), remaining))
        if requestedLength == 0 {
            return ShareInboxChunk(
                batchID: batch.id,
                fileID: file.id,
                offset: offset,
                nextOffset: offset,
                totalSize: file.size,
                data: Data()
            )
        }

        do {
            let handle = try FileHandle(forReadingFrom: target)
            defer { try? handle.close() }
            try handle.seek(toOffset: UInt64(offset))
            let data = try handle.read(upToCount: requestedLength) ?? Data()
            guard data.count == requestedLength else {
                throw ShareInboxReadError.fileChanged
            }
            return ShareInboxChunk(
                batchID: batch.id,
                fileID: file.id,
                offset: offset,
                nextOffset: offset + Int64(data.count),
                totalSize: file.size,
                data: data
            )
        } catch let error as ShareInboxReadError {
            throw error
        } catch {
            throw ShareInboxReadError.readFailed
        }
    }

    @discardableResult
    func discard(batchID: String) -> Bool {
        guard UUID(uuidString: batchID) != nil,
              let root = inboxRoot(create: false) else { return false }
        do {
            let target = try validatedBatchDirectory(batchID: batchID, root: root)
            try fileManager.removeItem(at: target)
            return true
        } catch {
            return false
        }
    }

    private func loadBatch(batchID: String, root: URL) throws -> ShareInboxBatch {
        let directory = try validatedBatchDirectory(batchID: batchID, root: root)
        let payloadURL = directory.appendingPathComponent("payload.json", isDirectory: false)
        let values: URLResourceValues
        do {
            values = try payloadURL.resourceValues(forKeys: [
                .isRegularFileKey,
                .isSymbolicLinkKey,
                .fileSizeKey,
            ])
        } catch {
            throw ShareInboxReadError.batchNotFound
        }
        guard values.isRegularFile == true,
              values.isSymbolicLink != true,
              let payloadSize = values.fileSize,
              (1...maximumManifestLength).contains(payloadSize),
              let payload = readManifest(at: payloadURL, expectedSize: payloadSize),
              let batch = try? JSONDecoder().decode(ShareInboxBatch.self, from: payload),
              batch.id == batchID,
              UUID(uuidString: batch.id) != nil,
              !batch.createdAtUTC.isEmpty,
              batch.createdAtUTC.count <= 64,
              (1...maximumFilesPerBatch).contains(batch.files.count) else {
            throw ShareInboxReadError.batchNotFound
        }

        var fileIDs = Set<String>()
        for file in batch.files {
            guard UUID(uuidString: file.id) != nil,
                  fileIDs.insert(file.id).inserted,
                  !file.displayName.isEmpty,
                  file.displayName.count <= 180,
                  !file.mimeType.isEmpty,
                  file.mimeType.count <= 128,
                  file.size > 0,
                  isSafeRelativeFilename(file.relativePath) else {
                throw ShareInboxReadError.unsafeFile
            }
        }
        return batch
    }

    private func validatedBatchDirectory(batchID: String, root: URL) throws -> URL {
        guard UUID(uuidString: batchID) != nil else {
            throw ShareInboxReadError.invalidRequest
        }
        let target = root.appendingPathComponent(batchID, isDirectory: true).standardizedFileURL
        guard target.deletingLastPathComponent() == root.standardizedFileURL else {
            throw ShareInboxReadError.unsafeFile
        }
        let values: URLResourceValues
        do {
            values = try target.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
        } catch {
            throw ShareInboxReadError.batchNotFound
        }
        guard values.isDirectory == true, values.isSymbolicLink != true else {
            throw ShareInboxReadError.unsafeFile
        }
        return target
    }

    private func isSafeRelativeFilename(_ value: String) -> Bool {
        guard !value.isEmpty,
              value.count <= 255,
              value != ".",
              value != "..",
              !value.contains("/"),
              !value.contains("\\"),
              !value.contains("\0") else { return false }
        return URL(fileURLWithPath: value).lastPathComponent == value
    }

    private func readManifest(at url: URL, expectedSize: Int) -> Data? {
        guard expectedSize > 0, expectedSize <= maximumManifestLength else { return nil }
        do {
            let handle = try FileHandle(forReadingFrom: url)
            defer { try? handle.close() }
            guard let data = try handle.read(upToCount: maximumManifestLength + 1),
                  data.count == expectedSize else { return nil }
            return data
        } catch {
            return nil
        }
    }

    private func inboxRoot(create: Bool) -> URL? {
        guard let container = SharedContainer.containerURL else { return nil }
        let root = container.appendingPathComponent("SharedInbox", isDirectory: true).standardizedFileURL
        if create {
            try? fileManager.createDirectory(at: root, withIntermediateDirectories: true)
        }
        guard let values = try? root.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey]),
              values.isDirectory == true,
              values.isSymbolicLink != true else { return nil }
        return root.standardizedFileURL
    }
}
