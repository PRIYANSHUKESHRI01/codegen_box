<?php

namespace App\Services;

use App\Models\GeminiApiKey;
use App\Services\Speech\SpeechRateLimitedException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * Production-grade Gemini API Key Load Balancer & Multi-Key Pool.
 *
 * Implements:
 * 1. Dynamic Pool Scaling: Supports 1 to 20+ keys without hardcoded limits.
 * 2. Round-Robin Load Splitting: Evenly distributes requests across all healthy active keys.
 *    6 keys @ 15 RPM = 90 RPM aggregate capacity; 20 keys = 300 RPM aggregate capacity.
 * 3. Intelligent Error Handling & Tiered Cooldowns:
 *    - RPM / Minute rate limits: 60-second cooldown with automatic recovery.
 *    - RPD / Daily quota limits: Paused until midnight UTC/PST.
 *    - Transparent in-flight failover: If Key i hits a 429, Key i+1 takes the request immediately.
 * 4. Bidirectional .env Synchronization: SuperAdmin additions directly sync to backend/.env.
 */
class GeminiKeyRotationService
{
    /** RPM burst cooldown duration in seconds */
    public const RPM_COOLDOWN_SECONDS = 60;

    /** Estimated free-tier capacity per key */
    public const DEFAULT_RPM_PER_KEY = 15;
    public const DEFAULT_RPD_PER_KEY = 1500;

    /** Ensures .env / config('services.gemini.api_keys') keys are synced to DB once per request without extra DB writes. */
    protected bool $configKeysSynced = false;

    public const DEFAULT_MODEL = 'gemini-3.6-flash';

    /** @var list<string> */
    public const DEFAULT_FALLBACK_MODELS = [
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3-flash-preview',
        'gemini-3.1-flash-lite',
        'gemini-3.8-flash',
        'gemini-3.1-pro-preview',
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.5-flash-lite',
    ];

    /**
     * Returns whether a Gemini model identifier meets AptRun's policy:
     * Gemini >= 2.5 and <= 3.x (rejects deprecated gemini-1.5-* and gemini-2.0-*).
     */
    public static function isAllowedModel(string $model): bool
    {
        if (preg_match('/^gemini-(\d+)(?:\.(\d+))?/i', trim($model), $m) !== 1) {
            return false;
        }

        $major = (int) $m[1];
        $minor = isset($m[2]) ? (int) $m[2] : 0;

        if ($major < 2 || $major > 3) {
            return false;
        }

        return $major > 2 || $minor >= 5;
    }

    /**
     * Resolves the ordered Gemini model cascade (Gemini 3 -> Gemini 2.5),
     * filtering out any deprecated <2.5 models (such as gemini-1.5-* and gemini-2.0-*) and >3.x models.
     *
     * @return list<string>
     */
    public static function modelChain(?string $primaryOverride = null): array
    {
        $primary = trim((string) ($primaryOverride ?: config('services.gemini.model', self::DEFAULT_MODEL)));
        $configured = config('services.gemini.fallback_models');
        $fallbacks = is_array($configured) && $configured !== [] ? $configured : self::DEFAULT_FALLBACK_MODELS;

        $candidates = array_values(array_unique(array_filter(array_map('trim', [$primary, ...$fallbacks, ...self::DEFAULT_FALLBACK_MODELS]))));

        $allowed = array_values(array_filter($candidates, static fn (string $model): bool => self::isAllowedModel($model)));

        return $allowed !== [] ? $allowed : self::DEFAULT_FALLBACK_MODELS;
    }

    public function getTimezone(): string
    {
        return (string) config('activity.timezone', 'Asia/Kolkata');
    }

    protected function isInvalidApiKeyResponse(Response $response): bool
    {
        if ($response->status() !== 400) {
            return false;
        }

        $msg = strtolower((string) ($this->extractErrorMessage($response) ?? $response->body()));

        return str_contains($msg, 'api key not valid')
            || str_contains($msg, 'api_key_invalid')
            || str_contains($msg, 'api key expired');
    }

