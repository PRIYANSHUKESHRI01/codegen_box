<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\CoordinatorNote;
use App\Models\GeneratedReport;
use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\ReadinessSnapshot;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The Section Coordinator's dashboard numbers beyond the roster, and the section report PDF — each scoped to the coordinator's own
 * students (the one scope rule), never another section's, another college's, or another branch's.
 */
class CoordinatorInsightsTest extends TestCase
{
    use RefreshDatabase;

    private College $college;

    private College $other;

    private User $coordinator;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        $this->college = College::create(['name' => 'Insight College', 'short_code' => 'IC']);
        $this->other = College::create(['name' => 'Other College', 'short_code' => 'OC']);
        $this->coordinator = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $this->college->id, 'section' => 'CSE_A', 'must_change_password' => false]);
    }

    private function student(?string $section = 'CSE_A', ?College $college = null, array $over = []): User
    {
        $n = ++$this->seq;

        return User::factory()->create(array_merge([
            'name' => "Student {$n}", 'role' => User::ROLE_USER, 'college_id' => ($college ?? $this->college)->id, 'branch' => 'CSE', 'section' => $section,
            'must_change_password' => false, 'roll_number' => "R{$n}",
        ], $over));
    }

    private function snapshot(User $u, int $daysAgo, int $score, bool $active = true): void
    {
        ReadinessSnapshot::create(['user_id' => $u->id, 'snapshot_date' => now()->subDays($daysAgo)->toDateString(), 'score' => $score, 'base_score' => $score, 'penalty' => 0, 'missed_days' => 0, 'active_today' => $active]);
    }

    public function test_the_trend_and_movers_count_only_the_coordinators_own_students(): void
    {
        $a = $this->student();
        $b = $this->student();
        $outsider = $this->student('ECE_A');
        $foreign = $this->student('CSE_A', $this->other);

        foreach ([$a, $b] as $s) {
            $this->snapshot($s, 14, 40);
            $this->snapshot($s, 0, $s->is($a) ? 70 : 30);
        }
        $this->snapshot($outsider, 14, 90);
        $this->snapshot($outsider, 0, 95);
        $this->snapshot($foreign, 0, 100);

        Sanctum::actingAs($this->coordinator);
        $res = $this->getJson('/api/coordinator/insights')->assertOk();

        $points = $res->json('trend.points');
        $this->assertSame(2, $points[0]['tracked']);
        $this->assertSame(40, $points[0]['average']);
        $this->assertSame(50, end($points)['average'], '(70 + 30) / 2: the outsider and the other college never enter');
        $this->assertSame(10, $res->json('trend.change_7d'));

        $this->assertSame([$a->id], array_column($res->json('movers.improved'), 'student_id'));
        $this->assertSame(30, $res->json('movers.improved.0.change'));
        $this->assertSame([$b->id], array_column($res->json('movers.slipped'), 'student_id'));
    }

    public function test_follow_ups_list_only_open_notes_of_the_section_with_their_urgency(): void
    {
        $a = $this->student();
        $outsider = $this->student('ECE_A');
        $author = $this->coordinator;

        $mk = fn (User $s, array $over) => CoordinatorNote::create($over + ['college_id' => $this->college->id, 'student_id' => $s->id, 'author_id' => $author->id, 'kind' => 'call', 'body' => 'Spoke to student']);

        $mk($a, ['follow_up_on' => now()->subDays(2)->toDateString(), 'body' => 'overdue one']);
        $mk($a, ['follow_up_on' => now()->toDateString(), 'body' => 'today one']);
        $mk($a, ['follow_up_on' => now()->addDays(3)->toDateString(), 'body' => 'later one']);
        $mk($a, ['body' => 'no date']);
        $mk($a, ['follow_up_on' => now()->subDay()->toDateString(), 'body' => 'done already', 'resolved_at' => now()]);
        $mk($outsider, ['follow_up_on' => now()->toDateString(), 'body' => 'someone else']);

        Sanctum::actingAs($this->coordinator);
        $items = $this->getJson('/api/coordinator/insights')->assertOk()->json('follow_ups');

        $this->assertSame(['overdue one', 'today one', 'later one', 'no date'], array_column($items, 'body'));
        $this->assertSame(['overdue', 'today', 'upcoming', 'no_date'], array_column($items, 'status'));
    }

    public function test_scheduled_interviews_show_how_much_of_the_section_has_done_them(): void
    {
        $done = $this->student();
        $partway = $this->student();
        $todo = $this->student();
        $blocked = $this->student('CSE_A', null, ['is_blocked' => true]);
        $otherSection = $this->student('ECE_A');

        $mine = Interview::create(['title' => 'Section mock', 'slug' => 'section-mock', 'status' => 'published', 'interview_type' => 'tpo_mock', 'owning_college_id' => $this->college->id, 'opens_at' => now()->subDay(), 'closes_at' => now()->addDays(2)]);
        // Aimed at another section: nothing to report for this one.
        Interview::create(['title' => 'Not for us', 'slug' => 'not-for-us', 'status' => 'published', 'interview_type' => 'tpo_mock', 'owning_college_id' => $this->college->id, 'audience_filter' => ['years' => [], 'sections' => ['ECE_A'], 'student_ids' => []]]);

        InterviewSession::create(['interview_id' => $mine->id, 'user_id' => $done->id, 'status' => 'completed', 'started_at' => now()->subHour(), 'completed_at' => now(), 'current_question_order' => 2, 'composite_score_percent' => 80, 'ai_scored_at' => now()]);
        InterviewSession::create(['interview_id' => $mine->id, 'user_id' => $partway->id, 'status' => 'in_progress', 'started_at' => now(), 'current_question_order' => 1]);
        InterviewSession::create(['interview_id' => $mine->id, 'user_id' => $otherSection->id, 'status' => 'completed', 'started_at' => now()->subHour(), 'completed_at' => now(), 'current_question_order' => 2, 'composite_score_percent' => 10, 'ai_scored_at' => now()]);

        Sanctum::actingAs($this->coordinator);
        $events = $this->getJson('/api/coordinator/insights')->assertOk()->json('events');

        $this->assertCount(1, $events);
        $e = $events[0];
        $this->assertSame('Section mock', $e['title']);
        $this->assertSame(4, $e['in_section']);
        $this->assertSame(1, $e['completed']);
        $this->assertSame(1, $e['in_progress']);
        $this->assertSame(1, $e['not_started'], 'the blocked student is not asked to do it');
        $this->assertSame([$todo->id], array_column($e['not_started_students'], 'id'));
        $this->assertSame(80, $e['average_score'], 'the other section\'s 10% never enters');
        $this->assertNotContains($blocked->id, array_column($e['not_started_students'], 'id'));
    }

    public function test_a_branch_scoped_coordinator_sees_only_their_branch_in_every_number(): void
    {
        $cse = $this->student('CSE_A', null, ['branch' => 'CSE']);
        $ece = $this->student('CSE_A', null, ['branch' => 'ECE']);
        $this->snapshot($cse, 0, 80);
        $this->snapshot($ece, 0, 20);

        $scoped = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $this->college->id, 'section' => 'CSE_A', 'must_change_password' => false]);
        $scoped->forceFill(['coordinator_scope' => ['disciplines' => ['cse'], 'branches' => []]])->save();

        Sanctum::actingAs($scoped);
        $res = $this->getJson('/api/coordinator/insights')->assertOk();
        $this->assertSame(1, $res->json('trend.points.0.tracked'));
        $this->assertSame(80, $res->json('trend.points.0.average'));
        $this->assertNotNull($ece->id);
    }

    public function test_an_empty_section_gets_empty_series_not_errors(): void
    {
        Sanctum::actingAs($this->coordinator);
        $res = $this->getJson('/api/coordinator/insights')->assertOk();

        $this->assertSame([], $res->json('trend.points'));
        $this->assertSame([], $res->json('movers.improved'));
        $this->assertSame([], $res->json('follow_ups'));
        $this->assertSame([], $res->json('events'));

        $this->postJson('/api/coordinator/reports/section')->assertStatus(422);
    }

    public function test_the_college_comparison_reads_the_whole_college_only(): void
    {
        $mine = $this->student('CSE_A');
        $mate = $this->student('ECE_A');
        $foreign = $this->student('CSE_A', $this->other);
        $this->snapshot($mine, 0, 60);
        $this->snapshot($mate, 0, 40);
        $this->snapshot($foreign, 0, 100);

        Sanctum::actingAs($this->coordinator);
        $college = $this->getJson('/api/coordinator/insights')->assertOk()->json('college');

        $this->assertSame(50, $college['average']);
        $this->assertSame(2, $college['students']);
    }

    public function test_only_a_coordinator_reaches_the_insights(): void
    {
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $this->college->id, 'must_change_password' => false]);
        $student = $this->student();

        Sanctum::actingAs($tpo);
        $this->getJson('/api/coordinator/insights')->assertForbidden();
        Sanctum::actingAs($student);
        $this->getJson('/api/coordinator/insights')->assertForbidden();
    }

    // ───────────────────────────── the section report ─────────────────────────────

    public function test_a_coordinator_makes_the_section_report_as_a_stored_pdf_of_their_own_students(): void
    {
        $a = $this->student();
        $this->student();
        $this->student('ECE_A');
        $this->snapshot($a, 5, 50);
        $this->snapshot($a, 0, 62);

        Sanctum::actingAs($this->coordinator);
        $res = $this->postJson('/api/coordinator/reports/section')->assertCreated();

        $this->assertSame('section_report', $res->json('report.kind'));
        $this->assertSame('Section CSE_A — performance report', $res->json('report.title'));
        $this->assertSame(2, $res->json('report.summary.students'), 'only the two CSE_A students');

        $file = $this->get('/api/coordinator/reports/'.$res->json('report.id').'/download')->assertOk();
        $this->assertStringStartsWith('%PDF-', $file->streamedContent());

        $this->assertCount(1, $this->getJson('/api/coordinator/reports/section')->json('reports'));

        // A different coordinator of the same college cannot open it.
        $mate = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $this->college->id, 'section' => 'ECE_A', 'must_change_password' => false]);
        Sanctum::actingAs($mate);
        $this->get('/api/coordinator/reports/'.$res->json('report.id').'/download')->assertNotFound();
        $this->assertCount(0, $this->getJson('/api/coordinator/reports/section')->json('reports'));
    }

    public function test_the_tpo_makes_a_section_report_for_any_section_of_their_college_and_finds_it_in_the_archive(): void
    {
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $this->college->id, 'must_change_password' => false]);
        $this->student('ECE_B');
        $this->student('ECE_B', null, ['branch' => 'ECE']);
        $this->student('CSE_A');
        $this->student(null, null, ['section' => null]);
        $foreign = $this->student('ECE_B', $this->other);

        Sanctum::actingAs($tpo);
        $res = $this->postJson('/api/tpo/reports/section', ['section' => 'ece_b'])->assertCreated();
        $this->assertSame(2, $res->json('report.summary.students'));

        $none = $this->postJson('/api/tpo/reports/section', ['section' => '__none__'])->assertCreated();
        $this->assertSame(1, $none->json('report.summary.students'));

        $this->postJson('/api/tpo/reports/section', ['section' => 'NOPE'])->assertNotFound();
        $this->postJson('/api/tpo/reports/section', [])->assertStatus(422);

        $archive = $this->getJson('/api/tpo/reports/archive?kind=section_report')->assertOk();
        $this->assertCount(2, $archive->json('reports'));
        $this->assertNotNull($foreign->id);
        $this->assertSame(2, GeneratedReport::where('kind', 'section_report')->where('college_id', $this->college->id)->count());
    }

    public function test_the_section_pdf_renders_with_events_follow_ups_and_no_history(): void
    {
        $a = $this->student();
        $b = $this->student('CSE_A', null, ['is_blocked' => true]);
        CoordinatorNote::create(['college_id' => $this->college->id, 'student_id' => $a->id, 'author_id' => $this->coordinator->id, 'kind' => 'call', 'body' => 'Check on attendance', 'follow_up_on' => now()->subDay()->toDateString()]);
        $interview = Interview::create(['title' => 'Mock', 'slug' => 'mock-x', 'status' => 'published', 'interview_type' => 'tpo_mock', 'owning_college_id' => $this->college->id]);
        InterviewSession::create(['interview_id' => $interview->id, 'user_id' => $a->id, 'status' => 'completed', 'started_at' => now()->subHour(), 'completed_at' => now(), 'current_question_order' => 1, 'composite_score_percent' => 66, 'ai_scored_at' => now()]);

        $data = app(\App\Services\Reports\SectionReportComposer::class)->compose($this->coordinator, User::coordinatedBy($this->coordinator)->get(), 'CSE_A', 'CSE');
        $this->assertSame(2, $data['summary']['size']);
        $this->assertCount(1, $data['events']);

        $rendered = app(\App\Services\Reports\PdfRenderer::class)->render('reports.section', ['data' => $data], 'Report AR-TEST');
        $this->assertStringStartsWith('%PDF-', $rendered['binary']);
        $this->assertNotNull($b->id);
    }
}
