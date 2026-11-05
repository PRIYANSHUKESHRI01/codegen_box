<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\ProjectEnrollment;
use App\Models\ProjectSave;
use App\Models\ProjectSubmission;
use App\Services\ProjectLab\TarReader;
use App\Services\Workspaces\ExecResult;
use App\Services\Workspaces\FakeWorkspaceRuntime;
use App\Services\Workspaces\WorkspaceManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\TestCase;
use ZipArchive;

/**
 * Project Lab is written in the AptRun editor and handed in from it: AptRun packs the code out of the open workspace (Save progress and
 * Submit), nothing accepts an uploaded file, a project that was mostly copied in from outside is refused, and a reviewer can browse what
 * was handed in and take it away as a .zip.
 */
class ProjectLabCodeFromEditorTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
        $this->fakeWorkspaces();
        Storage::fake('local');
        FakeWorkspaceRuntime::$execResults = ['tar --null' => new ExecResult(0, "13\n")];
    }

    // ----------------------------------------------------------------- helpers

    /** @return array{0: \App\Models\User, 1: ProjectEnrollment} */
    private function running(): array
    {
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student, $this->topic());
        $manager = app(WorkspaceManager::class);
        $manager->start($manager->provision($enrollment), $student);

        return [$student, $enrollment];
    }

    /**
     * A GNU tar, gzipped, the way the snapshot script makes one.
     *
     * @param  array<string, array{0: string, 1: int}>  $files  name => [content, mtime]
     */
    private function tgz(array $files): string
    {
        $tar = '';

        foreach ($files as $name => [$content, $mtime]) {
            if (strlen($name) > 99) {
                $tar .= $this->header('././@LongLink', strlen($name) + 1, 0, 'L').$this->padded($name."\0");
                $name = substr($name, 0, 99);
            }

            $tar .= $this->header($name, strlen($content), $mtime, '0').$this->padded($content);
        }

        return gzencode($tar.str_repeat("\0", 1024));
    }

    private function header(string $name, int $size, int $mtime, string $type): string
    {
        $h = str_pad($name, 100, "\0")
            .sprintf('%07o', 0644)."\0".sprintf('%07o', 0)."\0".sprintf('%07o', 0)."\0"
            .sprintf('%011o', $size)."\0".sprintf('%011o', $mtime)."\0"
            .'        '.$type.str_repeat("\0", 100)."ustar\0"."00".str_repeat("\0", 32).str_repeat("\0", 32).str_repeat("\0", 16).str_repeat("\0", 155).str_repeat("\0", 12);
        $sum = array_sum(array_map('ord', str_split($h)));

        return substr($h, 0, 148).sprintf('%06o', $sum)."\0 ".substr($h, 156);
    }

    private function padded(string $data): string
    {
        return $data.str_repeat("\0", (512 - (strlen($data) % 512)) % 512);
    }

    /** N files written "now" (in the workspace), plus any extras. */
    private function project(int $files = 12, int $mtime = null): string
    {
        $mtime ??= time();
        $set = [];

        for ($i = 1; $i <= $files; $i++) {
            $set["./src/file{$i}.php"] = ["<?php // file {$i}\n", $mtime];
        }

        return $this->tgz($set);
    }

    private function submitUrl(ProjectEnrollment $e): string
    {
        return "/api/project-lab/enrollments/{$e->id}/submit";
    }

    private function savesUrl(ProjectEnrollment $e): string
    {
        return "/api/project-lab/enrollments/{$e->id}/saves";
    }

    // ------------------------------------------------------------ save progress

    public function test_save_progress_packs_the_open_editor_into_a_checkpoint_kept_privately(): void
    {
        [$student, $enrollment] = $this->running();
        FakeWorkspaceRuntime::$snapshotBytes = $this->project(5);
        Sanctum::actingAs($student);

        $res = $this->postJson($this->savesUrl($enrollment))->assertCreated();

        $save = ProjectSave::firstOrFail();
        $this->assertSame($student->id, $save->user_id);
        $this->assertSame(5, $save->files_count);
        $this->assertSame(hash('sha256', FakeWorkspaceRuntime::$snapshotBytes), $save->snapshot_sha256);
        Storage::disk('local')->assertExists($save->snapshot_path);
        $this->assertStringContainsString('project-submissions/saves/'.$student->id.'/', $save->snapshot_path);
        $this->assertSame(5, $res->json('save.files'));
        $this->assertArrayNotHasKey('snapshot_path', $res->json('save'), 'the storage path is never shown');

        $this->getJson($this->savesUrl($enrollment))->assertOk()->assertJsonCount(1, 'saves');
    }

    public function test_a_save_needs_the_workspace_open_and_an_active_project(): void
    {
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student);
        app(WorkspaceManager::class)->provision($enrollment); // stopped
        Sanctum::actingAs($student);

        $this->postJson($this->savesUrl($enrollment))->assertStatus(409)->assertJsonPath('code', 'workspace_not_running');
        $this->assertSame(0, ProjectSave::count());

        $enrollment->update(['status' => ProjectEnrollment::STATUS_SUBMITTED]);
        $this->postJson($this->savesUrl($enrollment))->assertStatus(409)->assertJsonPath('code', 'save_not_allowed');
    }

    public function test_saving_twice_in_a_few_seconds_stores_one_checkpoint_and_only_the_newest_few_are_kept(): void
    {
        config(['project_lab.saves.keep' => 2, 'project_lab.saves.min_interval_seconds' => 15]);
        [$student, $enrollment] = $this->running();
        FakeWorkspaceRuntime::$snapshotBytes = $this->project(3);
        Sanctum::actingAs($student);

        $a = $this->postJson($this->savesUrl($enrollment))->assertCreated()->json('save.id');
        $b = $this->postJson($this->savesUrl($enrollment))->assertCreated()->json('save.id');
        $this->assertSame($a, $b, 'a second press within the interval returns the checkpoint just made');
        $this->assertSame(1, ProjectSave::count());

        $first = ProjectSave::firstOrFail();
        foreach ([1, 2, 3] as $n) {
            $this->travel(20 * $n)->seconds();
            FakeWorkspaceRuntime::$snapshotBytes = $this->project(3 + $n);
            $this->postJson($this->savesUrl($enrollment))->assertCreated();
        }

        $this->assertSame(2, ProjectSave::count(), 'only the newest two are kept');
        $this->assertNull(ProjectSave::find($first->id));
        Storage::disk('local')->assertMissing($first->snapshot_path);
    }

    public function test_a_student_can_only_see_and_download_their_own_checkpoints_as_a_zip(): void
    {
        [$student, $enrollment] = $this->running();
        FakeWorkspaceRuntime::$snapshotBytes = $this->project(4);
        Sanctum::actingAs($student);
        $id = $this->postJson($this->savesUrl($enrollment))->assertCreated()->json('save.id');

        $zip = $this->get("/api/project-lab/enrollments/{$enrollment->id}/saves/{$id}/download")->assertOk();
        $this->assertSame('application/zip', $zip->headers->get('Content-Type'));
        $z = new ZipArchive;
        $this->assertTrue($z->open($zip->baseResponse->getFile()->getPathname()));
        $this->assertSame(4, $z->numFiles);
        $this->assertNotFalse($z->locateName('src/file1.php'));
        $z->close();

        $raw = $this->get("/api/project-lab/enrollments/{$enrollment->id}/saves/{$id}/download?format=tgz")->assertOk();
        $this->assertStringContainsString('save-'.$id.'.tgz', $raw->headers->get('Content-Disposition'));

        $other = $this->studentWithLab();
        Sanctum::actingAs($other);
        $this->getJson($this->savesUrl($enrollment))->assertNotFound();
        $this->get("/api/project-lab/enrollments/{$enrollment->id}/saves/{$id}/download")->assertNotFound();
    }

    // ------------------------------------------------------------- no uploads

    public function test_no_file_is_ever_accepted_by_a_save_or_a_hand_in(): void
    {
        [$student, $enrollment] = $this->running();
        Sanctum::actingAs($student);
        $file = UploadedFile::fake()->create('project.zip', 40, 'application/zip');

        $this->post($this->submitUrl($enrollment), ['notes' => 'here it is', 'project' => $file], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('code', 'uploads_not_accepted');
        $this->post($this->savesUrl($enrollment), ['project' => $file], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonPath('code', 'uploads_not_accepted');

        $this->assertSame(0, ProjectSubmission::count());
        $this->assertSame(0, ProjectSave::count());
        $this->post("/api/project-lab/enrollments/{$enrollment->id}/upload", ['file' => $file], ['Accept' => 'application/json'])->assertNotFound();
    }

    public function test_no_project_lab_route_takes_a_file_upload(): void
    {
        // Every project-lab route that writes (POST/PUT/PATCH) and what it is for. A new one has to be added here on purpose.
        $writes = collect(app('router')->getRoutes()->getRoutes())
            ->filter(fn ($r) => str_contains($r->uri(), 'project-lab/enrollments') && array_intersect($r->methods(), ['POST', 'PUT', 'PATCH']))
            ->map(fn ($r) => preg_replace('#api/project-lab/enrollments/\{enrollment\}/?#', '', $r->uri()))
            ->sort()->values()->all();

        $this->assertSame(['abandon', 'milestones/{milestone}/toggle', 'saves', 'submit', 'workspace/heartbeat', 'workspace/integrity', 'workspace/start', 'workspace/stop'], $writes);
    }

    // -------------------------------------------------------------- provenance

    public function test_a_project_written_in_the_editor_is_handed_in_with_its_evidence_and_no_warning(): void
    {
        [$student, $enrollment] = $this->running();
        FakeWorkspaceRuntime::$snapshotBytes = $this->project(12);
        Sanctum::actingAs($student);

        $this->postJson($this->submitUrl($enrollment), ['notes' => 'Done'])->assertCreated()->assertJsonPath('submission.has_snapshot', true);

        $submission = ProjectSubmission::firstOrFail();
        $p = $submission->integrity['provenance'];
        $this->assertSame([12, 0, false], [$p['files'], $p['predating'], $p['would_block']]);
        $this->assertSame(['No milestones were marked complete.'], $submission->warnings, 'no import warning: every file is newer than the workspace');
    }

    public function test_a_project_that_is_mostly_copied_in_from_outside_is_refused_and_nothing_is_kept(): void
    {
        [$student, $enrollment] = $this->running();
        FakeWorkspaceRuntime::$snapshotBytes = $this->project(12, time() - 400 * 86400);
        Sanctum::actingAs($student);

        $this->postJson($this->submitUrl($enrollment), [])->assertStatus(422)->assertJsonPath('code', 'imported_files')
            ->assertJsonFragment(['message' => 'Most of this project (12 of 12 files) was copied in from outside AptRun — those files are older than your workspace. Project Lab projects have to be written in the AptRun editor. Write your own code in the workspace, then submit again.']);

        $this->assertSame(0, ProjectSubmission::count());
        $this->assertSame(ProjectEnrollment::STATUS_ACTIVE, $enrollment->fresh()->status, 'the student can fix it and submit again');
        $this->assertSame([], Storage::disk('local')->allFiles('project-submissions'), 'the refused snapshot is not left on disk');
    }

    public function test_a_few_old_files_are_shown_to_the_reviewer_but_do_not_block(): void
    {
        [$student, $enrollment] = $this->running();
        $set = [];
        foreach (range(1, 10) as $i) {
            $set["./app/f{$i}.js"] = ['x', time()];
        }
        $set['./README.md'] = ['from a template', time() - 90 * 86400];
        $set['./assets/logo.png'] = ['png', time() - 90 * 86400];
        $set['./release/app.zip'] = ['PK', time()];
        FakeWorkspaceRuntime::$snapshotBytes = $this->tgz($set);
        Sanctum::actingAs($student);

        $this->postJson($this->submitUrl($enrollment), [])->assertCreated();

        $warnings = ProjectSubmission::firstOrFail()->warnings;
        $this->assertStringContainsString('2 of the 13 files in this project are older than the workspace itself', implode(' ', $warnings));
        $this->assertStringContainsString('release/app.zip', implode(' ', $warnings));
    }

    public function test_the_import_check_can_be_switched_to_evidence_only(): void
    {
        config(['project_lab.provenance.enforce' => false]);
        [$student, $enrollment] = $this->running();
        FakeWorkspaceRuntime::$snapshotBytes = $this->project(12, time() - 400 * 86400);
        Sanctum::actingAs($student);

        $this->postJson($this->submitUrl($enrollment), [])->assertCreated();
        $this->assertTrue(ProjectSubmission::firstOrFail()->integrity['provenance']['would_block']);
    }

    public function test_an_archive_that_cannot_be_read_never_stops_a_hand_in(): void
    {
        [$student, $enrollment] = $this->running();
        FakeWorkspaceRuntime::$snapshotBytes = "FAKE-SNAPSHOT\n";
        Sanctum::actingAs($student);

        $this->postJson($this->submitUrl($enrollment), [])->assertCreated();
        $this->assertArrayNotHasKey('provenance', ProjectSubmission::firstOrFail()->integrity ?? []);
    }

    // ------------------------------------------------------ what a reviewer sees

    private function handedIn(): array
    {
        [$student, $enrollment] = $this->running();
        FakeWorkspaceRuntime::$snapshotBytes = $this->tgz([
            './src/app.php' => ["<?php\necho 'hello';\n", time()],
            './src/deep/'.str_repeat('long-folder-name/', 7).'file.txt' => ['a very long path', time()],
            './public/logo.bin' => ["\x00\x01\x02binary", time()],
            './README.md' => ["# My project\n", time()],
        ]);
        Sanctum::actingAs($student);
        $this->postJson($this->savesUrl($enrollment))->assertCreated();
        $this->postJson($this->submitUrl($enrollment), [])->assertCreated();

        return [$student, $enrollment, ProjectSubmission::firstOrFail()];
    }

    public function test_staff_browse_what_was_handed_in_read_a_file_and_take_it_as_a_zip(): void
    {
        [, , $submission] = $this->handedIn();
        Sanctum::actingAs($this->staff());

        $files = $this->getJson("/api/admin/project-lab/submissions/{$submission->id}/files")->assertOk()->json();
        $this->assertSame(4, $files['total_files']);
        $this->assertContains('src/app.php', array_column($files['files'], 'path'));
        $this->assertContains('src/deep/'.str_repeat('long-folder-name/', 7).'file.txt', array_column($files['files'], 'path'), 'a long path (GNU long name entry) is read');

        $file = $this->getJson("/api/admin/project-lab/submissions/{$submission->id}/file?path=src/app.php")->assertOk()->json();
        $this->assertFalse($file['binary']);
        $this->assertSame("<?php\necho 'hello';\n", $file['content']);

        $bin = $this->getJson("/api/admin/project-lab/submissions/{$submission->id}/file?path=public/logo.bin")->assertOk()->json();
        $this->assertTrue($bin['binary']);
        $this->assertNull($bin['content']);

        $this->getJson("/api/admin/project-lab/submissions/{$submission->id}/file?path=nope.txt")->assertNotFound();
        $this->getJson("/api/admin/project-lab/submissions/{$submission->id}/file?path=../../etc/passwd")->assertNotFound();

        $zip = $this->get("/api/admin/project-lab/submissions/{$submission->id}/snapshot?format=zip")->assertOk();
        $this->assertSame('application/zip', $zip->headers->get('Content-Type'));
        $this->assertStringContainsString('attempt-1.zip', $zip->headers->get('Content-Disposition'));
        $z = new ZipArchive;
        $this->assertTrue($z->open($zip->baseResponse->getFile()->getPathname()));
        $this->assertSame(4, $z->numFiles);
        $this->assertSame("# My project\n", $z->getFromName('README.md'));
        $z->close();
        $this->assertNotNull(ActivityLog::where('action', 'Downloaded a project snapshot')->first());

        // The original archive is still served untouched by default.
        $raw = $this->get("/api/admin/project-lab/submissions/{$submission->id}/snapshot")->assertOk();
        $this->assertStringContainsString('attempt-1.tgz', $raw->headers->get('Content-Disposition'));
    }

    public function test_the_review_screen_shows_the_checkpoints_the_student_saved_along_the_way(): void
    {
        [, $enrollment, $submission] = $this->handedIn();
        $save = ProjectSave::where('project_enrollment_id', $enrollment->id)->firstOrFail();
        Sanctum::actingAs($this->staff());

        $detail = $this->getJson("/api/admin/project-lab/submissions/{$submission->id}")->assertOk()->json('submission');
        $this->assertCount(1, $detail['saves']);
        $this->assertSame($save->id, $detail['saves'][0]['id']);
        $this->assertSame(4, $detail['saves'][0]['files']);

        $this->get("/api/admin/project-lab/saves/{$save->id}/download")->assertOk();
        $this->assertNotNull(ActivityLog::where('action', 'Downloaded a saved project checkpoint')->first());
    }

    public function test_a_student_downloads_their_own_hand_in_as_a_zip_and_nobody_elses(): void
    {
        [$student, $enrollment, $submission] = $this->handedIn();
        Sanctum::actingAs($student);

        $this->get("/api/project-lab/enrollments/{$enrollment->id}/submissions/{$submission->id}/download")->assertOk()
            ->assertHeader('Content-Type', 'application/zip');

        Sanctum::actingAs($this->studentWithLab());
        $this->get("/api/project-lab/enrollments/{$enrollment->id}/submissions/{$submission->id}/download")->assertNotFound();
    }

    // ----------------------------------------------------------------- the reader

    public function test_the_tar_reader_follows_long_names_and_refuses_what_is_not_an_archive(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'tar');
        file_put_contents($path, $this->tgz(['./a.txt' => ['one', 100], './'.str_repeat('d/', 60).'z.txt' => ['two', 200]]));

        $tar = TarReader::open($path);
        $a = $tar->next();
        $this->assertSame(['./a.txt', 3, 100, 'file'], [$a['name'], $a['size'], $a['mtime'], $a['type']]);
        $this->assertSame('one', $tar->read());
        $b = $tar->next();
        $this->assertSame('./'.str_repeat('d/', 60).'z.txt', $b['name']);
        $this->assertNull($tar->next());
        $tar->close();

        file_put_contents($path, "FAKE-SNAPSHOT\n");
        $this->expectException(\RuntimeException::class);
        TarReader::open($path);
    }
}
