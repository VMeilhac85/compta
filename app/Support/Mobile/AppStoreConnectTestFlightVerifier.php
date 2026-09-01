<?php

namespace App\Support\Mobile;

use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use JsonException;
use OpenSSLAsymmetricKey;
use Psr\Http\Message\RequestInterface;
use Throwable;

final class AppStoreConnectTestFlightVerifier
{
    private const API_BASE_URL = 'https://api.appstoreconnect.apple.com/v1';

    /**
     * Vérifie l'identité du build, attend son traitement Apple, l'affecte au groupe
     * TestFlight public configuré puis attend qu'il soit réellement installable.
     *
     * @return array{build_id:string,app_id:string,beta_group_id:string,processing_state:string,internal_build_state:?string,external_build_state:string,minimum_os_version:string,beta_locale:string,public_link:string,verified_at_utc:string}
     */
    public function verifyReadyForTesting(
        string $bundleIdentifier,
        string $versionName,
        string $buildNumber,
        string $testFlightUrl,
        string $releaseNotes,
        ?string $expectedBuildId = null,
        ?string $expectedMinimumOsVersion = null,
    ): array {
        $client = $this->client();
        $appId = $this->resolveAppId($client, $bundleIdentifier);
        $group = $this->resolvePublicBetaGroup($client, $appId, $testFlightUrl);
        $locale = $this->betaLocale();
        $this->ensureBetaAppLocalizations($client, $appId, $locale);
        $this->ensureBetaReviewDetail($client, $appId);
        $deadline = microtime(true) + max(30, (int) config('mobile.ios.app_store_connect.poll_timeout_seconds', 1200));
        $interval = max(5, min(60, (int) config('mobile.ios.app_store_connect.poll_interval_seconds', 20)));
        $buildAssigned = false;
        $localizationEnsured = false;
        $lastBuildId = null;
        $lastExternalState = null;

        do {
            $build = $this->findBuild(
                $client,
                $appId,
                $bundleIdentifier,
                $versionName,
                $buildNumber,
                $expectedBuildId,
            );

            if ($build !== null) {
                $lastBuildId = (string) $build['id'];
                $processingState = strtoupper((string) data_get($build, 'attributes.processingState'));
                if (in_array($processingState, ['FAILED', 'INVALID'], true)) {
                    $this->fail(
                        'provider_build_id',
                        "Apple a refusé le build TestFlight {$versionName} ({$buildNumber}) : {$processingState}.",
                    );
                }

                if ($processingState === 'VALID') {
                    $minimumOsVersion = $this->minimumOsVersion($build, $expectedMinimumOsVersion);
                    $betaState = $this->betaState($build);
                    $externalState = strtoupper((string) ($betaState['external'] ?? ''));
                    $lastExternalState = $externalState !== '' ? $externalState : null;
                    if ($externalState === 'EXPIRED') {
                        $this->fail('provider_build_id', 'Le build TestFlight trouvé est expiré.');
                    }
                    if (in_array($externalState, ['BETA_REJECTED', 'PROCESSING_EXCEPTION'], true)) {
                        $this->fail(
                            'provider_build_id',
                            "Le build TestFlight n’est pas distribuable : {$externalState}.",
                        );
                    }
                    if ($externalState === 'MISSING_EXPORT_COMPLIANCE') {
                        $this->fail(
                            'provider_build_id',
                            'Apple attend la déclaration de conformité de chiffrement du build TestFlight.',
                        );
                    }

                    if (! $localizationEnsured) {
                        $this->ensureBetaBuildLocalization(
                            $client,
                            (string) $build['id'],
                            $locale,
                            $releaseNotes,
                        );
                        $localizationEnsured = true;
                    }

                    $betaGroupIds = $this->relationshipIds($build, 'betaGroups');
                    if (! in_array($group['id'], $betaGroupIds, true) && ! $buildAssigned) {
                        $this->addBuildToGroup($client, $group['id'], (string) $build['id']);
                        $buildAssigned = true;
                    }

                    if ($externalState === 'READY_FOR_BETA_SUBMISSION') {
                        $this->ensureBetaReviewSubmitted($client, $build);
                    }

                    if ($externalState === 'NOT_APPLICABLE'
                        && in_array($group['id'], $betaGroupIds, true)) {
                        $this->fail(
                            'provider_build_id',
                            'Apple indique que ce build n’est pas éligible aux tests TestFlight externes.',
                        );
                    }

                    if (in_array($group['id'], $betaGroupIds, true) && $externalState === 'IN_BETA_TESTING') {
                        return [
                            'build_id' => (string) $build['id'],
                            'app_id' => $appId,
                            'beta_group_id' => $group['id'],
                            'processing_state' => $processingState,
                            'internal_build_state' => $betaState['internal'],
                            'external_build_state' => $externalState,
                            'minimum_os_version' => $minimumOsVersion,
                            'beta_locale' => $locale,
                            'public_link' => $group['public_link'],
                            'verified_at_utc' => now('UTC')->toIso8601ZuluString(),
                        ];
                    }
                }
            }

            if (microtime(true) >= $deadline) {
                break;
            }
            sleep($interval);
        } while (true);

        $recovery = $lastBuildId !== null
            ? " Reprenez sans nouvel upload avec --resume-provider-build-id={$lastBuildId}, --version-name={$versionName} et --build-number={$buildNumber}."
            : " Reprenez sans nouvel upload avec mobile:ios:publish --version-code={$buildNumber} --version-name={$versionName} --build-number={$buildNumber} et les mêmes canal, notes et lien TestFlight.";
        $state = $lastExternalState !== null ? " Dernier état externe : {$lastExternalState}." : '';
        $this->fail('provider_build_id',
            'Le build n’est pas encore disponible dans le groupe TestFlight public avant expiration du délai.'
            .$state.$recovery,
        );
    }

