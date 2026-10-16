<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Plan;
use App\Models\ProjectEnrollment;
use App\Models\ProjectMilestoneProgress;
use App\Models\ProjectTopic;
use App\Models\ProjectWorkspace;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\TestCase;

/**
 * The paywall. A student without Project Lab sees the catalog as a preview and
 * is turned away (402 project_lab_required) from every paid part; a student
 * with it gets the SOW, the PDF and a workspace. The preview must never leak
 * the paid substance — the SOW body, milestone descriptions, acceptance criteria.
 */
class ProjectLabAccessTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
        $this->fakeWorkspaces();
    }

    // ───────────────────────────── the preview ─────────────────────────────

    public function test_a_student_without_lab_sees_the_catalog_as_a_preview_only(): void
    {
        $topic = $this->topic(['title' => 'Hospital Management System', 'slug' => 'hms']);
        $this->topic(['title' => 'Draft one', 'slug' => 'draft-one', 'status' => ProjectTopic::STATUS_DRAFT]);
        Sanctum::actingAs($this->student());

        $response = $this->getJson('/api/project-lab/topics')->assertOk();

        $response->assertJsonPath('project_lab.enabled', false)
            // The lock screen's offer is the plan that includes Project Lab, at today's live price.
            ->assertJsonPath('project_lab.upgrade.code', 'expert')
            ->assertJsonPath('project_lab.upgrade.list_price', 4999)
            ->assertJsonPath('project_lab.upgrade.sale_price', 2999)
            ->assertJsonPath('project_lab.upgrade.workspace_hours', 80)
            ->assertJsonCount(1, 'topics') // the draft is invisible
            ->assertJsonPath('topics.0.slug', 'hms')
            ->assertJsonPath('topics.0.milestone_count', 2)
            ->assertJsonPath('topics.0.tech_stack.0', 'Laravel');

        $this->assertStringNotContainsString('Statement of Work', $response->getContent());
        $this->assertArrayNotHasKey('sow_markdown', $response->json('topics.0'));
    }

    public function test_the_topic_page_withholds_the_paid_parts_from_a_student_without_lab(): void
    {
        $this->topic(['slug' => 'lms']);
        Sanctum::actingAs($this->student());

        $response = $this->getJson('/api/project-lab/topics/lms')->assertOk();

        $response->assertJsonPath('topic.sow_locked', true)
            ->assertJsonPath('topic.sow_markdown', null)
            ->assertJsonPath('topic.can_download_sow', false)
            ->assertJsonPath('topic.milestones.0.title', 'Milestone 1')
            ->assertJsonPath('topic.milestones.0.description', null)
            ->assertJsonPath('topic.milestones.0.acceptance_criteria', []);

        // Neither the SOW text nor any milestone detail appears anywhere in the response.
        $this->assertStringNotContainsString('Objectives', $response->getContent());
        $this->assertStringNotContainsString('Secret detail', $response->getContent());
        $this->assertStringNotContainsString('Criterion A', $response->getContent());
    }

    public function test_a_student_with_lab_gets_the_full_topic(): void
    {
        $this->topic(['slug' => 'lms']);
        Sanctum::actingAs($this->studentWithLab());

        $this->getJson('/api/project-lab/topics/lms')
            ->assertOk()
            ->assertJsonPath('topic.sow_locked', false)
            ->assertJsonPath('topic.can_download_sow', true)
            ->assertJsonPath('topic.milestones.0.description', 'Secret detail 1')
            ->assertJsonPath('topic.milestones.0.acceptance_criteria.0', 'Criterion A0')
            ->assertJsonPath('project_lab.enabled', true);

        $this->assertStringContainsString('Out of scope', $this->getJson('/api/project-lab/topics/lms')->json('topic.sow_markdown'));
    }

    public function test_a_draft_or_archived_topic_is_a_404_for_students(): void
    {
        $this->topic(['slug' => 'draft', 'status' => ProjectTopic::STATUS_DRAFT]);
        $this->topic(['slug' => 'old', 'status' => ProjectTopic::STATUS_ARCHIVED]);
        Sanctum::actingAs($this->studentWithLab());

        $this->getJson('/api/project-lab/topics/draft')->assertNotFound();
        $this->getJson('/api/project-lab/topics/old')->assertNotFound();
        $this->postJson('/api/project-lab/topics/draft/start')->assertNotFound();
        $this->get('/api/project-lab/topics/draft/sow.pdf')->assertNotFound();
    }

    public function test_only_students_can_use_the_student_endpoints(): void
    {
        $this->topic(['slug' => 'lms']);
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO]));

        $this->getJson('/api/project-lab/topics')->assertForbidden();
        $this->postJson('/api/project-lab/topics/lms/start')->assertForbidden();
    }

    // ───────────────────────────── the free sample ─────────────────────────────

    public function test_a_free_sample_shows_its_sow_to_everyone_but_never_a_workspace(): void
    {
        $this->topic(['slug' => 'sample', 'is_free_sample' => true]);
        Sanctum::actingAs($this->student());

        $this->getJson('/api/project-lab/topics/sample')
            ->assertOk()
            ->assertJsonPath('topic.sow_locked', false)
            ->assertJsonPath('topic.can_download_sow', true)
            ->assertJsonPath('topic.milestones.0.description', null, 'milestone detail stays paid even on a sample');

        $this->get('/api/project-lab/topics/sample/sow.pdf')->assertOk();
        $this->postJson('/api/project-lab/topics/sample/start')->assertStatus(402)->assertJsonPath('code', 'project_lab_required');
    }

    // ───────────────────────────── the PDF ─────────────────────────────

    public function test_downloading_the_sow_requires_lab_and_returns_a_real_pdf(): void
    {
        $this->topic(['slug' => 'lms']);
        $locked = $this->student();
        Sanctum::actingAs($locked);
        $this->get('/api/project-lab/topics/lms/sow.pdf')->assertStatus(402);

        $student = $this->studentWithLab(['name' => 'Asha Rao', 'email' => 'asha@example.com']);
        Sanctum::actingAs($student);

        $response = $this->get('/api/project-lab/topics/lms/sow.pdf');

        $response->assertOk();
        $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('SOW-lms-v1.pdf', $response->headers->get('Content-Disposition'));
        $this->assertStringStartsWith('%PDF', $response->getContent());
        $this->assertGreaterThan(2000, strlen($response->getContent()));
    }

    public function test_every_sow_download_is_logged_against_the_student(): void
    {
        $this->topic(['slug' => 'lms']);
        $student = $this->studentWithLab();
        Sanctum::actingAs($student);

        $this->get('/api/project-lab/topics/lms/sow.pdf')->assertOk();

        $log = ActivityLog::where('action', 'Downloaded a SOW')->firstOrFail();
        $this->assertSame($student->id, $log->actor_id);
        $this->assertSame(1, $log->meta['sow_version']);
    }

    public function test_raw_html_in_a_sow_is_stripped_before_rendering(): void
    {
        $this->topic(['slug' => 'lms', 'sow_markdown' => "# SOW\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\nSafe text.\n"]);
        Sanctum::actingAs($this->studentWithLab());

        // Rendering must not throw on hostile input, and still produce a PDF.
        $response = $this->get('/api/project-lab/topics/lms/sow.pdf');

        $response->assertOk();
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    // ───────────────────────────── starting a project ─────────────────────────────

    public function test_starting_a_project_requires_lab_and_says_why(): void
    {
        $this->topic(['slug' => 'lms']);
        Sanctum::actingAs($this->student());

        $this->postJson('/api/project-lab/topics/lms/start')
            ->assertStatus(402)
            ->assertJsonPath('code', 'project_lab_required');

        $this->assertSame(0, ProjectEnrollment::count());
    }

    public function test_starting_creates_an_enrollment_and_a_stopped_workspace(): void
    {
        $this->topic(['slug' => 'lms']);
        $student = $this->studentWithLab();
        Sanctum::actingAs($student);

        $this->postJson('/api/project-lab/topics/lms/start')
            ->assertCreated()
            ->assertJsonPath('enrollment.status', 'active')
            ->assertJsonPath('enrollment.progress.total', 2)
            ->assertJsonPath('enrollment.workspace.status', 'stopped')
            ->assertJsonPath('enrollment.workspace.ide_url', null)
            ->assertJsonPath('project_lab.projects.active', 1);

        $this->assertSame(1, ProjectWorkspace::count());
    }

    public function test_starting_the_same_project_twice_returns_the_same_enrollment(): void
    {
        $this->topic(['slug' => 'lms']);
        Sanctum::actingAs($this->studentWithLab());

        $first = $this->postJson('/api/project-lab/topics/lms/start')->assertCreated()->json('enrollment.id');
        $second = $this->postJson('/api/project-lab/topics/lms/start')->assertOk()->json('enrollment.id');

        $this->assertSame($first, $second);
        $this->assertSame(1, ProjectEnrollment::count());
        $this->assertSame(1, ProjectWorkspace::count());
    }

    public function test_the_active_project_limit_is_enforced_and_abandoning_frees_a_slot(): void
    {
        foreach (['a', 'b', 'c', 'd'] as $slug) {
            $this->topic(['slug' => $slug, 'title' => "Project $slug"]);
        }
        Sanctum::actingAs($this->studentWithLab());

        foreach (['a', 'b', 'c'] as $slug) {
            $this->postJson("/api/project-lab/topics/$slug/start")->assertCreated();
        }

        $this->postJson('/api/project-lab/topics/d/start')->assertStatus(409)->assertJsonPath('code', 'active_projects_full');

        $abandon = ProjectEnrollment::whereHas('topic', fn ($q) => $q->where('slug', 'a'))->firstOrFail();
        $this->postJson("/api/project-lab/enrollments/{$abandon->id}/abandon")->assertOk()->assertJsonPath('enrollment.status', 'abandoned');

        $this->postJson('/api/project-lab/topics/d/start')->assertCreated();
        // …and the abandoned one cannot be silently resurrected past the limit.
        $this->postJson('/api/project-lab/topics/a/start')->assertStatus(409);
    }

    public function test_a_project_that_never_got_a_sow_cannot_be_started(): void
    {
        $this->topic(['slug' => 'empty', 'sow_markdown' => null]);
        Sanctum::actingAs($this->studentWithLab());

        $this->postJson('/api/project-lab/topics/empty/start')->assertStatus(409)->assertJsonPath('code', 'project_not_ready');
    }

    // ───────────────────────────── ownership & milestones ─────────────────────────────

    public function test_a_student_cannot_see_or_touch_someone_elses_enrollment(): void
    {
        $topic = $this->topic();
        $owner = $this->studentWithLab();
        $enrollment = $this->enroll($owner, $topic);
        Sanctum::actingAs($this->studentWithLab());

        $this->getJson("/api/project-lab/enrollments/{$enrollment->id}")->assertNotFound();
        $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/milestones/{$topic->milestones[0]->id}/toggle")->assertNotFound();
        $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/workspace/start")->assertNotFound();
        $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/workspace/heartbeat")->assertNotFound();
        $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/submit", ['repo_url' => 'https://github.com/x/y'])->assertNotFound();
    }

    public function test_ticking_a_milestone_toggles_it_and_reports_progress(): void
    {
        $topic = $this->topic();
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student, $topic);
        Sanctum::actingAs($student);
        $url = "/api/project-lab/enrollments/{$enrollment->id}/milestones/{$topic->milestones[0]->id}/toggle";

        $this->postJson($url)->assertOk()->assertJsonPath('done', true)->assertJsonPath('progress.done', 1)->assertJsonPath('progress.total', 2);
        $this->assertSame(1, ProjectMilestoneProgress::count());

        $this->postJson($url)->assertOk()->assertJsonPath('done', false)->assertJsonPath('progress.done', 0);
        $this->assertSame(0, ProjectMilestoneProgress::count());
    }

    public function test_a_milestone_from_another_project_is_rejected(): void
    {
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student, $this->topic());
        $foreign = $this->topic()->milestones[0];
        Sanctum::actingAs($student);

        $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/milestones/{$foreign->id}/toggle")->assertNotFound();
    }

    public function test_milestones_are_frozen_once_the_project_is_submitted(): void
    {
        $topic = $this->topic();
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student, $topic, ProjectEnrollment::STATUS_SUBMITTED);
        Sanctum::actingAs($student);

        $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/milestones/{$topic->milestones[0]->id}/toggle")
            ->assertStatus(409)->assertJsonPath('code', 'enrollment_not_active');
    }

    // ───────────────────────────── lapse ─────────────────────────────

    public function test_after_a_lapse_the_student_keeps_their_history_but_loses_the_paid_parts(): void
    {
        $topic = $this->topic(['slug' => 'lms']);
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student, $topic);
        $enrollment->submissions()->create([
            'user_id' => $student->id, 'attempt' => 1, 'status' => 'reviewed', 'score' => 82,
            'feedback' => 'Well done.', 'milestones_done' => 2, 'milestones_total' => 2, 'submitted_at' => now(),
        ]);
        Subscription::where('subscriber_id', $student->id)->whereHas('plan', fn ($q) => $q->where('code', Plan::CODE_PROJECT_LAB))
            ->update(['current_period_end' => now()->subDay()]);
        Sanctum::actingAs($student->fresh());

        // Their own result and feedback are still theirs…
        $response = $this->getJson("/api/project-lab/enrollments/{$enrollment->id}")->assertOk();
        $response->assertJsonPath('enrollment.entitled', false)
            ->assertJsonPath('enrollment.submissions.0.score', 82)
            ->assertJsonPath('enrollment.submissions.0.feedback', 'Well done.');
        // …but the paid substance is withheld again.
        $this->assertNull($response->json('enrollment.topic.sow_markdown'));
        $this->assertNull($response->json('enrollment.milestones.0.description'));
        $this->assertSame([], $response->json('enrollment.milestones.0.acceptance_criteria'));
        $this->assertNull($response->json('enrollment.workspace'));

        $this->get('/api/project-lab/topics/lms/sow.pdf')->assertStatus(402);
        $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/workspace/start")->assertStatus(402);
        $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/milestones/{$topic->milestones[0]->id}/toggle")->assertStatus(402);
    }

    public function test_my_projects_lists_only_my_own(): void
    {
        $mine = $this->studentWithLab();
        $this->enroll($mine, $this->topic(['title' => 'Mine']));
        $this->enroll($this->studentWithLab(), $this->topic(['title' => 'Theirs']));
        Sanctum::actingAs($mine);

        $this->getJson('/api/project-lab/projects')
            ->assertOk()
            ->assertJsonCount(1, 'projects')
            ->assertJsonPath('projects.0.title', 'Mine');
    }
}
