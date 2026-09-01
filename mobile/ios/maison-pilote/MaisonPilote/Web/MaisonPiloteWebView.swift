import SwiftUI
import WebKit

struct MaisonPiloteWebView: UIViewRepresentable {
    @ObservedObject var store: WebViewStore

    func makeUIView(context: Context) -> WKWebView {
        store.webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // L’instance appartient au store afin de conserver cookies, historique
        // et processus WebKit lors des recompositions SwiftUI.
    }
}
