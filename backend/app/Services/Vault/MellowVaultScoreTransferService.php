<?php

namespace App\Services\Vault;

use App\Models\Interview;
use App\Models\User;
use App\Models\VaultInterviewQualification;
use App\Models\VaultScoreTransfer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Throwable;

/**
 * Service responsible for transferring Vault AI Interview scores (>= 60%)
 * from AptRun to Mellow Vault on AWS.
 *
 * Supports:
 * 1. Automatic delivery over signed HTTP API to Mellow Vault's AWS endpoint.
 * 2. Direct MySQL database sync to Mellow Vault RDS when connection is active.
 * 3. Complete audit log with JSON payloads in `vault_score_transfers` table.
 * 4. API endpoints for senior developers to inspect, test, and retrieve DDL/schema.
 */
class MellowVaultScoreTransferService
{
    public function __construct(
        private readonly CuratedCatalog $catalog
    ) {}

    /**
     * Transfer overall qualification result when candidate passes the 3-set series with >= 60%.
     */
    public function transferQualification(
        VaultInterviewQualification $qualification,
        float $scorePercent,
        ?string $customMessage = null
    ): VaultScoreTransfer {
        $user = User::with('college')->find($qualification->user_id);
        $stackKey = $qualification->stack_key;
        $stackData = $this->catalog->stack($stackKey);
        $stackName = $stackData['stack']['name'] ?? Str::headline($stackKey);
        $roleTitle = $stackData['role']['title'] ?? Str::headline($qualification->role_key);

        $status = $scorePercent >= 60.0 ? VaultScoreTransfer::STATUS_QUALIFIED : 'attempted';
        $message = $customMessage ?: "Candidate scored {$scorePercent}% and successfully cleared / qualified for Mellow Vault in {$stackName} ({$roleTitle}).";

        $payload = [
            'event' => 'vault_ai_interview.qualified',
            'event_id' => (string) Str::uuid(),
            'status' => $status,
            'is_qualified' => $scorePercent >= 60.0,
            'message' => $message,
            'candidate' => [
                'aptrun_user_id' => $user?->id,
                'name' => $user?->name,
                'email' => $user?->email,
                'phone' => $user?->phone,
                'college_name' => $user?->college?->name,
                'branch' => $user?->branch,
                'graduation_year' => $user?->graduation_year,
                'skills' => $user?->skills ?? [],
                'primary_language' => $user?->primary_language,
            ],
            'interview' => [
                'qualification_id' => $qualification->id,
                'stack_key' => $stackKey,
                'stack_name' => $stackName,
                'role_key' => $qualification->role_key,
                'role_title' => $roleTitle,
                'series_number' => $qualification->current_attempt,
                'round_scores' => array_map('intval', (array) ($qualification->series_scores ?? [])),
                'series_average' => round($scorePercent, 2),
                'qualifying_threshold' => 60.0,
                'qualified_at' => ($qualification->qualified_at ?? now())->toIso8601String(),
            ],
            'system' => [
                'source' => 'AptRun',
                'environment' => config('app.env'),
                'timestamp' => now()->toIso8601String(),
            ],
        ];

        $record = VaultScoreTransfer::create([
            'uuid' => $payload['event_id'],
            'user_id' => $qualification->user_id,
            'interview_id' => null,
            'qualification_id' => $qualification->id,
            'stack_key' => $stackKey,
            'role_key' => $qualification->role_key,
            'event_type' => VaultScoreTransfer::EVENT_SERIES_QUALIFIED,
            'score' => round($scorePercent, 2),
            'status' => $status,
            'message' => $message,
            'payload' => $payload,
            'destination_type' => $this->resolveDestinationType(),
            'destination_url' => (string) config('vault.score_transfer.url', ''),
            'delivery_status' => VaultScoreTransfer::DELIVERY_PENDING,
            'attempts' => 0,
        ]);

        $this->dispatchTransfer($record);

        return $record->fresh();
    }

