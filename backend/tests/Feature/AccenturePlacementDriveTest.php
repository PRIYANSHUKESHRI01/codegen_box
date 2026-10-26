<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Company;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\Plan;
use App\Models\Problem;
use App\Models\User;
use App\Services\SubscriptionService;
use Database\Seeders\AccenturePlacementSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\ProblemSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccenturePlacementDriveTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
    }

    public function test_accenture_company_and_drive_are_seeded_with_authentic_data(): void
    {
        $this->seed(AccenturePlacementSeeder::class);

        $accenture = Company::where('slug', 'accenture')->first();
        $this->assertNotNull($accenture);
        $this->assertSame('Accenture', $accenture->name);
        $this->assertSame('🟣', $accenture->logo);
        $this->assertSame('Technology Consulting & Services', $accenture->industry);
        $this->assertNotEmpty($accenture->overview);

        $hiringProcess = $accenture->hiring_process;
        $this->assertCount(4, $hiringProcess);
        $this->assertSame('Cognitive & Technical Assessment', $hiringProcess[0]['name']);
        $this->assertSame('Coding Assessment', $hiringProcess[1]['name']);
        $this->assertSame('Communication Assessment', $hiringProcess[2]['name']);
        $this->assertSame('Technical & Soft Skills Interview', $hiringProcess[3]['name']);

        $drive = PlacementDrive::where('company_id', $accenture->id)->first();
        $this->assertNotNull($drive);
        $this->assertSame('Associate Software Engineer / AASE', $drive->role_title);
        $this->assertSame('₹4.5 - 6.5 LPA', $drive->ctc_range);
        $this->assertSame(PlacementDrive::STATUS_PUBLISHED, $drive->status);
    }

    public function test_accenture_previous_year_questions_span_five_years_and_all_rounds(): void
    {
        $this->seed(AccenturePlacementSeeder::class);

        $accenture = Company::where('slug', 'accenture')->firstOrFail();
        $prepQuestions = $accenture->prepQuestions()->get();

        $this->assertGreaterThanOrEqual(40, $prepQuestions->count());

        $years = $prepQuestions->pluck('asked_year')->unique()->sort()->values()->all();
        $this->assertSame([2021, 2022, 2023, 2024, 2025], $years);

        $rounds = $prepQuestions->pluck('round_name')->unique()->values()->all();
        $this->assertContains('Communication Assessment', $rounds);
        $this->assertContains('Soft Skills & HR Round', $rounds);
        $this->assertContains('Coding Assessment', $rounds);
        $this->assertContains('Technical Assessment & Pseudocode', $rounds);

        foreach ($prepQuestions as $q) {
            $this->assertNotEmpty($q->question);
            $this->assertNotEmpty($q->answer_notes);
            $this->assertContains($q->category, ['Aptitude', 'Coding', 'Technical', 'HR', 'Behavioral']);
        }
    }

    public function test_student_with_drive_access_can_fetch_accenture_drive_prep_pack(): void
    {
        $this->seed(ProblemSeeder::class);

        $apex = College::create([
            'short_code' => 'APEX',
            'name' => 'Apex Institute',
            'tier' => 'Academic Enterprise',
        ]);

        $student = User::create([
            'name' => 'Alex Chen',
            'email' => 'alex@example.com',
            'password' => bcrypt('password'),
            'role' => User::ROLE_USER,
            'college_id' => $apex->id,
            'cgpa' => 8.5,
            'backlog_count' => 0,
            'branch' => 'CSE',
        ]);

        // Drive access is an Expert feature. A new student already holds a Coder subscription, and the newest base
        // subscription wins, so the plan is granted the way the product does it rather than back-dating a second row.
        $expertPlan = Plan::where('code', 'expert')->firstOrFail();
        app(SubscriptionService::class)->grantIndividualPlan(
            $student,
            $expertPlan,
            User::factory()->create(['role' => User::ROLE_SUPERADMIN]),
            ['days' => (int) $expertPlan->duration_days, 'kind' => 'complimentary', 'reason' => 'Test: drive access'],
        );

        $this->seed(AccenturePlacementSeeder::class);

        $accenture = Company::where('slug', 'accenture')->firstOrFail();
        $drive = PlacementDrive::where('company_id', $accenture->id)->firstOrFail();

        DriveCollegeMapping::updateOrCreate(
            ['placement_drive_id' => $drive->id, 'college_id' => $apex->id],
            ['mapped_at' => now(), 'is_active' => true]
        );

        $response = $this->actingAs($student)->getJson("/api/drives/{$drive->id}");

        $response->assertOk();
        $response->assertJsonStructure([
            'drive' => ['id', 'title', 'role_title', 'ctc_range', 'status'],
            'company' => ['id', 'name', 'slug', 'overview', 'hiring_process'],
            'prep_questions' => [
                '*' => ['id', 'asked_year', 'category', 'round_name', 'question', 'answer_notes'],
            ],
            'recommended_problems' => [
                '*' => ['problem_slug', 'topic_tag', 'priority', 'title', 'available'],
            ],
        ]);

        $data = $response->json();
        $this->assertSame('Accenture', $data['company']['name']);
        $this->assertGreaterThanOrEqual(40, count($data['prep_questions']));
    }

    public function test_master_accenture_question_sets_seeder_runs_all_round_seeders(): void
    {
        // The mock interview is authored by Mellow's superadmin (the full DatabaseSeeder creates one first); without
        // an author the interview seeder deliberately creates nothing.
        User::factory()->create(['role' => User::ROLE_SUPERADMIN]);

        $this->seed(\Database\Seeders\AccentureQuestionSetsSeeder::class);

        // 1. Placement catalog
        $accenture = Company::where('slug', 'accenture')->firstOrFail();
        $this->assertGreaterThanOrEqual(40, $accenture->prepQuestions()->count());

        // 2. Soft Skills & Cognitive Assessment
        $softAssessment = \App\Models\SoftSkillAssessment::where('slug', 'accenture-campus-recruitment-cognitive-soft-skills-set-1')->first();
        $this->assertNotNull($softAssessment);
        $this->assertSame(25, $softAssessment->assessmentQuestions()->count());
        $this->assertTrue($softAssessment->is_question_set);

        // 3. Communication Assessment (Speaking prompts)
        $prompts = \App\Models\SpeakingPrompt::where('title', 'like', 'Accenture%')->get();
        $this->assertGreaterThanOrEqual(6, $prompts->count());

        // 4. Interview Question Bank & Mock Interview
        $interview = \App\Models\Interview::where('slug', 'accenture-ase-technical-hr-mock-interview')->first();
        $this->assertNotNull($interview);
        $this->assertSame(10, $interview->interviewQuestions()->count());
    }
}

