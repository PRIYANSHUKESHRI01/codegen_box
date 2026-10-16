<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * The frontend is a static site on its own origin, so on a real server the API must allow exactly that
 * origin — and, for a payment page, nobody else. config/cors.php derives it from FRONTEND_URL (which every
 * deployment sets) plus an optional CORS_ALLOWED_ORIGINS list; the local dev origins are allowed everywhere
 * except production. An unset FRONTEND_URL in production fails closed (nobody allowed), not open.
 */
class CorsConfigTest extends TestCase
{
    /** The origins config/cors.php yields under the given environment. */
    private function originsFor(array $env): array
    {
        $keys = ['APP_ENV', 'FRONTEND_URL', 'CORS_ALLOWED_ORIGINS'];
        $saved = [];

        foreach ($keys as $key) {
            $saved[$key] = [$_ENV[$key] ?? null, $_SERVER[$key] ?? null];
            unset($_ENV[$key], $_SERVER[$key]);
        }

        foreach ($env as $key => $value) {
            $_ENV[$key] = $_SERVER[$key] = $value;
        }

        try {
            return (require config_path('cors.php'))['allowed_origins'];
        } finally {
            foreach ($saved as $key => [$fromEnv, $fromServer]) {
                unset($_ENV[$key], $_SERVER[$key]);
                if ($fromEnv !== null) {
                    $_ENV[$key] = $fromEnv;
                }
                if ($fromServer !== null) {
                    $_SERVER[$key] = $fromServer;
                }
            }
        }
    }

    public function test_production_allows_the_frontend_and_nothing_else(): void
    {
        $this->assertSame(
            ['https://app.example.com'],
            $this->originsFor(['APP_ENV' => 'production', 'FRONTEND_URL' => 'https://app.example.com/'])
        );
    }

    public function test_extra_origins_can_be_listed_and_are_tidied(): void
    {
        $this->assertSame(
            ['https://example.com', 'https://www.example.com', 'https://staging.example.com'],
            $this->originsFor([
                'APP_ENV' => 'production',
                'FRONTEND_URL' => 'https://example.com',
                'CORS_ALLOWED_ORIGINS' => ' https://www.example.com , https://staging.example.com/ ,, https://example.com',
            ])
        );
    }

    public function test_local_development_keeps_working_without_any_setup(): void
    {
        $this->assertSame(
            ['http://localhost:3000', 'http://127.0.0.1:3000'],
            $this->originsFor(['APP_ENV' => 'local', 'FRONTEND_URL' => 'http://localhost:3000'])
        );

        $this->assertSame(
            ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3100'],
            $this->originsFor(['APP_ENV' => 'local', 'FRONTEND_URL' => 'http://localhost:3000', 'CORS_ALLOWED_ORIGINS' => 'http://localhost:3100'])
        );
    }

    public function test_production_without_a_frontend_url_allows_nobody_rather_than_everybody(): void
    {
        $this->assertSame([], $this->originsFor(['APP_ENV' => 'production']));
    }

    public function test_a_browser_on_the_real_site_may_call_the_api_and_a_stranger_may_not(): void
    {
        $preflight = fn (string $origin) => $this->call('OPTIONS', '/api/me/checkout', [], [], [], [
            'HTTP_ORIGIN' => $origin,
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'authorization,content-type',
        ])->headers->get('Access-Control-Allow-Origin');

        // One allowed origin: the library answers with it for everybody, and a browser on any OTHER site then
        // refuses the response because it does not match its own origin. What must never happen is echoing the stranger.
        config(['cors.allowed_origins' => $this->originsFor(['APP_ENV' => 'production', 'FRONTEND_URL' => 'https://app.example.com'])]);
        $this->assertSame('https://app.example.com', $preflight('https://app.example.com'));
        $this->assertNotSame('https://evil.example.net', $preflight('https://evil.example.net'));
        $this->assertNotSame('http://localhost:3000', $preflight('http://localhost:3000'), 'dev origins are not allowed in production');

        // Several allowed origins: each is echoed back to itself, a stranger gets nothing at all.
        config(['cors.allowed_origins' => $this->originsFor(['APP_ENV' => 'production', 'FRONTEND_URL' => 'https://app.example.com', 'CORS_ALLOWED_ORIGINS' => 'https://www.example.com'])]);
        $this->assertSame('https://app.example.com', $preflight('https://app.example.com'));
        $this->assertSame('https://www.example.com', $preflight('https://www.example.com'));
        $this->assertNull($preflight('https://evil.example.net'));
    }
}