    private function client(): PendingRequest
    {
        return Http::baseUrl(self::API_BASE_URL)
            ->acceptJson()
            ->withRequestMiddleware(
                fn (RequestInterface $request): RequestInterface => $request->withHeader(
                    'Authorization',
                    'Bearer '.$this->jwt(),
                ),
            )
            ->connectTimeout(max(2, (int) config('mobile.ios.app_store_connect.connect_timeout_seconds', 10)))
            ->timeout(max(5, (int) config('mobile.ios.app_store_connect.request_timeout_seconds', 30)))
            ->retry(3, 750, static function (Throwable $exception): bool {
                if ($exception instanceof ConnectionException) {
                    return true;
                }

                return $exception instanceof RequestException
                    && ($exception->response->status() === 429 || $exception->response->serverError());
            }, throw: false);
    }

    private function resolveAppId(PendingRequest $client, string $bundleIdentifier): string
    {
        $configuredId = trim((string) config('mobile.ios.app_store_connect.app_id'));
        $query = ['filter[bundleId]' => $bundleIdentifier, 'fields[apps]' => 'bundleId,name', 'limit' => 2];
        if ($configuredId !== '') {
            $query['filter[id]'] = $configuredId;
        }
        $payload = $this->json($client->get('/apps', $query), 'la recherche de l’application iOS');
        $apps = is_array($payload['data'] ?? null) ? $payload['data'] : [];
        if (count($apps) !== 1
            || (string) data_get($apps[0], 'type') !== 'apps'
            || ! hash_equals($bundleIdentifier, (string) data_get($apps[0], 'attributes.bundleId'))) {
            $this->fail(
                'bundle_id',
                'App Store Connect ne retourne pas exactement l’application correspondant au Bundle Identifier configuré.',
            );
        }
        $appId = trim((string) ($apps[0]['id'] ?? ''));
        if ($appId === '' || ($configuredId !== '' && ! hash_equals($configuredId, $appId))) {
            $this->fail('bundle_id', 'L’identifiant App Store Connect de l’application est incohérent.');
        }

        return $appId;
    }

    /** @return array{id:string,public_link:string} */
    private function resolvePublicBetaGroup(PendingRequest $client, string $appId, string $testFlightUrl): array
    {
        $groupId = trim((string) config('mobile.ios.app_store_connect.beta_group_id'));
        if ($groupId === '') {
            $this->fail(
                'testflight_url',
                'MOBILE_IOS_ASC_BETA_GROUP_ID doit identifier le groupe TestFlight public de test.',
            );
        }
        $payload = $this->json(
            $client->get("/betaGroups/{$this->pathId($groupId)}", [
                'fields[betaGroups]' => 'name,isInternalGroup,publicLinkEnabled,publicLink,app',
                'include' => 'app',
            ]),
            'la vérification du groupe TestFlight',
        );
        $group = is_array($payload['data'] ?? null) ? $payload['data'] : [];
        $publicLink = rtrim(trim((string) data_get($group, 'attributes.publicLink')), '/');
        $requestedLink = rtrim($testFlightUrl, '/');
        $linkedAppId = (string) data_get($group, 'relationships.app.data.id');
        if ((string) ($group['id'] ?? '') !== $groupId
            || (string) ($group['type'] ?? '') !== 'betaGroups'
            || (bool) data_get($group, 'attributes.isInternalGroup')
            || ! (bool) data_get($group, 'attributes.publicLinkEnabled')
            || $publicLink === ''
            || ! hash_equals($requestedLink, $publicLink)
            || ! hash_equals($appId, $linkedAppId)) {
            $this->fail(
                'testflight_url',
                'Le lien TestFlight ne correspond pas au groupe public configuré pour cette application.',
            );
        }

        return ['id' => $groupId, 'public_link' => $publicLink];
    }

