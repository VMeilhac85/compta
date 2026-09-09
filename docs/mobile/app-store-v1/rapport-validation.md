# Mise à jour du 9 septembre 2026 - 1.132 (132)

- Archive signée réussie sur macOS, Xcode 26 ; deux cibles iPhone/iPad et partage, aucun bundle Watch.
- Contrôle local du dossier réussi : signature, empreinte, profils, versions, SDK, absence d’instrumentation et captures.
- Code d’interface inchangé ; comparaison des sources de capture réussie après normalisation des seuls numéros et cibles Watch retirées.
- Quatre captures traitées COMPLETE par Apple ; textes, catégories, âge, prix gratuit/France, droits sur les contenus et revue renseignés par API.
- Liens publics confidentialité et assistance : HTTP 200.
- Scripts shell : contrôle de syntaxe réussi. Aucune interface web/Android modifiée ; aucun nouveau test automatisé ajouté.
- Cache Laravel vidé ; migrations contrôlées : aucune migration manquante.
- Confidentialité (questionnaire), DSA et formalités du compte restent à confirmer dans l’interface Apple. Archive 132 non téléversée, fiche en préparation avec sortie manuelle, aucune soumission publique.

Les preuves actualisées sont dans `storage/app/private/mobile/app-store/v1-1.132-132`. Le rapport ci-dessous décrit historiquement la préparation précédente, avec Watch, et ne définit plus le périmètre de la publication.

---

# Contrôle de la première publication - 8 septembre 2026

Version préparée : **1.131 (131)**. Première publication publique proposée,
dans la continuité des numéros de bêta existants.

**La préparation n’est pas encore prête à soumettre : la liaison Apple Watch
et sa capture restent à valider.** Le dossier ne prétend pas qu’il ne reste
que l’accord final du propriétaire.

## Résultats établis

| Élément | Résultat |
| --- | --- |
| Archive et IPA App Store | Construites et signées sur macOS ; signatures des quatre cibles contrôlées. |
| Sources du binaire | 38 fichiers natifs, configurations et ressources comparés avec les sources du site, sans différence. |
| SDK de distribution | Xcode 26.6, SDK iOS et watchOS 26.5 ; iOS minimum 16.4, watchOS minimum 9.4. |
| Profils App Store | Quatre profils valides, expirant le 1er septembre 2027 à 14:42:20 UTC. |
| Connexion puis Documents | Parcours réussi dans les simulateurs natifs iPhone et iPad avec la coque 129 et le site en 131, et dans le contrôle web mobile. Le code natif 131 est identique, hors numéros de version et de build. |
| Captures iPhone et iPad | Quatre captures natives contrôlées visuellement et retenues, aux dimensions Apple et sans canal alpha. |
| Apple Watch | Capture écartée : vérification de l’accès toujours en cours après 70 secondes. Liaison et capture fonctionnelle non validées. |
| Confidentialité dans l’app | Lien identique depuis la connexion et les paramètres dans les interfaces mobiles concernées. |
| Build web | Réussi après correction du démarrage iOS. |
| Android et Wear OS | Versions 1.131 (131) signées et activées uniquement sur la bêta auto-hébergée ; signatures recontrôlées et mise à jour proposée aux versions 124, 128, 129 et 130. |
| Laravel | Syntaxe du contrôleur valide, migrations à jour, caches vidés. |
| Apple et Google Play | Aucun téléversement, aucune soumission et aucune activation effectués. |

L’archive de distribution respecte les [exigences de SDK publiées par Apple](https://developer.apple.com/news/upcoming-requirements/).
Les captures ont été prises sur des simulateurs iOS 18.5 et watchOS 11.5 avec
le même code applicatif ; elles ne constituent pas des essais sur appareils
physiques.

## Corrections incluses

Le lancement iOS rejoint désormais `maisonpilote.fr` et accepte la navigation
depuis l’ancien domaine autorisé. La redirection conserve les paramètres et
les ressources chargent depuis la même origine. Android utilise aussi le
domaine canonique, tout en conservant les retours de connexion historiques.

La page iOS rattache maintenant ses deux contrôles masqués au conteneur attendu
par le code mobile partagé. Leur ancien emplacement interrompait le JavaScript
avant l’affichage de la connexion. Les deux émulateurs respectaient déjà ce
contrat et ont été comparés explicitement.

Les contrôles automatiques de capture sont isolés de l’application distribuée.
L’IPA ne contient ni cible XCTest ni identifiant de connexion de démonstration.

## Limites de validation

L’envoi réel doit encore passer la validation serveur Apple. Il n’a pas été
effectué, conformément à la demande de préparation et à la règle du propriétaire
réservant toute transmission à son autorisation explicite.

Les essais matériels de Face ID, de notifications, de partage et de liaison
Apple Watch restent à effectuer sur les appareils. Le blocage Watch a été
reproduit dans le simulateur après jumelage et relancement des applications ;
sa cause n’est pas établie. Le contrôle hors ligne retourne un échec explicite
pour la famille de captures Watch manquante, tout en validant l’IPA et la
correspondance des sources. Voir le [diagnostic](blocage-apple-watch.md).

Les sessions mobiles temporaires créées par les captures et diagnostics ont été révoquées ; les
sessions préexistantes ont été conservées. Les deux secrets temporaires de
connexion utilisés pour les captures ont été supprimés de GitHub.

Les déclarations de confidentialité, la classification, le tarif gratuit et le
territoire France sont des propositions à approuver. L’état des contrats et
du statut DSA ne peut pas être certifié par les accès API utilisés.

La relecture des journaux après correction n’a relevé aucune nouvelle erreur
Nginx. Les erreurs Laravel observées concernent des tâches planifiées existantes
et un contrôle concurrent de la page d’accueil, hors du parcours mobile testé.
Une interrogation finale de l’API Apple a également produit une erreur 404
dans un script de contrôle, due à un préfixe d’URL dupliqué ; l’URL du script
a été corrigée et les trois lectures finales ont réussi. Cette erreur concerne
le contrôle ponctuel, sans modification de l’application ou de ses données.

## Conservation

Le dossier privé `storage/app/private/mobile/app-store/v1-1.131-131` conserve
l’IPA, l’archive Xcode, les sources, les manifestes de signature et de SDK,
les contrôles de correspondance et les documents à approuver. L’empreinte
SHA-256 de l’IPA à utiliser figure dans `preparation-result.json`.

Les versions 1.126, 1.128, 1.129 et 1.130 de préparation ont été remplacées. Ne pas les
transmettre à Apple.
