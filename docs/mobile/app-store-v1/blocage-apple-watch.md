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

Une exécution supplémentaire avec une instrumentation temporaire, isolée des
sources distribuées, a précisé l’échec :
[diagnostic 34256229422](https://github.com/VMeilhac85/compta/actions/runs/34256229422).
Les deux sessions WatchConnectivity s’activent, mais l’iPhone indique
`paired=true`, `installed=false`, `reachable=false`, et la montre indique
`reachable=false`. La requête quitte donc le contrôle de disponibilité en erreur
avant tout `sendMessage`. Aucun message n’arrive au relais iPhone. La capture
de diagnostic affiche cette fois le message « Le téléphone ne répond pas ».

Un [second essai](https://github.com/VMeilhac85/compta/actions/runs/34257292858)
a démarré les deux simulateurs et installé les deux applications avant le
parcours de connexion. Les journaux montrent encore `installed=false` sur
l’iPhone et `reachable=false` sur la montre. Ce changement d’ordre ne résout
donc pas le problème. Le run est marqué `cancelled` après une demande d’arrêt
à environ quinze minutes ; les étapes de capture et de conservation ont
néanmoins terminé et leurs fichiers ont été récupérés. Ce run reste une preuve
de diagnostic, pas une validation réussie de la fonction Watch.

Les deux ensembles de journaux et de captures de diagnostic sont conservés
dans `validations/watch-diagnostics`. Leurs sources temporaires ne font pas
partie de l’archive signée 1.131.

Dans cet essai, le blocage se situe donc avant l’appel HTTP. L’absence de délai
applicatif autour de `sendMessage`, observée dans le code, n’explique pas cet
échec puisque la méthode n’est pas appelée. La reconnaissance de l’application
Watch par la paire de simulateurs reste à résoudre. Aucun essai sur une paire
d’appareils physiques n’a été effectué.

Le succès du job de capture signifie que les fichiers ont été produits ; il
ne prouve pas que la fonction Watch a réussi. Le contrôle visuel et le contrôle
du dossier signalent donc ce blocage séparément.

## Suite nécessaire

Si la Watch reste dans cette première publication, obtenir une paire dont les
applications sont reconnues et joignables, puis valider l’échange réel et produire
une capture représentative. Le diagnostic journalise seulement les étapes et
états de liaison, sans jeton ni contenu métier. Toute correction native devra
être versionnée et reconstruite dans une nouvelle archive signée.

Si le propriétaire choisit une première publication iPhone/iPad uniquement,
préparer une autre archive sans les cibles Watch et adapter la fiche et les
contrôles. Ce changement de périmètre ne peut pas être obtenu en supprimant
simplement la mention Watch du texte, car l’IPA actuelle contient ces cibles.

La préparation actuelle conserve le périmètre existant. Aucun de ces choix
ne constitue une autorisation d’envoi à Apple.
