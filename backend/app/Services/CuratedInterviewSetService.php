<?php

namespace App\Services;

use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\User;
use App\Models\VaultStackInterest;
use App\Services\Vault\CuratedCatalog;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Service for AptRun Curated Interview Question Sets & Qualification Series.
 *
 * Provides a structured catalog of engineering roles, tech stacks, and multi-round
 * qualification series (Series 1, Series 2, Series 3) with Sets 1, 2, and 3.
 * Translates a curated set into an authentic voice interview session on demand.
 */
class CuratedInterviewSetService
{
    public function __construct(
        private readonly PlanGate $gate,
        private readonly CuratedCatalog $catalog,
    ) {}

    /**
     * Get the full catalog of roles, stacks, and interview question sets/series.
     *
     * Every stack is listed, but only a LIVE one (all 9 of its sets have enough questions) can be started; the rest carry
     * `live: false` and show as "Coming soon". `$viewer` adds which not-yet-open stacks they asked to be told about.
     *
     * @return array<string, mixed>
     */
    public function catalog(?User $viewer = null): array
    {
        $interested = $this->interestsOf($viewer);

        $roles = [];
        $totalStacks = 0;
        $liveStacks = 0;
        $totalSets = 0;
        $totalQuestions = 0;

        foreach ($this->catalog->roles() as $roleKey => $roleData) {
            $stacks = [];
            $roleSetsCount = 0;
            $roleLive = 0;

            foreach ($roleData['stacks'] ?? [] as $stackKey => $stackData) {
                $progress = $this->catalog->progress($stackData);
                $seriesList = [];
                $allSets = [];

                foreach ($stackData['series'] ?? [] as $sData) {
                    $seriesSets = [];

                    foreach ($sData['sets'] ?? [] as $setData) {
                        $questionCount = count($setData['questions'] ?? []);
                        $totalQuestions += $questionCount;
                        $roleSetsCount++;
                        $totalSets++;

                        $formattedSet = [
                            'id' => $setData['id'],
                            'series_number' => $setData['series_number'] ?? ($sData['series_number'] ?? 1),
                            'set_number' => $setData['set_number'] ?? 1,
                            'title' => $setData['title'],
                            'duration_minutes' => $setData['duration_minutes'] ?? 15,
                            'description' => $setData['description'] ?? '',
                            'tags' => $setData['tags'] ?? [],
                            'question_count' => $questionCount,
                            'ready' => $this->catalog->isSetReady($setData),
                            'preview_questions' => array_slice(array_column($setData['questions'] ?? [], 'text'), 0, 3),
                        ];

                        $seriesSets[] = $formattedSet;
                        $allSets[] = $formattedSet;
                    }

                    $seriesList[] = [
                        'id' => $sData['id'],
                        'series_number' => $sData['series_number'],
                        'title' => $sData['title'],
                        'description' => $sData['description'] ?? '',
                        'sets_count' => count($seriesSets),
                        'sets' => $seriesSets,
                    ];
                }

                $totalStacks++;
                $liveStacks += $progress['live'] ? 1 : 0;
                $roleLive += $progress['live'] ? 1 : 0;

                $stacks[] = [
                    'key' => $stackKey,
                    'name' => $stackData['name'],
                    'blurb' => $stackData['blurb'],
                    'icon' => $stackData['icon'] ?? 'Code2',
                    'aliases' => $stackData['aliases'] ?? [],
                    'tags' => $stackData['tags'] ?? [],
                    'live' => $progress['live'],
                    'ready_sets' => $progress['ready_sets'],
                    'total_sets' => $progress['total_sets'],
                    'interested' => ! $progress['live'] && isset($interested[$stackKey]),
                    'series_count' => count($seriesList),
                    'series' => $seriesList,
                    'sets_count' => count($allSets),
                    'sets' => $allSets,
                ];
            }

            $roles[] = [
                'key' => $roleKey,
                'title' => $roleData['title'],
                'blurb' => $roleData['blurb'],
                'icon' => $roleData['icon'] ?? 'Server',
                'badge' => $roleData['badge'] ?? null,
                'color' => $roleData['color'] ?? 'indigo',
                'stacks_count' => count($stacks),
                'live_stacks_count' => $roleLive,
                'sets_count' => $roleSetsCount,
                'stacks' => $stacks,
            ];
        }

        return [
            'roles' => $roles,
            'stats' => [
                'total_roles' => count($roles),
                'total_stacks' => $totalStacks,
                'live_stacks' => $liveStacks,
                'total_sets' => $totalSets,
                'total_questions' => $totalQuestions,
            ],
        ];
    }

