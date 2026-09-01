# Maison Pilote pour iOS et watchOS

Ce dossier contient un vrai projet iOS SwiftUI généré avec XcodeGen. L’application conserve une instance `WKWebView` persistante et charge uniquement :

`https://maisonpilote.meilhac.expert/api/application-ios/test?native=1`

Il s’agit d’un shell natif de test, prêt pour une distribution TestFlight. L’interface métier est servie par Laravel afin de rester synchronisée avec l’émulateur mobile. Les fonctions qui nécessitent iOS restent natives : permissions caméra et microphone, dictée, notifications APNs, liens universels, App Intents/Siri, réception depuis la feuille de partage et relais sécurisé de l’app Apple Watch embarquée.

## Sécurité de navigation

- WebKit utilise le stockage persistant par défaut : cookies et session survivent aux recompositions SwiftUI et aux redémarrages normaux.
- `WKAppBoundDomains` et le délégué de navigation limitent le contenu embarqué au domaine HTTPS `maisonpilote.meilhac.expert`.
- Les liens HTTPS externes, `mailto:`, `tel:`, `sms:`, `maps:`, `itms-beta:` et `itms-apps:` sont confiés à iOS.
- Seule une popup visant la route du shell peut rester dans la vue courante ; toute autre route du même domaine est confiée au routeur du runtime, et une origine non approuvée n’est jamais rendue dans le shell.
- Les permissions caméra/micro ne peuvent être accordées qu’à la frame principale de l’origine approuvée.
- Le jeton transmis par le runtime est conservé dans le Trousseau iOS avec la classe d’accessibilité `AfterFirstUnlockThisDeviceOnly`, jamais dans `UserDefaults`.
- Un écran opaque remplace le contenu dans le sélecteur d’apps et tant qu’iOS signale une capture/enregistrement d’écran actif. iOS ne propose pas d’API publique équivalente à `FLAG_SECURE` pour interdire une capture ponctuelle ; aucun contournement privé n’est utilisé.

Le serveur doit publier un fichier `/.well-known/apple-app-site-association` qui associe le bundle `expert.meilhac.maisonpilote` aux chemins applicatifs. Sans ce fichier, le schéma `maisonpilote://` fonctionne, mais pas l’ouverture universelle HTTPS.

## Contrat JavaScript natif

La page peut démarrer ou annuler la dictée directement :

```js
window.webkit.messageHandlers.speechRecognition.postMessage({
    action: 'start', // ou 'cancel'
    language: 'fr-FR',
});
```

Le résultat final est renvoyé par :

```js
window.addEventListener('maisonpilote:speech-result', ({ detail }) => {
    console.log(detail.transcript);
});

window.addEventListener('maisonpilote:speech-error', ({ detail }) => {
    console.log(detail.code, detail.message);
});
```

Le helper `window.MaisonPiloteNative.speechRecognition` expose le même contrat. Les événements complémentaires sont :

- `maisonpilote:native-assistant-request` avec `{id, prompt, source, requested_at_utc}` après une demande Siri ;
- `maisonpilote:native-share-inbox` avec la liste des lots reçus depuis d’autres applications ;
- `maisonpilote:deep-link` avec `{url}` pour toute URL applicative reçue, sans jamais remplacer le shell par une page web classique ;
- `maisonpilote:native-bridge-ready` quand le pont est injecté ;
- `maisonpilote:apns-token` avec `{token, provider: "apns", environment}` après l’inscription native auprès d’Apple ;
- `maisonpilote:push-notification` lors d’une réception et `maisonpilote:deep-link` avec `url` lorsque l’utilisateur ouvre la notification.

Le jeton APNs est conservé dans le Trousseau iOS. Il est réémis après le signal `maisonpilote:native-runtime-ready`, à chaque changement d’inscription, au retour au premier plan et à la demande du runtime afin qu’une inscription arrivée avant le chargement JavaScript ne soit jamais perdue :

```js
window.addEventListener('maisonpilote:apns-token', ({ detail }) => {
    inscrireLeJetonSurEndpointMobile(detail.token);
});
// Après connexion, au moment où l'utilisateur active les notifications :
window.MaisonPiloteNative.pushNotifications.requestAuthorization();
window.MaisonPiloteNative.pushNotifications.refresh();
```

