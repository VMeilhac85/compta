# Envoi TestFlight 1.131 (131) - 8 septembre 2026

**L’archive a été transmise à Apple avec l’autorisation du propriétaire.**
Le traitement est `VALID` et la version est affectée au groupe de test existant.
Au contrôle suivant l’envoi, la revue bêta est `WAITING_FOR_REVIEW` et l’état
externe est `WAITING_FOR_BETA_REVIEW`. La notification automatique des testeurs
est activée. La version n’est pas encore confirmée installable pour les testeurs
externes.

- Version : 1.131, build 131.
- Build Apple : `0c986500-33ad-4e3d-a5e8-159655d1cac3`.
- Envoi terminé le 8 septembre 2026 à 21:24:49 UTC.
- [Exécution de transmission réussie](https://github.com/VMeilhac85/compta/actions/runs/34280208233).
- [Accès à TestFlight](https://testflight.apple.com/join/Ubxzs62C).
- [Installation iPhone et Apple Watch](tester-sur-iphone.md).

L’IPA transmise est exactement celle du dossier préparé, sans nouvelle
compilation : empreinte SHA-256
`82fbcd4e95110a971d02e61c95af6584082b5990eeb752486b6573e86c93b6e8`.
Apple n’a signalé aucune erreur lors de la validation et de la transmission.
Les quatre cibles signées sont conservées, dont l’app Watch et son extension.

La liaison Apple Watch reste à vérifier sur une paire réelle. La fonction
d’assistance est réservée aux administrateurs. Ce point reste nécessaire avant
de considérer la préparation de la publication publique comme achevée.

## Conservation et reprise

Les reçus de validation, d’envoi et d’état Apple sont conservés dans
`storage/app/private/mobile/testflight/1.131-131`. Le dossier App Store et son
ZIP d’origine constituent la photographie de la préparation avant cet accord ;
le présent statut décrit la transmission ultérieure.

La commande de release attend actuellement la disponibilité externe avant
d’enregistrer une release active sur le serveur. Si la revue Apple dépasse
cette attente, reprendre le même build, sans nouvelle compilation ni nouvel
envoi, avec `mobile:ios:release --resume-provider-build-id=0c986500-33ad-4e3d-a5e8-159655d1cac3
--version-name=1.131 --build-number=131 --channel=beta` et les notes déjà validées.
La reprise demeure limitée à cette bêta autorisée.

Aucune version publique App Store n’a été soumise ni publiée. La revue bêta
et la publication publique sont deux étapes distinctes, comme le précise
l’[aide Apple sur les testeurs externes](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers).
