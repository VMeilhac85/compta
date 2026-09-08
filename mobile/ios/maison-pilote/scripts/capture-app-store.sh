#!/usr/bin/env bash
# Un parcours de capture natif : connexion de démonstration puis Documents.
set -euo pipefail
umask 077
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
IOS_MARKETING_VERSION="$(awk '/^MARKETING_VERSION = / { print $3 }' "$PROJECT_DIR/Config/Base.xcconfig")"
IOS_BUILD_NUMBER="$(awk '/^CURRENT_PROJECT_VERSION = / { print $3 }' "$PROJECT_DIR/Config/Base.xcconfig")"
export IOS_MARKETING_VERSION IOS_BUILD_NUMBER
: "${IOS_PREPARATION_DIRECTORY:?Répertoire de préparation requis}"
: "${IOS_SCREENSHOT_LOGIN:?Compte de démonstration requis}"
: "${IOS_SCREENSHOT_PASSWORD:?Secret de démonstration requis}"
CAPTURE_TEMP="$(mktemp -d "${TMPDIR:-/tmp}/maison-pilote-captures.XXXXXX")"
export CAPTURE_TEMP PROJECT_DIR SCRIPT_DIR
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
    rm -f -- "$PROJECT_DIR/capture-project.json"
}
trap cleanup EXIT

curl --connect-timeout 10 --max-time 30 --retry 1 -fsS -o /dev/null \
    -w 'Accès au site depuis macOS : HTTP %{http_code}, adresse %{remote_ip}\n' \
    'https://maisonpilote.fr/api/application-ios/test?native=1'

python3 - <<'PYTHON'
import json, os
from pathlib import Path
project=Path(os.environ['PROJECT_DIR'])
spec={
 'include':['project.yml'],
 'targets':{'MaisonPiloteCapture':{
  'type':'bundle.ui-testing','platform':'iOS','deploymentTarget':'16.4',
  'sources':[{'path':str(Path(os.environ['SCRIPT_DIR'])/'AppStoreCapture.swift')}],
  'dependencies':[{'target':'MaisonPilote'}],
  'settings':{'base':{'PRODUCT_BUNDLE_IDENTIFIER':'expert.meilhac.maisonpilote.capture','GENERATE_INFOPLIST_FILE':'YES','TEST_TARGET_NAME':'MaisonPilote'}},
 }},
 'schemes':{'MaisonPiloteCapture':{'build':{'targets':{'MaisonPilote':'all','MaisonPiloteCapture':'all'}},'test':{'targets':['MaisonPiloteCapture']}}},
}
(project/'capture-project.json').write_text(json.dumps(spec))
PYTHON
(cd "$PROJECT_DIR" && xcodegen generate --spec capture-project.json)
xcodebuild build-for-testing -project "$PROJECT_DIR/MaisonPiloteIOS.xcodeproj" \
    -scheme MaisonPiloteCapture -configuration Debug -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "$CAPTURE_TEMP/DerivedData" \
    "MARKETING_VERSION=$IOS_MARKETING_VERSION" "CURRENT_PROJECT_VERSION=$IOS_BUILD_NUMBER" \
    CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-

python3 - <<'PYTHON'
import datetime, json, os, plistlib, subprocess, time
from pathlib import Path
root=Path(os.environ['CAPTURE_TEMP'])
out=Path(os.environ['IOS_PREPARATION_DIRECTORY'])/'screenshots/fr-FR'
out.mkdir(parents=True,exist_ok=True)
def run(*args,timeout=360,**kwargs):
    print('Capture native :',' '.join(args),flush=True)
    try: return subprocess.check_output(list(args),text=True,timeout=timeout,**kwargs).strip()
    except subprocess.CalledProcessError as error:
        print('\n'.join((error.output or '').splitlines()[-45:]),flush=True)
        raise
def sim(*args):return run('xcrun','simctl',*args)
catalog=json.loads(sim('list','--json'))
runtime=next(r['identifier'] for r in catalog['runtimes'] if r.get('isAvailable') and '.iOS-' in r['identifier'])
watch_runtime=next(r['identifier'] for r in catalog['runtimes'] if r.get('isAvailable') and '.watchOS-' in r['identifier'])
find_type=lambda name:next(t for t in catalog['devicetypes'] if t['name']==name)
original_run=next((root/'DerivedData/Build/Products').glob('*.xctestrun'))
for product in (root/'DerivedData/Build/Products/Debug-iphonesimulator').glob('*.app'):
    info=plistlib.loads((product/'Info.plist').read_bytes())
    if info.get('CFBundleIdentifier')=='expert.meilhac.maisonpilote':
        assert info['CFBundleVersion']==os.environ['IOS_BUILD_NUMBER']
        assert info['CFBundleShortVersionString']==os.environ['IOS_MARKETING_VERSION']
        print('Configuration native du simulateur :',json.dumps({key:info.get(key) for key in ['CFBundleVersion','MaisonPiloteURLHost','MaisonPiloteURLPath','WKAppBoundDomains']}),flush=True)
