<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\InterviewRoleTemplate;
use App\Models\InterviewTrack;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers AdminInterviewTrackController::store() — the template-to-3-rounds
 * snapshot — and Interview::isVisibleToUser()'s track-round-gating branch.
 */
class InterviewTrackCreationTest extends TestCase
{
    use RefreshDatabase;

    private function template(): InterviewRoleTemplate
    {
        return InterviewRoleTemplate::create([
            'name' => 'Backend Developer — Laravel & Next.js',
            'rounds_config' => [
                ['round_number' => 1, 'round_name' => 'Screening', 'question_count' => 10, 'difficulty' => 'medium', 'category_weights' => ['technical' => 60, 'aptitude' => 40], 'qualifying_score_percent' => 60],
                ['round_number' => 2, 'round_name' => 'Deep Technical', 'question_count' => 8, 'difficulty' => 'hard', 'category_weights' => ['technical' => 100], 'qualifying_score_percent' => 65],
                ['round_number' => 3, 'round_name' => 'Final / HR', 'question_count' => 6, 'difficulty' => 'medium', 'category_weights' => ['behavioral' => 50, 'hr' => 50], 'qualifying_score_percent' => 60],
            ],
        ]);
    }

    public function test_creating_a_track_snapshots_three_rounds_from_template(): void
    {
        $ops = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_INTERVIEWS]]);
        $template = $this->template();
        Sanctum::actingAs($ops);

        $response = $this->postJson('/api/admin/interview-tracks', [
            'title' => 'Backend Dev Track',
            'interview_role_template_id' => $template->id,
        ]);

        $response->assertStatus(201);
        $track = InterviewTrack::findOrFail($response->json('track.id'));

        $this->assertSame(3, $track->rounds()->count());

        $round1 = $track->rounds()->where('round_number', 1)->firstOrFail();
        $this->assertSame('Screening', $round1->round_name);
        $this->assertSame(['technical' => 60, 'aptitude' => 40], $round1->category_weights);
        $this->assertSame(60.0, (float) $round1->qualifying_score_percent);
        $this->assertSame(Interview::INTERVIEW_TYPE_GENERAL, $round1->interview_type);

        $round2 = $track->rounds()->where('round_number', 2)->firstOrFail();
        $this->assertSame(['technical' => 100], $round2->category_weights);
    }

    public function test_editing_template_after_track_creation_does_not_change_existing_rounds(): void
    {
        $ops = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_INTERVIEWS]]);
        $template = $this->template();
        Sanctum::actingAs($ops);

        $trackId = $this->postJson('/api/admin/interview-tracks', [
            'title' => 'Backend Dev Track',
            'interview_role_template_id' => $template->id,
        ])->json('track.id');

        $newRoundsConfig = $template->rounds_config;
        $newRoundsConfig[0]['qualifying_score_percent'] = 95;
        $newRoundsConfig[0]['category_weights'] = ['technical' => 100];
        $this->postJson("/api/admin/interview-role-templates/{$template->id}", [
            'rounds_config' => $newRoundsConfig,
        ])->assertStatus(200);

        $track = InterviewTrack::findOrFail($trackId);
        $round1 = $track->rounds()->where('round_number', 1)->firstOrFail();

        $this->assertSame(60.0, (float) $round1->qualifying_score_percent, 'the round must keep its snapshot, not the edited template');
        $this->assertSame(['technical' => 60, 'aptitude' => 40], $round1->category_weights);
    }

    public function test_round_two_is_not_visible_to_student_before_advancement(): void
    {
        $ops = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_INTERVIEWS]]);
        $template = $this->template();
        Sanctum::actingAs($ops);

        $trackId = $this->postJson('/api/admin/interview-tracks', [
            'title' => 'Backend Dev Track',
            'interview_role_template_id' => $template->id,
        ])->json('track.id');

        $this->postJson("/api/admin/interview-tracks/".InterviewTrack::find($trackId)->slug, ['status' => 'published'])
            ->assertStatus(200);

        $track = InterviewTrack::with('rounds')->findOrFail($trackId);
        $round2 = $track->rounds()->where('round_number', 2)->firstOrFail();
        $this->assertSame(Interview::STATUS_PUBLISHED, $round2->status, 'publishing a track must cascade to every round');

        $student = User::factory()->create(['role' => User::ROLE_USER]);
        Sanctum::actingAs($student);

        $this->getJson("/api/interviews/{$round2->slug}")->assertStatus(404);
        $this->postJson("/api/interviews/{$round2->slug}/start")->assertStatus(404);
    }
}
