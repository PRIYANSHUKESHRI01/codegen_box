<?php

namespace App\Services\Interviews;

use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\MockInterviewQuestion;
use App\Models\User;
use App\Services\Mock\MockInterviewCatalog;
use Illuminate\Support\Facades\DB;

/**
 * The shortcuts a TPO has for filling a college mock AI interview, besides picking bank questions one at a time and generating
 * them with AI:
 *
 *   library()        the AptRun question library — the same domains and tech stacks the students' Mock AI Interview practises
 *                    (IT stacks, and the Computer Science core: DBMS, Operating Systems, Computer Networks, OOP, Data Structures, SE),
 *                    with how many questions each round has.
 *   addFromLibrary() draws a random, non-repeating sample from one stack (optionally from chosen rounds) into the interview.
 *   duplicate()      a draft copy of an interview with the same questions, to run again for another section or year.
 *
 * Library questions become ordinary bank questions (the same identity the student mocks use), so a question asked in a
 * college interview and in a student's own practice is one row, scored the same way.
 */
class CollegeInterviewBuilder
{
    /** An interview takes about 20 minutes; a TPO can ask for more but not without bound. */
    public const MAX_QUESTIONS = 30;

    public function __construct(private readonly MockInterviewCatalog $catalog) {}

    /**
     * @return list<array{key: string, title: string, stacks: list<array{key: string, name: string, questions: int, rounds: list<array{number: int, title: string, questions: int}>}>}>
     */
    public function library(): array
    {
        $domains = [];

        foreach ($this->catalog->roles() as $roleKey => $role) {
            $stacks = [];

            foreach ($role['stacks'] as $stackKey => $stack) {
                $rounds = array_map(fn (array $r) => [
                    'number' => (int) $r['round_number'],
                    'title' => (string) ($r['title'] ?? 'Round '.$r['round_number']),
                    'questions' => count($r['questions'] ?? []),
                ], $stack['rounds'] ?? []);

                $total = array_sum(array_column($rounds, 'questions'));

                // Only what can be used now; an empty stack is "coming soon" for students and has nothing to draw from.
                if ($total === 0) {
                    continue;
                }

                $stacks[] = ['key' => (string) $stackKey, 'name' => (string) $stack['name'], 'questions' => $total, 'rounds' => $rounds];
            }

            if ($stacks !== []) {
                $domains[] = ['key' => (string) $roleKey, 'title' => (string) ($role['title'] ?? $roleKey), 'stacks' => $stacks];
            }
        }

        return $domains;
    }

    /**
     * @param  list<int>|null  $rounds  limit to these round numbers (null = every round)
     * @return array{added: int, skipped_duplicates: int, available: int, total: int}
     */
    public function addFromLibrary(Interview $interview, string $stackKey, ?array $rounds, int $count, User $actor): array
    {
        $existingTexts = $interview->interviewQuestions()->with('questionBank:id,question_text')->get()
            ->map(fn (InterviewQuestion $q) => mb_strtolower(trim((string) $q->questionBank?->question_text)))->filter()->flip();

        $current = $existingTexts->count();
        $room = max(0, self::MAX_QUESTIONS - $current);
        $want = min($count, $room);

        $pool = MockInterviewQuestion::query()
            ->where('stack_key', $stackKey)
            ->when($rounds, fn ($q) => $q->whereIn('round_number', $rounds))
            ->get();

        $skipped = 0;
        $candidates = $pool->filter(function (MockInterviewQuestion $q) use ($existingTexts, &$skipped) {
            if ($existingTexts->has(mb_strtolower(trim($q->text)))) {
                $skipped++;

                return false;
            }

            return true;
        })->shuffle()->take($want)->values();

        $added = 0;

        DB::transaction(function () use ($candidates, $interview, $actor, $stackKey, $current, &$added) {
            $order = $current;

            foreach ($candidates as $q) {
                $bank = InterviewQuestionBank::firstOrCreate(
                    ['question_text' => $q->text, 'discipline' => 'software'],
                    [
                        'category' => $q->category ?: InterviewQuestionBank::CATEGORY_TECHNICAL,
                        'difficulty' => 'standard',
                        'expected_duration_seconds' => $q->duration_seconds ?: 180,
                        'tags' => [$stackKey, 'library'],
                        'notes_for_reviewer' => $q->note,
                        'reference_unverified' => (bool) $q->needs_review,
                        'is_active' => true,
                        'created_by' => $actor->id,
                    ]
                );

                InterviewQuestion::create(['interview_id' => $interview->id, 'interview_question_bank_id' => $bank->id, 'display_order' => $order++]);
                $added++;
            }
        });

        return ['added' => $added, 'skipped_duplicates' => $skipped, 'available' => $pool->count(), 'total' => $current + $added];
    }

    /** A draft copy with the same questions and none of the schedule, audience results or sittings. */
    public function duplicate(Interview $interview, User $actor): Interview
    {
        return DB::transaction(function () use ($interview, $actor) {
            $title = mb_substr('Copy of '.$interview->title, 0, 250);

            $copy = Interview::create([
                'title' => $title,
                'slug' => Interview::uniqueSlug($title),
                'description' => $interview->description,
                'status' => Interview::STATUS_DRAFT,
                'interview_type' => Interview::INTERVIEW_TYPE_TPO_MOCK,
                'owning_college_id' => $interview->owning_college_id,
                'created_by' => $actor->id,
                'branch_audience' => $interview->branch_audience,
                'qualifying_score_percent' => $interview->qualifying_score_percent,
            ]);

            foreach ($interview->interviewQuestions()->orderBy('display_order')->get() as $i => $q) {
                InterviewQuestion::create(['interview_id' => $copy->id, 'interview_question_bank_id' => $q->interview_question_bank_id, 'display_order' => $i]);
            }

            return $copy;
        });
    }
}