    /**
     * Automatically ensures any keys added in AWS/.env (`GEMINI_API_KEY_2..N`, `GEMINI_API_KEYS`)
     * exist in the active DB pool even if `.env` was edited after initial migrations ran.
     */
    protected function ensureConfigKeysSynced(): void
    {
        if ($this->configKeysSynced) {
            return;
        }
        $this->configKeysSynced = true;

        $configuredKeys = [];
        $fromConfig = config('services.gemini.api_keys', []);
        if (is_array($fromConfig)) {
            foreach ($fromConfig as $slot => $v) {
                $trimmed = trim((string) $v);
                if ($trimmed !== '' && ! in_array($trimmed, $configuredKeys, true)) {
                    if (is_int($slot) && $slot >= 1) {
                        $configuredKeys[$slot] = $trimmed;
                    } else {
                        $configuredKeys[] = $trimmed;
                    }
                }
            }
        }
        for ($i = 1; $i <= 50; $i++) {
            $v = trim((string) env("GEMINI_API_KEY_{$i}", ''));
            if ($v !== '' && ! in_array($v, $configuredKeys, true)) {
                $configuredKeys[$i] = $v;
            }
        }
        $rawCombined = trim((string) env('GEMINI_API_KEYS', ''));
        if ($rawCombined !== '') {
            foreach (array_filter(array_map('trim', explode(',', $rawCombined))) as $v) {
                if ($v !== '' && ! in_array($v, $configuredKeys, true)) {
                    $configuredKeys[] = $v;
                }
            }
        }

        if ($configuredKeys === []) {
            return;
        }

        $existingTokens = GeminiApiKey::whereNotNull('api_key')
            ->pluck('api_key')
            ->map(fn ($k) => trim((string) $k))
            ->filter()
            ->all();

        foreach ($configuredKeys as $slot => $token) {
            if (in_array($token, $existingTokens, true)) {
                continue;
            }
            // Prefer filling an existing empty/inactive slot with the same order_index before inserting a new row
            $emptySlot = GeminiApiKey::where('order_index', $slot)
                ->where(function ($q) {
                    $q->whereNull('api_key')->orWhere('api_key', '');
                })
                ->first();

            if ($emptySlot) {
                $emptySlot->update([
                    'api_key' => $token,
                    'is_active' => true,
                    'is_exhausted' => false,
                    'exhausted_until' => null,
                ]);
            } else {
                GeminiApiKey::create([
                    'label' => "Gemini Key {$slot}",
                    'api_key' => $token,
                    'order_index' => $slot,
                    'duration_hours' => 4.00,
                    'is_active' => true,
                ]);
            }
            $existingTokens[] = $token;
        }
    }

    /**
     * Resolves all active keys configured with a non-empty API token,
     * automatically recovering any keys whose cooldown window has expired.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, GeminiApiKey>
     */
    public function getAvailablePoolKeys()
    {
        $this->ensureConfigKeysSynced();

        $keys = GeminiApiKey::where('is_active', true)
            ->whereNotNull('api_key')
            ->where('api_key', '!=', '')
            ->orderBy('order_index')
            ->orderBy('id')
            ->get();

        $healthy = [];

        foreach ($keys as $key) {
            // Auto-recovery check: if exhausted_until timestamp has passed, recover automatically
            if ($key->is_exhausted) {
                if ($key->exhausted_until !== null && $key->exhausted_until->isPast()) {
                    $key->update([
                        'is_exhausted' => false,
                        'exhausted_until' => null,
                        'last_error_message' => null,
                    ]);
                    $healthy[] = $key;
                }
            } else {
                $healthy[] = $key;
            }
        }

        return collect($healthy);
    }

    /**
     * Returns whether any active or fallback Gemini API key is configured (without advancing round-robin).
     */
    public function hasAvailableKeys(): bool
    {
        if ($this->getAvailablePoolKeys()->isNotEmpty()) {
            return true;
        }

        if (GeminiApiKey::where('is_active', true)->whereNotNull('api_key')->where('api_key', '!=', '')->exists()) {
            return true;
        }

        return (string) (config('services.gemini.api_key') ?: env('GEMINI_API_KEY', '')) !== '';
    }

    /**
     * Non-mutating peek at the next healthy key (for dashboards/metrics without skewing round-robin).
     */
    public function peekActiveKey(): ?GeminiApiKey
    {
        return $this->getActiveKey(advance: false);
    }