    /** @return array<string, mixed>|null */
    private function findBuild(
        PendingRequest $client,
        string $appId,
        string $bundleIdentifier,
        string $versionName,
        string $buildNumber,
        ?string $expectedBuildId,
    ): ?array {
        $query = [
            'filter[app]' => $appId,
            'filter[version]' => $buildNumber,
            'filter[preReleaseVersion.version]' => $versionName,
            'include' => 'app,preReleaseVersion,buildBetaDetail,betaGroups,betaAppReviewSubmission',
            'fields[builds]' => 'version,processingState,expired,minOsVersion,app,preReleaseVersion,buildBetaDetail,betaGroups,betaAppReviewSubmission',
            'fields[apps]' => 'bundleId',
            'fields[preReleaseVersions]' => 'version,platform',
            'fields[buildBetaDetails]' => 'internalBuildState,externalBuildState',
            'fields[betaGroups]' => 'name,isInternalGroup,publicLinkEnabled,publicLink',
            'fields[betaAppReviewSubmissions]' => 'betaReviewState,submittedDate,build',
            'limit' => 2,
        ];
        $expectedBuildId = trim((string) $expectedBuildId);
        if ($expectedBuildId !== '') {
            $query['filter[id]'] = $expectedBuildId;
        }
        $payload = $this->json($client->get('/builds', $query), 'la vérification du build TestFlight');
        $builds = is_array($payload['data'] ?? null) ? $payload['data'] : [];
        if ($builds === []) {
            return null;
        }
        if (count($builds) !== 1) {
            $this->fail('provider_build_id', 'Plusieurs builds Apple correspondent aux métadonnées fournies.');
        }
        $build = $builds[0];
        if (! is_array($build)) {
            $this->fail('provider_build_id', 'App Store Connect a retourné un build dans un format invalide.');
        }
        $buildId = trim((string) ($build['id'] ?? ''));
        $appRelationshipId = (string) data_get($build, 'relationships.app.data.id');
        $preReleaseId = (string) data_get($build, 'relationships.preReleaseVersion.data.id');
        $included = is_array($payload['included'] ?? null) ? $payload['included'] : [];
        $includedApp = $this->includedResource($included, 'apps', $appRelationshipId);
        $preRelease = $this->includedResource($included, 'preReleaseVersions', $preReleaseId);
        if ($buildId === ''
            || ($expectedBuildId !== '' && ! hash_equals($expectedBuildId, $buildId))
            || (string) data_get($build, 'attributes.version') !== $buildNumber
            || (bool) data_get($build, 'attributes.expired')
            || ! hash_equals($appId, $appRelationshipId)
            || ! hash_equals($bundleIdentifier, (string) data_get($includedApp, 'attributes.bundleId'))
            || ! hash_equals($versionName, (string) data_get($preRelease, 'attributes.version'))
            || (string) data_get($preRelease, 'attributes.platform') !== 'IOS') {
            $this->fail('provider_build_id', 'Le build App Store Connect ne correspond pas à la release iOS demandée.');
        }
        $build['_included'] = $included;

        return $build;
    }

    /** @param array<string, mixed> $build */
    private function minimumOsVersion(array $build, ?string $expected): string
    {
        $actual = trim((string) data_get($build, 'attributes.minOsVersion'));
        if (preg_match('/^[0-9]+(?:\.[0-9]+){1,2}$/', $actual) !== 1) {
            $this->fail(
                'minimum_os_version',
                'App Store Connect ne retourne pas de version minimale iOS valide pour ce build.',
            );
        }
        $expected = trim((string) $expected);
        if ($expected !== '' && $this->normalizedOsVersion($actual) !== $this->normalizedOsVersion($expected)) {
            $this->fail(
                'minimum_os_version',
                "Le build App Store Connect exige iOS {$actual}, au lieu de la version {$expected} attendue.",
            );
        }

        return $actual;
    }

    private function normalizedOsVersion(string $version): string
    {
        $parts = array_map('intval', explode('.', $version));

        return implode('.', array_pad($parts, 3, 0));
    }

    /** @param array<string, mixed> $build
     * @return array{internal:?string,external:?string}
     */
    private function betaState(array $build): array
    {
        $id = (string) data_get($build, 'relationships.buildBetaDetail.data.id');
        $detail = $this->includedResource(
            is_array($build['_included'] ?? null) ? $build['_included'] : [],
            'buildBetaDetails',
            $id,
        );

        return [
            'internal' => $this->nullableUpper(data_get($detail, 'attributes.internalBuildState')),
            'external' => $this->nullableUpper(data_get($detail, 'attributes.externalBuildState')),
        ];
    }

    /** @param array<string, mixed> $resource
     * @return list<string>
     */
    private function relationshipIds(array $resource, string $relationship): array
    {
        $data = data_get($resource, "relationships.{$relationship}.data", []);
        if (! is_array($data)) {
            return [];
        }

        return array_values(array_filter(array_map(
            static fn ($item): string => is_array($item) ? trim((string) ($item['id'] ?? '')) : '',
            $data,
        )));
    }

    private function addBuildToGroup(PendingRequest $client, string $groupId, string $buildId): void
    {
        $response = $client->post(
            "/betaGroups/{$this->pathId($groupId)}/relationships/builds",
            ['data' => [['type' => 'builds', 'id' => $buildId]]],
        );
        if ($response->status() !== 204) {
            $this->fail('provider_build_id', $this->apiError($response, 'l’affectation au groupe TestFlight'));
        }
    }