    /**
     * Transfer individual set score when candidate completes an interview set with >= 60%.
     */
    public function transferSetScore(
        Interview $interview,
        float $scorePercent,
        ?string $customMessage = null
    ): ?VaultScoreTransfer {
        $practiceConfig = $interview->practice_config ?? [];
        $qualId = $practiceConfig['qualification_id'] ?? null;
        $setNumber = (int) ($practiceConfig['set_number'] ?? 0);
        $seriesNumber = (int) ($practiceConfig['series_number'] ?? 1);
        $user = User::with('college')->find($interview->created_by);

        if (! $user) {
            return null;
        }

        $stackKey = $interview->metadata['stack_key'] ?? $practiceConfig['stack_key'] ?? 'general';
        $stackData = $this->catalog->stack($stackKey);
        $stackName = $stackData['stack']['name'] ?? Str::headline($stackKey);
        $roleTitle = $stackData['role']['title'] ?? Str::headline($interview->role_title ?? 'Developer');

        $status = $scorePercent >= 60.0 ? VaultScoreTransfer::STATUS_CLEARED : 'attempted';
        $message = $customMessage ?: "Candidate scored {$scorePercent}% and cleared Set {$setNumber} (Round {$setNumber}) in {$stackName}.";

        $payload = [
            'event' => 'vault_ai_interview.set_cleared',
            'event_id' => (string) Str::uuid(),
            'status' => $status,
            'is_cleared' => $scorePercent >= 60.0,
            'message' => $message,
            'candidate' => [
                'aptrun_user_id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'college_name' => $user->college?->name,
                'branch' => $user->branch,
                'graduation_year' => $user->graduation_year,
            ],
            'set_details' => [
                'interview_id' => $interview->id,
                'interview_slug' => $interview->slug,
                'qualification_id' => $qualId,
                'stack_key' => $stackKey,
                'stack_name' => $stackName,
                'role_title' => $roleTitle,
                'series_number' => $seriesNumber,
                'set_number' => $setNumber,
                'score' => round($scorePercent, 2),
                'threshold' => 60.0,
                'completed_at' => now()->toIso8601String(),
            ],
            'system' => [
                'source' => 'AptRun',
                'environment' => config('app.env'),
                'timestamp' => now()->toIso8601String(),
            ],
        ];

        $record = VaultScoreTransfer::create([
            'uuid' => $payload['event_id'],
            'user_id' => $user->id,
            'interview_id' => $interview->id,
            'qualification_id' => $qualId,
            'stack_key' => $stackKey,
            'role_key' => $interview->role_key ?? null,
            'event_type' => VaultScoreTransfer::EVENT_SET_CLEARED,
            'score' => round($scorePercent, 2),
            'status' => $status,
            'message' => $message,
            'payload' => $payload,
            'destination_type' => $this->resolveDestinationType(),
            'destination_url' => (string) config('vault.score_transfer.url', ''),
            'delivery_status' => VaultScoreTransfer::DELIVERY_PENDING,
            'attempts' => 0,
        ]);

        $this->dispatchTransfer($record);

        return $record->fresh();
    }

