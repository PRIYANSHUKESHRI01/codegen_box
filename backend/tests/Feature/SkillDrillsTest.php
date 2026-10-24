<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Skill Drills persistence: validating and recording answers, the per-skill recent window, the day streak, limits and privacy. */
class SkillDrillsTest extends TestCase
{
    use RefreshDatabase;

    private function student(): User
    {
        return User::factory()->create(['role' => User::ROLE_USER]);
    }

    private function attempt(array $over = []): array
    {
        return $over + ['pack' => 'digital', 'skill' => 'twos_complement', 'difficulty' => 2, 'correct' => true, 'seconds' => 12];
    }

    /** An attempt on a past day, as the table would hold it. */
    private function backdate(User $u, int $daysAgo, int $n = 1, string $skill = 'twos_complement', bool $correct = true): void
    {
        for ($i = 0; $i < $n; $i++) {
            DB::table('drill_attempts')->insert(['user_id' => $u->id, 'pack' => 'digital', 'skill' => $skill, 'difficulty' => 1, 'correct' => $correct, 'seconds' => 5, 'created_at' => now()->subDays($daysAgo)->setTime(12, 0)]);
        }
    }

    public function test_answers_are_recorded_and_read_back_per_skill(): void
    {
        $u = $this->student();
        Sanctum::actingAs($u);

        $this->postJson('/api/me/drills/attempts', ['attempts' => [
            $this->attempt(['correct' => true]), $this->attempt(['correct' => false, 'difficulty' => 3]), $this->attempt(['skill' => 'gray_code']),
        ]])->assertCreated()->assertJson(['accepted' => 3, 'dropped' => 0]);

        $res = $this->getJson('/api/me/drills')->assertOk();

        $this->assertSame(2, $res->json('skills.twos_complement.attempts'));
        $this->assertSame(1, $res->json('skills.twos_complement.correct'));
        $this->assertSame(1, $res->json('skills.gray_code.attempts'));
        $this->assertSame(3, $res->json('streak.today'));
        $this->assertTrue($res->json('streak.active_today'));
    }

    public function test_the_recent_window_is_newest_first_and_capped(): void
    {
        config(['drills.recent_window' => 3]);
        $u = $this->student();
        Sanctum::actingAs($u);

        foreach ([true, true, false, true, false] as $correct) {                // oldest -> newest
            $this->postJson('/api/me/drills/attempts', ['attempts' => [$this->attempt(['correct' => $correct, 'difficulty' => $correct ? 1 : 2])]])->assertCreated();
        }

        $recent = $this->getJson('/api/me/drills')->json('skills.twos_complement.recent');

        $this->assertSame([[0, 2], [1, 1], [0, 2]], $recent, 'the last three answers, newest first, as [correct, difficulty]');
    }

    public function test_it_only_accepts_skills_the_catalogue_knows_and_in_their_own_pack(): void
    {
        Sanctum::actingAs($this->student());

        $this->postJson('/api/me/drills/attempts', ['attempts' => [$this->attempt(['skill' => 'made_up'])]])->assertStatus(422)->assertJsonValidationErrors('attempts.0.skill');
        $this->postJson('/api/me/drills/attempts', ['attempts' => [$this->attempt(['pack' => 'nope'])]])->assertStatus(422)->assertJsonValidationErrors('attempts.0.pack');
        $this->postJson('/api/me/drills/attempts', ['attempts' => [$this->attempt(['pack' => 'circuits'])]])->assertStatus(422);                  // twos_complement is a digital skill
        $this->postJson('/api/me/drills/attempts', ['attempts' => [$this->attempt(['difficulty' => 4])]])->assertStatus(422);
        $this->postJson('/api/me/drills/attempts', ['attempts' => [$this->attempt(['seconds' => 5000])]])->assertStatus(422);
        $this->postJson('/api/me/drills/attempts', ['attempts' => []])->assertStatus(422);

        $this->assertSame(0, DB::table('drill_attempts')->count());
    }

