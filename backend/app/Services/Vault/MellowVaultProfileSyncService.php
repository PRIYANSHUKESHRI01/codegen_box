<?php

namespace App\Services\Vault;

use App\Jobs\SendVaultStackInterviewInviteJob;
use App\Models\MellowVaultStackMapping;
use App\Models\User;
use App\Models\VaultInterviewInvite;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\URL;
use Throwable;

/**
 * Fetches developer `profile_complete` percentage and `pro_id` (`higher_professional_tb`)
 * from `mellow_vault.developer_details_tb`, stores the resolved AptRun Vault AI stack on `users`,
 * and dispatches a direct 1-click Vault AI Interview email invitation once `profile_complete >= 90`.
 */
class MellowVaultProfileSyncService
{
    public const DEFAULT_THRESHOLD = 90;

    public function __construct(
        private readonly CuratedCatalog $catalog,
        private readonly VaultAiAccessService $vaultAccess,
    ) {}

    public function connection(): ConnectionInterface
    {
        return DB::connection((string) config('vault.database.connection', 'mellow_vault'));
    }

    public function table(): string
    {
        return (string) config('vault.database.table', 'developer_details_tb');
    }

    public function isConfigured(): bool
    {
        $connName = (string) config('vault.database.connection', 'mellow_vault');

        return filled(config("database.connections.{$connName}.database"));
    }

    /**
     * Batch-loads `higher_professional_tb` (`id => heading`) once per run, falling back
     * to our seeded `mellow_vault_stack_mappings` table when `mellow_vault` is unreachable.
     *
     * @return array<int, string>
     */
    public function headingMap(): array
    {
        $map = [];

        if (Schema::hasTable('mellow_vault_stack_mappings')) {
            foreach (MellowVaultStackMapping::where('is_active', true)->get(['pro_id', 'higher_professional_heading']) as $row) {
                $map[(int) $row->pro_id] = trim((string) $row->higher_professional_heading);
            }
        }

        if ($this->isConfigured()) {
            try {
                if ($this->connection()->getSchemaBuilder()->hasTable('higher_professional_tb')) {
                    $rows = $this->connection()
                        ->table('higher_professional_tb')
                        ->select('id', 'heading')
                        ->get();
                    foreach ($rows as $row) {
                        $id = (int) $row->id;
                        $heading = trim((string) ($row->heading ?? ''));
                        if ($id > 0 && $heading !== '') {
                            $map[$id] = $heading;
                        }
                    }
                }
            } catch (Throwable) {
                // Keep seeded map fallback when external connection cannot be queried.
            }
        }

        return $map;
    }

    /**
     * Resolves a Mellow Vault `pro_id` (and optional `higher_professional_tb.heading`) into
     * an AptRun CuratedCatalog stack key, role key, and display name.
     *
     * @param  array<int, string>|null  $headingMap
     * @return array{pro_id: ?int, heading: ?string, stack_key: ?string, role_key: ?string, stack_name: ?string}
     */
    public function resolveStack(?int $proId, ?array $headingMap = null, ?string $rawHeading = null): array
    {
        if ($proId === null || $proId <= 0) {
            if ($rawHeading !== null && trim($rawHeading) !== '') {
                $matched = $this->matchHeadingToCatalog($rawHeading);

                return [
                    'pro_id' => null,
                    'heading' => trim($rawHeading),
                    'stack_key' => $matched['stack_key'],
                    'role_key' => $matched['role_key'],
                    'stack_name' => $matched['stack_name'] ?? trim($rawHeading),
                ];
            }

            return ['pro_id' => null, 'heading' => null, 'stack_key' => null, 'role_key' => null, 'stack_name' => null];
        }

        // Prefer live heading if passed/available, otherwise seeded `mellow_vault_stack_mappings`
        $headings = $headingMap ?? $this->headingMap();
        $heading = $rawHeading !== null && trim($rawHeading) !== ''
            ? trim($rawHeading)
            : ($headings[$proId] ?? null);

        if (Schema::hasTable('mellow_vault_stack_mappings')) {
            $seeded = MellowVaultStackMapping::where('pro_id', $proId)->where('is_active', true)->first();
            if ($seeded && $seeded->aptrun_stack_key) {
                $stackInfo = $this->catalog->stack($seeded->aptrun_stack_key);

                return [
                    'pro_id' => $proId,
                    'heading' => $heading ?: $seeded->higher_professional_heading,
                    'stack_key' => $seeded->aptrun_stack_key,
                    'role_key' => $stackInfo['role']['key'] ?? $seeded->aptrun_role_key,
                    'stack_name' => $stackInfo['stack']['name'] ?? $seeded->display_name,
                ];
            }
        }

        if ($heading !== null && $heading !== '') {
            $matched = $this->matchHeadingToCatalog($heading);

            return [
                'pro_id' => $proId,
                'heading' => $heading,
                'stack_key' => $matched['stack_key'],
                'role_key' => $matched['role_key'],
                'stack_name' => $matched['stack_name'] ?? $heading,
            ];
        }

        return ['pro_id' => $proId, 'heading' => null, 'stack_key' => null, 'role_key' => null, 'stack_name' => null];
    }