    /**
     * Returns the next healthy GeminiApiKey model using atomic round-robin distribution.
     * Also balances via request counts if Cache increments don't persist across workers.
     */
    public function getActiveKey(bool $advance = true): ?GeminiApiKey
    {
        $availableKeys = $this->getAvailablePoolKeys();

        if ($availableKeys->isNotEmpty()) {
            $count = $availableKeys->count();
            if ($count === 1) {
                return $availableKeys->first();
            }

            $values = $availableKeys->values();
            $leastUsedPos = 0;
            $minReqs = PHP_INT_MAX;
            foreach ($values as $pos => $k) {
                $reqs = (int) $k->total_requests;
                if ($reqs < $minReqs) {
                    $minReqs = $reqs;
                    $leastUsedPos = $pos;
                }
            }

            if ($advance) {
                // DatabaseStore::increment() returns false if the key row doesn't exist yet;
                // seed it with the least-used key position so atomic increments persist and start balanced.
                Cache::add('gemini_key_pool_rr_index', $leastUsedPos, now()->addDays(30));
                $rrIndex = Cache::increment('gemini_key_pool_rr_index');

                if (is_int($rrIndex) && $rrIndex >= 1) {
                    return $values->get(($rrIndex - 1) % $count);
                }

                return $values->get($leastUsedPos);
            }

            $rrCurrent = (int) Cache::get('gemini_key_pool_rr_index', 0);
            if ($rrCurrent <= 0) {
                return $values->get($leastUsedPos);
            }

            return $values->get($rrCurrent % $count);
        }

        // Fallback: If all active keys with tokens are in cooldown, pick the one recovering soonest
        $allActiveWithTokens = GeminiApiKey::where('is_active', true)
            ->whereNotNull('api_key')
            ->where('api_key', '!=', '')
            ->orderBy('order_index')
            ->orderBy('id')
            ->get();

        if ($allActiveWithTokens->isNotEmpty()) {
            return $allActiveWithTokens->sortBy('exhausted_until')->first();
        }

        return null;
    }

    /**
     * Returns the raw API key string to use right now.
     * Pulls the next round-robin key from the pool, falling back to .env if unconfigured.
     */
    public function getActiveApiKeyString(): ?string
    {
        $activeKey = $this->getActiveKey();
        if ($activeKey && $activeKey->hasKey()) {
            return trim((string) $activeKey->api_key);
        }

        $envFallback = (string) (config('services.gemini.api_key') ?: env('GEMINI_API_KEY', ''));
        return $envFallback !== '' ? $envFallback : null;
    }

    /**
     * Executes a Gemini API call callback with automatic round-robin routing and in-flight failover.
     * If a key encounters 429 (RPM or RPD), it marks that key into cooldown and seamlessly
     * retries the exact same call with the next candidate in the pool.
     *
     * @param  callable(string $apiKey): mixed  $execute
     * @return mixed
     *
     * @throws RuntimeException
     */
    public function runWithFallback(callable $execute): mixed
    {
        $candidates = $this->buildCandidateQueue();

        if (empty($candidates)) {
            throw new RuntimeException('No Gemini API key is configured. Please add an API key in SuperAdmin or .env.');
        }

        $lastError = null;

        foreach ($candidates as $candidate) {
            $apiKeyString = $candidate['key_string'];
            $dbModel = $candidate['model']; // ?GeminiApiKey

            try {
                $result = $execute($apiKeyString);

                // Check for rate limit / quota exceeded in Response or Http::pool responses
                if ($this->hasRateLimit($result)) {
                    $errorMsg = $this->extractErrorMessage($result) ?? 'Rate limit (429) / Quota exceeded';
                    $this->handleRateLimitExceeded($dbModel, $errorMsg);
                    Log::warning("[GeminiPool] Key '{$candidate['label']}' rate-limited. Failing over to next key in pool...", ['error' => $errorMsg]);
                    $lastError = new RuntimeException($errorMsg);
                    continue; // Seamlessly try next key in pool
                }

                // If response is an invalid/unauthorized API key error (403, or 400 API_KEY_INVALID / expired)
                if ($result instanceof Response && ($result->status() === 403 || $this->isInvalidApiKeyResponse($result))) {
                    $errorMsg = $this->extractErrorMessage($result) ?? 'Invalid or unauthorized API key (' . $result->status() . ')';
                    if ($dbModel) {
                        $dbModel->update([
                            'is_exhausted' => true,
                            'exhausted_until' => now()->addHours(24),
                            'last_error_at' => now(),
                            'last_error_message' => substr($errorMsg, 0, 500),
                            'failed_requests' => $dbModel->failed_requests + 1,
                            'total_requests' => $dbModel->total_requests + 1,
                        ]);
                    }
                    Log::warning("[GeminiPool] Key '{$candidate['label']}' rejected ({$result->status()}). Failing over...", ['error' => $errorMsg]);
                    $lastError = new RuntimeException($errorMsg);
                    continue;
                }

                if ($result instanceof Response && $result->failed()) {
                    $this->recordFailure($dbModel, $this->extractErrorMessage($result) ?? ('HTTP ' . $result->status()));
                    return $result;
                }

                // Success! Record usage metric and clear exhausted state if present
                $this->recordSuccess($dbModel);
                return $result;
            } catch (Throwable $e) {
                $isRateLimit = $this->isRateLimitException($e);

                if ($isRateLimit) {
                    $errorMsg = $e->getMessage();
                    $this->handleRateLimitExceeded($dbModel, $errorMsg);
                    Log::warning("[GeminiPool] Key '{$candidate['label']}' rate limit exception. Failing over...", ['error' => $errorMsg]);
                    $lastError = $e;
                    continue; // Seamlessly try next key in pool
                }

                // If general network blip or connection error, record on key and rethrow
                if ($dbModel) {
                    $dbModel->increment('failed_requests');
                    $dbModel->increment('total_requests');
                    $dbModel->update([
                        'last_error_at' => now(),
                        'last_error_message' => substr($e->getMessage(), 0, 500),
                    ]);
                }

                throw $e;
            }
        }

        throw new RuntimeException(
            'All Gemini API keys in the pool have exceeded their quota or failed. ' .
            ($lastError ? 'Last error: ' . $lastError->getMessage() : 'Please check your API keys in SuperAdmin.')
        );
    }

