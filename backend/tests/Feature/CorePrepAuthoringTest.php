<?php

namespace Tests\Feature;

use App\Events\CoreQuestionKeyFixed;
use App\Models\CoreQuestion;
use App\Models\CoreQuestionReport;
use App\Models\CoreSubject;
use App\Models\Discipline;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;
use ZipArchive;

/**
 * P3 of the multi-branch work: Core Prep authoring — taxonomy, the question bank with its review workflow
 * and answer-key lock, bulk import with a dry-run, coverage and the go-live guard. Students see none of it.
 */
class CorePrepAuthoringTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // The migrations ship starter Domain Prep questions for the non-engineering departments; these tests are about authoring on an empty bank.
        CoreQuestion::query()->delete();
    }

    private function staff(array $permissions = [User::PERM_CORE_PREP]): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => $permissions]);
    }

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
    }

    private function subject(string $discipline = 'ece', string $code = 'analog_circuits'): CoreSubject
    {
        return CoreSubject::where('discipline_code', $discipline)->where('code', $code)->firstOrFail();
    }

    /** A valid payload for the authoring API. */
    private function payload(array $over = []): array
    {
        $subject = $this->subject();

        return array_merge([
            'discipline_code' => 'ece',
            'subject_id' => $subject->id,
            'topic_id' => $subject->topics()->first()->id,
            'type' => 'mcq_single',
            'stem' => 'The gain of a CE amplifier with $g_m = 40\\,\\text{mS}$ and $R_C = 4\\,\\text{k}\\Omega$ is:',
            'options' => [['id' => 'a', 'text' => '-160'], ['id' => 'b', 'text' => '-80'], ['id' => 'c', 'text' => '160'], ['id' => 'd', 'text' => '-40']],
            'correct' => ['a'],
            'marks' => 1,
            'negative_marks' => 0.33,
            'difficulty' => 'medium',
            'usage' => 'both',
            'explanation' => 'Gain is -gm * RC = -160.',
            'external_id' => 'ECE-0001',
        ], $over);
    }

    private function create(array $over = []): array
    {
        Sanctum::actingAs($this->staff());

        return $this->postJson('/api/admin/core/questions', $this->payload($over))->assertCreated()->json('question');
    }

    // ───────────────────────────── taxonomy & access ─────────────────────────────

    public function test_the_taxonomy_ships_with_the_schema(): void
    {
        Sanctum::actingAs($this->staff());

        $json = $this->getJson('/api/admin/core/taxonomy')->assertOk()->json('disciplines');

        // Engineering's four core families, plus every discipline of the other departments (Domain Prep is department-wide there).
        $codes = array_column($json, 'code');
        $this->assertEmpty(array_diff(['ece', 'eee', 'mech', 'civil'], $codes));
        $this->assertContains('mba', $codes);
        $this->assertNotContains('cse', $codes);
        $this->assertContains('other', $codes, 'Chemical, Biotech, Aerospace, Agri and Mining have Domain Prep too');
        $ece = collect($json)->firstWhere('code', 'ece');
        $this->assertContains('analog_circuits', array_column($ece['subjects'], 'code'));
        $this->assertGreaterThan(5, count($ece['subjects'][0]['topics']));
    }

    public function test_only_staff_with_the_permission_reach_it(): void
    {
        foreach ([
            User::factory()->create(['role' => User::ROLE_USER]),
            User::factory()->create(['role' => User::ROLE_ADMIN_TPO]),
            $this->staff([User::PERM_CONTESTS]),
        ] as $user) {
            Sanctum::actingAs($user);
            $this->getJson('/api/admin/core/questions')->assertForbidden();
        }

        Sanctum::actingAs($this->staff());
        $this->getJson('/api/admin/core/questions')->assertOk();
        Sanctum::actingAs($this->superadmin());
        $this->getJson('/api/admin/core/questions')->assertOk();
    }

    public function test_the_permission_is_in_the_internal_catalogue(): void
    {
        $this->assertContains(User::PERM_CORE_PREP, User::PERMISSIONS_INTERNAL);
    }

    // ───────────────────────────── authoring & validation ─────────────────────────────

    public function test_a_valid_mcq_is_saved_as_a_draft(): void
    {
        $q = $this->create();

        $this->assertSame('draft', $q['status']);
        $this->assertSame(['a'], $q['correct']);
        $this->assertSame(1, $q['version']);
        $this->assertFalse($q['key_locked']);
        $this->assertSame('ECE-0001', CoreQuestion::firstOrFail()->external_id);
        $this->assertDatabaseHas('core_question_audits', ['action' => 'created']);
    }

    #[DataProvider('invalidPayloads')]
    public function test_invalid_questions_are_refused_with_a_reason(array $over, string $field): void
    {
        Sanctum::actingAs($this->staff());

        $this->postJson('/api/admin/core/questions', $this->payload($over))->assertStatus(422)->assertJsonValidationErrors($field);
        $this->assertSame(0, CoreQuestion::count());
    }

    public static function invalidPayloads(): array
    {
        return [
            'one option' => [['options' => [['id' => 'a', 'text' => 'only']], 'correct' => ['a']], 'options'],
            'key not among options' => [['correct' => ['f']], 'correct'],
            'two keys on a single-answer question' => [['correct' => ['a', 'b']], 'correct'],
            'no key' => [['correct' => []], 'correct'],
            'duplicate option text' => [['options' => [['id' => 'a', 'text' => 'x'], ['id' => 'b', 'text' => 'X']], 'correct' => ['a']], 'options'],
            'negative marks above marks' => [['negative_marks' => 2], 'negative_marks'],
            'empty stem' => [['stem' => '   '], 'stem'],
            'bad difficulty' => [['difficulty' => 'impossible'], 'difficulty'],
        ];
    }

    public function test_a_subject_from_another_branch_family_is_refused(): void
    {
        Sanctum::actingAs($this->staff());
        $mech = $this->subject('mech', 'thermodynamics');

        $this->postJson('/api/admin/core/questions', $this->payload(['subject_id' => $mech->id, 'topic_id' => null]))
            ->assertStatus(422)->assertJsonValidationErrors('subject');
    }

    public function test_a_topic_from_another_subject_is_refused(): void
    {
        Sanctum::actingAs($this->staff());
        $other = $this->subject('ece', 'network_theory')->topics()->first();

        $this->postJson('/api/admin/core/questions', $this->payload(['topic_id' => $other->id]))->assertStatus(422)->assertJsonValidationErrors('topic');
    }

    public function test_a_numerical_question_takes_an_accepted_range(): void
    {
        Sanctum::actingAs($this->staff());
        $base = ['type' => 'numeric', 'options' => null, 'correct' => null, 'external_id' => 'NUM-1', 'numeric_unit' => 'µJ'];

        $this->postJson('/api/admin/core/questions', $this->payload($base + ['numeric_min' => 3.14, 'numeric_max' => 3.15]))->assertCreated()
            ->assertJsonPath('question.numeric_min', 3.14)->assertJsonPath('question.numeric_max', 3.15);
        // a single value is a range of one
        $this->postJson('/api/admin/core/questions', $this->payload(['external_id' => 'NUM-2'] + $base + ['numeric_min' => 50]))->assertCreated()
            ->assertJsonPath('question.numeric_max', 50);
        $this->postJson('/api/admin/core/questions', $this->payload(['external_id' => 'NUM-3'] + $base + ['numeric_min' => 5, 'numeric_max' => 1]))->assertStatus(422);
        $this->postJson('/api/admin/core/questions', $this->payload(['external_id' => 'NUM-4'] + $base))->assertStatus(422);
    }

    public function test_multi_select_needs_at_least_one_key_and_orders_it(): void
    {
        Sanctum::actingAs($this->staff());

        $q = $this->postJson('/api/admin/core/questions', $this->payload(['type' => 'mcq_multi', 'correct' => ['c', 'a'], 'external_id' => 'M-1']))->assertCreated()->json('question');
        $this->assertSame(['a', 'c'], $q['correct']);
    }

    public function test_an_external_id_cannot_be_reused(): void
    {
        $this->create();

        $this->postJson('/api/admin/core/questions', $this->payload())->assertStatus(422)->assertJsonValidationErrors('external_id');
    }

    // ───────────────────────────── lifecycle ─────────────────────────────

    public function test_a_question_moves_draft_review_published_retired(): void
    {
        $q = $this->create();
        $url = "/api/admin/core/questions/{$q['id']}/status";

        $this->postJson($url, ['status' => 'in_review'])->assertOk();
        $this->postJson($url, ['status' => 'published'])->assertOk()->assertJsonPath('question.status', 'published');
        $this->assertNotNull(CoreQuestion::find($q['id'])->published_at);
        $this->assertNotNull(CoreQuestion::find($q['id'])->reviewed_by);

        $this->postJson($url, ['status' => 'draft'])->assertStatus(422);   // never straight back to draft
        $this->postJson($url, ['status' => 'retired'])->assertOk();
        $this->postJson($url, ['status' => 'published'])->assertStatus(422);
    }

    public function test_publishing_needs_an_explanation_for_practice_questions(): void
    {
        $q = $this->create(['explanation' => null, 'usage' => 'both']);

        $this->postJson("/api/admin/core/questions/{$q['id']}/status", ['status' => 'published'])->assertStatus(422)->assertJsonValidationErrors('explanation');

        // a test-only question can skip it
        $t = $this->postJson('/api/admin/core/questions', $this->payload(['explanation' => null, 'usage' => 'test', 'external_id' => 'T-1']))->assertCreated()->json('question');
        $this->postJson("/api/admin/core/questions/{$t['id']}/status", ['status' => 'published'])->assertOk();
    }

    public function test_the_second_reviewer_rule_is_configurable(): void
    {
        config(['core_prep.require_second_reviewer' => true]);
        $author = $this->staff();
        Sanctum::actingAs($author);
        $id = $this->postJson('/api/admin/core/questions', $this->payload())->assertCreated()->json('question.id');

        $this->postJson("/api/admin/core/questions/{$id}/status", ['status' => 'published'])->assertStatus(422);

        Sanctum::actingAs($this->staff());
        $this->postJson("/api/admin/core/questions/{$id}/status", ['status' => 'published'])->assertOk();
    }

    public function test_bulk_status_reports_what_could_not_move(): void
    {
        $good = $this->create(['external_id' => 'G-1']);
        $bad = $this->postJson('/api/admin/core/questions', $this->payload(['external_id' => 'B-1', 'explanation' => null]))->json('question');

        $this->postJson('/api/admin/core/questions/bulk-status', ['ids' => [$good['id'], $bad['id']], 'status' => 'published'])
            ->assertOk()->assertJsonPath('moved', 1)->assertJsonPath('failed.0.id', $bad['id']);
    }

    // ───────────────────────────── key lock & fix ─────────────────────────────

    public function test_editing_the_wording_stays_open_after_students_answer_but_the_key_locks(): void
    {
        $q = $this->create();
        CoreQuestion::whereKey($q['id'])->update(['attempts_count' => 12]);
        $url = "/api/admin/core/questions/{$q['id']}";

        // a typo fix in the stem and an option's text is fine
        $this->putJson($url, $this->payload(['stem' => 'Corrected wording of the question:', 'options' => [['id' => 'a', 'text' => '-160 V/V'], ['id' => 'b', 'text' => '-80'], ['id' => 'c', 'text' => '160'], ['id' => 'd', 'text' => '-40']]]))->assertOk();

        // changing which answer is right is not
        $this->putJson($url, $this->payload(['correct' => ['b']]))->assertStatus(422)->assertJsonValidationErrors('correct');
        $this->assertSame(['a'], CoreQuestion::find($q['id'])->correct);

        // nor are the marks
        $this->putJson($url, $this->payload(['marks' => 2]))->assertStatus(422);
    }

    public function test_fixing_a_key_needs_a_reason_bumps_the_version_and_tells_the_graders(): void
    {
        Event::fake([CoreQuestionKeyFixed::class]);
        $q = $this->create();
        CoreQuestion::whereKey($q['id'])->update(['attempts_count' => 5]);
        $url = "/api/admin/core/questions/{$q['id']}/fix-key";

        $this->postJson($url, ['correct' => ['b'], 'reason' => 'oops'])->assertStatus(422)->assertJsonValidationErrors('reason');
        $this->postJson($url, ['correct' => ['a'], 'reason' => 'Checked against the textbook solution.'])->assertStatus(422);   // already the key

        $this->postJson($url, ['correct' => ['b'], 'reason' => 'The textbook solution gives -80; the first key was wrong.'])
            ->assertOk()->assertJsonPath('question.correct', ['b'])->assertJsonPath('question.version', 2);

        Event::assertDispatched(CoreQuestionKeyFixed::class);
        $audit = \App\Models\CoreQuestionAudit::where('action', 'key_fixed')->firstOrFail();
        $this->assertSame('The textbook solution gives -80; the first key was wrong.', $audit->note);
        $this->assertSame(['a'], $audit->changes['correct']['from']);
        $this->assertSame(['b'], $audit->changes['correct']['to']);
    }

    public function test_an_answered_question_keeps_its_options_when_the_key_is_fixed(): void
    {
        $q = $this->create();
        CoreQuestion::whereKey($q['id'])->update(['attempts_count' => 5]);

        $this->postJson("/api/admin/core/questions/{$q['id']}/fix-key", [
            'reason' => 'Removing an option is not allowed here.',
            'options' => [['id' => 'a', 'text' => '-160'], ['id' => 'b', 'text' => '-80']], 'correct' => ['a'],
        ])->assertStatus(422)->assertJsonValidationErrors('options');
    }

    // ───────────────────────────── delete / image / reports ─────────────────────────────

    public function test_only_an_unused_draft_can_be_deleted(): void
    {
        $draft = $this->create(['external_id' => 'D-1']);
        $used = $this->create(['external_id' => 'D-2']);
        CoreQuestion::whereKey($used['id'])->update(['attempts_count' => 1]);

        $this->deleteJson("/api/admin/core/questions/{$used['id']}")->assertStatus(422);
        $this->deleteJson("/api/admin/core/questions/{$draft['id']}")->assertOk();
        $this->assertNull(CoreQuestion::find($draft['id']));
    }

    public function test_a_figure_can_be_attached_and_removed(): void
    {
        Storage::fake('public');
        $q = $this->create();

        $r = $this->post("/api/admin/core/questions/{$q['id']}/image", ['image' => UploadedFile::fake()->image('circuit.png', 400, 300)], ['Accept' => 'application/json'])->assertOk();
        $this->assertNotNull($r->json('question.image_url'));
        Storage::disk('public')->assertExists(CoreQuestion::find($q['id'])->image_path);

        $path = CoreQuestion::find($q['id'])->image_path;
        $this->deleteJson("/api/admin/core/questions/{$q['id']}/image")->assertOk()->assertJsonPath('question.image_url', null);
        Storage::disk('public')->assertMissing($path);
    }

    public function test_student_reports_reach_staff_and_can_be_resolved(): void
    {
        $q = $this->create();
        $student = User::factory()->create(['role' => User::ROLE_USER]);
        $report = CoreQuestionReport::create(['core_question_id' => $q['id'], 'user_id' => $student->id, 'reason' => 'wrong_answer', 'note' => 'I get -80']);

        $this->getJson('/api/admin/core/reports')->assertOk()->assertJsonPath('reports.0.reason', 'wrong_answer')->assertJsonPath('reports.0.question.external_id', 'ECE-0001');
        $this->getJson('/api/admin/core/questions?reported=1')->assertOk()->assertJsonPath('meta.total', 1);

        $this->postJson("/api/admin/core/reports/{$report->id}/resolve", ['status' => 'resolved'])->assertOk();
        $this->getJson('/api/admin/core/reports')->assertJsonCount(0, 'reports');
    }

    public function test_the_list_filters_and_pages(): void
    {
        $this->create(['external_id' => 'F-1', 'difficulty' => 'easy']);
        $this->create(['external_id' => 'F-2', 'difficulty' => 'hard', 'stem' => 'A transformer rated 50 kVA']);

        $this->getJson('/api/admin/core/questions?difficulty=hard')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.external_id', 'F-2');
        $this->getJson('/api/admin/core/questions?q=transformer')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/admin/core/questions?per_page=5&page=1')->assertOk()->assertJsonPath('meta.total', 2);
    }

    // ───────────────────────────── bulk import ─────────────────────────────

    private function csv(array $rows, array $header = null): UploadedFile
    {
        $header ??= ['external_id', 'discipline', 'subject', 'topic', 'type', 'difficulty', 'usage', 'marks', 'negative_marks', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct', 'explanation', 'status'];
        $lines = [implode(',', array_map(fn ($c) => '"'.$c.'"', $header))];
        foreach ($rows as $row) {
            $lines[] = implode(',', array_map(fn ($c) => '"'.str_replace('"', '""', (string) $c).'"', $row));
        }
        $path = tempnam(sys_get_temp_dir(), 'q').'.csv';
        file_put_contents($path, implode("\n", $lines));

        return new UploadedFile($path, 'questions.csv', 'text/csv', null, true);
    }

    private function goodRow(string $id = 'IMP-1', array $over = []): array
    {
        return array_values(array_merge([
            'external_id' => $id, 'discipline' => 'ece', 'subject' => 'Analog Circuits', 'topic' => 'oscillators', 'type' => 'mcq_single',
            'difficulty' => 'easy', 'usage' => 'both', 'marks' => 1, 'negative_marks' => 0.33,
            'question' => 'Which oscillator uses a quartz crystal?', 'a' => 'Colpitts', 'b' => 'Pierce', 'c' => 'Hartley', 'd' => 'Wien',
            'correct' => 'B', 'explanation' => 'The Pierce oscillator is crystal-controlled.', 'status' => 'draft',
        ], $over));
    }

    public function test_a_dry_run_reports_without_writing(): void
    {
        Sanctum::actingAs($this->staff());
        Storage::fake('local');

        $res = $this->post('/api/admin/core/imports', ['file' => $this->csv([
            $this->goodRow('IMP-1'),
            $this->goodRow('IMP-2', ['subject' => 'Nonexistent Subject']),
            $this->goodRow('IMP-3', ['correct' => 'Z']),
            $this->goodRow('IMP-1'),   // duplicate id inside the file
        ])], ['Accept' => 'application/json'])->assertCreated();

        $this->assertSame('checked', $res->json('import.status'));
        $this->assertSame(4, $res->json('import.total_rows'));
        $this->assertSame(1, $res->json('import.valid_rows'));
        $this->assertSame(3, $res->json('import.failed_rows'));
        $this->assertSame(0, CoreQuestion::count(), 'a dry-run writes nothing');

        $errors = collect($res->json('import.errors'));
        $this->assertTrue($errors->contains(fn ($e) => $e['row'] === 3 && $e['field'] === 'subject' && str_contains($e['message'], 'Nonexistent Subject')));
        $this->assertTrue($errors->contains(fn ($e) => $e['row'] === 4 && $e['field'] === 'correct'));
        $this->assertTrue($errors->contains(fn ($e) => $e['row'] === 5 && $e['field'] === 'external_id' && str_contains($e['message'], 'row 2')));
        $this->assertTrue($res->json('import.can_commit'));
    }

    public function test_committing_a_checked_file_imports_the_valid_rows_and_is_idempotent(): void
    {
        Sanctum::actingAs($this->staff());
        Storage::fake('local');

        $dry = $this->post('/api/admin/core/imports', ['file' => $this->csv([$this->goodRow('IMP-1'), $this->goodRow('IMP-2', ['correct' => 'Q'])])], ['Accept' => 'application/json'])->assertCreated();
        $this->postJson('/api/admin/core/imports/'.$dry->json('import.id').'/commit')->assertCreated()
            ->assertJsonPath('import.status', 'completed_with_errors')->assertJsonPath('import.created_rows', 1)->assertJsonPath('import.failed_rows', 1);

        $q = CoreQuestion::where('external_id', 'IMP-1')->firstOrFail();
        $this->assertSame('draft', $q->status);
        $this->assertSame(['b'], $q->correct);
        $this->assertSame('oscillators', $q->topic->code);
        $this->assertSame(0.33, $q->negative_marks);

        // a corrected sheet UPDATES rather than duplicating
        $fixed = $this->post('/api/admin/core/imports', ['file' => $this->csv([$this->goodRow('IMP-1', ['question' => 'Which oscillator is crystal-controlled?'])]), 'mode' => 'commit'], ['Accept' => 'application/json'])->assertCreated();
        $this->assertSame(1, $fixed->json('import.updated_rows'));
        $this->assertSame(0, $fixed->json('import.created_rows'));
        $this->assertSame(1, CoreQuestion::count());
        $this->assertSame('Which oscillator is crystal-controlled?', $q->fresh()->stem);
    }

    public function test_an_import_cannot_rekey_an_answered_question_nor_unpublish_anything(): void
    {
        Sanctum::actingAs($this->staff());
        Storage::fake('local');

        $this->post('/api/admin/core/imports', ['file' => $this->csv([$this->goodRow('IMP-1', ['status' => 'published'])]), 'mode' => 'commit'], ['Accept' => 'application/json'])->assertCreated();
        $q = CoreQuestion::firstOrFail();
        $this->assertSame('published', $q->status);
        CoreQuestion::whereKey($q->id)->update(['attempts_count' => 9]);

        $res = $this->post('/api/admin/core/imports', ['file' => $this->csv([$this->goodRow('IMP-1', ['correct' => 'A', 'status' => 'draft'])]), 'mode' => 'commit'], ['Accept' => 'application/json'])->assertCreated();
        $this->assertSame(1, $res->json('import.failed_rows'));
        $this->assertStringContainsString('locked', $res->json('import.errors.0.message'));
        $this->assertSame(['b'], $q->fresh()->correct);

        // wording-only changes still go through, and a draft status never un-publishes
        $this->post('/api/admin/core/imports', ['file' => $this->csv([$this->goodRow('IMP-1', ['question' => 'Reworded.', 'status' => 'draft'])]), 'mode' => 'commit'], ['Accept' => 'application/json'])->assertCreated();
        $this->assertSame('published', $q->fresh()->status);
        $this->assertSame('Reworded.', $q->fresh()->stem);
    }

    public function test_the_import_can_force_a_branch_family_and_accepts_vendor_column_names(): void
    {
        Sanctum::actingAs($this->staff());
        Storage::fake('local');

        $header = ['id', 'question_text', 'subject_name', 'option_a', 'option_b', 'option_c', 'option_d', 'answer', 'solution', 'level'];
        $row = ['V-1', 'The unit of torque is:', 'Engineering Mechanics', 'N', 'N·m', 'J/s', 'Pa', 'B', 'Torque = force × distance.', 'easy'];

        $res = $this->post('/api/admin/core/imports', ['file' => $this->csv([$row], $header), 'mode' => 'commit', 'discipline' => 'mech'], ['Accept' => 'application/json'])->assertCreated();

        $this->assertSame('completed', $res->json('import.status'), json_encode($res->json('import.errors')));
        $q = CoreQuestion::where('external_id', 'V-1')->firstOrFail();
        $this->assertSame('mech', $q->discipline_code);
        $this->assertSame(['b'], $q->correct);
    }

    public function test_an_excel_file_imports(): void
    {
        Sanctum::actingAs($this->staff());
        Storage::fake('local');

        $book = new Spreadsheet;
        $book->getActiveSheet()->fromArray([
            ['external_id', 'discipline', 'subject', 'type', 'question', 'option_a', 'option_b', 'correct', 'numeric_min', 'numeric_max', 'explanation'],
            ['X-1', 'eee', 'Electrical Machines', 'mcq_single', 'A transformer works on:', 'Self induction', 'Mutual induction', 'B', null, null, 'Mutual induction between windings.'],
            ['X-2', 'eee', 'electrical_machines', 'numeric', 'Turns ratio of a 2200/220 V transformer?', null, null, null, 10, 10, 'N1/N2 = V1/V2 = 10.'],
        ], null, 'A1');
        $path = tempnam(sys_get_temp_dir(), 'x').'.xlsx';
        (new Xlsx($book))->save($path);

        $res = $this->post('/api/admin/core/imports', ['file' => new UploadedFile($path, 'q.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true), 'mode' => 'commit'], ['Accept' => 'application/json'])->assertCreated();

        $this->assertSame('completed', $res->json('import.status'), json_encode($res->json('import.errors')));
        $this->assertSame(2, CoreQuestion::count());
        $this->assertSame('numeric', CoreQuestion::where('external_id', 'X-2')->first()->type);
    }

    public function test_a_json_file_imports(): void
    {
        Sanctum::actingAs($this->staff());
        Storage::fake('local');

        $path = tempnam(sys_get_temp_dir(), 'j').'.json';
        file_put_contents($path, json_encode(['questions' => [[
            'external_id' => 'J-1', 'discipline' => 'civil', 'subject' => 'Geotechnical Engineering', 'type' => 'mcq_multi', 'question' => 'Which are index properties of soil?',
            'options' => ['Liquid limit', 'Cohesion', 'Plastic limit', 'Friction angle'], 'correct' => ['A', 'C'], 'explanation' => 'Atterberg limits are index properties.',
        ]]]));

        $res = $this->post('/api/admin/core/imports', ['file' => new UploadedFile($path, 'q.json', 'application/json', null, true), 'mode' => 'commit'], ['Accept' => 'application/json'])->assertCreated();

        $this->assertSame('completed', $res->json('import.status'), json_encode($res->json('import.errors')));
        $this->assertSame(['a', 'c'], CoreQuestion::where('external_id', 'J-1')->first()->correct);
    }

    public function test_images_come_from_a_zip_flattened_and_filtered(): void
    {
        Sanctum::actingAs($this->staff());
        Storage::fake('local');
        Storage::fake('public');

        $zipPath = tempnam(sys_get_temp_dir(), 'z').'.zip';
        $zip = new ZipArchive;
        $zip->open($zipPath, ZipArchive::CREATE);
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
        $zip->addFromString('figures/circuit1.png', $png);        // nested → flattened to circuit1.png
        $zip->addFromString('../evil.png', $png);                  // path traversal → ignored
        $zip->addFromString('notes.exe', 'MZ');                    // not an allowed type → ignored
        $zip->close();

        $header = ['external_id', 'discipline', 'subject', 'question', 'option_a', 'option_b', 'correct', 'explanation', 'image'];
        $res = $this->post('/api/admin/core/imports', [
            'file' => $this->csv([['I-1', 'ece', 'analog_circuits', 'See the figure.', 'x', 'y', 'A', 'because', 'circuit1.png'], ['I-2', 'ece', 'analog_circuits', 'Missing figure.', 'x', 'y', 'A', 'because', 'evil.png']], $header),
            'images' => new UploadedFile($zipPath, 'figs.zip', 'application/zip', null, true),
            'mode' => 'commit',
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->assertSame(1, $res->json('import.created_rows'));
        $this->assertSame(1, $res->json('import.failed_rows'));
        $this->assertStringContainsString('evil.png', $res->json('import.errors.0.message'));
        $q = CoreQuestion::where('external_id', 'I-1')->firstOrFail();
        $this->assertNotNull($q->image_path);
        Storage::disk('public')->assertExists($q->image_path);
    }

    public function test_an_unreadable_or_unsupported_file_is_refused_or_failed_cleanly(): void
    {
        Sanctum::actingAs($this->staff());
        Storage::fake('local');

        $path = tempnam(sys_get_temp_dir(), 'e').'.exe';
        file_put_contents($path, 'MZ');
        $this->post('/api/admin/core/imports', ['file' => new UploadedFile($path, 'q.exe', 'application/octet-stream', null, true)], ['Accept' => 'application/json'])->assertStatus(422);

        $bad = tempnam(sys_get_temp_dir(), 'b').'.xlsx';
        file_put_contents($bad, 'not a workbook');
        $res = $this->post('/api/admin/core/imports', ['file' => new UploadedFile($bad, 'q.xlsx', 'application/octet-stream', null, true)], ['Accept' => 'application/json'])->assertCreated();
        $this->assertSame('failed', $res->json('import.status'));
    }

    public function test_the_template_lists_the_exact_subject_codes(): void
    {
        Sanctum::actingAs($this->staff());

        $r = $this->get('/api/admin/core/import-template?discipline=mech')->assertOk();
        $path = tempnam(sys_get_temp_dir(), 't').'.xlsx';
        file_put_contents($path, $r->getContent());
        $book = IOFactory::load($path);

        $this->assertSame(['Questions', 'Subjects & topics', 'Guide'], $book->getSheetNames());
        $codes = array_column($book->getSheetByName('Subjects & topics')->toArray(), 1);
        $this->assertContains('thermodynamics', $codes);
        $this->assertNotContains('analog_circuits', $codes);
        $this->assertSame('external_id', $book->getSheetByName('Questions')->getCell('A1')->getValue());

        $this->get('/api/admin/core/import-template?format=csv')->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->get('/api/admin/core/import-template?discipline=astrology')->assertStatus(422);
    }

    // ───────────────────────────── coverage & go-live ─────────────────────────────

    private function publishMany(string $discipline, string $subjectCode, int $count, string $prefix): void
    {
        $subject = $this->subject($discipline, $subjectCode);

        for ($i = 1; $i <= $count; $i++) {
            CoreQuestion::create([
                'external_id' => "{$prefix}-{$i}", 'discipline_code' => $discipline, 'subject_id' => $subject->id, 'type' => 'mcq_single', 'stem' => "Q {$prefix} {$i}",
                'options' => [['id' => 'a', 'text' => 'x'], ['id' => 'b', 'text' => 'y']], 'correct' => ['a'], 'marks' => 1, 'negative_marks' => 0,
                'difficulty' => ['easy', 'medium', 'hard'][$i % 3], 'usage' => 'both', 'status' => 'published',
            ]);
        }
    }

    public function test_coverage_counts_only_published_questions(): void
    {
        $this->publishMany('ece', 'analog_circuits', 6, 'A');
        CoreQuestion::create(['discipline_code' => 'ece', 'subject_id' => $this->subject()->id, 'type' => 'mcq_single', 'stem' => 'draft', 'options' => [['id' => 'a', 'text' => 'x'], ['id' => 'b', 'text' => 'y']], 'correct' => ['a'], 'status' => 'draft']);
        Sanctum::actingAs($this->staff());

        $ece = collect($this->getJson('/api/admin/core/coverage')->assertOk()->json('disciplines'))->firstWhere('discipline', 'ece');
        $analog = collect($ece['subjects'])->firstWhere('code', 'analog_circuits');

        $this->assertSame(6, $analog['total']);
        $this->assertSame(6, $analog['test']);
        $this->assertSame(2, $analog['easy'] + $analog['medium'] + $analog['hard'] - 4);
        $this->assertSame(1, $ece['totals']['draft']);
        $this->assertFalse($ece['go_live']['ready']);
        $this->assertNotEmpty($ece['go_live']['reasons']);
    }

    public function test_going_live_is_superadmin_only_and_needs_enough_questions(): void
    {
        $url = '/api/superadmin/core/disciplines/ece/live';

        Sanctum::actingAs($this->staff());
        $this->postJson($url, ['live' => true])->assertForbidden();

        Sanctum::actingAs($this->superadmin());
        $this->postJson($url, ['live' => true])->assertStatus(422)->assertJsonValidationErrors('live');
        $this->assertFalse((bool) Discipline::where('code', 'ece')->value('is_live'));

        foreach (['analog_circuits', 'digital_circuits', 'network_theory', 'control_systems'] as $s) {
            $this->publishMany('ece', $s, 40, strtoupper(substr($s, 0, 3)));
        }
        $this->postJson($url, ['live' => true])->assertOk()->assertJsonPath('discipline.is_live', true);
        $this->assertNotNull(Discipline::where('code', 'ece')->value('live_at'));

        $this->postJson($url, ['live' => false])->assertOk()->assertJsonPath('discipline.is_live', false);
    }

    public function test_force_overrides_the_guard_knowingly(): void
    {
        Sanctum::actingAs($this->superadmin());

        $this->postJson('/api/superadmin/core/disciplines/mech/live', ['live' => true, 'force' => true])->assertOk()->assertJsonPath('discipline.is_live', true);
        $this->postJson('/api/superadmin/core/disciplines/cse/live', ['live' => true, 'force' => true])->assertStatus(422);   // no Core Prep for CSE
    }

    public function test_the_taxonomy_can_be_extended_but_not_emptied_of_questions(): void
    {
        Sanctum::actingAs($this->staff());

        $subject = $this->postJson('/api/admin/core/subjects', ['discipline_code' => 'ece', 'code' => 'rf_design', 'name' => 'RF Design'])->assertCreated()->json('subject');
        $topic = $this->postJson('/api/admin/core/topics', ['subject_id' => $subject['id'], 'code' => 'smith_chart', 'name' => 'Smith chart'])->assertCreated()->json('topic');
        $this->postJson('/api/admin/core/subjects', ['discipline_code' => 'ece', 'code' => 'rf_design', 'name' => 'Dup'])->assertStatus(422);

        $this->postJson('/api/admin/core/questions', $this->payload(['subject_id' => $subject['id'], 'topic_id' => $topic['id'], 'external_id' => 'RF-1']))->assertCreated();

        $this->deleteJson("/api/admin/core/subjects/{$subject['id']}")->assertStatus(422);
        $this->deleteJson("/api/admin/core/topics/{$topic['id']}")->assertStatus(422);
        $this->putJson("/api/admin/core/subjects/{$subject['id']}", ['name' => 'RF & Microwave Design'])->assertOk();
    }
}
