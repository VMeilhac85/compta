<?php

return [
    'api_version' => 'v1',
    'platform' => 'android',
    'package_name' => 'expert.meilhac.maisonpilote',
    'channel' => env('MOBILE_APP_CHANNEL', 'beta'),
    'maintenance' => (bool) env('MOBILE_APP_MAINTENANCE', false),
    'maintenance_message' => env('MOBILE_APP_MAINTENANCE_MESSAGE'),

    'owner' => [
        'user_id' => 2,
        'expected_name' => 'Valentin Meilhac',
        'expected_email' => 'valentin@meilhac.expert',
    ],

    'tokens' => [
        'lifetime_days' => (int) env('MOBILE_TOKEN_LIFETIME_DAYS', 30),
        'refresh_window_days' => (int) env('MOBILE_TOKEN_REFRESH_WINDOW_DAYS', 7),
        'purge_after_hours' => (int) env('MOBILE_TOKEN_PURGE_AFTER_HOURS', 24),
    ],

    'releases' => [
        'disk' => env('MOBILE_RELEASE_DISK', 'local'),
        'directory' => 'mobile/releases/android',
        'ticket_lifetime_minutes' => (int) env('MOBILE_DOWNLOAD_TICKET_MINUTES', 5),
        'trusted_certificate_file' => env(
            'MOBILE_ANDROID_TRUSTED_CERTIFICATE_FILE',
            '/etc/maison-pilote/android-signing/certificate.sha256',
        ),
    ],

    'android_tools' => [
        'apksigner' => env('ANDROID_APKSIGNER'),
        'aapt' => env('ANDROID_AAPT'),
    ],

    'android_signing' => [
        'directory' => env('MOBILE_ANDROID_SIGNING_DIRECTORY', '/etc/maison-pilote/android-signing'),
        'keystore' => env('MOBILE_ANDROID_KEYSTORE', '/etc/maison-pilote/android-signing/maison-pilote-release.p12'),
        'properties' => env('MOBILE_ANDROID_SIGNING_PROPERTIES', '/etc/maison-pilote/android-signing/signing.properties'),
    ],

    'ios' => [
        'bundle_identifier' => env('MOBILE_IOS_BUNDLE_ID', 'expert.meilhac.maisonpilote'),
        'team_identifier' => env('MOBILE_IOS_TEAM_ID'),
        'minimum_os_version' => env('MOBILE_IOS_MINIMUM_OS_VERSION', '16.4'),
        'testflight_url' => env('MOBILE_IOS_TESTFLIGHT_URL'),
        'pwa_auth' => [
            'cookie_name' => env('MOBILE_IOS_PWA_AUTH_COOKIE', 'maison_pilote_ios_pwa'),
            'cookie_path' => env('MOBILE_IOS_PWA_AUTH_COOKIE_PATH', '/api/mobile/v1'),
        ],
        'release_script' => env(
            'MOBILE_IOS_RELEASE_SCRIPT',
            base_path('mobile/ios/maison-pilote/scripts/release.sh'),
        ),
        'release_timeout_seconds' => (int) env('MOBILE_IOS_RELEASE_TIMEOUT_SECONDS', 3600),
        'github' => [
            'release_script' => env(
                'MOBILE_IOS_GITHUB_RELEASE_SCRIPT',
                base_path('mobile/ios/maison-pilote/scripts/release-github.sh'),
            ),
            'cli' => env('MOBILE_IOS_GITHUB_CLI', 'gh'),
            'config_directory' => env(
                'MOBILE_IOS_GITHUB_CONFIG_DIR',
                storage_path('app/private/github/config'),
            ),
            'repository' => env('MOBILE_IOS_GITHUB_REPOSITORY', 'VMeilhac85/compta'),
            'workflow' => env('MOBILE_IOS_GITHUB_WORKFLOW', 'ios-testflight.yml'),
            'ref' => env('MOBILE_IOS_GITHUB_REF', 'main'),
        ],
        'app_store_connect' => [
            'app_id' => env('MOBILE_IOS_ASC_APP_ID'),
            'beta_group_id' => env('MOBILE_IOS_ASC_BETA_GROUP_ID'),
            'beta_locale' => env('MOBILE_IOS_ASC_BETA_LOCALE', 'fr-FR'),
            'beta_description' => env(
                'MOBILE_IOS_ASC_BETA_DESCRIPTION',
                'Maison Pilote est l’application mobile sécurisée de la plateforme Maison Pilote. Elle permet aux professionnels, clients et salariés autorisés de consulter leurs dossiers et documents, de transmettre des justificatifs, de recevoir des notifications et d’utiliser les fonctions mobiles disponibles selon leur profil.',
            ),
            'beta_feedback_email' => env('MOBILE_IOS_ASC_BETA_FEEDBACK_EMAIL', 'valentin@meilhac.expert'),
            'beta_marketing_url' => env('MOBILE_IOS_ASC_BETA_MARKETING_URL', 'https://maisonpilote.meilhac.expert'),
            'beta_privacy_policy_url' => env('MOBILE_IOS_ASC_BETA_PRIVACY_POLICY_URL'),
            'review_contact_first_name' => env('MOBILE_IOS_ASC_REVIEW_CONTACT_FIRST_NAME'),
            'review_contact_last_name' => env('MOBILE_IOS_ASC_REVIEW_CONTACT_LAST_NAME'),
            'review_contact_email' => env('MOBILE_IOS_ASC_REVIEW_CONTACT_EMAIL'),
            'review_contact_phone' => env('MOBILE_IOS_ASC_REVIEW_CONTACT_PHONE'),
            'review_notes' => env(
                'MOBILE_IOS_ASC_REVIEW_NOTES',
                'Le compte fourni ouvre un dossier de démonstration contenant uniquement des données fictives. Après connexion, sélectionnez le dossier « Démo GRH ». Les fonctions de photographie, de partage de documents, de notifications et de dictée nécessitent les autorisations iOS correspondantes.',
            ),
            'demo_account_required' => (bool) env('MOBILE_IOS_ASC_DEMO_ACCOUNT_REQUIRED', false),
            'demo_account_name' => env('MOBILE_IOS_ASC_DEMO_ACCOUNT_NAME'),
            'demo_account_password_file' => env('MOBILE_IOS_ASC_DEMO_ACCOUNT_PASSWORD_FILE'),
            'key_id' => env('MOBILE_IOS_ASC_KEY_ID'),
            'issuer_id' => env('MOBILE_IOS_ASC_ISSUER_ID'),
            'private_key_file' => env(
                'MOBILE_IOS_ASC_PRIVATE_KEY_FILE',
                '/etc/maison-pilote/app-store-connect/AuthKey.p8',
            ),
            'poll_timeout_seconds' => (int) env('MOBILE_IOS_ASC_POLL_TIMEOUT_SECONDS', 1200),
            'poll_interval_seconds' => (int) env('MOBILE_IOS_ASC_POLL_INTERVAL_SECONDS', 20),
            'connect_timeout_seconds' => (int) env('MOBILE_IOS_ASC_CONNECT_TIMEOUT_SECONDS', 10),
            'request_timeout_seconds' => (int) env('MOBILE_IOS_ASC_REQUEST_TIMEOUT_SECONDS', 30),
        ],
    ],

    'emulator' => [
        'session_minutes' => (int) env('MOBILE_EMULATOR_SESSION_MINUTES', 30),
        'write_minutes' => (int) env('MOBILE_EMULATOR_WRITE_MINUTES', 10),
    ],

    'cameleon' => [
        'session_minutes' => (int) env('MOBILE_CAMELEON_SESSION_MINUTES', 30),
    ],

    'uploads' => [
        'session_hours' => (int) env('MOBILE_UPLOAD_SESSION_HOURS', 24),
        'chunk_bytes' => (int) env('MOBILE_UPLOAD_CHUNK_BYTES', 5 * 1024 * 1024),
    ],

    'reports' => [
        'disk' => env('MOBILE_REPORT_DISK', 'local'),
        'directory' => 'mobile/reports',
        'retention_days' => (int) env('MOBILE_REPORT_RETENTION_DAYS', 7),
    ],

    'short_links' => [
        'base_url' => rtrim((string) env('MOBILE_SHORT_LINK_BASE_URL', 'https://maisonpilote.fr'), '/'),
    ],

    'fcm' => [
        'project_id' => env('FIREBASE_PROJECT_ID', 'maison-pilote'),
        'service_account_file' => env(
            'FIREBASE_SERVICE_ACCOUNT_FILE',
            '/etc/maison-pilote/firebase/firebase-service-account.json',
        ),
    ],

    'apns' => [
        'enabled' => (bool) env('MOBILE_APNS_ENABLED', true),
        'environment' => env('MOBILE_APNS_ENVIRONMENT', 'production'),
        'team_id' => env('MOBILE_APNS_TEAM_ID', env('MOBILE_IOS_TEAM_ID')),
        'key_id' => env('MOBILE_APNS_KEY_ID'),
        'topic' => env(
            'MOBILE_APNS_TOPIC',
            env('MOBILE_IOS_BUNDLE_ID', 'expert.meilhac.maisonpilote'),
        ),
        'private_key_file' => env(
            'MOBILE_APNS_PRIVATE_KEY_FILE',
            '/etc/maison-pilote/apns/AuthKey.p8',
        ),
        'connect_timeout_seconds' => (int) env('MOBILE_APNS_CONNECT_TIMEOUT_SECONDS', 5),
        'timeout_seconds' => (int) env('MOBILE_APNS_TIMEOUT_SECONDS', 20),
    ],

    'notification_mirroring' => [
        'enabled' => env('MOBILE_NOTIFICATION_MIRROR_ENABLED', true),
        'recipient_user_id' => (int) env('MOBILE_NOTIFICATION_MIRROR_USER_ID', 2),
        'expected_email' => env('MOBILE_NOTIFICATION_MIRROR_EXPECTED_EMAIL', 'valentin@meilhac.expert'),
    ],
];
