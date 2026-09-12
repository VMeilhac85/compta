#!/usr/bin/env bash
# Régression ciblée C07/C12/C14 : vraies implémentations Swift, Keychain isolé.
set -euo pipefail
umask 077
[[ "$(uname -s)" == Darwin ]] || { echo "macOS et Xcode sont requis." >&2; exit 69; }
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
: "${IOS_CORRECTIONS_CAPTURE_DIRECTORY:?Répertoire de validation requis}"
export PROJECT_DIR
python3 - <<'PYTHON'
import datetime, json, os, subprocess, tempfile, uuid
from pathlib import Path

project = Path(os.environ['PROJECT_DIR'])
output = Path(os.environ['IOS_CORRECTIONS_CAPTURE_DIRECTORY'])
output.mkdir(parents=True, exist_ok=True)
suffix = '.isolated-validation.' + str(uuid.uuid4())
navigation_service = 'expert.meilhac.maisonpilote.navigation' + suffix
draft_service = 'expert.meilhac.maisonpilote.drafts' + suffix
source = (project / 'MaisonPilote/Native/NativeNavigationInbox.swift').read_text().replace(
    'expert.meilhac.maisonpilote.navigation', navigation_service)
source += (project / 'MaisonPilote/Native/SecureDraftStore.swift').read_text().replace(
    'expert.meilhac.maisonpilote.drafts', draft_service)
source += '''
extension NativeNavigationInbox {
    static func restoredForValidation() -> NativeNavigationInbox { NativeNavigationInbox() }
    func ageForValidation() {
        state.pending = state.pending.map {
            Pending(id: $0.id, identity: $0.identity,
                    createdAt: Date().addingTimeInterval(-8 * 24 * 60 * 60),
                    detail: $0.detail, openedByUser: $0.openedByUser, isPush: $0.isPush)
        }
        persist()
    }
}

@main
struct NativeCorrectionValidation {
    @MainActor static func main() throws {
        defer {
            for service in ["NAVIGATION_SERVICE", "DRAFT_SERVICE"] {
                SecItemDelete([kSecClass as String: kSecClassGenericPassword,
                               kSecAttrService as String: service] as CFDictionary)
            }
        }
        let link = URL(string: "https://maisonpilote.fr/documents?dossier_id=7")!
        let inbox = NativeNavigationInbox.restoredForValidation()
        inbox.enqueue(url: link)
        precondition(inbox.next() == nil, "No navigation before identity confirmation")
        precondition(inbox.bindIdentity("42"))
        let id = inbox.next()!.id
        let restored = NativeNavigationInbox.restoredForValidation()
        precondition(restored.next() == nil)
        precondition(restored.bindIdentity("42"))
        precondition(restored.next()?.id == id, "Pending survives process-state reconstruction")
        precondition(!restored.acknowledge(id: UUID()), "Unrelated ACK is refused")
        precondition(restored.next()?.id == id)
        precondition(restored.acknowledge(id: id))
        let acknowledged = NativeNavigationInbox.restoredForValidation()
        precondition(acknowledged.bindIdentity("42"))
        precondition(acknowledged.next() == nil, "Successful ACK is durable")
        acknowledged.enqueue(url: link)
        acknowledged.suspendIdentity()
        precondition(acknowledged.next() == nil)
        precondition(acknowledged.bindIdentity("42"))
        precondition(acknowledged.next() != nil, "Temporary sign-in loss preserves pending")
        precondition(acknowledged.bindIdentity("99"))
        precondition(acknowledged.next() == nil, "Another owner cannot replay pending")
        acknowledged.clear()
        acknowledged.enqueuePush(detail: ["notification_id": "late", "deep_link": link.absoluteString], openedByUser: true)
        precondition(acknowledged.bindIdentity("42"))
        precondition(acknowledged.next() == nil, "APNs arriving after logout stays tied to old owner")
        let longLink = URL(string: "https://maisonpilote.fr/documents?ref=" + String(repeating: "a", count: 3_000))!
        acknowledged.enqueue(url: longLink)
        precondition(acknowledged.next()?.detail["url"] == longLink.absoluteString, "URL is never truncated")
        acknowledged.clear()
        precondition(acknowledged.bindIdentity("42"))
        for index in 0..<20 {
            acknowledged.enqueue(url: URL(string: "https://maisonpilote.fr/documents?id=\\(index)")!)
        }
        let first = acknowledged.next()!.id
        acknowledged.enqueuePush(detail: ["notification_id": "background"], openedByUser: false)
        precondition(acknowledged.next()?.id == first, "Background push never evicts a requested opening")
        var retained = 0
        while let pending = acknowledged.next() {
            precondition(acknowledged.acknowledge(id: pending.id)); retained += 1
        }
        precondition(retained == 20, "Inbox remains bounded")
        acknowledged.enqueue(url: link)
        acknowledged.ageForValidation()
        precondition(acknowledged.next() == nil, "Navigation expires after seven days")

        let drafts = SecureDraftStore()
        let key = "note:42:42:7:personal"
        _ = try drafts.write(identity: "42", key: key, value: "Note conservée\\nDeuxième ligne")
        let recoveredDrafts = try SecureDraftStore().read(identity: "42")
        precondition(recoveredDrafts[key] == "Note conservée\\nDeuxième ligne", "Draft survives store reconstruction")
        let otherOwner = try drafts.read(identity: "99")
        precondition(otherOwner.isEmpty, "Drafts never cross owners")
        do {
            _ = try drafts.write(identity: "42", key: key, value: String(repeating: "x", count: 131_073))
            preconditionFailure("Oversized draft must be rejected")
        } catch SecureDraftStore.StorageError.invalid { }
        let afterRejectedWrite = try drafts.read(identity: "42")
        precondition(afterRejectedWrite == recoveredDrafts, "Rejected write preserves existing draft")
        _ = try drafts.write(identity: "42", key: key, value: nil)
        let removed = try drafts.read(identity: "42")
        precondition(removed.isEmpty)
        print("Native navigation and secure drafts: isolated regression scenario passed.")
    }
}
'''.replace('NAVIGATION_SERVICE', navigation_service).replace('DRAFT_SERVICE', draft_service)
with tempfile.TemporaryDirectory(prefix='maison-pilote-native-check-') as temporary:
    work = Path(temporary)
    swift = work / 'NativeCorrectionValidation.swift'
    swift.write_text(source)
    log = output / 'native-contract-validation.log'
    with log.open('w') as stream:
        subprocess.run(['xcrun', 'swiftc', '-swift-version', '5', '-parse-as-library', str(swift),
                        '-o', str(work / 'validate')], check=True, stdout=stream, stderr=subprocess.STDOUT, timeout=120)
        subprocess.run([str(work / 'validate')], check=True, stdout=stream, stderr=subprocess.STDOUT, timeout=60)
    print(log.read_text())
    result = {
        'validated_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'source_commit': os.environ.get('GITHUB_SHA'),
        'scenario': 'Navigation persistence, correlated ACK, identity changes, expiry and secure draft isolation',
        'passed': True, 'keychain_namespace': 'Unique temporary namespace, removed after the scenario',
        'store_upload_performed': False,
    }
    (output / 'native-contract-validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
PYTHON
