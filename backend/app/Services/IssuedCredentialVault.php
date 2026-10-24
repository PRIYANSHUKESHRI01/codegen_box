<?php

namespace App\Services;

use App\Models\IssuedCredential;
use App\Models\User;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Hash;
use Throwable;

/**
 * Keeps the temporary password an account was issued, encrypted, until its owner replaces it, so a superadmin can look
 * it up again (the creation toast vanishes in seconds and the e-mail goes astray).
 *
 * What it will never hold: a password the owner chose. Every code path that issues a password calls keep(); every path
 * where the owner sets their own calls forget(); and peek() re-checks the stored value against the account's current hash
 * before showing anything, so even a path that forgot to call forget() cannot leak a password the owner has since changed.
 * Superadmin accounts are never stored or revealed.
 */
class IssuedCredentialVault
{
    public const STATE_VIEWABLE = 'viewable';
    /** The owner has set their own password — there is nothing the platform issued, and nothing to show. */
    public const STATE_OWNER_SET = 'owner_set';
    /** Still a temporary password, but issued before this feature (or the copy lapsed): reset to get a viewable one. */
    public const STATE_NOT_RECORDED = 'not_recorded';
    public const STATE_PROTECTED = 'protected';

    /** How long an unused temporary password stays retrievable. */
    public const RETENTION_DAYS = 30;

    public const SOURCES = ['created', 'reset', 'set_by_superadmin', 'import'];

    /**
     * Remember a password just issued to $user. Call it right where the plaintext exists, after the account row does.
     * Never throws: failing to keep a lookup copy must not fail the account creation it rides on.
     */
    public function keep(User $user, string $plain, string $source = 'created', ?User $issuedBy = null): void
    {
        if ($user->role === User::ROLE_SUPERADMIN) {
            return;
        }

        try {
            IssuedCredential::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'secret' => $plain,
                    'source' => $source,
                    'issued_by' => $issuedBy?->id,
                    'expires_at' => now()->addDays(self::RETENTION_DAYS),
                    'last_revealed_at' => null,
                    'reveal_count' => 0,
                ]
            );
        } catch (Throwable $e) {
            report($e);
        }
    }

    /** The owner has chosen their own password (or the account is gone) — drop whatever was kept. */
    public function forget(User|int $user): void
    {
        IssuedCredential::where('user_id', $user instanceof User ? $user->id : $user)->delete();
    }

    /**
     * Cheap state for a whole page of accounts, WITHOUT decrypting or hashing anything: "is there a lookup copy for each of
     * these". The authoritative check is peek(), which the reveal endpoint runs.
     *
     * @param  iterable<User>  $users
     * @return array<int, string> user id => STATE_*
     */
    public function statesFor(iterable $users): array
    {
        $users = collect($users);

        // Lapsed copies are never shown (every read checks expires_at); sweeping them here, once per list page, keeps the
        // table small without a scheduler entry and without costing a bulk import one extra query per row.
        IssuedCredential::where('expires_at', '<', now())->limit(500)->delete();

        $kept = IssuedCredential::whereIn('user_id', $users->pluck('id'))
            ->where('expires_at', '>', now())
            ->pluck('user_id')
            ->flip();

        return $users->mapWithKeys(fn (User $u) => [$u->id => $this->stateFor($u, $kept->has($u->id))])->all();
    }

    private function stateFor(User $user, bool $hasCopy): string
    {
        if ($user->role === User::ROLE_SUPERADMIN) {
            return self::STATE_PROTECTED;
        }
        if (! $user->must_change_password) {
            return self::STATE_OWNER_SET;
        }

        return $hasCopy ? self::STATE_VIEWABLE : self::STATE_NOT_RECORDED;
    }

    /**
     * Authoritative lookup for one account. Verifies the stored value is STILL the account's password before returning it.
     *
     * @return array{state: string, password: ?string, source: ?string, issued_at: ?string, expires_at: ?string}
     */
    public function peek(User $user): array
    {
        $none = fn (string $state) => ['state' => $state, 'password' => null, 'source' => null, 'issued_at' => null, 'expires_at' => null];

        if ($user->role === User::ROLE_SUPERADMIN) {
            return $none(self::STATE_PROTECTED);
        }

        $row = IssuedCredential::where('user_id', $user->id)->first();

        if (! $row) {
            return $none($user->must_change_password ? self::STATE_NOT_RECORDED : self::STATE_OWNER_SET);
        }

        if ($row->expires_at->isPast()) {
            $row->delete();

            return $none($user->must_change_password ? self::STATE_NOT_RECORDED : self::STATE_OWNER_SET);
        }

        try {
            $plain = $row->secret;
        } catch (DecryptException) {
            // APP_KEY changed since it was stored: unreadable, so as good as gone.
            $row->delete();

            return $none(self::STATE_NOT_RECORDED);
        }

        if (! is_string($plain) || ! Hash::check($plain, $user->password)) {
            // The owner (or any other path) has changed the password since — this copy is stale and must not be shown.
            $row->delete();

            return $none($user->must_change_password ? self::STATE_NOT_RECORDED : self::STATE_OWNER_SET);
        }

        $row->forceFill(['last_revealed_at' => now(), 'reveal_count' => $row->reveal_count + 1])->save();

        return [
            'state' => self::STATE_VIEWABLE,
            'password' => $plain,
            'source' => $row->source,
            'issued_at' => $row->updated_at?->toIso8601String(),
            'expires_at' => $row->expires_at->toIso8601String(),
        ];
    }
}
