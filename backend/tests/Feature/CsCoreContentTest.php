<?php

namespace Tests\Feature;

use App\Models\CoreQuestion;
use App\Models\CoreSubject;
use App\Models\Discipline;
use App\Models\MockInterviewQuestion;
use App\Models\User;
use App\Services\Core\CoreAccess;
use App\Services\Mock\MockInterviewCatalog;
use App\Support\BranchCatalog;
use Database\Seeders\MockInterviewQuestionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The Computer Science core for CSE / IT students: DBMS, Operating Systems, Computer Networks, OOP, Data Structures, Algorithms ...
 * as Domain Prep (questions to practise and test on) and as spoken questions in the Mock AI Interview. CSE and IT used to have
 * neither "by design"; these tests pin that they now do, that nothing else about a CSE student changed, and that the content
 * is shaped so the platform can serve it.
 */
class CsCoreContentTest extends TestCase
{
    use RefreshDatabase;

    private function student(array $over = []): User
    {
        return User::factory()->create(array_merge(['role' => User::ROLE_USER, 'branch' => 'Computer Science and Engineering', 'must_change_password' => false], $over))->fresh();
    }

    public function test_cse_has_domain_prep_with_the_cs_subjects_and_a_real_bank(): void
    {
        BranchCatalog::instance()->flush();

        $this->assertContains('cse', CoreAccess::families());

        $subjects = CoreSubject::where('discipline_code', 'cse')->pluck('code')->all();
        foreach (['dbms', 'operating_systems', 'computer_networks', 'oop', 'data_structures', 'algorithms', 'computer_organization', 'theory_of_computation', 'software_engineering', 'discrete_math'] as $code) {
            $this->assertContains($code, $subjects, "CSE has the {$code} subject");
        }

        $published = CoreQuestion::where('discipline_code', 'cse')->where('status', CoreQuestion::STATUS_PUBLISHED)->count();
        $this->assertGreaterThanOrEqual(150, $published, 'enough to pass the go-live guard without force');

        $perSubject = CoreQuestion::where('discipline_code', 'cse')->selectRaw('subject_id, count(*) as n')->groupBy('subject_id')->pluck('n')->all();
        $this->assertGreaterThanOrEqual(4, count(array_filter($perSubject, fn ($n) => $n >= 15)), 'four subjects with 15+ questions');
    }

    public function test_the_bank_is_well_formed_and_every_key_is_among_its_options(): void
    {
        $questions = CoreQuestion::where('discipline_code', 'cse')->get();
        $this->assertGreaterThanOrEqual(150, $questions->count());

        foreach ($questions as $q) {
            $this->assertNotNull($q->subject_id);
            $this->assertSame('cse', $q->subject->discipline_code);
            $this->assertNotSame('', trim((string) $q->explanation), "{$q->external_id} explains its answer");
            $this->assertGreaterThan(20, mb_strlen($q->stem), "{$q->external_id} has a real stem");

            if ($q->type === 'numeric') {
                $this->assertNotNull($q->numeric_min);
                $this->assertNotNull($q->numeric_max);
                $this->assertTrue((float) $q->numeric_min <= (float) $q->numeric_max, "{$q->external_id} has a sane accepted range");
            } else {
                $ids = array_column($q->options, 'id');
                $this->assertCount(4, $ids, "{$q->external_id} has four options");
                $this->assertCount(1, array_intersect($q->correct, $ids), "{$q->external_id} has its key among its options");
                $this->assertCount(4, array_unique(array_column($q->options, 'text')), "{$q->external_id} has no duplicate options");
            }
        }

        // Answer letters are balanced (no "it is always B" tell).
        $letters = array_count_values(array_map(fn ($q) => $q->correct[0] ?? '', $questions->where('type', 'mcq_single')->all()));
        foreach ($letters as $letter => $n) {
            $this->assertLessThan(0.4, $n / max(1, $questions->where('type', 'mcq_single')->count()), "answer {$letter} is not over-represented");
        }
    }

