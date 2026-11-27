<?php

namespace App\Services\Vault;

use App\Models\College;
use App\Models\User;
use App\Services\IssuedCredentialVault;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Throwable;

/**
 * Synchronizes AptRun users into Mellow Vault's `developer_details_tb`.
 *
 * Covers both direct AptRun learners (independent) and campus-affiliated college students.
 * Ensures credentials (name, email, MD5 password, plaintext show_password, and phone number)
 * match so the user can log into Mellow Vault immediately with their AptRun credentials.
 */
class MellowVaultUserSyncService
{
    /** developer_details_tb.developer_status: 2 = Available */
    public const STATUS_AVAILABLE = 2;

    /** developer_details_tb.login_status: 1 = Active */
    public const LOGIN_STATUS_ACTIVE = 1;

    /**
     * Database connection to Mellow Vault.
     */
    public function connection(): ConnectionInterface
    {
        return DB::connection((string) config('vault.database.connection', 'mellow_vault'));
    }

    /**
     * Table name in Mellow Vault database.
     */
    public function table(): string
    {
        return (string) config('vault.database.table', 'developer_details_tb');
    }

    /**
     * Checks if the Mellow Vault connection is configured in the environment.
     */
    public function isConfigured(): bool
    {
        $connName = (string) config('vault.database.connection', 'mellow_vault');
        $db = config("database.connections.{$connName}.database");

        return filled($db);
    }

