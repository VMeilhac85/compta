#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "Une archive TestFlight nécessite macOS et Xcode." >&2
    exit 69
fi

: "${IOS_DEVELOPMENT_TEAM:?Variable requise}"
: "${IOS_APP_STORE_CONNECT_API_KEY_ID:?Variable requise}"
: "${IOS_APP_STORE_CONNECT_ISSUER_ID:?Variable requise}"
: "${IOS_APP_STORE_CONNECT_API_PRIVATE_KEY:?Variable requise}"
: "${IOS_MARKETING_VERSION:?Variable requise}"
: "${IOS_BUILD_NUMBER:?Variable requise}"
: "${IOS_APP_PROVISIONING_PROFILE_SPECIFIER:?Profil App Store de l’application requis}"
: "${IOS_SHARE_PROVISIONING_PROFILE_SPECIFIER:?Profil App Store de l’extension de partage requis}"
: "${IOS_WATCH_PROVISIONING_PROFILE_SPECIFIER:?Profil App Store de l’app Watch requis}"
: "${IOS_WATCH_EXTENSION_PROVISIONING_PROFILE_SPECIFIER:?Profil App Store de l’extension Watch requis}"

if [[ ! "$IOS_DEVELOPMENT_TEAM" =~ ^[A-Z0-9]{10}$ ]]; then
    echo "IOS_DEVELOPMENT_TEAM doit contenir 10 caractères alphanumériques." >&2
    exit 64
fi
if [[ ! "$IOS_BUILD_NUMBER" =~ ^[1-9][0-9]*$ ]]; then
    echo "IOS_BUILD_NUMBER doit être un entier positif." >&2
    exit 64