    /**
     * Find a set by ID across all roles and stacks.
     *
     * @return array{role: array, stack: array, set: array}|null
     */
    public function findSet(string $setId): ?array
    {
        foreach ($this->catalog->roles() as $roleKey => $roleData) {
            foreach ($roleData['stacks'] ?? [] as $stackKey => $stackData) {
                foreach ($this->catalog->allSets($stackData) as $setData) {
                    if ($setData['id'] === $setId) {
                        return $this->target((string) $roleKey, $roleData, (string) $stackKey, $stackData, $setData);
                    }
                }
            }
        }

        return null;
    }

    /**
     * The role a stack belongs to in the catalog, or null for a stack that does not exist.
     */
    public function roleKeyForStack(string $stackKey): ?string
    {
        return $this->catalog->stack($stackKey)['role']['key'] ?? null;
    }

    /**
     * Find a set by stack, series number, and set number.
     *
     * @return array{role: array, stack: array, set: array}|null
     */
    public function findSetBySeries(string $stackKey, int $seriesNumber, int $setNumber): ?array
    {
        $found = $this->catalog->stack($stackKey);

        if ($found === null) {
            return null;
        }

        foreach ($this->catalog->allSets($found['stack']) as $setData) {
            if ((int) ($setData['series_number'] ?? 0) === $seriesNumber && (int) ($setData['set_number'] ?? 0) === $setNumber) {
                return $this->target($found['role']['key'], $found['role'], $stackKey, $found['stack'], $setData);
            }
        }

        return null;
    }

    /** @return array{role: array, stack: array, set: array} */
    private function target(string $roleKey, array $roleData, string $stackKey, array $stackData, array $setData): array
    {
        return [
            'role' => ['key' => $roleKey, 'title' => $roleData['title'], 'color' => $roleData['color'] ?? 'indigo'],
            'stack' => ['key' => $stackKey, 'name' => $stackData['name']],
            'set' => $setData,
        ];
    }

    /** @return array<string, true> the stacks this student asked to be told about; none for a missing viewer or a server that has not migrated yet */
    private function interestsOf(?User $viewer): array
    {
        if ($viewer === null) {
            return [];
        }

        try {
            return VaultStackInterest::where('user_id', $viewer->id)->pluck('stack_key')->mapWithKeys(fn ($key) => [(string) $key => true])->all();
        } catch (QueryException $e) {
            report($e);

            return [];
        }
    }

    /**
     * Start an interview from a curated question set.
     * Checks user entitlement, seeds questions into question bank,
     * creates an Interview model instance, and associates questions.
     */
    public function start(User $user, string $setId, array $extraPracticeConfig = []): Interview
    {
        // 1. Assert mock interview allowance under user's plan
        $this->gate->assertMockInterviewAllowed($user);

        // 2. Find set definition
        $target = $this->findSet($setId);
        if ($target === null) {
            throw new NotFoundHttpException("Curated question set [{$setId}] not found.");
        }

        if (! $this->catalog->isSetReady($target['set'])) {
            throw new ConflictHttpException('This interview set is still being prepared and cannot be started yet.');
        }

        return $this->createInterviewFromTarget($user, $target, $extraPracticeConfig);
    }

