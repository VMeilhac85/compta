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
    python3 - <<'PYTHON'
import os, subprocess, shutil
from pathlib import Path
root=Path(os.environ['CAPTURE_TEMP'])
if (root/'devices.txt').exists():
    for device in (root/'devices.txt').read_text().splitlines():
        for action in ['shutdown','delete']:
            try: subprocess.run(['xcrun','simctl',action,device],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=20)
            except subprocess.TimeoutExpired: pass
shutil.rmtree(root,ignore_errors=True)
PYTHON
}
trap cleanup EXIT
IOS_DERIVED_DATA_PATH="$CAPTURE_TEMP/DerivedData" "$SCRIPT_DIR/build.sh"
APP_PATH="$(python3 - <<'PYTHON'
import os, plistlib
from pathlib import Path
root=Path(os.environ['CAPTURE_TEMP'])/'DerivedData/Build/Products/Debug-iphonesimulator'
apps=[p for p in root.glob('*.app') if (p/'Info.plist').is_file() and plistlib.loads((p/'Info.plist').read_bytes()).get('CFBundleIdentifier')=='expert.meilhac.maisonpilote']
assert len(apps)==1, 'Le binaire iOS de capture doit être identifié sans ambiguïté.'
print(apps[0])
PYTHON
)"
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
python3 - <<'PYTHON'
import os, plistlib, subprocess
from pathlib import Path
root=Path(os.environ['CAPTURE_TEMP'])
app=Path(os.environ['APP_PATH'])
team=os.environ['IOS_DEVELOPMENT_TEAM']
bundles=sorted(app.rglob('*.appex'),key=lambda p:len(p.parts),reverse=True)+sorted(app.rglob('*.app'),key=lambda p:len(p.parts),reverse=True)+[app,root/'SessionSeed.app']
for index,bundle in enumerate(bundles):
    bundle_id=plistlib.loads((bundle/'Info.plist').read_bytes())['CFBundleIdentifier']
    entitlements={'application-identifier':team+'.'+bundle_id,'com.apple.developer.team-identifier':team,
                  'keychain-access-groups':[team+'.'+bundle_id],
                  'com.apple.security.application-groups':['group.expert.meilhac.maisonpilote']}
    path=root/f'simulator-entitlements-{index}.plist'
    path.write_bytes(plistlib.dumps(entitlements))
    subprocess.run(['codesign','--force','--sign','-','--entitlements',str(path),str(bundle)],check=True)
PYTHON

python3 - <<'PYTHON'
import json, os, subprocess, time
from pathlib import Path
root=Path(os.environ['CAPTURE_TEMP'])
out=Path(os.environ['IOS_PREPARATION_DIRECTORY'])/'screenshots/fr-FR'
def run(*args, **kwargs):
    print('Capture native :', ' '.join(args), flush=True)
    return subprocess.check_output(list(args), text=True, timeout=360, **kwargs).strip()
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
    watch=None
    if label=='iphone':
        watch_runtime=next(r['identifier'] for r in catalog['runtimes'] if r.get('isAvailable') and '.watchOS-' in r['identifier'])
        watch_type=next(t for t in types if 'Apple Watch Series 11 (46mm)' in t['name'] or 'Apple Watch Series 10 (46mm)' in t['name'])
        watch=sim('create','Maison Pilote App Store Watch',watch_type['identifier'],watch_runtime)
        with (root/'devices.txt').open('a') as stream: stream.write(watch+'\n')
        sim('pair',watch,device)
    sim('boot',device);sim('bootstatus',device,'-b')
    sim('status_bar',device,'override','--time','9:41','--dataNetwork','wifi','--wifiMode','active','--wifiBars','3','--batteryState','charged','--batteryLevel','100')
    sim('install',device,str(root/'SessionSeed.app'))
    environment=dict(os.environ)
    environment['SIMCTL_CHILD_IOS_SCREENSHOT_SESSION']=environment.pop('IOS_SCREENSHOT_SESSION')
    sim('launch',device,'expert.meilhac.maisonpilote',env=environment)
    container=Path(sim('get_app_container',device,'expert.meilhac.maisonpilote','data'))
    for _ in range(40):
        if (container/'Documents/seed-status.json').exists(): break
        time.sleep(1)
    status=json.loads((container/'Documents/seed-status.json').read_text())
    assert status['status']==0, f"Échec de la session de démonstration : OSStatus {status['status']}"
    sim('terminate',device,'expert.meilhac.maisonpilote')
    sim('install',device,os.environ['APP_PATH'])
    sim('ui',device,'appearance','light')
    sim('launch',device,'expert.meilhac.maisonpilote','-AppleLanguages','(fr)','-AppleLocale','fr_FR')
    time.sleep(20)
    for number, (route,name) in enumerate([('accueil','accueil'),('documents','documents')],1):
        sim('openurl',device,'maisonpilote://app/'+route)
        time.sleep(8)
        filename=f'{label}-{number:02d}-{name}.png'
        sim('io',device,'screenshot','--type=png',str(out/filename))
        records.append({'filename':filename,'device':dtype['name'],'origin':'native-ios-simulator','route':route})
    if watch:
        sim('boot',watch);sim('bootstatus',watch,'-b')
        watch_app=Path(os.environ['APP_PATH'])/'Watch/MaisonPiloteWatch.app'
        if not watch_app.exists():
            watch_app=next((root/'DerivedData/Build/Products/Debug-watchsimulator').glob('*.app'))
        sim('install',watch,str(watch_app))
        sim('launch',watch,'expert.meilhac.maisonpilote.watchkitapp','-AppleLanguages','(fr)','-AppleLocale','fr_FR')
        time.sleep(20)
        sim('io',watch,'screenshot','--type=png',str(out/'watch-01-assistant.png'))
        records.append({'filename':'watch-01-assistant.png','device':watch_type['name'],'origin':'native-watchos-simulator'})
        sim('shutdown',watch)
    sim('shutdown',device)
(out.parent/'capture-manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
PYTHON
