#!/usr/bin/env bash
# Captures de l'application native inchangée, sur des simulateurs temporaires.
set -euo pipefail
umask 077
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
: "${IOS_PREPARATION_DIRECTORY:?Répertoire de préparation requis}"
: "${IOS_SCREENSHOT_SESSION:?Session de démonstration temporaire requise}"
CAPTURE_TEMP="$(mktemp -d "${TMPDIR:-/tmp}/maison-pilote-captures.XXXXXX")"
export CAPTURE_TEMP
cleanup() {
    if [[ -f "$CAPTURE_TEMP/devices.txt" ]]; then
        while IFS= read -r device; do
            xcrun simctl shutdown "$device" >/dev/null 2>&1 || true
            xcrun simctl delete "$device" >/dev/null 2>&1 || true
        done < "$CAPTURE_TEMP/devices.txt"
    fi
    rm -rf -- "$CAPTURE_TEMP"
}
trap cleanup EXIT
IOS_DERIVED_DATA_PATH="$CAPTURE_TEMP/DerivedData" "$SCRIPT_DIR/build.sh"
APP_PATH="$CAPTURE_TEMP/DerivedData/Build/Products/Debug-iphonesimulator/MaisonPilote.app"
[[ -d "$APP_PATH" ]]
export APP_PATH
mkdir -p "$IOS_PREPARATION_DIRECTORY/screenshots/fr-FR"

# Le petit outil de session est installé puis remplacé par le vrai binaire.
# Il n'est jamais inclus dans l'archive signée ni dans les captures livrées.
mkdir -p "$CAPTURE_TEMP/SessionSeed.app"
SDK_PATH="$(xcrun --sdk iphonesimulator --show-sdk-path)"
xcrun --sdk iphonesimulator swiftc -sdk "$SDK_PATH" \
    -target "$(uname -m)-apple-ios16.4-simulator" \
    "$SCRIPT_DIR/screenshot-session-seed.swift" -o "$CAPTURE_TEMP/SessionSeed.app/SessionSeed"
python3 - <<'PYTHON'
import os, plistlib
from pathlib import Path
root=Path(os.environ['CAPTURE_TEMP'])/'SessionSeed.app'
(root/'Info.plist').write_bytes(plistlib.dumps({
 'CFBundleIdentifier':'expert.meilhac.maisonpilote', 'CFBundleExecutable':'SessionSeed',
 'CFBundleName':'SessionSeed', 'CFBundlePackageType':'APPL', 'CFBundleVersion':'1',
 'CFBundleShortVersionString':'1.0', 'LSRequiresIPhoneOS':True,
 'MinimumOSVersion':'16.4', 'UIDeviceFamily':[1,2],
}))
PYTHON
codesign --force --sign - "$CAPTURE_TEMP/SessionSeed.app"

python3 - <<'PYTHON'
import json, os, subprocess, time
from pathlib import Path
root=Path(os.environ['CAPTURE_TEMP'])
out=Path(os.environ['IOS_PREPARATION_DIRECTORY'])/'screenshots/fr-FR'
def run(*args, **kwargs):
    return subprocess.check_output(list(args), text=True, **kwargs).strip()
def sim(*args, **kwargs): return run('xcrun','simctl',*args, **kwargs)
catalog=json.loads(sim('list','--json'))
runtime=next(r['identifier'] for r in catalog['runtimes'] if r.get('isAvailable') and '.iOS-' in r['identifier'])
types=catalog['devicetypes']
iphone=next(t for t in types if t['name'] in ['iPhone 17 Pro Max','iPhone 16 Pro Max'])
ipad=next(t for t in types if 'iPad Pro 13-inch' in t['name'])
records=[]
for label, dtype in [('iphone',iphone),('ipad',ipad)]:
    device=sim('create','Maison Pilote App Store '+label,dtype['identifier'],runtime)
    with (root/'devices.txt').open('a') as stream: stream.write(device+'\n')
    sim('boot',device);sim('bootstatus',device,'-b')
    sim('status_bar',device,'override','--time','9:41','--dataNetwork','wifi','--wifiMode','active','--wifiBars','3','--batteryState','charged','--batteryLevel','100')
    sim('install',device,str(root/'SessionSeed.app'))
    environment=dict(os.environ)
    environment['SIMCTL_CHILD_IOS_SCREENSHOT_SESSION']=environment.pop('IOS_SCREENSHOT_SESSION')
    sim('launch',device,'expert.meilhac.maisonpilote',env=environment)
    time.sleep(3)
    container=Path(sim('get_app_container',device,'expert.meilhac.maisonpilote','data'))
    status=json.loads((container/'Documents/seed-status.json').read_text())
    assert status['status']==0, 'Échec du chargement de la session de démonstration.'
    sim('terminate',device,'expert.meilhac.maisonpilote')
    sim('install',device,os.environ['APP_PATH'])
    sim('ui',device,'appearance','light')
    sim('launch',device,'expert.meilhac.maisonpilote','-AppleLanguages','(fr)','-AppleLocale','fr_FR')
    time.sleep(20)
    for number, (route,name) in enumerate([('accueil','accueil'),('documents','documents')],1):
        sim('openurl',device,'https://maisonpilote.fr/app/'+route)
        time.sleep(8)
        filename=f'{label}-{number:02d}-{name}.png'
        sim('io',device,'screenshot','--type=png',str(out/filename))
        records.append({'filename':filename,'device':dtype['name'],'origin':'native-ios-simulator','route':route})
    sim('shutdown',device)
(out.parent/'capture-manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
PYTHON
