<?php

namespace App\Services;

use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillAssessmentQuestion;
use App\Models\SoftSkillAssessmentSet;
use App\Models\User;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The AptRun Soft Skills question-set library, from the scheduler's side: browse the
 * numbered sets with "already used?" markers, and build a test from one.
 *
 * Usage is always read through an OWNER SCOPE — a closure that narrows the assessments
 * table to the tests this caller is allowed to know about (a TPO's own college's tests,
 * a hiring partner's own, Mellow's own). A TPO therefore never learns that another
 * college used Set 7, let alone what that test was called. The same closure is the
 * whole tenancy rule for this feature; there is no other place to get it wrong.
 *
 * A set is attached by COPYING its questions into the test (the same bank rows,
 * new pivot rows), never by reference: editing or retiring a library set later cannot
 * change a test that is already live. The copy and the provenance row are one
 * transaction.
 */
class SoftSkillQuestionSetService
{
    public const DEFAULT_PER_PAGE = 20;

    /** "Show all" is capped so a library that grows large can never turn one request into an unbounded query. */
    public const MAX_PER_PAGE = 500;

    /**
     * One page of the library for a scheduler.
     *
     * @param  Closure(Builder): mixed  $ownTests  narrows SoftSkillAssessment to the tests this caller may see usage of
     * @param  array{q?: ?string, usage?: ?string, page?: mixed, per_page?: mixed}  $filters
     * @return array{sets: list<array<string, mixed>>, meta: array<string, mixed>, counts: array{all: int, used: int, unused: int}}
     */
    public function catalogue(Closure $ownTests, array $filters = []): array
    {
        $usage = in_array($filters['usage'] ?? null, ['used', 'unused'], true) ? $filters['usage'] : 'all';
        $search = trim((string) ($filters['q'] ?? ''));

        $usedConstraint = fn (Builder $q) => $q->whereHas('usages', fn (Builder $u) => $u->whereHas('assessment', $ownTests));

        $query = SoftSkillAssessment::questionSets()
            ->where('status', SoftSkillAssessment::STATUS_PUBLISHED);

        $counts = [
            'all' => (clone $query)->count(),
            'used' => $usedConstraint(clone $query)->count(),
        ];
        $counts['unused'] = $counts['all'] - $counts['used'];

        if ($usage === 'used') {
            $usedConstraint($query);
        } elseif ($usage === 'unused') {
            $query->whereDoesntHave('usages', fn (Builder $u) => $u->whereHas('assessment', $ownTests));
        }

        if ($search !== '') {
            $this->search($query, $search);
        }

        $query->orderByRaw('question_set_number is null')->orderBy('question_set_number')->orderBy('id');

        [$page, $perPage, $showAll] = $this->paging($filters['page'] ?? 1, $filters['per_page'] ?? self::DEFAULT_PER_PAGE);

        $meta = $this->meta((clone $query)->count(), $page, $perPage, $showAll);
        $rows = $query->forPage($meta['page'], $perPage)->get();

        $composition = $this->compositionFor($rows->pluck('id')->all());
        $usages = $this->usagesFor($rows->pluck('id')->all(), $ownTests);

        return [
            'sets' => $rows->map(fn (SoftSkillAssessment $set) => $this->present($set, $composition[$set->id] ?? [], $usages->get($set->id, collect())))->values()->all(),
            'meta' => $meta,
            'counts' => $counts,
        ];
    }

    /**
     * Copies a library set's questions into a test and records where they came from.
     *
     * @return array{added: int, skipped: int, total_questions: int}
     *
     * @throws ValidationException when the set or the test cannot take it
     */
    public function attach(SoftSkillAssessment $test, SoftSkillAssessment $set, ?User $actor = null): array
    {
        if (! $set->is_question_set || $set->assessment_type !== SoftSkillAssessment::TYPE_GENERAL || $set->status !== SoftSkillAssessment::STATUS_PUBLISHED) {
            throw ValidationException::withMessages(['question_set_id' => ['That question set is not available.']]);
        }

        return DB::transaction(function () use ($test, $set, $actor) {
            $locked = SoftSkillAssessment::whereKey($test->id)->lockForUpdate()->firstOrFail();

            if ($locked->status === SoftSkillAssessment::STATUS_CANCELLED) {
                throw ValidationException::withMessages(['question_set_id' => ['This test is cancelled — questions can no longer be added to it.']]);
            }

            // Questions are fixed once candidates have started: the attempts already taken were scored against them.
            if ($locked->sessions()->exists()) {
                throw ValidationException::withMessages(['question_set_id' => ['Candidates have already taken this test, so its questions can no longer change.']]);
            }

            if (SoftSkillAssessmentSet::where('soft_skill_assessment_id', $locked->id)->where('question_set_id', $set->id)->exists()) {
                throw ValidationException::withMessages(['question_set_id' => ["{$set->setLabel()} is already part of this test."]]);
            }

            $have = $locked->assessmentQuestions()->pluck('soft_skill_question_id')->all();
            $order = $locked->assessmentQuestions()->max('display_order');
            $order = $order === null ? 0 : $order + 1;

            $incoming = $set->assessmentQuestions()->orderBy('display_order')->get(['soft_skill_question_id']);
            $fresh = $incoming->reject(fn ($row) => in_array($row->soft_skill_question_id, $have, true))->values();

            if ($incoming->isEmpty()) {
                throw ValidationException::withMessages(['question_set_id' => ["{$set->setLabel()} has no questions."]]);
            }

            if ($fresh->isEmpty()) {
                throw ValidationException::withMessages(['question_set_id' => ["Every question in {$set->setLabel()} is already in this test."]]);
            }

            foreach ($fresh as $row) {
                SoftSkillAssessmentQuestion::create([
                    'soft_skill_assessment_id' => $locked->id,
                    'soft_skill_question_id' => $row->soft_skill_question_id,
                    'display_order' => $order++,
                ]);
            }

            SoftSkillAssessmentSet::create([
                'soft_skill_assessment_id' => $locked->id,
                'question_set_id' => $set->id,
                'set_title' => $set->title,
                'set_number' => $set->question_set_number,
                'questions_added' => $fresh->count(),
                'added_by' => $actor?->id,
            ]);

            return [
                'added' => $fresh->count(),
                'skipped' => $incoming->count() - $fresh->count(),
                'total_questions' => $locked->assessmentQuestions()->count(),
            ];
        });
    }

