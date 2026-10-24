<?php

namespace App\Services\Core;

use App\Models\College;
use App\Models\CoreQuestion;
use App\Models\CoreSubject;
use App\Models\CoreTopic;
use App\Models\Discipline;
use App\Models\DisciplinePilot;
use App\Models\User;
use App\Support\BranchCatalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * "How much can we actually build tests from?" — published questions per discipline × subject ×
 * difficulty × usage, and whether a discipline has enough to go live to students.
 *
 * Coverage counts only PUBLISHED questions: drafts are work in progress, retired ones are gone. It is the
 * answer to "what content do we commission next" (the thin subjects) and the guard on the go-live switch
 * (config/core_prep.php → go_live).
 */
class CoreCoverageService
{
    /**
     * @return array<string, mixed>
     */
    public function forDiscipline(string $discipline): array
    {
        $counts = CoreQuestion::query()
            ->where('discipline_code', $discipline)
            ->where('status', CoreQuestion::STATUS_PUBLISHED)
            ->select('subject_id', 'topic_id', 'difficulty', 'usage', DB::raw('count(*) as n'))
            ->groupBy('subject_id', 'topic_id', 'difficulty', 'usage')
            ->get();

        $drafts = CoreQuestion::query()->where('discipline_code', $discipline)
            ->whereIn('status', [CoreQuestion::STATUS_DRAFT, CoreQuestion::STATUS_IN_REVIEW])
            ->select('status', DB::raw('count(*) as n'))->groupBy('status')->pluck('n', 'status');

        $topicTotals = CoreTopic::query()->join('core_subjects', 'core_subjects.id', '=', 'core_topics.subject_id')
            ->where('core_subjects.discipline_code', $discipline)->where('core_topics.is_active', true)
            ->select('core_topics.subject_id', DB::raw('count(*) as n'))->groupBy('core_topics.subject_id')->pluck('n', 'subject_id');

        $subjects = [];
        foreach (CoreSubject::query()->where('discipline_code', $discipline)->where('is_active', true)->orderBy('sort')->get() as $subject) {
            $mine = $counts->where('subject_id', $subject->id);
            $row = [
                'id' => $subject->id, 'code' => $subject->code, 'name' => $subject->name,
                'branch_codes' => $subject->branch_codes,
                'easy' => (int) $mine->where('difficulty', 'easy')->sum('n'),
                'medium' => (int) $mine->where('difficulty', 'medium')->sum('n'),
                'hard' => (int) $mine->where('difficulty', 'hard')->sum('n'),
                'practice' => (int) $mine->whereIn('usage', [CoreQuestion::USAGE_PRACTICE, CoreQuestion::USAGE_BOTH])->sum('n'),
                'test' => (int) $mine->whereIn('usage', [CoreQuestion::USAGE_TEST, CoreQuestion::USAGE_BOTH])->sum('n'),
                'total' => (int) $mine->sum('n'),
                'topics_total' => (int) ($topicTotals[$subject->id] ?? 0),
                'topics_covered' => $mine->pluck('topic_id')->filter()->unique()->count(),
            ];
            $subjects[] = $row;
        }

        $totalTest = array_sum(array_column($subjects, 'test'));
        $rules = config('core_prep.go_live');
        $strong = count(array_filter($subjects, fn (array $s) => $s['test'] >= $rules['min_per_subject']));

        $reasons = [];
        if ($totalTest < $rules['min_published']) {
            $reasons[] = "Needs {$rules['min_published']} published test questions (has {$totalTest}).";
        }
        if ($strong < $rules['min_subjects']) {
            $reasons[] = "Needs {$rules['min_subjects']} subjects with at least {$rules['min_per_subject']} published test questions each (has {$strong}).";
        }

        $catalog = BranchCatalog::instance()->discipline($discipline);
        $isLive = (bool) ($catalog['is_live'] ?? false);
        $pilots = $this->pilots($discipline);

        return [
            'discipline' => $discipline,
            'name' => $catalog['name'] ?? $discipline,
            'department' => $catalog['department_code'] ?? null,
            'is_live' => $isLive,
            'live_at' => $catalog['live_at'] ?? null,
            // live = everyone; pilot = only the colleges listed in `pilots`; off = nobody.
            'stage' => $isLive ? 'live' : ($pilots !== [] ? 'pilot' : 'off'),
            'pilots' => $pilots,
            'subjects' => $subjects,
            'totals' => [
                'published' => (int) $counts->sum('n'),
                'test' => $totalTest,
                'practice' => array_sum(array_column($subjects, 'practice')),
                'draft' => (int) ($drafts[CoreQuestion::STATUS_DRAFT] ?? 0),
                'in_review' => (int) ($drafts[CoreQuestion::STATUS_IN_REVIEW] ?? 0),
            ],
            'go_live' => ['ready' => $reasons === [], 'reasons' => $reasons, 'rules' => $rules, 'strong_subjects' => $strong],
        ];
    }