    /**
     * Builds candidate queue in priority order starting from the chosen round-robin key,
     * followed by remaining healthy keys, followed by keys recovering from cooldown,
     * followed by .env default fallback.
     *
     * @return array<int, array{label: string, key_string: string, model: ?GeminiApiKey}>
     */
    protected function buildCandidateQueue(): array
    {
        $queue = [];
        $activeKeys = GeminiApiKey::where('is_active', true)
            ->whereNotNull('api_key')
            ->where('api_key', '!=', '')
            ->orderBy('order_index')
            ->orderBy('id')
            ->get();

        $selectedKey = $this->getActiveKey();
        $startId = $selectedKey?->id;

        if ($activeKeys->isNotEmpty()) {
            $startIndex = 0;
            if ($startId !== null) {
                foreach ($activeKeys as $idx => $k) {
                    if ($k->id === $startId) {
                        $startIndex = $idx;
                        break;
                    }
                }
            }

            $count = $activeKeys->count();

            // 1. Add all healthy available keys starting from startIndex
            for ($i = 0; $i < $count; $i++) {
                $idx = ($startIndex + $i) % $count;
                $candidate = $activeKeys[$idx];
                if ($candidate->isAvailable()) {
                    $queue[] = [
                        'label' => $candidate->label,
                        'key_string' => trim((string) $candidate->api_key),
                        'model' => $candidate,
                    ];
                }
            }

            // 2. Add any keys currently in cooldown as a secondary effort before env fallback
            for ($i = 0; $i < $count; $i++) {
                $idx = ($startIndex + $i) % $count;
                $candidate = $activeKeys[$idx];
                if (! $candidate->isAvailable()) {
                    $queue[] = [
                        'label' => $candidate->label . ' (Cooldown Standby)',
                        'key_string' => trim((string) $candidate->api_key),
                        'model' => $candidate,
                    ];
                }
            }
        }

        // 3. Add .env default key if distinct and not already in queue
        $envKey = (string) (config('services.gemini.api_key') ?: env('GEMINI_API_KEY', ''));
        if ($envKey !== '') {
            $alreadyInQueue = false;
            foreach ($queue as $item) {
                if ($item['key_string'] === $envKey) {
                    $alreadyInQueue = true;
                    break;
                }
            }
            if (! $alreadyInQueue) {
                $queue[] = [
                    'label' => '.env Default Key',
                    'key_string' => $envKey,
                    'model' => null,
                ];
            }
        }

        return $queue;
    }

