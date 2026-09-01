import AppIntents
import SwiftUI

@main
struct MaisonPiloteApp: App {
    @UIApplicationDelegateAdaptor(MaisonPiloteAppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var webViewStore = WebViewStore()
    @StateObject private var privacyMonitor = PrivacyProtectionMonitor()

    init() {
        MaisonPiloteAppShortcuts.updateAppShortcutParameters()
        WatchCodexRelay.shared.activate()
    }

    var body: some Scene {
        WindowGroup {
            MaisonPiloteRootView(
                store: webViewStore,
                privacyShieldVisible: scenePhase != .active || privacyMonitor.isScreenCaptured
            )
                .onOpenURL { url in
                    webViewStore.openDeepLink(url)
                }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    guard let url = activity.webpageURL else { return }
                    webViewStore.openDeepLink(url)
                }
                .onChange(of: scenePhase) { phase in
                    if phase == .active {
                        WatchCodexRelay.shared.activate()
                        webViewStore.applicationDidBecomeActive()
                    }
                }
        }
    }
}

private struct MaisonPiloteRootView: View {
    @ObservedObject var store: WebViewStore
    let privacyShieldVisible: Bool

    var body: some View {
        ZStack(alignment: .top) {
            MaisonPiloteWebView(store: store)
                .ignoresSafeArea(.container, edges: .bottom)

            if store.isLoading {
                ProgressView()
                    .progressViewStyle(.circular)
                    .padding(.top, 10)
                    .accessibilityLabel("Chargement de Maison Pilote")
            }

            if let message = store.errorMessage {
                ConnectionNotice(message: message) {
                    store.reload()
                } onClose: {
                    store.dismissError()
                }
                .padding(.horizontal, 12)
                .padding(.top, 8)
            }

            if privacyShieldVisible {
                PrivacyShield()
                    .zIndex(1_000)
            }
        }
        .background(Color(uiColor: .systemBackground))
        .task {
            store.startIfNeeded()
        }
    }
}

private struct PrivacyShield: View {
    var body: some View {
        ZStack {
            Color(uiColor: .systemBackground)
                .ignoresSafeArea()
            VStack(spacing: 10) {
                Image(systemName: "lock.shield")
                    .font(.system(size: 32, weight: .medium))
                    .accessibilityHidden(true)
                Text("Maison Pilote")
                    .font(.headline)
                Text("Contenu protégé")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Maison Pilote - contenu protégé")
        }
    }
}

private struct ConnectionNotice: View {
    let message: String
    let onRetry: () -> Void
    let onClose: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "wifi.exclamationmark")
                .accessibilityHidden(true)
            Text(message)
                .font(.footnote)
                .lineLimit(3)
            Spacer(minLength: 4)
            Button("Réessayer", action: onRetry)
                .font(.footnote.weight(.semibold))
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .accessibilityLabel("Fermer")
            }
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.12), radius: 8, y: 3)
    }
}
