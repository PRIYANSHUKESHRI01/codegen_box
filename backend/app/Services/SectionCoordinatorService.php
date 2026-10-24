<?php

namespace App\Services;

use App\Jobs\SendAccountCredentialsEmail;
use App\Services\IssuedCredentialVault;
use App\Models\ActivityLog;
use App\Models\User;
use App\Support\BranchAudience;
use App\Support\SingleMail;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Section Coordinator account management — one rule, reused by both the
 * TPO's own self-service surface (TpoCoordinatorController, scoped to
 * $user->college_id) and Mellow Ops/superadmin's college-scoped equivalent
 * (AdminController, scoped to an explicit $college route param). Extracted
 * so the coverage invariant and the account-creation pipeline can never drift
 * between the two callers.
 *
 * What a coordinator looks after is a SECTION of their college, optionally narrowed to some BRANCHES of it (a college
 * whose "Section A" mixes CSE and ECE gives each its own coordinator). The invariant: no two coordinators of a section
 * may cover the same student — so "Section A's coordinator" for any given student is never ambiguous. A coordinator with
 * no branch scope covers the whole section, and so excludes every other coordinator of it, which is exactly how it worked
 * before branch scopes existed.
 */
class SectionCoordinatorService
{
    /** Every coordinator at the given college. */
    public function listFor(int $collegeId): Collection
    {
        return User::where('college_id', $collegeId)
            ->where('role', User::ROLE_SECTION_COORDINATOR)
            ->orderBy('name')
            ->get();
    }

    /** The students this coordinator looks after — THE query (see User::scopeCoordinatedBy). */
    public function studentsOf(User $coordinator): Builder
    {
        return User::coordinatedBy($coordinator);
    }

    /** Whether one student is this coordinator's to see — answered by the same query the roster uses, never by a second rule. */
    public function covers(User $coordinator, User $student): bool
    {
        return $this->studentsOf($coordinator)->whereKey($student->id)->exists();
    }

    /**
     * Every section that actually exists at this college — derived from its students' own `section` values (set at
     * import time, see ProcessStudentImportJob/TpoStudentController::store()), not a free-text field the caller has to
     * type and hope matches — with who looks after it and how much of it nobody does.
     *
     * `uncovered_count` is the number of students in the section that no ACTIVE coordinator covers (a blocked coordinator
     * covers nobody): the TPO's "who falls between the cracks" number. A student whose branch is not mapped yet can only be
     * covered by a whole-section coordinator, so unmapped branches show up here until the TPO maps them.
     *
     * @return list<array{section: string, student_count: int, coordinator_name: ?string, coordinators: list<array<string, mixed>>, uncovered_count: int}>
     */
    public function sectionsFor(int $collegeId): array
    {
        $groups = User::where('college_id', $collegeId)
            ->where('role', User::ROLE_USER)
            ->whereNotNull('section')
            ->where('section', '!=', '')
            ->selectRaw('section, discipline, branch_code, count(*) as n')
            ->groupBy('section', 'discipline', 'branch_code')
            ->get();

        $coordinators = $this->listFor($collegeId)->groupBy(fn (User $c) => $this->key($c->section));

        $sections = [];

        foreach ($groups as $group) {
            $key = $this->key($group->section);
            $sections[$key]['section'] ??= trim((string) $group->section);
            $sections[$key]['count'] = ($sections[$key]['count'] ?? 0) + (int) $group->n;
            $sections[$key]['cells'][] = [$group->discipline, $group->branch_code, (int) $group->n];
        }

        ksort($sections);

        return collect($sections)->map(function (array $info, string $key) use ($coordinators) {
            $mine = $coordinators->get($key, collect());
            $active = $mine->reject(fn (User $c) => $c->is_blocked);

            $uncovered = 0;
            foreach ($info['cells'] as [$discipline, $branchCode, $n]) {
                $covered = $active->contains(fn (User $c) => $this->coversCell($c->coordinator_scope, $discipline, $branchCode));
                $uncovered += $covered ? 0 : $n;
            }

            return [
                'section' => $info['section'],
                'student_count' => $info['count'],
                'coordinator_name' => $mine->isEmpty() ? null : $mine->pluck('name')->implode(' · '),
                'coordinators' => $mine->map(fn (User $c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'scope_label' => BranchAudience::label($c->coordinator_scope),
                    'is_blocked' => (bool) $c->is_blocked,
                    'student_count' => $this->studentsOf($c)->count(),
                ])->values()->all(),
                'uncovered_count' => $uncovered,
            ];
        })->values()->all();
    }