    private function betaLocale(): string
    {
        $locale = trim((string) config('mobile.ios.app_store_connect.beta_locale', 'fr-FR'));
        if (strlen($locale) > 35
            || preg_match('/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/', $locale) !== 1) {
            $this->fail('app_store_connect', 'La locale TestFlight configurée est invalide.');
        }

        return $locale;
    }

    private function ensureBetaAppLocalizations(PendingRequest $client, string $appId, string $locale): void
    {
        $desired = $this->betaAppLocalizationAttributes();
        $resources = $this->betaAppLocalizations($client, $appId);
        $matching = null;

        foreach ($resources as $resource) {
            if (! is_array($resource) || (string) ($resource['type'] ?? '') !== 'betaAppLocalizations') {
                $this->fail('app_store_connect', 'Apple a retourné une localisation bêta invalide.');
            }
            $resourceLocale = trim((string) data_get($resource, 'attributes.locale'));
            if (hash_equals($locale, $resourceLocale)) {
                if ($matching !== null) {
                    $this->fail('app_store_connect', "Apple retourne plusieurs localisations bêta pour {$locale}.");
                }
                $matching = $resource;
                continue;
            }

            // Apple exige une description pour chaque localisation existante avant la revue.
            if (trim((string) data_get($resource, 'attributes.description')) === '') {
                $this->updateBetaAppLocalization($client, $resource, [
                    'description' => $desired['description'],
                    'feedbackEmail' => $desired['feedbackEmail'],
                ]);
            }
        }

        if (is_array($matching)) {
            $this->updateBetaAppLocalization($client, $matching, $desired);

            return;
        }

        $response = $client->post('/betaAppLocalizations', [
            'data' => [
                'type' => 'betaAppLocalizations',
                'attributes' => ['locale' => $locale] + $desired,
                'relationships' => [
                    'app' => ['data' => ['type' => 'apps', 'id' => $appId]],
                ],
            ],
        ]);
        if ($response->status() === 201) {
            return;
        }
        if ($response->status() === 409) {
            foreach ($this->betaAppLocalizations($client, $appId) as $resource) {
                if (is_array($resource)
                    && hash_equals($locale, trim((string) data_get($resource, 'attributes.locale')))) {
                    $this->updateBetaAppLocalization($client, $resource, $desired);

                    return;
                }
            }
        }

        $this->fail(
            'app_store_connect',
            $this->apiError($response, 'la création de la description localisée TestFlight'),
        );
    }

    /** @return list<array<string, mixed>> */
    private function betaAppLocalizations(PendingRequest $client, string $appId): array
    {
        $payload = $this->json(
            $client->get("/apps/{$this->pathId($appId)}/betaAppLocalizations", [
                'fields[betaAppLocalizations]' => 'locale,description,feedbackEmail,marketingUrl,privacyPolicyUrl,app',
                'limit' => 200,
            ]),
            'la lecture des descriptions TestFlight',
        );
        $resources = $payload['data'] ?? [];
        if (! is_array($resources) || ! array_is_list($resources)) {
            $this->fail('app_store_connect', 'Apple a retourné les descriptions TestFlight dans un format invalide.');
        }

        return array_values($resources);
    }

    /** @param array<string, mixed> $resource
     * @param array<string, string> $desired
     */
    private function updateBetaAppLocalization(
        PendingRequest $client,
        array $resource,
        array $desired,
    ): void {
        $id = trim((string) ($resource['id'] ?? ''));
        $changes = [];
        foreach ($desired as $attribute => $value) {
            if (! hash_equals($value, trim((string) data_get($resource, "attributes.{$attribute}")))) {
                $changes[$attribute] = $value;
            }
        }
        if ($changes === []) {
            return;
        }

        $response = $client->patch("/betaAppLocalizations/{$this->pathId($id)}", [
            'data' => [
                'type' => 'betaAppLocalizations',
                'id' => $id,
                'attributes' => $changes,
            ],
        ]);
        if ($response->status() !== 200) {
            $this->fail(
                'app_store_connect',
                $this->apiError($response, 'la mise à jour de la description TestFlight'),
            );
        }
    }

    /** @return array<string, string> */
    private function betaAppLocalizationAttributes(): array
    {
        $description = trim((string) config('mobile.ios.app_store_connect.beta_description'));
        if ($description === '' || mb_strlen($description) > 4000) {
            $this->fail('app_store_connect', 'La description bêta doit contenir entre 1 et 4 000 caractères.');
        }
        $feedbackEmail = trim((string) config('mobile.ios.app_store_connect.beta_feedback_email'));
        if (strlen($feedbackEmail) > 255 || filter_var($feedbackEmail, FILTER_VALIDATE_EMAIL) === false) {
            $this->fail('app_store_connect', 'L’adresse de retour TestFlight configurée est invalide.');
        }

        $attributes = [
            'description' => $description,
            'feedbackEmail' => $feedbackEmail,
        ];
        foreach ([
            'marketingUrl' => ['beta_marketing_url', 'marketing'],
            'privacyPolicyUrl' => ['beta_privacy_policy_url', 'confidentialité'],
        ] as $attribute => [$configuration, $label]) {
            $url = trim((string) config("mobile.ios.app_store_connect.{$configuration}"));
            if ($url === '') {
                continue;
            }
            $parts = parse_url($url);
            if (! is_array($parts)
                || strtolower((string) ($parts['scheme'] ?? '')) !== 'https'
                || trim((string) ($parts['host'] ?? '')) === ''
                || strlen($url) > 2048) {
                $this->fail('app_store_connect', "L’URL de {$label} TestFlight est invalide.");
            }
            $attributes[$attribute] = $url;
        }

        return $attributes;
    }

