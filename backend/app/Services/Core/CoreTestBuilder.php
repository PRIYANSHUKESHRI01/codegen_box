<?php

namespace App\Services\Core;

use App\Models\CoreQuestion;
use App\Models\CoreSubject;
use App\Models\CoreTest;
use App\Models\CoreTestQuestion;
use App\Models\User;
use App\Support\BranchAudience;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Builds and edits Core tests. A test is a FIXED list of published questions — picked by hand (Mellow staff)
 * or drawn at random from a blueprint of "N questions from this subject at this difficulty" (anyone who can
 * build tests, including a TPO, who therefore never sees the bank itself) — so every student sits the same paper.
 *
 * Once anyone has started a test its question list and clock are frozen: changing them would mean students
 * sitting different papers under the same name.
 */
class CoreTestBuilder
{
    /**
     * @param  array<string, mixed>  $data  title, description, discipline_code, duration_minutes, pass_percentage, shuffle_*, max_attempts, available_from/until, branch_audience
     */
    public function create(array $data, User $actor, string $type, ?int $collegeId = null): CoreTest
    {
        $test = new CoreTest($this->attributes($data));
        $test->slug = CoreTest::uniqueSlug($data['title']);
        $test->status = CoreTest::STATUS_DRAFT;
        $test->test_type = $type;
        $test->owning_college_id = $type === CoreTest::TYPE_TPO_MOCK ? $collegeId : null;
        $test->branch_audience = BranchAudience::normalize($data['branch_audience'] ?? null);
        $test->created_by = $actor->id;
        $test->save();

        return $test;
    }

    /** @param  array<string, mixed>  $data */
    public function update(CoreTest $test, array $data): CoreTest
    {
        $started = $test->sessions()->exists();

        if ($started) {
            foreach (['duration_minutes', 'discipline_code'] as $frozen) {
                if (array_key_exists($frozen, $data) && $data[$frozen] != $test->{$frozen}) {
                    throw ValidationException::withMessages([$frozen => ['Students have started this test, so that can no longer change.']]);
                }
            }
        }

        $test->fill($this->attributes($data));

        if (array_key_exists('branch_audience', $data)) {
            $test->branch_audience = BranchAudience::normalize($data['branch_audience']);
            $this->assertQuestionsFitAudience($test);
        }

        if (isset($data['status'])) {
            $this->changeStatus($test, $data['status']);
        }

        $test->save();

        return $test;
    }

    /**
     * Replaces the test's questions with exactly this ordered list.
     *
     * @param  list<int>  $questionIds
     */
    public function setQuestions(CoreTest $test, array $questionIds): CoreTest
    {
        $this->assertEditable($test);

        $ids = array_values(array_unique(array_map('intval', $questionIds)));
        $questions = $this->pool($test)->whereIn('id', $ids)->with('subject:id,name')->get()->keyBy('id');

        if ($questions->count() !== count($ids)) {
            throw ValidationException::withMessages(['question_ids' => ['Some of those questions are not published test questions of this branch family.']]);
        }

        DB::transaction(function () use ($test, $ids, $questions) {
            $test->testQuestions()->delete();
            foreach ($ids as $position => $id) {
                CoreTestQuestion::create(['core_test_id' => $test->id, 'core_question_id' => $id, 'position' => $position + 1, 'section' => $questions[$id]->subject?->name]);
            }
        });

        return $test;
    }

    /**
     * Appends random published test questions per blueprint row. A row that cannot be filled is an error that
     * names the shortfall — never silently a shorter test.
     *
     * @param  list<array{subject_id: int, count: int, difficulty?: string|null}>  $rows
     */
    public function fillFromBlueprint(CoreTest $test, array $rows): CoreTest
    {
        $this->assertEditable($test);

        $taken = $test->testQuestions()->pluck('core_question_id')->all();
        $position = (int) $test->testQuestions()->max('position');
        $picked = [];
        $problems = [];

        foreach ($rows as $i => $row) {
            $pool = $this->pool($test)->where('subject_id', $row['subject_id'])
                ->when(! empty($row['difficulty']) && $row['difficulty'] !== 'mixed', fn ($q) => $q->where('difficulty', $row['difficulty']))
                ->whereNotIn('id', array_merge($taken, array_column($picked, 'id')))
                ->with('subject:id,name')->inRandomOrder()->limit((int) $row['count'])->get();

            if ($pool->count() < (int) $row['count']) {
                $name = $pool->first()?->subject?->name ?? "subject #{$row['subject_id']}";
                $problems["blueprint.{$i}"] = ["Only {$pool->count()} published question(s) available for {$name}".(! empty($row['difficulty']) && $row['difficulty'] !== 'mixed' ? " at {$row['difficulty']} difficulty" : '').", but {$row['count']} were asked for."];

                continue;
            }

            foreach ($pool as $question) {
                $picked[] = ['id' => $question->id, 'section' => $question->subject?->name];
            }
        }

        if ($problems !== []) {
            throw ValidationException::withMessages($problems);
        }

        DB::transaction(function () use ($test, $picked, &$position) {
            foreach ($picked as $item) {
                CoreTestQuestion::create(['core_test_id' => $test->id, 'core_question_id' => $item['id'], 'position' => ++$position, 'section' => $item['section']]);
            }
        });

        return $test;
    }

