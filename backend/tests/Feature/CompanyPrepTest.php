<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Company;
use App\Models\Plan;
use App\Models\Submission;
use App\Models\User;
use Database\Seeders\AccenturePlacementSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\ProblemSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesCodingActivityFixtures;
use Tests\TestCase;

class CompanyPrepTest extends TestCase
{
    use CreatesCodingActivityFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlanSeeder::class);
        $this->seed(ProblemSeeder::class);
        $this->seed(AccenturePlacementSeeder::class);
    }

    public function test_user_can_list_companies_with_prep_questions(): void
    {
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
        ]);

        $response = $this->actingAs($student)->getJson('/api/company-prep');

        $response->assertOk();
        $response->assertJsonStructure([
            'companies' => [
                '*' => [
                    'id',
                    'name',
                    'slug',
                    'logo',
                    'industry',
                    'prep_questions_count',
                    'recommended_problems_count',
                    'years',
                    'rounds',
                    'categories',
                    'has_live_drive',
                ],
            ],
        ]);

        $companies = collect($response->json('companies'));
        $accenture = $companies->firstWhere('slug', 'accenture');

        $this->assertNotNull($accenture);
        $this->assertSame('Accenture', $accenture['name']);
        $this->assertGreaterThanOrEqual(40, $accenture['prep_questions_count']);
        $this->assertContains(2025, $accenture['years']);
        $this->assertContains('Communication Assessment', $accenture['rounds']);
        $this->assertContains('Coding Assessment', $accenture['rounds']);
    }

    public function test_catalogue_breakdown_adds_up_to_the_company_totals(): void
    {
        $student = User::create([
            'name' => 'Alex Chen',
            'email' => 'alex@example.com',
            'password' => bcrypt('password'),
            'role' => User::ROLE_USER,
        ]);

        $companies = collect($this->actingAs($student)->getJson('/api/company-prep')->assertOk()->json('companies'));
        $accenture = $companies->firstWhere('slug', 'accenture');
        $breakdown = collect($accenture['breakdown']);

        $this->assertNotEmpty($breakdown);
        $this->assertSame($accenture['prep_questions_count'], $breakdown->sum('count'));
        $this->assertEqualsCanonicalizing($accenture['years'], $breakdown->pluck('year')->unique()->values()->all());
        $this->assertEqualsCanonicalizing($accenture['rounds'], $breakdown->pluck('round')->filter()->unique()->values()->all());
        $this->assertEqualsCanonicalizing($accenture['categories'], $breakdown->pluck('category')->unique()->values()->all());
    }

    public function test_breakdown_keeps_round_year_and_category_together_and_rounds_follow_the_drive_order(): void
    {
        $student = User::create([
            'name' => 'Alex Chen',
            'email' => 'alex@example.com',
            'password' => bcrypt('password'),
            'role' => User::ROLE_USER,
        ]);

        $company = Company::create(['name' => 'Combo Co', 'slug' => 'combo-co', 'industry' => 'Testing', 'is_active' => true]);

        // Authored in drive order — the later round sorts first alphabetically, so a name sort would flip them.
        $company->prepQuestions()->create(['asked_year' => 2024, 'category' => 'Technical', 'round_name' => 'Technical Round', 'question' => 'Q1', 'display_order' => 1]);
        $company->prepQuestions()->create(['asked_year' => 2024, 'category' => 'Technical', 'round_name' => 'Technical Round', 'question' => 'Q2', 'display_order' => 2]);
        $company->prepQuestions()->create(['asked_year' => 2025, 'category' => 'Aptitude', 'round_name' => 'Aptitude Round', 'question' => 'Q3', 'display_order' => 3]);
        $company->prepQuestions()->create(['asked_year' => 2025, 'category' => 'HR', 'round_name' => null, 'question' => 'Q4', 'display_order' => 4]);

        $combo = collect($this->actingAs($student)->getJson('/api/company-prep')->assertOk()->json('companies'))->firstWhere('slug', 'combo-co');

        $this->assertSame(['Technical Round', 'Aptitude Round'], $combo['rounds']);
        $this->assertSame([2025, 2024], $combo['years']);
        $this->assertEqualsCanonicalizing([
            ['round' => 'Technical Round', 'category' => 'Technical', 'year' => 2024, 'count' => 2],
            ['round' => 'Aptitude Round', 'category' => 'Aptitude', 'year' => 2025, 'count' => 1],
            ['round' => null, 'category' => 'HR', 'year' => 2025, 'count' => 1],
        ], $combo['breakdown']);
    }

    public function test_recommended_problems_map_to_real_problems_and_know_what_this_student_solved(): void
    {
        $student = User::create(['name' => 'Alex Chen', 'email' => 'alex@example.com', 'password' => bcrypt('password'), 'role' => User::ROLE_USER]);
        $other = User::create(['name' => 'Sam Roe', 'email' => 'sam@example.com', 'password' => bcrypt('password'), 'role' => User::ROLE_USER]);

        $company = Company::create(['name' => 'Map Co', 'slug' => 'map-co', 'industry' => 'Testing', 'is_active' => true]);
        $solved = $this->makeProblem('easy');
        $attempted = $this->makeProblem('medium');
        $company->recommendedProblems()->create(['problem_slug' => $solved->slug, 'topic_tag' => 'Arrays', 'priority' => 1]);
        $company->recommendedProblems()->create(['problem_slug' => $attempted->slug, 'topic_tag' => 'Strings', 'priority' => 2]);
        $company->recommendedProblems()->create(['problem_slug' => 'not-in-the-catalogue', 'topic_tag' => 'Ghost', 'priority' => 3]);

        $this->practiceSubmission($student, 'python', Submission::STATUS_ACCEPTED, $solved);
        $this->practiceSubmission($student, 'python', Submission::STATUS_WRONG_ANSWER, $attempted);
        $this->practiceSubmission($other, 'python', Submission::STATUS_ACCEPTED, $attempted); // someone else's solve must not leak in

        $rows = collect($this->actingAs($student)->getJson('/api/company-prep/map-co')->assertOk()->json('recommended_problems'))->keyBy('problem_slug');

        $this->assertSame(['title' => $solved->title, 'difficulty' => 'easy', 'available' => true, 'solved' => true], [
            'title' => $rows[$solved->slug]['title'], 'difficulty' => $rows[$solved->slug]['difficulty'], 'available' => $rows[$solved->slug]['available'], 'solved' => $rows[$solved->slug]['solved'],
        ]);
        $this->assertTrue($rows[$attempted->slug]['available']);
        $this->assertFalse($rows[$attempted->slug]['solved'], 'a wrong answer, or a different student accepted answer, is not "solved"');
        $this->assertFalse($rows['not-in-the-catalogue']['available']);
        $this->assertFalse($rows['not-in-the-catalogue']['solved']);
        $this->assertNull($rows['not-in-the-catalogue']['title']);
    }

    public function test_user_can_fetch_company_pyq_pack_by_slug(): void
    {
        $student = User::create([
            'name' => 'Alex Chen',
            'email' => 'alex@example.com',
            'password' => bcrypt('password'),
            'role' => User::ROLE_USER,
        ]);

        $response = $this->actingAs($student)->getJson('/api/company-prep/accenture');

        $response->assertOk();
        $response->assertJsonStructure([
            'company' => ['id', 'name', 'slug', 'logo', 'industry', 'hiring_process'],
            'prep_questions' => [
                '*' => ['id', 'asked_year', 'category', 'round_name', 'question', 'answer_notes'],
            ],
            'recommended_problems',
        ]);

        $data = $response->json();
        $this->assertSame('Accenture', $data['company']['name']);
        $this->assertGreaterThanOrEqual(40, count($data['prep_questions']));
    }
}

