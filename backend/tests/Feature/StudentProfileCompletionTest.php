<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers User::computeProfileCompletion()'s weighting and
 * StudentProfileController's write paths that keep the stored
 * profile_completion_percent column in sync with it.
 */
class StudentProfileCompletionTest extends TestCase
{
    use RefreshDatabase;

    private function student(): User
    {
        return User::factory()->create(['role' => User::ROLE_USER]);
    }

    public function test_completion_is_zero_for_a_bare_new_student(): void
    {
        $user = $this->student();

        $this->assertSame(0, $user->computeProfileCompletion());
    }

    public function test_each_weighted_field_contributes_correctly_and_sums_to_100(): void
    {
        $user = $this->student();
        $user->forceFill([
            'phone_verified_at' => now(),
            'avatar_path' => 'avatars/1.png',
            'bio' => str_repeat('a', 45),
            'linkedin_url' => 'https://www.linkedin.com/in/someone',
            'github_url' => 'https://github.com/someone',
            'resume_path' => 'resumes/1.pdf',
            'skills' => ['Laravel', 'Next.js', 'MySQL'],
        ])->save();

        $this->assertSame(100, $user->computeProfileCompletion());
    }

    public function test_a_short_bio_does_not_count_and_fewer_than_3_skills_does_not_count(): void
    {
        $user = $this->student();
        $user->forceFill([
            'bio' => 'too short',
            'skills' => ['Laravel', 'Next.js'],
        ])->save();

        $this->assertSame(0, $user->computeProfileCompletion());
    }

    public function test_updating_the_extended_profile_recomputes_and_persists_completion(): void
    {
        $user = $this->student();
        Sanctum::actingAs($user);

        $response = $this->putJson('/api/me/student-profile', [
            'bio' => str_repeat('b', 45),
            'linkedin_url' => 'https://www.linkedin.com/in/someone',
            'github_url' => 'https://github.com/someone',
            'skills' => ['Laravel', 'Next.js', 'MySQL'],
        ]);

        $response->assertStatus(200);
        $this->assertSame(50, $response->json('user.profile_completion_percent')); // bio 10 + linkedin 15 + github 10 + skills 15
        $this->assertDatabaseHas('users', ['id' => $user->id, 'profile_completion_percent' => 50]);
    }

    public function test_a_non_linkedin_url_is_rejected(): void
    {
        $user = $this->student();
        Sanctum::actingAs($user);

        $response = $this->putJson('/api/me/student-profile', [
            'linkedin_url' => 'https://example.com/not-linkedin',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors(['linkedin_url']);
    }

    public function test_uploading_and_deleting_a_resume_recomputes_completion(): void
    {
        $user = $this->student();
        Sanctum::actingAs($user);

        $upload = $this->postJson('/api/me/resume', [
            'resume' => UploadedFile::fake()->create('resume.pdf', 100, 'application/pdf'),
        ]);
        $upload->assertStatus(200);
        $this->assertSame(25, $upload->json('user.profile_completion_percent'));
        $this->assertTrue($upload->json('user.has_resume'));
        $this->assertArrayNotHasKey('resume_path', $upload->json('user'), 'the raw storage path must never be serialized');

        $delete = $this->deleteJson('/api/me/resume');
        $delete->assertStatus(200);
        $this->assertSame(0, $delete->json('user.profile_completion_percent'));
        $this->assertFalse($delete->json('user.has_resume'));
    }

    public function test_non_pdf_resume_is_rejected(): void
    {
        $user = $this->student();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/me/resume', [
            'resume' => UploadedFile::fake()->create('resume.docx', 100, 'application/msword'),
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors(['resume']);
    }

    public function test_own_resume_can_be_downloaded_only_after_uploading_one(): void
    {
        $user = $this->student();
        Sanctum::actingAs($user);

        $this->getJson('/api/me/resume')->assertStatus(404);

        $this->postJson('/api/me/resume', [
            'resume' => UploadedFile::fake()->create('my-resume.pdf', 100, 'application/pdf'),
        ])->assertStatus(200);

        $this->get('/api/me/resume')->assertStatus(200);
    }

    public function test_non_student_roles_cannot_use_the_extended_profile_endpoints(): void
    {
        $staff = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]);
        Sanctum::actingAs($staff);

        $this->putJson('/api/me/student-profile', ['bio' => 'hello'])->assertStatus(403);
        $this->postJson('/api/me/resume', [
            'resume' => UploadedFile::fake()->create('resume.pdf', 100, 'application/pdf'),
        ])->assertStatus(403);
    }
}