    private function ensureBetaReviewDetail(PendingRequest $client, string $appId): void
    {
        $payload = $this->json(
            $client->get("/apps/{$this->pathId($appId)}/betaAppReviewDetail", [
                'fields[betaAppReviewDetails]' => 'contactFirstName,contactLastName,contactPhone,contactEmail,demoAccountName,demoAccountPassword,demoAccountRequired,notes,app',
            ]),
            'la lecture des coordonnées de revue TestFlight',
        );
        $resource = $payload['data'] ?? null;
        if (! is_array($resource) || (string) ($resource['type'] ?? '') !== 'betaAppReviewDetails') {
            $this->fail('app_store_connect', 'Apple a retourné les coordonnées de revue TestFlight dans un format invalide.');
        }
        $id = trim((string) ($resource['id'] ?? ''));
        $response = $client->patch("/betaAppReviewDetails/{$this->pathId($id)}", [
            'data' => [
                'type' => 'betaAppReviewDetails',
                'id' => $id,
                'attributes' => $this->betaReviewAttributes(),
            ],
        ]);
        if ($response->status() !== 200) {
            $this->fail(
                'app_store_connect',
                $this->apiError($response, 'la mise à jour des coordonnées de revue TestFlight'),
            );
        }
    }

    /** @return array<string, mixed> */
    private function betaReviewAttributes(): array
    {
        $owner = User::query()->find((int) config('mobile.owner.user_id'));
        $expectedName = trim((string) config('mobile.owner.expected_name'));
        $expectedEmail = mb_strtolower(trim((string) config('mobile.owner.expected_email')));
        if (! $owner instanceof User
            || ! hash_equals($expectedName, trim((string) $owner->name))
            || ! hash_equals($expectedEmail, mb_strtolower(trim((string) $owner->email)))) {
            $this->fail('app_store_connect', 'Le contact propriétaire configuré pour la revue TestFlight est incohérent.');
        }

        $firstName = $this->configuredOrFallback(
            'review_contact_first_name',
            (string) $owner->first_name,
        );
        $lastName = $this->configuredOrFallback(
            'review_contact_last_name',
            (string) $owner->last_name,
        );
        $email = $this->configuredOrFallback(
            'review_contact_email',
            (string) ($owner->professional_email ?: $owner->email),
        );
        $phone = $this->configuredOrFallback(
            'review_contact_phone',
            (string) ($owner->professional_mobile ?: $owner->professional_phone ?: $owner->phone),
        );
        $phone = $this->internationalReviewPhone($phone);
        if ($firstName === '' || mb_strlen($firstName) > 100
            || $lastName === '' || mb_strlen($lastName) > 100
            || strlen($email) > 255 || filter_var($email, FILTER_VALIDATE_EMAIL) === false
            || $phone === '') {
            $this->fail('app_store_connect', 'Les coordonnées du contact de revue TestFlight sont absentes ou invalides.');
        }
        $notes = trim((string) config('mobile.ios.app_store_connect.review_notes'));
        if (mb_strlen($notes) > 4000) {
            $this->fail('app_store_connect', 'Les notes de revue TestFlight dépassent 4 000 caractères.');
        }

        $demoRequired = (bool) config('mobile.ios.app_store_connect.demo_account_required', false);
        $attributes = [
            'contactFirstName' => $firstName,
            'contactLastName' => $lastName,
            'contactPhone' => $phone,
            'contactEmail' => $email,
            'demoAccountRequired' => $demoRequired,
            'notes' => $notes,
        ];
        if (! $demoRequired) {
            return $attributes;
        }

        $demoAccountName = trim((string) config('mobile.ios.app_store_connect.demo_account_name'));
        $passwordFile = trim((string) config('mobile.ios.app_store_connect.demo_account_password_file'));
        $realPasswordFile = $passwordFile !== '' ? realpath($passwordFile) : false;
        $publicPath = realpath(public_path());
        if ($demoAccountName === '' || strlen($demoAccountName) > 255
            || $realPasswordFile === false || ! is_file($realPasswordFile) || ! is_readable($realPasswordFile)
            || ($publicPath !== false && str_starts_with($realPasswordFile, $publicPath.DIRECTORY_SEPARATOR))) {
            $this->fail('app_store_connect', 'Le compte de démonstration TestFlight est absent ou son secret n’est pas stocké hors du dossier public.');
        }
        $password = trim((string) file_get_contents($realPasswordFile));
        if (strlen($password) < 12 || strlen($password) > 255) {
            $this->fail('app_store_connect', 'Le mot de passe du compte de démonstration TestFlight est invalide.');
        }
        $attributes['demoAccountName'] = $demoAccountName;
        $attributes['demoAccountPassword'] = $password;

        return $attributes;
    }

