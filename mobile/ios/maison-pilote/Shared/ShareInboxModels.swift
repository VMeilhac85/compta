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
}

struct ShareInboxIntakeResult: Codable {
    struct Received: Codable { let name: String }
    struct Rejected: Codable { let name: String; let reason: String }
    let received: [Received]
    let rejected: [Rejected]
}
