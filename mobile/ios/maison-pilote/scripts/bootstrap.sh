#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
REPOSITORY_DIR="$(cd -- "$PROJECT_DIR/../../.." && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "Ce bootstrap iOS nécessite macOS et Xcode." >&2
    exit 69
fi

for command_name in xcodebuild xcrun xcodegen; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Commande manquante : $command_name" >&2
        [[ "$command_name" == "xcodegen" ]] && echo "Installation conseillée : brew install xcodegen" >&2
        exit 69
    fi
done

ICON_SOURCE="$REPOSITORY_DIR/mobile/android/maison-pilote/app/src/main/res/drawable-nodpi/maison_pilote_app_icon_safe_frame.png"
LOGO_SOURCE="$REPOSITORY_DIR/public/images/maison-pilote/logo-couleur.png"
GENERATED_CATALOG="$PROJECT_DIR/.generated/Assets.xcassets"

for source_file in "$ICON_SOURCE" "$LOGO_SOURCE"; do
    if [[ ! -f "$source_file" ]]; then
        echo "Asset Maison Pilote absent : $source_file" >&2
        exit 66
    fi
done

rm -rf -- "$GENERATED_CATALOG"
mkdir -p -- "$(dirname -- "$GENERATED_CATALOG")"
xcrun swift "$SCRIPT_DIR/generate-assets.swift" "$ICON_SOURCE" "$LOGO_SOURCE" "$GENERATED_CATALOG"

if [[ ! -f "$PROJECT_DIR/Config/Local.xcconfig" ]]; then
    cp -- "$PROJECT_DIR/Config/Local.example.xcconfig" "$PROJECT_DIR/Config/Local.xcconfig"
    echo "Config/Local.xcconfig créé. Renseignez l’identifiant d’équipe Apple avant un build appareil."
fi

(
    cd -- "$PROJECT_DIR"
    xcodegen generate --spec project.yml
    xcodebuild -project MaisonPiloteIOS.xcodeproj -list
)

echo "Projet Xcode prêt : $PROJECT_DIR/MaisonPiloteIOS.xcodeproj"
