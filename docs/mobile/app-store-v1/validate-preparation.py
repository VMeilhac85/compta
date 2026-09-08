#!/usr/bin/env python3
"""Contrôle local du dossier à approuver, sans appel Apple ni modification du site."""
import argparse
import hashlib
import json
import plistlib
import re
import struct
import sys
import tarfile
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("artifact_directory", type=Path)
args = parser.parse_args()
root = args.artifact_directory.resolve()
metadata = json.loads((Path(__file__).parent / "metadata.fr-FR.json").read_text())
manifest = json.loads((root / "preparation-result.json").read_text())
assert manifest["version_name"] == metadata["version_name"]
assert manifest["version_code"] == metadata["build_number"]
assert manifest["apple_upload_performed"] is False
assert manifest["app_store_server_validation_performed"] is False
include_watch = metadata.get("include_apple_watch", True)
expected_target_count = 4 if include_watch else 2
assert len(manifest["targets"]) == expected_target_count
assert all(target["signature_verified"] for target in manifest["targets"])
capture_manifest = json.loads((root / "screenshots" / "capture-manifest.json").read_text())
capture_equivalence_verified = False
if (capture_manifest["version_name"], capture_manifest["version_code"], capture_manifest["source_commit"]) != (
        metadata["version_name"], metadata["build_number"], manifest["source_commit"]):
    proof = json.loads((root / "capture-source-equivalence.json").read_text())
    for prefix, expected in (("release", manifest), ("capture", capture_manifest)):
        for field in ("source_commit", "version_name", "version_code"):
            assert proof[f"{prefix}_{field}"] == expected[field]
    def native_member(member):
        return member.isfile() and member.name.startswith("mobile/ios/maison-pilote/") and (
            member.name.endswith((".swift", ".xcconfig", ".plist", ".xcprivacy", ".entitlements", "project.yml"))
            or "/Assets.xcassets/" in member.name)
    with tarfile.open(root / "sources.tar.gz") as release_sources, tarfile.open(
            root / "screenshots" / "capture-sources.tar.gz") as capture_sources:
        release_names = {m.name for m in release_sources.getmembers() if native_member(m)}
        capture_names = {m.name for m in capture_sources.getmembers() if native_member(m)}
        assert release_names and release_names == capture_names
        for name in sorted(release_names):
            released = release_sources.extractfile(name).read()
            captured = capture_sources.extractfile(name).read()
            if name.endswith("/Config/Base.xcconfig"):
                pattern = rb"(?m)^(MARKETING_VERSION|CURRENT_PROJECT_VERSION) = .*$"
                released = re.sub(pattern, rb"\1 = VERSION", released)
                captured = re.sub(pattern, rb"\1 = VERSION", captured)
            if name.endswith("/project.yml") and not include_watch:
                def without_watch(raw):
                    text = raw.decode()
                    if "  MaisonPiloteWatch:\n" in text:
                        start = text.index("  MaisonPiloteWatch:\n")
                        end = text.index("\nschemes:", start)
                        text = text[:start] + text[end:]
                    return text.replace("      - target: MaisonPiloteWatch\n", "").replace("        MaisonPiloteWatch: all\n", "").replace("        MaisonPiloteWatchExtension: all\n", "").encode()
                released, captured = without_watch(released), without_watch(captured)
            assert released == captured, f"Sources natives de capture différentes : {name}"
    capture_equivalence_verified = True
for field, maximum in {"name": 30, "subtitle": 30, "description": 4000,
                       "promotional_text": 170, "keywords": 100, "review_notes": 4000}.items():
    assert 0 < len(metadata[field]) <= maximum, f"Longueur invalide : {field}"
ipa = root / "export" / manifest["ipa_filename"]
assert hashlib.sha256(ipa.read_bytes()).hexdigest() == manifest["ipa_sha256"]
with zipfile.ZipFile(ipa) as archive:
    info_path = next(name for name in archive.namelist()
                     if name.startswith("Payload/") and name.count("/") == 2 and name.endswith("/Info.plist"))
    info = plistlib.loads(archive.read(info_path))
    assert info["CFBundleIdentifier"] == metadata["bundle_id"]
    assert info["CFBundleShortVersionString"] == metadata["version_name"]
    assert info["CFBundleVersion"] == str(metadata["build_number"])
    assert info["ITSAppUsesNonExemptEncryption"] is False
    assert info["MaisonPiloteURLHost"] == "maisonpilote.fr"
    assert {"maisonpilote.fr", "maisonpilote.meilhac.expert"}.issubset(info["WKAppBoundDomains"])
    target_infos = [plistlib.loads(archive.read(name)) for name in archive.namelist()
                    if name.endswith((".app/Info.plist", ".appex/Info.plist"))]
    assert len(target_infos) == expected_target_count
    if not include_watch:
        assert not any("/Watch/" in name for name in archive.namelist())
    for target in target_infos:
        assert target["CFBundleShortVersionString"] == metadata["version_name"]
        assert target["CFBundleVersion"] == str(metadata["build_number"])
        assert int(target["DTXcode"]) >= 2600
        sdk = target["DTSDKName"].removeprefix("iphoneos").removeprefix("watchos")
        assert int(sdk.split(".")[0]) >= 26
    assert not any(any(marker in name for marker in ("SessionSeed", "screenshot-session", "AppStoreCapture", ".xctest/"))
                   for name in archive.namelist())

sizes = {
    "iphone": {(1260, 2736), (1290, 2796), (1320, 2868)},
    "ipad": {(2064, 2752), (2048, 2732)},
    "watch": {(422, 514), (410, 502), (416, 496), (396, 484), (368, 448), (312, 390)},
}
captures = []
missing_families = []
for family, accepted in sizes.items():
    if family == "watch" and not include_watch:
        continue
    images = sorted((root / "screenshots" / "fr-FR").glob(f"{family}-*.png"))
    if not images:
        missing_families.append(family)
    for path in images:
        binary = path.read_bytes()
        assert binary[:8] == b"\x89PNG\r\n\x1a\n"
        dimensions = struct.unpack(">II", binary[16:24])
        assert dimensions in accepted, f"Dimensions Apple invalides : {path.name} {dimensions}"
        assert binary[25] in (0, 2), f"La capture {path.name} contient un canal alpha."
        captures.append({"filename": path.name, "width": dimensions[0], "height": dimensions[1],
                         "sha256": hashlib.sha256(binary).hexdigest()})
print(json.dumps({"local_package_valid": not missing_families, "signed_binary_valid": True,
                  "missing_native_screenshot_families": missing_families, "version": metadata["version_name"],
                  "build": metadata["build_number"], "ipa_sha256": manifest["ipa_sha256"],
                  "captured_native_version": capture_manifest["version_name"],
                  "native_source_equivalence_verified": capture_equivalence_verified,
                  "captures": captures, "apple_submission_performed": False,
                  "visual_review_required": True}, ensure_ascii=False, indent=2))
sys.exit(1 if missing_families else 0)
