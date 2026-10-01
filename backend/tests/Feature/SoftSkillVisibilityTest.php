<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Company;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\SoftSkillAssessment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Covers SoftSkillAssessment::isVisibleToUser() for all three assessment_types, via the /api/soft-skills index listing. */
class SoftSkillVisibilityTest extends TestCase
{
    use RefreshDatabase;

    private function college(string $shortCode = 'TST'): College
    {
        return College::create(['name' => 'Test College', 'short_code' => $shortCode]);
    }

    private function student(?College $college = null): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $college?->id]);
    }

    private function publishedAssessment(array $attributes): SoftSkillAssessment
    {
        return SoftSkillAssessment::create([
            'title' => 'Test',
            'slug' => SoftSkillAssessment::uniqueSlug('Test '.uniqid()),
            'status' => SoftSkillAssessment::STATUS_PUBLISHED,
            'duration_minutes' => 30,
            'pass_percentage' => 60,
            ...$attributes,
        ]);
    }

    public function test_a_general_assessment_is_visible_to_every_student(): void
    {
        $this->publishedAssessment(['assessment_type' => SoftSkillAssessment::TYPE_GENERAL]);

        Sanctum::actingAs($this->student());
        $this->getJson('/api/soft-skills')->assertJsonCount(1, 'assessments');

        Sanctum::actingAs($this->student($this->college()));
        $this->getJson('/api/soft-skills')->assertJsonCount(1, 'assessments');
    }

    public function test_a_tpo_mock_assessment_is_only_visible_to_its_own_college(): void
    {
        $ownCollege = $this->college('OWN');
        $otherCollege = $this->college('OTH');

        $this->publishedAssessment(['assessment_type' => SoftSkillAssessment::TYPE_TPO_MOCK, 'owning_college_id' => $ownCollege->id]);

        Sanctum::actingAs($this->student($ownCollege));
        $this->getJson('/api/soft-skills')->assertJsonCount(1, 'assessments');

        Sanctum::actingAs($this->student($otherCollege));
        $this->getJson('/api/soft-skills')->assertJsonCount(0, 'assessments');

        // A student with no college at all must never see it either.
        Sanctum::actingAs($this->student());
        $this->getJson('/api/soft-skills')->assertJsonCount(0, 'assessments');
    }

    public function test_a_company_assessment_is_visible_only_to_colleges_with_an_approved_active_drive_mapping(): void
    {
        $mappedCollege = $this->college('MAP');
        $unmappedCollege = $this->college('UNM');
        $company = Company::create(['name' => 'Nimbus Test Co', 'slug' => 'nimbus-test-'.uniqid()]);

        $drive = PlacementDrive::create([
            'company_id' => $company->id,
            'title' => 'SDE Drive',
            'role_title' => 'Software Engineer',
            'drive_date' => now()->addWeek(),
            'status' => 'published',
        ]);

        DriveCollegeMapping::create([
            'placement_drive_id' => $drive->id,
            'college_id' => $mappedCollege->id,
            'status' => DriveCollegeMapping::STATUS_APPROVED,
            'is_active' => true,
        ]);

        $this->publishedAssessment(['assessment_type' => SoftSkillAssessment::TYPE_COMPANY, 'owning_company_id' => $company->id]);

        Sanctum::actingAs($this->student($mappedCollege));
        $this->getJson('/api/soft-skills')->assertJsonCount(1, 'assessments');

        Sanctum::actingAs($this->student($unmappedCollege));
        $this->getJson('/api/soft-skills')->assertJsonCount(0, 'assessments');
    }

    public function test_a_pending_not_yet_approved_mapping_does_not_grant_visibility(): void
    {
        $college = $this->college();
        $company = Company::create(['name' => 'Nimbus Test Co', 'slug' => 'nimbus-test-'.uniqid()]);

        $drive = PlacementDrive::create([
            'company_id' => $company->id,
            'title' => 'SDE Drive',
            'role_title' => 'Software Engineer',
            'drive_date' => now()->addWeek(),
            'status' => 'published',
        ]);

        DriveCollegeMapping::create([
            'placement_drive_id' => $drive->id,
            'college_id' => $college->id,
            'status' => DriveCollegeMapping::STATUS_PENDING,
            'is_active' => false,
        ]);

        $this->publishedAssessment(['assessment_type' => SoftSkillAssessment::TYPE_COMPANY, 'owning_company_id' => $company->id]);

        Sanctum::actingAs($this->student($college));
        $this->getJson('/api/soft-skills')->assertJsonCount(0, 'assessments');
    }
}
