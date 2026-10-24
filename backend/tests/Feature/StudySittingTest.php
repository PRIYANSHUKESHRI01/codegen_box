<?php

namespace Tests\Feature;

use App\Models\CorePracticeAnswer;
use App\Models\CoreQuestion;
use App\Models\CoreSubject;
use App\Models\Discipline;
use App\Models\StudySitting;
use App\Models\User;
use App\Support\BranchCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Core Prep practice and Skill Drills run in proctored sittings: camera + fullscreen consent, strikes, a lock — all enforced by the
 * server. phpunit.xml switches study proctoring off for the rest of the suite; these tests switch it on.
 */
class StudySittingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['proctoring.study_enabled' => true, 'proctoring.max_violations_before_lock' => 3, 'proctoring.study_lock_cooldown_minutes' => 10]);
    }

    private function student(string $branch = 'ECE'): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'branch' => $branch]);
    }

    /** Opens and consents to a sitting; returns its id. */
    private function sit(string $kind = 'drill', ?string $subject = 'gray_code'): int
    {
        $id = $this->postJson('/api/me/sittings', ['kind' => $kind, 'subject' => $subject])->assertCreated()->json('sitting.id');
        $this->postJson("/api/me/sittings/{$id}/proctoring/start", ['device_info' => ['ua' => 'test']])->assertOk();

        return $id;
    }

    private function attempt(?int $sittingId, array $over = [])
    {
        return $this->postJson('/api/me/drills/attempts', ['sitting_id' => $sittingId, 'attempts' => [['pack' => 'digital', 'skill' => 'gray_code', 'difficulty' => 1, 'correct' => true, 'seconds' => 5] + $over]]);
    }

    private function strike(int $id, string $type = 'tab_switch')
    {
        return $this->postJson("/api/me/sittings/{$id}/proctoring/violations", ['type' => $type]);
    }

    private function liveEce(): void
    {
        Discipline::where('code', 'ece')->update(['is_live' => true, 'live_at' => now()]);
        app(BranchCatalog::class)->flush();
        $subject = CoreSubject::where('discipline_code', 'ece')->where('code', 'analog_circuits')->firstOrFail();
        foreach (range(1, 4) as $n) {
            CoreQuestion::create([
                'external_id' => "SIT-{$n}", 'discipline_code' => 'ece', 'subject_id' => $subject->id, 'topic_id' => $subject->topics()->first()->id, 'type' => 'mcq_single',
                'stem' => "Question {$n}?", 'options' => [['id' => 'a', 'text' => 'right'], ['id' => 'b', 'text' => 'wrong']], 'correct' => ['a'], 'marks' => 1,
                'negative_marks' => 0, 'difficulty' => 'medium', 'usage' => 'both', 'status' => 'published', 'explanation' => 'a',
            ]);
        }
    }

    // ───────────────────────────── opening, consent, violations ─────────────────────────────

    public function test_a_student_opens_a_sitting_and_consents_to_it(): void
    {
        Sanctum::actingAs($s = $this->student());

        $open = $this->postJson('/api/me/sittings', ['kind' => 'drill', 'subject' => 'gray_code'])->assertCreated();
        $open->assertJsonPath('proctored', true)->assertJsonPath('sitting.status', 'active')->assertJsonPath('sitting.max_violations', 3);
        $this->assertNull(StudySitting::first()->consented_at);

        $id = $open->json('sitting.id');
        $this->postJson("/api/me/sittings/{$id}/proctoring/start", ['device_info' => ['ua' => 'x']])->assertOk()->assertJsonPath('session.violation_count', 0);
        $this->assertNotNull(StudySitting::find($id)->consented_at);
        // a refresh re-consents without resetting anything
        $this->postJson("/api/me/sittings/{$id}/proctoring/start")->assertOk();
    }

    public function test_only_students_may_open_a_sitting_and_the_kind_must_be_known(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO]));
        $this->postJson('/api/me/sittings', ['kind' => 'drill'])->assertForbidden();

        Sanctum::actingAs($this->student());
        $this->postJson('/api/me/sittings', ['kind' => 'contest'])->assertUnprocessable();
        $this->postJson('/api/me/sittings', [])->assertUnprocessable();
    }

    public function test_opening_a_new_sitting_ends_the_previous_one_of_the_same_kind_only(): void
    {
        Sanctum::actingAs($this->student());
        $first = $this->sit('drill');
        $core = $this->sit('core_practice', 'analog_circuits');
        $second = $this->sit('drill');

        $this->assertSame('completed', StudySitting::find($first)->status);
        $this->assertSame('active', StudySitting::find($second)->status);
        $this->assertSame('active', StudySitting::find($core)->status);
    }

    public function test_a_sitting_belongs_to_its_student(): void
    {
        Sanctum::actingAs($this->student());
        $id = $this->sit();

        Sanctum::actingAs($this->student());
        $this->postJson("/api/me/sittings/{$id}/proctoring/start")->assertNotFound();
        $this->strike($id)->assertNotFound();
        $this->postJson("/api/me/sittings/{$id}/complete")->assertNotFound();
    }

    public function test_violations_need_consent_and_only_strikes_count(): void
    {
        Sanctum::actingAs($this->student());
        $id = $this->postJson('/api/me/sittings', ['kind' => 'drill'])->json('sitting.id');
        $this->strike($id)->assertNotFound(); // before consent

        $this->postJson("/api/me/sittings/{$id}/proctoring/start")->assertOk();
        $this->strike($id, 'paste_attempt')->assertOk()->assertJsonPath('session.violation_count', 0)->assertJsonPath('locked', false);
        $this->strike($id, 'context_menu_blocked')->assertOk()->assertJsonPath('session.violation_count', 0);
        $this->strike($id, 'tab_switch')->assertOk()->assertJsonPath('session.violation_count', 1);
        $this->strike($id, 'made_up')->assertUnprocessable();

        $this->assertSame(3, StudySitting::find($id)->violations()->count());
    }

    public function test_the_third_strike_locks_the_sitting(): void
    {
        Sanctum::actingAs($this->student());
        $id = $this->sit();

        $this->strike($id, 'tab_switch')->assertJsonPath('locked', false);
        $this->strike($id, 'fullscreen_exit')->assertJsonPath('locked', false);
        $this->strike($id, 'devtools_detected')->assertJsonPath('locked', true)->assertJsonPath('session.status', 'locked');

        $this->assertNotNull(StudySitting::find($id)->locked_at);
        // further events are kept but never strike again
        $this->strike($id)->assertOk()->assertJsonPath('session.violation_count', 3);
    }

    public function test_a_locked_student_cannot_open_another_sitting_for_the_cool_down_and_then_can(): void
    {
        Sanctum::actingAs($this->student());
        $id = $this->sit();
        foreach (['tab_switch', 'fullscreen_exit', 'devtools_detected'] as $t) {
            $this->strike($id, $t);
        }

        $this->postJson('/api/me/sittings', ['kind' => 'drill'])->assertStatus(423)->assertJsonPath('code', 'sitting_cooldown');
        // the other kind is a different activity
        $this->postJson('/api/me/sittings', ['kind' => 'core_practice'])->assertCreated();

        $this->travel(11)->minutes();
        $this->postJson('/api/me/sittings', ['kind' => 'drill'])->assertCreated();
    }

    public function test_by_default_a_locked_student_can_start_a_new_practice_sitting_straight_away(): void
    {
        $this->assertSame(0, (include base_path('config/proctoring.php'))['study_lock_cooldown_minutes'], 'no waiting period unless Ops adds one');

        config(['proctoring.study_lock_cooldown_minutes' => 0]);
        Sanctum::actingAs($this->student());
        $locked = $this->sit();
        foreach (['tab_switch', 'fullscreen_exit', 'devtools_detected'] as $t) {
            $this->strike($locked, $t);
        }
        $this->attempt($locked)->assertStatus(423); // the locked sitting stays closed…

        $fresh = $this->sit(); // …but a new one opens at once, with a clean strike count
        $this->assertNotSame($locked, $fresh);
        $this->attempt($fresh)->assertCreated();
        $this->assertSame(0, StudySitting::find($fresh)->violation_count);
        $this->assertSame('locked', StudySitting::find($locked)->status);
    }

    public function test_a_finished_sitting_cannot_be_started_again(): void
    {
        Sanctum::actingAs($this->student());
        $id = $this->sit();
        $this->postJson("/api/me/sittings/{$id}/complete")->assertOk()->assertJsonPath('session.status', 'completed');
        $this->postJson("/api/me/sittings/{$id}/complete")->assertOk(); // idempotent
        $this->postJson("/api/me/sittings/{$id}/proctoring/start")->assertStatus(409);
    }

    public function test_with_study_proctoring_switched_off_nothing_is_created_or_required(): void
    {
        config(['proctoring.study_enabled' => false]);
        Sanctum::actingAs($this->student());

        $this->postJson('/api/me/sittings', ['kind' => 'drill'])->assertOk()->assertJsonPath('proctored', false)->assertJsonPath('sitting', null);
        $this->assertSame(0, StudySitting::count());
        $this->attempt(null)->assertCreated();
    }

    // ───────────────────────────── Skill Drills answers ─────────────────────────────

    public function test_a_drill_answer_is_refused_without_a_sitting(): void
    {
        Sanctum::actingAs($this->student());

        $this->attempt(null)->assertStatus(428)->assertJsonPath('code', 'sitting_required');
        $this->attempt(9999)->assertStatus(428)->assertJsonPath('code', 'sitting_required');
        $this->assertSame(0, DB::table('drill_attempts')->count());
    }

    public function test_a_drill_answer_is_refused_before_consent_and_accepted_after_with_its_sitting_recorded(): void
    {
        Sanctum::actingAs($this->student());
        $id = $this->postJson('/api/me/sittings', ['kind' => 'drill'])->json('sitting.id');

        $this->attempt($id)->assertStatus(428)->assertJsonPath('code', 'sitting_not_started');

        $this->postJson("/api/me/sittings/{$id}/proctoring/start")->assertOk();
        $this->attempt($id)->assertCreated()->assertJsonPath('accepted', 1);
        $this->assertSame($id, (int) DB::table('drill_attempts')->value('study_sitting_id'));
    }

    public function test_another_students_or_another_kinds_sitting_does_not_count(): void
    {
        Sanctum::actingAs($this->student());
        $mine = $this->sit('core_practice', 'analog_circuits');
        $this->attempt($mine)->assertStatus(428)->assertJsonPath('code', 'sitting_required'); // wrong kind

        Sanctum::actingAs($this->student());
        $this->attempt($mine)->assertStatus(428);
    }

    public function test_a_locked_sitting_stops_accepting_answers(): void
    {
        Sanctum::actingAs($this->student());
        $id = $this->sit();
        $this->attempt($id)->assertCreated();
        foreach (['tab_switch', 'fullscreen_exit', 'tab_switch'] as $t) {
            $this->strike($id, $t);
        }

        $this->attempt($id)->assertStatus(423)->assertJsonPath('code', 'sitting_locked');
        $this->assertSame(1, DB::table('drill_attempts')->count());
    }

    public function test_the_last_batch_still_counts_when_it_lands_just_after_the_sitting_ended_normally(): void
    {
        Sanctum::actingAs($this->student());
        $id = $this->sit();
        $this->postJson("/api/me/sittings/{$id}/complete")->assertOk();

        $this->attempt($id)->assertCreated();
        $this->assertSame(1, DB::table('drill_attempts')->count());
    }

    // ───────────────────────────── Core Prep practice ─────────────────────────────

    public function test_core_practice_hands_out_and_accepts_answers_only_inside_a_proctored_sitting(): void
    {
        $this->liveEce();
        Sanctum::actingAs($s = $this->student('ECE'));

        $this->postJson('/api/core/practice/next')->assertStatus(428)->assertJsonPath('code', 'sitting_required');

        $id = $this->sit('core_practice', 'analog_circuits');
        $q = $this->postJson('/api/core/practice/next', ['sitting_id' => $id])->assertOk()->json('question');
        $this->assertNotNull($q);

        $this->postJson("/api/core/practice/{$q['id']}/answer", ['selected' => ['a']])->assertStatus(428);
        $this->postJson("/api/core/practice/{$q['id']}/answer", ['selected' => ['a'], 'sitting_id' => $id])->assertOk()->assertJsonPath('correct', true);

        $this->assertSame($id, (int) CorePracticeAnswer::where('user_id', $s->id)->value('study_sitting_id'));
    }

    public function test_core_practice_stops_once_the_sitting_is_locked_or_ended(): void
    {
        $this->liveEce();
        Sanctum::actingAs($this->student('ECE'));
        $id = $this->sit('core_practice', 'analog_circuits');
        foreach (['tab_switch', 'fullscreen_exit', 'tab_switch'] as $t) {
            $this->strike($id, $t);
        }
        $this->postJson('/api/core/practice/next', ['sitting_id' => $id])->assertStatus(423)->assertJsonPath('code', 'sitting_locked');

        $this->travel(11)->minutes();
        $fresh = $this->sit('core_practice', 'analog_circuits');
        $this->postJson("/api/me/sittings/{$fresh}/complete")->assertOk();
        // unlike a drill's background upload, a Core question is only handed out into a live sitting
        $this->postJson('/api/core/practice/next', ['sitting_id' => $fresh])->assertStatus(409)->assertJsonPath('code', 'sitting_ended');
    }

    public function test_core_practice_without_study_proctoring_works_as_before(): void
    {
        config(['proctoring.study_enabled' => false]);
        $this->liveEce();
        Sanctum::actingAs($this->student('ECE'));

        $this->postJson('/api/core/practice/next')->assertOk();
    }
}
