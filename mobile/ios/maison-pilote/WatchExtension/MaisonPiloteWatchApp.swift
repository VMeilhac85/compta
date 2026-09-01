import SwiftUI

@main
struct MaisonPiloteWatchApp: App {
    @StateObject private var assistant = WatchAssistantViewModel()

    var body: some Scene {
        WindowGroup {
            WatchAssistantView(model: assistant)
        }
    }
}

private struct WatchAssistantView: View {
    @ObservedObject var model: WatchAssistantViewModel

    var body: some View {
        ScrollView {
            VStack(spacing: 9) {
                Text("Maison Pilote")
                    .font(.headline)
                    .multilineTextAlignment(.center)

                Text(model.headline)
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)

                if model.showsProgress {
                    ProgressView()
                        .controlSize(.small)
                        .accessibilityLabel(model.headline)
                }

                if model.available == true && !model.hasOpenRun {
                    TextField("Votre demande", text: $model.draft, axis: .vertical)
                        .lineLimit(2...5)
                        .submitLabel(.send)
                        .onSubmit { model.submit() }

                    Button(action: model.submit) {
                        Label(
                            model.hasRun ? "Nouvelle demande" : "Dicter ou saisir",
                            systemImage: "mic.fill"
                        )
                    }
                    .disabled(!model.canSubmit)
                }

                if !model.prompt.isEmpty {
                    Text("« \(model.prompt) »")
                        .font(.caption2)
                        .multilineTextAlignment(.center)
                }

                if !model.model.isEmpty || !model.reasoning.isEmpty {
                    Text([model.model, model.reasoning].filter { !$0.isEmpty }.joined(separator: " - "))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                if let response = model.response, !response.isEmpty {
                    Text(response)
                        .font(.caption2)
                        .multilineTextAlignment(.leading)
                }

                if !model.error.isEmpty {
                    Text(model.error)
                        .font(.caption2)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }

                if model.cancellable {
                    Button(role: .destructive, action: model.cancel) {
                        Label("Arrêter", systemImage: "stop.circle")
                    }
                    .disabled(model.busy)
                }

                if model.available == false || !model.error.isEmpty {
                    Button("Réessayer", action: model.checkAvailability)
                        .disabled(model.busy)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 4)
        }
        .task { model.start() }
    }
}
