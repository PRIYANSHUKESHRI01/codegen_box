<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\InterviewQuestionBank;
use App\Models\InterviewRoleTemplate;
use App\Models\InterviewTrack;
use App\Models\User;
use App\Services\GeminiInterviewScoringService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * P7 of the multi-branch work: AI interviews that know which branch they are for — Mellow's core role templates, a
 * branch family carried from template to track to rounds, Gemini prompts that stop asking an ECE candidate about
 * system design, and "for your branch" first in a student's list. A software interview is untouched throughout.
 */
class CoreInterviewsTest extends TestCase
{
    use RefreshDatabase;

    private function ops(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]);
    }

    private function fakeGemini(array $items): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode($items)]]]]]], 200)]);
    }

    private function prompt(Request $request): string
    {
        return (string) ($request['contents'][0]['parts'][0]['text'] ?? '');
    }

    // ───────────────────────────── the seeded templates ─────────────────────────────

    public function test_mellow_ships_core_role_templates_for_every_core_branch_and_each_is_a_valid_template(): void
    {
        $templates = InterviewRoleTemplate::whereIn('discipline', ['ece', 'eee', 'mech', 'civil'])->whereNull('owning_college_id')->whereNull('owning_company_id')->get();

        $this->assertSame(['civil' => 3, 'ece' => 3, 'eee' => 3, 'mech' => 4], $templates->countBy('discipline')->sortKeys()->all());

        foreach ($templates as $template) {
            $this->assertCount(3, InterviewRoleTemplate::validateRoundsConfig($template->rounds_config), $template->name);
            $this->assertTrue($template->isUsableBy(User::factory()->make(['role' => User::ROLE_ADMIN_TPO, 'college_id' => 999])), 'global: usable by every college');
        }
    }

    // ───────────────────────────── carried from template to rounds ─────────────────────────────

    public function test_a_track_built_from_a_core_template_is_for_that_branch_down_to_its_rounds(): void
    {
        $template = InterviewRoleTemplate::where('name', 'like', 'VLSI%')->firstOrFail();

        $track = InterviewTrack::create([
            'title' => 'VLSI Track', 'slug' => InterviewTrack::uniqueSlug('VLSI Track'), 'status' => InterviewTrack::STATUS_DRAFT,
            'track_type' => InterviewTrack::TRACK_TYPE_GENERAL, 'role_title' => $template->name, 'interview_role_template_id' => $template->id,
        ]);
        $track->createRounds($template->rounds_config);

        $this->assertSame('ece', $track->fresh()->discipline);
        $this->assertSame(['ece', 'ece', 'ece'], $track->rounds()->pluck('discipline')->all());
        $this->assertSame('ece', $track->rounds()->first()->effectiveDiscipline());
    }

    public function test_a_general_template_makes_a_general_track(): void
    {
        $template = InterviewRoleTemplate::create(['name' => 'Backend Developer', 'rounds_config' => InterviewRoleTemplate::whereNotNull('discipline')->first()->rounds_config, 'tech_stack_tags' => ['php']]);

        $track = InterviewTrack::create([
            'title' => 'Backend Track', 'slug' => InterviewTrack::uniqueSlug('Backend Track'), 'status' => InterviewTrack::STATUS_DRAFT,
            'track_type' => InterviewTrack::TRACK_TYPE_GENERAL, 'role_title' => 'Backend Developer', 'interview_role_template_id' => $template->id,
        ]);
        $track->createRounds($template->rounds_config);

        $this->assertNull($track->fresh()->discipline);
        $this->assertNull($track->rounds()->first()->effectiveDiscipline());
    }

    public function test_an_interview_aimed_at_one_core_branch_is_known_to_be_for_it(): void
    {
        $ece = Interview::create(['title' => 'ECE Round', 'slug' => Interview::uniqueSlug('ECE Round'), 'status' => 'published', 'interview_type' => 'general', 'branch_audience' => ['disciplines' => ['ece'], 'branches' => []]]);
        $mixed = Interview::create(['title' => 'Mixed', 'slug' => Interview::uniqueSlug('Mixed'), 'status' => 'published', 'interview_type' => 'general', 'branch_audience' => ['disciplines' => ['ece', 'mech'], 'branches' => []]]);
        $cse = Interview::create(['title' => 'CSE', 'slug' => Interview::uniqueSlug('CSE'), 'status' => 'published', 'interview_type' => 'general', 'branch_audience' => ['disciplines' => ['cse'], 'branches' => []]]);
        $open = Interview::create(['title' => 'Open', 'slug' => Interview::uniqueSlug('Open'), 'status' => 'published', 'interview_type' => 'general']);

        $this->assertSame('ece', $ece->effectiveDiscipline());
        $this->assertNull($mixed->effectiveDiscipline(), 'two families: no single flavour to write for');
        $this->assertNull($cse->effectiveDiscipline(), 'CSE is the software default, not a core flavour');
        $this->assertNull($open->effectiveDiscipline());
    }

    // ───────────────────────────── Gemini ─────────────────────────────

    public function test_questions_generated_for_a_core_branch_are_written_for_it_and_saved_against_it(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        $this->fakeGemini([['question_text' => 'Why does a CMOS inverter dissipate almost no static power?', 'category' => 'technical', 'difficulty' => 'easy', 'expected_duration_seconds' => 120, 'tags' => ['cmos'], 'notes_for_reviewer' => null]]);
        Sanctum::actingAs($this->ops());

        $this->postJson('/api/interview-question-bank/generate', ['role' => 'VLSI Design Engineer', 'difficulty' => 'easy', 'categories' => ['technical'], 'count' => 1, 'discipline' => 'ece'])->assertCreated();

        Http::assertSent(function (Request $request) {
            $prompt = $this->prompt($request);

            return str_contains($prompt, 'electronics fundamentals') && ! str_contains($prompt, 'system design');
        });
        $this->assertDatabaseHas('interview_question_banks', ['question_text' => 'Why does a CMOS inverter dissipate almost no static power?', 'discipline' => 'ece']);
    }

    public function test_a_software_generation_request_is_byte_for_byte_what_it_was(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        $this->fakeGemini([['question_text' => 'How would you design a rate limiter?', 'category' => 'technical', 'difficulty' => 'medium', 'expected_duration_seconds' => 120, 'tags' => [], 'notes_for_reviewer' => null]]);
        Sanctum::actingAs($this->ops());

        $this->postJson('/api/interview-question-bank/generate', ['role' => 'Backend Engineer', 'difficulty' => 'medium', 'categories' => ['technical'], 'count' => 1])->assertCreated();

        Http::assertSent(fn (Request $request) => str_contains($this->prompt($request), '- Technical questions: favor reasoning, system design, and conceptual understanding over rote trivia lookup.'));
        $this->assertDatabaseHas('interview_question_banks', ['question_text' => 'How would you design a rate limiter?', 'discipline' => null]);
    }

    public function test_an_unknown_branch_family_is_refused(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        Sanctum::actingAs($this->ops());

        $this->postJson('/api/interview-question-bank/generate', ['role' => 'X', 'difficulty' => 'easy', 'categories' => ['technical'], 'count' => 1, 'discipline' => 'astrology'])->assertStatus(422);
    }

    public function test_answers_of_a_core_interview_are_scored_with_engineering_reasoning_in_mind(): void
    {
        config(['services.gemini.api_key' => 'test-key']);
        $this->fakeGemini([['response_id' => 1, 'score' => 70, 'feedback' => 'You explained the load path well.']]);

        $item = ['response_id' => 1, 'question_text' => 'Explain how a simply supported beam carries a load.', 'category' => 'technical', 'difficulty' => 'easy', 'notes_for_reviewer' => null, 'transcript_text' => 'The load goes to the supports.'];
        app(GeminiInterviewScoringService::class)->score([$item], 'Structural Engineer', 'civil');

        Http::assertSent(function (Request $request) {
            $prompt = $this->prompt($request);

            return str_contains($prompt, 'Civil Engineering interview') && str_contains($prompt, 'correct principles and units');
        });

        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['candidates' => [['content' => ['parts' => [['text' => json_encode([['response_id' => 1, 'score' => 70, 'feedback' => 'ok']])]]]]]], 200)]);
        app(GeminiInterviewScoringService::class)->score([$item], 'Backend Engineer');

        Http::assertSent(fn (Request $request) => ! str_contains($this->prompt($request), 'interview. For technical questions') && str_contains($this->prompt($request), 'Backend Engineer'));
    }

    // ───────────────────────────── picking questions ─────────────────────────────

    private function bankQuestion(string $text, string $category, ?string $discipline): InterviewQuestionBank
    {
        return InterviewQuestionBank::create(['question_text' => $text, 'category' => $category, 'difficulty' => 'medium', 'expected_duration_seconds' => 90, 'tags' => [], 'is_active' => true, 'discipline' => $discipline]);
    }

    public function test_picking_questions_for_a_core_branch_leaves_out_software_technical_ones(): void
    {
        // The migrations ship a starter bank for the non-engineering departments; this test counts what it adds on top.
        $shipped = InterviewQuestionBank::count();

        $this->bankQuestion('ECE technical', 'technical', 'ece');
        $this->bankQuestion('Mech technical', 'technical', 'mech');
        $this->bankQuestion('Software technical', 'technical', null);
        $this->bankQuestion('Common behavioural', 'behavioral', null);
        $this->bankQuestion('Common HR', 'hr', null);

        Sanctum::actingAs($this->ops());

        $names = collect($this->getJson('/api/interview-question-bank/browse?discipline=ece')->assertOk()->json('questions'))->pluck('question_text')->sort()->values()->all();
        $this->assertSame(['Common HR', 'Common behavioural', 'ECE technical'], $names);

        // No branch asked for: the bank is listed whole, as ever.
        $this->assertCount(5 + $shipped, $this->getJson('/api/interview-question-bank/browse')->assertOk()->json('questions'));
    }

    // ───────────────────────────── a student's list ─────────────────────────────

    public function test_a_student_sees_interviews_for_their_branch_first_and_a_cse_student_sees_the_list_unchanged(): void
    {
        $forEce = Interview::create(['title' => 'ECE Core Interview', 'slug' => Interview::uniqueSlug('ECE Core Interview'), 'status' => 'published', 'interview_type' => 'general', 'branch_audience' => ['disciplines' => ['ece'], 'branches' => []]]);
        $forEce->forceFill(['created_at' => now()->subDays(5)])->save();
        $general = Interview::create(['title' => 'General Interview', 'slug' => Interview::uniqueSlug('General Interview'), 'status' => 'published', 'interview_type' => 'general']);

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'ECE']));
        $list = $this->getJson('/api/interviews')->assertOk()->json('interviews');

        $this->assertSame(['ECE Core Interview', 'General Interview'], array_column($list, 'title'));
        $this->assertSame([true, false], array_column($list, 'for_your_branch'));

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE']));
        $list = $this->getJson('/api/interviews')->assertOk()->json('interviews');

        $this->assertSame(['General Interview'], array_column($list, 'title'), 'an ECE-only interview is not offered to CSE');
        $this->assertSame([false], array_column($list, 'for_your_branch'));
    }
}
