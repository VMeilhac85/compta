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
    private var importFinished = false
    private var closeRequested = false
    private var activeImport: ProviderImport?
    private var progressTimer: Timer?

    private enum ImportFailure: Error {
        case unsupported, unavailable, empty, copyFailed, overLimit, saveFailed, cancelled, timedOut, fileTooLarge, inboxFull, imageConversion

        var message: String {
            switch self {
            case .unsupported: return "Ce format ne peut pas être partagé."
            case .unavailable: return "Fichier indisponible dans l’application d’origine."
            case .empty: return "Le fichier est vide ou ne peut pas être lu."
            case .copyFailed: return "La copie sur cet iPhone n’a pas pu être enregistrée."
            case .overLimit: return "Limite de 20 fichiers par partage."
            case .saveFailed: return "Le partage n’a pas pu être enregistré sur cet iPhone."
            case .cancelled: return "La préparation a été interrompue. Le fichier reste dans l’application d’origine."
            case .timedOut: return "Le fournisseur n’a pas rendu ce fichier disponible après 90 secondes. Réessayez avec une connexion disponible."
            case .fileTooLarge: return "Ce fichier dépasse la limite de 100 Mio."
            case .inboxFull: return "L’espace réservé aux partages en attente est plein. Transmettez ou retirez des partages dans Maison Pilote."
            case .imageConversion: return "La photo HEIC n’a pas pu être convertie. Son original reste dans l’application d’origine."
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
        closeButton.isEnabled = true
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
        SharedInboxStorage.maintain()
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
            try SharedInboxStorage.createProtectedDirectory(root)
            try SharedInboxStorage.createProtectedDirectory(batchDirectory)
        } catch {
            finishWithError("Le partage ne peut pas être préparé sur cet iPhone.")
            return
        }

        var files: [ShareInboxFile] = []
        var receipts: [Receipt] = []
        for (index, provider) in providers.enumerated() {
            let name = String((provider.suggestedName ?? "Fichier \(index + 1)").prefix(180))
            if closeRequested { receipts.append(Receipt(name: name, failure: .cancelled)); continue }
            guard index < 20 else {
                receipts.append(Receipt(name: name, failure: .overLimit))
                continue
            }
            statusLabel.text = "Préparation du fichier \(index + 1) sur \(min(providers.count, 20)) - \(name)\nTéléchargement depuis l’application d’origine si nécessaire."
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
                to: batchDirectory.appendingPathComponent("payload.json"), options: [.atomic, .completeFileProtection]
            )
            try SharedInboxStorage.protect(batchDirectory.appendingPathComponent("payload.json"))
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
        importFinished = true
        progressTimer?.invalidate()
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
        if closeRequested { closeReceipt() }
    }

    private final class ProviderImport: @unchecked Sendable {
        private let lock = NSLock()
        private var completion: ((Result<ShareInboxFile, ImportFailure>) -> Void)?
        private var progress: Progress?
        init(_ completion: @escaping (Result<ShareInboxFile, ImportFailure>) -> Void) { self.completion = completion }
        var isPending: Bool { lock.lock(); defer { lock.unlock() }; return completion != nil }
        var fraction: Double? {
            lock.lock(); defer { lock.unlock() }
            guard let progress, progress.totalUnitCount > 0 else { return nil }
            return progress.fractionCompleted
        }
        func attach(_ progress: Progress?) {
            lock.lock(); self.progress = progress; let cancelled = completion == nil; lock.unlock()
            if cancelled { progress?.cancel() }
        }
        @discardableResult func finish(_ result: Result<ShareInboxFile, ImportFailure>) -> Bool {
            lock.lock(); let callback = completion; completion = nil; let progress = self.progress; lock.unlock()
            guard let callback else { return false }
            if case .failure = result { progress?.cancel() }
            callback(result)
            return true
        }
    }

    @MainActor
    private func importProvider(
        _ provider: NSItemProvider, into directory: URL
    ) async -> Result<ShareInboxFile, ImportFailure> {
        let supported: [UTType] = [.pdf, .image, .fileURL, .plainText, .data]
        guard let type = supported.first(where: {
            provider.hasItemConformingToTypeIdentifier($0.identifier)
        }) else { return .failure(.unsupported) }
        let result: Result<ShareInboxFile, ImportFailure> = await withCheckedContinuation { continuation in
            let operation = ProviderImport { continuation.resume(returning: $0) }
            activeImport = operation
            let initialStatus = statusLabel.text ?? "Préparation du fichier"
            progressTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self, weak operation] _ in
                guard let operation, let fraction = operation.fraction else { return }
                Task { @MainActor in
                    self?.statusLabel.text = initialStatus + " - \(Int(max(0, min(1, fraction)) * 100)) %"
                }
            }
            DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 90) {
                operation.finish(.failure(.timedOut))
            }
            let complete: (Result<ShareInboxFile, ImportFailure>) -> Void = { result in
                if !operation.finish(result), case .success(let file) = result {
                    try? FileManager.default.removeItem(at: directory.appendingPathComponent(file.relativePath))
                }
            }
            if type == .plainText {
                provider.loadItem(forTypeIdentifier: type.identifier) { item, error in
                    guard operation.isPending else { return }
                    guard error == nil else { complete(.failure(.unavailable)); return }
                    let text = (item as? String) ?? (item as? NSAttributedString)?.string ?? ""
                    guard let data = text.data(using: .utf8), !data.isEmpty else { complete(.failure(.empty)); return }
                    let name = "texte-partage-\(UUID().uuidString.lowercased()).txt"
                    let target = directory.appendingPathComponent(name)
                    do {
                        try SharedInboxStorage.validateSpace(for: Int64(data.count))
                        try data.write(to: target, options: [.atomic, .completeFileProtection])
                        try SharedInboxStorage.protect(target)
                        complete(.success(ShareInboxFile(id: UUID().uuidString.lowercased(), displayName: "Texte partagé.txt",
                            mimeType: "text/plain", relativePath: name, size: Int64(data.count))))
                    } catch {
                        try? FileManager.default.removeItem(at: target)
                        complete(.failure(Self.failure(from: error)))
                    }
                }
            } else if type == .fileURL {
                provider.loadItem(forTypeIdentifier: type.identifier) { item, error in
                    guard operation.isPending else { return }
                    let url = (item as? URL) ?? (item as? Data).flatMap { URL(dataRepresentation: $0, relativeTo: nil) }
                    guard error == nil, let url else { complete(.failure(.unavailable)); return }
                    complete(Self.copyFile(url, into: directory))
                }
            } else {
                operation.attach(provider.loadFileRepresentation(forTypeIdentifier: type.identifier) { url, error in
                    guard operation.isPending else { return }
                    guard error == nil, let url else { complete(.failure(.unavailable)); return }
                    // The provider URL is temporary: copy before its completion handler returns.
                    complete(Self.copyFile(url, into: directory, fallbackType: type))
                })
            }
        }
        progressTimer?.invalidate()
        progressTimer = nil
        activeImport = nil
        return result
    }

    nonisolated private static func failure(from error: Error) -> ImportFailure {
        switch error as? SharedInboxStorage.Failure {
        case .fileTooLarge: return .fileTooLarge
        case .inboxFull: return .inboxFull
        case .invalidImage: return .imageConversion
        default: return .copyFailed
        }
    }

    nonisolated private static func copyFile(
        _ source: URL, into directory: URL, fallbackType: UTType? = nil
    ) -> Result<ShareInboxFile, ImportFailure> {
        guard source.isFileURL else { return .failure(.unavailable) }
        let accessGranted = source.startAccessingSecurityScopedResource()
        defer { if accessGranted { source.stopAccessingSecurityScopedResource() } }
        var coordinationError: NSError?
        var result: Result<ShareInboxFile, ImportFailure> = .failure(.unavailable)
        NSFileCoordinator().coordinate(readingItemAt: source, options: .withoutChanges, error: &coordinationError) { local in
            let resourceType = (try? local.resourceValues(forKeys: [.contentTypeKey]).contentType) ?? fallbackType ?? .data
            let mime = resourceType.preferredMIMEType ?? "application/octet-stream"
            let convert = SharedInboxStorage.isHEIC(local, mimeType: mime)
            var originalName = local.lastPathComponent.isEmpty
                ? "document.\(resourceType.preferredFilenameExtension ?? "bin")" : local.lastPathComponent
            if convert { originalName = (originalName as NSString).deletingPathExtension + ".jpg" }
            let ext = convert ? "jpg" : (local.pathExtension.isEmpty ? (resourceType.preferredFilenameExtension ?? "bin") : local.pathExtension)
            let storedName = "\(UUID().uuidString.lowercased()).\(ext)"
            let target = directory.appendingPathComponent(storedName)
            do {
                let values = try local.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
                guard values.isRegularFile == true, values.isSymbolicLink != true else { result = .failure(.unsupported); return }
                let size = Int64(values.fileSize ?? 0)
                guard size > 0 else { result = .failure(.empty); return }
                try SharedInboxStorage.validateSpace(for: size)
                if convert { try SharedInboxStorage.jpeg(from: local, to: target) }
                else { try FileManager.default.copyItem(at: local, to: target); try SharedInboxStorage.protect(target) }
                let copiedSize = Int64(try target.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0)
                guard copiedSize > 0 else { throw SharedInboxStorage.Failure.unsafeFile }
                result = .success(ShareInboxFile(id: UUID().uuidString.lowercased(), displayName: String(originalName.prefix(180)),
                    mimeType: convert ? "image/jpeg" : mime, relativePath: storedName, size: copiedSize))
            } catch {
                try? FileManager.default.removeItem(at: target)
                result = .failure(failure(from: error))
            }
        }
        return coordinationError == nil ? result : .failure(.unavailable)
    }

    @MainActor
    private func finishWithError(_ message: String) {
        importFinished = true
        progressTimer?.invalidate()
        spinner.stopAnimating()
        titleLabel.text = "Partage impossible"
        statusLabel.text = message
        closeButton.isEnabled = true
        UIAccessibility.post(notification: .screenChanged, argument: titleLabel)
    }

    @objc private func closeReceipt() {
        if !importFinished {
            closeRequested = true
            statusLabel.text = "Arrêt de la préparation - les fichiers déjà reçus sont conservés."
            activeImport?.finish(.failure(.cancelled))
            return
        }
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