    private function internationalReviewPhone(string $phone): string
    {
        $compact = preg_replace('/[^0-9+]/', '', trim($phone));
        if (! is_string($compact) || $compact === '') {
            return '';
        }

        if (str_starts_with($compact, '00')) {
            $compact = '+'.substr($compact, 2);
        } elseif (! str_starts_with($compact, '+')) {
            if (preg_match('/^0[1-9][0-9]{8}$/', $compact) === 1) {
                $compact = '+33'.substr($compact, 1);
            } elseif (preg_match('/^33[1-9][0-9]{8}$/', $compact) === 1) {
                $compact = '+'.$compact;
            } else {
                return '';
            }
        }

        return preg_match('/^\+[1-9][0-9]{7,14}$/', $compact) === 1 ? $compact : '';
    }

    private function configuredOrFallback(string $key, string $fallback): string
    {
        $configured = trim((string) config("mobile.ios.app_store_connect.{$key}"));

        return $configured !== '' ? $configured : trim($fallback);
    }

    private function ensureBetaBuildLocalization(
        PendingRequest $client,
        string $buildId,
        string $locale,
        string $releaseNotes,
    ): void {
        $releaseNotes = trim($releaseNotes);
        if ($releaseNotes === '' || mb_strlen($releaseNotes) > 4000) {
            $this->fail(
                'notes',
                'Les notes « What to Test » de TestFlight sont requises et limitées à 4 000 caractères.',
            );
        }

        $localization = $this->findBetaBuildLocalization($client, $buildId, $locale);
        if ($localization === null) {
            $response = $client->post('/betaBuildLocalizations', [
                'data' => [
                    'type' => 'betaBuildLocalizations',
                    'attributes' => ['locale' => $locale, 'whatsNew' => $releaseNotes],
                    'relationships' => [
                        'build' => ['data' => ['type' => 'builds', 'id' => $buildId]],
                    ],
                ],
            ]);
            if ($response->status() === 201) {
                return;
            }
            if ($response->status() !== 409) {
                $this->fail(
                    'notes',
                    $this->apiError($response, 'la création des notes localisées du build bêta'),
                );
            }

            // Une publication concurrente a pu créer la même locale entre le GET et le POST.
            $localization = $this->findBetaBuildLocalization($client, $buildId, $locale);
            if ($localization === null) {
                $this->fail(
                    'notes',
                    $this->apiError($response, 'la création des notes localisées du build bêta'),
                );
            }
        }

        if (hash_equals($releaseNotes, (string) data_get($localization, 'attributes.whatsNew'))) {
            return;
        }

        $localizationId = trim((string) ($localization['id'] ?? ''));
        $response = $client->patch("/betaBuildLocalizations/{$this->pathId($localizationId)}", [
            'data' => [
                'type' => 'betaBuildLocalizations',
                'id' => $localizationId,
                'attributes' => ['whatsNew' => $releaseNotes],
            ],
        ]);
        if ($response->status() !== 200) {
            $this->fail(
                'notes',
                $this->apiError($response, 'la mise à jour des notes localisées du build bêta'),
            );
        }
    }

    /** @return array<string, mixed>|null */
    private function findBetaBuildLocalization(
        PendingRequest $client,
        string $buildId,
        string $locale,
    ): ?array {
        $payload = $this->json(
            $client->get("/builds/{$this->pathId($buildId)}/betaBuildLocalizations", [
                'fields[betaBuildLocalizations]' => 'locale,whatsNew,build',
                'limit' => 200,
            ]),
            'la lecture des notes localisées du build bêta',
        );
        $resources = is_array($payload['data'] ?? null) ? $payload['data'] : [];
        $matching = array_values(array_filter(
            $resources,
            static fn (mixed $resource): bool => is_array($resource)
                && (string) ($resource['type'] ?? '') === 'betaBuildLocalizations'
                && (string) data_get($resource, 'attributes.locale') === $locale,
        ));
        if (count($matching) > 1) {
            $this->fail('notes', "Apple retourne plusieurs localisations bêta pour la locale {$locale}.");
        }

        return $matching[0] ?? null;
    }

