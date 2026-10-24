<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Contest;
use App\Models\Discipline;
use App\Models\Interview;
use App\Models\InterviewTrack;
use App\Models\SoftSkillAssessment;
use App\Models\User;
use App\Support\BranchAudience;
use App\Support\BranchCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * P2 of the multi-branch work: a student states (or confirms) their branch and what to lead with,
 * "ask me later" is remembered, a core-first student can finish onboarding without a language,
 * and content a TPO or Mellow aims at certain branches is invisible to the rest.
 */
class StudentBranchAndAudienceTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    private function college(): College
    {
        $n = ++$this->seq;

        return College::create(['name' => "Audience College {$n}", 'short_code' => "AC{$n}", 'tier' => 'Standard']);
    }

    private function student(array $attrs = []): User
    {
        return User::factory()->create(['role' => User::ROLE_USER] + $attrs);
    }

    private function goLive(string $discipline): void
    {
        Discipline::where('code', $discipline)->update(['is_live' => true, 'live_at' => now()]);
        app(BranchCatalog::class)->flush();
    }

    // ───────────────────────────── branch_pending ─────────────────────────────

    public function test_a_student_with_no_recognised_branch_is_asked(): void
    {
        $this->assertTrue($this->student()->fresh()->branch_pending);
        $this->assertTrue($this->student(['branch' => 'Quantum Basket Weaving'])->fresh()->branch_pending);
    }

    public function test_a_student_whose_college_branch_is_recognised_is_not_asked(): void
    {
        $this->assertFalse($this->student(['branch' => 'CSE'])->fresh()->branch_pending);
        $this->assertFalse($this->student(['branch' => 'ECE'])->fresh()->branch_pending, 'Core Prep is not live yet, so there is nothing more to ask');
    }

    public function test_once_core_prep_is_live_a_core_student_is_asked_what_to_lead_with(): void
    {
        $ece = $this->student(['branch' => 'ECE']);
        $cse = $this->student(['branch' => 'CSE']);
        $this->goLive('ece');

        $this->assertTrue($ece->fresh()->branch_pending);
        $this->assertFalse($cse->fresh()->branch_pending, 'CSE has no track to choose');

        $ece->forceFill(['track_focus' => 'balanced'])->save();
        $this->assertFalse($ece->fresh()->branch_pending);
    }

    public function test_staff_are_never_asked(): void
    {
        $this->assertFalse(User::factory()->create(['role' => User::ROLE_ADMIN_TPO])->fresh()->branch_pending);
    }

    public function test_ask_me_later_is_remembered_then_comes_back(): void
    {
        $s = $this->student();
        Sanctum::actingAs($s);

        $this->postJson('/api/me/branch/skip')->assertOk()->assertJsonPath('user.branch_pending', false);

        $this->travel(8)->days();
        $this->assertTrue($s->fresh()->branch_pending);
    }

    // ───────────────────────────── PUT /me/branch ─────────────────────────────

    public function test_a_student_can_state_their_branch(): void
    {
        $s = $this->student();
        Sanctum::actingAs($s);

        $this->putJson('/api/me/branch', ['branch_code' => 'mech'])
            ->assertOk()
            ->assertJsonPath('user.branch_code', 'mech')
            ->assertJsonPath('user.discipline', 'mech')
            ->assertJsonPath('user.branch_source', 'self')
            ->assertJsonPath('user.branch_pending', false);

        $this->assertNotNull($s->fresh()->branch_confirmed_at);
    }

    public function test_a_recognised_college_branch_cannot_be_overridden_by_the_student(): void
    {
        $s = $this->student(['branch' => 'Civil']);
        Sanctum::actingAs($s);

        $this->putJson('/api/me/branch', ['branch_code' => 'mech'])->assertOk();

        $this->assertSame('civil', $s->fresh()->branch_code);
        $this->assertSame('college', $s->fresh()->branch_source);
    }

    public function test_an_unrecognised_college_label_can_be_stated_by_the_student(): void
    {
        $s = $this->student(['branch' => 'Mech-A (Day)']);
        Sanctum::actingAs($s);

        $this->putJson('/api/me/branch', ['branch_code' => 'mech'])->assertOk()->assertJsonPath('user.branch_source', 'self');
    }

    public function test_track_focus_and_interests_are_saved_for_a_non_cs_student(): void
    {
        $s = $this->student(['branch' => 'ECE']);
        Sanctum::actingAs($s);

        $this->putJson('/api/me/branch', ['track_focus' => 'core_first', 'core_interests' => ['vlsi', 'embedded']])
            ->assertOk()
            ->assertJsonPath('user.track_focus', 'core_first')
            ->assertJsonPath('user.core_interests', ['vlsi', 'embedded']);
    }

    public function test_a_cse_student_has_no_track(): void
    {
        $s = $this->student(['branch' => 'CSE']);
        Sanctum::actingAs($s);

        $this->putJson('/api/me/branch', ['track_focus' => 'core_first'])->assertOk()->assertJsonPath('user.track_focus', null);
    }

    public function test_bad_values_are_refused(): void
    {
        Sanctum::actingAs($this->student());

        $this->putJson('/api/me/branch', ['branch_code' => 'nope'])->assertStatus(422);
        $this->putJson('/api/me/branch', ['track_focus' => 'sideways'])->assertStatus(422);
        $this->putJson('/api/me/branch', ['core_interests' => ['not_an_interest']])->assertStatus(422);
    }

    public function test_a_student_can_flag_the_colleges_label_as_wrong(): void
    {
        $s = $this->student(['branch' => 'Civil']);
        Sanctum::actingAs($s);

        $this->postJson('/api/me/branch/dispute')->assertOk();
        $this->assertNotNull($s->fresh()->branch_disputed_at);

        // …but only a label the college provided can be disputed
        Sanctum::actingAs($this->student());
        $this->postJson('/api/me/branch/dispute')->assertStatus(422);
    }

    public function test_only_students_answer_the_branch_question(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO]));

        $this->putJson('/api/me/branch', ['branch_code' => 'mech'])->assertForbidden();
        $this->postJson('/api/me/branch/skip')->assertForbidden();
    }

    // ───────────────────────────── core-first onboarding ─────────────────────────────

    public function test_a_core_first_student_finishes_onboarding_without_a_language(): void
    {
        $s = $this->student(['branch' => 'Mechanical']);
        Sanctum::actingAs($s);

        $this->postJson('/api/me/onboarding', ['skill_level' => 'beginner', 'career_goal' => 'core_company', 'track_focus' => 'core_first'])
            ->assertOk()
            ->assertJsonPath('user.onboarding_pending', false)
            ->assertJsonPath('user.track_focus', 'core_first')
            ->assertJsonPath('user.primary_language', null);
    }

    public function test_everyone_else_still_needs_a_language(): void
    {
        Sanctum::actingAs($this->student(['branch' => 'CSE']));

        $this->postJson('/api/me/onboarding', ['skill_level' => 'beginner', 'career_goal' => 'campus_placement'])
            ->assertStatus(422)->assertJsonValidationErrors('primary_language');

        // a balanced non-CS student still codes, so the language stays required for them too
        Sanctum::actingAs($this->student(['branch' => 'ECE']));
        $this->postJson('/api/me/onboarding', ['skill_level' => 'beginner', 'career_goal' => 'core_company', 'track_focus' => 'balanced'])
            ->assertStatus(422)->assertJsonValidationErrors('primary_language');
    }

    public function test_settings_completes_a_core_first_student_too(): void
    {
        $s = $this->student(['branch' => 'ECE']);
        Sanctum::actingAs($s);

        $this->putJson('/api/me/preferences', ['skill_level' => 'beginner', 'career_goal' => 'psu_gate', 'track_focus' => 'core_first'])->assertOk();

        $this->assertNotNull($s->fresh()->onboarding_completed_at);
    }

    // ───────────────────────────── audience targeting ─────────────────────────────

    public function test_audience_includes_the_right_students(): void
    {
        $ece = $this->student(['branch' => 'ECE']);
        $etc = $this->student(['branch' => 'E&TC']);
        $cse = $this->student(['branch' => 'CSE']);
        $unknown = $this->student(['branch' => 'Quantum Basket Weaving']);
        $none = $this->student();

        $family = ['disciplines' => ['ece'], 'branches' => []];
        $this->assertTrue(BranchAudience::includes($family, $ece));
        $this->assertTrue(BranchAudience::includes($family, $etc), 'E&TC is in the ECE family');
        $this->assertFalse(BranchAudience::includes($family, $cse));
        $this->assertTrue(BranchAudience::includes($family, $unknown), 'unknown branch → fail open');
        $this->assertTrue(BranchAudience::includes($family, $none));

        $exact = ['disciplines' => [], 'branches' => ['ece']];
        $this->assertTrue(BranchAudience::includes($exact, $ece));
        $this->assertFalse(BranchAudience::includes($exact, $etc), 'a specific branch is not its family');

        $this->assertTrue(BranchAudience::includes(null, $cse));
        $this->assertNull(BranchAudience::normalize(['disciplines' => [], 'branches' => []]));
    }

    public function test_a_tpo_can_aim_a_mock_contest_at_one_branch_and_other_students_never_see_it(): void
    {
        $college = $this->college();
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
        $ece = $this->student(['college_id' => $college->id, 'branch' => 'ECE']);
        $cse = $this->student(['college_id' => $college->id, 'branch' => 'CSE']);

        Sanctum::actingAs($tpo);
        $created = $this->postJson('/api/tpo/contests', [
            'title' => 'ECE mock', 'start_at' => now()->addDay()->toIso8601String(), 'end_at' => now()->addDays(2)->toIso8601String(),
            'branch_audience' => ['disciplines' => ['ece']],
        ])->assertCreated()->json('contest');
        $id = $created['id'];
        $slug = $created['slug']; // contests are addressed by slug in every route

        $this->postJson("/api/tpo/contests/{$slug}", ['status' => Contest::STATUS_PUBLISHED])->assertOk();
        $this->assertSame(['disciplines' => ['ece'], 'branches' => []], Contest::find($id)->branch_audience);

        Sanctum::actingAs($ece);
        $this->assertContains($id, collect($this->getJson('/api/contests')->assertOk()->json('contests'))->pluck('id')->all());

        Sanctum::actingAs($cse);
        $this->assertNotContains($id, collect($this->getJson('/api/contests')->assertOk()->json('contests'))->pluck('id')->all());
        $this->getJson("/api/contests/{$slug}")->assertNotFound();

        // clearing the audience opens it to the college again
        Sanctum::actingAs($tpo);
        $this->postJson("/api/tpo/contests/{$slug}", ['branch_audience' => null])->assertOk();
        $this->assertNull(Contest::find($id)->branch_audience);
        Sanctum::actingAs($cse);
        $this->assertContains($id, collect($this->getJson('/api/contests')->json('contests'))->pluck('id')->all());
    }

    public function test_audience_is_enforced_on_every_content_type(): void
    {
        $ece = $this->student(['branch' => 'ECE']);
        $cse = $this->student(['branch' => 'CSE']);
        $audience = ['disciplines' => ['ece'], 'branches' => []];

        $contest = Contest::create(['title' => 'c', 'slug' => 'c', 'start_at' => now(), 'end_at' => now()->addDay(), 'status' => 'published', 'contest_type' => 'general', 'branch_audience' => $audience]);
        $this->assertTrue($contest->isVisibleToUser($ece));
        $this->assertFalse($contest->isVisibleToUser($cse));

        $interview = Interview::create(['title' => 'i', 'slug' => 'i', 'status' => 'published', 'interview_type' => 'general', 'branch_audience' => $audience]);
        $this->assertTrue($interview->isVisibleToUser($ece));
        $this->assertFalse($interview->isVisibleToUser($cse));

        $soft = SoftSkillAssessment::create(['title' => 's', 'slug' => 's', 'status' => 'published', 'assessment_type' => 'general', 'duration_minutes' => 30, 'pass_percentage' => 60, 'branch_audience' => $audience]);
        $this->assertTrue($soft->isVisibleToUser($ece));
        $this->assertFalse($soft->isVisibleToUser($cse));

        $track = InterviewTrack::create(['title' => 't', 'slug' => 't', 'status' => 'published', 'track_type' => 'general', 'role_title' => 'r', 'branch_audience' => $audience]);
        $this->assertTrue($track->isVisibleToUser($ece));
        $this->assertFalse($track->isVisibleToUser($cse));

        // a track's first round takes the audience from the track it belongs to
        $round = Interview::create(['title' => 'r1', 'slug' => 'r1', 'status' => 'published', 'interview_type' => 'general', 'interview_track_id' => $track->id, 'round_number' => 1]);
        $this->assertTrue($round->isVisibleToUser($ece));
        $this->assertFalse($round->isVisibleToUser($cse));
    }

    public function test_an_invalid_audience_is_refused(): void
    {
        $college = $this->college();
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]));

        $this->postJson('/api/tpo/contests', [
            'title' => 'x', 'start_at' => now()->addDay()->toIso8601String(), 'end_at' => now()->addDays(2)->toIso8601String(),
            'branch_audience' => ['disciplines' => ['astrology']],
        ])->assertStatus(422);
    }
}
