import Foundation
import ImageIO
import UniformTypeIdentifiers

/// Shared by the extension and the app. Final, unsent batches never expire.
enum SharedInboxStorage {
    static let maximumFileBytes: Int64 = 20 * 1024 * 1024
    static let maximumInboxBytes: Int64 = 1024 * 1024 * 1024

    enum Failure: Error {
        case unavailable, fileTooLarge, inboxFull, invalidImage, unsafeFile
        var message: String {
            switch self {
            case .unavailable: return "Le stockage protégé de cet iPhone est indisponible."
            case .fileTooLarge: return "Ce fichier dépasse la limite de 20 Mio."
            case .inboxFull: return "Les fichiers en attente occupent 1 Gio. Transmettez ou retirez des partages avant de continuer."
            case .invalidImage: return "Cette photo n’a pas pu être convertie en JPEG. Le fichier original reste dans l’application d’origine."
            case .unsafeFile: return "Ce fichier ne peut pas être copié en sécurité."
            }
        }
    }

    static func root(named name: String = "SharedInbox") throws -> URL {
        guard let container = SharedContainer.containerURL else { throw Failure.unavailable }
        let root = container.appendingPathComponent(name, isDirectory: true)
        try createProtectedDirectory(root)
        return root
    }

    static func createProtectedDirectory(_ url: URL) throws {
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.complete])
        let values = try url.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
        guard values.isDirectory == true, values.isSymbolicLink != true else { throw Failure.unsafeFile }
        try protect(url)
    }

    static func protect(_ url: URL) throws {
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: url.path)
        var mutableURL = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try mutableURL.setResourceValues(values)
    }

    static func validateSpace(for size: Int64) throws {
        guard size > 0, size <= maximumFileBytes else { throw Failure.fileTooLarge }
        var total: Int64 = 0
        for name in ["SharedInbox", "CaptureStaging"] {
            let root = try root(named: name)
            guard let enumerator = FileManager.default.enumerator(at: root,
                includingPropertiesForKeys: [.fileSizeKey, .isRegularFileKey, .isSymbolicLinkKey]) else { continue }
            for case let url as URL in enumerator {
                let values = try url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey, .isSymbolicLinkKey])
                if values.isSymbolicLink == true { enumerator.skipDescendants(); continue }
                if values.isRegularFile == true { total += Int64(values.fileSize ?? 0) }
                if total + size > maximumInboxBytes { throw Failure.inboxFull }
            }
        }
    }

    static func isHEIC(_ url: URL, mimeType: String = "") -> Bool {
        ["heic", "heif"].contains(url.pathExtension.lowercased())
            || ["image/heic", "image/heif"].contains(mimeType.lowercased())
    }

    static func jpeg(from source: URL, to destination: URL) throws {
        let values = try source.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey, .isSymbolicLinkKey])
        guard values.isRegularFile == true, values.isSymbolicLink != true,
              Int64(values.fileSize ?? 0) <= maximumFileBytes else { throw Failure.unsafeFile }
        guard let input = CGImageSourceCreateWithURL(source as CFURL,
                    [kCGImageSourceShouldCache: false] as CFDictionary),
              let bitmap = CGImageSourceCreateThumbnailAtIndex(input, 0, [
                    kCGImageSourceCreateThumbnailFromImageAlways: true,
                    kCGImageSourceCreateThumbnailWithTransform: true,
                    kCGImageSourceThumbnailMaxPixelSize: 3000,
                    kCGImageSourceShouldCacheImmediately: true,
              ] as CFDictionary),
              let output = CGImageDestinationCreateWithURL(destination as CFURL, UTType.jpeg.identifier as CFString, 1, nil)
        else { throw Failure.invalidImage }
        CGImageDestinationAddImage(output, bitmap, [kCGImageDestinationLossyCompressionQuality: 0.92] as CFDictionary)
        guard CGImageDestinationFinalize(output) else {
            try? FileManager.default.removeItem(at: destination)
            throw Failure.invalidImage
        }
        try protect(destination)
    }

    static func maintain() {
        let threshold = Date().addingTimeInterval(-7 * 24 * 60 * 60)
        for name in ["SharedInbox", "CaptureStaging"] {
            guard let root = try? root(named: name),
                  let directories = try? FileManager.default.contentsOfDirectory(at: root,
                    includingPropertiesForKeys: [.contentModificationDateKey, .isDirectoryKey, .isSymbolicLinkKey]) else { continue }
            for directory in directories {
                guard UUID(uuidString: directory.lastPathComponent) != nil,
                      let values = try? directory.resourceValues(forKeys: [.contentModificationDateKey, .isDirectoryKey, .isSymbolicLinkKey]),
                      values.isDirectory == true, values.isSymbolicLink != true else { continue }
                try? protect(directory)
                let manifest = directory.appendingPathComponent("payload.json")
                let manifestSize = (try? manifest.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0
                let batch = (1...(256 * 1024)).contains(manifestSize)
                    ? (try? Data(contentsOf: manifest)).flatMap { try? JSONDecoder().decode(ShareInboxBatch.self, from: $0) } : nil
                // Completed imports are kept until an explicit user discard or a server ACK.
                if name == "SharedInbox", FileManager.default.fileExists(atPath: manifest.path), batch?.purpose != "image_conversion" {
                    if let files = try? FileManager.default.contentsOfDirectory(at: directory,
                        includingPropertiesForKeys: [.isRegularFileKey, .isSymbolicLinkKey]) {
                        for file in files {
                            if let values = try? file.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey]),
                               values.isRegularFile == true, values.isSymbolicLink != true { try? protect(file) }
                        }
                    }
                    continue
                }
                if let date = values.contentModificationDate, date < threshold {
                    try? FileManager.default.removeItem(at: directory)
                }
            }
        }
    }
}