    /** A college takes a copy of one of Mellow's published papers as its own mock (the questions are the same; the test is theirs). */
    public function copyPaper(CoreTest $paper, User $actor, int $collegeId, ?string $title = null): CoreTest
    {
        abort_unless($paper->test_type === CoreTest::TYPE_GENERAL && $paper->isPublished(), 404);

        return DB::transaction(function () use ($paper, $actor, $collegeId, $title) {
            $copy = $this->create([
                'title' => $title ?: $paper->title,
                'description' => $paper->description,
                'discipline_code' => $paper->discipline_code,
                'duration_minutes' => $paper->duration_minutes,
                'pass_percentage' => $paper->pass_percentage,
                'shuffle_options' => $paper->shuffle_options,
                'shuffle_questions' => $paper->shuffle_questions,
                // The paper's own audience travels with its questions: a branch-specific paper stays branch-specific in a college's copy.
                'branch_audience' => $paper->branch_audience,
            ], $actor, CoreTest::TYPE_TPO_MOCK, $collegeId);

            foreach ($paper->testQuestions()->get() as $tq) {
                CoreTestQuestion::create(['core_test_id' => $copy->id, 'core_question_id' => $tq->core_question_id, 'position' => $tq->position, 'section' => $tq->section]);
            }

            return $copy;
        });
    }

    public function delete(CoreTest $test): void
    {
        if ($test->sessions()->exists() || $test->status === CoreTest::STATUS_PUBLISHED) {
            throw ValidationException::withMessages(['test' => ['Only an unstarted draft can be deleted — cancel a published test instead.']]);
        }

        $test->delete();
    }

    // ───────────────────────────────── internals ─────────────────────────────────

    /**
     * Published questions allowed in THIS test: its branch family, and only subjects every student the test reaches studies (see
     * CoreSubject::idsForAudience) — a Marketing student is never handed a Security Analysis question because Ops aimed a paper at "MBA".
     */
    private function pool(CoreTest $test)
    {
        return CoreQuestion::query()->forTests()->where('discipline_code', $test->discipline_code)
            ->whereIn('subject_id', CoreSubject::idsForAudience($test->discipline_code, $test->branch_audience));
    }

    /** Narrowing or widening a test's audience must not leave it holding a question some of its students do not study. */
    private function assertQuestionsFitAudience(CoreTest $test): void
    {
        if (! $test->exists) {
            return;
        }

        $allowed = CoreSubject::idsForAudience($test->discipline_code, $test->branch_audience);
        $outside = $test->questions()->get(['core_questions.id', 'core_questions.subject_id'])->filter(fn ($q) => ! in_array((int) $q->subject_id, $allowed, true))->count();

        if ($outside > 0) {
            throw ValidationException::withMessages([
                'branch_audience' => ["{$outside} question(s) in this test belong to a specialisation that not every student in that audience studies. Remove them first, or aim the test at the branch they belong to."],
            ]);
        }
    }

    private function assertEditable(CoreTest $test): void
    {
        if ($test->sessions()->exists()) {
            throw ValidationException::withMessages(['questions' => ['Students have started this test, so its questions can no longer change.']]);
        }
    }

    private function changeStatus(CoreTest $test, string $to): void
    {
        if ($to === $test->status) {
            return;
        }

        if ($to === CoreTest::STATUS_PUBLISHED) {
            $questions = $test->questions()->get();

            if ($questions->isEmpty()) {
                throw ValidationException::withMessages(['status' => ['Add questions before publishing — a test needs at least one.']]);
            }

            $retired = $questions->where('status', '!=', CoreQuestion::STATUS_PUBLISHED)->count();
            if ($retired > 0 && ! $test->sessions()->exists()) {
                throw ValidationException::withMessages(['status' => ["{$retired} question(s) in this test are no longer published. Replace them before publishing."]]);
            }
        }

        $test->status = $to;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function attributes(array $data): array
    {
        return array_intersect_key($data, array_flip([
            'title', 'description', 'discipline_code', 'duration_minutes', 'pass_percentage', 'shuffle_options', 'shuffle_questions',
            'max_attempts', 'available_from', 'available_until',
        ]));
    }
}
