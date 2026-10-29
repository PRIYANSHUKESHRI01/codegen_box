<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\CuratedSetQuestion;
use App\Models\Interview;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\VaultInterviewQualification;
use App\Models\VaultStackInterest;
use App\Services\Vault\CuratedCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Every Mellow Vault domain has a place in the Vault AI Interview: the catalog lists all of them, a domain without questions
 * is "coming soon" (nothing can be started, no half-made records), students can ask to be told when one opens, and staff
 * fill domains through the admin tools — at which point the domain opens by itself and the waiting students are told.
 */
class VaultAiDomainCatalogTest extends TestCase
{
    use RefreshDatabase;

    /** The "Development & IT" list on Mellow Vault, exactly as it is shown there. */
    private const MELLOW_VAULT_DOMAINS = [
        'Laravel Developer', 'Web Developer', 'Games Developer', 'Cloud Infrastructure', 'Ethical Hacking', 'Data Analytics',
        'CMS Developer', 'NLT(Natural Language Toolkit)', 'SQL Developer', 'UI/UX Design', 'Python Developer', 'C++ Developer',
        'BlockChain', 'Data Science', 'MERN Developer', 'ML/DL', 'AI/ML', 'API', 'Angular Developer', 'Cryptography', 'Docker',
        'SEO Specialist', 'Power BI', 'Cloud Computing', 'PHP Developer', 'Software Testing', 'Data Engineering', 'Digital Marketing',
        'Cyber Security', 'E-Commerce', 'Embedded System', 'Natural Language Processing (NLP)', 'AI and Robotics', 'Deep Learning',
        'Quantum Computing', 'Data Mining',
    ];

    private CuratedCatalog $catalog;

    protected function setUp(): void
    {
        parent::setUp();
        $this->catalog = app(CuratedCatalog::class);
    }

    private function student(): User
    {
        return User::factory()->create(['role' => User::ROLE_USER]);
    }

