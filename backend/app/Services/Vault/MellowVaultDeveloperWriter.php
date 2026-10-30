<?php

namespace App\Services\Vault;

use App\Models\User;
use App\Models\VaultProfile;
use App\Models\VaultSyncEvent;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * The database end of the Mellow Vault hand-off (VAULT_SYNC_DRIVER=database): turns a listed AptRun student into a row of Mellow
 * Vault's `developer_details_tb`, and takes that row out of view again when the student withdraws.
 *
 * What it promises about Mellow Vault's data - which it does not own:
 *   - A developer already there (same email) is LINKED, never duplicated, and only fields that are still empty are filled. Their
 *     name, phone, password, gender, photo and everything they typed themselves are never touched.
 *   - `aptrun_user_id` is never overwritten once set (those rows came from Mellow Vault into AptRun, with AptRun's own ids).
 *   - Withdrawing only ever steps a developer from "available" back to "inactive"; a developer in an interview pipeline or booked is left alone.
 *   - No password, phone or file is ever sent. A new row gets an unusable password hash (the student claims the account through
 *     Mellow Vault's own "forgot password"), and `show_password` - which Mellow Vault stores in clear text - is left empty.
 *   - Nothing is silently cut: a value that cannot fit its column (an email longer than 50 characters) fails the event for good, with the
 *     reason, so it surfaces on the admin Vault page instead of arriving mangled.
 *   - Columns that exist only on a Mellow Vault that has added them (AptRun's readiness score and so on) are filled when present and
 *     skipped when not - see docs/mellow-vault-database-sync.md for the optional ALTER.
 */
class MellowVaultDeveloperWriter
{
    /** developer_details_tb.developer_status */
    public const STATUS_INACTIVE = 0;

    public const STATUS_AVAILABLE = 2;

    public const STATUS_BOOKED = 4;

    /** Widths of the free-text columns as the table was first read (used when the database cannot be asked); the real ones win, see widths(). */
    private const WIDTH = ['name' => 20, 'last_name' => 20, 'email' => 50, 'language' => 50, 'clg_name' => 100, 'degree' => 100, 'education' => 500, 'description' => 1000, 'skills' => 255, 'tpo_hod_email' => 255, 'passing_year' => 20];

    /** Columns AptRun fills only if Mellow Vault has added them. */
    private const OPTIONAL = ['aptrun_profile_id', 'aptrun_readiness_score', 'aptrun_readiness_tier', 'aptrun_ai_interview_score', 'aptrun_ai_interview_stack', 'aptrun_listed'];

    /** @var array<string, true>|null */
    private ?array $columns = null;

    /** @var array<string, int>|null column => character width, as the database says */
    private ?array $widths = null;

    // ───────────────────────────── connection ─────────────────────────────

    public function connection(): ConnectionInterface
    {
        return DB::connection((string) config('vault.database.connection', 'mellow_vault'));
    }

    private function table(): string
    {
        return (string) config('vault.database.table', 'developer_details_tb');
    }

    /** @return array<string, true> */
    private function columns(): array
    {
        return $this->columns ??= array_fill_keys(
            array_map('strtolower', Schema::connection((string) config('vault.database.connection', 'mellow_vault'))->getColumnListing($this->table())),
            true
        );
    }

    private function has(string $column): bool
    {
        return isset($this->columns()[strtolower($column)]);
    }

    // ───────────────────────────── applying an event ─────────────────────────────

    /**
     * Applies one outbox event.
     *
     * @return array{id: int|null, action: string} `id` is the developer's dev_id (kept as the profile's external id)
     *
     * @throws MellowVaultWriteException
     */
    public function apply(VaultSyncEvent $event): array
    {
        try {
            return $event->type === VaultSyncEvent::TYPE_UPSERT ? $this->upsert($event) : $this->withdraw($event);
        } catch (MellowVaultWriteException $e) {
            throw $e;
        } catch (QueryException $e) {
            // 22xxx = data does not fit / is invalid, 23xxx = a constraint refused it: retrying the same row cannot help. Anything else
            // (the server is gone, a lock timed out) is the kind of thing that passes.
            $state = (string) ($e->errorInfo[0] ?? $e->getCode());
            throw new MellowVaultWriteException('Mellow Vault database refused it: '.Str::limit($e->getMessage(), 280, '…'), str_starts_with($state, '22') || str_starts_with($state, '23'), $e);
        }
    }

    private function upsert(VaultSyncEvent $event): array
    {
        $listing = (array) ($event->payload['profile'] ?? []);
        $profile = VaultProfile::with('user.college')->find($event->vault_profile_id);
        $user = $profile?->user;

        if ($profile === null || $user === null || blank($listing['email'] ?? null)) {
            // The student is gone (deleted since this was queued): there is nothing left to list.
            return ['id' => null, 'action' => 'skipped'];
        }

        $email = (string) $listing['email'];

        if (mb_strlen($email) > $this->width('email')) {
            throw new MellowVaultWriteException("The email is longer than Mellow Vault's email column allows ({$this->width('email')} characters), so this student cannot be listed there as is.", true);
        }

        return $this->connection()->transaction(function () use ($listing, $profile, $user, $email) {
            $existing = $this->find($profile->external_id, $email, $user->id);

            if ($existing !== null) {
                $this->connection()->table($this->table())->where('dev_id', $existing->dev_id)->update($this->updates($existing, $listing, $profile, $user));

                return ['id' => (int) $existing->dev_id, 'action' => 'updated'];
            }

            $id = $this->connection()->table($this->table())->insertGetId($this->newRow($listing, $profile, $user), 'dev_id');

            return ['id' => (int) $id, 'action' => 'inserted'];
        });
    }

    private function withdraw(VaultSyncEvent $event): array
    {
        $target = (array) ($event->payload['target'] ?? []);
        $row = $this->findForWithdrawal($target);

        if ($row === null) {
            return ['id' => null, 'action' => 'not_found'];
        }

        $status = $row->developer_status === null ? null : (int) $row->developer_status;
        $changes = ['aptrun_synced_at' => now()];

        // Only the one step we own: available -> inactive (or booked, when AptRun's own hiring partner hired them).
        // A developer in an interview pipeline, or already booked, belongs to Mellow Vault's process.
        if ($status === self::STATUS_AVAILABLE) {
            $changes['developer_status'] = $event->reason === 'hired' ? self::STATUS_BOOKED : self::STATUS_INACTIVE;
        }

        if ($this->has('aptrun_listed')) {
            $changes['aptrun_listed'] = 0;
        }

        $this->connection()->table($this->table())->where('dev_id', $row->dev_id)->update($this->only($changes));

        return ['id' => (int) $row->dev_id, 'action' => 'withdrawn'];
    }

    // ───────────────────────────── finding the developer ─────────────────────────────

    /**
     * The developer this student already is in Mellow Vault: the row we delivered before, else the row with their email. Several rows
     * can share one email in Mellow Vault's data; prefer the one already linked to this AptRun account, then the oldest.
     */
    private function find(?string $externalId, string $email, int $userId): ?object
    {
        $db = $this->connection()->table($this->table());

        if ($externalId !== null && ctype_digit($externalId)) {
            $row = (clone $db)->where('dev_id', (int) $externalId)->first();

            if ($row !== null) {
                return $row;
            }
        }

        return (clone $db)
            ->whereRaw('LOWER(email) = ?', [mb_strtolower($email)])
            ->orderByRaw('CASE WHEN aptrun_user_id = ? THEN 0 ELSE 1 END', [$userId])
            ->orderBy('dev_id')
            ->first();
    }

    /** For a withdrawal: only a row we know is this student's - delivered before (dev_id kept), or linked to this AptRun account and email. */
    private function findForWithdrawal(array $target): ?object
    {
        $db = $this->connection()->table($this->table());

        if (isset($target['external_id']) && ctype_digit((string) $target['external_id'])) {
            return (clone $db)->where('dev_id', (int) $target['external_id'])->first();
        }

        if (filled($target['email'] ?? null) && isset($target['user_id'])) {
            return (clone $db)
                ->whereRaw('LOWER(email) = ?', [mb_strtolower((string) $target['email'])])
                ->where('aptrun_user_id', (int) $target['user_id'])
                ->orderBy('dev_id')
                ->first();
        }

        return null;
    }

    // ───────────────────────────── what a row looks like ─────────────────────────────

    /** A developer who is not in Mellow Vault yet. */
    private function newRow(array $listing, VaultProfile $profile, User $user): array
    {
        [$first, $last] = $this->splitName((string) ($listing['name'] ?? $user->name));
        $college = $this->collegeFacts($user);
        $skills = $this->skills($listing);

        $row = [
            'pro_id' => $this->proId($profile),
            'name' => $first,
            'last_name' => $last,
            'gender' => 0,
            // Never shared (docs/readiness-and-vault.md): AptRun gives Mellow Vault the email so it can invite the student, not a phone.
            'phone' => '',
            'email' => (string) $listing['email'],
            // Unusable on purpose: the student sets their own through Mellow Vault's "forgot password". show_password stays empty.
            'password' => Hash::make(Str::random(48)),
            'show_password' => '',
            'professional_status' => 0,
            'developer_status' => self::STATUS_AVAILABLE,
            'login_status' => 0,
            'date' => now()->toDateString(),
            'is_working_in_org' => 0,
            'is_aptrun_synced' => 1,
            'aptrun_user_id' => $user->id,
            'aptrun_synced_at' => now(),
            'language' => $this->fit($listing['primary_language'] ?? null, 'language'),
            'clg_name' => $this->fit($college['name'], 'clg_name'),
            'education' => $this->fit($college['name'], 'education'),
            'degree' => $this->fit($listing['branch'] ?? null, 'degree'),
            'passing_year' => $this->fit($user->graduation_year, 'passing_year'),
            'description' => $this->fit($listing['bio'] ?? null, 'description'),
            'skills' => $this->fit($skills, 'skills'),
            'profile_complete' => isset($listing['profile_completion_percent']) ? (int) $listing['profile_completion_percent'] : null,
            'tpo_hod_email' => $this->fit($college['tpo_email'], 'tpo_hod_email'),
            'hod_verified' => $college['verified'] ? 1 : 0,
        ];

        return $this->only($row + $this->optional($listing, $profile));
    }

    /** A developer already in Mellow Vault: link them, fill what is empty, make them findable; never overwrite what they own. */
    private function updates(object $existing, array $listing, VaultProfile $profile, User $user): array
    {
        $college = $this->collegeFacts($user);
        $changes = ['aptrun_synced_at' => now()];

        // Link once. A row that already carries an AptRun id keeps it (see the class note).
        if ($existing->aptrun_user_id === null) {
            $changes['aptrun_user_id'] = $user->id;
            $changes['is_aptrun_synced'] = 1;
        }

        $fill = [
            'language' => $this->fit($listing['primary_language'] ?? null, 'language'),
            'clg_name' => $this->fit($college['name'], 'clg_name'),
            'education' => $this->fit($college['name'], 'education'),
            'degree' => $this->fit($listing['branch'] ?? null, 'degree'),
            'passing_year' => $this->fit($user->graduation_year, 'passing_year'),
            'description' => $this->fit($listing['bio'] ?? null, 'description'),
            'skills' => $this->fit($this->skills($listing), 'skills'),
            'tpo_hod_email' => $this->fit($college['tpo_email'], 'tpo_hod_email'),
        ];

        foreach ($fill as $column => $value) {
            if ($value !== null && blank($existing->{$column} ?? null)) {
                $changes[$column] = $value;
            }
        }

        if ($college['verified'] && (int) ($existing->hod_verified ?? 0) === 0 && filled($changes['tpo_hod_email'] ?? $existing->tpo_hod_email ?? null)) {
            $changes['hod_verified'] = 1;
        }

        // Visible to employers again - but only from the two states "nobody has put them anywhere": a developer in a pipeline or booked stays there.
        if ($existing->developer_status === null || (int) $existing->developer_status === self::STATUS_INACTIVE) {
            $changes['developer_status'] = self::STATUS_AVAILABLE;
        }

        return $this->only($changes + $this->optional($listing, $profile));
    }

    /** AptRun's own facts, for the columns a Mellow Vault that has added them can show. */
    private function optional(array $listing, VaultProfile $profile): array
    {
        return [
            'aptrun_profile_id' => $profile->public_id,
            'aptrun_readiness_score' => isset($listing['readiness']['score']) ? (int) $listing['readiness']['score'] : null,
            'aptrun_readiness_tier' => $listing['readiness']['tier'] ?? null,
            'aptrun_ai_interview_score' => $profile->ai_interview_score !== null ? (float) $profile->ai_interview_score : null,
            'aptrun_ai_interview_stack' => $profile->ai_interview_stack,
            'aptrun_listed' => 1,
        ];
    }

    /** Drops every column the table does not have (the optional ones, on a Mellow Vault that has not added them). */
    private function only(array $values): array
    {
        return array_filter($values, fn ($_, string $column) => $this->has($column), ARRAY_FILTER_USE_BOTH);
    }

    // ───────────────────────────── small helpers ─────────────────────────────

    private function proId(VaultProfile $profile): int
    {
        $map = (array) config('vault.database.pro_ids', []);

        foreach ([$profile->ai_interview_stack, $profile->ai_interview_role] as $key) {
            if ($key !== null && isset($map[$key])) {
                return (int) $map[$key];
            }
        }

        return (int) config('vault.database.default_pro_id', 0);
    }

    /** @return array{name: ?string, tpo_email: ?string, verified: bool} */
    private function collegeFacts(User $user): array
    {
        $college = $user->college;

        if ($college === null) {
            return ['name' => null, 'tpo_email' => null, 'verified' => false];
        }

        $tpo = $college->tpoAdmins()->where('is_blocked', false)->orderBy('id')->value('email');

        return ['name' => $college->name, 'tpo_email' => $tpo, 'verified' => $tpo !== null && (bool) config('vault.database.college_verified', true)];
    }

    /** @return array{0: string, 1: string} first name and the rest, each to the column's width */
    private function splitName(string $full): array
    {
        $parts = preg_split('/\s+/u', trim($full), 2) ?: [''];

        return [mb_substr($parts[0], 0, $this->width('name')), mb_substr($parts[1] ?? '', 0, $this->width('last_name'))];
    }

    private function skills(array $listing): ?string
    {
        $skills = array_values(array_filter((array) ($listing['skills'] ?? []), 'is_string'));

        return $skills === [] ? null : implode(', ', $skills);
    }

    /** Wording is cut to the column (on a word where it can); null/empty stays null so it never overwrites anything. */
    private function fit(mixed $value, string $column): ?string
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }

        $max = $this->width($column);
        $text = trim((string) $value);

        return mb_strlen($text) <= $max ? $text : rtrim(mb_substr($text, 0, $max - 1), " ,;.").'…';
    }

    /**
     * How many characters a column holds. Asked of the database (information_schema) so a Mellow Vault that widens `email` is
     * respected at once; the built-in numbers only stand in when it cannot be asked (and for the SQLite used in tests).
     */
    private function width(string $column): int
    {
        if ($this->widths === null) {
            $this->widths = [];

            try {
                $connection = $this->connection();

                if ($connection->getDriverName() === 'mysql' || $connection->getDriverName() === 'mariadb') {
                    foreach ($connection->select('SELECT COLUMN_NAME AS c, CHARACTER_MAXIMUM_LENGTH AS w FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CHARACTER_MAXIMUM_LENGTH IS NOT NULL', [$connection->getDatabaseName(), $this->table()]) as $row) {
                        $this->widths[strtolower($row->c)] = (int) $row->w;
                    }
                }
            } catch (\Throwable) {
                // fall back to the built-in widths
            }
        }

        return $this->widths[$column] ?? self::WIDTH[$column] ?? 255;
    }

    // ───────────────────────────── the other way: outcomes ─────────────────────────────

    /**
     * Developers Mellow Vault has marked booked (developer_status 4) that AptRun delivered: the profile ids to mark hired.
     * Only rows AptRun itself delivered count (their dev_id is the profile's external id) - never a match on `aptrun_user_id`
     * alone, which on a developer that came from Mellow Vault is a different system's id.
     *
     * @return list<int> dev_ids
     */
    public function bookedDeveloperIds(): array
    {
        return $this->connection()->table($this->table())
            ->where('developer_status', self::STATUS_BOOKED)
            ->where('is_aptrun_synced', 1)
            ->pluck('dev_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }
}
