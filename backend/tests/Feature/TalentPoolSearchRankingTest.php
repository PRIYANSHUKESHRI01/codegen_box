<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\TalentPoolCandidate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers CompanyTalentPoolController::index()'s ranking-by-completeness and
 * skills-keyword search — the mechanism behind "a fuller profile shows up
 * first" and "searching a skill surfaces matching candidates."
 */
class TalentPoolSearchRankingTest extends TestCase
{
    use RefreshDatabase;

    private function company(): array
    {
        $company = Company::create(['name' => 'Acme', 'slug' => 'acme-'.uniqid()]);
        $companyUser = User::factory()->create(['role' => User::ROLE_ADMIN_COMPANY, 'company_id' => $company->id]);

        return [$company, $companyUser];
    }

    private function visibleCandidate(array $userAttributes = []): TalentPoolCandidate
    {
        $user = User::factory()->create(array_merge(['role' => User::ROLE_USER], $userAttributes));

        return TalentPoolCandidate::create([
            'user_id' => $user->id,
            'score_percent' => 95,
            'qualified_at' => now(),
            'visibility_status' => TalentPoolCandidate::STATUS_VISIBLE,
        ]);
    }

    public function test_a_more_complete_profile_ranks_above_a_less_complete_one(): void
    {
        [, $companyUser] = $this->company();

        $lowCandidate = $this->visibleCandidate(['name' => 'Alex Kumar']);
        $highCandidate = $this->visibleCandidate(['name' => 'Alex Kumar']);
        $highCandidate->user->forceFill(['profile_completion_percent' => 90])->save();
        $lowCandidate->user->forceFill(['profile_completion_percent' => 10])->save();

        Sanctum::actingAs($companyUser);
        $response = $this->getJson('/api/company/talent-pool?search=Alex');

        $response->assertStatus(200);
        $ids = collect($response->json('candidates.data'))->pluck('id');
        $this->assertSame($highCandidate->id, $ids->first(), 'the more complete profile must rank first');
    }

    public function test_search_matches_a_skill_keyword_not_just_the_name(): void
    {
        [, $companyUser] = $this->company();

        $matching = $this->visibleCandidate(['name' => 'Priya Sharma', 'skills' => ['Laravel', 'React']]);
        $nonMatching = $this->visibleCandidate(['name' => 'Rohit Verma', 'skills' => ['Python', 'Django']]);

        Sanctum::actingAs($companyUser);
        $response = $this->getJson('/api/company/talent-pool?search=laravel');

        $response->assertStatus(200);
        $ids = collect($response->json('candidates.data'))->pluck('id');
        $this->assertTrue($ids->contains($matching->id));
        $this->assertFalse($ids->contains($nonMatching->id));
    }

    public function test_candidate_detail_exposes_recruiter_profile_fields_but_never_the_raw_resume_path(): void
    {
        [, $companyUser] = $this->company();

        $candidate = $this->visibleCandidate([
            'bio' => str_repeat('x', 45),
            'linkedin_url' => 'https://www.linkedin.com/in/priya',
            'skills' => ['Laravel', 'MySQL'],
            'resume_path' => 'resumes/999.pdf',
        ]);

        Sanctum::actingAs($companyUser);
        $response = $this->getJson("/api/company/talent-pool/{$candidate->id}");

        $response->assertStatus(200);
        $this->assertTrue($response->json('candidate.user.has_resume'));
        $this->assertSame('https://www.linkedin.com/in/priya', $response->json('candidate.user.linkedin_url'));
        $this->assertArrayNotHasKey('resume_path', $response->json('candidate.user'));
    }

    public function test_resume_download_requires_a_real_relationship_to_the_candidate(): void
    {
        [, $ownCompanyUser] = $this->company();
        [, $strangerCompanyUser] = $this->company();

        $candidate = $this->visibleCandidate(['resume_path' => 'resumes/1.pdf']);
        // Hide the candidate from fresh browsing so only an existing relationship (or lack thereof) is being tested.
        $candidate->update(['visibility_status' => TalentPoolCandidate::STATUS_HIDDEN_BY_CANDIDATE]);

        Sanctum::actingAs($strangerCompanyUser);
        $this->getJson("/api/company/talent-pool/{$candidate->id}/resume")->assertStatus(404);
    }
}
