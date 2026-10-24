<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewProctoringSession;
use App\Models\InterviewQuestionBank;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\GeminiQuestionGeneratorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Practice interviews: a student builds their own AI mock interview for a branch role and takes it through the ordinary
 * interview flow. Covers what the studio offers, how questions are picked and ordered, privacy, plan limits and the AI top-up.
 */
class PracticeInterviewTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    private function student(string $branch = 'ECE', array $over = []): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'branch' => $branch] + $over);
    }

    /** One bank question. */
    private function q(string $category, string $difficulty, ?string $discipline, array $tags = [], array $over = []): InterviewQuestionBank
    {
        $n = ++$this->seq;

        return InterviewQuestionBank::create($over + [
            'question_text' => "Question number {$n} about something {$category} {$difficulty}?", 'category' => $category, 'difficulty' => $difficulty,
            'expected_duration_seconds' => 90, 'tags' => $tags, 'notes_for_reviewer' => 'A strong answer covers the basics and one example.', 'discipline' => $discipline, 'is_active' => true,
        ]);
    }

    /** A bank deep enough for ECE embedded, plus general people questions and a few software ones. */
    private function seedBank(): void
    {
        foreach (['easy', 'medium', 'hard'] as $d) {
            for ($i = 0; $i < 6; $i++) {
                $this->q('technical', $d, 'ece', ['embedded']);
            }
        }
        for ($i = 0; $i < 6; $i++) {
            $this->q('technical', 'medium', 'ece', ['vlsi']);
        }
        for ($i = 0; $i < 4; $i++) {
            $this->q('situational', 'medium', 'ece');
            $this->q('behavioral', 'medium', null);
            $this->q('hr', 'easy', null);
        }
        for ($i = 0; $i < 6; $i++) {
            $this->q('technical', 'medium', null);   // software
        }
    }

    private function build(User $student, array $over = [])
    {
        Sanctum::actingAs($student);

        return $this->postJson('/api/me/practice-interviews', $over + ['role' => 'ece_embedded', 'kind' => 'technical', 'count' => 8, 'difficulty' => 'mixed']);
    }

    // ───────────────────────────── the studio ─────────────────────────────

    public function test_an_ece_student_is_offered_their_branch_roles_first_then_the_it_roles(): void
    {
        $this->seedBank();
        Sanctum::actingAs($this->student('ECE', ['core_interests' => ['embedded']]));

        $res = $this->getJson('/api/me/practice-interviews/options')->assertOk();

        $this->assertSame(['ece', 'software'], array_column($res->json('groups'), 'key'));
        $this->assertTrue($res->json('groups.0.is_your_branch'));
        $this->assertSame('ece_embedded', $res->json('defaults.role'));        // their interest decides the default
        $embedded = collect($res->json('groups.0.roles'))->firstWhere('key', 'ece_embedded');
        $this->assertTrue($embedded['recommended']);
        $this->assertSame(18, $embedded['questions_available']);               // only embedded-tagged technical questions of this branch
        $this->assertSame([5, 8, 10], $res->json('counts'));
    }

    public function test_a_student_who_leads_with_it_roles_sees_them_first(): void
    {
        Sanctum::actingAs($this->student('Mechanical', ['track_focus' => 'it_first']));

        $this->assertSame(['software', 'mech'], array_column($this->getJson('/api/me/practice-interviews/options')->json('groups'), 'key'));
    }

    public function test_a_cse_student_sees_only_the_software_roles(): void
    {
        Sanctum::actingAs($this->student('CSE'));

        $res = $this->getJson('/api/me/practice-interviews/options')->assertOk();

        $this->assertSame(['software'], array_column($res->json('groups'), 'key'));
    }

    public function test_only_students_may_use_the_studio(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO]));

        $this->getJson('/api/me/practice-interviews/options')->assertForbidden();
        $this->postJson('/api/me/practice-interviews', ['role' => 'ece_embedded', 'kind' => 'technical', 'count' => 8, 'difficulty' => 'mixed'])->assertForbidden();
    }

    // ───────────────────────────── building one ─────────────────────────────

    public function test_building_one_makes_a_private_published_mock_interview_in_the_right_order(): void
    {
        $this->seedBank();
        $student = $this->student();

        $res = $this->build($student, ['kind' => 'full', 'count' => 10])->assertCreated();
        $slug = $res->json('interview.slug');

        $interview = Interview::where('slug', $slug)->firstOrFail();
        $this->assertSame(Interview::INTERVIEW_TYPE_PRACTICE, $interview->interview_type);
        $this->assertTrue($interview->is_mock);
        $this->assertSame(Interview::STATUS_PUBLISHED, $interview->status);
        $this->assertSame('ece', $interview->discipline);                     // so the generator and scorer treat it as an ECE interview
        $this->assertSame($student->id, $interview->created_by);
        $this->assertSame(10, $res->json('interview.question_count'));

        $categories = $interview->interviewQuestions()->orderBy('display_order')->with('questionBank')->get()->pluck('questionBank.category')->all();
        $order = ['technical' => 0, 'situational' => 2, 'behavioral' => 3, 'hr' => 4];
        $this->assertSame($categories, collect($categories)->sortBy(fn ($c) => $order[$c])->values()->all(), 'technical first, then a scenario, then project and HR');
        $this->assertGreaterThan(count(array_filter($categories, fn ($c) => $c === 'hr')), count(array_filter($categories, fn ($c) => $c === 'technical')));
        $this->assertSame(['mix' => true], ['mix' => in_array('behavioral', $categories, true) && in_array('hr', $categories, true)]);
    }

    public function test_the_pick_favours_the_role_and_never_leaks_other_branches_or_software(): void
    {
        $this->seedBank();

        $res = $this->build($this->student(), ['count' => 5, 'kind' => 'technical'])->assertCreated();

        $questions = Interview::where('slug', $res->json('interview.slug'))->firstOrFail()->interviewQuestions()->with('questionBank')->get()->pluck('questionBank');
        $technical = $questions->where('category', 'technical');
        $this->assertTrue($technical->every(fn ($q) => $q->discipline === 'ece'), 'an ECE round never gets a software question');
        $this->assertTrue($technical->every(fn ($q) => in_array('embedded', $q->tags, true)), 'embedded role: embedded questions come first when there are enough');
    }

    public function test_a_software_roles_round_uses_only_general_questions(): void
    {
        $this->seedBank();

        $res = $this->build($this->student('CSE'), ['role' => 'sw_fresher', 'kind' => 'technical', 'count' => 5])->assertCreated();

        $technical = Interview::where('slug', $res->json('interview.slug'))->firstOrFail()->interviewQuestions()->with('questionBank')->get()->pluck('questionBank')->where('category', 'technical');
        $this->assertTrue($technical->every(fn ($q) => $q->discipline === null));
    }

    public function test_questions_the_student_has_already_answered_are_avoided(): void
    {
        $this->seedBank();
        $student = $this->student();

        $first = Interview::where('slug', $this->build($student, ['count' => 5, 'kind' => 'technical'])->json('interview.slug'))->firstOrFail();
        $session = InterviewSession::create(['interview_id' => $first->id, 'user_id' => $student->id, 'status' => InterviewSession::STATUS_COMPLETED, 'started_at' => now(), 'completed_at' => now(), 'current_question_order' => 5]);
        foreach ($first->interviewQuestions as $iq) {
            InterviewResponse::create(['interview_session_id' => $session->id, 'interview_question_id' => $iq->id, 'transcript_text' => 'an answer', 'answered_at' => now()]);
        }
        $answered = $first->interviewQuestions->pluck('interview_question_bank_id')->all();

        $second = Interview::where('slug', $this->build($student, ['count' => 5, 'kind' => 'technical'])->json('interview.slug'))->firstOrFail();

        $this->assertSame([], array_intersect($answered, $second->interviewQuestions->pluck('interview_question_bank_id')->all()), 'a second round gives fresh questions while the bank has them');
    }

    public function test_it_is_private_to_the_student_and_invisible_to_staff_lists(): void
    {
        $this->seedBank();
        $mine = $this->student();
        $slug = $this->build($mine)->json('interview.slug');

        // Their own list and page see it…
        Sanctum::actingAs($mine);
        $this->assertContains($slug, array_column($this->getJson('/api/interviews')->json('interviews'), 'slug'));
        $this->getJson("/api/interviews/{$slug}")->assertOk();

        // …another student, even in the same college, does not.
        Sanctum::actingAs($this->student('ECE', ['college_id' => $mine->college_id]));
        $this->assertNotContains($slug, array_column($this->getJson('/api/interviews')->json('interviews'), 'slug'));
        $this->getJson("/api/interviews/{$slug}")->assertNotFound();
        $this->postJson("/api/interviews/{$slug}/start")->assertNotFound();

        // Mellow Ops never sees it, nor counts it.
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_INTERVIEWS]]));
        $this->assertNotContains($slug, array_column($this->getJson('/api/admin/interviews')->json('interviews'), 'slug'));
    }

    public function test_it_is_taken_through_the_normal_interview_flow(): void
    {
        $this->seedBank();
        $student = $this->student();
        $slug = $this->build($student, ['count' => 5])->json('interview.slug');

        Sanctum::actingAs($student);
        $this->postJson("/api/interviews/{$slug}/start")->assertOk();

        $this->assertSame(1, InterviewSession::where('user_id', $student->id)->count());
    }

    public function test_a_locked_practice_round_tells_the_student_to_build_another_not_to_ask_an_inviter(): void
    {
        $this->seedBank();
        $student = $this->student();
        $slug = $this->build($student, ['count' => 5])->json('interview.slug');
        Sanctum::actingAs($student);
        $this->postJson("/api/interviews/{$slug}/start")->assertOk();

        InterviewProctoringSession::create(['interview_session_id' => InterviewSession::where('user_id', $student->id)->value('id'), 'status' => 'locked', 'violation_count' => 3, 'locked_at' => now(), 'consented_at' => now()]);

        $message = $this->postJson("/api/interviews/{$slug}/start")->assertForbidden()->json('message');
        $this->assertStringContainsString('Build a new one', $message);
        $this->assertStringNotContainsString('invited', $message);
    }

    // ───────────────────────────── refusals and limits ─────────────────────────────

    public function test_a_bad_pick_is_refused(): void
    {
        $this->seedBank();
        $student = $this->student();

        $this->build($student, ['role' => 'not_a_role'])->assertStatus(422)->assertJsonValidationErrors('role');
        $this->build($student, ['role' => 'mech_design'])->assertStatus(422)->assertJsonValidationErrors('role');   // not their branch's roles
        $this->build($student, ['kind' => 'nope'])->assertStatus(422)->assertJsonValidationErrors('kind');
        $this->build($student, ['count' => 7])->assertStatus(422)->assertJsonValidationErrors('count');
        $this->build($student, ['difficulty' => 'brutal'])->assertStatus(422)->assertJsonValidationErrors('difficulty');
    }

    public function test_a_role_whose_bank_is_still_empty_says_so_instead_of_building_a_hollow_interview(): void
    {
        // No questions at all for ECE.
        $this->build($this->student())->assertStatus(422)->assertJsonValidationErrors('role');

        $this->assertSame(0, Interview::where('interview_type', Interview::INTERVIEW_TYPE_PRACTICE)->count());
    }

    public function test_the_free_plans_one_practice_interview_is_enforced_at_creation(): void
    {
        $this->seedBank();
        Plan::create(['code' => 'coder', 'name' => 'Coder', 'audience' => Plan::AUDIENCE_INDIVIDUAL, 'list_price' => 0, 'duration_days' => null, 'is_active' => true, 'sort_order' => 1, 'feature_trial_uses' => 1]);
        $student = $this->student();

        // The one free try is used up by a practice interview they already took.
        $used = Interview::create(['title' => 'Old mock', 'slug' => 'old-mock', 'status' => 'published', 'interview_type' => 'general', 'is_mock' => true]);
        InterviewSession::create(['interview_id' => $used->id, 'user_id' => $student->id, 'status' => InterviewSession::STATUS_COMPLETED, 'started_at' => now(), 'current_question_order' => 0]);

        $this->build($student)->assertStatus(402);
        $this->assertSame(0, Interview::where('interview_type', Interview::INTERVIEW_TYPE_PRACTICE)->count());
    }

    public function test_the_daily_creation_cap_stops_a_student_hoarding_interviews(): void
    {
        $this->seedBank();
        config(['practice_interviews.limits.created_per_day' => 2]);
        $student = $this->student();

        $this->build($student, ['count' => 5])->assertCreated();
        $this->build($student, ['count' => 5])->assertCreated();
        $this->build($student, ['count' => 5])->assertStatus(429);
    }

    // ───────────────────────────── AI top-up ─────────────────────────────

    public function test_a_short_bank_is_topped_up_by_the_ai_and_the_questions_are_kept(): void
    {
        // Only two embedded questions exist: not enough for a 5-question technical round.
        $this->q('technical', 'medium', 'ece', ['embedded']);
        $this->q('technical', 'medium', 'ece', ['embedded']);

        $this->app->instance(GeminiQuestionGeneratorService::class, new class extends GeminiQuestionGeneratorService
        {
            public function generate(string $role, string $difficulty, array $categories, int $count, ?string $skills, array $avoidQuestionTexts = [], ?string $discipline = null): array
            {
                return collect(range(1, $count))->map(fn ($i) => [
                    'question_text' => "AI written question {$i} about {$role}?", 'category' => 'technical', 'difficulty' => 'medium',
                    'expected_duration_seconds' => 90, 'tags' => ['generated'], 'notes_for_reviewer' => 'Covers the basics.',
                ])->all();
            }
        });

        $res = $this->build($this->student(), ['count' => 5, 'kind' => 'technical'])->assertCreated();

        $this->assertGreaterThanOrEqual(4, $res->json('interview.question_count'));
        $this->assertTrue(InterviewQuestionBank::where('question_text', 'like', 'AI written question%')->get()->every(
            fn ($q) => $q->discipline === 'ece' && in_array('ai-generated', $q->tags, true) && in_array('embedded', $q->tags, true)
        ), 'kept in the bank, against the branch, tagged for review, and matched to the role');
    }

    public function test_when_the_ai_is_unavailable_the_interview_is_built_from_what_exists(): void
    {
        for ($i = 0; $i < 4; $i++) {
            $this->q('technical', 'medium', 'ece', ['embedded']);
        }
        config(['services.gemini.api_key' => null]);

        $this->build($this->student(), ['count' => 8, 'kind' => 'technical'])->assertCreated()->assertJsonPath('interview.question_count', 4);
    }

    // ───────────────────────────── housekeeping ─────────────────────────────

    public function test_unused_practice_interviews_are_pruned_but_history_is_kept(): void
    {
        $this->seedBank();
        $student = $this->student();

        $unused = Interview::where('slug', $this->build($student, ['count' => 5])->json('interview.slug'))->firstOrFail();
        $taken = Interview::where('slug', $this->build($student, ['count' => 5])->json('interview.slug'))->firstOrFail();
        $fresh = Interview::where('slug', $this->build($student, ['count' => 5])->json('interview.slug'))->firstOrFail();
        InterviewSession::create(['interview_id' => $taken->id, 'user_id' => $student->id, 'status' => InterviewSession::STATUS_IN_PROGRESS, 'started_at' => now(), 'current_question_order' => 0]);
        Interview::whereIn('id', [$unused->id, $taken->id])->update(['created_at' => now()->subDays(30)]);

        $this->artisan('interview:prune-practice')->assertSuccessful();

        $this->assertNull(Interview::find($unused->id), 'old and never taken: removed');
        $this->assertNotNull(Interview::find($taken->id), 'old but taken: kept as history');
        $this->assertNotNull(Interview::find($fresh->id), 'recent: kept');
        $this->assertSame(0, InterviewQuestion::where('interview_id', $unused->id)->count());
    }

    public function test_the_bank_import_command_checks_then_loads_and_is_idempotent(): void
    {
        $dir = sys_get_temp_dir().'/ib-'.uniqid();
        mkdir($dir);
        file_put_contents("{$dir}/ece.json", json_encode([
            ['question_text' => 'Explain how a pull-up resistor works on a digital input.', 'category' => 'technical', 'difficulty' => 'easy', 'expected_duration_seconds' => 90, 'tags' => ['embedded'], 'notes_for_reviewer' => 'Defines a default level.', 'discipline' => 'ece'],
        ]));

        // The migrations ship a starter bank for the non-engineering departments; the command adds to whatever is there.
        $before = InterviewQuestionBank::count();

        $this->artisan('interview:import-bank', ['path' => $dir, '--dry-run' => true])->assertSuccessful();
        $this->assertSame($before, InterviewQuestionBank::count());

        $this->artisan('interview:import-bank', ['path' => $dir])->assertSuccessful();
        $this->artisan('interview:import-bank', ['path' => $dir])->assertSuccessful();
        $this->assertSame($before + 1, InterviewQuestionBank::count(), 'running it again updates in place');

        file_put_contents("{$dir}/bad.json", json_encode([['question_text' => 'short', 'category' => 'nope', 'difficulty' => 'easy', 'expected_duration_seconds' => 90]]));
        $this->artisan('interview:import-bank', ['path' => "{$dir}/bad.json"])->assertFailed();
    }
}