    /**
     * Differentiates between RPM (per-minute burst) and RPD (daily quota).
     * Applies a 60-second cooldown for RPM, or a daily reset for RPD.
     */
    protected function handleRateLimitExceeded(?GeminiApiKey $key, string $reason): void
    {
        if (! $key) {
            return;
        }

        $lower = strtolower($reason);
        $isDaily = str_contains($lower, 'per day') ||
                   str_contains($lower, 'daily') ||
                   str_contains($lower, 'requests per day');

        if ($isDaily) {
            // Daily quota exhausted: Pause until midnight Pacific (00:00 PST / 13:30 IST)
            $exhaustedUntil = now()->endOfDay();
            $msgPrefix = 'Daily quota exhausted (paused until daily reset): ';
        } else {
            // Per-minute (RPM) rate limit reached: Pause for 60 seconds
            $exhaustedUntil = now()->addSeconds(self::RPM_COOLDOWN_SECONDS);
            $msgPrefix = 'Per-minute limit (60s cooldown): ';
        }

        $key->update([
            'is_exhausted' => true,
            'exhausted_until' => $exhaustedUntil,
            'last_error_at' => now(),
            'last_error_message' => substr($msgPrefix . $reason, 0, 500),
            'failed_requests' => $key->failed_requests + 1,
            'total_requests' => $key->total_requests + 1,
        ]);
    }

    protected function hasRateLimit(mixed $result): bool
    {
        if ($result instanceof Response) {
            if ($result->status() === 429) {
                return true;
            }
            $status = (string) $result->json('error.status');
            $code = $result->json('error.code');
            if ($code === 429 || $status === 'RESOURCE_EXHAUSTED') {
                return true;
            }
            $body = $result->body();
            if (str_contains($body, 'RESOURCE_EXHAUSTED') || str_contains($body, 'Quota exceeded')) {
                return true;
            }
        } elseif (is_array($result)) {
            foreach ($result as $sub) {
                if ($this->hasRateLimit($sub)) {
                    return true;
                }
            }
        }

        return false;
    }

    protected function isRateLimitException(Throwable $e): bool
    {
        if ($e instanceof SpeechRateLimitedException || $e->getCode() === 429) {
            return true;
        }

        $msg = strtolower($e->getMessage());
        if (
            str_contains($msg, '429') ||
            str_contains($msg, 'resource_exhausted') ||
            str_contains($msg, 'quota exceeded') ||
            str_contains($msg, 'too many requests') ||
            str_contains($msg, 'rate limit')
        ) {
            return true;
        }

        if ($e instanceof RequestException && $e->response?->status() === 429) {
            return true;
        }

        return false;
    }

    protected function extractErrorMessage(mixed $result): ?string
    {
        if ($result instanceof Response) {
            $msg = $result->json('error.message');
            if ($msg) {
                return (string) $msg;
            }
            return 'HTTP ' . $result->status() . ': ' . substr($result->body(), 0, 200);
        }
        return null;
    }

    protected function recordFailure(?GeminiApiKey $key, string $reason): void
    {
        if (! $key) {
            return;
        }

        $key->update([
            'total_requests' => $key->total_requests + 1,
            'failed_requests' => $key->failed_requests + 1,
            'last_used_at' => now(),
            'last_error_at' => now(),
            'last_error_message' => substr($reason, 0, 500),
        ]);
    }

    protected function recordSuccess(?GeminiApiKey $key): void
    {
        if (! $key) {
            return;
        }

        $updates = [
            'total_requests' => $key->total_requests + 1,
            'successful_requests' => $key->successful_requests + 1,
            'last_used_at' => now(),
        ];

        if ($key->is_exhausted) {
            $updates['is_exhausted'] = false;
            $updates['exhausted_until'] = null;
        }

        $key->update($updates);
    }

