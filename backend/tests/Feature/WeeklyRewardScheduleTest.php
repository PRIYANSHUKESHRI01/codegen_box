<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Contest;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\WeeklyRewardWinner;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesReadinessFixtures;
use Tests\TestCase;

/**
 * Weekly prizes chosen ahead of time and paid out afterwards: "next week is Burger King" is picked on Wednesday, shows to students
 * the moment Monday arrives with nothing to press, and when the week closes the winners are recorded, told, and tracked until their
 * voucher has been sent.
 *
 * "Now" is Wednesday 4 Nov 2026, noon IST — this week is Monday 2 Nov to Sunday 8 Nov.
 */
class WeeklyRewardScheduleTest extends TestCase
{
    use CreatesReadinessFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-11-04 12:00', 'Asia/Kolkata'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function ist(string $dateTime): Carbon
    {
        return Carbon::parse($dateTime, 'Asia/Kolkata')->utc();
    }

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
    }

    private function live(string $card, string $week, bool $live = true)
    {
        return $this->putJson("/api/superadmin/weekly-rewards/{$card}", ['live' => $live, 'week' => $week]);
    }

    // ------------------------------------------------------------------- scheduling ahead

    public function test_next_weeks_prize_is_chosen_now_and_starts_showing_by_itself_on_monday(): void
    {
        $student = $this->readinessStudent();
        Sanctum::actingAs($this->superadmin());

        $res = $this->live('burger_king', '2026-11-09')->assertOk()->assertJsonPath('changed', true);
        $res->assertJsonPath('week.key', '2026-11-09')->assertJsonPath('week.is_future', true)->assertJsonPath('week.is_current', false);
        $this->assertSame(['burger_king'], collect($res->json('cards'))->where('live', true)->pluck('key')->all());

        // This week still has no prize: the shelf for each week is its own.
        $this->getJson('/api/superadmin/weekly-rewards')->assertOk()->assertJsonPath('week.key', '2026-11-02');
        $this->assertSame([], collect($this->getJson('/api/superadmin/weekly-rewards')->json('cards'))->where('live', true)->all());
        $schedule = collect($this->getJson('/api/superadmin/weekly-rewards')->json('schedule'));
        $this->assertCount(5, $schedule);
        $this->assertSame([], $schedule[0]['prizes']);
        $this->assertSame('Burger King', $schedule[1]['prizes'][0]['brand']);

        Sanctum::actingAs($student);
        $now = $this->getJson('/api/weekly-rewards')->assertOk()->json();
        $this->assertFalse($now['live'], 'nothing is live this week, so no banner yet');
        $this->assertSame('Burger King', $now['next']['prizes'][0]['brand'], 'but the student is told what is coming');

        // Monday 9 Nov, 00:05 IST: it is live, with nothing pressed.
        Carbon::setTestNow(Carbon::parse('2026-11-09 00:05', 'Asia/Kolkata'));
        $monday = $this->getJson('/api/weekly-rewards')->assertOk()->json();
        $this->assertTrue($monday['live']);
        $this->assertSame([[1, 'Burger King', 499]], collect($monday['prizes'])->map(fn ($p) => [$p['rank'], $p['brand'], $p['amount']])->all());
        $this->assertNull($monday['next']);
    }

    public function test_a_week_that_is_over_or_too_far_ahead_cannot_be_changed(): void
    {
        Sanctum::actingAs($this->superadmin());

        $this->live('kfc', '2026-10-26')->assertStatus(422)->assertJsonPath('message', 'That week is over — its prizes can no longer be changed.');
        $this->live('kfc', '2026-11-02')->assertOk();
        $this->live('kfc', '2026-12-28')->assertOk();
        $this->live('kfc', '2027-01-04')->assertStatus(422);
        $this->live('kfc', 'not a date')->assertStatus(422);
    }

    public function test_any_date_in_a_week_names_that_week(): void
    {
        Sanctum::actingAs($this->superadmin());

        $this->live('zomato', '2026-11-12')->assertOk()->assertJsonPath('week.key', '2026-11-09');
        $this->getJson('/api/superadmin/weekly-rewards?week=2026-11-15')->assertJsonPath('week.key', '2026-11-09');
    }

    public function test_a_week_can_be_copied_forward(): void
    {
        Sanctum::actingAs($this->superadmin());
        $this->live('burger_king', '2026-11-02')->assertOk();
        $this->live('zomato', '2026-11-02')->assertOk();
        $this->live('kfc', '2026-11-09')->assertOk();

        $res = $this->postJson('/api/superadmin/weekly-rewards/copy', ['from' => '2026-11-02', 'to' => '2026-11-09'])->assertOk();

        $this->assertSame(2, $res->json('copied'));
        $this->assertEqualsCanonicalizing(['burger_king', 'zomato'], collect($res->json('cards'))->where('live', true)->pluck('key')->all(), 'the target week is made the same, kfc is gone');
        $this->postJson('/api/superadmin/weekly-rewards/copy', ['from' => '2026-11-09', 'to' => '2026-11-09'])->assertStatus(422);
        $this->postJson('/api/superadmin/weekly-rewards/copy', ['from' => '2026-11-09', 'to' => '2026-10-26'])->assertStatus(422);
    }

    public function test_only_a_superadmin_can_schedule_or_work_the_ledger(): void
    {
        Sanctum::actingAs($this->readinessStudent());

        $this->live('kfc', '2026-11-09')->assertForbidden();
        $this->getJson('/api/superadmin/weekly-rewards/winners')->assertForbidden();
        $this->postJson('/api/superadmin/weekly-rewards/winners/finalize')->assertForbidden();
    }

    // ------------------------------------------------------------------- closing the week

    private function weekWithWinners(): array
    {
        $college = College::create(['name' => 'Apex Institute', 'short_code' => 'APX']);
        $first = $this->readinessStudent(['name' => 'First Place', 'email' => 'first@apex.test', 'college_id' => $college->id]);
        $second = $this->readinessStudent(['name' => 'Second Place', 'email' => 'second@apex.test']);
        $third = $this->readinessStudent(['name' => 'Third Place']);
        $this->finishedContest([$first->id => 300, $second->id => 200, $third->id => 100], Contest::CONTEST_TYPE_DAILY, 300, $this->ist('2026-11-03 20:00'));

        Sanctum::actingAs($this->superadmin());
        $this->live('burger_king', '2026-11-02')->assertOk();
        $this->live('zomato', '2026-11-02')->assertOk();

        return [$first, $second, $third];
    }

    public function test_closing_the_week_records_and_tells_the_winners_once(): void
    {
        [$first, $second, $third] = $this->weekWithWinners();

        Carbon::setTestNow(Carbon::parse('2026-11-09 00:15', 'Asia/Kolkata'));
        $this->artisan('rewards:finalize-weekly')->expectsOutputToContain('Recorded 2 winner(s)')->assertSuccessful();

        $rows = WeeklyRewardWinner::orderBy('rank')->get();
        $this->assertSame([[1, 'First Place', 'Burger King', 499], [2, 'Second Place', 'Zomato', 399]], $rows->map(fn ($w) => [$w->rank, $w->user_name, $w->brand, $w->amount])->all());
        $this->assertSame('2026-11-02', $rows[0]->week_key->toDateString());
        $this->assertSame(['first@apex.test', 'Apex Institute', 300], [$rows[0]->email, $rows[0]->college, $rows[0]->contest_score]);
        $this->assertSame('pending', $rows[0]->status);

        $this->assertSame(1, UserNotification::where('user_id', $first->id)->where('type', 'reward.won')->count());
        $this->assertSame(1, UserNotification::where('user_id', $second->id)->where('type', 'reward.won')->count());
        $this->assertSame(0, UserNotification::where('user_id', $third->id)->where('type', 'reward.won')->count());
        $this->assertStringContainsString('Burger King', UserNotification::where('user_id', $first->id)->where('type', 'reward.won')->value('title'));

        // Run again, and again: nothing is added and nobody is told twice.
        $this->artisan('rewards:finalize-weekly')->expectsOutputToContain('Nothing new')->assertSuccessful();
        $this->assertSame(2, WeeklyRewardWinner::count());
        $this->assertSame(1, UserNotification::where('user_id', $first->id)->where('type', 'reward.won')->count());
    }

    public function test_a_week_that_has_not_finished_cannot_be_closed_out(): void
    {
        $this->weekWithWinners();

        $this->artisan('rewards:finalize-weekly', ['--week' => '2026-11-04'])->assertFailed();
        $this->postJson('/api/superadmin/weekly-rewards/winners/finalize', ['week' => '2026-11-04'])->assertStatus(422);
        $this->assertSame(0, WeeklyRewardWinner::count());
    }

    public function test_the_superadmin_works_the_ledger_and_the_student_sees_the_code_only_once_it_is_sent(): void
    {
        [$first] = $this->weekWithWinners();
        Carbon::setTestNow(Carbon::parse('2026-11-09 09:00', 'Asia/Kolkata'));

        // The button does what the scheduler does.
        $this->postJson('/api/superadmin/weekly-rewards/winners/finalize')->assertOk()->assertJsonPath('created', 2)->assertJsonPath('week', '2026-11-02');

        $list = $this->getJson('/api/superadmin/weekly-rewards/winners')->assertOk()->json();
        $this->assertSame(2, $list['pending']);
        $this->assertSame('First Place', $list['rows'][0]['user']['name']);
        $this->assertSame('pending', $list['rows'][0]['status']);
        $id = $list['rows'][0]['id'];

        // The student's page: the win, but no code yet.
        Sanctum::actingAs($first);
        $mine = $this->getJson('/api/weekly-rewards/mine')->assertOk()->json('wins');
        $this->assertSame([['Burger King', 499, 'pending', null]], collect($mine)->map(fn ($w) => [$w['brand'], $w['amount'], $w['status'], $w['voucher_code']])->all());

        Sanctum::actingAs($this->superadmin());
        $this->patchJson("/api/superadmin/weekly-rewards/winners/{$id}", ['voucher_code' => 'BK-1234-ABCD', 'note' => 'Sent by e-mail'])->assertOk()
            ->assertJsonPath('winner.status', 'pending')->assertJsonPath('winner.has_code', true);
        $this->assertSame(0, UserNotification::where('user_id', $first->id)->where('type', 'reward.sent')->count(), 'a code typed in is not yet "sent"');

        Sanctum::actingAs($first);
        $this->assertNull($this->getJson('/api/weekly-rewards/mine')->json('wins.0.voucher_code'));

        Sanctum::actingAs($this->superadmin());
        $this->patchJson("/api/superadmin/weekly-rewards/winners/{$id}", ['status' => 'sent'])->assertOk()
            ->assertJsonPath('winner.status', 'sent')->assertJsonPath('winner.voucher_code', 'BK-1234-ABCD');
        $this->assertNotNull(WeeklyRewardWinner::find($id)->sent_at);
        $this->assertSame('BK-1234-ABCD', WeeklyRewardWinner::find($id)->voucher_code);
        $this->assertNotSame('BK-1234-ABCD', \DB::table('weekly_reward_winners')->where('id', $id)->value('voucher_code'), 'stored encrypted');

        $told = UserNotification::where('user_id', $first->id)->where('type', 'reward.sent')->get();
        $this->assertCount(1, $told);
        $this->assertStringContainsString('Burger King', $told[0]->title);

        // Saying "sent" again tells nobody again.
        $this->patchJson("/api/superadmin/weekly-rewards/winners/{$id}", ['status' => 'sent', 'note' => 'Resent'])->assertOk();
        $this->assertSame(1, UserNotification::where('user_id', $first->id)->where('type', 'reward.sent')->count());

        Sanctum::actingAs($first);
        $this->assertSame('BK-1234-ABCD', $this->getJson('/api/weekly-rewards/mine')->json('wins.0.voucher_code'));

        // Pending count and the filter.
        Sanctum::actingAs($this->superadmin());
        $this->assertSame(1, $this->getJson('/api/superadmin/weekly-rewards/winners?status=pending')->json('pending'));
        $this->assertCount(1, $this->getJson('/api/superadmin/weekly-rewards/winners?status=sent')->json('rows'));
        $this->assertSame(1, $this->getJson('/api/superadmin/weekly-rewards')->json('pending_vouchers'));
    }

    public function test_a_cancelled_prize_is_not_shown_to_the_student_and_other_students_never_see_it(): void
    {
        [$first, $second] = $this->weekWithWinners();
        Carbon::setTestNow(Carbon::parse('2026-11-09 09:00', 'Asia/Kolkata'));
        $this->postJson('/api/superadmin/weekly-rewards/winners/finalize')->assertOk();
        $id = WeeklyRewardWinner::where('user_id', $first->id)->value('id');

        $this->patchJson("/api/superadmin/weekly-rewards/winners/{$id}", ['status' => 'cancelled'])->assertOk();

        Sanctum::actingAs($first);
        $this->assertSame([], $this->getJson('/api/weekly-rewards/mine')->json('wins'));
        Sanctum::actingAs($second);
        $this->assertSame(['Zomato'], collect($this->getJson('/api/weekly-rewards/mine')->json('wins'))->pluck('brand')->all(), 'a student only ever sees their own');
    }

    public function test_the_scheduler_closes_the_week_every_day_at_quarter_past_midnight_ist(): void
    {
        Artisan::call('schedule:list');
        $out = Artisan::output();

        // `schedule:list` prints the server's clock (UTC): 00:15 IST is 18:45 UTC the evening before.
        $this->assertMatchesRegularExpression('/45\s+18\s+\*\s+\*\s+\*\s+php artisan rewards:finalize-weekly/', $out);
        // And the next Daily Challenge is created when tonight's closes: 9 PM IST (8 PM start + 60 minutes) is 15:30 UTC.
        $this->assertMatchesRegularExpression('/30\s+15\s+\*\s+\*\s+\*\s+php artisan contests:generate-daily/', $out);
        $this->assertStringContainsString('activity:prune', $out);
        $this->assertStringContainsString('scheduler:heartbeat', $out);
    }
}
