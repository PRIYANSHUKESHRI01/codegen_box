<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CuratedInterviewSetTest extends TestCase
{
    use RefreshDatabase;

    private function student(array $over = []): User
    {
        return User::factory()->create(array_merge([
            'role' => User::ROLE_USER,
            'branch' => 'CSE',
        ], $over));
    }

    public function test_student_can_fetch_curated_interview_sets_catalog(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $response = $this->getJson('/api/curated-interview-sets')
            ->assertOk()
            ->assertJsonStructure([
                'roles' => [
                    '*' => [
                        'key',
                        'title',
                        'blurb',
                        'icon',
                        'badge',
                        'color',
                        'stacks_count',
                        'sets_count',
                        'stacks' => [
                            '*' => [
                                'key',
                                'name',
                                'blurb',
                                'icon',
                                'series_count',
                                'sets_count',
                                'sets' => [
                                    '*' => [
                                        'id',
                                        'series_number',
                                        'set_number',
                                        'title',
                                        'duration_minutes',
                                        'description',
                                        'tags',
                                        'question_count',
                                        'preview_questions',
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
                'stats' => [
                    'total_roles',
                    'total_stacks',
                    'total_sets',
                    'total_questions',
                ],
            ]);

        $roles = $response->json('roles');
        $this->assertNotEmpty($roles);

        $backendRole = collect($roles)->firstWhere('key', 'backend');
        $this->assertNotNull($backendRole);
        $this->assertEquals('Backend Developer', $backendRole['title']);

        $laravelStack = collect($backendRole['stacks'])->firstWhere('key', 'laravel');
        $this->assertNotNull($laravelStack);
        // Three series of three sets each.
        $this->assertSame(3, $laravelStack['series_count']);
        $this->assertCount(9, $laravelStack['sets']);
        $this->assertSame(['backend-laravel-series-1', 'backend-laravel-series-2', 'backend-laravel-series-3'], array_column($laravelStack['series'], 'id'));
    }

    public function test_student_can_fetch_single_curated_set_details(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $response = $this->getJson('/api/curated-interview-sets/backend-laravel-s1-set1')
            ->assertOk()
            ->assertJsonStructure([
                'role' => ['key', 'title', 'color'],
                'stack' => ['key', 'name'],
                'set' => [
                    'id',
                    'series_number',
                    'set_number',
                    'title',
                    'duration_minutes',
                    'description',
                    'tags',
                    'questions',
                ],
            ]);

        $this->assertEquals('backend-laravel-s1-set1', $response->json('set.id'));
        $this->assertEquals(1, $response->json('set.series_number'));
        $this->assertEquals(1, $response->json('set.set_number'));
        $this->assertNotEmpty($response->json('set.questions'));
    }

    public function test_student_can_start_curated_ai_interview_set(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $response = $this->postJson('/api/curated-interview-sets/backend-laravel-s1-set1/start')
            ->assertCreated()
            ->assertJsonStructure([
                'interview' => [
                    'id',
                    'slug',
                    'title',
                    'question_count',
                ],
            ]);

        $interviewId = $response->json('interview.id');
        $interview = Interview::find($interviewId);

        $this->assertNotNull($interview);
        $this->assertEquals(Interview::INTERVIEW_TYPE_PRACTICE, $interview->interview_type);
        $this->assertTrue($interview->is_mock);
        $this->assertEquals($student->id, $interview->created_by);
        $this->assertStringContainsString('Laravel', $interview->title);

        // Check questions linked
        $linkedQuestions = InterviewQuestion::where('interview_id', $interview->id)->get();
        $this->assertCount(5, $linkedQuestions);

        // Check seeded in bank
        $bankQuestions = InterviewQuestionBank::whereIn('id', $linkedQuestions->pluck('interview_question_bank_id'))->get();
        $this->assertCount(5, $bankQuestions);
        foreach ($bankQuestions as $bq) {
            $this->assertContains('laravel', $bq->tags);
            $this->assertEquals('software', $bq->discipline);
        }
    }

    public function test_non_student_cannot_access_curated_sets(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
        Sanctum::actingAs($admin);

        $this->getJson('/api/curated-interview-sets')->assertForbidden();
        $this->postJson('/api/curated-interview-sets/backend-laravel-s1-set1/start')->assertForbidden();
    }
}

