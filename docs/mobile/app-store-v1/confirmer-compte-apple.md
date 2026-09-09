# Dernières confirmations dans le compte Apple

Situation du 9 septembre 2026 : la fiche publique **1.132 (132), iPhone/iPad sans Apple Watch**, a été renseignée dans App Store Connect. Les textes, les catégories, les quatre captures, le tarif gratuit, la France, la classification d’âge, le lien de confidentialité et le compte de revue sont enregistrés. La nouvelle archive signée est prête localement. Elle attend la décision d’envoi ; aucune soumission publique n’a été effectuée.

## Ce qui exige encore le site Apple

Les accès disponibles comprennent une clé App Store Connect API, mais aucune session interactive connectée au compte Apple. La spécification officielle de l’API 4.4.1 ne contient pas d’opération pour publier les réponses au questionnaire de collecte, vérifier le statut professionnel DSA ou accepter les contrats du programme développeur. Le lien de la politique de confidentialité, lui, a bien été renseigné par API.

Le questionnaire de confidentialité peut être rempli par un titulaire, un administrateur ou un gestionnaire de l’app. La DSA peut être gérée par le titulaire ou un administrateur. L’acceptation des contrats Apple appartient au titulaire du compte.

## 1. Confidentialité de Maison Pilote

Si la page Apple reste blanche, ouvrir [la liste des apps](https://appstoreconnect.apple.com/apps), se connecter puis sélectionner Maison Pilote. Le lien limité à `/apps/6807432374` ne correspond pas à la route de fiche déclarée par le navigateur Apple ; la rubrique Distribution utilise `/apps/6807432374/distribution`.

1. Ouvrir [App Store Connect - Maison Pilote](https://appstoreconnect.apple.com/apps/6807432374/distribution), puis **Confidentialité de l’app** dans le menu latéral.
2. Dans **Politique de confidentialité**, vérifier le lien déjà enregistré : `https://maisonpilote.fr/confidentialite`.
3. Dans la collecte de données, cliquer sur **Commencer** ; si des réponses existent déjà, utiliser **Modifier**.
4. Répondre **Oui, nous collectons des données à partir de cette app**. Les données reçues par le service Maison Pilote depuis la WebView comptent aussi.
5. Sélectionner les types ci-dessous. Les libellés peuvent varier légèrement avec la langue de l’interface Apple.

| Groupe Apple | Types à sélectionner | Flux identifiés dans Maison Pilote |
| --- | --- | --- |
| Coordonnées | Nom ; adresse e-mail ; numéro de téléphone ; adresse physique | Profils, coordonnées et dossiers autorisés |
| Santé et activité physique | Santé | Justificatifs d’absences pouvant contenir des informations de santé ; aucun accès HealthKit |
| Informations financières | Informations de paiement ; autres informations financières | Coordonnées bancaires, justificatifs, bulletins, frais et données financières des dossiers |
| Contenu utilisateur | E-mails ou messages texte ; photos ou vidéos ; assistance client ; autres contenus utilisateur | Messagerie, justificatifs photographiés, tickets, documents, notes et formulaires |
| Identifiants | Identifiant utilisateur ; identifiant de l’appareil | Compte, identifiant d’installation et notifications |
| Données d’utilisation | Interaction avec le produit | Événements et historique des actions associés au compte |
| Diagnostics | Autres données de diagnostic | Journaux techniques, erreurs et résolution des incidents |

6. Enregistrer la sélection. Ouvrir ensuite **chaque type de données** pour renseigner ses trois réponses :

| Question | Réponse préparée |
| --- | --- |
| Pourquoi ces données sont-elles utilisées ? | **Fonctionnalité de l’app** : authentification, services demandés, support, sécurité et maintien du fonctionnement |
| Les données sont-elles liées à l’identité de l’utilisateur ? | **Oui** : elles sont rattachées au compte authentifié, à son appareil ou à ses dossiers |
| Ces données sont-elles utilisées à des fins de suivi ? | **Non** : pas de rapprochement publicitaire entre apps/sites ni de vente à un courtier en données |

Ces réponses décrivent les flux examinés pour cette version, y compris les services web intégrés. La reconnaissance vocale produit un texte ; la coque ne conserve pas d’enregistrement audio. Face ID/Touch ID reste géré par Apple : Maison Pilote ne reçoit pas les données biométriques. Les trajets professionnels sont saisis par l’utilisateur ; l’app ne suit pas la position GPS de l’appareil. Aucun SDK publicitaire ni identifiant publicitaire n’a été identifié.

7. Enregistrer chaque type, puis vérifier que tous les types sont complétés. L’aperçu doit présenter les données liées à l’utilisateur, sans données utilisées pour le suivi publicitaire.
8. Cliquer sur **Publier**, en haut à droite, puis confirmer **Publier**. Ce bouton publie les réponses de confidentialité ; il ne soumet ni ne met en ligne l’application. Pour une fiche encore inédite, les réponses seront visibles lors de la publication de l’app.

[Procédure Apple du questionnaire](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/) ; [définitions des données et finalités](https://developer.apple.com/app-store/app-privacy-details/).

## 2. Statut professionnel DSA pour la France

1. Dans App Store Connect, ouvrir **Business / Entreprise**, puis **Agreements / Contrats**.
2. Descendre jusqu’à **Compliance / Conformité**. Sur la ligne **Digital Services Act / Loi sur les services numériques**, cliquer sur **Complete Compliance Requirements / Compléter les exigences de conformité** si la démarche est demandée.
3. Déclarer le statut correspondant à l’activité. L’édition de Maison Pilote dans le cadre de M4 INFO correspond à l’activité professionnelle décrite pour le projet ; la gratuité du téléchargement ne signifie pas « non professionnel ».
4. Vérifier le nom légal, l’adresse, le téléphone et l’e-mail professionnels. Pour un compte d’organisation, Apple reprend l’adresse liée au numéro D-U-N-S ; pour un compte individuel, l’adresse doit être renseignée. L’éditeur indiqué sur le site est M4 INFO, SASU, 1 chemin du Hégron, 85160 Saint-Jean-de-Monts, France. Les informations doivent correspondre à l’entité inscrite chez Apple et à ses justificatifs actuels.
5. Valider l’e-mail et le téléphone avec les codes envoyés par Apple.
6. Fournir le justificatif demandé, par exemple un extrait d’immatriculation récent prouvant le nom et l’adresse. Compléter les informations du compte de paiement si Apple les demande.
7. Relire puis cliquer sur **Confirmer**. Vérifier ensuite le statut affiché ; s’il est en cours d’examen, la confirmation Apple reste attendue.
8. Revenir dans **Maison Pilote → Informations sur l’app → Réglementations et autorisations de l’App Store → Digital Services Act** et vérifier que le statut de cette app est cohérent.

Les coordonnées DSA seront affichées publiquement sur la fiche lorsque l’app sera distribuée dans l’Union européenne. [Procédure officielle Apple](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/).

## 3. Contrats et adhésion

1. Se connecter avec le **titulaire du compte** dans [Apple Developer - Compte](https://developer.apple.com/account/). Vérifier que l’adhésion est active et traiter une éventuelle alerte sur le contrat du programme développeur : ouvrir le texte, le lire puis accepter si vous l’approuvez.
2. Dans **App Store Connect → Business / Entreprise → Agreements / Contrats**, vérifier les lignes signalées comme nécessitant une action et fournir les informations explicitement demandées.
3. Maison Pilote est préparée comme application gratuite, sans achat intégré. Le contrat des applications payantes n’est pas nécessaire uniquement pour ce téléchargement gratuit. S’il existe déjà un contrat payant sur le compte et qu’Apple en exige la mise à jour, traiter l’alerte correspondante avec le titulaire.
4. Les données fiscales, bancaires ou pièces justificatives éventuellement demandées doivent provenir des informations officielles de l’entité. Leur état actuel n’est pas visible avec les accès disponibles ici.

[Contrats Apple et rôles habilités](https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements) ; [consulter leur statut](https://developer.apple.com/help/app-store-connect/manage-agreements/view-agreements-status/).

## Étape suivante

Une fois ces confirmations terminées, l’accord d’envoi permettra de transmettre l’archive **1.132 (132)** sans Watch, d’attendre son traitement Apple, de l’associer à la fiche et de soumettre la version publique. La fiche est actuellement réglée sur **sortie manuelle** pour conserver la décision de mise en ligne après la revue Apple. Le build TestFlight 131, qui contient encore la Watch, ne doit pas être associé à cette fiche 1.132.