records=[]
for family,dtype in [('iphone',find_type('iPhone 16 Pro Max')),('ipad',find_type('iPad Pro 13-inch (M4)'))]:
    device=sim('create','Maison Pilote App Store '+family,dtype['identifier'],runtime)
    with (root/'devices.txt').open('a') as stream:stream.write(device+'\n')
    watch=None
    if family=='iphone':
        watch_type=find_type('Apple Watch Series 10 (46mm)')
        watch=sim('create','Maison Pilote App Store Watch',watch_type['identifier'],watch_runtime)
        with (root/'devices.txt').open('a') as stream:stream.write(watch+'\n')
        pair=sim('pair',watch,device)
        try:
            sim('pair_activate',pair)
        except subprocess.CalledProcessError as error:
            # simctl pair active déjà la première paire ; EALREADY est attendu.
            if error.returncode != 37:
                raise
    sim('boot',device);sim('bootstatus',device,'-b')
    sim('status_bar',device,'override','--time','9:41','--dataNetwork','wifi','--wifiMode','active','--wifiBars','3','--batteryState','charged','--batteryLevel','100')
    # Contrat xcodebuild : TEST_RUNNER_ transmet la variable au processus XCTest.
    test_environment=dict(os.environ)
    test_environment.update({
        'TEST_RUNNER_IOS_SCREENSHOT_LOGIN':os.environ['IOS_SCREENSHOT_LOGIN'],
        'TEST_RUNNER_IOS_SCREENSHOT_PASSWORD':os.environ['IOS_SCREENSHOT_PASSWORD'],
        'TEST_RUNNER_IOS_CAPTURE_FAMILY':family,
    })
    result_path=root/f'{family}.xcresult'
    test_failure=None
    try:
        run('xcodebuild','test-without-building','-xctestrun',str(original_run),'-destination',f'platform=iOS Simulator,id={device}',
            '-resultBundlePath',str(result_path),'-parallel-testing-enabled','NO','-maximum-concurrent-test-simulator-destinations','1',
            '-only-testing:MaisonPiloteCapture/AppStoreCapture/testCaptureScreens',timeout=600,env=test_environment)
    except subprocess.CalledProcessError as error:
        test_failure=error
    attachments=root/f'{family}-attachments'
    run('xcrun','xcresulttool','export','attachments','--path',str(result_path),'--output-path',str(attachments))
    exported=json.loads((attachments/'manifest.json').read_text())
    def attachments_in(value):
        if isinstance(value,dict):
            if 'exportedFileName' in value and 'suggestedHumanReadableName' in value:yield value
            for child in value.values():yield from attachments_in(child)
        elif isinstance(value,list):
            for child in value:yield from attachments_in(child)
    for attachment in attachments_in(exported):
        label=attachment['suggestedHumanReadableName']
        if family+'-diagnostic' in label:
            diagnostic_directory=out.parent/'diagnostics'
            diagnostic_directory.mkdir(exist_ok=True)
            (diagnostic_directory/(family+'-diagnostic.png')).write_bytes((attachments/attachment['exportedFileName']).read_bytes())
        for screen in ['01-accueil','02-documents']:
            if family+'-'+screen in label:
                filename=family+'-'+screen+'.png'
                (out/filename).write_bytes((attachments/attachment['exportedFileName']).read_bytes())
                records.append({'filename':filename,'device':dtype['name'],'origin':'native-ios-simulator'})
    if test_failure:
        raise RuntimeError('Le parcours natif a échoué ; consulter la capture de diagnostic.') from test_failure
    assert (out/f'{family}-01-accueil.png').exists() and (out/f'{family}-02-documents.png').exists(), 'Captures de connexion et Documents absentes.'
    if watch:
        sim('launch',device,'expert.meilhac.maisonpilote')
        sim('boot',watch);sim('bootstatus',watch,'-b')
        products=root/'DerivedData/Build/Products/Debug-watchsimulator'
        watch_app=next(p for p in products.glob('*.app') if plistlib.loads((p/'Info.plist').read_bytes()).get('CFBundleIdentifier')=='expert.meilhac.maisonpilote.watchkitapp')
        sim('install',watch,str(watch_app))
        sim('terminate',device,'expert.meilhac.maisonpilote')
        sim('launch',device,'expert.meilhac.maisonpilote')
        time.sleep(3)
        sim('launch',watch,'expert.meilhac.maisonpilote.watchkitapp')
        time.sleep(20)
        sim('terminate',watch,'expert.meilhac.maisonpilote.watchkitapp')
        sim('launch',watch,'expert.meilhac.maisonpilote.watchkitapp')
        # La liaison WatchConnectivity et la réponse HTTPS peuvent dépasser
        # dix secondes au premier démarrage du simulateur.
        time.sleep(70)
        sim('io',watch,'screenshot','--type=png',str(out/'watch-01-assistant.png'))
        records.append({'filename':'watch-01-assistant.png','device':watch_type['name'],'origin':'native-watchos-simulator'})
        sim('shutdown',watch)
    sim('shutdown',device)
(out.parent/'capture-manifest.json').write_text(json.dumps({
    'source_commit':os.environ.get('GITHUB_SHA'),
    'version_name':os.environ['IOS_MARKETING_VERSION'],
    'version_code':int(os.environ['IOS_BUILD_NUMBER']),
    'captured_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'screens':records,
},ensure_ascii=False,indent=2)+'\n')
PYTHON
