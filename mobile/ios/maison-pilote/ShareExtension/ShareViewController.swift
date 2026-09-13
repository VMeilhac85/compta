import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private let titleLabel = UILabel()
    private let statusLabel = UILabel()
    private let detailsStack = UIStackView()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let closeButton = UIButton(type: .system)
    private var importStarted = false
    private var receivedCount = 0

    private enum ImportFailure: Error {
        case unsupported, unavailable, empty, copyFailed, overLimit, saveFailed

        var message: String {
            switch self {
            case .unsupported: return "Ce format ne peut pas être partagé."
            case .unavailable: return "Fichier indisponible dans l’application d’origine."
            case .empty: return "Le fichier est vide ou ne peut pas être lu."
            case .copyFailed: return "La copie sur cet iPhone n’a pas pu être enregistrée."
            case .overLimit: return "Limite de 20 fichiers par partage."
            case .saveFailed: return "Le partage n’a pas pu être enregistré sur cet iPhone."
            }
        }
    }

    private struct Receipt {
        let name: String
        let failure: ImportFailure?
    }

    override func loadView() {
        let root = UIView()
        root.backgroundColor = .systemBackground
        titleLabel.text = "Maison Pilote"
        titleLabel.font = .preferredFont(forTextStyle: .headline)
        titleLabel.adjustsFontForContentSizeCategory = true
        titleLabel.numberOfLines = 0
        titleLabel.accessibilityTraits.insert(.header)
        closeButton.setImage(UIImage(systemName: "xmark"), for: .normal)
        closeButton.accessibilityLabel = "Fermer"
        closeButton.isEnabled = false
        closeButton.addTarget(self, action: #selector(closeReceipt), for: .touchUpInside)
        closeButton.widthAnchor.constraint(equalToConstant: 44).isActive = true
        closeButton.heightAnchor.constraint(equalToConstant: 44).isActive = true
        let header = UIStackView(arrangedSubviews: [titleLabel, closeButton])
        header.alignment = .center
        header.spacing = 12
        header.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(header)

        statusLabel.text = "Préparation du partage vers Maison Pilote…"
        statusLabel.font = .preferredFont(forTextStyle: .body)
        statusLabel.adjustsFontForContentSizeCategory = true
        statusLabel.numberOfLines = 0
        spinner.startAnimating()
        detailsStack.axis = .vertical
        detailsStack.spacing = 16
        let stack = UIStackView(arrangedSubviews: [spinner, statusLabel, detailsStack])
        stack.axis = .vertical
        stack.spacing = 20
        stack.translatesAutoresizingMaskIntoConstraints = false
        let scroll = UIScrollView()
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stack)
        root.addSubview(scroll)
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: root.safeAreaLayoutGuide.topAnchor, constant: 8),
            header.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 24),
            header.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
            scroll.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 16),
            scroll.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: root.safeAreaLayoutGuide.bottomAnchor),
            stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            stack.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor, constant: -24),
            stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -24),
            stack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor, constant: -48),
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
            try FileManager.default.createDirectory(at: batchDirectory, withIntermediateDirectories: true)
        } catch {
            finishWithError("Le partage ne peut pas être préparé sur cet iPhone.")
            return
        }

        var files: [ShareInboxFile] = []
        var receipts: [Receipt] = []
        for (index, provider) in providers.enumerated() {
            let name = String((provider.suggestedName ?? "Fichier \(index + 1)").prefix(180))
            guard index < 20 else {
                receipts.append(Receipt(name: name, failure: .overLimit))
                continue
            }
            switch await importProvider(provider, into: batchDirectory) {
            case .success(let file):
                files.append(file)
                receipts.append(Receipt(name: file.displayName, failure: nil))
            case .failure(let failure):
                receipts.append(Receipt(name: name, failure: failure))
            }
        }
        guard !files.isEmpty else {
            try? FileManager.default.removeItem(at: batchDirectory)
            showReceipt(receipts, received: 0)
            return
        }
        let batch = ShareInboxBatch(
            id: batchID,
            createdAtUTC: ISO8601DateFormatter().string(from: Date()),
            files: files,
            intakeResult: ShareInboxIntakeResult(
                received: files.map { .init(name: $0.displayName) },
                rejected: receipts.compactMap { receipt in
                    receipt.failure.map { .init(name: receipt.name, reason: $0.message) }
                }
            )
        )
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.sortedKeys]
            try encoder.encode(batch).write(
                to: batchDirectory.appendingPathComponent("payload.json"), options: .atomic
            )
            showReceipt(receipts, received: files.count)
        } catch {
            try? FileManager.default.removeItem(at: batchDirectory)
            showReceipt(receipts.map {
                Receipt(name: $0.name, failure: $0.failure ?? .saveFailed)
            }, received: 0)
        }
    }

    @MainActor
    private func showReceipt(_ receipts: [Receipt], received: Int) {
        receivedCount = received
        spinner.stopAnimating()
        closeButton.isEnabled = true
        let refused = receipts.count - received
        titleLabel.text = received == 0 ? "Partage impossible"
            : (refused == 0 ? "Partage reçu" : "Partage incomplet")
        let acceptedLabel = "\(received) \(received <= 1 ? "fichier reçu" : "fichiers reçus")"
        let refusedLabel = "\(refused) \(refused <= 1 ? "fichier non reçu" : "fichiers non reçus")"
        statusLabel.text = (refused == 0 ? acceptedLabel : "\(acceptedLabel) - \(refusedLabel)") + "."
            + (received > 0 ? "\nOuvrez Maison Pilote pour terminer l’envoi." : "")
        let orderedReceipts = receipts.filter { $0.failure != nil }
            + receipts.filter { $0.failure == nil }
        for receipt in orderedReceipts {
            let symbol = UIImageView(image: UIImage(systemName:
                receipt.failure == nil ? "checkmark.circle" : "exclamationmark.circle"
            ))
            symbol.tintColor = receipt.failure == nil ? .systemGreen : .systemOrange
            symbol.contentMode = .scaleAspectFit
            symbol.isAccessibilityElement = false
            symbol.widthAnchor.constraint(equalToConstant: 20).isActive = true
            symbol.heightAnchor.constraint(equalToConstant: 24).isActive = true
            let name = UILabel()
            name.font = .preferredFont(forTextStyle: .subheadline)
            name.adjustsFontForContentSizeCategory = true
            name.numberOfLines = 0
            name.text = receipt.name
            let text = UIStackView(arrangedSubviews: [name])
            text.axis = .vertical
            text.spacing = 4
            if let failure = receipt.failure {
                let reason = UILabel()
                reason.font = .preferredFont(forTextStyle: .footnote)
                reason.adjustsFontForContentSizeCategory = true
                reason.numberOfLines = 0
                reason.textColor = .secondaryLabel
                reason.text = failure.message
                text.addArrangedSubview(reason)
            }
            let row = UIStackView(arrangedSubviews: [symbol, text])
            row.alignment = .top
            row.spacing = 10
            row.isAccessibilityElement = true
            row.accessibilityLabel = receipt.name + " - "
                + (receipt.failure.map { "Non reçu. " + $0.message } ?? "Reçu")
            detailsStack.addArrangedSubview(row)
        }
        if refused > 0 {
            let hint = UILabel()
            hint.font = .preferredFont(forTextStyle: .footnote)
            hint.adjustsFontForContentSizeCategory = true
            hint.numberOfLines = 0
            hint.textColor = .secondaryLabel
            hint.text = "Partagez de nouveau les fichiers non reçus depuis l’application d’origine."
            detailsStack.addArrangedSubview(hint)
        }
        UIAccessibility.post(notification: .screenChanged, argument: titleLabel)
    }

    private func importProvider(
        _ provider: NSItemProvider, into directory: URL
    ) async -> Result<ShareInboxFile, ImportFailure> {
        let supported: [UTType] = [.pdf, .image, .fileURL, .plainText, .data]
        guard let type = supported.first(where: {
            provider.hasItemConformingToTypeIdentifier($0.identifier)
        }) else { return .failure(.unsupported) }
        if type == .plainText { return await importText(provider, into: directory) }
        if type == .fileURL { return await importFileURL(provider, into: directory) }
        return await importFileRepresentation(provider, type: type, into: directory)
    }

    private func importText(
        _ provider: NSItemProvider, into directory: URL
    ) async -> Result<ShareInboxFile, ImportFailure> {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { item, error in
                guard error == nil else {
                    continuation.resume(returning: .failure(.unavailable)); return
                }
                let text = (item as? String) ?? (item as? NSAttributedString)?.string ?? ""
                guard !text.isEmpty, let data = text.data(using: .utf8) else {
                    continuation.resume(returning: .failure(.empty)); return
                }
                let name = "texte-partage-\(UUID().uuidString.lowercased()).txt"
                let target = directory.appendingPathComponent(name)
                do {
                    try data.write(to: target, options: .atomic)
                    continuation.resume(returning: .success(ShareInboxFile(
                        id: UUID().uuidString.lowercased(), displayName: "Texte partagé.txt",
                        mimeType: "text/plain", relativePath: name, size: Int64(data.count)
                    )))
                } catch {
                    try? FileManager.default.removeItem(at: target)
                    continuation.resume(returning: .failure(.copyFailed))
                }
            }
        }
    }

    private func importFileURL(
        _ provider: NSItemProvider, into directory: URL
    ) async -> Result<ShareInboxFile, ImportFailure> {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier) { item, error in
                let url = (item as? URL)
                    ?? (item as? Data).flatMap { URL(dataRepresentation: $0, relativeTo: nil) }
                guard error == nil, let url else {
                    continuation.resume(returning: .failure(.unavailable)); return
                }
                continuation.resume(returning: Self.copyFile(url, into: directory))
            }
        }
    }

    private func importFileRepresentation(
        _ provider: NSItemProvider, type: UTType, into directory: URL
    ) async -> Result<ShareInboxFile, ImportFailure> {
        await withCheckedContinuation { continuation in
            provider.loadFileRepresentation(forTypeIdentifier: type.identifier) { url, error in
                guard error == nil, let url else {
                    continuation.resume(returning: .failure(.unavailable)); return
                }
                continuation.resume(returning: Self.copyFile(url, into: directory, fallbackType: type))
            }
        }
    }

    private static func copyFile(
        _ source: URL, into directory: URL, fallbackType: UTType? = nil
    ) -> Result<ShareInboxFile, ImportFailure> {
        guard source.isFileURL else { return .failure(.unavailable) }
        let accessGranted = source.startAccessingSecurityScopedResource()
        defer { if accessGranted { source.stopAccessingSecurityScopedResource() } }
        let resourceType = (try? source.resourceValues(forKeys: [.contentTypeKey]).contentType)
            ?? fallbackType ?? .data
        let originalName = source.lastPathComponent.isEmpty
            ? "document.\(resourceType.preferredFilenameExtension ?? "bin")" : source.lastPathComponent
        let extensionName = source.pathExtension.isEmpty
            ? (resourceType.preferredFilenameExtension ?? "bin") : source.pathExtension
        let storedName = "\(UUID().uuidString.lowercased()).\(extensionName)"
        let target = directory.appendingPathComponent(storedName)
        do {
            let sourceValues = try source.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
            guard sourceValues.isRegularFile == true, sourceValues.isSymbolicLink != true else {
                return .failure(.unsupported)
            }
            try FileManager.default.copyItem(at: source, to: target)
            let values = try target.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
            let size = Int64(values.fileSize ?? 0)
            guard values.isRegularFile == true, values.isSymbolicLink != true, size > 0 else {
                try? FileManager.default.removeItem(at: target)
                return .failure(.empty)
            }
            return .success(ShareInboxFile(
                id: UUID().uuidString.lowercased(), displayName: String(originalName.prefix(180)),
                mimeType: resourceType.preferredMIMEType ?? "application/octet-stream",
                relativePath: storedName, size: size
            ))
        } catch {
            try? FileManager.default.removeItem(at: target)
            return .failure(.copyFailed)
        }
    }

    @MainActor
    private func finishWithError(_ message: String) {
        spinner.stopAnimating()
        titleLabel.text = "Partage impossible"
        statusLabel.text = message
        closeButton.isEnabled = true
        UIAccessibility.post(notification: .screenChanged, argument: titleLabel)
    }

    @objc private func closeReceipt() {
        if receivedCount > 0 {
            extensionContext?.completeRequest(returningItems: nil)
        } else {
            extensionContext?.cancelRequest(withError: NSError(
                domain: "expert.meilhac.maisonpilote.share", code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Aucun fichier n’a été reçu."]
            ))
        }
    }
}
