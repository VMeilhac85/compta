#!/usr/bin/env python3
"""Contrôle local du dossier à approuver, sans appel Apple ni modification du site."""
import argparse
import hashlib
import json
import plistlib
import struct
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
assert len(manifest["targets"]) == 4
assert all(target["signature_verified"] for target in manifest["targets"])
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
    assert not any(any(marker in name for marker in ("SessionSeed", "screenshot-session", "AppStoreCapture", ".xctest/"))
                   for name in archive.namelist())

sizes = {
    "iphone": {(1260, 2736), (1290, 2796), (1320, 2868)},
    "ipad": {(2064, 2752), (2048, 2732)},
    "watch": {(422, 514), (410, 502), (416, 496), (396, 484), (368, 448), (312, 390)},
}
captures = []
for family, accepted in sizes.items():
    images = sorted((root / "screenshots" / "fr-FR").glob(f"{family}-*.png"))
    assert images, f"Capture native manquante : {family}"
    for path in images:
        binary = path.read_bytes()
        assert binary[:8] == b"\x89PNG\r\n\x1a\n"
        dimensions = struct.unpack(">II", binary[16:24])
        assert dimensions in accepted, f"Dimensions Apple invalides : {path.name} {dimensions}"
        assert binary[25] in (0, 2), f"La capture {path.name} contient un canal alpha."
        captures.append({"filename": path.name, "width": dimensions[0], "height": dimensions[1],
                         "sha256": hashlib.sha256(binary).hexdigest()})
print(json.dumps({"local_package_valid": True, "version": metadata["version_name"],
                  "build": metadata["build_number"], "ipa_sha256": manifest["ipa_sha256"],
                  "captures": captures, "apple_submission_performed": False,
                  "visual_review_required": True}, ensure_ascii=False, indent=2))
