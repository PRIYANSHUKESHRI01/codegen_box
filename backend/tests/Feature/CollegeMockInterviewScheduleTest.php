<?php

namespace Tests\Feature;

use App\Jobs\SendMockInterviewMail;
use App\Models\College;
use App\Models\GeneratedReport;
use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Models\MockInterviewQuestion;
use App\Models\Plan;
use App\Models\User;
use App\Services\Interviews\InterviewAudience;
use App\Services\Interviews\MockInterviewScheduler;
use App\Services\SubscriptionService;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * A college TPO's mock AI interview with a schedule, an audience (years / sections / named students), reminders, a question
 * library and the results with their PDF reports — and the rules that keep every one of those inside the TPO's own college.
 */
class CollegeMockInterviewScheduleTest extends TestCase
{
    use RefreshDatabase;

    private College $college;

    private College $other;

    private User $tpo;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Mail::fake();
        $this->seed(PlanSeeder::class);

        $this->college = College::create(['name' => 'Schedule College', 'short_code' => 'SCH']);
        $this->other = College::create(['name' => 'Other College', 'short_code' => 'OTH']);
        $this->tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $this->college->id, 'must_change_password' => false]);
    }

    private function student(string $section, ?College $college = null, array $over = []): User
    {
        $n = ++$this->seq;
        $student = User::factory()->create(array_merge([
            'name' => "Student {$n} {$section}", 'role' => User::ROLE_USER, 'college_id' => ($college ?? $this->college)->id,
            'branch' => 'CSE', 'section' => $section, 'must_change_password' => false, 'roll_number' => "R{$n}",
        ], $over));

        // The student-side start needs a plan that includes AI interviews.
        app(SubscriptionService::class)->grantIndividualPlan($student, Plan::where('code', Plan::CODE_EXPERT)->firstOrFail(), User::factory()->create(['role' => User::ROLE_SUPERADMIN]), [
            'days' => 365, 'kind' => 'complimentary', 'reason' => 'Test',
        ]);

        return $student->fresh();
    }

    private function question(Interview $interview, string $text, string $category = 'technical'): InterviewQuestion
    {
        $bank = InterviewQuestionBank::create(['question_text' => $text, 'category' => $category, 'difficulty' => 'medium', 'expected_duration_seconds' => 60]);

        return InterviewQuestion::create(['interview_id' => $interview->id, 'interview_question_bank_id' => $bank->id, 'display_order' => $interview->interviewQuestions()->count()]);
    }

    private function interview(array $over = []): Interview
    {
        $interview = Interview::create(array_merge([
            'title' => 'DBMS Mock '.++$this->seq, 'slug' => 'dbms-mock-'.$this->seq, 'status' => 'published', 'interview_type' => 'tpo_mock',
            'owning_college_id' => $this->college->id, 'created_by' => $this->tpo->id,
        ], $over));
        $this->question($interview, 'Explain normalization up to 3NF with an example.');
        $this->question($interview, 'What is the difference between a clustered and a non-clustered index?', 'technical');

        return $interview->fresh();
    }

    // ───────────────────────────── create / publish ─────────────────────────────

    public function test_tpo_creates_a_scheduled_interview_and_foreign_students_are_dropped(): void
    {
        $mine = $this->student('CSE_A');
        $foreign = $this->student('CSE_A', $this->other);

        Sanctum::actingAs($this->tpo);
        $res = $this->postJson('/api/tpo/interviews', [
            'title' => 'Placement Mock 1',
            'opens_at' => now()->addDays(2)->toIso8601String(),
            'closes_at' => now()->addDays(4)->toIso8601String(),
            'qualifying_score_percent' => 65,
            'audience_filter' => ['years' => [3], 'sections' => ['CSE_A', 'CSE_B'], 'student_ids' => [$mine->id, $foreign->id]],
        ])->assertCreated();

        $this->assertSame('draft', $res->json('interview.status'));
        $this->assertSame('upcoming', $res->json('interview.schedule_state'));
        $this->assertEquals([$mine->id], $res->json('interview.audience_filter.student_ids'));
        $this->assertEquals([3], $res->json('interview.audience_filter.years'));
        $this->assertSame(65, (int) $res->json('interview.qualifying_score_percent'));
    }

    public function test_the_window_must_close_after_it_opens_and_an_empty_interview_cannot_be_published(): void
    {
        Sanctum::actingAs($this->tpo);

        $this->postJson('/api/tpo/interviews', ['title' => 'Bad window', 'opens_at' => now()->addDay()->toIso8601String(), 'closes_at' => now()->toIso8601String()])
            ->assertStatus(422)->assertJsonValidationErrors('closes_at');

        $id = $this->postJson('/api/tpo/interviews', ['title' => 'Empty one'])->assertCreated()->json('interview.slug');
        $this->postJson("/api/tpo/interviews/{$id}", ['status' => 'published'])->assertStatus(422)->assertJsonFragment(['message' => 'Add at least one question before publishing: students would open an empty interview.']);
    }

    // ───────────────────────────── who sees it ─────────────────────────────

    public function test_the_audience_decides_who_sees_and_who_is_counted(): void
    {
        $a = $this->student('CSE_A');
        $b = $this->student('CSE_B');
        $named = $this->student('ECE_A');
        $outsider = $this->student('CSE_A', $this->other);

        $interview = $this->interview(['audience_filter' => ['years' => [], 'sections' => ['cse_a'], 'student_ids' => [$named->id]]]);

        $audience = app(InterviewAudience::class);
        $this->assertEqualsCanonicalizing([$a->id, $named->id], $audience->ids($interview));

        $this->assertTrue($interview->isVisibleToUser($a));
        $this->assertTrue($interview->isVisibleToUser($named), 'a named student is in whatever their section says');
        $this->assertFalse($interview->isVisibleToUser($b));
        $this->assertFalse($interview->isVisibleToUser($outsider), 'never another college');

        // The list a student gets agrees with the rule.
        Sanctum::actingAs($a);
        $this->assertContains($interview->slug, array_column($this->getJson('/api/interviews')->json('interviews'), 'slug'));
        Sanctum::actingAs($b);
        $this->assertNotContains($interview->slug, array_column($this->getJson('/api/interviews')->json('interviews'), 'slug'));
        $this->getJson("/api/interviews/{$interview->slug}")->assertNotFound();
    }

    public function test_a_named_list_with_nothing_else_is_invite_only(): void
    {
        $named = $this->student('CSE_A');
        $other = $this->student('CSE_A');
        $interview = $this->interview(['audience_filter' => ['years' => [], 'sections' => [], 'student_ids' => [$named->id]]]);

        $this->assertSame([$named->id], app(InterviewAudience::class)->ids($interview));
        $this->assertTrue($interview->isVisibleToUser($named));
        $this->assertFalse($interview->isVisibleToUser($other));
    }

    public function test_no_audience_means_the_whole_college_exactly_as_before(): void
    {
        $a = $this->student('CSE_A');
        $b = $this->student('ECE_B');
        $interview = $this->interview();

        $this->assertEqualsCanonicalizing([$a->id, $b->id], app(InterviewAudience::class)->ids($interview));
        $this->assertSame('Every student of your college', app(InterviewAudience::class)->describe($interview));
    }

    public function test_audience_preview_counts_by_section_and_stays_in_the_college(): void
    {
        $this->student('CSE_A');
        $this->student('CSE_A');
        $this->student('CSE_B');
        $this->student('CSE_A', $this->other);

        Sanctum::actingAs($this->tpo);
        $all = $this->postJson('/api/tpo/interviews/audience-preview', [])->assertOk();
        $this->assertSame(3, $all->json('count'));

        $one = $this->postJson('/api/tpo/interviews/audience-preview', ['audience_filter' => ['sections' => ['CSE_A']]])->assertOk();
        $this->assertSame(2, $one->json('count'));
        $this->assertSame('Section CSE_A', $one->json('label'));
        $this->assertSame([['section' => 'CSE_A', 'count' => 2]], $one->json('sections'));
    }

    // ───────────────────────────── the window ─────────────────────────────

    public function test_students_cannot_start_before_it_opens_or_after_it_closes_but_can_finish_a_started_sitting(): void
    {
        $early = $this->student('CSE_A');
        $late = $this->student('CSE_A');
        $midway = $this->student('CSE_A');

        $upcoming = $this->interview(['opens_at' => now()->addHours(3), 'closes_at' => now()->addDays(1)]);
        Sanctum::actingAs($early);
        $res = $this->postJson("/api/interviews/{$upcoming->slug}/start")->assertStatus(423);
        $this->assertSame('interview_not_open_yet', $res->json('code'));
        $this->assertSame('upcoming', $this->getJson("/api/interviews/{$upcoming->slug}")->json('schedule_state'));

        $closed = $this->interview(['opens_at' => now()->subDays(2), 'closes_at' => now()->subHour()]);
        Sanctum::actingAs($late);
        $res = $this->postJson("/api/interviews/{$closed->slug}/start")->assertStatus(410);
        $this->assertSame('interview_closed', $res->json('code'));

        // Someone already part-way through when it closed may carry on.
        InterviewSession::create(['interview_id' => $closed->id, 'user_id' => $midway->id, 'status' => 'in_progress', 'started_at' => now()->subHours(3), 'current_question_order' => 0]);
        Sanctum::actingAs($midway);
        $this->postJson("/api/interviews/{$closed->slug}/start")->assertOk();

        $open = $this->interview(['opens_at' => now()->subHour(), 'closes_at' => now()->addHours(5)]);
        Sanctum::actingAs($early);
        $this->postJson("/api/interviews/{$open->slug}/start")->assertOk();
    }

    // ───────────────────────────── telling students ─────────────────────────────

    public function test_publishing_emails_exactly_the_audience_and_a_blocked_student_is_skipped(): void
    {
        Bus::fake();
        $a = $this->student('CSE_A');
        $blocked = $this->student('CSE_A', null, ['is_blocked' => true]);
        $this->student('CSE_B');

        $interview = $this->interview(['status' => 'draft', 'audience_filter' => ['years' => [], 'sections' => ['CSE_A'], 'student_ids' => []]]);

        Sanctum::actingAs($this->tpo);
        $this->postJson("/api/tpo/interviews/{$interview->slug}", ['status' => 'published'])->assertOk();

        Bus::assertBatched(function ($batch) use ($a, $blocked) {
            $ids = $batch->jobs->map(fn ($j) => $j->userId)->all();

            return $batch->jobs->first() instanceof SendMockInterviewMail && $ids === [$a->id] && ! in_array($blocked->id, $ids, true);
        });
    }

    public function test_reminders_go_out_once_and_closing_reminders_skip_those_who_finished(): void
    {
        Bus::fake();
        $done = $this->student('CSE_A');
        $todo = $this->student('CSE_A');

        $interview = $this->interview(['opens_at' => now()->addMinutes(30), 'closes_at' => now()->addDays(2)]);
        $scheduler = app(MockInterviewScheduler::class);

        $first = $scheduler->sendDueReminders();
        $this->assertSame(2, $first['opening']);
        $this->assertSame(0, $scheduler->sendDueReminders()['opening'], 'once per schedule');

        // Later: it is open and about to close; one student has finished.
        $interview->forceFill(['opens_at' => now()->subDay(), 'closes_at' => now()->addHour(), 'open_reminder_sent_at' => now()])->save();
        InterviewSession::create(['interview_id' => $interview->id, 'user_id' => $done->id, 'status' => 'completed', 'started_at' => now()->subHour(), 'completed_at' => now()->subMinutes(30), 'current_question_order' => 2, 'composite_score_percent' => 70, 'ai_scored_at' => now()]);

        $second = $scheduler->sendDueReminders();
        $this->assertSame(1, $second['closing']);
        $this->assertSame(0, $scheduler->sendDueReminders()['closing']);

        // A new schedule is reminded about afresh.
        Sanctum::actingAs($this->tpo);
        $this->postJson("/api/tpo/interviews/{$interview->slug}", ['closes_at' => now()->addHours(2)->toIso8601String()])->assertOk();
        $this->assertNull($interview->fresh()->close_reminder_sent_at);
        $this->assertNotNull($todo->id);
    }

    // ───────────────────────────── the library ─────────────────────────────

    public function test_questions_can_be_drawn_from_the_library_without_repeats_and_within_the_limit(): void
    {
        for ($i = 1; $i <= 12; $i++) {
            MockInterviewQuestion::create(['stack_key' => 'laravel', 'round_number' => 1 + ($i % 3), 'position' => $i, 'text' => "Library question number {$i} about Laravel routing and middleware", 'category' => 'technical', 'duration_seconds' => 90]);
        }

        Sanctum::actingAs($this->tpo);
        $draft = $this->postJson('/api/tpo/interviews', ['title' => 'From library'])->assertCreated()->json('interview.slug');

        $lib = $this->getJson('/api/tpo/interviews/library')->assertOk();
        $stack = collect($lib->json('domains'))->flatMap(fn ($d) => $d['stacks'])->firstWhere('key', 'laravel');
        $this->assertNotNull($stack);
        $this->assertSame(12, $stack['questions']);

        $first = $this->postJson("/api/tpo/interviews/{$draft}/library-questions", ['stack_key' => 'laravel', 'count' => 8])->assertOk();
        $this->assertSame(8, $first->json('added'));

        // Asking for more than is left adds only what is new: no repeats.
        $second = $this->postJson("/api/tpo/interviews/{$draft}/library-questions", ['stack_key' => 'laravel', 'count' => 10])->assertOk();
        $this->assertSame(4, $second->json('added'));
        $this->assertSame(12, Interview::where('slug', $draft)->first()->interviewQuestions()->count());

        $this->postJson("/api/tpo/interviews/{$draft}/library-questions", ['stack_key' => 'no_such_stack', 'count' => 3])->assertStatus(422);
        $this->postJson("/api/tpo/interviews/{$draft}/library-questions", ['stack_key' => 'Bad Key!', 'count' => 3])->assertStatus(422);
    }

    public function test_an_interview_students_have_started_keeps_its_questions_and_can_be_duplicated(): void
    {
        $student = $this->student('CSE_A');
        $interview = $this->interview();
        InterviewSession::create(['interview_id' => $interview->id, 'user_id' => $student->id, 'status' => 'in_progress', 'started_at' => now(), 'current_question_order' => 0]);

        Sanctum::actingAs($this->tpo);
        $this->postJson("/api/tpo/interviews/{$interview->slug}/library-questions", ['stack_key' => 'laravel', 'count' => 2])->assertStatus(422);

        $copy = $this->postJson("/api/tpo/interviews/{$interview->slug}/duplicate")->assertCreated();
        $this->assertSame('draft', $copy->json('interview.status'));
        $this->assertSame(2, $copy->json('interview.question_count'));
        $this->assertSame(0, $copy->json('interview.sessions_count'));
    }

    // ───────────────────────────── results & reports ─────────────────────────────

    private function sitting(Interview $interview, User $student, float $score, array $scores = [80, 60]): InterviewSession
    {
        $session = InterviewSession::create([
            'interview_id' => $interview->id, 'user_id' => $student->id, 'status' => 'completed', 'invited_at' => now()->subDay(),
            'started_at' => now()->subHours(2), 'completed_at' => now()->subHours(2)->addMinutes(18), 'current_question_order' => 2,
            'composite_score_percent' => $score, 'ai_scored_at' => now(),
        ]);

        foreach ($interview->interviewQuestions()->orderBy('display_order')->get() as $i => $q) {
            InterviewResponse::create(['interview_session_id' => $session->id, 'interview_question_id' => $q->id, 'transcript_text' => 'My spoken answer '.($i + 1), 'answered_at' => now(), 'score' => $scores[$i] ?? 50, 'review_notes' => 'You explained it clearly.', 'ai_scored' => true]);
        }

        return $session;
    }

    public function test_results_count_who_took_it_who_did_not_and_how_it_went(): void
    {
        $a = $this->student('CSE_A');
        $b = $this->student('CSE_A');
        $c = $this->student('CSE_A');
        $this->student('CSE_B');

        $interview = $this->interview(['qualifying_score_percent' => 70, 'audience_filter' => ['years' => [], 'sections' => ['CSE_A'], 'student_ids' => []]]);
        $this->sitting($interview, $a, 84, [90, 78]);
        $this->sitting($interview, $b, 52, [60, 44]);

        Sanctum::actingAs($this->tpo);
        $r = $this->getJson("/api/tpo/interviews/{$interview->slug}/results")->assertOk();

        $this->assertSame(3, $r->json('participation.audience'));
        $this->assertSame(2, $r->json('participation.completed'));
        $this->assertSame(1, $r->json('participation.not_started'));
        $this->assertSame(67, $r->json('participation.completion_rate'));
        $this->assertEquals(68.0, $r->json('scores.average'));
        $this->assertSame(50, $r->json('scores.pass_rate'), 'one of two reached the 70% target');
        $this->assertSame($a->id, $r->json('students.0.student_id'), 'ranked best first');
        $this->assertSame(1, $r->json('students.0.rank'));
        $this->assertSame([$c->id], array_column($r->json('not_attempted'), 'student_id'));
        $this->assertSame('Strong', $r->json('students.0.tier'));
        $this->assertSame('Developing', $r->json('students.1.tier'));
        $this->assertNotEmpty($r->json('insights'));
        $this->assertSame(['label' => '80–100', 'count' => 1], $r->json('scores.distribution.3'));
    }

    public function test_the_cohort_pdf_and_one_students_pdf_are_stored_and_scoped(): void
    {
        $a = $this->student('CSE_A');
        $interview = $this->interview();
        $session = $this->sitting($interview, $a, 84, [90, 78]);

        Sanctum::actingAs($this->tpo);
        $cohort = $this->postJson("/api/tpo/interviews/{$interview->slug}/report")->assertCreated();
        $one = $this->postJson("/api/tpo/interviews/{$interview->slug}/sessions/{$session->id}/report")->assertCreated();

        $this->assertSame('interview_report', $cohort->json('report.kind'));
        $this->assertSame('interview_session_report', $one->json('report.kind'));
        $this->assertSame($a->name, $one->json('report.student.name'));

        foreach ([$cohort, $one] as $res) {
            $file = $this->get('/api/tpo/reports/'.$res->json('report.id').'/download');
            $file->assertOk();
            $this->assertStringStartsWith('%PDF-', $file->streamedContent());
        }

        $this->assertCount(2, $this->getJson("/api/tpo/interviews/{$interview->slug}/reports")->json('reports'));
        $this->assertCount(2, GeneratedReport::where('college_id', $this->college->id)->get());

        // Another college's TPO reaches none of it.
        $theirTpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $this->other->id, 'must_change_password' => false]);
        Sanctum::actingAs($theirTpo);
        $this->getJson("/api/tpo/interviews/{$interview->slug}/results")->assertNotFound();
        $this->postJson("/api/tpo/interviews/{$interview->slug}/report")->assertNotFound();
        $this->get('/api/tpo/reports/'.$cohort->json('report.id').'/download')->assertNotFound();
        $this->postJson("/api/tpo/interviews/{$interview->slug}/sessions/{$session->id}/report")->assertNotFound();
    }

    public function test_a_student_gets_their_own_result_pdf_only_once_it_is_finished_and_marked(): void
    {
        $a = $this->student('CSE_A');
        $b = $this->student('CSE_A');
        $interview = $this->interview();

        Sanctum::actingAs($a);
        $this->postJson("/api/me/interviews/{$interview->slug}/report")->assertNotFound(); // no session yet

        InterviewSession::create(['interview_id' => $interview->id, 'user_id' => $a->id, 'status' => 'in_progress', 'started_at' => now(), 'current_question_order' => 1]);
        $this->postJson("/api/me/interviews/{$interview->slug}/report")->assertStatus(422);

        InterviewSession::where('user_id', $a->id)->delete();
        $this->sitting($interview, $a, 84, [90, 78]);
        $this->sitting($interview, $b, 40, [30, 50]);

        $res = $this->postJson("/api/me/interviews/{$interview->slug}/report")->assertCreated();
        $this->assertSame('student', $res->json('report.audience'));
        $this->get('/api/me/reports/'.$res->json('report.id').'/download')->assertOk();

        $mine = $this->getJson('/api/me/reports?kind=interview_session_report')->assertOk()->json('reports');
        $this->assertCount(1, $mine);

        // Never someone else's.
        Sanctum::actingAs($b);
        $this->get('/api/me/reports/'.$res->json('report.id').'/download')->assertNotFound();
    }

    public function test_the_pdfs_render_with_no_students_and_with_a_failed_scoring(): void
    {
        $interview = $this->interview();
        $reports = app(\App\Services\Reports\MockInterviewReportService::class);
        $pdf = app(\App\Services\Reports\PdfRenderer::class);

        $empty = $reports->cohort($interview);
        $this->assertSame(0, $empty['participation']['completed']);
        $this->assertStringStartsWith('%PDF-', $pdf->render('reports.interview', ['data' => $empty], 'Report AR-TEST')['binary']);

        $student = $this->student('CSE_A');
        $session = InterviewSession::create(['interview_id' => $interview->id, 'user_id' => $student->id, 'status' => 'completed', 'started_at' => now()->subHour(), 'completed_at' => now(), 'current_question_order' => 2, 'scoring_failed_at' => now()]);
        $data = $reports->sitting($session);
        $this->assertNull($data['result']['score']);
        $this->assertTrue($data['result']['scoring_failed']);
        $this->assertStringStartsWith('%PDF-', $pdf->render('reports.interview-session', ['data' => $data], 'Report AR-TEST')['binary']);
    }

    public function test_the_study_year_filter_uses_the_passing_out_year(): void
    {
        $year3 = $this->student('CSE_A', null, ['graduation_year' => \App\Support\AcademicYear::graduationYearFor(3)]);
        $year1 = $this->student('CSE_A', null, ['graduation_year' => \App\Support\AcademicYear::graduationYearFor(1)]);
        $none = $this->student('CSE_A');

        $interview = $this->interview(['audience_filter' => ['years' => [3], 'sections' => [], 'student_ids' => []]]);

        $this->assertSame([$year3->id], app(InterviewAudience::class)->ids($interview));
        $this->assertTrue($interview->isVisibleToUser($year3));
        $this->assertFalse($interview->isVisibleToUser($year1));
        $this->assertFalse($interview->isVisibleToUser($none));
        $this->assertNotNull(Queue::getFacadeRoot());
    }
}