    /** @param array<string, mixed> $build */
    private function ensureBetaReviewSubmitted(PendingRequest $client, array $build): void
    {
        $buildId = (string) ($build['id'] ?? '');
        $submission = $this->relatedBetaReviewSubmission($build)
            ?? $this->findBetaReviewSubmission($client, $buildId);
        if ($submission !== null) {
            $this->assertBetaReviewCanContinue($submission);

            return;
        }

        $response = $client->post('/betaAppReviewSubmissions', [
            'data' => [
                'type' => 'betaAppReviewSubmissions',
                'relationships' => [
                    'build' => ['data' => ['type' => 'builds', 'id' => $buildId]],
                ],
            ],
        ]);
        if ($response->status() === 201) {
            return;
        }
        if ($response->status() === 409) {
            $submission = $this->findBetaReviewSubmission($client, $buildId);
            if ($submission !== null) {
                $this->assertBetaReviewCanContinue($submission);

                return;
            }
        }
        if (in_array($response->status(), [400, 409, 422], true)) {
            $this->fail('app_store_connect', $this->betaReviewMetadataError($response));
        }

        $this->fail(
            'app_store_connect',
            $this->apiError($response, 'la soumission du build à la revue bêta'),
        );
    }

    /** @param array<string, mixed> $build
     * @return array<string, mixed>|null
     */
    private function relatedBetaReviewSubmission(array $build): ?array
    {
        $submissionId = trim((string) data_get($build, 'relationships.betaAppReviewSubmission.data.id'));
        if ($submissionId === '') {
            return null;
        }
        $submission = $this->includedResource(
            is_array($build['_included'] ?? null) ? $build['_included'] : [],
            'betaAppReviewSubmissions',
            $submissionId,
        );

        return $submission !== [] ? $submission : null;
    }

    /** @return array<string, mixed>|null */
    private function findBetaReviewSubmission(PendingRequest $client, string $buildId): ?array
    {
        $payload = $this->json($client->get('/betaAppReviewSubmissions', [
            'filter[build]' => $buildId,
            'fields[betaAppReviewSubmissions]' => 'betaReviewState,submittedDate,build',
            'limit' => 2,
        ]), 'la recherche de la soumission à la revue bêta');
        $submissions = is_array($payload['data'] ?? null) ? $payload['data'] : [];
        if (count($submissions) > 1) {
            $this->fail(
                'app_store_connect',
                'Apple retourne plusieurs soumissions de revue bêta pour le même build.',
            );
        }
        if ($submissions === []) {
            return null;
        }
        $submission = $submissions[0];
        if (! is_array($submission)
            || (string) ($submission['type'] ?? '') !== 'betaAppReviewSubmissions'
            || (string) data_get($submission, 'relationships.build.data.id') !== $buildId) {
            $this->fail('app_store_connect', 'La soumission de revue bêta retournée par Apple est incohérente.');
        }

        return $submission;
    }

    /** @param array<string, mixed> $submission */
    private function assertBetaReviewCanContinue(array $submission): void
    {
        $state = $this->nullableUpper(data_get($submission, 'attributes.betaReviewState'));
        if (in_array($state, ['WAITING_FOR_REVIEW', 'IN_REVIEW', 'APPROVED'], true)) {
            return;
        }
        if ($state === 'REJECTED') {
            $this->fail(
                'app_store_connect',
                'La revue bêta Apple a rejeté ce build. Corrigez le motif dans App Store Connect avant toute nouvelle soumission.',
            );
        }

        $this->fail(
            'app_store_connect',
            'Apple retourne un état de soumission à la revue bêta inconnu ou vide.',
        );
    }

    private function betaReviewMetadataError(Response $response): string
    {
        return 'Apple refuse la soumission à la revue bêta (HTTP '.$response->status().'). '
            .'Les métadonnées de revue ont été synchronisées automatiquement ; vérifiez le refus Apple, '
            .'notamment une éventuelle information de conformité à l’export encore attendue. '
            .'Détail Apple : '.$this->apiDetail($response).'.';
    }

    /** @param list<mixed> $included
     * @return array<string, mixed>
     */
    private function includedResource(array $included, string $type, string $id): array
    {
        foreach ($included as $resource) {
            if (is_array($resource)
                && (string) ($resource['type'] ?? '') === $type
                && (string) ($resource['id'] ?? '') === $id) {
                return $resource;
            }
        }

        return [];
    }

    /** @return array<string, mixed> */
    private function json(Response $response, string $operation): array
    {
        if (! $response->successful()) {
            $this->fail('app_store_connect', $this->apiError($response, $operation));
        }
        try {
            $payload = $response->json();
        } catch (Throwable) {
            $payload = null;
        }
        if (! is_array($payload)) {
            $this->fail('app_store_connect', "App Store Connect a retourné une réponse invalide pendant {$operation}.");
        }

        return $payload;
    }

    private function apiError(Response $response, string $operation): string
    {
        return "App Store Connect a refusé {$operation} (HTTP {$response->status()}) : "
            .$this->apiDetail($response).'.';
    }

    private function apiDetail(Response $response): string
    {
        $detail = trim((string) data_get($response->json(), 'errors.0.detail'));

        return $detail !== '' ? mb_substr($detail, 0, 500) : 'réponse sans détail';
    }

