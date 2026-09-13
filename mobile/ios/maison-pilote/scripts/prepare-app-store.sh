#!/usr/bin/env bash
# Préparation locale uniquement : aucune commande de transmission à Apple.
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
[[ "$(uname -s)" == Darwin ]] || { echo "macOS et Xcode sont requis." >&2; exit 69; }
: "${IOS_DEVELOPMENT_TEAM:?Équipe Apple requise}"
: "${IOS_PREPARATION_DIRECTORY:?Répertoire de sortie absolu requis}"
: "${IOS_APP_PROVISIONING_PROFILE_SPECIFIER:?Profil application requis}"
: "${IOS_SHARE_PROVISIONING_PROFILE_SPECIFIER:?Profil partage requis}"
[[ "$IOS_PREPARATION_DIRECTORY" == /* && "$IOS_DEVELOPMENT_TEAM" =~ ^[A-Z0-9]{10}$ ]]
IOS_MARKETING_VERSION="${IOS_MARKETING_VERSION:-$(awk '/^MARKETING_VERSION = / { print $3 }' "$PROJECT_DIR/Config/Base.xcconfig")}"
IOS_BUILD_NUMBER="${IOS_BUILD_NUMBER:-$(awk '/^CURRENT_PROJECT_VERSION = / { print $3 }' "$PROJECT_DIR/Config/Base.xcconfig")}"
[[ "$IOS_MARKETING_VERSION" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ && "$IOS_BUILD_NUMBER" =~ ^[1-9][0-9]*$ ]]
for profile in "$IOS_APP_PROVISIONING_PROFILE_SPECIFIER" "$IOS_SHARE_PROVISIONING_PROFILE_SPECIFIER"; do
    [[ "$profile" =~ ^[0-9a-fA-F-]{36}$ ]]
done
export IOS_MARKETING_VERSION IOS_BUILD_NUMBER
mkdir -p "$IOS_PREPARATION_DIRECTORY"
ARCHIVE_PATH="$IOS_PREPARATION_DIRECTORY/MaisonPilote.xcarchive"
EXPORT_PATH="$IOS_PREPARATION_DIRECTORY/export"
export ARCHIVE_PATH EXPORT_PATH
"$SCRIPT_DIR/bootstrap.sh"

xcodebuild archive \
    -project "$PROJECT_DIR/MaisonPiloteIOS.xcodeproj" \
    -scheme MaisonPilote -configuration Release -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIVE_PATH" \
    "MAISON_PILOTE_DEVELOPMENT_TEAM=$IOS_DEVELOPMENT_TEAM" \
    "MARKETING_VERSION=$IOS_MARKETING_VERSION" "CURRENT_PROJECT_VERSION=$IOS_BUILD_NUMBER" \
    "MAISON_PILOTE_APP_PROVISIONING_PROFILE_SPECIFIER=$IOS_APP_PROVISIONING_PROFILE_SPECIFIER" \
    "MAISON_PILOTE_SHARE_PROVISIONING_PROFILE_SPECIFIER=$IOS_SHARE_PROVISIONING_PROFILE_SPECIFIER" \
    CODE_SIGN_STYLE=Manual 'CODE_SIGN_IDENTITY=Apple Distribution'

python3 - <<'PYTHON'
import os, plistlib
from pathlib import Path
bundle = 'expert.meilhac.maisonpilote'
profiles = dict(zip(
    [bundle, bundle+'.share'],
    [os.environ['IOS_'+key+'_PROVISIONING_PROFILE_SPECIFIER'] for key in ['APP', 'SHARE']]
))
options = {
    'destination': 'export', 'method': 'app-store-connect',
    'manageAppVersionAndBuildNumber': False, 'signingStyle': 'manual',
    'signingCertificate': 'Apple Distribution', 'teamID': os.environ['IOS_DEVELOPMENT_TEAM'],
    'provisioningProfiles': profiles, 'stripSwiftSymbols': True, 'uploadSymbols': False,
}
path = Path(os.environ['IOS_PREPARATION_DIRECTORY'])/'ExportOptions.plist'
path.write_bytes(plistlib.dumps(options))
PYTHON

xcodebuild -exportArchive -archivePath "$ARCHIVE_PATH" -exportPath "$EXPORT_PATH" \
    -exportOptionsPlist "$IOS_PREPARATION_DIRECTORY/ExportOptions.plist"

python3 - <<'PYTHON'
import datetime, hashlib, json, os, plistlib, subprocess, tempfile, zipfile
from pathlib import Path
root = Path(os.environ['IOS_PREPARATION_DIRECTORY'])
ipas = list((root/'export').glob('*.ipa'))
assert len(ipas) == 1, 'Une seule IPA signée est attendue.'
checks = []
with tempfile.TemporaryDirectory() as temporary:
    with zipfile.ZipFile(ipas[0]) as archive:
        archive.extractall(temporary)
    application = next((Path(temporary)/'Payload').glob('*.app'))
    bundles = [application] + sorted(application.rglob('*.app')) + sorted(application.rglob('*.appex'))
    assert len(bundles) == 2, 'Seules les cibles iPhone/iPad et partage sont attendues.'
    assert not (application/'Watch').exists(), 'Apple Watch est exclue de cette publication.'
    for bundle in bundles:
        subprocess.run(['codesign', '--verify', '--deep', '--strict', str(bundle)], check=True)
        info = plistlib.loads((bundle/'Info.plist').read_bytes())
        assert info['CFBundleVersion'] == os.environ['IOS_BUILD_NUMBER']
        assert info['CFBundleShortVersionString'] == os.environ['IOS_MARKETING_VERSION']
        profile = plistlib.loads(subprocess.check_output(['security', 'cms', '-D', '-i', str(bundle/'embedded.mobileprovision')]))
        assert profile['TeamIdentifier'] == [os.environ['IOS_DEVELOPMENT_TEAM']]
        assert profile['ExpirationDate'] > datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
        assert profile['Entitlements'].get('get-task-allow') is False
        assert not profile.get('ProvisionedDevices') and not profile.get('ProvisionsAllDevices')
        assert profile['Entitlements']['application-identifier'].endswith('.'+info['CFBundleIdentifier'])
        checks.append({'bundle_id': info['CFBundleIdentifier'], 'signature_verified': True,
                       'profile_expires_at_utc': profile['ExpirationDate'].isoformat()+'Z'})
    assert plistlib.loads((application/'Info.plist').read_bytes())['ITSAppUsesNonExemptEncryption'] is False
payload = {
    'version_name': os.environ['IOS_MARKETING_VERSION'], 'version_code': int(os.environ['IOS_BUILD_NUMBER']),
    'prepared_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'apple_upload_performed': False, 'app_store_server_validation_performed': False,
    'ipa_filename': ipas[0].name, 'ipa_sha256': hashlib.sha256(ipas[0].read_bytes()).hexdigest(),
    'source_commit': os.environ.get('GITHUB_SHA'), 'targets': checks,
}
(root/'preparation-result.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(payload, ensure_ascii=False))
PYTHON
echo "Archive et IPA signées contrôlées localement. Transmission à Apple non effectuée."
