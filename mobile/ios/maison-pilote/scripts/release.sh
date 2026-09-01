#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "La release iOS signée nécessite macOS et Xcode." >&2
    exit 69
fi

for command_name in python3 xcodebuild; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Commande macOS requise absente : $command_name" >&2
        exit 69
    fi
done

: "${MAISON_PILOTE_IOS_NEXT_VERSION_CODE:?Variable requise}"
: "${MAISON_PILOTE_IOS_RESULT_FILE:?Variable requise}"
: "${IOS_DEVELOPMENT_TEAM:?Variable requise}"

if [[ ! "$MAISON_PILOTE_IOS_NEXT_VERSION_CODE" =~ ^[1-9][0-9]*$ ]]; then
    echo "MAISON_PILOTE_IOS_NEXT_VERSION_CODE doit être un entier positif." >&2
    exit 64
fi
if [[ "$MAISON_PILOTE_IOS_RESULT_FILE" != /* ]]; then
    echo "MAISON_PILOTE_IOS_RESULT_FILE doit être un chemin absolu." >&2
    exit 64
fi
if [[ ! "$IOS_DEVELOPMENT_TEAM" =~ ^[A-Z0-9]{10}$ ]]; then
    echo "IOS_DEVELOPMENT_TEAM doit contenir 10 caractères alphanumériques." >&2
    exit 64
fi

# La version iOS reste explicitement alignée sur la prochaine version Android.
# Les publications suivantes reprennent ensuite l’ordinal strict du serveur.
VERSION_CODE="$MAISON_PILOTE_IOS_NEXT_VERSION_CODE"
if (( VERSION_CODE < 111 )); then
    VERSION_CODE=111
fi
MARKETING_VERSION="${IOS_MARKETING_VERSION:-1.$VERSION_CODE}"
BUILD_NUMBER="$VERSION_CODE"
if [[ ! "$MARKETING_VERSION" =~ ^[0-9]+(\.[0-9]+){1,2}$ ]]; then
    echo "IOS_MARKETING_VERSION doit respecter le format X.Y ou X.Y.Z." >&2
    exit 64
fi

BUNDLE_IDENTIFIER="${IOS_BUNDLE_IDENTIFIER:-expert.meilhac.maisonpilote}"
APP_GROUP_IDENTIFIER="${IOS_APP_GROUP_IDENTIFIER:-group.expert.meilhac.maisonpilote}"
ASSOCIATED_DOMAIN="${IOS_ASSOCIATED_DOMAIN:-maisonpilote.meilhac.expert}"
MINIMUM_OS_VERSION="${IOS_MINIMUM_OS_VERSION:-${MOBILE_IOS_MINIMUM_OS_VERSION:-16.4}}"
WATCH_MINIMUM_OS_VERSION="${IOS_WATCH_MINIMUM_OS_VERSION:-9.4}"
if [[ ! "$MINIMUM_OS_VERSION" =~ ^[0-9]+(\.[0-9]+){1,2}$ ]]; then
    echo "La version minimale iOS doit respecter le format X.Y ou X.Y.Z." >&2
    exit 64
fi
if [[ ! "$WATCH_MINIMUM_OS_VERSION" =~ ^[0-9]+(\.[0-9]+){1,2}$ ]]; then
    echo "La version minimale watchOS doit respecter le format X.Y ou X.Y.Z." >&2
    exit 64
fi
RESULT_DIRECTORY="$(cd -- "$(dirname -- "$MAISON_PILOTE_IOS_RESULT_FILE")" && pwd)"
OUTPUT_DIRECTORY="$(mktemp -d "$RESULT_DIRECTORY/maison-pilote-ios-native.XXXXXX")"
RELEASE_SUCCEEDED=false

cleanup_on_failure() {
    if [[ "$RELEASE_SUCCEEDED" != "true" ]]; then
        rm -rf -- "$OUTPUT_DIRECTORY"
    fi
}
trap cleanup_on_failure EXIT

write_testflight_result() {
    RESULT_VERSION_CODE="$VERSION_CODE" \
    RESULT_VERSION_NAME="$MARKETING_VERSION" \
    RESULT_BUILD_NUMBER="$BUILD_NUMBER" \
    RESULT_BUNDLE_IDENTIFIER="$BUNDLE_IDENTIFIER" \
    RESULT_TESTFLIGHT_URL="$TESTFLIGHT_URL" \
    RESULT_PROVIDER_BUILD_ID="${IOS_APP_STORE_CONNECT_PROVIDER_BUILD_ID:-}" \
    RESULT_MINIMUM_OS_VERSION="$MINIMUM_OS_VERSION" \
    RESULT_TEAM_IDENTIFIER="$IOS_DEVELOPMENT_TEAM" \
    RESULT_FILE="$MAISON_PILOTE_IOS_RESULT_FILE" \
    python3 - <<'PYTHON'
import json
import os
from pathlib import Path

payload = {
    "version_code": int(os.environ["RESULT_VERSION_CODE"]),
    "version_name": os.environ["RESULT_VERSION_NAME"],
    "build_number": os.environ["RESULT_BUILD_NUMBER"],
    "bundle_identifier": os.environ["RESULT_BUNDLE_IDENTIFIER"],
    "testflight_url": os.environ["RESULT_TESTFLIGHT_URL"],
    "minimum_os_version": os.environ["RESULT_MINIMUM_OS_VERSION"],
    "team_identifier": os.environ["RESULT_TEAM_IDENTIFIER"],
}
provider_build_id = os.environ.get("RESULT_PROVIDER_BUILD_ID", "").strip()
if provider_build_id:
    payload["provider_build_id"] = provider_build_id

path = Path(os.environ["RESULT_FILE"])
temporary = path.with_name(path.name + ".tmp")
temporary.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
temporary.chmod(0o600)
temporary.replace(path)
PYTHON
}

: "${IOS_APP_STORE_CONNECT_API_KEY_ID:?Variable requise pour TestFlight}"
: "${IOS_APP_STORE_CONNECT_ISSUER_ID:?Variable requise pour TestFlight}"
: "${IOS_APP_STORE_CONNECT_API_PRIVATE_KEY:?Variable requise pour TestFlight}"
TESTFLIGHT_URL="${IOS_TESTFLIGHT_URL:-${MOBILE_IOS_TESTFLIGHT_URL:-}}"
if [[ ! "$TESTFLIGHT_URL" =~ ^https://testflight\.apple\.com/join/[A-Za-z0-9]+/?$ ]]; then
    echo "IOS_TESTFLIGHT_URL doit être un lien public officiel TestFlight." >&2
    exit 64
fi

IOS_MARKETING_VERSION="$MARKETING_VERSION" \
IOS_BUILD_NUMBER="$BUILD_NUMBER" \
IOS_BUNDLE_IDENTIFIER="$BUNDLE_IDENTIFIER" \
IOS_APP_GROUP_IDENTIFIER="$APP_GROUP_IDENTIFIER" \
IOS_ASSOCIATED_DOMAIN="$ASSOCIATED_DOMAIN" \
IOS_MINIMUM_OS_VERSION="$MINIMUM_OS_VERSION" \
IOS_WATCH_MINIMUM_OS_VERSION="$WATCH_MINIMUM_OS_VERSION" \
IOS_ARCHIVE_PATH="$OUTPUT_DIRECTORY/archives" \
IOS_EXPORT_PATH="$OUTPUT_DIRECTORY/testflight-export" \
"$SCRIPT_DIR/release-testflight.sh"

write_testflight_result
RELEASE_SUCCEEDED=true
echo "Release iOS $MARKETING_VERSION ($BUILD_NUMBER) transmise à TestFlight."
