#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "Le build iOS nécessite macOS et Xcode." >&2
    exit 69
fi

if [[ ! -d "$PROJECT_DIR/MaisonPiloteIOS.xcodeproj" ]]; then
    "$SCRIPT_DIR/bootstrap.sh"
fi

CONFIGURATION="${IOS_CONFIGURATION:-Debug}"
SDK="${IOS_BUILD_SDK:-iphonesimulator}"
DESTINATION="${IOS_DESTINATION:-generic/platform=iOS Simulator}"
DERIVED_DATA="${IOS_DERIVED_DATA_PATH:-$PROJECT_DIR/.build/DerivedData}"
BUNDLE_IDENTIFIER="${IOS_BUNDLE_IDENTIFIER:-expert.meilhac.maisonpilote}"
APP_GROUP_IDENTIFIER="${IOS_APP_GROUP_IDENTIFIER:-group.expert.meilhac.maisonpilote}"
ASSOCIATED_DOMAIN="${IOS_ASSOCIATED_DOMAIN:-maisonpilote.meilhac.expert}"
MINIMUM_OS_VERSION="${IOS_MINIMUM_OS_VERSION:-${MOBILE_IOS_MINIMUM_OS_VERSION:-16.4}}"
WATCH_MINIMUM_OS_VERSION="${IOS_WATCH_MINIMUM_OS_VERSION:-9.4}"
MARKETING_VERSION="${IOS_MARKETING_VERSION:-1.111}"
BUILD_NUMBER="${IOS_BUILD_NUMBER:-111}"

SIGNING_ARGUMENTS=(CODE_SIGNING_ALLOWED=NO)
if [[ "$SDK" == "iphoneos" ]]; then
    : "${IOS_DEVELOPMENT_TEAM:?IOS_DEVELOPMENT_TEAM est requis pour un build appareil}"
    DESTINATION="${IOS_DESTINATION:-generic/platform=iOS}"
    SIGNING_ARGUMENTS=(
        "MAISON_PILOTE_DEVELOPMENT_TEAM=$IOS_DEVELOPMENT_TEAM"
        CODE_SIGN_STYLE=Automatic
        -allowProvisioningUpdates
    )
fi

xcodebuild \
    -project "$PROJECT_DIR/MaisonPiloteIOS.xcodeproj" \
    -scheme MaisonPilote \
    -configuration "$CONFIGURATION" \
    -sdk "$SDK" \
    -destination "$DESTINATION" \
    -derivedDataPath "$DERIVED_DATA" \
    "MAISON_PILOTE_BUNDLE_IDENTIFIER=$BUNDLE_IDENTIFIER" \
    "MAISON_PILOTE_APP_GROUP_IDENTIFIER=$APP_GROUP_IDENTIFIER" \
    "MAISON_PILOTE_ASSOCIATED_DOMAIN=$ASSOCIATED_DOMAIN" \
    "IPHONEOS_DEPLOYMENT_TARGET=$MINIMUM_OS_VERSION" \
    "WATCHOS_DEPLOYMENT_TARGET=$WATCH_MINIMUM_OS_VERSION" \
    "MAISON_PILOTE_WATCH_MINIMUM_OS_VERSION=$WATCH_MINIMUM_OS_VERSION" \
    "MARKETING_VERSION=$MARKETING_VERSION" \
    "CURRENT_PROJECT_VERSION=$BUILD_NUMBER" \
    "${SIGNING_ARGUMENTS[@]}" \
    clean build

echo "Build iOS terminé dans $DERIVED_DATA"