    /**
     * Fuzzy-normalizing matcher from Mellow Vault `higher_professional_tb.heading` (including typos/extra spaces
     * like `"C++  Developer"`) to AptRun's curated Vault AI stack key & role key.
     *
     * @return array{stack_key: ?string, role_key: ?string, stack_name: ?string}
     */
    public function matchHeadingToCatalog(string $heading): array
    {
        $norm = $this->normalizeLabel($heading);
        if ($norm === '') {
            return ['stack_key' => null, 'role_key' => null, 'stack_name' => null];
        }

        // 1. Exact/normalized match against config/curated_interview_domains.php aliases
        foreach ((array) config('curated_interview_domains.domains', []) as $stackKey => $labels) {
            foreach ((array) $labels as $label) {
                if ($this->normalizeLabel((string) $label) === $norm) {
                    $stackInfo = $this->catalog->stack((string) $stackKey);

                    return [
                        'stack_key' => (string) $stackKey,
                        'role_key' => $stackInfo['role']['key'] ?? null,
                        'stack_name' => $stackInfo['stack']['name'] ?? (string) $stackKey,
                    ];
                }
            }
        }

        // 2. Match against CuratedCatalog stack keys, names, and aliases
        foreach ($this->catalog->summaryRoles() as $roleKey => $role) {
            foreach ((array) ($role['stacks'] ?? []) as $stackKey => $stack) {
                $candidates = array_merge(
                    [(string) $stackKey, (string) ($stack['name'] ?? '')],
                    (array) ($stack['aliases'] ?? [])
                );
                foreach ($candidates as $candidate) {
                    if ($this->normalizeLabel((string) $candidate) === $norm) {
                        return [
                            'stack_key' => (string) $stackKey,
                            'role_key' => (string) $roleKey,
                            'stack_name' => (string) ($stack['name'] ?? $stackKey),
                        ];
                    }
                }
            }
        }

        // 3. Fuzzy token overlap against stack names, aliases, and tags (e.g., "ReactJS Developer", "Node JS")
        return $this->fuzzyCatalogMatch([$norm]);
    }

    /**
     * Secondary resolver when `pro_id` is 0/unmapped: scores `developer_details_tb.job`,
     * `developer_details_tb.skills`, and AptRun `users.skills` against CuratedCatalog stacks.
     *
     * @return array{stack_key: ?string, role_key: ?string, stack_name: ?string}
     */
    public function matchSkillsToCatalog(?string $mvJob, ?string $mvSkills, mixed $aptrunSkills): array
    {
        $terms = [];
        foreach ([$mvJob, $mvSkills] as $raw) {
            if (is_string($raw) && trim($raw) !== '') {
                foreach (preg_split('/[,;|\/]+/', $raw) ?: [] as $part) {
                    $clean = $this->normalizeLabel($part);
                    if ($clean !== '') {
                        $terms[] = $clean;
                    }
                }
            }
        }
        if (is_array($aptrunSkills)) {
            foreach ($aptrunSkills as $skill) {
                if (is_string($skill)) {
                    $clean = $this->normalizeLabel($skill);
                    if ($clean !== '') {
                        $terms[] = $clean;
                    }
                }
            }
        }

        return $terms === []
            ? ['stack_key' => null, 'role_key' => null, 'stack_name' => null]
            : $this->fuzzyCatalogMatch(array_values(array_unique($terms)));
    }

