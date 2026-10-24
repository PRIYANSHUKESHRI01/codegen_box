<?php

namespace Tests\Feature;

use App\Models\CoreQuestion;
use App\Models\CoreQuestionImport;
use App\Models\User;
use App\Services\Core\CoreCoverageService;
use App\Services\Core\CoreGrader;
use App\Services\Core\CoreQuestionImportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The starter question banks shipped in content/core-prep/*.json (ECE, EEE, Mechanical, Civil) must keep importing
 * cleanly through the real Ops importer and must keep clearing the go-live bar — so a careless edit to a bank cannot
 * silently break it or drop a branch below the minimum. (The banks are built by content/core-prep/src/build.py.)
 *
 * Skipped when the content folder is not next to the backend (e.g. a backend-only deploy checkout).
 */
class CoreEditorialBanksTest extends TestCase
{
    use RefreshDatabase;

    private const BRANCHES = ['ece', 'eee', 'mech', 'civil'];

    private function path(string $branch): string
    {
        return base_path("../content/core-prep/{$branch}.json");
    }

    private function importAll(): void
    {
        Storage::fake('local');
        $admin = User::factory()->create(['role' => User::ROLE_SUPERADMIN]);

        foreach (self::BRANCHES as $branch) {
            if (! is_file($this->path($branch))) {
                $this->markTestSkipped("content/core-prep/{$branch}.json is not available here.");
            }

            $file = new UploadedFile($this->path($branch), "{$branch}.json", 'application/json', null, true);
            $import = app(CoreQuestionImportService::class)->start($file, null, $admin, CoreQuestionImport::MODE_COMMIT, ['discipline' => $branch]);

            $this->assertSame(0, $import->failed_rows, "{$branch}: ".json_encode(array_slice($import->errors ?? [], 0, 3)));
            $this->assertSame($import->total_rows, $import->created_rows, "{$branch}: every row should create a question");
        }
    }

    public function test_every_bank_imports_cleanly_and_meets_the_go_live_bar(): void
    {
        $this->importAll();

        foreach (self::BRANCHES as $branch) {
            $coverage = app(CoreCoverageService::class)->forDiscipline($branch);

            $this->assertTrue($coverage['go_live']['ready'], "{$branch}: ".implode(' ', $coverage['go_live']['reasons']));
            $this->assertGreaterThanOrEqual(150, $coverage['totals']['test'], $branch);
        }
    }

    public function test_every_stored_key_is_what_the_grader_accepts(): void
    {
        $this->importAll();

        foreach (CoreQuestion::query()->get() as $q) {
            if ($q->isNumeric()) {
                $this->assertTrue(CoreGrader::evaluate($q, null, ($q->numeric_min + $q->numeric_max) / 2)['correct'], $q->external_id);

                continue;
            }

            $ids = array_column($q->options, 'id');
            $this->assertNotEmpty($q->correct, $q->external_id);
            $this->assertSame([], array_diff($q->correct, $ids), "{$q->external_id}: key names an option that does not exist");
            $this->assertTrue(CoreGrader::evaluate($q, $q->correct, null)['correct'], $q->external_id);

            $wrong = array_values(array_diff($ids, $q->correct));
            $this->assertFalse(CoreGrader::evaluate($q, [$wrong[0]], null)['correct'], "{$q->external_id}: a wrong option was accepted");
        }
    }

    public function test_every_question_carries_its_provenance_and_a_worked_explanation(): void
    {
        $this->importAll();

        $this->assertSame(0, CoreQuestion::query()->where(fn ($q) => $q->whereNull('source')->orWhere('source', ''))->count());
        $this->assertSame(0, CoreQuestion::query()->where(fn ($q) => $q->whereNull('explanation')->orWhere('explanation', ''))->count());
        $this->assertTrue(CoreQuestion::query()->get()->every(fn ($q) => in_array('editorial-v1', $q->tags ?? [], true)), 'every starter question is tagged editorial-v1 so reviewers can filter them');
    }

    public function test_re_importing_a_bank_updates_instead_of_duplicating(): void
    {
        $this->importAll();
        $before = CoreQuestion::count();

        $admin = User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
        $file = new UploadedFile($this->path('ece'), 'ece.json', 'application/json', null, true);
        $again = app(CoreQuestionImportService::class)->start($file, null, $admin, CoreQuestionImport::MODE_COMMIT, ['discipline' => 'ece']);

        $this->assertSame(0, $again->failed_rows);
        $this->assertSame(0, $again->created_rows);
        $this->assertSame($before, CoreQuestion::count());
    }
}