    /**
     * Create an interview session directly from resolved target definition.
     */
    public function createInterviewFromTarget(User $user, array $target, array $extraPracticeConfig = []): Interview
    {
        $role = $target['role'];
        $stack = $target['stack'];
        $setData = $target['set'];

        // Never an interview with nothing to ask: a set that has no questions yet is "coming soon", not startable.
        if (empty($setData['questions'])) {
            throw new ConflictHttpException('This interview set has no questions yet.');
        }

        // A target may name the branch of knowledge its answers are judged by (the Mock AI Interview's Merchant Navy stacks); every
        // other target is a software interview, exactly as before.
        $discipline = $target['discipline'] ?? 'software';

        $study = (bool) ($extraPracticeConfig['study'] ?? false);

        return DB::transaction(function () use ($user, $role, $stack, $setData, $extraPracticeConfig, $discipline, $study) {
            // Seed / find questions in InterviewQuestionBank
            $bankQuestions = [];
            foreach ($setData['questions'] ?? [] as $q) {
                $tags = array_values(array_unique(array_merge($setData['tags'] ?? [], [$stack['key'], $role['key']])));

                // A study question is shown WITH its model answer, and two exams can ask the same words with different answers (the Second
                // Mate and the Chief Mate "What is a Mate's Receipt?"), so the answer is part of the row's identity: one exam must never
                // overwrite, or be shown, the other's.
                $identity = ['question_text' => $q['text'], 'discipline' => $discipline];
                if ($study && ($q['note'] ?? null) !== null) {
                    $identity['notes_for_reviewer'] = $q['note'];
                }
                // A picture question is its picture too: "Which Rule applies, and what is your action?" is asked of a hundred different cards,
                // and a set must never reach for another card's row (an interview holds a bank row once).
                if (! empty($q['image'])) {
                    $identity['image'] = $q['image'];
                } elseif ($study) {
                    $identity['image'] = null;
                }

                $bankQuestion = InterviewQuestionBank::firstOrCreate(
                    $identity,
                    [
                        'category' => $q['category'] ?? InterviewQuestionBank::CATEGORY_TECHNICAL,
                        'difficulty' => $q['difficulty'] ?? 'standard',
                        'expected_duration_seconds' => $q['duration_seconds'] ?? 180,
                        'tags' => $tags,
                        'notes_for_reviewer' => $q['note'] ?? null,
                        'reference_unverified' => (bool) ($q['needs_review'] ?? false),
                        'image' => $q['image'] ?? null,
                        'is_active' => true,
                        'created_by' => $user->id,
                    ]
                );

                // The bank row is shared by every interview that asks this question, and keeps the reference answer it was first made with.
                // When staff correct that answer (a master mariner fixing a figure) the next interview must be scored against the corrected
                // one, so a changed answer is carried over; the rows already scored are not touched.
                if (! $bankQuestion->wasRecentlyCreated) {
                    $changes = [];

                    if (($q['note'] ?? null) !== null && $bankQuestion->notes_for_reviewer !== $q['note']) {
                        $changes['notes_for_reviewer'] = $q['note'];
                    }

                    if (array_key_exists('needs_review', $q) && (bool) $bankQuestion->reference_unverified !== (bool) $q['needs_review']) {
                        $changes['reference_unverified'] = (bool) $q['needs_review'];
                    }

                    if ($changes !== []) {
                        $bankQuestion->update($changes);
                    }
                }

                $bankQuestions[] = $bankQuestion;
            }

            // Create published practice interview
            $title = "{$role['title']} ({$stack['name']}) — {$setData['title']}";

            $practiceConfig = array_merge([
                'source' => 'curated_set',
                'set_id' => $setData['id'],
                'role_key' => $role['key'],
                'role_title' => $role['title'],
                'stack_key' => $stack['key'],
                'stack_name' => $stack['name'],
                'series_number' => $setData['series_number'] ?? 1,
                'set_number' => $setData['set_number'] ?? 1,
                'duration_minutes' => $setData['duration_minutes'] ?? 15,
                'question_count' => count($bankQuestions),
            ], $extraPracticeConfig);

            $interview = Interview::create([
                'title' => $title,
                'slug' => Interview::uniqueSlug($title.' '.Str::lower(Str::random(5))),
                'description' => $setData['description'] ?? '',
                'status' => Interview::STATUS_PUBLISHED,
                'interview_type' => Interview::INTERVIEW_TYPE_PRACTICE,
                'is_mock' => true,
                'created_by' => $user->id,
                'audience_scope' => Interview::AUDIENCE_SCOPE_ALL,
                'discipline' => $discipline,
                'practice_config' => $practiceConfig,
            ]);

            // Link questions with display order
            foreach ($bankQuestions as $order => $bq) {
                InterviewQuestion::create([
                    'interview_id' => $interview->id,
                    'interview_question_bank_id' => $bq->id,
                    'display_order' => $order,
                ]);
            }

            return $interview;
        });
    }
}
