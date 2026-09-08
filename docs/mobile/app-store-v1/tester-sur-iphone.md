# Tester Maison Pilote sur iPhone

1. Installer [TestFlight depuis l’App Store](https://apps.apple.com/app/testflight/id899247664).
2. Sur l’iPhone, ouvrir dans Safari le lien
   [Rejoindre la bêta Maison Pilote](https://testflight.apple.com/join/Ubxzs62C).
3. Choisir « Afficher dans TestFlight », accepter l’invitation, puis installer
   Maison Pilote.
4. Ouvrir Maison Pilote et se connecter avec son compte habituel autorisé pour
   l’accès mobile. Les identifiants Apple servent à TestFlight ; ceux de
   Maison Pilote servent à l’application.

Au contrôle du 8 septembre 2026, le groupe public contient la version **1.112
(112)**, approuvée pour la bêta et compatible avec **iOS 16.4 ou ultérieur**.
Son expiration est annoncée par Apple au 30 novembre 2026. Le groupe est ouvert
avec une limite de 100 testeurs. La version préparée **1.126 (126)** ne sera
proposée qu’après une demande explicite d’envoi du propriétaire et sa mise à
disposition par Apple.

## Parcours conseillé

- Connexion, choix du dossier et consultation de l’accueil.
- Ouverture d’un document existant.
- Photographie puis transmission d’un justificatif de test dans un dossier de
  démonstration.
- Partage d’un PDF depuis Fichiers vers Maison Pilote.
- Mise en arrière-plan et réouverture de l’application ; biométrie si activée.
- Notifications, dictée et liens vers un document, avec les autorisations iOS
  correspondantes.

Pour signaler un problème, utiliser « Envoyer un retour bêta » dans TestFlight
et indiquer l’écran, l’action, le résultat attendu et le résultat observé.
Masquer les données réelles avant de joindre une capture.

Si TestFlight n’affiche aucun build installable, le build peut nécessiter le
dernier démarrage de la distribution externe dans App Store Connect malgré
l’approbation de revue. Son état API constaté est `BETA_APPROVED`, et non
`IN_BETA_TESTING`. Ne pas confondre ce problème de distribution avec un mot de
passe Maison Pilote incorrect. Aucune activation Apple n’a été effectuée
pendant la préparation.

[Fonctionnement officiel de TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