Le serveur utilise l’endpoint mobile existant `devices/push-token`, associe le jeton à un appareil `platform=ios` et le chiffre en base. L’application n’embarque ni Firebase iOS SDK, ni clé APNs privée.

Le runtime doit installer ses listeners puis émettre
`maisonpilote:native-runtime-ready`. Une demande Siri reste durablement dans le
groupe d’app tant que le runtime ne l’a pas explicitement acquittée :

```js
window.addEventListener('maisonpilote:native-assistant-request', async ({ detail }) => {
    await envoyerLaDemande(detail.prompt);
    window.MaisonPiloteNative.assistantRequest.acknowledge(detail.id);
});
window.dispatchEvent(new Event('maisonpilote:native-runtime-ready'));
```

Le deep link `maisonpilote://assistant` est normalisé en
`https://maisonpilote.meilhac.expert/assistant-vocal?listen=1`, mis en file puis
livré au runtime uniquement après ce signal de disponibilité.

La session sécurisée utilise le handler `secureSession` :

```js
window.webkit.messageHandlers.secureSession.postMessage({
    action: 'store',
    token,
    expiresAt, // date ISO 8601, éventuellement null
    deviceId: installationUuid,
});
// Déconnexion :
window.webkit.messageHandlers.secureSession.postMessage({ action: 'clear' });
```

L’UUID d’installation nécessaire au relais Apple Watch est lié à la session par
le même handler (`action: 'bindDevice'`). Jeton et UUID sont lus par le relais
uniquement depuis le Trousseau `ThisDeviceOnly` ; aucun `UserDefaults` n’est
utilisé pour reconstituer une session mobile.

Au prochain document, la session est injectée avant le runtime dans
`window.__MAISON_PILOTE_IOS_SESSION__`. La biométrie n’est jamais simulée :

```js
window.webkit.messageHandlers.biometricAuthentication.postMessage({
    action: 'authenticate',
});
window.addEventListener('maisonpilote:biometric-result', ({ detail }) => {
    console.log(detail.success, detail.error);
});
```

Le shell injecte aussi avant le runtime sa version réellement installée :

```js
window.__MAISON_PILOTE_IOS_APP__;
// { versionCode: 111, versionName: '1.111' }
```

Le runtime doit utiliser cette valeur locale pour décider si une mise à jour est
disponible, et non la version de la dernière release renvoyée par le serveur.

La feuille de partage place les fichiers dans le groupe d’app sécurisé puis le
runtime les transmet réellement à la GED. L’événement
`maisonpilote:native-share-inbox` ne contient que les métadonnées utiles et
n’expose jamais les chemins du conteneur. Le bridge corrélé lit chaque fichier
par blocs natifs bornés à 512 Kio. Pour chaque fichier, le runtime :

1. crée une session par `POST /dossiers/{dossier}/uploads` avec une clé
   d’idempotence stable et `context_type=shared_file` ;
2. envoie les blocs par `PATCH /dossiers/{dossier}/uploads/{upload}` avec
   `X-Upload-Offset` ;
3. reprend sans dupliquer après une coupure grâce à
   `GET /dossiers/{dossier}/uploads/{upload}` ;
4. annule la session distante par
   `DELETE /dossiers/{dossier}/uploads/{upload}` lorsque l’utilisateur touche
   « Annuler » dans l’overlay commun des envois.

Le lot demeure dans l’App Group en cas d’erreur ou d’annulation. Il n’est
supprimé par `MaisonPiloteNative.shareInbox.discard(id, requestId)` qu’après la
confirmation `completed` ou `duplicate` de tous ses fichiers et l’acquittement
corrélé de la suppression native. Une erreur conserve donc la source et propose
« Réessayer » ; un redémarrage peut aussi reprendre le même upload sans créer de
second document.

### Ouvrir, enregistrer ou partager un document produit par le runtime