    /**
     * @param  array{name: string, email: string, section: string, phone: ?string, branch_scope?: ?array}  $data
     */
    public function create(int $collegeId, array $data, User $actor): User
    {
        if (User::where('email', $data['email'])->exists()) {
            throw ValidationException::withMessages([
                'email' => ['An account with this email already exists.'],
            ]);
        }

        $scope = BranchAudience::normalize($data['branch_scope'] ?? null);

        $this->ensureScopeFree($collegeId, $data['section'], $scope);

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

        $coordinator->forceFill(['coordinator_scope' => $scope])->save();

        app(IssuedCredentialVault::class)->keep($coordinator, $plainPassword, 'created', $actor);

        ActivityLog::record(
            $actor,
            'Added a Section Coordinator',
            'User',
            $coordinator->name,
            ['section' => $coordinator->section, 'branches' => BranchAudience::label($scope)]
        );

        SingleMail::afterResponse(new SendAccountCredentialsEmail($coordinator->id, $plainPassword));

        return $coordinator->refresh();
    }

    /**
     * Reassign a coordinator's section, branch scope and contact number. `branch_scope` is changed only when the key is
     * present (null = the whole section); leaving it out keeps what they have.
     *
     * @param  array{section: string, phone?: ?string, branch_scope?: ?array}  $data
     */
    public function updateSection(User $coordinator, array $data, ?User $actor = null): User
    {
        $scope = array_key_exists('branch_scope', $data) ? BranchAudience::normalize($data['branch_scope']) : BranchAudience::normalize($coordinator->coordinator_scope);

        if ($this->key($data['section']) !== $this->key($coordinator->section) || $scope !== BranchAudience::normalize($coordinator->coordinator_scope)) {
            $this->ensureScopeFree($coordinator->college_id, $data['section'], $scope, excludingUserId: $coordinator->id);
        }

        $coordinator->forceFill([
            'section' => $data['section'],
            'phone' => $data['phone'] ?? null,
            'coordinator_scope' => $scope,
        ])->save();

        if ($actor !== null) {
            ActivityLog::record($actor, 'Changed a Section Coordinator\'s scope', 'User', $coordinator->name, ['section' => $coordinator->section, 'branches' => BranchAudience::label($scope)]);
        }

        return $coordinator->fresh();
    }

    public function payload(User $coordinator, ?int $collegeId): array
    {
        $scope = BranchAudience::normalize($coordinator->coordinator_scope);

        return [
            'id' => $coordinator->id,
            'name' => $coordinator->name,
            'email' => $coordinator->email,
            'phone' => $coordinator->phone,
            'section' => $coordinator->section,
            'branch_scope' => $scope,
            'scope_label' => BranchAudience::label($scope),
            'is_blocked' => $coordinator->is_blocked,
            'managed_student_count' => $collegeId ? $this->studentsOf($coordinator)->count() : 0,
            'avatar_url' => $coordinator->avatar_url,
            'created_at' => $coordinator->created_at,
        ];
    }

    /**
     * No two coordinators of a section may cover the same student: a whole-section coordinator excludes every other, and two
     * branch-scoped ones must not share a branch. Enforced here, at the one place a coordinator's section or scope is ever
     * set (nothing in the schema can: both are plain columns).
     */
    private function ensureScopeFree(int $collegeId, string $section, ?array $scope, ?int $excludingUserId = null): void
    {
        $others = User::where('college_id', $collegeId)
            ->where('role', User::ROLE_SECTION_COORDINATOR)
            ->whereRaw('LOWER(TRIM(section)) = ?', [$this->key($section)])
            ->when($excludingUserId !== null, fn ($q) => $q->where('id', '!=', $excludingUserId))
            ->get();

        $clash = $others->first(fn (User $other) => BranchAudience::overlap($other->coordinator_scope, $scope));

        if ($clash === null) {
            return;
        }

        $theirScope = BranchAudience::normalize($clash->coordinator_scope);

        if ($theirScope === null) {
            throw ValidationException::withMessages(['section' => ["Section {$section} already has a coordinator assigned — {$clash->name} looks after every branch in it."]]);
        }

        if ($scope === null) {
            $names = $others->pluck('name')->implode(', ');
            throw ValidationException::withMessages(['section' => ["Section {$section} already has branch-specific coordinators ({$names}). Choose the branches this coordinator should cover."]]);
        }

        throw ValidationException::withMessages(['branch_scope' => ["{$clash->name} already covers ".BranchAudience::label($theirScope)." in Section {$section}. Pick branches they don't."]]);
    }

    /** Whether a coordinator with this scope covers a student of that branch ("unknown branch" is covered only by an unscoped coordinator). */
    private function coversCell(?array $scope, ?string $discipline, ?string $branchCode): bool
    {
        $scope = BranchAudience::normalize($scope);

        return $scope === null
            || ($discipline !== null && in_array($discipline, $scope['disciplines'], true))
            || ($branchCode !== null && in_array($branchCode, $scope['branches'], true));
    }

    /** One comparable form of a section name: trimmed, case-folded. */
    private function key(?string $section): string
    {
        return mb_strtolower(trim((string) $section));
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
