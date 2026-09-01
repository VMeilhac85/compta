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
}
