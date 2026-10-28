<?php

namespace App\Services;

use App\Models\User;
use App\Support\BranchCatalog;
use App\Support\BranchNormalizer;
use Illuminate\Support\Facades\DB;

/**
 * Bulk and self-service writes of a student's resolved branch.
 *
 * Single saves go through User::resolveBranchFromLabel() (the `saving` hook).
 * This is for the cases that touch many rows at once — a TPO mapping an
 * unrecognised label for the whole college, staff adding a global spelling, the
 * `branches:resolve` command — plus the student's own "I study X" answer.
 *
 * Cost follows the number of distinct (college, label) pairs, never the number
 * of students: each pair is one indexed UPDATE on (college_id, branch_key).
 */
class BranchAssignmentService
{
    public function __construct(private readonly BranchCatalog $catalog) {}

    /**
     * Re-resolves staff/college-provided labels. Rows a student set themselves
     * (`branch_source = self`) are never touched here.
     *
     * @param  int|null  $collegeId  Limit to one college (a TPO mapping), or null for everyone.
     * @param  string|null  $key  Limit to one normalised label, or null for all.
     * @return int Students whose resolved branch now differs from before.
     */
    public function reresolve(?int $collegeId = null, ?string $key = null): int
    {
        $this->catalog->flush();

        $pairs = DB::table('users')
            ->where('role', User::ROLE_USER)
            ->where('branch_source', 'college')
            ->whereNotNull('branch_key')
            ->when($collegeId !== null, fn ($q) => $q->where('college_id', $collegeId))
            ->when($key !== null, fn ($q) => $q->where('branch_key', $key))
            ->select('college_id', 'branch_key', 'department')
            ->distinct()
            ->get();

        $changed = 0;

        foreach ($pairs as $pair) {
            // The department the roster was imported under decides ambiguous labels ("Finance"), and a recognised branch moves
            // the student to its own department; an unrecognised one keeps the department they already have.
            $code = $this->catalog->resolveKey($pair->branch_key, $pair->college_id, $pair->department);
            $discipline = $this->catalog->disciplineOf($code);
            $department = $this->catalog->departmentOf($code) ?? $pair->department;

            $query = DB::table('users')
                ->where('role', User::ROLE_USER)
                ->where('branch_source', 'college')
                ->where('branch_key', $pair->branch_key)
                ->where(function ($q) use ($code, $discipline, $department) {
                    // Only rows whose answer actually differs — keeps the count honest and writes minimal.
                    $q->whereRaw('1 = 0');
                    $code === null ? $q->orWhereNotNull('branch_code') : $q->orWhere('branch_code', '!=', $code)->orWhereNull('branch_code');
                    $discipline === null ? $q->orWhereNotNull('discipline') : $q->orWhere('discipline', '!=', $discipline)->orWhereNull('discipline');
                    $department === null ? $q->orWhereNotNull('department') : $q->orWhere('department', '!=', $department)->orWhereNull('department');
                });

            $pair->college_id === null ? $query->whereNull('college_id') : $query->where('college_id', $pair->college_id);
            $pair->department === null ? $query->whereNull('department') : $query->where('department', $pair->department);

            $changed += $query->update(['branch_code' => $code, 'discipline' => $discipline, 'department' => $department]);
        }

        return $changed;
    }

    /**
     * The student says what they study. Allowed only when the college hasn't
     * already told us (a recognised college label is authoritative); the
     * caller checks canDeclare() first.
     */
    public function declareSelf(User $student, string $branchCode): User
    {
        $branch = $this->catalog->branch($branchCode);
        abort_unless($branch !== null && $branch['is_active'], 422, 'That branch is not available.');

        $student->forceFill([
            // The raw column is the label every roster shows; a self-declared student has no college-typed one.
            'branch' => $branch['name'],
            'branch_key' => BranchNormalizer::key($branch['name']),
            'branch_code' => $branch['code'],
            'discipline' => $branch['discipline_code'],
            'department' => $this->catalog->departmentOfDiscipline($branch['discipline_code']),
            'branch_source' => 'self',
            'branch_confirmed_at' => now(),
            'branch_disputed_at' => null,
        ])->save();

        return $student;
    }

    /**
     * The student's branch is not in the catalogue, so they wrote it. Kept as their own words (`branch`), with no branch code or family
     * — nothing is guessed — in the department they chose (or already had). It counts as answered, so they are not asked again, and
     * their TPO still sees the text on the roster.
     *
     * Written with a plain UPDATE on purpose: saving the model would run the `saving` hook, which reads a changed `branch` as a label a
     * college typed and re-resolves it as one.
     */
    public function declareOther(User $student, string $label, ?string $department = null): User
    {
        $values = [
            'branch' => mb_substr($label, 0, 80),
            'branch_key' => BranchNormalizer::key($label),
            'branch_code' => null,
            'discipline' => null,
            'branch_source' => 'self',
            'branch_confirmed_at' => now(),
            'branch_disputed_at' => null,
        ];

        if ($department !== null) {
            $values['department'] = $department;
        }

        $student->newQuery()->whereKey($student->getKey())->update($values);
        $student->forceFill($values)->syncOriginalAttributes(array_keys($values));

        return $student;
    }

    /** A college's recognised label is final; everything else the student may state or change. */
    public function canDeclare(User $student): bool
    {
        return $student->branch_source !== 'college' || $student->branch_code === null;
    }
}