La coque native n’autorise jamais une navigation `blob:`, `data:` ou `file:`.
Pour un PDF, une image ou tout autre fichier déjà reçu par le runtime sous forme
de `Blob`, celui-ci le transmet au bridge natif par blocs binaires de **256 Kio
maximum**, encodés en base64. Un document est limité à **100 Mio** et deux
transferts temporaires peuvent coexister. `requestId` et `transferId` sont deux
UUID canoniques ; chaque commande possède un nouveau `requestId`, tandis que le
`transferId` reste stable pendant tout le fichier :

```js
const transferId = crypto.randomUUID();
const beginRequestId = crypto.randomUUID();

window.MaisonPiloteNative.outgoingDocument.begin({
    requestId: beginRequestId,
    transferId,
    fileName: 'balance.pdf',       // 1 à 180 octets UTF-8, nom simple uniquement
    mimeType: 'application/pdf',   // type MIME en minuscules, sans paramètre
    totalSize: blob.size,
});

// Après l’acquittement begin, reprendre à detail.next_offset. Chaque bloc doit
// commencer exactement à cet offset et rester inférieur ou égal à 256 Kio.
window.MaisonPiloteNative.outgoingDocument.append({
    requestId: crypto.randomUUID(),
    transferId,
    offset,
    dataBase64,
});

// `preview` présente Quick Look. `share` et `save` présentent la feuille iOS,
// qui permet notamment Partager, Ouvrir dans… et Enregistrer dans Fichiers.
window.MaisonPiloteNative.outgoingDocument.finish({
    requestId: crypto.randomUUID(),
    transferId,
    mode: 'preview', // preview | share | save
});
```

Chaque commande produit exactement un événement corrélé
`maisonpilote:outgoing-document-result` lorsque son `request_id` est valide :

```js
window.addEventListener('maisonpilote:outgoing-document-result', ({ detail }) => {
    // Succès : {request_id, transfer_id, action, success: true, state,
    //            next_offset?, total_size?, max_chunk_size?, mode?}
    // Erreur : {request_id, transfer_id?, action, success: false,
    //            expected_offset?, received_size?, error: {code, message}}
});
```

Après `finish`, la fermeture de l’interface native produit un second événement
`maisonpilote:outgoing-document-presentation` avec
`{request_id, transfer_id, mode, outcome, cleaned}`. `outcome` vaut
`completed`, `cancelled`, `dismissed` ou `failed`. Le `request_id` est celui de
la commande `finish`.

Une interruption explicite supprime le fichier partiel et est elle aussi
acquittée. `cleanup` est idempotent et sert à abandonner un transfert déjà
préparé sans le présenter :

```js
window.MaisonPiloteNative.outgoingDocument.cancel({
    requestId: crypto.randomUUID(),
    transferId,
});
window.MaisonPiloteNative.outgoingDocument.cleanup({
    requestId: crypto.randomUUID(),
    transferId,
});
```

Le fichier et son manifeste minimal sont écrits sous protection complète dans
le répertoire temporaire privé, exclus des sauvegardes, validés après chaque
bloc puis supprimés à la fermeture de Quick Look ou de la feuille de partage.
Ils ne sont copiés ni dans les logs ni dans `UserDefaults`. Un rechargement du
processus WebKit peut reprendre au `next_offset` renvoyé par un nouvel appel
`begin` identique ; un redémarrage complet de l’application purge les restes.

## App Apple Watch

Le projet embarque les cibles `MaisonPiloteWatch` et
`MaisonPiloteWatchExtension`, version **1.111 (111)** comme l’app iPhone et
watchOS **9.4** minimum. L’écran SwiftUI reprend le parcours Wear OS : contrôle
de disponibilité admin, dictée ou saisie système, transmission, suivi toutes les
3 secondes, modèle et niveau de raisonnement, réponse et arrêt d’un traitement
encore annulable.

La montre utilise `WatchConnectivity.sendMessage` avec une réponse corrélée. Si
l’iPhone n’est pas joignable ou réveillable, elle affiche une erreur et ne
simule jamais une transmission. L’iPhone appelle ensuite les endpoints
`/api/mobile/v1/assistant/codex/runs` avec le bearer et l’UUID de son propre
`MobileDevice`. La création emploie l’UUID de la requête comme clé
d’idempotence et fixe `source=watchos_voice_assistant`. Le serveur continue donc
à imposer l’authentification, l’appareil iOS et le rôle administrateur.

