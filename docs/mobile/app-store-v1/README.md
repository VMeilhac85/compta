# Maison Pilote - préparation de la première publication App Store

Version proposée : **1.128 (128)**. « V1 » désigne la première publication
publique ; le numéro reste cohérent avec les versions mobiles déjà produites.

## Contenu à valider

- [Fiche française complète](metadata.fr-FR.json) : nom, sous-titre, description,
  mots-clés, coordonnées publiques, notes de revue et paramètres de diffusion.
- [Description prête à utiliser](description.fr-FR.txt).
- [Confidentialité, classification et accès de revue](confidentialite-et-revue.md).
- [Questionnaire de classification au format API](age-rating.json).
- [Installation et essais sur iPhone](tester-sur-iphone.md).
- [Décision finale et portée de l’autorisation](validation-finale.md).

Proposition de diffusion : téléchargement gratuit, France, langue française,
compte Maison Pilote existant requis, catégories Professionnel et Productivité.
La France est l’hypothèse de préparation tant que le propriétaire n’indique pas
d’autres territoires. Le dossier prévoit une publication après approbation
Apple, à condition que le propriétaire autorise explicitement l’envoi et la
publication.

La politique de confidentialité est accessible dans l’application depuis la
connexion et les paramètres utilisateur. Le lien, son texte, ses emplacements
et sa présentation ont été portés sur le runtime partagé des émulateurs et de
l’iPhone, ainsi que sur les écrans natifs Android.

Le contrôle natif a également révélé un écran de chargement bloqué sur l’ancien
domaine : le document HTML restait sur `maisonpilote.meilhac.expert`, alors que
ses modules JavaScript étaient redirigés vers `maisonpilote.fr`. Le point
d’entrée iOS rejoint désormais le domaine canonique avant de charger
l’interface, en conservant ses paramètres. Cette correction s’applique aussi
aux coques iOS déjà installées. Les API des anciens clients Android restent
accessibles sur leur adresse historique.

## Construction et conservation

Le workflow `.github/workflows/ios-prepare.yml`, sur la branche de préparation
`prepare/appstore-v1-20260908`, archive sur macOS, exporte une IPA signée et
contrôle les quatre cibles : application iPhone/iPad, extension de partage,
application Watch et extension Watch.

Il contrôle notamment la signature, le type et l’expiration des profils, les
identifiants, les versions et l’absence de signature de développement. Le
résultat contient l’empreinte SHA-256 de l’IPA et le commit exact de ses sources.
Il exporte localement : **aucun binaire n’est envoyé à App Store Connect**.

Les captures proviennent de l’application native dans les simulateurs Apple.
Un seul parcours automatisé de connexion puis de consultation de Documents
produit les captures iPhone et iPad. Il est isolé des cibles distribuées et ne
figure pas dans l’IPA. Le compte utilisé n’accède qu’au dossier fictif « Démo GRH ».

Les fichiers signés sont des fichiers de distribution App Store. Ils ne
s’installent pas directement sur un iPhone depuis un lien de téléchargement.
Pour tester sans nouvelle publication, utiliser la bêta TestFlight 1.112 déjà
présente chez Apple, avec les limites précisées dans le guide iPhone.

Le contrôle hors ligne du dossier téléchargé s’effectue avec :

```bash
python3 docs/mobile/app-store-v1/validate-preparation.py /chemin/du/dossier-signe
```

Le manifeste généré par le runner et ce contrôle ne remplacent pas la validation
serveur Apple. Cette dernière ne peut être obtenue avant la transmission réelle.

## Dernières étapes après décision du propriétaire

1. Valider les textes, les captures, le tarif, les territoires et les déclarations
   de confidentialité et de classification préparés dans ce dossier.
2. Dans le compte Apple, confirmer si nécessaire les contrats et le statut
   professionnel DSA. Les accès API vérifiés ne permettent pas de certifier leur
   état. Valider également la fiche Confidentialité de l’app dans App Store
   Connect à partir des réponses préparées.
3. Sur demande explicite d’envoi : transmettre l’IPA contrôlée, conserver son
   numéro de build et son empreinte, attendre le traitement Apple, renseigner la
   version publique 1.128 et ses médias, associer le build et les informations de
   revue, puis effectuer la soumission autorisée.
4. La décision d’App Review appartient à Apple. Si le propriétaire a autorisé la
   publication après approbation, appliquer ce mode ; sinon conserver la version
   approuvée en attente d’une décision de publication.

La commande existante `php artisan mobile:ios:release` construit et transmet une
nouvelle bêta TestFlight. Elle ne soumet pas à elle seule une version publique à
l’App Store et ne réutilise pas automatiquement l’IPA de ce dossier.

## État Apple constaté avant préparation

- Application `6807432374`, bundle `expert.meilhac.maisonpilote`.
- Build 112, version 1.112, traitement `VALID`, revue bêta `APPROVED`.
- Groupe public : https://testflight.apple.com/join/Ubxzs62C.
- Distribution externe du build : `BETA_APPROVED` ; disponibilité d’installation
  à confirmer dans TestFlight sur l’iPhone.
- Fiche publique initiale 1.0 en `PREPARE_FOR_SUBMISSION`, sans build associé,
  description, URL d’assistance, confidentialité ni classification complétées.
- Aucun envoi, aucune soumission et aucune activation Apple effectués pendant
  cette préparation.
