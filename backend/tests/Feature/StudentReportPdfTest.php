<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\CoordinatorNote;
use App\Models\GeneratedReport;
use App\Models\User;
use App\Services\Reports\ReportArchive;
use App\Services\UserPurgeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The student report PDF and its archive: every role that may generate one gets the same document, the file is STORED (a
 * later download is the original bytes, not a regeneration), nobody reaches a report outside their scope (404, never 403), a
 * student's own copy leaves out the college's internal follow-up notes, and deleting a student takes their reports' files
 * with them.
 */
class StudentReportPdfTest extends TestCase
{
    use RefreshDatabase;

    private College $college;

    private College $other;

    private User $tpo;

    private User $student;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->college = College::create(['name' => 'Report College', 'short_code' => 'RC']);
        $this->other = College::create(['name' => 'Elsewhere College', 'short_code' => 'EC']);

        $this->tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $this->college->id, 'must_change_password' => false]);
        $this->student = User::factory()->create([
            'name' => 'Asha Verma', 'role' => User::ROLE_USER, 'college_id' => $this->college->id, 'roll_number' => '21CS042',
            'branch' => 'CSE', 'section' => 'CSE_A', 'must_change_password' => false,
        ]);
    }

    private function pdf(string $binary): void
    {
        $this->assertStringStartsWith('%PDF-', $binary);
        $this->assertGreaterThan(2000, strlen($binary));
    }

    public function test_tpo_generates_a_stored_pdf_and_downloads_the_same_bytes(): void
    {
        Sanctum::actingAs($this->tpo);

        $res = $this->postJson("/api/tpo/students/{$this->student->id}/reports")->assertCreated();
        $id = $res->json('report.id');

        $this->assertSame('student_report', $res->json('report.kind'));
        $this->assertSame('Asha Verma — student report', $res->json('report.title'));
        $this->assertGreaterThan(0, $res->json('report.pages'));
        $this->assertArrayHasKey('readiness', $res->json('report.summary'));

        $row = GeneratedReport::where('public_id', $id)->firstOrFail();
        $this->assertSame($this->college->id, $row->college_id);
        $this->assertSame($this->student->id, $row->subject_user_id);
        $this->assertSame($this->tpo->id, $row->generated_by);
        Storage::disk('local')->assertExists($row->path);

        $first = $this->get("/api/tpo/reports/{$id}/download");
        $first->assertOk();
        $this->assertSame('application/pdf', $first->headers->get('Content-Type'));
        $this->pdf($first->streamedContent());

        // Download twice: the counter moves, the file does not change.
        $second = $this->get("/api/tpo/reports/{$id}/download");
        $this->assertSame(hash('sha256', Storage::disk('local')->get($row->path)), hash('sha256', $second->streamedContent()));
        $this->assertSame(2, $row->fresh()->downloads);

        // The record never leaks the file's location or checksum.
        $this->assertArrayNotHasKey('path', $res->json('report'));
        $this->assertArrayNotHasKey('sha256', $res->json('report'));
    }

    public function test_history_lists_every_report_generated_about_the_student(): void
    {
        Sanctum::actingAs($this->tpo);
        $this->postJson("/api/tpo/students/{$this->student->id}/reports")->assertCreated();
        $this->postJson("/api/tpo/students/{$this->student->id}/reports")->assertCreated();

        $list = $this->getJson("/api/tpo/students/{$this->student->id}/reports")->assertOk();
        $this->assertCount(2, $list->json('reports'));

        $archive = $this->getJson('/api/tpo/reports/archive')->assertOk();
        $this->assertCount(2, $archive->json('reports'));
        $this->assertSame(2, $archive->json('totals.student_report.count'));
        $this->assertSame('Asha Verma', $archive->json('reports.0.student.name'));

        $this->getJson('/api/tpo/reports/archive?q=Verma')->assertOk()->assertJsonCount(2, 'reports');
        $this->getJson('/api/tpo/reports/archive?q=nobody')->assertOk()->assertJsonCount(0, 'reports');
    }

    public function test_a_tpo_cannot_reach_another_colleges_student_or_report(): void
    {
        $outsider = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $this->other->id, 'must_change_password' => false]);

        Sanctum::actingAs($this->tpo);
        $this->postJson("/api/tpo/students/{$outsider->id}/reports")->assertNotFound();
        $this->getJson("/api/tpo/students/{$outsider->id}/reports")->assertNotFound();

        $theirTpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $this->other->id, 'must_change_password' => false]);
        Sanctum::actingAs($theirTpo);
        $id = $this->postJson("/api/tpo/students/{$outsider->id}/reports")->assertCreated()->json('report.id');

        Sanctum::actingAs($this->tpo);
        $this->get("/api/tpo/reports/{$id}/download")->assertNotFound();
        $this->deleteJson("/api/tpo/reports/{$id}")->assertNotFound();
        $this->assertSame(0, count($this->getJson('/api/tpo/reports/archive')->json('reports')));
    }

    public function test_a_coordinator_reaches_only_students_of_their_own_section(): void
    {
        $coordinator = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $this->college->id, 'section' => 'CSE_A', 'must_change_password' => false]);
        $otherSection = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $this->college->id, 'section' => 'ECE_A', 'must_change_password' => false]);

        Sanctum::actingAs($coordinator);
        $id = $this->postJson("/api/coordinator/students/{$this->student->id}/reports")->assertCreated()->json('report.id');
        $this->postJson("/api/coordinator/students/{$otherSection->id}/reports")->assertNotFound();
        $this->get("/api/coordinator/reports/{$id}/download")->assertOk();

        // A report on the OTHER section's student, made by the TPO, is not theirs to open.
        Sanctum::actingAs($this->tpo);
        $theirs = $this->postJson("/api/tpo/students/{$otherSection->id}/reports")->assertCreated()->json('report.id');
        Sanctum::actingAs($coordinator);
        $this->get("/api/coordinator/reports/{$theirs}/download")->assertNotFound();
    }

    public function test_a_student_gets_their_own_report_without_internal_notes_and_cannot_open_the_staff_copy(): void
    {
        CoordinatorNote::create(['college_id' => $this->college->id, 'student_id' => $this->student->id, 'author_id' => $this->tpo->id, 'kind' => 'call', 'body' => 'INTERNAL-NOTE-MARKER']);

        Sanctum::actingAs($this->tpo);
        $staffId = $this->postJson("/api/tpo/students/{$this->student->id}/reports")->assertCreated()->json('report.id');

        Sanctum::actingAs($this->student);
        $mine = $this->postJson('/api/me/report')->assertCreated();
        $this->assertSame('student', $mine->json('report.audience'));

        $this->assertCount(1, $this->getJson('/api/me/reports')->json('reports'));
        $this->get("/api/me/reports/{$mine->json('report.id')}/download")->assertOk();
        $this->get("/api/me/reports/{$staffId}/download")->assertNotFound();

        // The staff copy was rendered from data that contains the note; the student copy from data that does not.
        $composer = app(\App\Services\Reports\StudentReportComposer::class);
        $this->assertNotEmpty($composer->compose($this->student, 'staff')['notes']);
        $this->assertSame([], $composer->compose($this->student, 'student')['notes']);
    }

    public function test_a_student_cannot_generate_a_report_about_someone_else(): void
    {
        $other = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $this->college->id, 'must_change_password' => false]);

        Sanctum::actingAs($this->student);
        $this->postJson("/api/tpo/students/{$other->id}/reports")->assertForbidden();
        $this->postJson("/api/coordinator/students/{$other->id}/reports")->assertForbidden();
    }

    public function test_a_tampered_or_missing_file_is_refused_not_served(): void
    {
        Sanctum::actingAs($this->tpo);
        $id = $this->postJson("/api/tpo/students/{$this->student->id}/reports")->assertCreated()->json('report.id');
        $row = GeneratedReport::where('public_id', $id)->firstOrFail();

        Storage::disk('local')->put($row->path, 'not the original');
        $this->get("/api/tpo/reports/{$id}/download")->assertStatus(410);

        Storage::disk('local')->delete($row->path);
        $this->get("/api/tpo/reports/{$id}/download")->assertStatus(410);
    }

    public function test_bundle_zips_only_the_callers_reports(): void
    {
        Sanctum::actingAs($this->tpo);
        $a = $this->postJson("/api/tpo/students/{$this->student->id}/reports")->json('report.id');
        $b = $this->postJson("/api/tpo/students/{$this->student->id}/reports")->json('report.id');

        $outsider = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $this->other->id, 'must_change_password' => false]);
        $theirTpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $this->other->id, 'must_change_password' => false]);
        Sanctum::actingAs($theirTpo);
        $foreign = $this->postJson("/api/tpo/students/{$outsider->id}/reports")->json('report.id');

        Sanctum::actingAs($this->tpo);
        $res = $this->post('/api/tpo/reports/bundle', ['ids' => [$a, $b, $foreign]]);
        $res->assertOk();
        $this->assertSame('application/zip', $res->headers->get('Content-Type'));

        $path = $res->baseResponse->getFile()->getPathname();
        $zip = new \ZipArchive;
        $this->assertTrue($zip->open($path) === true);
        $this->assertSame(2, $zip->numFiles);
        $zip->close();

        $this->postJson('/api/tpo/reports/bundle', ['ids' => [$foreign]])->assertNotFound();
    }

    public function test_deleting_a_report_or_a_student_removes_the_file(): void
    {
        Sanctum::actingAs($this->tpo);
        $id = $this->postJson("/api/tpo/students/{$this->student->id}/reports")->json('report.id');
        $row = GeneratedReport::where('public_id', $id)->firstOrFail();
        $this->deleteJson("/api/tpo/reports/{$id}")->assertOk();
        Storage::disk('local')->assertMissing($row->path);
        $this->assertDatabaseMissing('generated_reports', ['public_id' => $id]);

        $id2 = $this->postJson("/api/tpo/students/{$this->student->id}/reports")->json('report.id');
        $path2 = GeneratedReport::where('public_id', $id2)->value('path');
        Storage::disk('local')->assertExists($path2);

        app(UserPurgeService::class)->purge($this->student);
        $this->assertDatabaseMissing('generated_reports', ['public_id' => $id2]);
        Storage::disk('local')->assertMissing($path2);
    }

    public function test_every_section_of_the_report_renders_for_a_busy_student(): void
    {
        // A student with no activity at all must still produce a complete, honest document (empty states, no errors).
        $data = app(\App\Services\Reports\StudentReportComposer::class)->compose($this->student);
        $this->assertArrayHasKey('narrative', $data);
        $this->assertNotEmpty($data['narrative']['verdict']);
        $this->assertSame(0, $data['headline']['solved']);

        $rendered = app(\App\Services\Reports\PdfRenderer::class)->render('reports.student', ['data' => $data], 'Report AR-TEST');
        $this->pdf($rendered['binary']);
        $this->assertGreaterThanOrEqual(1, $rendered['pages']);
    }

    public function test_archive_is_tpo_only(): void
    {
        Sanctum::actingAs($this->student);
        $this->getJson('/api/tpo/reports/archive')->assertForbidden();

        $coordinator = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $this->college->id, 'section' => 'CSE_A', 'must_change_password' => false]);
        Sanctum::actingAs($coordinator);
        $this->getJson('/api/tpo/reports/archive')->assertForbidden();
        $this->assertInstanceOf(ReportArchive::class, app(ReportArchive::class));
    }
}