## Prérequis macOS

- un Mac avec Xcode 16 ou une version compatible avec le SDK ciblé ;
- les outils de ligne de commande Xcode sélectionnés ;
- XcodeGen (`brew install xcodegen`) ;
- un abonnement Apple Developer actif pour l’installation sur iPhone et TestFlight ;
- dans le portail Apple : bundle ID iPhone, identifiants compagnons
  `.watchkitapp` et `.watchkitapp.watchkitextension`, App Group, Associated
  Domains, Siri et Push Notifications activés ;
- le composant watchOS installé dans Xcode.

La compilation et la signature iOS ne sont pas possibles sur le serveur Linux. Les contrôles Linux peuvent seulement valider les fichiers YAML, plist et shell.

## Préparer le projet

```bash
cd /var/www/compta/mobile/ios/maison-pilote
cp Config/Local.example.xcconfig Config/Local.xcconfig
# Renseigner MAISON_PILOTE_DEVELOPMENT_TEAM dans Local.xcconfig
./scripts/bootstrap.sh
open MaisonPiloteIOS.xcodeproj
```

Le bootstrap lit sans les modifier les assets existants :

- icône : `mobile/android/maison-pilote/.../maison_pilote_app_icon_safe_frame.png` ;
- logo : `public/images/maison-pilote/logo-couleur.png`.

Il génère les tailles exigées par Apple dans `.generated/`. Le fond blanc de l’AppIcon reproduit exactement `launcher_icon_background` de l’application Android ; le logo de lancement est copié tel quel.

## Tester sur un iPhone

1. Brancher l’iPhone au Mac et l’approuver dans Xcode.
2. Ouvrir le projet généré, choisir la cible **MaisonPilote** et l’équipe Apple.
3. Vérifier que le profil autorise l’App Group `group.expert.meilhac.maisonpilote`, Associated Domains, Siri et Push Notifications.
4. Sélectionner l’iPhone comme destination puis lancer **Run**.
5. Se connecter sur la page iOS, accepter les notifications, puis tester caméra, micro, un push APNs, un lien universel, un partage PDF/image et le raccourci Siri « Demander à Maison Pilote ».
6. Dans la destination Xcode, choisir la paire iPhone + Apple Watch, lancer la
   cible **MaisonPiloteWatch**, puis toucher le champ « Votre demande » pour
   dicter ou saisir. Vérifier également le refus d’un compte non-admin,
   l’actualisation à 3 secondes, « Arrêter » et le message obtenu lorsque
   l’iPhone est hors de portée.

Un build Debug reçoit un jeton APNs `sandbox`; TestFlight reçoit un jeton `production`. La configuration `MOBILE_APNS_ENVIRONMENT` du serveur doit correspondre au build testé. La clé APNs `.p8` et son Key ID sont des secrets serveur : ne jamais les copier dans le projet Xcode, l’IPA ou les variables de build.

Un build simulateur non signé peut aussi être lancé avec :

```bash
./scripts/build.sh
```

Pour un build appareil signé :

```bash
IOS_BUILD_SDK=iphoneos \
IOS_DEVELOPMENT_TEAM=ABCDE12345 \
./scripts/build.sh
```

## Publier sur TestFlight

Créer une clé API App Store Connect avec le droit nécessaire, conserver le fichier `.p8` hors du dépôt, puis charger les variables de `.env.ios.example`. Exemple :

```bash
set -a
source /chemin/securise/maison-pilote-ios.env
set +a
./scripts/release-testflight.sh
```

Le script archive, signe et demande à Xcode d’envoyer le build à App Store Connect. Il n’affiche ni ne copie la clé privée. Le script autonome s’arrête après l’upload : Apple doit ensuite finir le traitement et autoriser la bêta. L’orchestrateur Laravel décrit ci-dessous vérifie cet état avant d’activer la release côté Maison Pilote.