    /**
     * Performs a health-check query on the Mellow Vault database and table.
     *
     * @return array{connected: bool, database: ?string, table: string, total_developers?: int, error?: string}
     */
    public function checkHealth(): array
    {
        $table = $this->table();
        $conn = (string) config('vault.database.connection', 'mellow_vault');
        $dbName = (string) config("database.connections.{$conn}.database");

        if (! $this->isConfigured()) {
            return [
                'connected' => false,
                'database' => $dbName ?: null,
                'table' => $table,
                'error' => 'Mellow Vault database is not configured in .env (MELLOW_VAULT_DB_DATABASE is blank).',
            ];
        }

        try {
            $count = $this->connection()->table($table)->count();

            return [
                'connected' => true,
                'database' => $dbName,
                'table' => $table,
                'total_developers' => $count,
            ];
        } catch (Throwable $e) {
            return [
                'connected' => false,
                'database' => $dbName,
                'table' => $table,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Syncs an AptRun user to Mellow Vault's developer_details_tb.
     *
     * @param  User  $user The AptRun user model
     * @param  string|null  $plainPassword Plaintext password if available at creation/update
     * @param  array  $overrides Optional manual overrides (e.g. phone, branch, passing_year)
     * @return array{success: bool, action?: string, dev_id?: int, user_id?: int, email?: string, phone?: string, clg_name?: string, login_status?: int, developer_status?: int, credentials_synced?: bool, error?: string}
     */
    public function syncUser(User $user, ?string $plainPassword = null, array $overrides = []): array
    {
        // Superadmin accounts are platform administrators and must not be pushed as job candidate developers.
        if ($user->role === User::ROLE_SUPERADMIN) {
            return [
                'success' => false,
                'error' => 'Superadmin accounts cannot be synced to Mellow Vault developer listings.',
                'user_id' => $user->id,
            ];
        }

        if (! $this->isConfigured()) {
            return [
                'success' => false,
                'error' => 'Mellow Vault database connection is not configured.',
                'user_id' => $user->id,
            ];
        }

        try {
            $email = mb_strtolower(trim($user->email));
            if (mb_strlen($email) > 50) {
                return [
                    'success' => false,
                    'error' => "Email ({$email}) exceeds Mellow Vault's 50-character limit.",
                    'user_id' => $user->id,
                ];
            }

            [$firstName, $lastName] = $this->splitName((string) ($overrides['name'] ?? $user->name));
            $phone = $this->normalizePhone((string) ($overrides['phone'] ?? $user->phone ?? ''));

            // Look for existing record in Mellow Vault by email or aptrun_user_id
            $existing = $this->findExistingDeveloper($email, $user->id);

            // Resolve plaintext password:
            // 1. Explicitly passed in $plainPassword
            // 2. In $overrides['password']
            // 3. From IssuedCredentialVault if stored
            // 4. From existing Mellow Vault row if already set
            // 5. Fallback random secure password
            $finalPassword = $plainPassword
                ?: ($overrides['password'] ?? null)
                ?: $this->peekIssuedPassword($user)
                ?: ($existing->show_password ?? null);

            if (empty($finalPassword)) {
                $finalPassword = Str::password(12);
            }

            $collegeFacts = $this->resolveCollegeFacts($user, $overrides);

            $branch = $overrides['branch'] ?? $user->branch ?? null;
            $degree = $branch ? mb_substr((string) $branch, 0, 100) : null;

            $gradYear = $overrides['passing_year'] ?? $user->graduation_year ?? null;
            $passingYear = $gradYear ? mb_substr((string) $gradYear, 0, 20) : null;

            $skills = $this->formatSkills($overrides['skills'] ?? $user->skills);

            $payload = [
                'pro_id' => (int) config('vault.database.default_pro_id', 0),
                'name' => $firstName,
                'last_name' => $lastName,
                'gender' => 0,
                'phone' => $phone,
                'email' => $email,
                'password' => md5($finalPassword),
                'show_password' => $finalPassword,
                'developer_status' => self::STATUS_AVAILABLE,
                'login_status' => self::LOGIN_STATUS_ACTIVE,
                'profile_complete' => 0,
                'date' => now()->toDateString(),
                'is_working_in_org' => 0,
                'is_aptrun_synced' => 1,
                'aptrun_user_id' => $user->id,
                'aptrun_synced_at' => now(),
                'clg_name' => $collegeFacts['clg_name'],
                'education' => $collegeFacts['education'],
                'degree' => $degree,
                'passing_year' => $passingYear,
                'skills' => $skills,
                'college_id' => $collegeFacts['college_id'],
                'tpo_hod_email' => $collegeFacts['tpo_hod_email'],
                'hod_verified' => $collegeFacts['hod_verified'],
            ];

            if ($existing !== null) {
                // Update existing developer row
                $updateData = [
                    'name' => $firstName,
                    'last_name' => $lastName,
                    'email' => $email,
                    'password' => md5($finalPassword),
                    'show_password' => $finalPassword,
                    'login_status' => self::LOGIN_STATUS_ACTIVE,
                    'developer_status' => self::STATUS_AVAILABLE,
                    'is_aptrun_synced' => 1,
                    'aptrun_user_id' => $user->id,
                    'aptrun_synced_at' => now(),
                ];

                // Update phone if normalized value is not the placeholder or existing is blank
                if ($phone !== '0000000000' || blank($existing->phone ?? null)) {
                    $updateData['phone'] = $phone;
                }

                if (filled($collegeFacts['clg_name'])) {
                    $updateData['clg_name'] = $collegeFacts['clg_name'];
                    $updateData['education'] = $collegeFacts['education'];
                    $updateData['college_id'] = $collegeFacts['college_id'];
                    $updateData['tpo_hod_email'] = $collegeFacts['tpo_hod_email'];
                    $updateData['hod_verified'] = $collegeFacts['hod_verified'];
                }

                if ($degree !== null) {
                    $updateData['degree'] = $degree;
                }
                if ($passingYear !== null) {
                    $updateData['passing_year'] = $passingYear;
                }
                if ($skills !== null) {
                    $updateData['skills'] = $skills;
                }

                $this->connection()->table($this->table())
                    ->where('dev_id', $existing->dev_id)
                    ->update($updateData);

                $this->stampAptRunUser(
                    $user,
                    (int) $existing->dev_id,
                    isset($existing->pro_id) && (int) $existing->pro_id > 0 ? (int) $existing->pro_id : null,
                    (int) ($existing->profile_complete ?? 0)
                );

                return [
                    'success' => true,
                    'action' => 'updated',
                    'dev_id' => (int) $existing->dev_id,
                    'user_id' => $user->id,
                    'name' => "{$firstName} {$lastName}",
                    'email' => $email,
                    'phone' => $phone,
                    'clg_name' => $collegeFacts['clg_name'],
                    'login_status' => self::LOGIN_STATUS_ACTIVE,
                    'developer_status' => self::STATUS_AVAILABLE,
                    'credentials_synced' => true,
                ];
            }

            // Insert new developer row
            $devId = $this->connection()->table($this->table())->insertGetId($payload, 'dev_id');

            $this->stampAptRunUser($user, (int) $devId, null, 0);

            return [
                'success' => true,
                'action' => 'inserted',
                'dev_id' => (int) $devId,
                'user_id' => $user->id,
                'name' => "{$firstName} {$lastName}",
                'email' => $email,
                'phone' => $phone,
                'clg_name' => $collegeFacts['clg_name'],
                'login_status' => self::LOGIN_STATUS_ACTIVE,
                'developer_status' => self::STATUS_AVAILABLE,
                'credentials_synced' => true,
            ];
        } catch (Throwable $e) {
            Log::error('MellowVaultUserSyncService failed to sync user: '.$e->getMessage(), [
                'user_id' => $user->id,
                'email' => $user->email,
                'exception' => $e,
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
                'user_id' => $user->id,
            ];
        }
    }

    /**
     * Updates an existing user's password in Mellow Vault.
     */
    public function updateCredentials(User $user, string $newPlainPassword): bool
    {
        if (! $this->isConfigured() || blank($newPlainPassword)) {
            return false;
        }

        try {
            $email = mb_strtolower(trim($user->email));
            $affected = $this->connection()->table($this->table())
                ->where(function ($q) use ($user, $email) {
                    $q->where('aptrun_user_id', $user->id)
                        ->orWhereRaw('LOWER(email) = ?', [$email]);
                })
                ->update([
                    'password' => md5($newPlainPassword),
                    'show_password' => $newPlainPassword,
                    'aptrun_synced_at' => now(),
                ]);

            if ($affected === 0) {
                // If row didn't exist yet, sync them fully now
                $res = $this->syncUser($user, $newPlainPassword);

                return $res['success'] ?? false;
            }

            return true;
        } catch (Throwable $e) {
            Log::warning('MellowVaultUserSyncService updateCredentials error: '.$e->getMessage());

            return false;
        }
    }

    /**
     * Checks if this AptRun user is already present in Mellow Vault.
     *
     * @return array{found: bool, dev_id?: int, email?: string, phone?: string, clg_name?: string, login_status?: int, developer_status?: int, is_aptrun_synced?: int, has_password?: bool}
     */
    public function getUserSyncStatus(User $user): array
    {
        if (! $this->isConfigured()) {
            return ['found' => false];
        }

        try {
            $email = mb_strtolower(trim($user->email));
            $row = $this->findExistingDeveloper($email, $user->id);

            if (! $row) {
                return ['found' => false];
            }

            return [
                'found' => true,
                'dev_id' => (int) $row->dev_id,
                'name' => trim(($row->name ?? '').' '.($row->last_name ?? '')),
                'email' => (string) $row->email,
                'phone' => (string) ($row->phone ?? ''),
                'clg_name' => (string) ($row->clg_name ?? ''),
                'login_status' => (int) ($row->login_status ?? 0),
                'developer_status' => (int) ($row->developer_status ?? 0),
                'is_aptrun_synced' => (int) ($row->is_aptrun_synced ?? 0),
                'has_password' => filled($row->password ?? null) && filled($row->show_password ?? null),
                'aptrun_synced_at' => $row->aptrun_synced_at ?? null,
            ];
        } catch (Throwable) {
            return ['found' => false];
        }
    }

    /**
     * Batch syncs users matching given query / criteria.
     *
     * @param  iterable<User>  $users
     * @return array{total: int, inserted: int, updated: int, failed: int, errors: list<string>}
     */
    public function syncBatch(iterable $users): array
    {
        $total = 0;
        $inserted = 0;
        $updated = 0;
        $failed = 0;
        $errors = [];

        foreach ($users as $user) {
            $total++;
            $res = $this->syncUser($user);

            if (! empty($res['success'])) {
                if (($res['action'] ?? '') === 'inserted') {
                    $inserted++;
                } else {
                    $updated++;
                }
            } else {
                $failed++;
                if (isset($res['error'])) {
                    $errors[] = "User #{$user->id} ({$user->email}): {$res['error']}";
                }
            }
        }

        return [
            'total' => $total,
            'inserted' => $inserted,
            'updated' => $updated,
            'failed' => $failed,
            'errors' => array_slice($errors, 0, 10),
        ];
    }

    // ───────────────────────────── Internal Helpers ─────────────────────────────

    private function findExistingDeveloper(string $email, int $userId): ?object
    {
        return $this->connection()->table($this->table())
            ->where(function ($q) use ($email, $userId) {
                $q->whereRaw('LOWER(email) = ?', [$email])
                    ->orWhere('aptrun_user_id', $userId);
            })
            ->orderByRaw('CASE WHEN aptrun_user_id = ? THEN 0 ELSE 1 END', [$userId])
            ->orderBy('dev_id')
            ->first();
    }

    /**
     * Normalizes a phone number to fit exactly into varchar(10).
     */
    public function normalizePhone(?string $phone): string
    {
        if (blank($phone)) {
            return '0000000000';
        }

        $digits = preg_replace('/\D/', '', (string) $phone);

        // Strip country code 91 if 12 digits
        if (strlen($digits) === 12 && str_starts_with($digits, '91')) {
            $digits = substr($digits, 2);
        }

        // Strip leading 0 if 11 digits
        if (strlen($digits) === 11 && str_starts_with($digits, '0')) {
            $digits = substr($digits, 1);
        }

        // Take last 10 digits
        if (strlen($digits) > 10) {
            $digits = substr($digits, -10);
        }

        if (strlen($digits) === 0) {
            return '0000000000';
        }

        return mb_substr($digits, 0, 10);
    }

    /**
     * Splits full name into first name (max 20) and last name (max 20).
     *
     * @return array{0: string, 1: string}
     */
    public function splitName(string $fullName): array
    {
        $clean = trim($fullName);
        if ($clean === '') {
            return ['Candidate', ''];
        }

        $parts = preg_split('/\s+/u', $clean, 2) ?: ['Candidate'];
        $first = mb_substr($parts[0] ?? 'Candidate', 0, 20);
        $last = mb_substr($parts[1] ?? '', 0, 20);

        return [$first, $last];
    }

    private function resolveCollegeFacts(User $user, array $overrides): array
    {
        $college = $user->college;

        if ($college !== null) {
            $tpo = $college->tpoAdmins()->where('is_blocked', false)->orderBy('id')->value('email');

            return [
                'clg_name' => mb_substr($college->name, 0, 100),
                'education' => mb_substr($college->name, 0, 500),
                'college_id' => $college->id,
                'tpo_hod_email' => $tpo ? mb_substr($tpo, 0, 255) : null,
                'hod_verified' => $tpo !== null ? 1 : 0,
            ];
        }

        if (isset($overrides['college_name'])) {
            return [
                'clg_name' => mb_substr((string) $overrides['college_name'], 0, 100),
                'education' => mb_substr((string) $overrides['college_name'], 0, 500),
                'college_id' => $overrides['college_id'] ?? null,
                'tpo_hod_email' => null,
                'hod_verified' => 0,
            ];
        }

        // Direct / Independent learner
        return [
            'clg_name' => 'Direct / AptRun',
            'education' => 'Independent / AptRun Learner',
            'college_id' => null,
            'tpo_hod_email' => null,
            'hod_verified' => 0,
        ];
    }

    private function formatSkills(mixed $skills): ?string
    {
        if (is_array($skills)) {
            $filtered = array_values(array_filter($skills, 'is_string'));

            return $filtered === [] ? null : mb_substr(implode(', ', $filtered), 0, 255);
        }

        if (is_string($skills) && trim($skills) !== '') {
            return mb_substr(trim($skills), 0, 255);
        }

        return null;
    }

    private function peekIssuedPassword(User $user): ?string
    {
        try {
            $vault = app(IssuedCredentialVault::class);
            $peek = $vault->peek($user);

            return $peek['password'] ?? null;
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * Generates a 1-click signed SSO URL from AptRun -> Mellow Vault using the shared HMAC-SHA256
     * secret (`APTRUN_SSO_SECRET`), ensuring the student's `developer_details_tb` profile exists first.
     *
     * @return array{url: string, dev_id: ?int, synced: bool, expires_in: int}
     */
    public function buildMellowVaultSsoUrl(User $user, ?string $redirect = null): array
    {
        $devId = $user->mellow_vault_dev_id;
        $synced = $devId !== null;

        if ($devId === null && $this->isConfigured()) {
            $res = $this->syncUser($user);
            if (! empty($res['success'])) {
                $devId = $res['dev_id'] ?? $user->fresh()?->mellow_vault_dev_id;
                $synced = true;
            }
        }

        $secret = (string) config('vault.sso.secret', 'MellowVaultAptRunSSO2026SecretKeySecureToken');
        $baseUrl = (string) config('vault.sso.mellow_vault_url', 'https://mellowvault.com/aptrun-sso');

        $payload = [
            'email' => mb_strtolower(trim((string) $user->email)),
            'name' => $user->name,
            'aptrun_user_id' => $user->id,
            'dev_id' => $devId,
            'college_id' => $user->college_id,
            'role' => $user->role,
            'issued_at' => time(),
            'expires_at' => time() + 300,
        ];
        if ($redirect !== null && trim($redirect) !== '') {
            $payload['redirect'] = trim($redirect);
        }

        $payloadEncoded = rtrim(strtr(base64_encode((string) json_encode($payload, JSON_UNESCAPED_SLASHES)), '+/', '-_'), '=');
        $sig = hash_hmac('sha256', $payloadEncoded, $secret);

        $separator = str_contains($baseUrl, '?') ? '&' : '?';

        return [
            'url' => "{$baseUrl}{$separator}payload={$payloadEncoded}&sig={$sig}",
            'dev_id' => $devId ? (int) $devId : null,
            'synced' => $synced,
            'expires_in' => 300,
        ];
    }

    private function stampAptRunUser(User $user, int $devId, ?int $proId, int $profilePercent): void
    {
        try {
            if (! Schema::hasColumn('users', 'mellow_vault_dev_id')) {
                return;
            }

            $updates = [
                'mellow_vault_dev_id' => $devId,
                'mellow_vault_profile_percent' => max(0, min(100, $profilePercent)),
                'mellow_vault_profile_synced_at' => now(),
            ];
            if ($proId !== null) {
                $updates['mellow_vault_pro_id'] = $proId;
            }

            $user->forceFill($updates)->saveQuietly();
        } catch (Throwable) {
            // Non-blocking: never fail primary account provisioning if optional mirror columns fail.
        }
    }
}
