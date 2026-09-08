# Maison Pilote - préparation de la première publication App Store

Version proposée : **1.131 (131)**. « V1 » désigne la première publication
publique ; le numéro reste cohérent avec les versions mobiles déjà produites.

**Mise à jour : envoi TestFlight autorisé et effectué le 8 septembre 2026.**
Apple a validé le traitement de la 1.131 et la revue bêta est en attente.
La Watch est conservée, conformément au choix du propriétaire. Voir le
[statut de transmission](statut-testflight.md) et le [guide iPhone](tester-sur-iphone.md).
La soumission publique App Store reste distincte et n’a pas été autorisée.

**État : archive signée préparée, soumission encore bloquée par l’Apple Watch.**
Les quatre captures iPhone et iPad sont retenues. La montre reste sur
« Vérification de l’accès… » après 70 secondes et sa capture a été écartée.
Il reste donc un travail technique avant de pouvoir ne demander que la
validation finale. Le [diagnostic Watch](blocage-apple-watch.md) précise les
preuves conservées et les suites possibles. Ce blocage concerne encore la
préparation de la fiche publique ; l’envoi de la bêta est décrit ci-dessus.

## Contenu à valider

- [Fiche française complète](metadata.fr-FR.json) : nom, sous-titre, description,
  mots-clés, coordonnées publiques, notes de revue et paramètres de diffusion.
- [Description prête à utiliser](description.fr-FR.txt).
- [Confidentialité, classification et accès de revue](confidentialite-et-revue.md).
- [Questionnaire de classification au format API](age-rating.json).
- [Installation et essais sur iPhone](tester-sur-iphone.md).
- [Décision finale et portée de l’autorisation](validation-finale.md).
- [Résultats et limites des validations](rapport-validation.md).
- [Blocage Apple Watch avant soumission](blocage-apple-watch.md).
- [Requêtes de fiche préparées, identifiants Apple et binaire à transmettre](envoi-prepare.json).

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
d’entrée web iOS rejoint désormais le domaine canonique en conservant ses
paramètres. La nouvelle coque démarre directement sur ce domaine et reconnaît
les deux adresses pour sa navigation, ses liens et ses autorisations. Android
utilise également le domaine canonique et conserve les retours de connexion
historiques. Une ancienne coque iOS peut nécessiter une nouvelle version
TestFlight, car sa règle native de navigation n’est pas modifiable côté serveur.

Un second blocage provenait de deux contrôles masqués placés hors de leur
conteneur dans la page iOS. Leur rattachement a été corrigé pour respecter le
même contrat que les deux émulateurs. Le parcours Safari connexion puis
Documents a été validé après correction, ainsi que ce parcours dans les
simulateurs natifs iPhone et iPad.

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

La version 1.131 intègre les évolutions Documents et États produites en parallèle.
Son archive signée provient du commit `e0595ca0970e74d3ab413a3682528462db44960d`.
Le parcours de capture utilise la coque 1.129 et le site vivant en 1.131 : les
38 fichiers natifs des deux versions ont été comparés, et seuls les numéros
de version et de build diffèrent. Les deux jeux de sources et leur contrôle
de correspondance sont conservés. Les captures ne sont pas présentées comme
issues d’un binaire numéroté 131.

Les fichiers signés sont des fichiers de distribution App Store. Ils ne
s’installent pas directement sur un iPhone depuis un lien de téléchargement.
Pour tester sans nouvelle publication, utiliser la version web sur l’iPhone.
La bêta TestFlight 1.112 existe déjà chez Apple ; ses limites sont précisées
dans le guide iPhone.

Le contrôle hors ligne du dossier téléchargé s’effectue avec :

```bash
python3 docs/mobile/app-store-v1/validate-preparation.py /chemin/du/dossier-signe
```

Le manifeste généré par le runner et ce contrôle ne remplacent pas la validation
serveur Apple. Cette dernière ne peut être obtenue avant la transmission réelle.

## Dernières étapes après décision du propriétaire

Préalable technique : résoudre et valider la liaison Watch, puis produire une
capture représentative. Si le propriétaire décide de réserver cette première
publication à l’iPhone et à l’iPad, préparer une nouvelle archive signée sans
Watch et adapter la fiche avant de lui présenter le binaire à approuver.

1. Valider les textes, les captures, le tarif, les territoires et les déclarations
   de confidentialité et de classification préparés dans ce dossier.
2. Dans le compte Apple, confirmer si nécessaire les contrats et le statut
   professionnel DSA. Les accès API vérifiés ne permettent pas de certifier leur
   état. Valider également la fiche Confidentialité de l’app dans App Store
   Connect à partir des réponses préparées.
3. Sur demande explicite d’envoi : transmettre l’IPA contrôlée, conserver son
   numéro de build et son empreinte, attendre le traitement Apple, renseigner la
   version publique 1.131 et ses médias, associer le build et les informations de
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