    /**
     * @param  list<string>  $terms
     * @return array{stack_key: ?string, role_key: ?string, stack_name: ?string}
     */
    private function fuzzyCatalogMatch(array $terms): array
    {
        $bestScore = 0;
        $best = ['stack_key' => null, 'role_key' => null, 'stack_name' => null];

        foreach ($this->catalog->summaryRoles() as $roleKey => $role) {
            foreach ((array) ($role['stacks'] ?? []) as $stackKey => $stack) {
                $tags = array_map(fn ($t) => $this->normalizeLabel((string) $t), (array) ($stack['tags'] ?? []));
                $aliases = array_map(fn ($a) => $this->normalizeLabel((string) $a), (array) ($stack['aliases'] ?? []));
                $name = $this->normalizeLabel((string) ($stack['name'] ?? ''));
                $keyNorm = str_replace('_', ' ', (string) $stackKey);
                $nameTokens = array_values(array_unique(array_filter(
                    preg_split('/[\s,&\/()\-]+/', $keyNorm.' '.$name) ?: [],
                    fn ($tok) => strlen($tok) >= 2
                )));

                $score = 0;
                foreach ($terms as $term) {
                    if ($term === $keyNorm || $term === $name || in_array($term, $aliases, true)) {
                        $score += 10;
                    } elseif (in_array($term, $nameTokens, true)) {
                        $score += 8;
                    } elseif (in_array($term, $tags, true)) {
                        $score += 6;
                    } elseif (strlen($term) >= 3 && (str_contains($name, $term) || str_contains($term, $keyNorm))) {
                        $score += 4;
                    }
                }

                if ($score > $bestScore) {
                    $bestScore = $score;
                    $best = [
                        'stack_key' => (string) $stackKey,
                        'role_key' => (string) $roleKey,
                        'stack_name' => (string) ($stack['name'] ?? $stackKey),
                    ];
                }
            }
        }

        return $bestScore >= 6 ? $best : ['stack_key' => null, 'role_key' => null, 'stack_name' => null];
    }

    /**
     * Fetches the live row from `mellow_vault.developer_details_tb` for ONE AptRun user and updates
     * AptRun's synced profile %, resolved stack, and (optionally) sends the 90%+ interview invite email.
     *
     * @return array{found: bool, profile_percent: int, pro_id: ?int, stack_key: ?string, stack_name: ?string, hit_90: bool, invite_dispatched: bool}
     */
    public function syncSingleUser(User $user, bool $dispatchInviteIfEligible = false, int $threshold = self::DEFAULT_THRESHOLD, bool $syncDispatch = false): array
    {
        if (! $this->isConfigured()) {
            $pct = (int) ($user->mellow_vault_profile_percent ?? 0);

            return [
                'found' => $user->mellow_vault_profile_synced_at !== null,
                'profile_percent' => $pct,
                'pro_id' => $user->mellow_vault_pro_id,
                'stack_key' => $user->mellow_vault_stack_key,
                'stack_name' => $user->mellow_vault_stack_name,
                'hit_90' => $pct >= $threshold,
                'invite_dispatched' => false,
            ];
        }

        try {
            $email = mb_strtolower(trim((string) $user->email));
            $row = $this->connection()
                ->table($this->table())
                ->select($this->developerSelectColumns())
                ->where(function ($q) use ($user, $email) {
                    $q->where('aptrun_user_id', $user->id);
                    if ($email !== '') {
                        $q->orWhereRaw('LOWER(email) = ?', [$email]);
                    }
                })
                ->orderByDesc('dev_id')
                ->first();

            if (! $row) {
                $pct = (int) ($user->mellow_vault_profile_percent ?? 0);

                return [
                    'found' => false,
                    'profile_percent' => $pct,
                    'pro_id' => $user->mellow_vault_pro_id,
                    'stack_key' => $user->mellow_vault_stack_key,
                    'stack_name' => $user->mellow_vault_stack_name,
                    'hit_90' => $pct >= $threshold,
                    'invite_dispatched' => false,
                ];
            }

            $headings = $this->headingMap();

            $res = $this->applyDeveloperRow(
                $user,
                (array) $row,
                $headings,
                $threshold,
                $dispatchInviteIfEligible,
                $syncDispatch,
                false
            );

            return [
                'found' => true,
                'profile_percent' => $res['profile_percent'],
                'pro_id' => $res['pro_id'],
                'stack_key' => $res['stack_key'],
                'stack_name' => $res['stack_name'],
                'hit_90' => $res['profile_percent'] >= $threshold,
                'invite_dispatched' => $res['invited'],
            ];
        } catch (Throwable) {
            $pct = (int) ($user->mellow_vault_profile_percent ?? 0);

            return [
                'found' => false,
                'profile_percent' => $pct,
                'pro_id' => $user->mellow_vault_pro_id,
                'stack_key' => $user->mellow_vault_stack_key,
                'stack_name' => $user->mellow_vault_stack_name,
                'hit_90' => $pct >= $threshold,
                'invite_dispatched' => false,
            ];
        }
    }

