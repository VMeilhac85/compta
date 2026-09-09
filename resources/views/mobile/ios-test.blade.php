<!doctype html>
<html lang="fr" data-theme="light">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
    <meta name="theme-color" content="#17232b">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Maison Pilote">
    <meta name="format-detection" content="telephone=no">
    <meta name="robots" content="noindex, nofollow, noarchive">
    <title>Maison Pilote</title>
    <link rel="manifest" href="{{ asset('ios-test.webmanifest') }}">
    <link rel="apple-touch-icon" href="{{ asset('apple-touch-icon.png') }}">
    @vite(['resources/sass/app.scss', 'resources/js/app.js', 'resources/js/ios-web-app.js'])
</head>
<body class="ios-web-app{{ $nativeShell ? ' is-native-shell' : '' }}">
@php
    $latestVersionCode = max(1, (int) data_get($releaseConfiguration, 'latest_version_code', 1));
    $latestVersionName = (string) (data_get($releaseConfiguration, 'latest_version_name') ?: '1.0.0');
@endphp
<main class="ios-web-app__runtime" data-mobile-emulator
    data-runtime-source="{{ $nativeShell ? 'ios' : 'ios-pwa' }}"
    data-runtime-platform="ios"
    data-api-base-url="{{ $apiBaseUrl }}"
    data-site-url="{{ $siteUrl }}"
    data-owner="0"
    data-authenticated="0"
    data-remember-connection="1"
    data-current-version-code="{{ $latestVersionCode }}"
    data-current-version-name="{{ $latestVersionName }}"
    data-session-public-id="ios-web-app"
    data-config-url=""
    data-authentication-url="{{ url('/api/mobile/v1/auth/login') }}"
    data-biometric-url=""
    data-browser-authentication-url=""
    data-logout-url="{{ url('/api/mobile/v1/auth/logout') }}"
    data-clear-cache-url="">

    <section class="ios-web-app__device" aria-label="Application Maison Pilote pour iPhone">
        <div class="mobile-emulator-device mobile-emulator-device--ios" data-emulator-device style="--emulator-width: 430px; --emulator-height: 932px;">
            <div class="mobile-emulator-speaker mobile-emulator-dynamic-island" aria-hidden="true"></div>
            <div class="mobile-emulator-screen" data-emulator-screen data-platform="ios" data-theme="system">
                <div class="mobile-emulator-system-bar" aria-hidden="true">
                    <span>09:41</span>
                    <span class="mobile-emulator-connectivity" data-emulator-connectivity aria-label="Réseau mobile 5G">
                        <span data-emulator-connectivity-label>5G</span>
                        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 15.5h2.2v-2.7H3v2.7Zm3.9 0h2.2V10H6.9v5.5Zm3.9 0H13V7.2h-2.2v8.3Zm3.9 0h2.2V4.4h-2.2v11.1Z"/></svg>
                    </span>
                </div>
                <div class="mobile-emulator-app" data-emulator-app role="application" aria-label="Maison Pilote">
                    <div class="mobile-app-splash">
                        <span class="mobile-app-brand" aria-label="Maison Pilote">
                            <img class="mobile-app-brand__color" src="{{ asset('images/maison-pilote/logo-couleur.png') }}" alt="">
                            <img class="mobile-app-brand__light" src="{{ asset('images/maison-pilote/logo-clair.png') }}" alt="">
                        </span>
                        <div class="spinner-border spinner-border-sm text-primary" role="status"><span class="visually-hidden">Chargement</span></div>
                        <p>Connexion à Maison Pilote…</p>
                    </div>
                </div>
                <nav class="mobile-emulator-navigation-bar mobile-emulator-navigation-bar--ios" data-emulator-navigation-bar aria-label="Navigation système iOS">
                    <span class="mobile-emulator-home-indicator" aria-hidden="true"></span>
                </nav>
            </div>
        </div>
    </section>

    <section class="ios-web-app__internals" aria-hidden="true">
        <div data-emulator-safety-bar data-read-only="0">
            <strong data-emulator-mode-label></strong><span data-emulator-mode-detail></span>
            <button type="button" data-emulator-enable-writes></button>
            <button type="button" data-emulator-disable-writes></button>
        </div>
        <select data-emulator-profile tabindex="-1"><option value="430x932">iPhone</option></select>
        <select data-emulator-orientation tabindex="-1"><option value="portrait">Portrait</option><option value="landscape">Paysage</option></select>
        <select data-emulator-theme tabindex="-1"><option value="system">Système</option><option value="light">Clair</option><option value="dark">Sombre</option></select>
        <select data-emulator-latency tabindex="-1"><option value="0">Normale</option></select>
        <select data-emulator-version-code tabindex="-1">
            @forelse($releaseVersions as $version)
                <option value="{{ $version['version_code'] }}" data-version-name="{{ $version['version_name'] }}" @selected((int) $version['version_code'] === $latestVersionCode)>{{ $version['version_name'] }}</option>
            @empty
                <option value="{{ $latestVersionCode }}" data-version-name="{{ $latestVersionName }}">{{ $latestVersionName }}</option>
            @endforelse
        </select>
        <input data-emulator-offline type="checkbox" tabindex="-1">
        <input data-emulator-deep-link value="{{ url('/app/accueil') }}" tabindex="-1">
        <button type="button" data-emulator-open-link></button>
        <button type="button" data-emulator-clear-cache></button>
        <button type="button" data-emulator-restart></button>
        <button type="button" data-emulator-clear-diagnostics></button>
        <span data-emulator-network-status>En ligne</span>
        <span data-emulator-identity>Non connecté</span>
        <span data-emulator-active-dossier>Aucun dossier</span>
        <div data-emulator-request-log></div>
        <div data-emulator-upload-status></div>
        <dialog data-emulator-write-dialog>
            <button type="button" data-emulator-write-dialog-close></button>
            <input data-emulator-write-confirm type="checkbox">
            <button type="button" data-emulator-write-confirm-button></button>
        </dialog>
    </section>
</main>

@unless($nativeShell)
<aside class="ios-web-app__install-hint" data-ios-install-hint role="status">
    <button type="button" class="ios-web-app__install-close" data-ios-install-dismiss aria-label="Fermer">×</button>
    <strong>Installer Maison Pilote</strong>
    <span>Dans Safari : Partager - Ajouter à l’écran d’accueil - Ouvrir comme app.</span>
    @if($testFlightUrl)
        <a href="{{ $testFlightUrl }}" rel="noopener noreferrer">Ouvrir la version TestFlight</a>
    @endif
</aside>
@endunless

</body>
</html>