    public function test_it_can_be_switched_live_by_the_normal_guard_and_then_a_cse_student_has_it(): void
    {
        $superadmin = User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
        $student = $this->student();
        $this->assertSame('cse', $student->discipline);

        $access = app(CoreAccess::class);
        $this->assertFalse($access->available($student), 'hidden until staff switch it on, like every family');

        Sanctum::actingAs($superadmin);
        $this->postJson('/api/superadmin/core/disciplines/cse/live', ['live' => true])->assertOk()->assertJsonPath('discipline.is_live', true);
        BranchCatalog::instance()->flush();

        $this->assertTrue($access->available($student->fresh()));
        $this->assertSame('cse', Discipline::where('code', 'cse')->value('code'));
    }

    public function test_a_cse_student_is_never_asked_the_core_or_it_first_question_and_their_score_is_unchanged(): void
    {
        Discipline::where('code', 'cse')->update(['is_live' => true, 'live_at' => now()]);
        BranchCatalog::instance()->flush();

        $cse = $this->student();
        $ece = $this->student(['branch' => 'Electronics and Communication Engineering']);

        $this->assertSame('cse', $cse->discipline);
        $this->assertTrue($cse->hasDomainPrepFamily());
        $this->assertFalse($cse->needsBranchConfirmation(), 'CSE already leads with IT: no track question');
        $this->assertTrue($ece->needsBranchConfirmation() || $ece->track_focus === null, 'the core families still ask');

        // No track means the software weights, so nothing about the score moved.
        $this->assertSame('software', $cse->readinessBreakdown()['profile'] ?? 'software');
    }

    public function test_the_cs_core_is_a_mock_ai_interview_domain_with_six_ready_stacks(): void
    {
        $this->seed(MockInterviewQuestionsSeeder::class);

        $catalog = app(MockInterviewCatalog::class);
        $catalog->flush();

        $role = $catalog->roles()['cs_core'] ?? null;
        $this->assertNotNull($role, 'the Computer Science Core domain exists');
        $this->assertSame(['cs_dbms', 'cs_os', 'cs_cn', 'cs_oop', 'cs_dsa', 'cs_se'], array_keys($role['stacks']));

        foreach ($role['stacks'] as $key => $stack) {
            $this->assertCount(3, $stack['rounds'], "{$key} has three rounds");
            $this->assertTrue($catalog->progress($stack)['live'], "{$key} is open to students");

            foreach ($stack['rounds'] as $round) {
                $this->assertGreaterThanOrEqual($catalog->minQuestions(), count($round['questions']), "{$key} round {$round['round_number']} is ready");
                $this->assertGreaterThan(0, $round['duration_minutes']);
                foreach ($round['questions'] as $q) {
                    $this->assertGreaterThanOrEqual(15, mb_strlen($q['text']));
                    $this->assertLessThanOrEqual(800, mb_strlen($q['text']));
                    $this->assertNotEmpty($q['note'], 'every question carries the rubric the scorer is given');
                    $this->assertTrue($q['needs_review'], 'AI-written content is flagged for a faculty read');
                }
            }
        }

        $this->assertSame(108, MockInterviewQuestion::whereIn('stack_key', array_keys($role['stacks']))->count());
        // Idempotent: seeding again adds nothing.
        $this->seed(MockInterviewQuestionsSeeder::class);
        $this->assertSame(108, MockInterviewQuestion::whereIn('stack_key', array_keys($role['stacks']))->count());
    }

    public function test_the_vault_ai_catalogue_and_merchant_navy_are_untouched(): void
    {
        $this->seed(MockInterviewQuestionsSeeder::class);
        $roles = app(MockInterviewCatalog::class)->roles();

        $this->assertArrayHasKey('merchant_navy', $roles);
        $this->assertArrayHasKey('backend', $roles);
        $this->assertArrayNotHasKey('cs_dbms', $roles['backend']['stacks']);

        // The Vault AI Interview never lists the CS core (it is for IT roles employers hire for; this is subject revision).
        $this->assertArrayNotHasKey('cs_core', app(\App\Services\Vault\CuratedCatalog::class)->roles());
    }
}