    /**
     * Scans `mellow_vault.developer_details_tb` across all developers, syncs their `profile_complete` %
     * and resolved tech stack onto matching AptRun `users`, and sends up to `$maxEmails` interview
     * invitation emails for users newly crossing `$threshold` (90%).
     *
     * @return array{configured: bool, scanned: int, matched_users: int, updated_users: int, eligible_90: int, invites_queued: int, skipped_already_invited: int, skipped_locked_or_opted_out: int}
     */
    public function syncAll(
        int $threshold = self::DEFAULT_THRESHOLD,
        int $maxEmails = 50,
        bool $dryRun = false,
        ?int $onlyUserId = null,
        ?string $onlyEmail = null,
        bool $syncDispatch = false,
    ): array {
        $stats = [
            'configured' => $this->isConfigured(),
            'scanned' => 0,
            'matched_users' => 0,
            'updated_users' => 0,
            'eligible_90' => 0,
            'invites_queued' => 0,
            'skipped_already_invited' => 0,
            'skipped_locked_or_opted_out' => 0,
        ];

        if (! $stats['configured']) {
            return $stats;
        }

        $headings = $this->headingMap();

        $query = $this->connection()
            ->table($this->table())
            ->select($this->developerSelectColumns())
            ->orderBy('dev_id');

        if ($onlyUserId !== null) {
            $query->where('aptrun_user_id', $onlyUserId);
        }
        if ($onlyEmail !== null && trim($onlyEmail) !== '') {
            $query->whereRaw('LOWER(email) = ?', [mb_strtolower(trim($onlyEmail))]);
        }

        $query->chunkById(250, function ($rows) use (&$stats, $headings, $threshold, $maxEmails, $dryRun, $syncDispatch) {
            $userIds = [];
            $emails = [];
            foreach ($rows as $r) {
                if (! empty($r->aptrun_user_id)) {
                    $userIds[] = (int) $r->aptrun_user_id;
                }
                if (! empty($r->email)) {
                    $emails[] = mb_strtolower(trim((string) $r->email));
                }
            }

            $byId = $userIds !== []
                ? User::whereIn('id', array_values(array_unique($userIds)))->get()->keyBy('id')
                : collect();

            $byEmail = $emails !== []
                ? User::whereIn(DB::raw('LOWER(email)'), array_values(array_unique($emails)))->get()->keyBy(fn (User $u) => mb_strtolower(trim((string) $u->email)))
                : collect();

            foreach ($rows as $row) {
                $stats['scanned']++;
                $emailKey = mb_strtolower(trim((string) ($row->email ?? '')));
                /** @var User|null $user */
                $user = (! empty($row->aptrun_user_id) ? $byId->get((int) $row->aptrun_user_id) : null)
                    ?? ($emailKey !== '' ? $byEmail->get($emailKey) : null);

                if (! $user || $user->role !== User::ROLE_USER) {
                    continue;
                }

                $stats['matched_users']++;
                $allowEmail = $maxEmails > 0 ? ($stats['invites_queued'] < $maxEmails) : false;

                $outcome = $this->applyDeveloperRow(
                    $user,
                    (array) $row,
                    $headings,
                    $threshold,
                    $allowEmail,
                    $syncDispatch,
                    $dryRun
                );

                if ($outcome['updated']) {
                    $stats['updated_users']++;
                }
                if ($outcome['profile_percent'] >= $threshold) {
                    $stats['eligible_90']++;
                }
                if ($outcome['invited']) {
                    $stats['invites_queued']++;
                } elseif ($outcome['skip_reason'] === 'already_invited') {
                    $stats['skipped_already_invited']++;
                } elseif ($outcome['skip_reason'] === 'ineligible') {
                    $stats['skipped_locked_or_opted_out']++;
                }
            }
        }, 'dev_id');

        return $stats;
    }

