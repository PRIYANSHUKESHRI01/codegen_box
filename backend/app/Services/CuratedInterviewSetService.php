<?php

namespace App\Services;

use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
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
    public function __construct(private readonly PlanGate $gate) {}

    /**
     * Get the full catalog of roles, stacks, and interview question sets/series.
     *
     * @return array<string, mixed>
     */
    public function catalog(): array
    {
        $rawRoles = config('curated_interview_sets.roles', []);

        $roles = [];
        $totalStacks = 0;
        $totalSets = 0;
        $totalQuestions = 0;

        foreach ($rawRoles as $roleKey => $roleData) {
            $stacks = [];
            $roleSetsCount = 0;

            foreach ($roleData['stacks'] ?? [] as $stackKey => $stackData) {
                $seriesList = [];
                $allSets = [];

                // Format Series
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

                // Fallback if raw sets provided without series wrapper
                if (empty($seriesList) && ! empty($stackData['sets'])) {
                    foreach ($stackData['sets'] as $setData) {
                        $questionCount = count($setData['questions'] ?? []);
                        $totalQuestions += $questionCount;
                        $roleSetsCount++;
                        $totalSets++;

                        $allSets[] = [
                            'id' => $setData['id'],
                            'series_number' => $setData['series_number'] ?? 1,
                            'set_number' => $setData['set_number'] ?? 1,
                            'title' => $setData['title'],
                            'duration_minutes' => $setData['duration_minutes'] ?? 15,
                            'description' => $setData['description'] ?? '',
                            'tags' => $setData['tags'] ?? [],
                            'question_count' => $questionCount,
                            'preview_questions' => array_slice(array_column($setData['questions'] ?? [], 'text'), 0, 3),
                        ];
                    }
                }

                $totalStacks++;
                $stacks[] = [
                    'key' => $stackKey,
                    'name' => $stackData['name'],
                    'blurb' => $stackData['blurb'],
                    'icon' => $stackData['icon'] ?? 'Code2',
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
                'sets_count' => $roleSetsCount,
                'stacks' => $stacks,
            ];
        }

        return [
            'roles' => $roles,
            'stats' => [
                'total_roles' => count($roles),
                'total_stacks' => $totalStacks,
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
        $rawRoles = config('curated_interview_sets.roles', []);

        foreach ($rawRoles as $roleKey => $roleData) {
            foreach ($roleData['stacks'] ?? [] as $stackKey => $stackData) {
                // Search in series
                foreach ($stackData['series'] ?? [] as $sData) {
                    foreach ($sData['sets'] ?? [] as $setData) {
                        if ($setData['id'] === $setId) {
                            return [
                                'role' => [
                                    'key' => $roleKey,
                                    'title' => $roleData['title'],
                                    'color' => $roleData['color'] ?? 'indigo',
                                ],
                                'stack' => [
                                    'key' => $stackKey,
                                    'name' => $stackData['name'],
                                ],
                                'set' => $setData,
                            ];
                        }
                    }
                }

                // Search in flat sets
                foreach ($stackData['sets'] ?? [] as $setData) {
                    if ($setData['id'] === $setId) {
                        return [
                            'role' => [
                                'key' => $roleKey,
                                'title' => $roleData['title'],
                                'color' => $roleData['color'] ?? 'indigo',
                            ],
                            'stack' => [
                                'key' => $stackKey,
                                'name' => $stackData['name'],
                            ],
                            'set' => $setData,
                        ];
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
        foreach (config('curated_interview_sets.roles', []) as $roleKey => $roleData) {
            if (isset($roleData['stacks'][$stackKey])) {
                return (string) $roleKey;
            }
        }

        return null;
    }

    /**
     * Find a set by stack, series number, and set number.
     *
     * @return array{role: array, stack: array, set: array}|null
     */
    public function findSetBySeries(string $stackKey, int $seriesNumber, int $setNumber): ?array
    {
        $rawRoles = config('curated_interview_sets.roles', []);

        foreach ($rawRoles as $roleKey => $roleData) {
            foreach ($roleData['stacks'] ?? [] as $curStackKey => $stackData) {
                if ($curStackKey !== $stackKey) {
                    continue;
                }

                foreach ($stackData['series'] ?? [] as $sData) {
                    if ((int) ($sData['series_number'] ?? 0) !== $seriesNumber) {
                        continue;
                    }

                    foreach ($sData['sets'] ?? [] as $setData) {
                        if ((int) ($setData['set_number'] ?? 0) === $setNumber) {
                            return [
                                'role' => [
                                    'key' => $roleKey,
                                    'title' => $roleData['title'],
                                    'color' => $roleData['color'] ?? 'indigo',
                                ],
                                'stack' => [
                                    'key' => $stackKey,
                                    'name' => $stackData['name'],
                                ],
                                'set' => $setData,
                            ];
                        }
                    }
                }
            }
        }

        return null;
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

        return DB::transaction(function () use ($user, $role, $stack, $setData, $extraPracticeConfig) {
            // Seed / find questions in InterviewQuestionBank
            $bankQuestions = [];
            foreach ($setData['questions'] ?? [] as $q) {
                $tags = array_values(array_unique(array_merge($setData['tags'] ?? [], [$stack['key'], $role['key']])));

                $bankQuestion = InterviewQuestionBank::firstOrCreate(
                    [
                        'question_text' => $q['text'],
                        'discipline' => 'software',
                    ],
                    [
                        'category' => $q['category'] ?? InterviewQuestionBank::CATEGORY_TECHNICAL,
                        'difficulty' => $q['difficulty'] ?? 'standard',
                        'expected_duration_seconds' => $q['duration_seconds'] ?? 180,
                        'tags' => $tags,
                        'notes_for_reviewer' => $q['note'] ?? null,
                        'is_active' => true,
                        'created_by' => $user->id,
                    ]
                );

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
                'discipline' => 'software',
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
