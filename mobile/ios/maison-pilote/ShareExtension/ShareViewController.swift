import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private let statusLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private var importStarted = false

    override func loadView() {
        let root = UIView()
        root.backgroundColor = .systemBackground

        statusLabel.text = "Préparation du partage vers Maison Pilote…"
        statusLabel.font = .preferredFont(forTextStyle: .body)
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0

        spinner.startAnimating()
        let stack = UIStackView(arrangedSubviews: [spinner, statusLabel])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: root.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: root.trailingAnchor, constant: -24),
            stack.centerXAnchor.constraint(equalTo: root.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: root.centerYAnchor),
        ])
        view = root
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !importStarted else { return }
        importStarted = true
        Task { await importSharedItems() }
    }

    @MainActor
    private func importSharedItems() async {
        guard let container = SharedContainer.containerURL else {
            finishWithError("Le groupe de partage Maison Pilote n’est pas configuré.")
            return
        }
        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? [])
            .flatMap { $0.attachments ?? [] }
        guard !providers.isEmpty else {
            finishWithError("Aucun fichier compatible n’a été reçu.")
            return
        }

        let batchID = UUID().uuidString.lowercased()
        let root = container.appendingPathComponent("SharedInbox", isDirectory: true)
        let batchDirectory = root.appendingPathComponent(batchID, isDirectory: true)
        do {
            try FileManager.default.createDirectory(
                at: batchDirectory,
                withIntermediateDirectories: true
            )
        } catch {
            finishWithError("Le partage ne peut pas être préparé sur cet iPhone.")
            return
        }

        var files: [ShareInboxFile] = []
        for provider in providers.prefix(20) {
            if let file = await importProvider(provider, into: batchDirectory) {
                files.append(file)
            }
        }
        guard !files.isEmpty else {
            try? FileManager.default.removeItem(at: batchDirectory)
            finishWithError("Aucun fichier compatible n’a pu être préparé.")
            return
        }

        let batch = ShareInboxBatch(
            id: batchID,
            createdAtUTC: ISO8601DateFormatter().string(from: Date()),
            files: files
        )
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.sortedKeys]
            try encoder.encode(batch).write(
                to: batchDirectory.appendingPathComponent("payload.json"),
                options: .atomic
            )
            spinner.stopAnimating()
            statusLabel.text = "Élément enregistré. Ouvrez Maison Pilote pour terminer l’envoi."
            extensionContext?.completeRequest(returningItems: nil)
        } catch {
            try? FileManager.default.removeItem(at: batchDirectory)
            finishWithError("Le partage n’a pas pu être enregistré.")
        }
    }

    private func importProvider(
        _ provider: NSItemProvider,
        into directory: URL
    ) async -> ShareInboxFile? {
        let supported: [UTType] = [.pdf, .image, .fileURL, .data, .plainText]
        guard let type = supported.first(where: {
            provider.hasItemConformingToTypeIdentifier($0.identifier)
        }) else { return nil }

        if type == .plainText {
            return await importText(provider, into: directory)
        }
        if type == .fileURL {
            return await importFileURL(provider, into: directory)
        }
        return await importFileRepresentation(provider, type: type, into: directory)
    }

    private func importText(
        _ provider: NSItemProvider,
        into directory: URL
    ) async -> ShareInboxFile? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { item, _ in
                let text = (item as? String)
                    ?? (item as? NSAttributedString)?.string
                    ?? ""
                guard !text.isEmpty,
                      let data = text.data(using: .utf8) else {
                    continuation.resume(returning: nil)
                    return
                }
                let name = "texte-partage-\(UUID().uuidString.lowercased()).txt"
                let target = directory.appendingPathComponent(name)
                do {
                    try data.write(to: target, options: .atomic)
                    continuation.resume(returning: ShareInboxFile(
                        id: UUID().uuidString.lowercased(),
                        displayName: "Texte partagé.txt",
                        mimeType: "text/plain",
                        relativePath: name,
                        size: Int64(data.count)
                    ))
                } catch {
                    continuation.resume(returning: nil)
                }
            }
        }
    }

    private func importFileURL(
        _ provider: NSItemProvider,
        into directory: URL
    ) async -> ShareInboxFile? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier) { item, _ in
                let url = (item as? URL)
                    ?? (item as? Data).flatMap { URL(dataRepresentation: $0, relativeTo: nil) }
                guard let url else {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: Self.copyFile(url, into: directory))
            }
        }
    }

    private func importFileRepresentation(
        _ provider: NSItemProvider,
        type: UTType,
        into directory: URL
    ) async -> ShareInboxFile? {
        await withCheckedContinuation { continuation in
            provider.loadFileRepresentation(forTypeIdentifier: type.identifier) { url, _ in
                guard let url else {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: Self.copyFile(url, into: directory, fallbackType: type))
            }
        }
    }

    private static func copyFile(
        _ source: URL,
        into directory: URL,
        fallbackType: UTType? = nil
    ) -> ShareInboxFile? {
        let resourceType = (try? source.resourceValues(forKeys: [.contentTypeKey]).contentType)
            ?? fallbackType
            ?? .data
        let originalName = source.lastPathComponent.isEmpty
            ? "document.\(resourceType.preferredFilenameExtension ?? "bin")"
            : source.lastPathComponent
        let extensionName = source.pathExtension.isEmpty
            ? (resourceType.preferredFilenameExtension ?? "bin")
            : source.pathExtension
        let storedName = "\(UUID().uuidString.lowercased()).\(extensionName)"
        let target = directory.appendingPathComponent(storedName)
        let accessGranted = source.startAccessingSecurityScopedResource()
        defer { if accessGranted { source.stopAccessingSecurityScopedResource() } }

        do {
            try FileManager.default.copyItem(at: source, to: target)
            let values = try target.resourceValues(forKeys: [
                .isRegularFileKey,
                .isSymbolicLinkKey,
                .fileSizeKey,
            ])
            let size = Int64(values.fileSize ?? 0)
            guard values.isRegularFile == true,
                  values.isSymbolicLink != true,
                  size > 0 else {
                try? FileManager.default.removeItem(at: target)
                return nil
            }
            return ShareInboxFile(
                id: UUID().uuidString.lowercased(),
                displayName: String(originalName.prefix(180)),
                mimeType: resourceType.preferredMIMEType ?? "application/octet-stream",
                relativePath: storedName,
                size: size
            )
        } catch {
            try? FileManager.default.removeItem(at: target)
            return nil
        }
    }

    @MainActor
    private func finishWithError(_ message: String) {
        spinner.stopAnimating()
        statusLabel.text = message
        let close = UIAlertAction(title: "Fermer", style: .default) { [weak self] _ in
            self?.extensionContext?.cancelRequest(
                withError: NSError(
                    domain: "expert.meilhac.maisonpilote.share",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: message]
                )
            )
        }
        let alert = UIAlertController(title: "Maison Pilote", message: message, preferredStyle: .alert)
        alert.addAction(close)
        present(alert, animated: true)
    }
}
