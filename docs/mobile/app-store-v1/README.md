# Maison Pilote - première publication App Store

La fiche **1.132 (132), iPhone/iPad sans Apple Watch**, a été renseignée dans App Store Connect le 9 septembre 2026 à la demande du propriétaire.

- Textes français, catégories Professionnel et Productivité, liens et copyright enregistrés.
- Quatre captures iPhone/iPad traitées `COMPLETE` par Apple.
- Téléchargement gratuit, territoire France et classification d’âge enregistrés.
- Contact, notes et compte de démonstration de revue enregistrés sans secret dans ce dépôt.
- Droits sur les contenus déclarés en tenant compte des documents utilisateurs et de l’autorisation des CGU, section 6.
- Sortie manuelle ; aucune soumission publique effectuée.

La nouvelle archive a été construite et signée sur macOS : [exécution réussie](https://github.com/VMeilhac85/compta/actions/runs/34288525935). Elle comprend uniquement l’app iPhone/iPad et l’extension de partage. Le contrôle local du package passe, notamment l’absence de Watch, les signatures, les versions et les quatre médias.

Les interfaces iPhone/iPad et Android ainsi que leurs émulateurs sont inchangés. La modification concerne le périmètre de distribution Apple et son numéro de version. Les 38 sources natives de capture ont été comparées aux sources de cette archive : seuls les numéros de version et les cibles/dépendances Watch retirées diffèrent. Les captures existantes restent représentatives ; elles ne sont pas présentées comme une nouvelle session de capture en 1.132.

## Ce qui reste

Les réponses au questionnaire de collecte des données doivent être enregistrées et publiées dans le site Apple. Le statut DSA et les éventuelles formalités du compte doivent également être vérifiés. Ces rubriques ne sont pas exposées par l’API officielle disponible ici ; aucune session web Apple connectée n’est disponible.

Le [guide précis des confirmations Apple](confirmer-compte-apple.md) contient les chemins d’écran et les réponses préparées.

L’archive 132 n’a pas été transmise : la demande actuelle autorise le remplissage de la fiche et la préparation, sans nouvelle transmission de version. Après la décision d’envoi, transmettre cette archive, attendre son traitement, l’associer à la fiche puis soumettre selon l’autorisation donnée. La mise en ligne publique reste soumise à la décision du propriétaire et à la revue Apple.

## Dossier de revue

- [Fiche française enregistrée](metadata.fr-FR.json)
- [Description](description.fr-FR.txt)
- [Confidentialité et revue](confidentialite-et-revue.md)
- [État des opérations et prochaines étapes](envoi-prepare.json)
- [Validation finale](validation-finale.md)
- [Rapport de validation](rapport-validation.md)

Archive privée : `storage/app/private/mobile/app-store/v1-1.132-132`.
Empreinte IPA : `d39d06f7e837d5c87eab601b4f24642965689637d157dc729da65579d3519040`.
Source native : `b946a7f2c2c188a8f26f397fddf747a01e9af3e1`.
Les reçus Apple expurgés des secrets sont dans le sous-dossier privé `apple-listing`.

Le build TestFlight **131**, transmis le 8 septembre, contient encore Apple Watch. Il constitue un envoi antérieur distinct et ne doit pas être associé à la fiche 1.132. Son [historique TestFlight](statut-testflight.md) et le [guide iPhone](tester-sur-iphone.md) restent disponibles. L’ancienne archive et son ZIP sont conservés.
