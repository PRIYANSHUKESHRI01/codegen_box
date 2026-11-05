<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\GeneratedReport;
use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Models\Plan;
use App\Models\User;
use App\Models\VaultAiResult;
use App\Models\VaultInterviewQualification;
use App\Services\InterviewTrackAdvancementService;
use App\Services\Reports\VaultAiReportService;
use App\Services\SubscriptionService;
use App\Support\AcademicYear;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The Vault AI Interview report: the final average of the three sets of every completed series is recorded per student and stack, the
 * best series survives a second go (even an admin's fresh start), and a PDF report of it is generated, stored in the archive and
 * readable only by the people who may read the student.
 */
class VaultAiResultsTest extends TestCase
{
    use RefreshDatabase;

    private const STACK = 'laravel';

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        Storage::fake('local');
        $this->seed(PlanSeeder::class);
        config(['vault.sync_url' => 'https://vault.example.test/hook', 'vault.sync_secret' => 'secret']);
    }

    private function college(string $name = 'Apex Institute'): College
    {
        return College::create(['name' => $name, 'short_code' => strtoupper(substr($name, 0, 4)), 'city' => 'Pune']);
    }

    private function student(?College $college = null): User
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE', 'college_id' => $college?->id, 'name' => 'Asha Rao', 'roll_number' => 'A-12', 'graduation_year' => AcademicYear::graduationYearFor(3), 'vault_ai_unlocked_at' => now()->subDay()]);
        $plan = Plan::where('code', Plan::CODE_EXPERT)->firstOrFail();
        app(SubscriptionService::class)->grantIndividualPlan($student, $plan, User::factory()->create(['role' => User::ROLE_SUPERADMIN]), [
            'days' => 365, 'kind' => 'complimentary', 'reason' => 'Test',
        ]);

        return $student->fresh();
    }

    private function tpo(College $college): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
    }

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
    }

    private function playSet(User $student, int $set, int $score): Interview
    {
        Sanctum::actingAs($student);
        $res = $this->postJson('/api/vault-qualification/start-set', ['stack' => self::STACK, 'set_number' => $set])->assertOk();
        $interview = Interview::findOrFail($res->json('interview.id'));

        $session = InterviewSession::create([
            'interview_id' => $interview->id, 'user_id' => $student->id, 'status' => InterviewSession::STATUS_COMPLETED,
            'started_at' => now()->subMinutes(15), 'completed_at' => now(), 'current_question_order' => 5,
        ]);

        foreach (InterviewQuestion::where('interview_id', $interview->id)->get() as $q) {
            InterviewResponse::create([
                'interview_session_id' => $session->id, 'interview_question_id' => $q->id, 'transcript_text' => 'An answer about queues and jobs.',
                'answered_at' => now(), 'score' => $score, 'scored_at' => now(), 'ai_scored' => true, 'review_notes' => 'Clear, but name the retry strategy.',
            ]);
        }

        app(InterviewTrackAdvancementService::class)->finalizeStandaloneScoring($session->fresh());

        return $interview;
    }

    /** One whole series of three sets, each scored `$score`. */
    private function series(User $student, int $score): void
    {
        foreach ([1, 2, 3] as $set) {
            $this->playSet($student, $set, $score);
        }
    }

    private function resultOf(User $student): VaultAiResult
    {
        return VaultAiResult::where('user_id', $student->id)->where('stack_key', self::STACK)->firstOrFail();
    }

    // -------------------------------------------------------------------- recording

    public function test_a_completed_series_is_recorded_with_its_final_average_and_a_report_is_stored(): void
    {
        $student = $this->student($this->college());

        $this->series($student, 40);

        $r = $this->resultOf($student);
        $this->assertEquals(40.0, $r->best_average);
        $this->assertSame(['1' => 40, '2' => 40, '3' => 40], $r->best_scores);
        $this->assertSame(1, $r->best_series);
        $this->assertSame(1, $r->attempts);
        $this->assertFalse($r->ever_qualified);
        $this->assertSame('in_progress', $r->status);
        $this->assertSame('Laravel (PHP)', $r->stack_name);

        $report = GeneratedReport::where('kind', GeneratedReport::KIND_VAULT_AI)->firstOrFail();
        $this->assertSame($r->report_id, $report->public_id);
        $this->assertSame($student->id, $report->subject_user_id);
        $this->assertSame($student->college_id, $report->college_id);
        $this->assertTrue(Storage::disk('local')->exists($report->path));
        $this->assertStringStartsWith('%PDF', Storage::disk('local')->get($report->path));
        $this->assertSame(40.0, (float) $report->summary['final_average']);
    }

    public function test_a_second_series_that_is_better_becomes_the_best_and_replaces_the_stored_report(): void
    {
        $student = $this->student($this->college());

        $this->series($student, 40);
        $first = $this->resultOf($student)->report_id;
        $firstPath = GeneratedReport::where('public_id', $first)->value('path');

        $this->series($student, 80);

        $r = $this->resultOf($student)->fresh();
        $this->assertEquals(80.0, $r->best_average);
        $this->assertSame(2, $r->best_series);
        $this->assertSame(2, $r->attempts);
        $this->assertTrue($r->ever_qualified);
        $this->assertSame('qualified', $r->status);
        $this->assertEquals([40.0, 80.0], collect($r->history)->pluck('average')->all());

        $this->assertSame(1, GeneratedReport::where('kind', GeneratedReport::KIND_VAULT_AI)->count(), 'one report per student and stack: the new one replaces the old');
        $this->assertNotSame($first, $r->report_id);
        $this->assertFalse(Storage::disk('local')->exists($firstPath), 'the superseded file is gone');
    }

    public function test_a_worse_later_attempt_keeps_the_best_and_the_report_says_which_one_it_was(): void
    {
        $student = $this->student($this->college());

        $this->series($student, 55);
        $this->series($student, 20);

        $r = $this->resultOf($student)->fresh();
        $this->assertEquals(55.0, $r->best_average);
        $this->assertSame(1, $r->best_series);
        $this->assertEquals(20.0, $r->last_average);
        $this->assertSame(2, $r->attempts);

        $data = app(VaultAiReportService::class)->compose($r->load('user.college'));
        $this->assertEquals(55.0, $data['final']['average']);
        $this->assertSame([true, false], collect($data['history'])->pluck('is_best')->all());
    }

    public function test_the_report_carries_each_set_of_the_best_series_with_its_questions_and_feedback(): void
    {
        $student = $this->student($this->college());
        $this->series($student, 70);

        $data = app(VaultAiReportService::class)->compose($this->resultOf($student)->load('user.college'));

        $this->assertSame('Asha Rao', $data['student']['name']);
        $this->assertSame('Apex Institute', $data['college']['name']);
        $this->assertSame('Laravel (PHP)', $data['stack']['name']);
        $this->assertTrue($data['final']['passed']);
        $this->assertCount(3, $data['sets']);
        foreach ($data['sets'] as $set) {
            $this->assertSame(70, $set['score']);
            $this->assertNotNull($set['sitting'], 'the actual sitting behind the recorded score is found');
            $this->assertNotEmpty($set['sitting']['questions']);
            $this->assertSame('Clear, but name the retry strategy.', $set['sitting']['questions'][0]['feedback']);
        }
    }

    public function test_an_admins_fresh_start_keeps_the_best_result_the_student_ever_earned(): void
    {
        $student = $this->student($this->college());
        $this->series($student, 80);
        $this->assertSame('qualified', $this->resultOf($student)->status);

        Sanctum::actingAs($this->superadmin());
        $this->postJson("/api/superadmin/vault-ai/students/{$student->id}/stacks/".self::STACK.'/reset', ['reason' => 'Retake requested by the TPO'])->assertOk();

        $r = $this->resultOf($student)->fresh();
        $this->assertEquals(80.0, $r->best_average, 'the reset wiped the qualification, not the record of what was earned');
        $this->assertTrue($r->ever_qualified);
        $this->assertTrue($r->history[0]['reset'], 'the entry is kept and says it was reset');
        $this->assertSame('in_progress', $r->status);

        $this->series($student, 50);
        $r = $this->resultOf($student)->fresh();
        $this->assertEquals(80.0, $r->best_average);
        $this->assertEquals(50.0, $r->last_average);
        $this->assertSame(2, $r->attempts);
    }

    public function test_a_qualification_granted_by_an_admin_is_recorded_as_such_without_invented_set_scores(): void
    {
        $student = $this->student($this->college());

        Sanctum::actingAs($this->superadmin());
        $this->postJson("/api/superadmin/vault-ai/students/{$student->id}/stacks/".self::STACK.'/qualify', ['average' => 72, 'reason' => 'Verified in person'])->assertOk();

        $r = $this->resultOf($student);
        $this->assertEquals(72.0, $r->best_average);
        $this->assertSame([], $r->best_scores);
        $this->assertSame('admin', $r->history[0]['source']);
        $this->assertNotNull($r->report_id);
    }

    public function test_the_ledger_is_rebuilt_from_existing_qualifications_by_the_command(): void
    {
        $student = $this->student($this->college());
        $this->series($student, 65);
        VaultAiResult::query()->delete();
        GeneratedReport::query()->delete();

        Artisan::call('vault-ai:rebuild-results', ['--reports' => true]);

        $r = $this->resultOf($student);
        $this->assertEquals(65.0, $r->best_average);
        $this->assertNotNull($r->report_id);
        $this->assertSame(1, GeneratedReport::where('kind', GeneratedReport::KIND_VAULT_AI)->count());

        // Run again: nothing is duplicated.
        Artisan::call('vault-ai:rebuild-results', ['--reports' => true]);
        $this->assertSame(1, VaultAiResult::count());
        $this->assertSame(1, count($r->fresh()->history));
    }

    // ----------------------------------------------------------------- who may see it

    public function test_a_student_sees_their_own_results_and_downloads_the_pdf(): void
    {
        $student = $this->student($this->college());
        $other = $this->student($this->college('Beta College'));
        $this->series($student, 75);

        Sanctum::actingAs($student);
        $mine = $this->getJson('/api/me/vault-ai/results')->assertOk()->json();
        $this->assertSame(60.0, (float) $mine['pass_mark']);
        $this->assertCount(1, $mine['results']);
        $this->assertSame('Laravel (PHP)', $mine['results'][0]['stack_name']);
        $this->assertEquals(75.0, $mine['results'][0]['best_average']);
        $this->assertTrue($mine['results'][0]['qualified']);
        $this->assertTrue($mine['results'][0]['history'][0]['is_best']);

        $reportId = $mine['results'][0]['report_id'];
        $download = $this->get("/api/me/reports/{$reportId}/download")->assertOk();
        $this->assertSame('application/pdf', $download->headers->get('Content-Type'));

        Sanctum::actingAs($other);
        $this->get("/api/me/reports/{$reportId}/download")->assertNotFound();
        $this->assertSame([], $this->getJson('/api/me/vault-ai/results')->json('results'));
    }

    public function test_a_student_can_write_the_report_again(): void
    {
        $student = $this->student($this->college());
        $this->series($student, 75);
        $before = $this->resultOf($student)->report_id;

        Sanctum::actingAs($student);
        $res = $this->postJson('/api/me/vault-ai/results/'.self::STACK.'/report')->assertCreated();

        $this->assertNotSame($before, $res->json('report.id'));
        $this->assertSame($res->json('report.id'), $this->resultOf($student)->report_id);
        $this->postJson('/api/me/vault-ai/results/unknown_stack/report')->assertNotFound();
    }

    public function test_a_college_tpo_sees_only_their_own_colleges_results_and_reports(): void
    {
        $apex = $this->college('Apex Institute');
        $beta = $this->college('Beta College');
        $mine = $this->student($apex);
        $theirs = $this->student($beta);
        $theirs->forceFill(['name' => 'Other College Student'])->save();
        $this->series($mine, 75);
        $this->series($theirs, 30);

        Sanctum::actingAs($this->tpo($apex));
        $list = $this->getJson('/api/tpo/vault-ai/results')->assertOk()->json();

        $this->assertSame(1, $list['total']);
        $this->assertSame('Asha Rao', $list['rows'][0]['student']['name']);
        $this->assertSame('A-12', $list['rows'][0]['student']['roll_number']);
        $this->assertEquals(75.0, $list['rows'][0]['best_average']);
        $this->assertEquals(['students' => 1, 'qualified' => 1, 'results' => 1, 'average' => 75.0], $list['totals']);

        $this->get('/api/tpo/reports/'.$list['rows'][0]['report_id'].'/download')->assertOk();
        $this->get('/api/tpo/reports/'.$this->resultOf($theirs)->report_id.'/download')->assertNotFound();
        $this->postJson('/api/tpo/vault-ai/results/'.$this->resultOf($theirs)->id.'/report')->assertNotFound();

        $this->assertSame(1, $this->getJson('/api/tpo/vault-ai/results?status=qualified')->json('total'));
        $this->assertSame(0, $this->getJson('/api/tpo/vault-ai/results?status=not_qualified')->json('total'));
        $this->assertSame(0, $this->getJson('/api/tpo/vault-ai/results?q=nobody')->json('total'));
        $this->assertSame(1, $this->getJson('/api/tpo/vault-ai/results?q=A-12')->json('total'));
    }

    public function test_platform_staff_see_every_college_and_a_student_cannot_use_the_lists(): void
    {
        $apex = $this->college('Apex Institute');
        $beta = $this->college('Beta College');
        $a = $this->student($apex);
        $b = $this->student($beta);
        $this->series($a, 75);
        $this->series($b, 30);

        Sanctum::actingAs($this->superadmin());
        $all = $this->getJson('/api/admin/vault-ai/results')->assertOk()->json();
        $this->assertSame(2, $all['total']);
        $this->assertSame(1, $this->getJson('/api/admin/vault-ai/results?college_id='.$beta->id)->json('total'));
        $this->assertSame(1, count($this->getJson("/api/admin/vault-ai/students/{$a->id}/results")->json('results')));
        $this->get('/api/admin/reports/'.$this->resultOf($a)->report_id.'/download')->assertOk();

        Sanctum::actingAs($a);
        $this->getJson('/api/tpo/vault-ai/results')->assertForbidden();
        $this->getJson('/api/admin/vault-ai/results')->assertForbidden();
    }

    public function test_results_that_predate_the_ledger_appear_when_a_college_first_looks(): void
    {
        $apex = $this->college();
        $student = $this->student($apex);
        $this->series($student, 65);
        VaultAiResult::query()->delete();

        Sanctum::actingAs($this->tpo($apex));
        $list = $this->getJson('/api/tpo/vault-ai/results')->assertOk()->json();

        $this->assertSame(1, $list['total']);
        $this->assertEquals(65.0, $list['rows'][0]['best_average']);
    }

    public function test_deleting_a_student_removes_their_results(): void
    {
        $student = $this->student($this->college());
        $this->series($student, 65);
        $this->assertSame(1, VaultAiResult::count());

        app(\App\Services\UserPurgeService::class)->purge($student);

        $this->assertSame(0, VaultAiResult::count());
        $this->assertSame(0, GeneratedReport::where('kind', GeneratedReport::KIND_VAULT_AI)->count());
    }
}