fi
if [[ ! "$IOS_MARKETING_VERSION" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
    echo "IOS_MARKETING_VERSION doit respecter le format X.Y ou X.Y.Z." >&2
    exit 64
fi
for profile_specifier in \
    "$IOS_APP_PROVISIONING_PROFILE_SPECIFIER" \
    "$IOS_SHARE_PROVISIONING_PROFILE_SPECIFIER" \
    "$IOS_WATCH_PROVISIONING_PROFILE_SPECIFIER" \
    "$IOS_WATCH_EXTENSION_PROVISIONING_PROFILE_SPECIFIER"; do
    if [[ ! "$profile_specifier" =~ ^[0-9a-fA-F-]{36}$ ]]; then
        echo "Un identifiant de profil App Store est invalide." >&2
        exit 64
    fi
done
MINIMUM_OS_VERSION="${IOS_MINIMUM_OS_VERSION:-${MOBILE_IOS_MINIMUM_OS_VERSION:-16.4}}"
WATCH_MINIMUM_OS_VERSION="${IOS_WATCH_MINIMUM_OS_VERSION:-9.4}"
if [[ ! "$MINIMUM_OS_VERSION" =~ ^[0-9]+(\.[0-9]+){1,2}$ ]]; then
    echo "IOS_MINIMUM_OS_VERSION doit respecter le format X.Y ou X.Y.Z." >&2
    exit 64
fi
if [[ ! "$WATCH_MINIMUM_OS_VERSION" =~ ^[0-9]+(\.[0-9]+){1,2}$ ]]; then
    echo "IOS_WATCH_MINIMUM_OS_VERSION doit respecter le format X.Y ou X.Y.Z." >&2
    exit 64
fi
if [[ ! -r "$IOS_APP_STORE_CONNECT_API_PRIVATE_KEY" ]]; then
    echo "Clé API App Store Connect illisible." >&2
    exit 66
fi

"$SCRIPT_DIR/bootstrap.sh"

BUNDLE_IDENTIFIER="${IOS_BUNDLE_IDENTIFIER:-expert.meilhac.maisonpilote}"
APP_GROUP_IDENTIFIER="${IOS_APP_GROUP_IDENTIFIER:-group.expert.meilhac.maisonpilote}"
ASSOCIATED_DOMAIN="${IOS_ASSOCIATED_DOMAIN:-maisonpilote.meilhac.expert}"
ARCHIVE_ROOT="${IOS_ARCHIVE_PATH:-$PROJECT_DIR/.build/archives}"
ARCHIVE_PATH="$ARCHIVE_ROOT/MaisonPilote-$IOS_BUILD_NUMBER.xcarchive"
EXPORT_PATH="${IOS_EXPORT_PATH:-$PROJECT_DIR/.build/testflight-$IOS_BUILD_NUMBER}"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/maison-pilote-ios.XXXXXX")"
trap 'rm -rf -- "$TEMP_DIR"' EXIT

mkdir -p -- "$ARCHIVE_ROOT" "$EXPORT_PATH"

xcodebuild archive \
    -project "$PROJECT_DIR/MaisonPiloteIOS.xcodeproj" \
    -scheme MaisonPilote \
    -configuration Release \
    -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIVE_PATH" \
    "MAISON_PILOTE_DEVELOPMENT_TEAM=$IOS_DEVELOPMENT_TEAM" \
    "MAISON_PILOTE_BUNDLE_IDENTIFIER=$BUNDLE_IDENTIFIER" \
    "MAISON_PILOTE_APP_GROUP_IDENTIFIER=$APP_GROUP_IDENTIFIER" \
    "MAISON_PILOTE_ASSOCIATED_DOMAIN=$ASSOCIATED_DOMAIN" \
    "MARKETING_VERSION=$IOS_MARKETING_VERSION" \
    "CURRENT_PROJECT_VERSION=$IOS_BUILD_NUMBER" \
    "IPHONEOS_DEPLOYMENT_TARGET=$MINIMUM_OS_VERSION" \
    "WATCHOS_DEPLOYMENT_TARGET=$WATCH_MINIMUM_OS_VERSION" \
    "MAISON_PILOTE_WATCH_MINIMUM_OS_VERSION=$WATCH_MINIMUM_OS_VERSION" \
    "MAISON_PILOTE_APP_PROVISIONING_PROFILE_SPECIFIER=$IOS_APP_PROVISIONING_PROFILE_SPECIFIER" \
    "MAISON_PILOTE_SHARE_PROVISIONING_PROFILE_SPECIFIER=$IOS_SHARE_PROVISIONING_PROFILE_SPECIFIER" \
    "MAISON_PILOTE_WATCH_PROVISIONING_PROFILE_SPECIFIER=$IOS_WATCH_PROVISIONING_PROFILE_SPECIFIER" \
    "MAISON_PILOTE_WATCH_EXTENSION_PROVISIONING_PROFILE_SPECIFIER=$IOS_WATCH_EXTENSION_PROVISIONING_PROFILE_SPECIFIER" \
    CODE_SIGN_STYLE=Manual \
    "CODE_SIGN_IDENTITY=Apple Distribution" \
    -allowProvisioningUpdates \
    -authenticationKeyPath "$IOS_APP_STORE_CONNECT_API_PRIVATE_KEY" \
    -authenticationKeyID "$IOS_APP_STORE_CONNECT_API_KEY_ID" \
    -authenticationKeyIssuerID "$IOS_APP_STORE_CONNECT_ISSUER_ID"

cat > "$TEMP_DIR/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>destination</key>
    <string>upload</string>
    <key>manageAppVersionAndBuildNumber</key>
    <false/>
    <key>method</key>
    <string>app-store-connect</string>
    <key>signingStyle</key>
    <string>manual</string>
    <key>signingCertificate</key>
    <string>Apple Distribution</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>$BUNDLE_IDENTIFIER</key>
        <string>$IOS_APP_PROVISIONING_PROFILE_SPECIFIER</string>
        <key>$BUNDLE_IDENTIFIER.share</key>
        <string>$IOS_SHARE_PROVISIONING_PROFILE_SPECIFIER</string>
        <key>$BUNDLE_IDENTIFIER.watchkitapp</key>
        <string>$IOS_WATCH_PROVISIONING_PROFILE_SPECIFIER</string>
        <key>$BUNDLE_IDENTIFIER.watchkitapp.watchkitextension</key>
        <string>$IOS_WATCH_EXTENSION_PROVISIONING_PROFILE_SPECIFIER</string>
    </dict>
    <key>stripSwiftSymbols</key>
    <true/>
    <key>teamID</key>
    <string>$IOS_DEVELOPMENT_TEAM</string>
    <key>uploadSymbols</key>
    <true/>
</dict>
</plist>
PLIST

xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$EXPORT_PATH" \
    -exportOptionsPlist "$TEMP_DIR/ExportOptions.plist" \
    -allowProvisioningUpdates \
    -authenticationKeyPath "$IOS_APP_STORE_CONNECT_API_PRIVATE_KEY" \
    -authenticationKeyID "$IOS_APP_STORE_CONNECT_API_KEY_ID" \
    -authenticationKeyIssuerID "$IOS_APP_STORE_CONNECT_ISSUER_ID"

echo "Build $IOS_MARKETING_VERSION ($IOS_BUILD_NUMBER) transmis à App Store Connect."
echo "Attendez la fin du traitement Apple, puis activez-le dans TestFlight."