L’orchestrateur Laravel utilise `scripts/release.sh`. Sur macOS, il construit
directement. Sur Linux, `scripts/release-github.sh` déclenche automatiquement le
workflow GitHub hébergé sur `macos-15`, attend son résultat puis reprend le
contrôle côté serveur. La commande suivante calcule automatiquement une version
au moins égale à
**1.111 (111)**, construit et téléverse la release. Elle ne l’active qu’après
vérification App Store Connect et disponibilité réelle dans le groupe public :

```bash
php artisan mobile:ios:release \
  --channel=beta \
  --notes="Première version iOS de test"
```

`CFBundleVersion` est un entier positif et sert aussi de code de version serveur.
Après l’upload, Laravel crée ou met à jour les notes « What to Test », affecte le
build au groupe externe public, soumet la revue bêta si elle est nécessaire et
n’active la release qu’une fois l’état Apple `IN_BETA_TESTING`. Des métadonnées
de revue manquantes sont signalées explicitement et aucune mise à jour, même
marquée obligatoire, n’est activée avant cet état.

Si le polling ou la revue dépasse le délai après un upload réussi, reprendre le
build sans le téléverser une deuxième fois, depuis macOS ou Linux :

```bash
php artisan mobile:ios:release \
  --resume-provider-build-id=BUILD_ID \
  --version-name=1.111 \
  --build-number=111 \
  --channel=beta \
  --notes="Première version iOS de test"
```

L’identifiant et la commande de reprise sont affichés à l’expiration du délai.
Pour une installation directe sur un appareil autorisé, utiliser Xcode ou
`scripts/build.sh` comme décrit plus haut. Laravel ne propose aucun canal iOS
auto-hébergé : seule une release TestFlight vérifiée peut être activée.

## Variables prises en charge

- `IOS_DEVELOPMENT_TEAM` ;
- `IOS_BUNDLE_IDENTIFIER` ;
- `IOS_APP_GROUP_IDENTIFIER` ;
- `IOS_ASSOCIATED_DOMAIN` ;
- `IOS_MINIMUM_OS_VERSION` (fallback serveur `MOBILE_IOS_MINIMUM_OS_VERSION`, valeur initiale `16.4`) ;
- `IOS_WATCH_MINIMUM_OS_VERSION` (valeur initiale `9.4`) ;
- `IOS_MARKETING_VERSION` et `IOS_BUILD_NUMBER` ;
- `IOS_APP_STORE_CONNECT_API_KEY_ID` ;
- `IOS_APP_STORE_CONNECT_ISSUER_ID` ;
- `IOS_APP_STORE_CONNECT_API_PRIVATE_KEY` ;
- `IOS_TESTFLIGHT_URL` ;
- `IOS_CONFIGURATION`, `IOS_BUILD_SDK`, `IOS_DESTINATION`, `IOS_DERIVED_DATA_PATH` pour le build local.

Le serveur Laravel utilise en plus `MOBILE_IOS_ASC_APP_ID`,
`MOBILE_IOS_ASC_BETA_GROUP_ID`, `MOBILE_IOS_ASC_BETA_LOCALE` (par défaut
`fr-FR`), `MOBILE_IOS_ASC_KEY_ID`, `MOBILE_IOS_ASC_ISSUER_ID` et
`MOBILE_IOS_ASC_PRIVATE_KEY_FILE`. La clé doit être une clé API d’équipe P-256
autorisée à gérer l’application et TestFlight.

Sur le serveur Linux, la délégation utilise aussi
`MOBILE_IOS_GITHUB_RELEASE_SCRIPT`, `MOBILE_IOS_GITHUB_CLI`,
`MOBILE_IOS_GITHUB_CONFIG_DIR`, `MOBILE_IOS_GITHUB_REPOSITORY`,
`MOBILE_IOS_GITHUB_WORKFLOW` et `MOBILE_IOS_GITHUB_REF`. Le workflow n’est
déclenchable que manuellement par un compte GitHub autorisé et son jeton intégré
ne possède qu’un accès en lecture au contenu du dépôt.

Ne jamais versionner `Config/Local.xcconfig`, une clé `.p8`, un profil de provisioning, un certificat ou une archive signée.
