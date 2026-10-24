<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Company;
use App\Models\Plan;
use App\Models\User;
use Database\Seeders\AccenturePlacementSeeder;
use Database\Seeders\PlanSeeder;
use Database\Seeders\ProblemSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompanyPrepTest extends TestCase
{
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