    /**
     * The colleges that see this branch's Core Prep before it is live for everyone, with how many of their students
     * of the branch that reaches.
     *
     * @return list<array{college_id: int, name: string, students: int}>
     */
    public function pilots(string $discipline): array
    {
        $ids = BranchCatalog::instance()->discipline($discipline)['pilot_college_ids'] ?? [];

        if ($ids === []) {
            return [];
        }

        $students = User::query()->whereIn('college_id', $ids)->where('role', User::ROLE_USER)->where('discipline', $discipline)
            ->select('college_id', DB::raw('count(*) as n'))->groupBy('college_id')->pluck('n', 'college_id');

        return College::query()->whereIn('id', $ids)->orderBy('name')->get(['id', 'name'])
            ->map(fn (College $c) => ['college_id' => $c->id, 'name' => $c->name, 'students' => (int) ($students[$c->id] ?? 0)])
            ->values()->all();
    }

    /**
     * Replaces the pilot colleges of a branch family. An empty list ends the pilot. Pilots are independent of the
     * live switch: once the branch is live for everyone the list is simply redundant, and if staff later hide the
     * branch again the pilots keep it — which is why the console shows the stage, not just the switch.
     *
     * @param  list<int>  $collegeIds
     * @return array{added: list<int>, removed: list<int>}
     */
    public function setPilots(string $discipline, array $collegeIds, User $actor): array
    {
        abort_unless((new CoreTaxonomy)->hasDiscipline($discipline), 422, 'Core Prep is not available for that branch family.');

        $wanted = array_values(array_unique(array_map('intval', $collegeIds)));
        $current = DisciplinePilot::query()->where('discipline_code', $discipline)->pluck('college_id')->map(fn ($id) => (int) $id)->all();

        $added = array_values(array_diff($wanted, $current));
        $removed = array_values(array_diff($current, $wanted));

        DB::transaction(function () use ($discipline, $added, $removed, $actor) {
            if ($removed !== []) {
                DisciplinePilot::query()->where('discipline_code', $discipline)->whereIn('college_id', $removed)->delete();
            }
            foreach ($added as $collegeId) {
                DisciplinePilot::query()->create(['discipline_code' => $discipline, 'college_id' => $collegeId, 'added_by' => $actor->id]);
            }
        });

        BranchCatalog::instance()->flush();

        return ['added' => $added, 'removed' => $removed];
    }

    /** @return list<array<string, mixed>> */
    public function all(): array
    {
        return array_map(fn (string $d) => $this->forDiscipline($d), (new CoreTaxonomy)->disciplines());
    }

    /**
     * Switches a discipline's Core Prep on or off for students. Switching ON refuses while the bank is too
     * thin to build tests from, unless `$force` (superadmin deciding knowingly).
     */
    public function setLive(string $discipline, bool $live, User $actor, bool $force = false): Discipline
    {
        $row = Discipline::where('code', $discipline)->firstOrFail();
        abort_unless((new CoreTaxonomy)->hasDiscipline($discipline), 422, 'Core Prep is not available for that branch family.');

        if ($live && ! $row->is_live && ! $force) {
            $coverage = $this->forDiscipline($discipline);

            if (! $coverage['go_live']['ready']) {
                throw ValidationException::withMessages(['live' => $coverage['go_live']['reasons']]);
            }
        }

        // Each switch-on stamps a fresh live_at: readiness gives students a grace period from it (see ReadinessScoreService).
        $row->update(['is_live' => $live] + ($live && ! $row->is_live ? ['live_at' => now()] : []));
        BranchCatalog::instance()->flush();

        return $row->fresh();
    }
}
