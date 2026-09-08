# Apple Watch - point technique restant avant soumission

L’archive 1.131 (131) comprend l’application Watch et son extension, toutes deux
signées. La capture Watch n’est pas utilisable pour la fiche App Store : elle
affiche uniquement « Vérification de l’accès… » et un indicateur de chargement.
Apple demande des captures Watch lorsqu’une application watchOS est incluse :
[documentation Apple](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-watchos-app-information).

## Constat reproductible

- Exécution de capture : [GitHub Actions 34249196075, tentative 2](https://github.com/VMeilhac85/compta/actions/runs/34249196075/attempts/2).
- Simulateurs : iPhone 16 Pro Max sous iOS 18.5 et Apple Watch Series 10 (46 mm)
  sous watchOS 11.5, jumelés dans le même runner macOS.
- La connexion et l’accès aux documents réussissent sur l’iPhone et l’iPad.
- Le jumelage est activé, puis les applications sont installées et relancées.
  Après le dernier relancement de la montre et 70 secondes d’attente, l’écran
  reste en vérification d’accès.
- Le compte de démonstration est un client, sans accès administrateur. Une
  réponse correcte du relais doit aboutir à l’écran d’accès réservé, et non
  rester indéfiniment en chargement.

La capture originale est conservée dans
`validations/rejected-media/watch-01-assistant.png`. Elle est exclue des médias
`screenshots/fr-FR` destinés à Apple. Le manifeste original de capture est
conservé sans modification ; `validation-status.json` indique le rejet.

## Limite du diagnostic actuel

La requête Watch utilise `WCSession.sendMessage` et attend un rappel de réponse
ou d’erreur. Le code ne définit pas son propre délai d’expiration pour cette
attente. L’iPhone active bien le relais au démarrage et son appel HTTP possède
un délai d’expiration. Ces observations ne permettent pas de déterminer si
le problème vient du transport entre simulateurs ou du relais applicatif.
Aucun essai sur une paire d’appareils physiques n’a été effectué.

Le succès du job de capture signifie que les fichiers ont été produits ; il
ne prouve pas que la fonction Watch a réussi. Le contrôle visuel et le contrôle
du dossier signalent donc ce blocage séparément.

## Suite nécessaire

Si la Watch reste dans cette première publication, instrumenter les événements
d’activation, de réception et de réponse du relais, sans journaliser de jeton
ni de contenu métier, puis valider la résolution et produire une capture
représentative. Toute correction native devra être versionnée et reconstruite
dans une nouvelle archive signée.

Si le propriétaire choisit une première publication iPhone/iPad uniquement,
préparer une autre archive sans les cibles Watch et adapter la fiche et les
contrôles. Ce changement de périmètre ne peut pas être obtenu en supprimant
simplement la mention Watch du texte, car l’IPA actuelle contient ces cibles.

La préparation actuelle conserve le périmètre existant. Aucun de ces choix
ne constitue une autorisation d’envoi à Apple.
