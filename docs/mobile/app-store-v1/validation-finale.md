# Validation de la première publication Maison Pilote

Version proposée : **1.129, build 129**. Le téléchargement est proposé gratuit,
en France, avec une fiche française et un compte Maison Pilote existant.

## Contenu de la décision

- Approuver la [fiche française](metadata.fr-FR.json), les captures natives et
  les notes destinées à l’équipe de revue Apple.
- Confirmer le tarif gratuit et le territoire France, ou indiquer les changements.
- Approuver les [déclarations de confidentialité et de classification](confidentialite-et-revue.md).
- Dans [App Store Connect](https://appstoreconnect.apple.com/apps/6807432374),
  confirmer les informations de confidentialité, le statut professionnel DSA
  et les éventuels contrats signalés par Apple. Leur état ne peut pas être
  certifié avec les accès API disponibles.
- Préciser la portée de l’autorisation : essai TestFlight uniquement, soumission
  App Store avec sortie manuelle, ou soumission avec publication après approbation
  Apple.

Les trois portées sont distinctes. La préparation n’a déclenché aucune d’elles.
La décision d’accepter l’application et le délai de revue appartiennent à Apple.

## Exécution après autorisation

Le binaire à transmettre est l’IPA déjà signée et contrôlée du dossier privé
`storage/app/private/mobile/app-store/1.129-129`. Son empreinte exacte figure
dans `preparation-result.json`. Une nouvelle compilation ne doit pas remplacer
silencieusement ce binaire approuvé.

Après l’envoi autorisé, attendre le traitement Apple, vérifier son résultat,
renseigner la fiche et ses médias, associer le build 129 et le compte de revue,
puis soumettre uniquement selon la portée demandée. Une erreur de validation
Apple ou une demande du contrôleur doit être traitée et rapportée avant de
considérer la publication terminée.

La [bêta actuelle et les étapes d’essai sur iPhone](tester-sur-iphone.md) sont
indépendantes de cette nouvelle transmission.