    /**
     * Dispatch the transfer to Mellow Vault via HTTP API and/or direct Database.
     */
    public function dispatchTransfer(VaultScoreTransfer $record): void
    {
        $record->increment('attempts');
        $transferredAny = false;
        $httpSuccess = false;
        $dbSuccess = false;
        $errorMessage = null;

        $targetUrl = config('vault.score_transfer.url');
        $secret = config('vault.score_transfer.secret') ?: config('vault.sync_secret');
        $apiKey = config('vault.score_transfer.api_key') ?: config('vault.api_key');

        // 1. Deliver over HTTP API to Mellow Vault if URL is configured
        if (filled($targetUrl)) {
            try {
                $payloadJson = json_encode($record->payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                $timestamp = (string) time();
                $signature = 'v1='.hash_hmac('sha256', "{$timestamp}.{$payloadJson}", (string) $secret);

                $headers = [
                    'X-AptRun-Event' => $record->event_type,
                    'X-AptRun-Event-Id' => $record->uuid,
                    'X-AptRun-Timestamp' => $timestamp,
                    'X-AptRun-Signature' => $signature,
                    'Idempotency-Key' => $record->uuid,
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                    'User-Agent' => 'AptRun-VaultAiTransfer/1.0',
                ];

                if (filled($apiKey)) {
                    $headers['Authorization'] = "Bearer {$apiKey}";
                }

                $response = Http::timeout(10)
                    ->withHeaders($headers)
                    ->withBody($payloadJson, 'application/json')
                    ->post($targetUrl);

                $record->http_status = $response->status();
                $record->response_body = Str::limit($response->body(), 1000);

                if ($response->successful()) {
                    $httpSuccess = true;
                    $transferredAny = true;
                } else {
                    $errorMessage = "HTTP {$response->status()}: " . Str::limit($response->body(), 300);
                }
            } catch (Throwable $e) {
                Log::warning('[MellowVaultScoreTransfer] HTTP delivery failed', [
                    'transfer_id' => $record->id,
                    'error' => $e->getMessage(),
                ]);
                $errorMessage = "HTTP Error: " . $e->getMessage();
            }
        }

        // 2. Deliver directly into Mellow Vault MySQL Database (if connection configured)
        if ($this->isDatabaseConnected()) {
            try {
                $dbResult = $this->transferDirectToDatabase($record);
                if ($dbResult) {
                    $dbSuccess = true;
                    $transferredAny = true;
                }
            } catch (Throwable $e) {
                Log::warning('[MellowVaultScoreTransfer] DB sync failed', [
                    'transfer_id' => $record->id,
                    'error' => $e->getMessage(),
                ]);
                $errorMessage = ($errorMessage ? $errorMessage . ' | ' : '') . "DB Error: " . $e->getMessage();
            }
        }

        // 3. Update transfer record status
        if ($transferredAny) {
            $record->delivery_status = VaultScoreTransfer::DELIVERY_DELIVERED;
            $record->transferred_at = now();
            $record->error_message = null;
        } else {
            // If neither HTTP nor DB was configured, mark as pending endpoint
            if (blank($targetUrl) && ! $this->isDatabaseConnected()) {
                $record->delivery_status = VaultScoreTransfer::DELIVERY_PENDING;
                $record->error_message = 'Mellow Vault AWS endpoint (MELLOW_VAULT_SCORE_TRANSFER_URL) not configured yet in .env.';
            } else {
                $record->delivery_status = VaultScoreTransfer::DELIVERY_FAILED;
                $record->error_message = $errorMessage;
            }
        }

        $record->save();
    }

    /**
     * Write directly into Mellow Vault's MySQL database (RDS).
     */
    private function transferDirectToDatabase(VaultScoreTransfer $record): bool
    {
        $connName = (string) config('vault.database.connection', 'mellow_vault');
        $conn = DB::connection($connName);
        $user = $record->user;
        if (! $user) {
            return false;
        }

        $email = mb_strtolower(trim($user->email));
        $devTable = (string) config('vault.database.table', 'developer_details_tb');

        // A. Update developer_details_tb if developer exists
        $devRow = $conn->table($devTable)->whereRaw('LOWER(email) = ?', [$email])->first();
        if ($devRow) {
            $devUpdates = [
                'aptrun_ai_interview_score' => $record->score,
                'aptrun_ai_interview_stack' => $record->stack_key,
                'developer_status' => 2, // Available for hiring
                'aptrun_synced_at' => now(),
            ];

            // Only update columns that exist on Mellow Vault's table
            $listing = Schema::connection($connName)->getColumnListing($devTable);
            $listingMap = array_fill_keys(array_map('strtolower', $listing), true);
            $filtered = array_filter($devUpdates, fn ($_, $col) => isset($listingMap[strtolower($col)]), ARRAY_FILTER_USE_BOTH);

            if (! empty($filtered)) {
                $conn->table($devTable)->where('dev_id', $devRow->dev_id)->update($filtered);
            }
        }

        // B. Check if dedicated score table exists in Mellow Vault (e.g. vault_ai_qualifications_tb)
        $scoreTable = (string) config('vault.score_transfer.table', 'vault_ai_qualifications_tb');
        if (Schema::connection($connName)->hasTable($scoreTable)) {
            $conn->table($scoreTable)->updateOrInsert(
                [
                    'aptrun_user_id' => $user->id,
                    'stack_key' => $record->stack_key,
                    'event_type' => $record->event_type,
                ],
                [
                    'email' => $email,
                    'name' => $user->name,
                    'score' => $record->score,
                    'status' => $record->status,
                    'message' => $record->message,
                    'payload' => json_encode($record->payload),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        return true;
    }

    public function isDatabaseConnected(): bool
    {
        $connName = (string) config('vault.database.connection', 'mellow_vault');
        return filled(config("database.connections.{$connName}.database"));
    }

    private function resolveDestinationType(): string
    {
        $hasHttp = filled(config('vault.score_transfer.url'));
        $hasDb = $this->isDatabaseConnected();

        if ($hasHttp && $hasDb) return 'both';
        if ($hasDb) return 'database';
        return 'http';
    }

    /**
     * Returns schema and DDL for senior developers on Mellow Vault.
     */
    public function getSeniorDeveloperDocs(): array
    {
        return [
            'api_specification' => [
                'method' => 'POST',
                'recommended_endpoint' => '/api/v1/aptrun/vault-ai/transfer-score',
                'description' => 'Mellow Vault endpoint receiving verified candidate Vault AI Interview scores (>= 60%).',
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Authorization' => 'Bearer {MELLOW_VAULT_API_KEY}',
                    'X-AptRun-Event' => 'vault_ai.score_transfer',
                    'X-AptRun-Event-Id' => 'UUID-v4',
                    'X-AptRun-Timestamp' => 'Unix-epoch-seconds',
                    'X-AptRun-Signature' => 'v1=HMAC-SHA256(timestamp.body, MELLOW_VAULT_SCORE_TRANSFER_SECRET)',
                ],
                'expected_response' => [
                    'status' => 200,
                    'body' => [
                        'success' => true,
                        'message' => 'Score recorded successfully on Mellow Vault.',
                    ],
                ],
            ],
            'sample_payload' => [
                'event' => 'vault_ai_interview.qualified',
                'event_id' => '123e4567-e89b-12d3-a456-426614174000',
                'status' => 'qualified',
                'is_qualified' => true,
                'message' => 'Candidate scored 78.5% and successfully cleared / qualified for Mellow Vault in Laravel (PHP) (Backend Developer).',
                'candidate' => [
                    'aptrun_user_id' => 42,
                    'name' => 'Alex Chen',
                    'email' => 'alex.chen@example.com',
                    'phone' => '+91 9876543210',
                    'college_name' => 'Apex Institute of Technology',
                    'branch' => 'Computer Science & Engineering',
                    'graduation_year' => 2026,
                ],
                'interview' => [
                    'qualification_id' => 15,
                    'stack_key' => 'laravel',
                    'stack_name' => 'Laravel (PHP)',
                    'role_key' => 'backend_developer',
                    'role_title' => 'Backend Developer',
                    'series_number' => 1,
                    'round_scores' => [1 => 75, 2 => 85, 3 => 76],
                    'series_average' => 78.67,
                    'qualifying_threshold' => 60.0,
                    'qualified_at' => now()->toIso8601String(),
                ],
            ],
            'recommended_mellow_vault_sql_ddl' => "
CREATE TABLE IF NOT EXISTS `vault_ai_qualifications_tb` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `aptrun_user_id` BIGINT UNSIGNED NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `stack_key` VARCHAR(64) NOT NULL,
  `event_type` VARCHAR(32) NOT NULL DEFAULT 'series_qualified',
  `score` DECIMAL(5,2) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'qualified',
  `message` TEXT NOT NULL,
  `payload` LONGTEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_email_stack` (`email`, `stack_key`),
  INDEX `idx_aptrun_user` (`aptrun_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
",
        ];
    }
}
