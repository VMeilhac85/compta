#!/usr/bin/env bash
# Captures du véritable contrôleur UIKit de partage avec données de démonstration.
# Aucun compte, aucun envoi de document et aucune transmission aux stores.
set -euo pipefail
umask 077
[[ "$(uname -s)" == Darwin ]] || { echo "macOS et Xcode sont requis." >&2; exit 69; }
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
: "${IOS_CORRECTIONS_CAPTURE_DIRECTORY:?Répertoire de captures requis}"
export PROJECT_DIR

python3 - <<'PYTHON'
import datetime, hashlib, json, os, shutil, subprocess, tempfile, time
from pathlib import Path

project = Path(os.environ['PROJECT_DIR'])
output = Path(os.environ['IOS_CORRECTIONS_CAPTURE_DIRECTORY'])
output.mkdir(parents=True, exist_ok=True)
source = project / 'ShareExtension/ShareViewController.swift'
bundle = 'expert.meilhac.maisonpilote.capture.receipt'

def run(*args, timeout=600):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT, timeout=timeout).strip()

with tempfile.TemporaryDirectory(prefix='maison-pilote-receipt-') as temporary:
    work = Path(temporary)
    native = work / 'Sources'
    native.mkdir()
    # Append a fixture accessor only to the temporary copy. Private members stay
    # accessible in a same-file extension; production sources and logic are intact.
    (native / 'ShareViewController.swift').write_text(source.read_text() + '''
extension ShareViewController {
    static func receiptForCapture(_ scenario: String) -> ShareViewController {
        let controller = ShareViewController()
        controller.loadViewIfNeeded()
        controller.importStarted = true
        let receipts: [Receipt]
        switch scenario {
        case "complete":
            receipts = [Receipt(name: "Facture-fournisseur.pdf", failure: nil),
                        Receipt(name: "Justificatif-de-transport.pdf", failure: nil)]
        case "impossible":
            receipts = [Receipt(name: "Document-iCloud.pdf", failure: .unavailable)]
        case "limit":
            receipts = (1...20).map { Receipt(name: "Justificatif-\\($0).pdf", failure: nil) }
                + [Receipt(name: "Justificatif-21.pdf", failure: .overLimit)]
        default:
            receipts = [Receipt(name: "Facture-fournisseur.pdf", failure: nil),
                        Receipt(name: "Justificatif-de-transport.pdf", failure: nil),
                        Receipt(name: "Document-iCloud.pdf", failure: .unavailable)]
        }
        controller.showReceipt(receipts, received: receipts.filter { $0.failure == nil }.count)
        return controller
    }
}
''')
    for name in ['ShareInboxModels.swift', 'SharedContainer.swift']:
        shutil.copy2(project / 'Shared' / name, native / name)
    (native / 'CaptureApp.swift').write_text('''
import UIKit

@main
final class CaptureApp: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        let scenario = ProcessInfo.processInfo.arguments.last ?? "partial"
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = ShareViewController.receiptForCapture(scenario)
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}
''')
    spec = {
        'name': 'ReceiptCapture',
        'targets': {'ReceiptCapture': {
            'type': 'application', 'platform': 'iOS', 'deploymentTarget': '16.4',
            'sources': ['Sources'],
            'info': {'path': 'Info.plist', 'properties': {
                'CFBundleDisplayName': 'Maison Pilote',
                'UILaunchScreen': {},
                'UISupportedInterfaceOrientations': ['UIInterfaceOrientationPortrait'],
            }},
            'settings': {'base': {
                'PRODUCT_BUNDLE_IDENTIFIER': bundle, 'SWIFT_VERSION': '5.0',
                'TARGETED_DEVICE_FAMILY': '1,2', 'CODE_SIGN_IDENTITY': '-',
                'CODE_SIGNING_ALLOWED': 'YES',
            }},
        }},
    }
    (work / 'project.json').write_text(json.dumps(spec))
    run('xcodegen', 'generate', '--spec', str(work / 'project.json'))
    log = output / 'native-capture-build.log'
    command = ['xcodebuild', '-project', str(work / 'ReceiptCapture.xcodeproj'),
               '-scheme', 'ReceiptCapture', '-configuration', 'Debug',
               '-destination', 'generic/platform=iOS Simulator',
               '-derivedDataPath', str(work / 'DerivedData'), 'build']
    with log.open('w') as stream:
        result = subprocess.run(command, stdout=stream, stderr=subprocess.STDOUT, timeout=600)
    if result.returncode:
        print('\n'.join(log.read_text().splitlines()[-80:]))
        raise SystemExit(result.returncode)

    catalog = json.loads(run('xcrun', 'simctl', 'list', '--json'))
    runtime = next(item['identifier'] for item in catalog['runtimes']
                   if item.get('isAvailable') and '.iOS-' in item['identifier'])
    device_type = next(item['identifier'] for item in catalog['devicetypes']
                       if item['name'] == 'iPhone 16 Pro')
    device = run('xcrun', 'simctl', 'create', 'Maison Pilote - Bilan partage', device_type, runtime)
    records = []
    try:
        run('xcrun', 'simctl', 'boot', device)
        run('xcrun', 'simctl', 'bootstatus', device, '-b')
        run('xcrun', 'simctl', 'status_bar', device, 'override', '--time', '9:41',
            '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3',
            '--batteryState', 'charged', '--batteryLevel', '100')
        run('xcrun', 'simctl', 'ui', device, 'appearance', 'light')
        application = work / 'DerivedData/Build/Products/Debug-iphonesimulator/ReceiptCapture.app'
        run('xcrun', 'simctl', 'install', device, str(application))
        for scenario in ['complete', 'partial', 'impossible', 'limit']:
            if records:
                run('xcrun', 'simctl', 'terminate', device, bundle)
            run('xcrun', 'simctl', 'launch', device, bundle, scenario)
            time.sleep(2)
            filename = 'ios-c09-' + scenario + '.png'
            run('xcrun', 'simctl', 'io', device, 'screenshot', str(output / filename))
            records.append({'scenario': scenario, 'filename': filename})
    finally:
        subprocess.run(['xcrun', 'simctl', 'shutdown', device], capture_output=True, timeout=60)
        subprocess.run(['xcrun', 'simctl', 'delete', device], capture_output=True, timeout=60)
    manifest = {
        'captured_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'provenance': 'Actual UIKit ShareViewController in an isolated simulator capture host',
        'data': 'Demonstration fixtures; no live document import or account',
        'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'source_commit': os.environ.get('GITHUB_SHA'), 'runtime': runtime,
        'captures': records, 'store_upload_performed': False,
    }
    (output / 'capture-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(manifest, ensure_ascii=False))
PYTHON
