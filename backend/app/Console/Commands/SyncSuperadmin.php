<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;

/**
 * Creates (or, with --update-password, updates) the one real superadmin
 * account from SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD env vars — never from a
 * hardcoded literal in a seeder/migration, which would just commit the
 * plaintext password to git history instead of a JS bundle. Safe to re-run
 * on every deploy: an existing account's password is left untouched unless
 * --update-password is passed explicitly, so a stray redeploy can never
 * silently reset it out from under whoever is using it.
 */
class SyncSuperadmin extends Command
{
    protected $signature = 'superadmin:sync {--update-password : Overwrite the password of an already-existing account}';

    protected $description = 'Create or update the superadmin account from SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD';

    public function handle(): int
    {
        $email = env('SUPERADMIN_EMAIL');
        $password = env('SUPERADMIN_PASSWORD');
        $name = env('SUPERADMIN_NAME', 'Super Admin');

        if (! $email || ! $password) {
            $this->error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must both be set (in .env or the host\'s environment variables) before running this command.');

            return self::FAILURE;
        }

        $validator = Validator::make(
            ['email' => $email, 'password' => $password],
            ['email' => ['required', 'email'], 'password' => ['required', 'string', 'min:8']]
        );

        if ($validator->fails()) {
            $this->error('Invalid SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD: '.$validator->errors()->first());

            return self::FAILURE;
        }

        $existing = User::where('email', $email)->first();

        if ($existing) {
            if ($existing->role !== User::ROLE_SUPERADMIN) {
                $this->error("An account already exists for {$email} with role '{$existing->role}', not superadmin — refusing to change its role. Resolve this manually.");

                return self::FAILURE;
            }

            if (! $this->option('update-password')) {
                $this->info("Superadmin account for {$email} already exists — left untouched. Pass --update-password to change its password.");

                return self::SUCCESS;
            }

            $existing->update(['password' => Hash::make($password)]);
            $this->info("Updated password for existing superadmin account {$email}.");

            return self::SUCCESS;
        }

        User::create([
            'name' => $name,
            'email' => $email,
            'handle' => $this->uniqueHandle($email),
            'password' => Hash::make($password),
            'role' => User::ROLE_SUPERADMIN,
        ]);

        $this->info("Created superadmin account {$email}.");

        return self::SUCCESS;
    }

    private function uniqueHandle(string $email): string
    {
        $base = Str::slug(Str::before($email, '@'), '_') ?: 'superadmin';
        $handle = $base;

        while (User::where('handle', $handle)->exists()) {
            $handle = $base.'_'.Str::lower(Str::random(4));
        }

        return $handle;
    }
}