    /**
     * Applies one `developer_details_tb` row onto an AptRun `$user` and optionally dispatches
     * their 90%+ Vault AI Interview invite email.
     *
     * @param  array<string, mixed>  $row
     * @param  array<int, string>  $headings
     * @return array{updated: bool, profile_percent: int, pro_id: ?int, stack_key: ?string, stack_name: ?string, invited: bool, skip_reason: ?string}
     */
    public function applyDeveloperRow(
        User $user,
        array $row,
        array $headings,
        int $threshold = self::DEFAULT_THRESHOLD,
        bool $dispatchEmail = true,
        bool $syncDispatch = false,
        bool $dryRun = false,
    ): array {
        $devId = isset($row['dev_id']) ? (int) $row['dev_id'] : $user->mellow_vault_dev_id;
        $proId = isset($row['pro_id']) && (int) $row['pro_id'] > 0 ? (int) $row['pro_id'] : null;
        $percent = max(0, min(100, (int) ($row['profile_complete'] ?? 0)));

        $resolved = $this->resolveStack($proId, $headings);
        if ($resolved['stack_key'] === null) {
            $skillFallback = $this->matchSkillsToCatalog(
                isset($row['job']) ? (string) $row['job'] : null,
                isset($row['skills']) ? (string) $row['skills'] : null,
                $user->skills
            );
            if ($skillFallback['stack_key'] !== null) {
                $resolved['stack_key'] = $skillFallback['stack_key'];
                $resolved['role_key'] = $skillFallback['role_key'];
                $resolved['stack_name'] = $skillFallback['stack_name'];
            }
        }
        $stackKey = $resolved['stack_key'];
        $stackName = $resolved['stack_name'];

        $changed = (int) ($user->mellow_vault_profile_percent ?? 0) !== $percent
            || $user->mellow_vault_dev_id !== $devId
            || $user->mellow_vault_pro_id !== $proId
            || $user->mellow_vault_stack_key !== $stackKey
            || $user->mellow_vault_stack_name !== $stackName;

        if ($changed && ! $dryRun) {
            $user->forceFill([
                'mellow_vault_dev_id' => $devId,
                'mellow_vault_pro_id' => $proId,
                'mellow_vault_stack_key' => $stackKey,
                'mellow_vault_stack_name' => $stackName,
                'mellow_vault_profile_percent' => $percent,
                'mellow_vault_profile_synced_at' => now(),
            ])->save();
        }

        $invited = false;
        $skipReason = null;

        if ($percent >= $threshold) {
            if ($user->vault_ai_invite_sent_at !== null) {
                $skipReason = 'already_invited';
            } elseif (
                $user->is_blocked
                || $user->email_nudges_opt_out_at !== null
                || ! filter_var($user->email, FILTER_VALIDATE_EMAIL)
                || $this->vaultAccess->forUser($user, fresh: false, persist: false)['state'] !== VaultAiAccessService::STATE_OPEN
            ) {
                $skipReason = 'ineligible';
            } elseif (VaultInterviewInvite::where('user_id', $user->id)->whereIn('status', [
                VaultInterviewInvite::STATUS_QUEUED,
                VaultInterviewInvite::STATUS_SENT,
                VaultInterviewInvite::STATUS_OPENED,
            ])->exists()) {
                $skipReason = 'already_invited';
            } elseif ($dispatchEmail) {
                if (! $dryRun) {
                    $url = $this->buildMagicInterviewUrl($user, $stackKey);
                    $invite = VaultInterviewInvite::create([
                        'user_id' => $user->id,
                        'dev_id' => $devId,
                        'pro_id' => $proId,
                        'profile_percent' => $percent,
                        'stack_key' => $stackKey,
                        'stack_name' => $stackName,
                        'invite_url' => $url,
                        'status' => VaultInterviewInvite::STATUS_QUEUED,
                    ]);

                    // Stamp immediately so parallel cron ticks never queue a second invite for this user
                    $user->forceFill([
                        'vault_ai_invite_sent_at' => now(),
                        'vault_ai_invite_stack_key' => $stackKey,
                    ])->save();

                    $job = new SendVaultStackInterviewInviteJob($invite->id);
                    if ($syncDispatch) {
                        SendVaultStackInterviewInviteJob::dispatchSync($invite->id);
                    } else {
                        dispatch($job);
                    }
                }
                $invited = true;
            }
        }

        return [
            'updated' => $changed,
            'profile_percent' => $percent,
            'pro_id' => $proId,
            'stack_key' => $stackKey,
            'stack_name' => $stackName,
            'invited' => $invited,
            'skip_reason' => $skipReason,
        ];
    }

