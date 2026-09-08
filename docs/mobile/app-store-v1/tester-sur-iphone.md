> Mise à jour du 9 septembre : la première publication publique est désormais préparée en **1.132 (132), sans Apple Watch**. Cette archive est signée localement et n’a pas encore été envoyée. Le guide TestFlight ci-dessous concerne le build antérieur **1.131 (131)**, transmis avec Watch ; il ne permet pas d’installer la 1.132. La partie Watch est historique.

# Tester Maison Pilote sur iPhone

## Essai immédiat de l’interface et des fonctions web

Dans Safari, ouvrir [Maison Pilote pour iPhone](https://maisonpilote.fr/api/application-ios/test),
puis se connecter avec son compte Maison Pilote. Pour l’installer sur l’écran
d’accueil : Partager, « Sur l’écran d’accueil », puis Ajouter.

Si le bandeau d’aide à l’installation masque la navigation, le fermer avec sa
croix. Le parcours connexion puis Documents de cette version web a été vérifié
le 8 septembre 2026 ; les fonctions matérielles restent à essayer sur l’iPhone.

Cette version permet d’essayer l’interface et les fonctions web actuelles.
Elle ne valide pas les extensions natives de partage, la liaison Apple Watch
ni toutes les autorisations propres à l’application installée par TestFlight.

## Application native avec TestFlight

1. Installer [TestFlight depuis l’App Store](https://apps.apple.com/app/testflight/id899247664).
2. Sur l’iPhone, ouvrir dans Safari le lien
   [Rejoindre la bêta Maison Pilote](https://testflight.apple.com/join/Ubxzs62C).
3. Choisir « Afficher dans TestFlight », accepter l’invitation, puis installer
   Maison Pilote.
4. Ouvrir Maison Pilote et se connecter avec son compte habituel autorisé pour
   l’accès mobile. Les identifiants Apple servent à TestFlight ; ceux de
   Maison Pilote servent à l’application.

La version **1.131 (131)** a été transmise le 8 septembre 2026 avec l’autorisation
du propriétaire. Apple a validé son traitement ; elle attend la revue bêta avant
les tests externes. La notification automatique est activée. Le groupe est
ouvert avec une limite de 100 testeurs. L’application demande **iOS 16.4 ou
ultérieur** ; son expiration de bêta est annoncée au 7 décembre 2026.

Vérifier que TestFlight affiche bien **1.131 (131)** avant de commencer les essais.
Si cette version n’est pas encore proposée, attendre l’approbation Apple ;
le [statut de transmission](statut-testflight.md) précise le dernier contrôle.

La 1.112 est antérieure à la correction native du changement de domaine. Si
elle reste sur un écran de chargement ou ouvre mal le site, utiliser l’essai
web ci-dessus en attendant la disponibilité de la 1.131. Réinstaller la 1.112
ne garantit pas de corriger cette règle intégrée à son binaire.

## Apple Watch incluse

Installer d’abord Maison Pilote sur l’iPhone jumelé à la montre. Dans TestFlight,
ouvrir la fiche de l’app, puis sa section Informations / Détails : si la montre
est compatible, le bouton d’installation de l’app Apple Watch y apparaît.
Cette méthode est décrite dans l’[aide officielle TestFlight](https://testflight.apple.com/).
Maison Pilote demande **watchOS 9.4 ou ultérieur**.

Ouvrir Maison Pilote sur l’iPhone et se connecter, puis ouvrir l’app sur la
montre en gardant l’iPhone à proximité. L’assistant Watch est réservé aux comptes
administrateurs ; un compte client ou salarié ne dispose pas de cette fonction.
Vérifier la liaison, puis une demande simple sans modification de données métier.
La liaison n’a pas été validée sur une paire physique pendant la préparation.

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

Au contrôle suivant l’envoi, l’état de la 1.131 est `WAITING_FOR_BETA_REVIEW`.
L’absence de bouton Installer pour cette version relève alors de sa disponibilité
TestFlight et non du mot de passe Maison Pilote. La revue de la bêta ne constitue
pas une publication sur l’App Store public.

[Fonctionnement officiel de TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
