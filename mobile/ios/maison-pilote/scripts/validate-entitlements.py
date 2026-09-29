#!/usr/bin/env python3
"""Check the rights actually signed into an iOS archive, before distribution."""
import argparse
import json
import plistlib
import struct
import subprocess
import sys
import zipfile
from pathlib import Path

GROUPS = 'com.apple.security.application-groups'
DOMAINS = 'com.apple.developer.associated-domains'
SIRI = 'com.apple.developer.siri'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def signed_entitlements(data):
    # Device archives contain arm64 Mach-O files. Also inspect every slice of
    # a universal file so that one architecture cannot hide missing rights.
    magic = struct.unpack_from('>I', data)[0]
    if magic in (0xcafebabe, 0xcafebabf):
        wide = magic == 0xcafebabf
        count = struct.unpack_from('>I', data, 4)[0]
        require(0 < count < 32, 'Table d’architectures invalide.')
        rights = []
        for index in range(count):
            start, length = struct.unpack_from('>QQ' if wide else '>II', data, 8 + index * (32 if wide else 20) + 8)
            rights.extend(signed_entitlements(data[start:start + length]))
        return rights
    require(magic in (0xcffaedfe, 0xcefaedfe), 'Exécutable Mach-O non reconnu.')
    offset = 32 if magic == 0xcffaedfe else 28
    count = struct.unpack_from('<I', data, 16)[0]
    for _ in range(count):
        command, size = struct.unpack_from('<II', data, offset)
        require(size >= 8 and offset + size <= len(data), 'Commande Mach-O invalide.')
        if command == 0x1d:
            start, length = struct.unpack_from('<II', data, offset + 8)
            signature = data[start:start + length]
            smagic, _, slots = struct.unpack_from('>III', signature)
            require(smagic == 0xfade0cc0, 'Signature Mach-O invalide.')
            for index in range(slots):
                _, position = struct.unpack_from('>II', signature, 12 + index * 8)
                blob_magic, blob_length = struct.unpack_from('>II', signature, position)
                if blob_magic == 0xfade7171:
                    return [plistlib.loads(signature[position + 8:position + blob_length])]
        offset += size
    raise ValueError('Les droits signés sont absents de l’exécutable.')


def check_rights(rights, group, domains=None, source=False, provisioning=False):
    require(group in rights.get(GROUPS, []), 'Droit App Groups absent ou groupe incorrect : ' + group)
    if domains is not None:
        require(rights.get(SIRI) is True, 'Droit Siri absent.')
        require(rights.get('aps-environment') == ('$(MAISON_PILOTE_APNS_ENVIRONMENT)' if source else 'production'),
                'Droit de notification APNs de production absent.')
        allowed = rights.get(DOMAINS, [])
        # Apple profiles may permit all associated domains. The executable
        # itself must still carry the exact domains requested by the app.
        wildcard_profile = provisioning and (allowed == '*' or allowed == ['*'])
        require(wildcard_profile or set(domains) <= set(allowed), 'Domaines associés absents ou incorrects.')


def check_source(root):
    app = plistlib.loads((root / 'MaisonPilote/Resources/MaisonPilote.entitlements').read_bytes())
    share = plistlib.loads((root / 'ShareExtension/MaisonPiloteShare.entitlements').read_bytes())
    group = '$(MAISON_PILOTE_APP_GROUP_IDENTIFIER)'
    check_rights(app, group, ['applinks:$(MAISON_PILOTE_ASSOCIATED_DOMAIN)',
                              'applinks:$(MAISON_PILOTE_CANONICAL_ASSOCIATED_DOMAIN)'], source=True)
    check_rights(share, group)
    return {'source_entitlements_verified': True}


def check_bundles(read, names):
    bundles = sorted(n[:-11] for n in names if n.endswith('/Info.plist') and n[:-11].endswith(('.app', '.appex')))
    require(len(bundles) == 2, 'Les deux cibles application et partage sont attendues.')
    results = []
    for bundle in bundles:
        info = plistlib.loads(read(bundle + '/Info.plist'))
        group = info.get('MaisonPiloteAppGroupIdentifier', '')
        require(group.startswith('group.') and '$(' not in group, 'Identifiant App Group non résolu.')
        main = info.get('CFBundlePackageType') == 'APPL'
        domains = ['applinks:' + info[key] for key in ('MaisonPiloteCanonicalURLHost', 'MaisonPiloteURLHost')] if main else None
        rights = signed_entitlements(read(bundle + '/' + info['CFBundleExecutable']))
        for entitlement in rights:
            check_rights(entitlement, group, domains)
        profile_data = subprocess.run(['openssl', 'cms', '-verify', '-inform', 'DER', '-noverify'],
                                      input=read(bundle + '/embedded.mobileprovision'), capture_output=True, check=True).stdout
        profile = plistlib.loads(profile_data)['Entitlements']
        check_rights(profile, group, domains, provisioning=True)
        require(all(e.get('application-identifier') == profile.get('application-identifier') for e in rights),
                'L’identité signée diffère du profil Apple.')
        results.append({'bundle_id': info['CFBundleIdentifier'], 'version': info['CFBundleShortVersionString'],
                        'build': info['CFBundleVersion'], 'app_group': group, 'signed_rights_verified': True})
    require(len({r['app_group'] for r in results}) == 1, 'L’application et l’extension utilisent des groupes différents.')
    require(len({(r['version'], r['build']) for r in results}) == 1, 'Versions application et partage différentes.')
    return {'targets': results}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument('--source', type=Path)
    modes.add_argument('--archive', type=Path)
    modes.add_argument('--ipa', type=Path)
    args = parser.parse_args()
    if args.source:
        result = check_source(args.source)
    elif args.ipa:
        with zipfile.ZipFile(args.ipa) as archive:
            result = check_bundles(archive.read, archive.namelist())
    else:
        root = args.archive / 'Products/Applications'
        result = check_bundles(lambda name: (root / name).read_bytes(),
                               [p.relative_to(root).as_posix() for p in root.rglob('Info.plist')])
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, OSError, struct.error, subprocess.CalledProcessError) as error:
        print('Validation des autorisations iOS refusée : ' + str(error), file=sys.stderr)
        sys.exit(1)
