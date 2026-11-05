<?php

namespace App\Services\Interviews;

use App\Models\Interview;
use App\Models\User;
use App\Support\BranchAudience;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Who a college's mock AI interview is FOR — the one definition the student's list, the "start" gate, the announcement, the
 * reminders and the report all read, so they can never disagree.
 *
 * An audience is the college's students, narrowed by whatever the TPO set (every restriction is "AND"; a list left empty means
 * "no restriction on that"):
 *
 *   branch_audience   departments / branch families / exact branches   (the pre-existing field, see BranchAudience)
 *   years             years of study, e.g. [3]                         (from the passing-out year)
 *   sections          section names, compared case-insensitively
 *   student_ids       hand-picked students — an explicit invitation, which ADDS to the filters above rather than narrowing them:
 *                     a TPO who picks a student by name means that student, whatever their section says.
 *
 * Blocked accounts are in the audience (so the report counts them as "did not attempt") but are never written to.
 */
class InterviewAudience
{
    /** @return array{years: list<int>, sections: list<string>, student_ids: list<int>} */
    public static function normalize(?array $filter): array
    {
        $years = array_values(array_unique(array_map('intval', array_filter((array) ($filter['years'] ?? []), fn ($y) => is_numeric($y) && (int) $y >= 1 && (int) $y <= 8))));
        $sections = array_values(array_unique(array_filter(array_map(fn ($s) => trim((string) $s), (array) ($filter['sections'] ?? [])), fn ($s) => $s !== '')));
        $ids = array_values(array_unique(array_map('intval', array_filter((array) ($filter['student_ids'] ?? []), 'is_numeric'))));

        sort($years);

        return ['years' => $years, 'sections' => $sections, 'student_ids' => $ids];
    }

    public static function isRestricted(Interview $interview): bool
    {
        $f = self::normalize($interview->audience_filter);

        return $f['years'] !== [] || $f['sections'] !== [] || $f['student_ids'] !== [];
    }

    /** Whether anything other than hand-picked students narrows the audience (branch, year or section). */
    private static function hasBaseRestriction(Interview $interview, array $f): bool
    {
        return $interview->branch_audience !== null || $f['years'] !== [] || $f['sections'] !== [];
    }

    /**
     * The SQL half: the college's students, narrowed by year / section / hand-picked. The branch rule is applied in PHP
     * (see students()), so when only a branch rule and some hand-picked students are set, this returns the whole college and
     * students() trims it.
     */
    public function query(Interview $interview): Builder
    {
        $f = self::normalize($interview->audience_filter);

        $query = User::query()->where('users.role', User::ROLE_USER)->where('users.college_id', $interview->owning_college_id);

        // Invite-only: nothing but a hand-picked list.
        if ($f['student_ids'] !== [] && ! self::hasBaseRestriction($interview, $f)) {
            return $query->whereIn('users.id', $f['student_ids']);
        }

        if ($f['years'] === [] && $f['sections'] === []) {
            return $query;
        }

        return $query->where(function (Builder $either) use ($f) {
            $either->where(function (Builder $q) use ($f) {
                if ($f['years'] !== []) {
                    $q->where(function (Builder $years) use ($f) {
                        foreach ($f['years'] as $year) {
                            $years->orWhere(fn (Builder $one) => $one->inStudyYear($year));
                        }
                    });
                }
                if ($f['sections'] !== []) {
                    $q->whereIn(DB::raw('LOWER(TRIM(users.section))'), array_map('mb_strtolower', $f['sections']));
                }
            });

            if ($f['student_ids'] !== []) {
                $either->orWhereIn('users.id', $f['student_ids']);
            }
        });
    }

    /**
     * Every student the interview is for.
     *
     * @return Collection<int, User>
     */
    public function students(Interview $interview, array $columns = ['id', 'name', 'email', 'roll_number', 'section', 'branch', 'branch_code', 'discipline', 'department', 'graduation_year', 'college_id', 'role', 'is_blocked']): Collection
    {
        $picked = array_flip(self::normalize($interview->audience_filter)['student_ids']);

        return $this->query($interview)->get($columns)
            // The branch rule narrows the filtered group; a hand-picked student is in whatever their branch says.
            ->filter(fn (User $u) => isset($picked[$u->id]) || BranchAudience::includes($interview->branch_audience, $u))
            ->values();
    }

    /** @return list<int> */
    public function ids(Interview $interview): array
    {
        return $this->students($interview, ['id', 'branch_code', 'discipline', 'department', 'role', 'college_id', 'section', 'graduation_year'])->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    /** The in-memory twin, for one student already loaded — what the student's list and the start gate ask. */
    public function includes(Interview $interview, User $user): bool
    {
        if ($user->role !== User::ROLE_USER || (int) $user->college_id !== (int) $interview->owning_college_id) {
            return false;
        }

        $f = self::normalize($interview->audience_filter);

        if (in_array($user->id, $f['student_ids'], true)) {
            return true;
        }

        // Invite-only: only the hand-picked list gets in.
        if ($f['student_ids'] !== [] && ! self::hasBaseRestriction($interview, $f)) {
            return false;
        }

        if (! BranchAudience::includes($interview->branch_audience, $user)) {
            return false;
        }

        if ($f['years'] !== []) {
            $year = $user->study_year;

            if ($year === null || ! in_array((int) $year, $f['years'], true)) {
                return false;
            }
        }

        if ($f['sections'] !== []) {
            $section = mb_strtolower(trim((string) $user->section));

            if ($section === '' || ! in_array($section, array_map('mb_strtolower', $f['sections']), true)) {
                return false;
            }
        }

        return true;
    }

    /** "Year 3 · Sections CSE_A, CSE_B · 2 invited by name" — the one-line description the cards and the report show. */
    public function describe(Interview $interview): string
    {
        $f = self::normalize($interview->audience_filter);
        $parts = [];

        if ($interview->branch_audience !== null) {
            $parts[] = 'Selected branches';
        }
        if ($f['years'] !== []) {
            $parts[] = 'Year '.implode(', ', $f['years']);
        }
        if ($f['sections'] !== []) {
            $parts[] = (count($f['sections']) === 1 ? 'Section ' : 'Sections ').implode(', ', $f['sections']);
        }
        if ($f['student_ids'] !== []) {
            $parts[] = count($f['student_ids']).($f['years'] === [] && $f['sections'] === [] ? ' invited by name' : ' also invited by name');
        }

        return $parts === [] ? 'Every student of your college' : implode(' · ', $parts);
    }
}
