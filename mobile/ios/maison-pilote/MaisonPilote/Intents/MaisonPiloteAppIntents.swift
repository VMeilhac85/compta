import AppIntents
import Foundation

struct OpenMaisonPiloteIntent: AppIntent {
    static var title: LocalizedStringResource = "Ouvrir Maison Pilote"
    static var description = IntentDescription("Ouvre l’application Maison Pilote.")
    static var openAppWhenRun = true

    func perform() async throws -> some IntentResult & ProvidesDialog {
        .result(dialog: "J’ouvre Maison Pilote.")
    }
}

struct AskMaisonPiloteIntent: AppIntent {
    static var title: LocalizedStringResource = "Demander à Maison Pilote"
    static var description = IntentDescription(
        "Ouvre Maison Pilote et transmet la demande à l’assistant vocal connecté à Codex."
    )
    static var openAppWhenRun = true

    @Parameter(title: "Demande")
    var prompt: String

    static var parameterSummary: some ParameterSummary {
        Summary("Demander à Maison Pilote : \(\.$prompt)")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard SharedContainer.storePendingAssistantRequest(prompt: prompt) else {
            throw MaisonPiloteIntentError.emptyPrompt
        }
        return .result(dialog: "J’ouvre Maison Pilote pour transmettre votre demande.")
    }
}

struct MaisonPiloteAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenMaisonPiloteIntent(),
            phrases: [
                "Ouvrir \(.applicationName)",
                "Lancer \(.applicationName)",
            ],
            shortTitle: "Ouvrir Maison Pilote",
            systemImageName: "safari"
        )
        AppShortcut(
            intent: AskMaisonPiloteIntent(),
            phrases: [
                "Demander à \(.applicationName)",
                "Faire une demande à \(.applicationName)",
            ],
            shortTitle: "Demander à Maison Pilote",
            systemImageName: "mic"
        )
    }
}

private enum MaisonPiloteIntentError: LocalizedError {
    case emptyPrompt

    var errorDescription: String? {
        "La demande ne peut pas être vide."
    }
}
