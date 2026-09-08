# Déclarations préparées pour la première version publique

Ces réponses sont préparées pour la validation du propriétaire. Elles n’ont pas
été transmises à Apple. Elles couvrent les écrans mobiles et le trafic de la
WebView iOS, qui fait partie de l’application.

## Fiche de confidentialité App Store

- Politique publique : https://maisonpilote.fr/confidentialite
- Contact et assistance : https://maisonpilote.fr/mentions-legales
- Publicité et suivi interapplications : aucun SDK publicitaire ni identifiant
  publicitaire dans la coque iOS ; ne pas déclarer de suivi publicitaire.
- Les données de compte et de dossier sont liées à l’utilisateur authentifié.
- Finalité principale : fonctionnement de l’application, authentification,
  services demandés, sécurité et support. Les diagnostics servent aussi à
  identifier les problèmes de fonctionnement.

| Type de données Apple | Réponse préparée et fondement |
| --- | --- |
| Nom, adresse e-mail, téléphone, adresse physique | Données du profil et des dossiers accessibles selon les habilitations ; liées à l’utilisateur, fonctionnement de l’application. |
| Identifiant utilisateur | Compte authentifié ; lié à l’utilisateur, fonctionnement et sécurité. |
| Identifiant appareil | UUID d’installation et jeton de notifications ; lié à l’utilisateur, fonctionnement et sécurité. |
| Informations de paiement | Coordonnées bancaires présentes dans les justificatifs, documents et dossiers autorisés ; fonctionnement de l’application. Aucun paiement d’achat de l’application. |
| Autres informations financières | Bulletins, frais, données comptables et documents financiers ; liées au compte ou au dossier, fonctionnement. |
| Photos et vidéos | Photos de justificatifs et photos de profil transmises volontairement ; fonctionnement. Aucune collecte de la photothèque entière. |
| E-mails ou messages texte | Messagerie entre personnes habilitées et échanges avec le support ; fonctionnement. Aucun accès à la boîte SMS de l’iPhone. |
| Assistance client | Tickets et échanges de support ; fonctionnement. |
| Autres contenus utilisateur | Documents, notes, tâches, formulaires et demandes rédigées par l’utilisateur ; fonctionnement. |
| Données de santé | Les justificatifs d’absences peuvent contenir des informations de santé. Déclaration préparée pour ce flux métier, sans HealthKit, diagnostic ni conseil médical. |
| Interactions avec le produit | Historique d’actions et événements de fonctionnement liés au compte ; fonctionnement et diagnostic. |
| Autres données de diagnostic | Journaux techniques et erreurs ; fonctionnement, sécurité et résolution d’incidents. |

La dictée utilise le service de reconnaissance vocale Apple. La coque ne
conserve pas d’enregistrement audio ; le texte est transmis lorsque
l’utilisateur valide sa demande. La biométrie passe par LocalAuthentication :
aucune empreinte ni donnée Face ID n’est reçue par Maison Pilote.

Les itinéraires de frais kilométriques sont saisis par l’utilisateur. Le runtime
mobile n’appelle pas l’API de géolocalisation pour suivre l’appareil.

Le manifeste `PrivacyInfo.xcprivacy` est distinct de cette fiche. Il déclare
l’absence de suivi et l’usage autorisé de UserDefaults par l’application ; il
ne remplace pas la déclaration des données que le service web reçoit.

## Classification d’âge

Le fichier `age-rating.json` contient les réponses proposées : échanges et
contenus utilisateurs présents, navigation web libre absente, pas de publicité,
jeux d’argent, contenus sexuels, violences ni conseil médical. Les documents
privés d’entreprise ne constituent pas un catalogue éditorial de ces contenus.
La classification effective sera calculée par Apple à partir des réponses.

## Compte de revue

Le compte de démonstration existant est utilisable sur l’API mobile. Son secret
reste dans le fichier privé déjà référencé par
`mobile.ios.app_store_connect.demo_account_password_file`. Aucun mot de passe
n’est inclus dans les sources, captures ou documents du dossier de préparation.

Les coordonnées de revue sont résolues par le mécanisme serveur existant depuis
la configuration et le profil du propriétaire. Elles ont passé sa validation.
À l’envoi, les informations de revue publique doivent reprendre ces valeurs.

Le compte de démonstration standard n’est pas administrateur. Les fonctions
Codex réservées aux administrateurs et le relais Apple Watch sont décrits dans
les notes de revue avec cette restriction. Avant une demande Apple portant sur
ces fonctions, préparer un accès de revue limité aux seules données fictives,
sans donner au contrôleur Apple accès à l’administration réelle.

## Vérifications finales dans le compte Apple

Les conditions contractuelles Apple doivent être acceptées par le titulaire du
compte lorsqu’Apple le demande. Pour la distribution en France, le statut de
professionnel DSA et les coordonnées publiques doivent être confirmés dans
App Store Connect. La préparation utilise l’éditeur déjà déclaré sur le site :
M4 INFO, SASU, 1 chemin du Hégron, 85160 Saint-Jean-de-Monts, France.

La clé API valide l’accès technique à l’application ; elle ne prouve ni
l’acceptation des contrats ni la validation DSA. Leur état n’a pas pu être
confirmé avec les accès API utilisés. La fiche de confidentialité doit être
validée dans la rubrique Confidentialité de l’app avant soumission.

## Références Apple

- [Déclarations de confidentialité](https://developer.apple.com/app-store/app-privacy-details/)
- [Gestion de la confidentialité dans App Store Connect](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [Règles de revue, notamment 2.3.3 et 5.1.1](https://developer.apple.com/app-store/review/guidelines/)
- [Exigences DSA](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)