    /**
     * Tests an API key with a fast ping request.
     */
    public function testKey(string $apiKey): array
    {
        $apiKey = trim($apiKey);
        if ($apiKey === '') {
            return [
                'valid' => false,
                'status' => 400,
                'message' => 'API key is blank.',
            ];
        }

        $models = self::modelChain();

        $startTime = microtime(true);
        $lastResponse = null;

        foreach ($models as $model) {
            try {
                $response = Http::withHeaders(['x-goog-api-key' => $apiKey])
                    ->timeout(10)
                    ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent", [
                        'contents' => [
                            ['parts' => [['text' => 'ping']]],
                        ],
                        'generationConfig' => [
                            'maxOutputTokens' => 5,
                        ],
                    ]);

                $latencyMs = (int) round((microtime(true) - $startTime) * 1000);

                if ($response->successful()) {
                    return [
                        'valid' => true,
                        'status' => 200,
                        'latency_ms' => $latencyMs,
                        'message' => "Key is active and responding via {$model} (Latency: {$latencyMs}ms).",
                    ];
                }

                $lastResponse = $response;

                // If 404 model not found, try next model in hierarchy
                if ($response->status() === 404) {
                    continue;
                }

                $errMsg = $response->json('error.message') ?? $response->body();
                return [
                    'valid' => false,
                    'status' => $response->status(),
                    'latency_ms' => $latencyMs,
                    'message' => "HTTP {$response->status()}: " . substr($errMsg, 0, 300),
                ];
            } catch (Throwable $e) {
                // If network exception on one model, try next before failing
                continue;
            }
        }

        $latencyMs = (int) round((microtime(true) - $startTime) * 1000);
        $status = $lastResponse ? $lastResponse->status() : 500;
        $errMsg = $lastResponse ? ($lastResponse->json('error.message') ?? $lastResponse->body()) : 'Connection failed across all fallback models';

        return [
            'valid' => false,
            'status' => $status,
            'latency_ms' => $latencyMs,
            'message' => "HTTP {$status}: " . substr($errMsg, 0, 300),
        ];
    }

    /**
     * Synchronizes all database keys directly into the backend/.env file.
     * Updates GEMINI_API_KEY_1, GEMINI_API_KEY_2, ... and GEMINI_API_KEYS comma list.
     */
    public function syncToEnv(): int
    {
        $envPath = base_path('.env');
        if (! file_exists($envPath) || ! is_writable($envPath)) {
            Log::info("GeminiKeyRotationService: .env is missing or not writable at {$envPath}; skipping .env sync (keys remain active in DB pool).");
            return 0;
        }

        $envContent = file_get_contents($envPath);
        if ($envContent === false) {
            return 0;
        }

        $keys = GeminiApiKey::orderBy('order_index')->orderBy('id')->get();
        $keyStrings = [];

        foreach ($keys as $idx => $key) {
            $slotNum = $idx + 1;
            $token = trim((string) $key->api_key);
            $keyPattern = "/^GEMINI_API_KEY_{$slotNum}=.*$/m";

            if ($token !== '') {
                $keyStrings[] = $token;
            }

            if (preg_match($keyPattern, $envContent)) {
                $envContent = preg_replace($keyPattern, "GEMINI_API_KEY_{$slotNum}={$token}", $envContent);
            } else {
                // If not found, append after the last GEMINI_API_KEY_ line or at end of file
                if (preg_match("/^(GEMINI_API_KEY_\\d+=.*)$/m", $envContent, $matches)) {
                    $envContent = preg_replace("/(GEMINI_API_KEY_\\d+=.*)(\\r?\\n)(?!GEMINI_API_KEY_)/m", "$1$2GEMINI_API_KEY_{$slotNum}={$token}$2", $envContent, 1);
                } else {
                    $envContent .= "\nGEMINI_API_KEY_{$slotNum}={$token}";
                }
            }
        }

        // Also update combined comma-separated GEMINI_API_KEYS
        $combinedStr = implode(',', $keyStrings);
        if (preg_match('/^GEMINI_API_KEYS=.*$/m', $envContent)) {
            $envContent = preg_replace('/^GEMINI_API_KEYS=.*$/m', "GEMINI_API_KEYS={$combinedStr}", $envContent);
        } else {
            $envContent = preg_replace('/(GEMINI_MODEL=.*)/', "$1\nGEMINI_API_KEYS={$combinedStr}", $envContent);
        }

        try {
            file_put_contents($envPath, $envContent);
        } catch (Throwable $e) {
            Log::warning("GeminiKeyRotationService: Could not write to .env ({$e->getMessage()}); keys remain active in DB pool.");
            return 0;
        }

        return $keys->count();
    }

    /**
     * Imports keys from .env into the database rotation pool.
     */
    public function syncFromEnv(): int
    {
        $envKeys = [];
        $envPath = base_path('.env');

        // 1. Parse directly from .env file if readable (guarantees reading fresh values even when config is cached)
        if (file_exists($envPath) && is_readable($envPath)) {
            $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || str_starts_with($line, '#')) {
                    continue;
                }
                if (preg_match('/^GEMINI_API_KEY_(\d+)=(.*)$/', $line, $matches)) {
                    $slot = (int) $matches[1];
                    $val = trim($matches[2], " \t\n\r\0\x0B\"'");
                    if ($val !== '') {
                        $envKeys[$slot] = $val;
                    }
                } elseif (preg_match('/^GEMINI_API_KEYS=(.*)$/', $line, $matches)) {
                    $raw = trim($matches[1], " \t\n\r\0\x0B\"'");
                    $split = array_values(array_filter(array_map('trim', explode(',', $raw))));
                    foreach ($split as $i => $val) {
                        $envKeys[$i + 1] = $val;
                    }
                } elseif (preg_match('/^GEMINI_API_KEY=(.*)$/', $line, $matches)) {
                    $val = trim($matches[1], " \t\n\r\0\x0B\"'");
                    if ($val !== '' && ! isset($envKeys[1])) {
                        $envKeys[1] = $val;
                    }
                }
            }
        }

        // 2. Fallback to runtime env() variables if .env was missing or in container environments
        if (empty($envKeys)) {
            $rawCombined = (string) env('GEMINI_API_KEYS', '');
            if ($rawCombined !== '') {
                $split = array_values(array_filter(array_map('trim', explode(',', $rawCombined))));
                foreach ($split as $i => $val) {
                    $envKeys[$i + 1] = $val;
                }
            }

            for ($i = 1; $i <= 50; $i++) {
                $val = trim((string) env("GEMINI_API_KEY_{$i}", ''));
                if ($val !== '') {
                    $envKeys[$i] = $val;
                }
            }

            $single = trim((string) env('GEMINI_API_KEY', ''));
            if ($single !== '' && ! isset($envKeys[1])) {
                $envKeys[1] = $single;
            }
        }

        $updated = 0;
        foreach ($envKeys as $slotOrder => $keyVal) {
            if ($keyVal !== '') {
                $record = GeminiApiKey::where('order_index', $slotOrder)->first();
                if ($record) {
                    $record->update(['api_key' => $keyVal, 'is_active' => true]);
                    $updated++;
                } else {
                    GeminiApiKey::create([
                        'label' => "Gemini Key {$slotOrder}",
                        'api_key' => $keyVal,
                        'order_index' => $slotOrder,
                        'duration_hours' => 4.00,
                        'is_active' => true,
                    ]);
                    $updated++;
                }
            }
        }

        return $updated;
    }

    /**
     * Returns full load balancer pool metrics and key status for SuperAdmin dashboard.
     */
    public function getScheduleDetails(): array
    {
        $timezone = $this->getTimezone();
        $now = Carbon::now($timezone);

        $keys = GeminiApiKey::orderBy('order_index')->orderBy('id')->get();
        $totalPoolRequests = (int) $keys->sum('total_requests');

        $activeCount = 0;
        $healthyCount = 0;
        $rpmCooldownCount = 0;
        $dailyExhaustedCount = 0;
        $inactiveCount = 0;
        $unconfiguredCount = 0;

        $enrichedKeys = [];

        foreach ($keys as $key) {
            $hasKey = $key->hasKey();
            $isActive = (bool) $key->is_active;
            $isExhausted = (bool) $key->is_exhausted;

            // Check auto-recovery
            if ($isExhausted && $key->exhausted_until !== null && $key->exhausted_until->isPast()) {
                $key->update([
                    'is_exhausted' => false,
                    'exhausted_until' => null,
                    'last_error_message' => null,
                ]);
                $isExhausted = false;
            }

            $cooldownSecsRemaining = 0;
            $cooldownType = 'none';

            if ($isExhausted && $key->exhausted_until !== null) {
                $diff = $now->diffInSeconds($key->exhausted_until, false);
                $cooldownSecsRemaining = max(0, $diff);

                if (str_contains(strtolower((string) $key->last_error_message), 'daily')) {
                    $cooldownType = 'daily_exhausted';
                } else {
                    $cooldownType = 'rpm_cooldown';
                }
            }

            $isAvailable = $isActive && $hasKey && ! $isExhausted;

            // Categorize status
            if (! $hasKey) {
                $statusBadge = 'unconfigured';
                $unconfiguredCount++;
            } elseif (! $isActive) {
                $statusBadge = 'inactive';
                $inactiveCount++;
            } elseif ($isExhausted) {
                if ($cooldownType === 'daily_exhausted') {
                    $statusBadge = 'daily_exhausted';
                    $dailyExhaustedCount++;
                } else {
                    $statusBadge = 'rpm_cooldown';
                    $rpmCooldownCount++;
                }
            } else {
                $statusBadge = 'healthy';
                $healthyCount++;
            }

            if ($isActive && $hasKey) {
                $activeCount++;
            }

            $keyTotalReqs = (int) $key->total_requests;
            $keySuccessReqs = (int) $key->successful_requests;

            $trafficSharePercent = $totalPoolRequests > 0
                ? round(($keyTotalReqs / $totalPoolRequests) * 100, 1)
                : 0.0;

            $successRatePercent = $keyTotalReqs > 0
                ? round(($keySuccessReqs / $keyTotalReqs) * 100, 1)
                : 100.0;

            $cleanLabel = trim(preg_replace('/\s*\(\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\)/', '', (string) $key->label)) ?: "Gemini Key {$key->order_index}";

            $enrichedKeys[] = [
                'id' => $key->id,
                'label' => $cleanLabel,
                'api_key_masked' => $key->masked_key,
                'has_key' => $hasKey,
                'order_index' => $key->order_index,
                'duration_hours' => (float) $key->duration_hours,
                'is_active' => $isActive,
                'is_exhausted' => $isExhausted,
                'exhausted_until' => $key->exhausted_until?->toIso8601String(),
                'is_available' => $isAvailable,
                'cooldown_type' => $cooldownType,
                'cooldown_seconds_remaining' => $cooldownSecsRemaining,
                'status_badge' => $statusBadge,
                'last_used_at' => $key->last_used_at?->toIso8601String(),
                'last_error_at' => $key->last_error_at?->toIso8601String(),
                'last_error_message' => $key->last_error_message,
                'total_requests' => $keyTotalReqs,
                'successful_requests' => $keySuccessReqs,
                'failed_requests' => (int) $key->failed_requests,
                'traffic_share_percent' => $trafficSharePercent,
                'success_rate_percent' => $successRatePercent,
                // Backwards-compatibility fields for UI
                'slot_start_time' => sprintf('%02d:00', (($key->order_index - 1) * 4) % 24),
                'slot_end_time' => sprintf('%02d:00', ($key->order_index * 4) % 24),
                'is_scheduled_now' => $isAvailable,
                'is_effective_now' => $isAvailable,
            ];
        }

        $totalSuccessReqs = (int) $keys->sum('successful_requests');
        $totalFailedReqs = (int) $keys->sum('failed_requests');
        $overallReliabilityRate = $totalPoolRequests > 0
            ? round(($totalSuccessReqs / $totalPoolRequests) * 100, 1)
            : 100.0;

        $aggregateRpm = $activeCount * self::DEFAULT_RPM_PER_KEY;
        $aggregateRpd = $activeCount * self::DEFAULT_RPD_PER_KEY;

        $fallbackEnv = (string) (config('services.gemini.api_key') ?: env('GEMINI_API_KEY', ''));

        return [
            'keys' => $enrichedKeys,
            'summary' => [
                'routing_strategy' => 'round_robin_pool',
                'timezone' => $timezone,
                'current_time_local' => $now->format('H:i:s'),
                'current_date_local' => $now->format('Y-m-d'),
                'total_keys' => count($keys),
                'active_keys' => $activeCount,
                'healthy_keys' => $healthyCount,
                'rpm_cooldown_keys' => $rpmCooldownCount,
                'daily_exhausted_keys' => $dailyExhaustedCount,
                'inactive_keys' => $inactiveCount,
                'unconfigured_keys' => $unconfiguredCount,
                'aggregate_rpm_capacity' => $aggregateRpm,
                'aggregate_rpd_capacity' => $aggregateRpd,
                'total_requests' => $totalPoolRequests,
                'successful_requests' => $totalSuccessReqs,
                'failed_requests' => $totalFailedReqs,
                'reliability_rate_percent' => $overallReliabilityRate,
                'effective_key_label' => $healthyCount > 0
                    ? "Round-Robin Pool ({$healthyCount}/{$activeCount} Active Ready)"
                    : ($fallbackEnv !== '' ? 'Default (.env Fallback)' : 'No Available Keys'),
                'fallback_env_available' => $fallbackEnv !== '',
            ],
        ];
    }
}