    private function staff(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_VAULT]]);
    }

    /** @return list<array<string, mixed>> */
    private function setsOf(string $stackKey): array
    {
        $this->catalog->flush();

        return $this->catalog->allSets($this->catalog->stack($stackKey)['stack']);
    }

    /** Writes $count questions into every set of a stack, straight into the table (the admin tools are tested separately). */
    private function fill(string $stackKey, int $count = 5, ?string $exceptSetId = null): void
    {
        foreach ($this->setsOf($stackKey) as $set) {
            $have = count($set['questions']);

            if ($set['id'] === $exceptSetId) {
                continue;
            }

            for ($i = $have; $i < $count; $i++) {
                CuratedSetQuestion::create([
                    'set_id' => $set['id'], 'stack_key' => $stackKey, 'series_number' => $set['series_number'], 'set_number' => $set['set_number'],
                    'position' => $i + 1, 'text' => "Explain scenario {$i} for {$set['id']} in your own words.", 'category' => 'technical', 'duration_seconds' => 180,
                ]);
            }
        }

        $this->catalog->flush();
    }

    // ───────────────────────────── the catalog ─────────────────────────────

    public function test_every_mellow_vault_domain_has_a_stack_to_interview_in(): void
    {
        $covered = [];

        foreach ((array) config('curated_interview_domains.domains') as $stackKey => $labels) {
            $this->assertNotNull($this->catalog->stack($stackKey), "stack [{$stackKey}] is named in the domain map but is not in the catalog");

            foreach ($labels as $label) {
                $covered[mb_strtolower($label)] = $stackKey;
            }
        }

        foreach (self::MELLOW_VAULT_DOMAINS as $domain) {
            $this->assertArrayHasKey(mb_strtolower($domain), $covered, "Mellow Vault domain \"{$domain}\" has no stack");
        }
    }

    public function test_the_catalog_is_complete_and_shaped_the_same_for_every_stack(): void
    {
        $roles = $this->catalog->roles();
        $stacks = 0;
        $setIds = [];
        $seriesIds = [];

        foreach ($roles as $roleKey => $role) {
            $this->assertNotEmpty($role['title'], "role {$roleKey}");
            $this->assertNotEmpty($role['stacks'], "role {$roleKey} has no stacks");

            foreach ($role['stacks'] as $stackKey => $stack) {
                $stacks++;
                $this->assertCount(3, $stack['series'], "{$stackKey} has 3 series");

                foreach ($stack['series'] as $series) {
                    $seriesIds[] = $series['id'];
                    $this->assertCount(3, $series['sets'], "{$stackKey} series {$series['series_number']} has 3 sets");

                    foreach ($series['sets'] as $set) {
                        $setIds[] = $set['id'];
                        $this->assertSame($series['series_number'], $set['series_number']);
                        $this->assertNotEmpty($set['title']);
                        $this->assertNotEmpty($set['description']);
                    }
                }
            }
        }

        $this->assertSame(13, count($roles));
        $this->assertSame(41, $stacks, '12 hand-written stacks + 29 new domains');
        $this->assertSame(count($setIds), count(array_unique($setIds)), 'set ids are unique');
        $this->assertSame(count($seriesIds), count(array_unique($seriesIds)), 'series ids are unique');
        $this->assertSame(41 * 9, count($setIds));
    }

    public function test_the_original_stacks_are_untouched_and_all_open(): void
    {
        $original = ['laravel', 'nodejs', 'python', 'java', 'golang', 'react_nextjs', 'typescript', 'mern', 'nextjs_fullstack', 'llm_rag', 'deeplearning_pytorch', 'docker_k8s'];

        foreach ($original as $key) {
            $progress = $this->catalog->progress($this->catalog->stack($key)['stack']);
            $this->assertTrue($progress['live'], "{$key} must stay open");
            $this->assertSame(9, $progress['ready_sets']);
        }

        // The set ids the qualification service and past interviews refer to are unchanged.
        $this->assertSame('backend-laravel-s1-set1', $this->catalog->stack('laravel')['stack']['series'][0]['sets'][0]['id']);
        $this->assertSame('backend', $this->catalog->stack('laravel')['role']['key']);

        // New stacks join the existing roles; the existing roles keep their original stacks first.
        $this->assertSame(['laravel', 'nodejs', 'python', 'java', 'golang', 'php', 'cms', 'api_design'], array_keys($this->catalog->roles()['backend']['stacks']));
    }

    public function test_the_example_a_student_asked_about_exists_data_analyst(): void
    {
        $found = $this->catalog->stack('data_analytics');

        $this->assertSame('data_analyst', $found['role']['key']);
        $this->assertSame('Data Analyst', $found['role']['title']);
        $this->assertSame(['data_analytics', 'sql', 'power_bi'], array_keys($this->catalog->roles()['data_analyst']['stacks']));
        $this->assertStringContainsString('SQL', implode(' ', array_column($this->setsOf('data_analytics'), 'description')));
    }

    public function test_new_domains_start_empty_and_closed(): void
    {
        $progress = $this->catalog->progress($this->catalog->stack('data_analytics')['stack']);

        $this->assertFalse($progress['live']);
        $this->assertSame(0, $progress['ready_sets']);
        $this->assertSame(9, $progress['total_sets']);
        $this->assertCount(9, $progress['missing']);
        $this->assertSame(['series' => 1, 'set' => 1, 'have' => 0, 'need' => 5], $progress['missing'][0]);
    }

    public function test_a_stack_opens_only_when_all_nine_sets_are_ready(): void
    {
        $sets = $this->setsOf('sql');
        $this->fill('sql', 5, exceptSetId: $sets[8]['id']);

        $progress = $this->catalog->progress($this->catalog->stack('sql')['stack']);
        $this->assertFalse($progress['live'], '8 of 9 is not open');
        $this->assertSame(8, $progress['ready_sets']);

        $this->fill('sql');
        $this->assertTrue($this->catalog->isLive('sql'));

        // One question short in one set closes it again.
        CuratedSetQuestion::where('set_id', $sets[0]['id'])->first()->delete();
        $this->catalog->flush();
        $this->assertFalse($this->catalog->isLive('sql'));
    }

    // ───────────────────────────── what a student sees ─────────────────────────────

    public function test_the_student_catalog_lists_every_stack_and_says_which_are_open(): void
    {
        Sanctum::actingAs($this->student());

        $response = $this->getJson('/api/curated-interview-sets')->assertOk()
            ->assertJsonPath('stats.total_roles', 13)
            ->assertJsonPath('stats.total_stacks', 41)
            ->assertJsonPath('stats.live_stacks', 12);

        $stacks = collect($response->json('roles'))->flatMap(fn ($r) => $r['stacks'])->keyBy('key');

        $this->assertTrue($stacks['laravel']['live']);
        $this->assertFalse($stacks['sql']['live']);
        $this->assertSame(0, $stacks['sql']['ready_sets']);
        $this->assertSame(9, $stacks['sql']['total_sets']);
        $this->assertContains('SQL Developer', $stacks['sql']['aliases']);
        $this->assertCount(3, $stacks['sql']['series'], 'the syllabus of a coming-soon stack is still visible');
        $this->assertFalse($stacks['sql']['interested']);

        $backend = collect($response->json('roles'))->firstWhere('key', 'backend');
        $this->assertSame(8, $backend['stacks_count']);
        $this->assertSame(5, $backend['live_stacks_count']);
    }

    public function test_a_coming_soon_stack_reports_its_state_and_creates_no_records_by_being_looked_at(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->getJson('/api/vault-qualification/status?stack=data_analytics')->assertOk()
            ->assertJsonPath('stack_live', false)
            ->assertJsonPath('status', 'coming_soon')
            ->assertJsonPath('role_key', 'data_analyst')
            ->assertJsonPath('total_sets', 9);

        $this->assertSame(0, VaultInterviewQualification::count());

        // An open stack still answers with the full track.
        $this->getJson('/api/vault-qualification/status?stack=laravel')->assertOk()->assertJsonPath('stack_live', true)->assertJsonPath('current_attempt', 1);
    }

    public function test_a_coming_soon_stack_cannot_be_started_and_leaves_nothing_behind(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->postJson('/api/vault-qualification/start-set', ['stack' => 'data_analytics', 'set_number' => 1])
            ->assertStatus(409)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'not open yet'));

        $this->assertSame(0, VaultInterviewQualification::count(), 'no qualification row');
        $this->assertSame(0, Interview::count(), 'no empty interview');

        // The generic "practice from a curated set" route refuses an empty set too.
        $this->postJson('/api/curated-interview-sets/data_analyst-data_analytics-s1-set1/start')->assertStatus(409);
        $this->assertSame(0, Interview::count());

        $this->postJson('/api/vault-qualification/start-set', ['stack' => 'no_such_stack', 'set_number' => 1])->assertNotFound();
        $this->getJson('/api/vault-qualification/status?stack=no_such_stack')->assertNotFound();
    }

    public function test_once_filled_a_new_stack_runs_the_normal_qualification_with_its_own_questions(): void
    {
        $this->fill('data_analytics');
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->getJson('/api/vault-qualification/status?stack=data_analytics')->assertOk()->assertJsonPath('stack_live', true)
            ->assertJsonPath('active_series.sets.0.question_count', 5);

        $slug = $this->postJson('/api/vault-qualification/start-set', ['stack' => 'data_analytics', 'set_number' => 1])->assertOk()->json('interview.slug');

        $interview = Interview::where('slug', $slug)->firstOrFail();
        $this->assertSame(5, $interview->interviewQuestions()->count());
        $this->assertSame('data_analytics', $interview->practice_config['stack_key']);
        $this->assertSame('data_analyst', $interview->practice_config['role_key']);
        $this->assertSame('data_analyst-data_analytics-s1-set1', $interview->practice_config['set_id']);
        $this->assertStringContainsString('Data Analyst (Data Analytics)', $interview->title);

        $qualification = VaultInterviewQualification::sole();
        $this->assertSame('data_analyst', $qualification->role_key);
        $this->assertSame('data_analyst-data_analytics-series-1', $qualification->active_series_id);
    }

    // ───────────────────────────── "notify me" ─────────────────────────────

    public function test_a_student_can_ask_to_be_told_and_change_their_mind(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->postJson('/api/vault-qualification/interest', ['stack' => 'power_bi'])->assertCreated()->assertJsonPath('interested', true);
        $this->postJson('/api/vault-qualification/interest', ['stack' => 'power_bi'])->assertCreated();   // idempotent
        $this->assertSame(1, VaultStackInterest::count());

        $stacks = collect($this->getJson('/api/curated-interview-sets')->json('roles'))->flatMap(fn ($r) => $r['stacks'])->keyBy('key');
        $this->assertTrue($stacks['power_bi']['interested']);
        $this->getJson('/api/vault-qualification/status?stack=power_bi')->assertJsonPath('interested', true);

        $this->deleteJson('/api/vault-qualification/interest', ['stack' => 'power_bi'])->assertOk()->assertJsonPath('interested', false);
        $this->assertSame(0, VaultStackInterest::count());
    }

    public function test_interest_is_refused_for_an_open_stack_an_unknown_one_and_a_non_student(): void
    {
        Sanctum::actingAs($this->student());

        $this->postJson('/api/vault-qualification/interest', ['stack' => 'laravel'])->assertStatus(422);
        $this->postJson('/api/vault-qualification/interest', ['stack' => 'nope'])->assertNotFound();
        $this->postJson('/api/vault-qualification/interest', [])->assertStatus(422);

        Sanctum::actingAs($this->staff());
        $this->postJson('/api/vault-qualification/interest', ['stack' => 'power_bi'])->assertForbidden();

        $this->assertSame(0, VaultStackInterest::count());
    }

    public function test_when_the_last_set_is_filled_the_stack_opens_and_waiting_students_are_told_once(): void
    {
        $waiting = $this->student();
        $other = $this->student();
        $already = $this->student();
        VaultStackInterest::create(['user_id' => $waiting->id, 'stack_key' => 'seo']);
        VaultStackInterest::create(['user_id' => $other->id, 'stack_key' => 'digital_marketing']);   // a different stack
        VaultStackInterest::create(['user_id' => $already->id, 'stack_key' => 'seo', 'notified_at' => now()->subDay()]);

        $last = $this->setsOf('seo')[8];
        $this->fill('seo', 5, exceptSetId: $last['id']);

        Sanctum::actingAs($this->staff());

        // Four questions in the last set: still closed, nobody told.
        for ($i = 1; $i <= 4; $i++) {
            $this->postJson("/api/admin/vault-ai/sets/{$last['id']}/questions", ['text' => "How would you audit crawl budget on a large site, case {$i}?"])->assertCreated();
        }
        $this->assertSame(0, UserNotification::where('group_key', 'vault.stack_open:seo')->count());

        // The fifth opens it.
        $this->postJson("/api/admin/vault-ai/sets/{$last['id']}/questions", ['text' => 'Walk me through diagnosing a sudden fall in organic traffic.'])->assertCreated()
            ->assertJsonPath('stack.live', true);

        $note = UserNotification::where('group_key', 'vault.stack_open:seo')->get();
        $this->assertCount(1, $note, 'only the student still waiting');
        $this->assertSame($waiting->id, $note->first()->user_id);
        $this->assertStringContainsString('SEO', $note->first()->title);
        $this->assertNotNull(VaultStackInterest::where('user_id', $waiting->id)->first()->notified_at);

        // More questions later do not announce it again.
        $this->postJson("/api/admin/vault-ai/sets/{$last['id']}/questions", ['text' => 'Which metrics would you put in a monthly SEO report, and why those?'])->assertCreated();
        $this->assertSame(1, UserNotification::where('group_key', 'vault.stack_open:seo')->count());
    }

    // ───────────────────────────── staff tools ─────────────────────────────

    public function test_only_vault_staff_can_use_the_question_tools(): void
    {
        $this->getJson('/api/admin/vault-ai/coverage')->assertUnauthorized();

        foreach ([$this->student(), User::factory()->create(['role' => User::ROLE_ADMIN_TPO]), User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => []])] as $user) {
            Sanctum::actingAs($user);
            $this->getJson('/api/admin/vault-ai/coverage')->assertForbidden();
            $this->postJson('/api/admin/vault-ai/sets/data_analyst-sql-s1-set1/questions', ['text' => 'A perfectly reasonable interview question here?'])->assertForbidden();
        }

        $this->assertSame(0, CuratedSetQuestion::count());

        Sanctum::actingAs($this->staff());
        $this->getJson('/api/admin/vault-ai/coverage')->assertOk();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));
        $this->getJson('/api/admin/vault-ai/coverage')->assertOk();
    }

    public function test_coverage_shows_every_stack_with_its_progress_and_who_is_waiting(): void
    {
        $this->fill('python', 5);
        VaultStackInterest::create(['user_id' => $this->student()->id, 'stack_key' => 'sql']);
        VaultStackInterest::create(['user_id' => $this->student()->id, 'stack_key' => 'sql']);
        $this->fill('sql', 5, exceptSetId: $this->setsOf('sql')[0]['id']);
        Sanctum::actingAs($this->staff());

        $response = $this->getJson('/api/admin/vault-ai/coverage')->assertOk()
            ->assertJsonPath('min_questions', 5)
            ->assertJsonPath('stats.stacks', 41)
            ->assertJsonPath('stats.live', 12)
            ->assertJsonPath('stats.coming_soon', 29);

        $stacks = collect($response->json('roles'))->flatMap(fn ($r) => $r['stacks'])->keyBy('key');
        $this->assertSame(8, $stacks['sql']['ready_sets']);
        $this->assertSame(2, $stacks['sql']['waiting']);
        $this->assertSame([0, 5, 5], $stacks['sql']['grid'][0]);
        $this->assertTrue($stacks['laravel']['live']);
        $this->assertSame(0, $stacks['laravel']['custom_questions']);
        $this->assertSame(40, $stacks['sql']['custom_questions'], '8 ready sets x 5');
    }

    public function test_staff_add_edit_and_remove_a_question_and_it_is_audited(): void
    {
        $staff = $this->staff();
        Sanctum::actingAs($staff);
        $setId = 'data_analyst-sql-s2-set3';

        $created = $this->postJson("/api/admin/vault-ai/sets/{$setId}/questions", [
            'text' => '  How would  you find duplicate   rows in a 50 million row table? ',
            'category' => 'technical', 'duration_seconds' => 240, 'note' => 'Window functions or GROUP BY HAVING; index awareness.',
        ])->assertCreated();

        $id = $created->json('question.id');
        $row = CuratedSetQuestion::findOrFail($id);
        $this->assertSame('How would you find duplicate rows in a 50 million row table?', $row->text, 'whitespace is tidied');
        $this->assertSame(240, $row->duration_seconds);
        $this->assertSame('sql', $row->stack_key);
        $this->assertSame(2, $row->series_number);
        $this->assertSame(3, $row->set_number);
        $this->assertSame($staff->id, $row->created_by);

        $this->putJson("/api/admin/vault-ai/questions/{$id}", ['text' => 'How would you remove duplicate rows from a very large table safely?', 'category' => 'situational'])->assertOk();
        $this->assertSame('situational', $row->fresh()->category);

        $detail = $this->getJson('/api/admin/vault-ai/stacks/sql')->assertOk()->json('stack');
        $set = $detail['series'][1]['sets'][2];
        $this->assertSame($setId, $set['id']);
        $this->assertSame('custom', $set['questions'][0]['source']);
        $this->assertFalse($set['ready']);

        $this->deleteJson("/api/admin/vault-ai/questions/{$id}")->assertOk();
        $this->assertNull(CuratedSetQuestion::find($id));

        foreach (['Added', 'Edited', 'Removed'] as $verb) {
            $this->assertSame(1, ActivityLog::where('action', "{$verb} a Vault AI Interview question")->count());
        }
    }

    public function test_bad_questions_and_unknown_sets_are_refused(): void
    {
        Sanctum::actingAs($this->staff());
        $setId = 'data_analyst-sql-s1-set1';

        $this->postJson("/api/admin/vault-ai/sets/{$setId}/questions", ['text' => 'too short'])->assertStatus(422)->assertJsonValidationErrors('text');
        $this->postJson("/api/admin/vault-ai/sets/{$setId}/questions", ['text' => str_repeat('x', 801)])->assertStatus(422);
        $this->postJson("/api/admin/vault-ai/sets/{$setId}/questions", ['text' => 'A perfectly reasonable question here?', 'category' => 'nonsense'])->assertStatus(422);
        $this->postJson("/api/admin/vault-ai/sets/{$setId}/questions", ['text' => 'A perfectly reasonable question here?', 'duration_seconds' => 5])->assertStatus(422);
        $this->postJson('/api/admin/vault-ai/sets/not-a-set/questions', ['text' => 'A perfectly reasonable question here?'])->assertNotFound();
        $this->getJson('/api/admin/vault-ai/stacks/not-a-stack')->assertNotFound();

        $this->assertSame(0, CuratedSetQuestion::count());
    }

    public function test_the_same_question_cannot_be_added_to_a_set_twice(): void
    {
        Sanctum::actingAs($this->staff());
        $url = '/api/admin/vault-ai/sets/data_analyst-sql-s1-set1/questions';

        $this->postJson($url, ['text' => 'What is the difference between WHERE and HAVING?'])->assertCreated();
        $this->postJson($url, ['text' => 'what is the  difference between where and having?'])->assertStatus(422)->assertJsonValidationErrors('text');
        // The same wording in another set is a different question.
        $this->postJson('/api/admin/vault-ai/sets/data_analyst-sql-s1-set2/questions', ['text' => 'What is the difference between WHERE and HAVING?'])->assertCreated();

        $this->assertSame(2, CuratedSetQuestion::count());
    }

    public function test_a_question_cannot_be_removed_if_it_would_close_a_stack_students_are_using(): void
    {
        $this->fill('sql', 5);
        $set = $this->setsOf('sql')[0];
        Sanctum::actingAs($this->staff());

        $first = CuratedSetQuestion::where('set_id', $set['id'])->orderBy('id')->first();
        $this->deleteJson("/api/admin/vault-ai/questions/{$first->id}")->assertStatus(422)->assertJsonValidationErrors('question');
        $this->assertNotNull($first->fresh());
        $this->assertTrue($this->catalog->isLive('sql'));

        // With a spare question the same removal is fine.
        $this->postJson("/api/admin/vault-ai/sets/{$set['id']}/questions", ['text' => 'A spare sixth question for this set, written properly?'])->assertCreated();
        $this->deleteJson("/api/admin/vault-ai/questions/{$first->id}")->assertOk();
        $this->assertTrue($this->catalog->isLive('sql'));
    }

    // ───────────────────────────── bulk import ─────────────────────────────

    private function csv(string $body): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('questions.csv', $body);
    }

    public function test_a_spreadsheet_import_adds_good_rows_and_reports_bad_ones_and_skips_duplicates(): void
    {
        Sanctum::actingAs($this->staff());

        $body = implode("\n", [
            'stack,series,set,question,category,seconds,note',
            'sql,1,1,"Explain the difference between INNER JOIN and LEFT JOIN with an example.",technical,150,"Rows kept, NULLs on the right."',
            'sql,1,1,"Explain the difference between INNER JOIN and LEFT JOIN with an example.",technical,,',
            'sql,1,2,"What is a window function and when would you use one?",,,',
            'nope,1,1,"A question for a stack that does not exist at all.",,,',
            'sql,4,1,"A question for a series that does not exist at all.",,,',
            'sql,1,1,short,,,',
            'sql,1,3,"What does an index do, and what does it cost on writes?",weird,,',
            ',,,,,,',
        ]);

        $result = $this->postJson('/api/admin/vault-ai/import', ['file' => $this->csv($body)])->assertOk();

        $result->assertJsonPath('added', 2)->assertJsonPath('duplicates', 1);
        $errors = collect($result->json('errors'))->keyBy('row');
        $this->assertCount(4, $errors);
        $this->assertStringContainsString('Unknown stack', $errors[5]['message']);
        $this->assertStringContainsString('1, 2 or 3', $errors[6]['message']);
        $this->assertStringContainsString('too short', $errors[7]['message']);
        $this->assertStringContainsString('Unknown category', $errors[8]['message']);

        $first = CuratedSetQuestion::where('set_id', 'data_analyst-sql-s1-set1')->sole();
        $this->assertSame(150, $first->duration_seconds);
        $this->assertSame('Rows kept, NULLs on the right.', $first->note);
        $this->assertSame('technical', CuratedSetQuestion::where('set_id', 'data_analyst-sql-s1-set2')->sole()->category, 'a blank category defaults to technical');

        // Uploading the corrected file again is safe: what is already there is skipped.
        $again = $this->postJson('/api/admin/vault-ai/import', ['file' => $this->csv($body)])->assertOk();
        $again->assertJsonPath('added', 0)->assertJsonPath('duplicates', 3);
        $this->assertSame(2, CuratedSetQuestion::count());

        $this->assertSame(2, ActivityLog::where('action', 'Imported Vault AI Interview questions')->count(), 'each upload is audited');
    }

    public function test_an_import_can_fill_and_open_a_whole_stack_in_one_upload(): void
    {
        $user = $this->student();
        VaultStackInterest::create(['user_id' => $user->id, 'stack_key' => 'cpp']);
        Sanctum::actingAs($this->staff());

        $lines = ['stack,series,set,question,category,seconds,note'];
        foreach ([1, 2, 3] as $series) {
            foreach ([1, 2, 3] as $set) {
                foreach (range(1, 5) as $n) {
                    $lines[] = "cpp,{$series},{$set},\"C++ question {$n} for series {$series} set {$set}: explain the idea and a pitfall.\",technical,180,";
                }
            }
        }

        $this->postJson('/api/admin/vault-ai/import', ['file' => $this->csv(implode("\n", $lines))])->assertOk()
            ->assertJsonPath('added', 45)
            ->assertJsonPath('opened', ['C++']);

        $this->assertTrue($this->catalog->isLive('cpp'));
        $this->assertSame(1, UserNotification::where('user_id', $user->id)->where('group_key', 'vault.stack_open:cpp')->count());
    }

    public function test_the_import_refuses_the_wrong_file_and_the_template_downloads(): void
    {
        Sanctum::actingAs($this->staff());

        $this->postJson('/api/admin/vault-ai/import', [])->assertStatus(422)->assertJsonValidationErrors('file');
        $this->postJson('/api/admin/vault-ai/import', ['file' => UploadedFile::fake()->createWithContent('q.pdf', '%PDF')])->assertStatus(422);
        $this->postJson('/api/admin/vault-ai/import', ['file' => $this->csv("a,b\n1,2")])->assertStatus(422)->assertJsonValidationErrors('file');
        $this->postJson('/api/admin/vault-ai/import', ['file' => $this->csv('')])->assertStatus(422);

        $template = $this->get('/api/admin/vault-ai/template')->assertOk();
        $this->assertStringContainsString('spreadsheetml', (string) $template->headers->get('Content-Type'));
        $this->assertStringStartsWith('PK', (string) $template->getContent(), 'an .xlsx is a zip');
    }

    public function test_a_server_that_has_not_run_the_migration_still_serves_the_catalog(): void
    {
        \Illuminate\Support\Facades\Schema::drop('curated_set_questions');
        $this->catalog->flush();
        Sanctum::actingAs($this->student());

        $this->getJson('/api/curated-interview-sets')->assertOk()->assertJsonPath('stats.live_stacks', 12);
    }
}