    /** The library search both the scheduler's picker and the student's page use: "12" and "set 12" find Set 12; words match the title or description. */
    public function search(Builder $query, string $term): Builder
    {
        $like = '%'.addcslashes($term, '\\%_').'%';

        return $query->where(function (Builder $q) use ($term, $like) {
            $q->where('title', 'like', $like)->orWhere('description', 'like', $like);

            if (preg_match('/^(?:set\s*)?(\d{1,5})$/i', $term, $m) === 1) {
                $q->orWhere('question_set_number', (int) $m[1]);
            }
        });
    }

    /** Next free "Set N" number, for a Mellow-written test promoted into the library. */
    public function nextSetNumber(): int
    {
        return ((int) SoftSkillAssessment::whereNotNull('question_set_number')->max('question_set_number')) + 1;
    }

    /**
     * Clamps what the client asked for. `per_page=all` means "everything", up to the cap; anything unusable falls back to 20.
     *
     * @return array{0: int, 1: int, 2: bool} page, per page, whether this is "show all"
     */
    public function paging(mixed $page, mixed $perPage): array
    {
        $showAll = is_string($perPage) && strtolower($perPage) === 'all';
        $perPage = $showAll ? self::MAX_PER_PAGE : max(1, min((int) $perPage ?: self::DEFAULT_PER_PAGE, 100));

        return [$showAll ? 1 : max(1, (int) $page), $perPage, $showAll];
    }

    /** @return array{total: int, page: int, per_page: int, last_page: int, from: int, to: int, all: bool} */
    public function meta(int $total, int $page, int $perPage, bool $showAll): array
    {
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);
        $from = $total === 0 ? 0 : ($page - 1) * $perPage + 1;

        return [
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'last_page' => $lastPage,
            'from' => $from,
            'to' => $total === 0 ? 0 : min($total, $page * $perPage),
            'all' => $showAll,
        ];
    }

    /**
     * Questions per category for each of these assessments, in one query.
     *
     * @param  list<int>  $assessmentIds
     * @return array<int, array<string, int>>
     */
    public function compositionFor(array $assessmentIds): array
    {
        if ($assessmentIds === []) {
            return [];
        }

        $out = [];

        DB::table('soft_skill_assessment_questions as aq')
            ->join('soft_skill_questions as q', 'q.id', '=', 'aq.soft_skill_question_id')
            ->whereIn('aq.soft_skill_assessment_id', $assessmentIds)
            ->groupBy('aq.soft_skill_assessment_id', 'q.category')
            ->selectRaw('aq.soft_skill_assessment_id as assessment_id, q.category as category, count(*) as cnt')
            ->get()
            ->each(function ($row) use (&$out) {
                $out[(int) $row->assessment_id][$row->category] = (int) $row->cnt;
            });

        return $out;
    }

    /**
     * @param  list<int>  $setIds
     * @return Collection<int, Collection<int, SoftSkillAssessmentSet>> usage rows per set, newest first, limited to what $ownTests allows
     */
    private function usagesFor(array $setIds, Closure $ownTests): Collection
    {
        if ($setIds === []) {
            return collect();
        }

        return SoftSkillAssessmentSet::whereIn('question_set_id', $setIds)
            ->whereHas('assessment', $ownTests)
            ->with('assessment:id,title,slug,status')
            ->latest('created_at')
            ->latest('id')
            ->get()
            ->groupBy('question_set_id');
    }

    /**
     * @param  array<string, int>  $composition
     * @param  Collection<int, SoftSkillAssessmentSet>  $usages
     * @return array<string, mixed>
     */
    private function present(SoftSkillAssessment $set, array $composition, Collection $usages): array
    {
        $statuses = $usages->map(fn (SoftSkillAssessmentSet $u) => $u->assessment?->status);

        $state = match (true) {
            $usages->isEmpty() => 'unused',
            $statuses->contains(SoftSkillAssessment::STATUS_PUBLISHED) => 'published',
            $statuses->contains(SoftSkillAssessment::STATUS_DRAFT) => 'draft',
            default => 'cancelled',
        };

        return [
            'id' => $set->id,
            'slug' => $set->slug,
            'title' => $set->title,
            'label' => $set->setLabel(),
            'set_number' => $set->question_set_number,
            'description' => $set->description,
            'duration_minutes' => $set->duration_minutes,
            'pass_percentage' => $set->pass_percentage,
            'question_count' => array_sum($composition),
            'category_composition' => $composition === [] ? (object) [] : $composition,
            'usage' => [
                'state' => $state,
                'count' => $usages->count(),
                // The five most recent — enough to recognise it; the count says whether there is more.
                'tests' => $usages->take(5)->map(fn (SoftSkillAssessmentSet $u) => [
                    'id' => $u->soft_skill_assessment_id,
                    'title' => $u->assessment?->title ?? '(deleted test)',
                    'slug' => $u->assessment?->slug,
                    'status' => $u->assessment?->status,
                    'added_at' => $u->created_at?->toIso8601String(),
                ])->values()->all(),
            ],
        ];
    }
}
