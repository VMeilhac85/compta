<?php

namespace App\Http\Controllers;

use App\Support\Mobile\MobilePlatform;
use App\Support\Mobile\MobileReleaseService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class IosWebAppController extends Controller
{
    public function __invoke(Request $request, MobileReleaseService $releases): Response|RedirectResponse
    {
        // Le document et ses modules JavaScript doivent partager le domaine canonique.
        // Les anciennes coques iOS démarrent encore sur le domaine historique.
        if ($request->getHost() === 'maisonpilote.meilhac.expert') {
            $query = $request->getQueryString();

            return redirect()->away('https://maisonpilote.fr/api/application-ios/test'.($query ? '?'.$query : ''), 302)
                ->withHeaders(['Cache-Control' => 'no-store']);
        }

        $configuration = $releases->configuration(1, false, MobilePlatform::IOS);
        $versions = $releases->publishedVersions(platform: MobilePlatform::IOS);

        return response()->view('mobile.ios-test', [
            'apiBaseUrl' => url('/api/mobile/v1'),
            'siteUrl' => url('/'),
            'releaseConfiguration' => $configuration,
            'releaseVersions' => $versions,
            'testFlightUrl' => $this->testFlightUrl(data_get($configuration, 'update_url')),
            'nativeShell' => $request->boolean('native'),
        ])->withHeaders([
            'Cache-Control' => 'public, max-age=300, stale-while-revalidate=60',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'Permissions-Policy' => 'camera=(self), microphone=(self), geolocation=(), payment=()',
            'Content-Security-Policy' => "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
        ]);
    }

    private function testFlightUrl(mixed $candidate): ?string
    {
        $url = trim(is_scalar($candidate) ? (string) $candidate : '');
        if ($url === '') {
            return null;
        }

        $parts = parse_url($url);
        if (($parts['scheme'] ?? null) !== 'https' || mb_strtolower((string) ($parts['host'] ?? '')) !== 'testflight.apple.com') {
            return null;
        }

        return $url;
    }
}
