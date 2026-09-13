import Foundation

struct ShareInboxFile: Codable, Identifiable {
    let id: String
    let displayName: String
    let mimeType: String
    let relativePath: String
    let size: Int64
}

struct ShareInboxBatch: Codable, Identifiable {
    let id: String
    let createdAtUTC: String
    let files: [ShareInboxFile]
    let intakeResult: ShareInboxIntakeResult?
    var confirmedContext: ShareInboxContext? = nil
    var purpose: String? = nil
    var sourceSize: Int64? = nil
}

struct ShareInboxContext: Codable, Equatable {
    let identityScope: String
    let dossierId: Int64
    var contextType: String = "shared_file"
    var contextId: Int64? = nil
    var folderId: Int64? = nil

    var ownerID: String { String(identityScope.split(separator: ":", omittingEmptySubsequences: false).first ?? "") }
}

struct ShareInboxIntakeResult: Codable {
    struct Received: Codable { let name: String }
    struct Rejected: Codable { let name: String; let reason: String }
    let received: [Received]
    let rejected: [Rejected]
}
