import Foundation

enum AppEnvironment {
    static let defaultHost = "maisonpilote.meilhac.expert"

    static var trustedHost: String {
        configuredValue("MaisonPiloteURLHost")?.lowercased() ?? defaultHost
    }

    static var initialURL: URL {
        var components = URLComponents()
        components.scheme = configuredValue("MaisonPiloteURLScheme") ?? "https"
        components.host = trustedHost

        let configuredPath = configuredValue("MaisonPiloteURLPath")
            ?? "/api/application-ios/test?native=1"
        let parts = configuredPath.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false)
        components.path = parts.first.map(String.init) ?? "/api/application-ios/test"
        if parts.count == 2 {
            components.percentEncodedQuery = String(parts[1])
        }

        guard let url = components.url, isTrusted(url) else {
            return URL(string: "https://\(defaultHost)/api/application-ios/test?native=1")!
        }
        return url
    }

    static var customURLScheme: String {
        configuredValue("MaisonPiloteCustomURLScheme")?.lowercased() ?? "maisonpilote"
    }

    static func isTrusted(_ url: URL) -> Bool {
        guard url.scheme?.lowercased() == "https",
              url.host?.lowercased() == trustedHost,
              url.user == nil,
              url.password == nil else { return false }
        return url.port == nil || url.port == 443
    }

    static func isShellURL(_ url: URL) -> Bool {
        guard isTrusted(url),
              var candidate = URLComponents(url: url, resolvingAgainstBaseURL: false),
              var shell = URLComponents(url: initialURL, resolvingAgainstBaseURL: false) else {
            return false
        }
        candidate.fragment = nil
        shell.fragment = nil
        return candidate.scheme?.lowercased() == shell.scheme?.lowercased()
            && candidate.host?.lowercased() == shell.host?.lowercased()
            && (candidate.port ?? 443) == (shell.port ?? 443)
            && candidate.percentEncodedPath == shell.percentEncodedPath
            && candidate.percentEncodedQuery == shell.percentEncodedQuery
    }

    static func isSignatureURL(_ url: URL) -> Bool {
        guard isTrusted(url) else { return false }
        let segments = url.path.split(separator: "/", omittingEmptySubsequences: true)
        guard segments.count >= 2, segments[0] == "signature" else { return false }
        let token = String(segments[1])
        return (40...100).contains(token.count)
            && token.unicodeScalars.allSatisfy(CharacterSet.alphanumerics.contains)
    }

    static func signatureExperienceURL(_ url: URL) -> URL? {
        guard isSignatureURL(url),
              var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }
        var queryItems = components.queryItems ?? []
        if !queryItems.contains(where: { $0.name == "mobile_app" && $0.value == "1" }) {
            queryItems.removeAll(where: { $0.name == "mobile_app" })
            queryItems.append(URLQueryItem(name: "mobile_app", value: "1"))
        }
        components.queryItems = queryItems
        return components.url.flatMap { isSignatureURL($0) ? $0 : nil }
    }

    static func normalizedDeepLink(_ candidate: URL) -> URL? {
        if isTrusted(candidate) {
            return candidate
        }
        guard candidate.scheme?.lowercased() == customURLScheme else { return nil }

        if candidate.host?.lowercased() == "assistant" {
            var components = URLComponents()
            components.scheme = "https"
            components.host = trustedHost
            components.path = "/assistant-vocal"
            components.queryItems = [URLQueryItem(name: "listen", value: "1")]
            return components.url
        }

        var components = URLComponents()
        components.scheme = "https"
        components.host = trustedHost
        let hostPath = candidate.host.map { "/\($0)" } ?? ""
        components.path = hostPath + candidate.path
        components.percentEncodedQuery = URLComponents(
            url: candidate,
            resolvingAgainstBaseURL: false
        )?.percentEncodedQuery
        components.fragment = candidate.fragment
        return components.url.flatMap { isTrusted($0) ? $0 : nil }
    }

    static func canOpenExternally(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else { return false }
        return [
            "https", "http", "mailto", "tel", "sms", "maps", "itms-beta", "itms-apps",
        ].contains(scheme)
    }

    private static func configuredValue(_ key: String) -> String? {
        (Bundle.main.object(forInfoDictionaryKey: key) as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .nonEmpty
    }
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}