    private function jwt(): string
    {
        $keyId = trim((string) config('mobile.ios.app_store_connect.key_id'));
        $issuerId = trim((string) config('mobile.ios.app_store_connect.issuer_id'));
        $privateKeyPath = trim((string) config('mobile.ios.app_store_connect.private_key_file'));
        if (preg_match('/^[A-Z0-9]{3,64}$/', $keyId) !== 1
            || preg_match('/^[A-Fa-f0-9-]{32,64}$/', $issuerId) !== 1
            || $privateKeyPath === ''
            || ! is_file($privateKeyPath)
            || ! is_readable($privateKeyPath)) {
            $this->fail(
                'app_store_connect',
                'Les identifiants serveur App Store Connect sont absents ou invalides.',
            );
        }
        $privateKey = openssl_pkey_get_private((string) file_get_contents($privateKeyPath));
        if (! $privateKey instanceof OpenSSLAsymmetricKey) {
            $this->fail('app_store_connect', 'La clé privée App Store Connect est invalide.');
        }
        $keyDetails = openssl_pkey_get_details($privateKey);
        $curveName = is_array($keyDetails) ? (string) data_get($keyDetails, 'ec.curve_name') : '';
        if (! is_array($keyDetails)
            || (int) ($keyDetails['type'] ?? -1) !== OPENSSL_KEYTYPE_EC
            || ! in_array($curveName, ['prime256v1', 'secp256r1'], true)) {
            $this->fail(
                'app_store_connect',
                'La clé privée App Store Connect doit être une clé elliptique P-256 compatible ES256.',
            );
        }

        $now = time();
        $header = $this->base64Url($this->encodeJson(['alg' => 'ES256', 'kid' => $keyId, 'typ' => 'JWT']));
        $claims = $this->base64Url($this->encodeJson([
            'iss' => $issuerId,
            'iat' => $now - 5,
            'exp' => $now + 600,
            'aud' => 'appstoreconnect-v1',
        ]));
        $signingInput = $header.'.'.$claims;
        $derSignature = '';
        if (! openssl_sign($signingInput, $derSignature, $privateKey, OPENSSL_ALGO_SHA256)) {
            $this->fail('app_store_connect', 'La signature du jeton App Store Connect a échoué.');
        }

        return $signingInput.'.'.$this->base64Url($this->derToJose($derSignature));
    }

    private function derToJose(string $der): string
    {
        $offset = 0;
        if ($this->readByte($der, $offset) !== 0x30) {
            $this->fail('app_store_connect', 'La signature ES256 générée est invalide.');
        }
        $sequenceLength = $this->readDerLength($der, $offset);
        if ($sequenceLength !== strlen($der) - $offset || $this->readByte($der, $offset) !== 0x02) {
            $this->fail('app_store_connect', 'La signature ES256 générée est invalide.');
        }
        $rLength = $this->readDerLength($der, $offset);
        $r = substr($der, $offset, $rLength);
        $offset += $rLength;
        if ($this->readByte($der, $offset) !== 0x02) {
            $this->fail('app_store_connect', 'La signature ES256 générée est invalide.');
        }
        $sLength = $this->readDerLength($der, $offset);
        $s = substr($der, $offset, $sLength);
        $offset += $sLength;
        if ($offset !== strlen($der)) {
            $this->fail('app_store_connect', 'La signature ES256 générée est invalide.');
        }

        return $this->fixedInteger($r).$this->fixedInteger($s);
    }

    private function fixedInteger(string $value): string
    {
        $value = ltrim($value, "\0");
        if ($value === '' || strlen($value) > 32) {
            $this->fail('app_store_connect', 'La signature ES256 générée est invalide.');
        }

        return str_pad($value, 32, "\0", STR_PAD_LEFT);
    }

    private function readDerLength(string $der, int &$offset): int
    {
        $length = $this->readByte($der, $offset);
        if (($length & 0x80) === 0) {
            return $length;
        }
        $octets = $length & 0x7F;
        if ($octets < 1 || $octets > 2 || $offset + $octets > strlen($der)) {
            $this->fail('app_store_connect', 'La signature ES256 générée est invalide.');
        }
        $length = 0;
        for ($index = 0; $index < $octets; $index++) {
            $length = ($length << 8) | $this->readByte($der, $offset);
        }

        return $length;
    }

    private function readByte(string $value, int &$offset): int
    {
        if ($offset >= strlen($value)) {
            $this->fail('app_store_connect', 'La signature ES256 générée est invalide.');
        }

        return ord($value[$offset++]);
    }

    private function base64Url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    /** @param array<string, mixed> $value */
    private function encodeJson(array $value): string
    {
        try {
            return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        } catch (JsonException) {
            $this->fail('app_store_connect', 'Le jeton App Store Connect ne peut pas être généré.');
        }
    }

    private function pathId(string $id): string
    {
        if (preg_match('/^[A-Za-z0-9-]{1,190}$/', $id) !== 1) {
            $this->fail('app_store_connect', 'Un identifiant App Store Connect est invalide.');
        }

        return rawurlencode($id);
    }

    private function nullableUpper(mixed $value): ?string
    {
        $value = strtoupper(trim(is_scalar($value) ? (string) $value : ''));

        return $value !== '' ? $value : null;
    }

    private function fail(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
