<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** "Today's practice": what the home offers a student next, decided from their branch, their stated focus and what they left half-done. */
class PracticeShelfTest extends TestCase
{
    use RefreshDatabase;

    private function student(string $branch = 'ECE', array $over = []): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'branch' => $branch] + $over);
    }

    private function cards(User $u): array
    {
        Sanctum::actingAs($u);

        return $this->getJson('/api/me/practice-shelf')->assertOk()->json('cards');
    }

    private function ids(array $cards): array
    {
        return array_column($cards, 'id');
    }

    private function drill(User $u, string $skill, array $results): void
    {
        foreach ($results as $correct) {
            DB::table('drill_attempts')->insert(['user_id' => $u->id, 'pack' => 'digital', 'skill' => $skill, 'difficulty' => 1, 'correct' => $correct, 'seconds' => 5, 'created_at' => now()]);
        }
    }

    public function test_the_default_shelf_carries_the_shared_modules_in_a_sensible_order(): void
    {
        $cards = $this->cards($this->student());

        $this->assertSame(['interview', 'drills', 'soft_skills', 'communication'], $this->ids($cards));
    }

    public function test_what_the_student_says_they_want_to_practise_comes_first(): void
    {
        $cards = $this->cards($this->student('ECE', ['focus_areas' => ['soft_skills', 'communication']]));

        $this->assertSame(['soft_skills', 'communication', 'interview', 'drills'], $this->ids($cards));
        $this->assertTrue($cards[0]['pinned']);
        $this->assertFalse($cards[2]['pinned']);
    }

    public function test_core_subjects_as_a_focus_area_pins_the_drills(): void
    {
        $this->assertSame('drills', $this->cards($this->student('ECE', ['focus_areas' => ['core_subjects']]))[0]['id']);
    }

    public function test_an_interview_left_half_done_leads_the_shelf(): void
    {
        $u = $this->student('ECE', ['focus_areas' => ['soft_skills']]);
        $interview = Interview::create(['title' => 'Half done', 'slug' => 'half-done', 'status' => 'published', 'interview_type' => 'general', 'is_mock' => true]);
        InterviewSession::create(['interview_id' => $interview->id, 'user_id' => $u->id, 'status' => InterviewSession::STATUS_IN_PROGRESS, 'started_at' => now(), 'current_question_order' => 1]);

        $cards = $this->cards($u);

        $this->assertSame('interview', $cards[0]['id']);
        $this->assertTrue($cards[0]['resume']);
        $this->assertSame('half-done', $cards[0]['slug']);
    }

    public function test_the_interview_card_suggests_the_role_that_matches_their_interests(): void
    {
        $card = $this->cards($this->student('Mechanical', ['core_interests' => ['thermal']]))[0];

        $this->assertSame('mech_thermal', $card['role']);
        $this->assertTrue($card['recommended']);
        $this->assertTrue($card['for_branch']);
    }

    public function test_the_drill_card_follows_the_branch_and_starts_a_newcomer_on_the_first_skill(): void
    {
        $ece = collect($this->cards($this->student('ECE')))->firstWhere('id', 'drills');
        $mech = collect($this->cards($this->student('Mechanical')))->firstWhere('id', 'drills');
        $cse = collect($this->cards($this->student('CSE')))->firstWhere('id', 'drills');

        $this->assertSame(['circuits', 'ohms_law', 'start'], [$ece['pack'], $ece['skill'], $ece['reason']]);
        $this->assertSame(['quickcalcs', 'unit_conversion'], [$mech['pack'], $mech['skill']]);
        $this->assertSame(['digital', 'number_conversion'], [$cse['pack'], $cse['skill']]);
    }

    public function test_the_drill_card_points_at_the_weakest_skill_once_there_is_enough_to_judge(): void
    {
        $u = $this->student('CSE');
        $this->drill($u, 'number_conversion', [1, 1, 1, 1]);          // solid
        $this->drill($u, 'twos_complement', [0, 0, 1, 0]);            // weak: 25 %
        $this->drill($u, 'gray_code', [1, 0]);                        // not enough answers to judge

        $card = collect($this->cards($u))->firstWhere('id', 'drills');

        $this->assertSame(['twos_complement', 'weak'], [$card['skill'], $card['reason']]);
    }

    public function test_when_everything_is_solid_the_card_offers_a_fresh_skill_then_a_refresher(): void
    {
        $u = $this->student('CSE');
        $this->drill($u, 'number_conversion', [1, 1, 1, 1]);

        $this->assertSame(['ones_complement', 'new'], array_values(collect(collect($this->cards($u))->firstWhere('id', 'drills'))->only(['skill', 'reason'])->all()));

        foreach (config('drills.packs.digital.skills') as $skill) {
            $this->drill($u, $skill, [1, 1, 1, 1]);
        }
        DB::table('drill_attempts')->where('user_id', $u->id)->where('skill', 'gray_code')->update(['created_at' => now()->subDays(9)]);

        $card = collect($this->cards($u))->firstWhere('id', 'drills');
        $this->assertSame(['gray_code', 'refresh'], [$card['skill'], $card['reason']], 'the one practised longest ago');
    }

    public function test_the_soft_skills_card_reports_the_library_and_their_progress(): void
    {
        $u = $this->student();
        $a = SoftSkillAssessment::create(['title' => 'Set 1', 'slug' => 'set-1', 'status' => 'published', 'assessment_type' => 'general', 'is_question_set' => true, 'duration_minutes' => 20]);
        SoftSkillAssessment::create(['title' => 'Set 2', 'slug' => 'set-2', 'status' => 'published', 'assessment_type' => 'general', 'is_question_set' => true, 'duration_minutes' => 20]);
        SoftSkillSession::create(['soft_skill_assessment_id' => $a->id, 'user_id' => $u->id, 'status' => SoftSkillSession::STATUS_COMPLETED, 'started_at' => now(), 'completed_at' => now()]);

        $card = collect($this->cards($u))->firstWhere('id', 'soft_skills');

        $this->assertSame(2, $card['sets_total']);
        $this->assertSame(1, $card['sets_completed']);
        $this->assertFalse($card['in_progress']);
    }

    public function test_the_shelf_carries_the_drill_streak_and_is_for_students_only(): void
    {
        $u = $this->student();
        $this->drill($u, 'number_conversion', [1]);
        Sanctum::actingAs($u);

        $this->assertSame(1, $this->getJson('/api/me/practice-shelf')->json('streak.current'));

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO]));
        $this->getJson('/api/me/practice-shelf')->assertForbidden();
    }
}
