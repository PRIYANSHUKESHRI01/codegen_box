<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Company;
use App\Models\InterviewRoleTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers AdminInterviewRoleTemplateController/TpoInterviewRoleTemplateController/
 * CompanyInterviewRoleTemplateController and InterviewRoleTemplate::validateRoundsConfig().
 */
class InterviewRoleTemplateTest extends TestCase
{
    use RefreshDatabase;

    private function validRoundsConfig(): array
    {
        return [
            ['round_number' => 1, 'round_name' => 'Screening', 'question_count' => 10, 'difficulty' => 'medium', 'category_weights' => ['technical' => 60, 'aptitude' => 40], 'qualifying_score_percent' => 60],
            ['round_number' => 2, 'round_name' => 'Deep Technical', 'question_count' => 8, 'difficulty' => 'hard', 'category_weights' => ['technical' => 100], 'qualifying_score_percent' => 65],
            ['round_number' => 3, 'round_name' => 'Final / HR', 'question_count' => 6, 'difficulty' => 'medium', 'category_weights' => ['behavioral' => 50, 'hr' => 50], 'qualifying_score_percent' => 60],
        ];
    }

    public function test_ops_creates_a_global_template_with_valid_rounds(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_INTERVIEWS]]));

        $response = $this->postJson('/api/admin/interview-role-templates', [
            'name' => 'Backend Developer — Laravel & Next.js',
            'tech_stack_tags' => ['laravel', 'nextjs'],
            'rounds_config' => $this->validRoundsConfig(),
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('interview_role_templates', [
            'name' => 'Backend Developer — Laravel & Next.js',
            'owning_college_id' => null,
            'owning_company_id' => null,
        ]);
    }

    public function test_unbalanced_category_weights_rejected(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_INTERVIEWS]]));

        $roundsConfig = $this->validRoundsConfig();
        $roundsConfig[0]['category_weights'] = ['technical' => 60, 'aptitude' => 30]; // sums to 90, not 100

        $response = $this->postJson('/api/admin/interview-role-templates', [
            'name' => 'Bad Template',
            'rounds_config' => $roundsConfig,
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors(['rounds_config']);
        $this->assertSame(0, InterviewRoleTemplate::count());
    }

    public function test_tpo_creates_college_private_template_invisible_to_other_college(): void
    {
        $collegeA = College::create(['name' => 'College A', 'short_code' => 'CA']);
        $collegeB = College::create(['name' => 'College B', 'short_code' => 'CB']);
        $tpoA = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $collegeA->id]);
        $tpoB = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $collegeB->id]);

        Sanctum::actingAs($tpoA);
        $this->postJson('/api/tpo/interview-role-templates', [
            'name' => 'College A Mock Role',
            'rounds_config' => $this->validRoundsConfig(),
        ])->assertStatus(201);

        Sanctum::actingAs($tpoB);
        $response = $this->getJson('/api/tpo/interview-role-templates');
        $response->assertStatus(200);
        $names = collect($response->json('templates'))->pluck('name');
        $this->assertFalse($names->contains('College A Mock Role'), 'college B must not see college A\'s private template');
    }

    public function test_ops_index_sees_everything_tpo_index_sees_global_and_own_college_only(): void
    {
        $college = College::create(['name' => 'College C', 'short_code' => 'CC']);
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
        $company = Company::create(['name' => 'Acme', 'slug' => 'acme-'.uniqid()]);
        $companyUser = User::factory()->create(['role' => User::ROLE_ADMIN_COMPANY, 'company_id' => $company->id]);
        $ops = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_INTERVIEWS]]);

        InterviewRoleTemplate::create(['name' => 'Global Template', 'rounds_config' => $this->validRoundsConfig(), 'created_by' => $ops->id]);
        InterviewRoleTemplate::create(['name' => 'College Private', 'rounds_config' => $this->validRoundsConfig(), 'owning_college_id' => $college->id, 'created_by' => $tpo->id]);
        InterviewRoleTemplate::create(['name' => 'Company Private', 'rounds_config' => $this->validRoundsConfig(), 'owning_company_id' => $company->id, 'created_by' => $companyUser->id]);

        Sanctum::actingAs($ops);
        $opsNames = collect($this->getJson('/api/admin/interview-role-templates')->json('templates'))->pluck('name');
        $this->assertCount(3, $opsNames, 'Ops oversight must see every template');

        Sanctum::actingAs($tpo);
        $tpoNames = collect($this->getJson('/api/tpo/interview-role-templates')->json('templates'))->pluck('name');
        $this->assertTrue($tpoNames->contains('Global Template'));
        $this->assertTrue($tpoNames->contains('College Private'));
        $this->assertFalse($tpoNames->contains('Company Private'));
    }
}