    /**
     * Generates a 14-day temporary signed 1-click route that logs the developer directly
     * into their AptRun Vault AI Interview screen pre-selected to `$stackKey`.
     */
    public function buildMagicInterviewUrl(User $user, ?string $stackKey): string
    {
        $params = ['user' => $user->id];
        if ($stackKey !== null && $stackKey !== '') {
            $params['stack'] = $stackKey;
        }

        return URL::temporarySignedRoute('vault.interview.open', now()->addDays(14), $params);
    }

    /**
     * Canonical account-origin + Mellow Vault profile % fields shared across admin user lists.
     * AptRun-only users (not synced in `mellow_vault.developer_details_tb`) explicitly report
     * `account_origin = 'aptrun'` and `mellow_vault_profile_percent = 0`.
     *
     * @return array{is_mellow_vault_user: bool, account_origin: string, mellow_vault_profile_percent: int, mellow_vault_stack_key: ?string, mellow_vault_stack_name: ?string, vault_ai_invite_sent_at: mixed}
     */
    public static function decorateOriginFields(User $user): array
    {
        $isMv = $user->mellow_vault_dev_id !== null || $user->mellow_vault_profile_synced_at !== null;

        return [
            'is_mellow_vault_user' => $isMv,
            'account_origin' => $isMv ? 'mellow_vault' : 'aptrun',
            'mellow_vault_profile_percent' => $isMv ? (int) ($user->mellow_vault_profile_percent ?? 0) : 0,
            'mellow_vault_stack_key' => $isMv ? $user->mellow_vault_stack_key : null,
            'mellow_vault_stack_name' => $isMv ? $user->mellow_vault_stack_name : null,
            'vault_ai_invite_sent_at' => $isMv ? $user->vault_ai_invite_sent_at : null,
        ];
    }

    public static function attachOriginAttributes(User $user): User
    {
        foreach (self::decorateOriginFields($user) as $key => $val) {
            $user->setAttribute($key, $val);
        }

        return $user;
    }

    /** @return list<string> */
    private function developerSelectColumns(): array
    {
        $cols = ['dev_id', 'email', 'pro_id', 'profile_complete', 'aptrun_user_id'];
        try {
            $schema = $this->connection()->getSchemaBuilder();
            foreach (['skills', 'job'] as $extra) {
                if ($schema->hasColumn($this->table(), $extra)) {
                    $cols[] = $extra;
                }
            }
        } catch (Throwable) {
            // Keep minimal required column set.
        }

        return $cols;
    }

    private function normalizeLabel(string $label): string
    {
        $clean = preg_replace('/\s+/', ' ', mb_strtolower(trim($label))) ?? '';
        $clean = str_replace(['next.js', 'node.js', 'react.js', 'vue.js', 'express.js'], ['nextjs', 'nodejs', 'react', 'vue', 'express'], $clean);

        return trim($clean);
    }
}
