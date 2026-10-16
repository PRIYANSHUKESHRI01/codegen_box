<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\ProjectEnrollment;
use App\Models\ProjectMilestoneProgress;
use App\Models\ProjectSubmission;
use App\Models\ProjectTopic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\TestCase;

/**
 * The authoring and review surface staff use to write SOWs one by one.
 */
class AdminProjectLabTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
    }

    private function payload(array $overrides = []): array
    {
        return $overrides + [
            'title' => 'E-Commerce Platform',
            'category' => 'Web Apps',
            'summary' => 'Build a store with a catalogue, cart and checkout.',
            'difficulty' => 'intermediate',
            'estimated_hours' => 70,
            'tech_stack' => ['Laravel', 'MySQL'],
            'outcomes' => ['Model orders and payments'],
            'sow_markdown' => str_repeat("## Section\n\nSome real content for the statement of work.\n\n", 5),
            'status' => 'draft',
            'milestones' => [
                ['title' => 'Catalogue', 'description' => 'Products and categories', 'acceptance_criteria' => ['Admin can add a product'], 'estimated_hours' => 8],
                ['title' => 'Cart and checkout', 'acceptance_criteria' => ['A guest can check out'], 'estimated_hours' => 12],
            ],
        ];
    }

    // ───────────────────────────── permissions ─────────────────────────────

    public function test_only_staff_with_the_project_lab_permission_get_in(): void
    {
        $this->getJson('/api/admin/project-lab/topics')->assertUnauthorized();

        Sanctum::actingAs($this->student());
        $this->getJson('/api/admin/project-lab/topics')->assertForbidden();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO]));
        $this->getJson('/api/admin/project-lab/topics')->assertForbidden();

        Sanctum::actingAs($this->staff([User::PERM_ARTICLES]));
        $this->getJson('/api/admin/project-lab/topics')->assertForbidden();

        Sanctum::actingAs($this->staff([User::PERM_PROJECT_LAB]));
        $this->getJson('/api/admin/project-lab/topics')->assertOk();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));
        $this->getJson('/api/admin/project-lab/topics')->assertOk();
    }

    public function test_project_lab_is_part_of_the_internal_permission_catalogue(): void
    {
        $this->assertContains(User::PERM_PROJECT_LAB, User::PERMISSIONS_INTERNAL);
    }

    // ───────────────────────────── authoring ─────────────────────────────

    public function test_a_topic_is_created_as_a_draft_with_its_milestones_in_order(): void
    {
        Sanctum::actingAs($this->staff());

        $response = $this->postJson('/api/admin/project-lab/topics', $this->payload())->assertCreated();

        $response->assertJsonPath('topic.slug', 'e-commerce-platform')
            ->assertJsonPath('topic.status', 'draft')
            ->assertJsonPath('topic.sow_version', 1)
            ->assertJsonPath('topic.milestones.0.title', 'Catalogue')
            ->assertJsonPath('topic.milestones.0.position', 0)
            ->assertJsonPath('topic.milestones.1.position', 1)
            ->assertJsonPath('topic.milestones.0.acceptance_criteria.0', 'Admin can add a product');
        $this->assertNull($response->json('topic.published_at'));
        $this->assertNotNull(ActivityLog::where('action', 'Created a Project Lab topic')->first());
    }

    public function test_a_draft_is_invisible_to_students_until_published(): void
    {
        Sanctum::actingAs($this->staff());
        $id = $this->postJson('/api/admin/project-lab/topics', $this->payload())->assertCreated()->json('topic.id');

        Sanctum::actingAs($this->studentWithLab());
        $this->getJson('/api/project-lab/topics')->assertJsonCount(0, 'topics');

        Sanctum::actingAs($this->staff());
        $this->putJson("/api/admin/project-lab/topics/$id", $this->payload(['status' => 'published']))->assertOk()
            ->assertJsonPath('topic.status', 'published');
        $this->assertNotNull(ProjectTopic::find($id)->published_at);

        Sanctum::actingAs($this->studentWithLab());
        $this->getJson('/api/project-lab/topics')->assertJsonCount(1, 'topics');
    }

    public function test_a_topic_cannot_be_published_without_a_sow_or_without_milestones(): void
    {
        Sanctum::actingAs($this->staff());

        $this->postJson('/api/admin/project-lab/topics', $this->payload(['status' => 'published', 'sow_markdown' => 'too short']))
            ->assertStatus(422)->assertJsonValidationErrors('sow_markdown');

        $this->postJson('/api/admin/project-lab/topics', $this->payload(['status' => 'published', 'milestones' => []]))
            ->assertStatus(422)->assertJsonValidationErrors('milestones');

        $this->assertSame(0, ProjectTopic::count(), 'a refused publish must not leave a half-created topic behind');
    }

    public function test_slugs_are_unique_and_never_collide_with_a_page_route(): void
    {
        Sanctum::actingAs($this->staff());

        $a = $this->postJson('/api/admin/project-lab/topics', $this->payload())->json('topic.slug');
        $b = $this->postJson('/api/admin/project-lab/topics', $this->payload())->json('topic.slug');
        $reserved = $this->postJson('/api/admin/project-lab/topics', $this->payload(['title' => 'New']))->json('topic.slug');

        $this->assertSame('e-commerce-platform', $a);
        $this->assertSame('e-commerce-platform-2', $b);
        $this->assertSame('new-2', $reserved);
    }

    public function test_editing_keeps_milestone_identity_so_student_progress_survives(): void
    {
        Sanctum::actingAs($this->staff());
        $created = $this->postJson('/api/admin/project-lab/topics', $this->payload(['status' => 'published']))->json('topic');
        $topic = ProjectTopic::find($created['id']);
        $enrollment = $this->enroll($this->studentWithLab(), $topic);
        ProjectMilestoneProgress::create([
            'project_enrollment_id' => $enrollment->id,
            'project_milestone_id' => $created['milestones'][0]['id'],
            'completed_at' => now(),
        ]);

        // Rename milestone 1, swap the order, add a third.
        $body = $this->payload(['status' => 'published', 'milestones' => [
            ['id' => $created['milestones'][1]['id'], 'title' => 'Checkout', 'acceptance_criteria' => ['Pays'], 'estimated_hours' => 12],
            ['id' => $created['milestones'][0]['id'], 'title' => 'Catalogue v2', 'acceptance_criteria' => ['Adds'], 'estimated_hours' => 8],
            ['title' => 'Admin dashboard', 'acceptance_criteria' => ['Sees orders'], 'estimated_hours' => 6],
        ]]);
        $this->putJson("/api/admin/project-lab/topics/{$created['id']}", $body)->assertOk()
            ->assertJsonPath('topic.milestones.0.title', 'Checkout')
            ->assertJsonPath('topic.milestones.1.title', 'Catalogue v2')
            ->assertJsonPath('topic.milestones.1.id', $created['milestones'][0]['id'])
            ->assertJsonCount(3, 'topic.milestones');

        $this->assertSame(1, ProjectMilestoneProgress::count(), "the student's tick on the renamed milestone survives");
    }

    public function test_removing_a_milestone_removes_its_progress_ticks(): void
    {
        Sanctum::actingAs($this->staff());
        $created = $this->postJson('/api/admin/project-lab/topics', $this->payload())->json('topic');
        $enrollment = $this->enroll($this->studentWithLab(), ProjectTopic::find($created['id']));
        ProjectMilestoneProgress::create(['project_enrollment_id' => $enrollment->id, 'project_milestone_id' => $created['milestones'][1]['id'], 'completed_at' => now()]);

        $body = $this->payload(['milestones' => [['id' => $created['milestones'][0]['id'], 'title' => 'Catalogue', 'acceptance_criteria' => []]]]);
        $this->putJson("/api/admin/project-lab/topics/{$created['id']}", $body)->assertOk()->assertJsonCount(1, 'topic.milestones');

        $this->assertSame(0, ProjectMilestoneProgress::count());
    }

    public function test_the_sow_version_only_moves_when_the_editor_says_the_change_is_material(): void
    {
        Sanctum::actingAs($this->staff());
        $created = $this->postJson('/api/admin/project-lab/topics', $this->payload(['status' => 'published']))->json('topic');
        $topic = ProjectTopic::find($created['id']);
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student, $topic);

        $this->putJson("/api/admin/project-lab/topics/{$created['id']}", $this->payload(['status' => 'published', 'sow_markdown' => str_repeat("Fixed a typo.\n\n", 20)]))
            ->assertJsonPath('topic.sow_version', 1);

        $this->putJson("/api/admin/project-lab/topics/{$created['id']}", $this->payload(['status' => 'published', 'bump_sow_version' => true]))
            ->assertJsonPath('topic.sow_version', 2);

        Sanctum::actingAs($student);
        $this->getJson("/api/project-lab/enrollments/{$enrollment->id}")
            ->assertJsonPath('enrollment.sow_version', 1)
            ->assertJsonPath('enrollment.sow_outdated', true);
    }

    public function test_field_validation(): void
    {
        Sanctum::actingAs($this->staff());

        $this->postJson('/api/admin/project-lab/topics', $this->payload(['difficulty' => 'impossible']))->assertStatus(422)->assertJsonValidationErrors('difficulty');
        $this->postJson('/api/admin/project-lab/topics', $this->payload(['title' => '']))->assertStatus(422)->assertJsonValidationErrors('title');
        $this->postJson('/api/admin/project-lab/topics', $this->payload(['estimated_hours' => 0]))->assertStatus(422)->assertJsonValidationErrors('estimated_hours');
        $this->postJson('/api/admin/project-lab/topics', $this->payload(['sow_markdown' => str_repeat('x', 200_001)]))->assertStatus(422)->assertJsonValidationErrors('sow_markdown');
        $this->postJson('/api/admin/project-lab/topics', $this->payload(['milestones' => [['title' => '']]]))->assertStatus(422)->assertJsonValidationErrors('milestones.0.title');
        $this->postJson('/api/admin/project-lab/topics', $this->payload(['status' => 'live']))->assertStatus(422)->assertJsonValidationErrors('status');
    }

    public function test_a_topic_students_have_worked_on_is_archived_never_deleted(): void
    {
        Sanctum::actingAs($this->staff());
        $worked = $this->topic(['slug' => 'worked']);
        $this->enroll($this->studentWithLab(), $worked);
        $unused = $this->topic(['slug' => 'unused']);

        $this->deleteJson("/api/admin/project-lab/topics/{$worked->id}")->assertStatus(409);
        $this->assertNotNull(ProjectTopic::find($worked->id));

        $this->deleteJson("/api/admin/project-lab/topics/{$unused->id}")->assertOk();
        $this->assertNull(ProjectTopic::find($unused->id));
    }

    public function test_the_topic_list_shows_status_and_counts_without_the_sow_body(): void
    {
        Sanctum::actingAs($this->staff());
        $this->topic(['slug' => 'a', 'title' => 'A']);
        $this->topic(['slug' => 'b', 'title' => 'B', 'status' => 'draft', 'sow_markdown' => null], milestones: 0);

        $response = $this->getJson('/api/admin/project-lab/topics')->assertOk()->assertJsonCount(2, 'topics');

        $response->assertJsonPath('topics.0.milestone_count', 2)->assertJsonPath('topics.0.has_sow', true)
            ->assertJsonPath('topics.1.status', 'draft')->assertJsonPath('topics.1.has_sow', false);
        $this->assertArrayNotHasKey('sow_markdown', $response->json('topics.0'));
    }

    // ───────────────────────────── review ─────────────────────────────

    private function submission(array $overrides = []): ProjectSubmission
    {
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student, null, ProjectEnrollment::STATUS_SUBMITTED);

        return $enrollment->submissions()->create($overrides + [
            'user_id' => $student->id, 'attempt' => 1, 'status' => ProjectSubmission::STATUS_PENDING,
            'milestones_done' => 1, 'milestones_total' => 2, 'submitted_at' => now(),
        ]);
    }

    public function test_the_queue_shows_what_needs_a_reviewer_first(): void
    {
        $reviewed = $this->submission(['status' => 'reviewed', 'score' => 70, 'submitted_at' => now()->subDay()]);
        $pending = $this->submission();
        $inReview = $this->submission(['status' => 'in_review']);
        Sanctum::actingAs($this->staff());

        $open = $this->getJson('/api/admin/project-lab/submissions')->assertOk();
        $this->assertSame([$pending->id, $inReview->id], collect($open->json('submissions'))->pluck('id')->all());
        $open->assertJsonPath('counts.pending_review', 1)->assertJsonPath('counts.in_review', 1);

        $all = $this->getJson('/api/admin/project-lab/submissions?status=all')->assertJsonCount(3, 'submissions');
        $this->assertSame($reviewed->id, collect($all->json('submissions'))->last()['id']);
    }

    public function test_a_reviewer_sees_the_milestones_the_student_completed(): void
    {
        $submission = $this->submission();
        $enrollment = $submission->enrollment;
        ProjectMilestoneProgress::create([
            'project_enrollment_id' => $enrollment->id,
            'project_milestone_id' => $enrollment->topic->milestones[0]->id,
            'completed_at' => now(),
        ]);
        Sanctum::actingAs($this->staff());

        $this->getJson("/api/admin/project-lab/submissions/{$submission->id}")
            ->assertOk()
            ->assertJsonPath('submission.milestones.0.done', true)
            ->assertJsonPath('submission.milestones.1.done', false)
            ->assertJsonPath('submission.milestones.0.acceptance_criteria.0', 'Criterion A0');
    }

    public function test_reviewing_validates_its_inputs(): void
    {
        $submission = $this->submission();
        Sanctum::actingAs($this->staff());
        $url = "/api/admin/project-lab/submissions/{$submission->id}/review";

        $this->postJson($url, ['status' => 'reviewed'])->assertStatus(422)->assertJsonValidationErrors('score');
        $this->postJson($url, ['status' => 'needs_changes'])->assertStatus(422)->assertJsonValidationErrors('feedback');
        $this->postJson($url, ['status' => 'reviewed', 'score' => 101])->assertStatus(422)->assertJsonValidationErrors('score');
        $this->postJson($url, ['status' => 'pending_review'])->assertStatus(422)->assertJsonValidationErrors('status');
        $this->postJson($url, ['status' => 'reviewed', 'score' => 80, 'rubric' => [['criterion' => 'x', 'score' => 1]]])->assertStatus(422);

        $this->assertSame(ProjectSubmission::STATUS_PENDING, $submission->fresh()->status);
    }

    public function test_marking_in_review_does_not_finish_the_project(): void
    {
        $submission = $this->submission();
        Sanctum::actingAs($this->staff());

        $this->postJson("/api/admin/project-lab/submissions/{$submission->id}/review", ['status' => 'in_review'])->assertOk();

        $this->assertSame(ProjectEnrollment::STATUS_SUBMITTED, $submission->enrollment->fresh()->status);
        $this->assertNull($submission->fresh()->reviewed_at);
    }

    public function test_review_actions_are_audited(): void
    {
        $submission = $this->submission();
        $reviewer = $this->staff();
        Sanctum::actingAs($reviewer);

        $this->postJson("/api/admin/project-lab/submissions/{$submission->id}/review", ['status' => 'reviewed', 'score' => 90])->assertOk();

        $log = ActivityLog::where('action', 'Reviewed a project submission')->firstOrFail();
        $this->assertSame($reviewer->id, $log->actor_id);
        $this->assertSame(90, $log->meta['score']);
    }

    // ───────────────────────────── snapshots ─────────────────────────────

    public function test_staff_can_download_a_snapshot_and_it_is_audited(): void
    {
        Storage::fake('local');
        config(['workspaces.snapshot.disk' => 'local']);
        Storage::disk('local')->put('project-submissions/9/1-x.tgz', 'ARCHIVE-BYTES');
        $submission = $this->submission(['snapshot_path' => 'project-submissions/9/1-x.tgz', 'snapshot_size_bytes' => 13]);
        Sanctum::actingAs($this->staff());

        $response = $this->get("/api/admin/project-lab/submissions/{$submission->id}/snapshot");

        $response->assertOk();
        $this->assertSame('ARCHIVE-BYTES', $response->streamedContent());
        $this->assertStringContainsString('attempt-1.tgz', $response->headers->get('Content-Disposition'));
        $this->assertNotNull(ActivityLog::where('action', 'Downloaded a project snapshot')->first());
    }

    public function test_a_student_cannot_download_any_snapshot_not_even_their_own(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('project-submissions/9/1-x.tgz', 'ARCHIVE-BYTES');
        $submission = $this->submission(['snapshot_path' => 'project-submissions/9/1-x.tgz']);
        Sanctum::actingAs($submission->user);

        $this->get("/api/admin/project-lab/submissions/{$submission->id}/snapshot")->assertForbidden();
    }

    public function test_a_submission_without_a_snapshot_is_a_404_not_an_error(): void
    {
        $submission = $this->submission(['snapshot_path' => null]);
        Sanctum::actingAs($this->staff());

        $this->get("/api/admin/project-lab/submissions/{$submission->id}/snapshot")->assertNotFound();
    }

    // ───────────────────────────── revenue reporting ─────────────────────────────

    public function test_superadmin_revenue_counts_students_once_and_reports_lab_separately(): void
    {
        $a = $this->student();
        $this->buy($a, 'expert');                              // 2,999 for a year
        $this->grantLegacyProjectLabAddon($a, pricePaid: 349); // bought alongside it, before the add-on was retired
        $b = $this->student();
        $this->grantLegacyProjectLabAddon($b);                 // 499 on free Coder
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $recurring = $this->getJson('/api/superadmin/overview')->assertOk()->json('individual_recurring');

        // Active base rows: a's Expert, b's Coder. (Other students in this test DB: the two superadmin/staff factories aren't students.)
        $this->assertSame(2, $recurring['count']);
        $this->assertSame(2, $recurring['addon_count']);
        // Spread over each line's own term and expressed per 30 days: the two 30-day add-ons count
        // as paid, the 365-day Expert at 2,999 counts as about 246 a month, and free Coder as nothing.
        $this->assertSame(349 + 499, $recurring['addon_monthly_total']);
        $this->assertSame((int) round(2999 * 30 / 365 + 349 + 499), $recurring['monthly_total']);
    }
}