    public function test_a_batch_is_capped(): void
    {
        Sanctum::actingAs($this->student());
        $tooMany = array_fill(0, (int) config('drills.limits.batch') + 1, $this->attempt());

        $this->postJson('/api/me/drills/attempts', ['attempts' => $tooMany])->assertStatus(422);
    }

    public function test_past_the_daily_allowance_answers_are_dropped_quietly(): void
    {
        config(['drills.limits.attempts_per_day' => 4]);
        $u = $this->student();
        Sanctum::actingAs($u);

        $this->postJson('/api/me/drills/attempts', ['attempts' => array_fill(0, 3, $this->attempt())])->assertCreated()->assertJson(['accepted' => 3, 'dropped' => 0]);
        $this->postJson('/api/me/drills/attempts', ['attempts' => array_fill(0, 3, $this->attempt())])->assertCreated()->assertJson(['accepted' => 1, 'dropped' => 2]);
        $this->postJson('/api/me/drills/attempts', ['attempts' => [$this->attempt()]])->assertCreated()->assertJson(['accepted' => 0, 'dropped' => 1]);

        $this->assertSame(4, DB::table('drill_attempts')->where('user_id', $u->id)->count());
    }

    public function test_the_streak_counts_consecutive_days_and_survives_until_the_day_ends(): void
    {
        $u = $this->student();
        Sanctum::actingAs($u);

        // Three days in a row ending yesterday, then a gap, then an older run of two.
        $this->backdate($u, 1);
        $this->backdate($u, 2);
        $this->backdate($u, 3);
        $this->backdate($u, 6);
        $this->backdate($u, 7);

        $streak = $this->getJson('/api/me/drills')->json('streak');
        $this->assertSame(3, $streak['current'], 'not practised yet today, but yesterday keeps it alive');
        $this->assertSame(3, $streak['best']);
        $this->assertFalse($streak['active_today']);

        $this->postJson('/api/me/drills/attempts', ['attempts' => [$this->attempt()]])->assertCreated();
        $streak = $this->getJson('/api/me/drills')->json('streak');
        $this->assertSame(4, $streak['current']);
        $this->assertSame(4, $streak['best']);
        $this->assertTrue($streak['active_today']);
    }

    public function test_a_missed_day_breaks_the_streak(): void
    {
        $u = $this->student();
        Sanctum::actingAs($u);
        $this->backdate($u, 2);
        $this->backdate($u, 3);

        $streak = $this->getJson('/api/me/drills')->json('streak');

        $this->assertSame(0, $streak['current']);
        $this->assertSame(2, $streak['best']);
    }

    public function test_the_week_counts_the_last_seven_days(): void
    {
        $u = $this->student();
        Sanctum::actingAs($u);
        $this->backdate($u, 0, 2);
        $this->backdate($u, 3, 1);
        $this->backdate($u, 20, 5);

        $this->assertSame(['attempts' => 3, 'days' => 2], $this->getJson('/api/me/drills')->json('week'));
    }

    public function test_students_see_only_their_own_and_staff_have_no_access(): void
    {
        $mine = $this->student();
        $other = $this->student();
        $this->backdate($other, 0, 5);

        Sanctum::actingAs($mine);
        $this->assertSame([], $this->getJson('/api/me/drills')->json('skills'));

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO]));
        $this->getJson('/api/me/drills')->assertForbidden();
        $this->postJson('/api/me/drills/attempts', ['attempts' => [$this->attempt()]])->assertForbidden();
    }

    public function test_the_catalogue_is_well_formed(): void
    {
        $all = collect(config('drills.packs'))->flatMap(fn ($p) => $p['skills']);

        $this->assertSame($all->count(), $all->unique()->count(), 'a skill id is used once across all packs');
        $this->assertTrue($all->every(fn ($id) => preg_match('/^[a-z0-9_]{3,60}$/', $id) === 1));
    }
}
