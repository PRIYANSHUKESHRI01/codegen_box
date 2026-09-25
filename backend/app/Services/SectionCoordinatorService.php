<?php

namespace App\Services;

use App\Jobs\SendAccountCredentialsEmail;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Section Coordinator account management — one rule, reused by both the
 * TPO's own self-service surface (TpoCoordinatorController, scoped to
 * $user->college_id) and Mellow Ops/superadmin's college-scoped equivalent
 * (AdminController, scoped to an explicit $college route param). Extracted
 * so the "one coordinator per section" invariant and the account-creation
 * pipeline can never drift between the two callers.
 */
class SectionCoordinatorService
{
    /** Every coordinator at the given college, with how many students their assigned section actually contains right now. */
    public function listFor(int $collegeId): Collection
    {
        return User::where('college_id', $collegeId)
            ->where('role', User::ROLE_SECTION_COORDINATOR)
            ->orderBy('name')
            ->get();
    }

    /**
     * @param  array{name: string, email: string, section: string, phone: ?string}  $data
     */
    public function create(int $collegeId, array $data, User $actor): User
    {
        if (User::where('email', $data['email'])->exists()) {
            throw ValidationException::withMessages([
                'email' => ['An account with this email already exists.'],
            ]);
        }

        $this->ensureSectionUnassigned($collegeId, $data['section']);

        $plainPassword = Str::password(12);

        $coordinator = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'handle' => $this->uniqueHandle($data['name']),
            'password' => Hash::make($plainPassword),
            'must_change_password' => true,
            'role' => User::ROLE_SECTION_COORDINATOR,
            'college_id' => $collegeId,
            'section' => $data['section'],
            'phone' => $data['phone'] ?? null,
        ]);

        ActivityLog::record(
            $actor,
            'Added a Section Coordinator',
            'User',
            $coordinator->name,
            ['section' => $coordinator->section]
        );

        SendAccountCredentialsEmail::dispatch($coordinator->id, $plainPassword);

        return $coordinator->refresh();
    }

    /**
     * @param  array{section: string, phone: ?string}  $data
     */
    public function updateSection(User $coordinator, array $data): User
    {
        if ($data['section'] !== $coordinator->section) {
            $this->ensureSectionUnassigned($coordinator->college_id, $data['section'], excludingUserId: $coordinator->id);
        }

        $coordinator->forceFill([
            'section' => $data['section'],
            'phone' => $data['phone'] ?? null,
        ])->save();

        return $coordinator->fresh();
    }

    public function payload(User $coordinator, ?int $collegeId): array
    {
        $managedStudentCount = $collegeId
            ? User::where('college_id', $collegeId)
                ->where('role', User::ROLE_USER)
                ->where('section', $coordinator->section)
                ->count()
            : 0;

        return [
            'id' => $coordinator->id,
            'name' => $coordinator->name,
            'email' => $coordinator->email,
            'phone' => $coordinator->phone,
            'section' => $coordinator->section,
            'is_blocked' => $coordinator->is_blocked,
            'managed_student_count' => $managedStudentCount,
            'avatar_url' => $coordinator->avatar_url,
            'created_at' => $coordinator->created_at,
        ];
    }

    /**
     * At most one coordinator per section, per college — a TPO/Ops reports
     * UI that shows "Section A's coordinator" needs that to be unambiguous.
     * Nothing in the schema enforces this (section is a plain free-text
     * column, no unique index), so it's enforced here at the one place a
     * coordinator's section is ever set.
     */
    private function ensureSectionUnassigned(int $collegeId, string $section, ?int $excludingUserId = null): void
    {
        $query = User::where('college_id', $collegeId)
            ->where('role', User::ROLE_SECTION_COORDINATOR)
            ->where('section', $section);

        if ($excludingUserId !== null) {
            $query->where('id', '!=', $excludingUserId);
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'section' => ["Section {$section} already has a coordinator assigned."],
            ]);
        }
    }

    private function uniqueHandle(string $name): string
    {
        $base = Str::slug($name) ?: 'coordinator';

        do {
            $handle = $base.'-'.Str::lower(Str::random(4));
        } while (User::where('handle', $handle)->exists());

        return $handle;
    }
}
