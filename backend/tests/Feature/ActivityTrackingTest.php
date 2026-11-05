<?php

namespace Tests\Feature;

use App\Models\ActivityPageView;
use App\Models\ActivityVisit;
use App\Models\AuthEvent;
use App\Models\College;
use App\Models\User;
use App\Models\UserActivityDay;
use App\Services\Activity\AttentionService;
use App\Services\PasswordResetService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Superadmin → Live Activity: the browser's reports are kept (once, however often they arrive), "online now" and the day / week / month
 * counts are read back correctly, the sign-in log tells a demo login that was opened from one that was not, and only a superadmin can look.
 *
 * "Now" is Wednesday 4 Nov 2026, 12:00 IST (06:30 UTC).
 */
class ActivityTrackingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-11-04 12:00', 'Asia/Kolkata'));
        Cache::flush();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
    }

    private function student(College $college, array $attributes = []): User
    {
        return User::factory()->create($attributes + ['role' => User::ROLE_USER, 'college_id' => $college->id, 'must_change_password' => false]);
    }

    private function tpo(College $college, array $attributes = []): User
    {
        return User::factory()->create($attributes + ['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id, 'must_change_password' => false]);
    }

    private function college(string $name = 'Apex Institute'): College
    {
        return College::create(['name' => $name, 'short_code' => strtoupper(substr($name, 0, 4)), 'city' => 'Pune', 'is_active' => true]);
    }

    /** @param  list<array<string, mixed>>  $events */
    private function report(User $user, array $events, string $visit = 'visit-aaaa-1111'): \Illuminate\Testing\TestResponse
    {
        Sanctum::actingAs($user);

        return $this->postJson('/api/me/activity', ['visit' => $visit, 'events' => $events]);
    }

    private function page(int $seq, string $path = '/dashboard/core', int $seconds = 30, int $scroll = 40, int $age = 40, ?string $tab = null): array
    {
        return ['seq' => $seq, 'path' => $path, 'seconds' => $seconds, 'scroll' => $scroll, 'age' => $age] + ($tab ? ['tab' => $tab] : []);
    }

    // --------------------------------------------------------------- the browser's report

    public function test_a_report_is_kept_as_a_visit_with_its_pages_and_the_persons_day(): void
    {
        $college = $this->college();
        $student = $this->student($college);

        $this->report($student, [$this->page(1, '/dashboard', 20, 10, 100), $this->page(2, '/dashboard/core/practice', 45, 80, 60)])
            ->assertOk()->assertJsonPath('recorded', 2);

        $visit = ActivityVisit::firstOrFail();
        $this->assertSame($student->id, $visit->user_id);
        $this->assertSame($college->id, $visit->college_id);
        $this->assertSame('/dashboard', $visit->entry_path);
        $this->assertSame('Core Prep · Practice', $visit->current_section, 'the section is named the way the product names it');
        $this->assertSame(2, $visit->pages);
        $this->assertSame(65, $visit->active_seconds);

        $views = ActivityPageView::orderBy('seq')->get();
        $this->assertSame(['Student Overview', 'Core Prep · Practice'], $views->pluck('section')->all());
        $this->assertSame([10, 80], $views->pluck('max_scroll')->all());

        $day = UserActivityDay::firstOrFail();
        $this->assertSame('2026-11-04', $day->day->toDateString());
        $this->assertSame([1, 2, 65], [$day->visits, $day->page_views, $day->active_seconds]);
        $this->assertNotNull($student->fresh()->last_seen_at, 'the TPO\'s "last seen" follows real activity now');
    }

    public function test_the_same_report_twice_changes_nothing_and_a_later_one_only_raises_the_totals(): void
    {
        $student = $this->student($this->college());

        $this->report($student, [$this->page(1, '/dashboard/core', 30, 40)]);
        $this->report($student, [$this->page(1, '/dashboard/core', 30, 40)]);

        $this->assertSame(1, ActivityVisit::count());
        $this->assertSame(1, ActivityPageView::count());
        $this->assertSame(30, ActivityVisit::first()->active_seconds);

        // A minute later the browser reports the same page with its running totals — and a lower number never lowers anything.
        $this->report($student, [$this->page(1, '/dashboard/core', 90, 75)]);
        $this->report($student, [$this->page(1, '/dashboard/core', 50, 10)]);

        $view = ActivityPageView::first();
        $this->assertSame([90, 75], [$view->active_seconds, $view->max_scroll]);
        $this->assertSame(90, ActivityVisit::first()->active_seconds);
        $this->assertSame(1, UserActivityDay::first()->visits, 'one visit however many reports');
        $this->assertSame(1, UserActivityDay::count());
    }

    public function test_a_new_visit_token_is_a_new_visit_and_adds_to_the_same_day(): void
    {
        $student = $this->student($this->college());

        $this->report($student, [$this->page(1)], 'visit-morning-0001');
        $this->report($student, [$this->page(1, '/dashboard/contests')], 'visit-evening-0002');

        $this->assertSame(2, ActivityVisit::count());
        $this->assertSame(2, UserActivityDay::first()->visits);
    }

    public function test_the_pages_own_tab_is_part_of_the_section(): void
    {
        $tpo = $this->tpo($this->college());

        $this->report($tpo, [$this->page(1, '/admin/placements', 30, 20, 30, 'drives')])->assertOk();

        $this->assertSame('Placements › Drives', ActivityPageView::first()->section);
        $this->assertSame('/admin/placements?tab=drives', ActivityPageView::first()->path);
    }

    public function test_a_superadmin_and_a_view_as_session_are_never_recorded(): void
    {
        $this->report($this->superadmin(), [$this->page(1)])->assertOk()->assertJsonPath('recorded', 0);
        $this->assertSame(0, ActivityVisit::count());

        config(['activity.enabled' => false]);
        $this->report($this->student($this->college()), [$this->page(1)])->assertOk()->assertJsonPath('recorded', 0);
        $this->assertSame(0, ActivityVisit::count());
    }

    public function test_a_malformed_report_is_refused(): void
    {
        $student = $this->student($this->college());

        $this->report($student, [['seq' => 1, 'path' => '/dashboard?token=abc']])->assertStatus(422);
        $this->report($student, [['seq' => 1, 'path' => 'dashboard']])->assertStatus(422);
        $this->report($student, [$this->page(1, '/dashboard', 30, 140)])->assertStatus(422);
        $this->report($student, [])->assertStatus(422);
        $this->assertSame(0, ActivityVisit::count());
    }

    // ------------------------------------------------------------------- the live numbers

    public function test_online_now_is_a_visit_heard_from_recently_and_the_counts_follow(): void
    {
        $college = $this->college();
        $here = $this->student($college, ['name' => 'Here Now']);
        $gone = $this->student($college, ['name' => 'Left Earlier']);
        $tpo = $this->tpo($college);

        $this->report($gone, [$this->page(1)], 'visit-gone-00001');
        Carbon::setTestNow(Carbon::now()->addMinutes(10));
        $this->report($here, [$this->page(1, '/dashboard/contests')], 'visit-here-00001');
        $this->report($tpo, [$this->page(1, '/admin')], 'visit-tpo-000001');

        Sanctum::actingAs($this->superadmin());
        $live = $this->getJson('/api/superadmin/activity/live')->assertOk()->json();

        $this->assertSame(2, $live['pulse']['online']['total'], 'the one who left ten minutes ago is not online');
        $this->assertEquals(['user' => 1, 'admin_tpo' => 1], $live['pulse']['online']['by_role']);
        $this->assertSame(3, $live['pulse']['active']['today']);
        $this->assertSame(3, $live['pulse']['active']['last_7_days']);
        $this->assertSame(3, $live['pulse']['active']['last_30_days']);
        $this->assertContains('Contests', collect($live['pulse']['sections_now'])->pluck('section')->all());
        $this->assertSame(['Apex Institute'], collect($live['pulse']['colleges_now'])->pluck('name')->all());
        $this->assertEqualsCanonicalizing(['Here Now', $tpo->name], collect($live['online']['rows'])->pluck('name')->all());
        $this->assertCount(30, $live['daily']);
        $this->assertSame(3, collect($live['daily'])->last()['users']);
        $this->assertCount(24, $live['hourly']);

        $students = $this->getJson('/api/superadmin/activity/pulse?role=user')->assertOk()->json();
        $this->assertSame(1, $students['pulse']['online']['total']);
        $this->assertSame(2, $students['pulse']['active']['today']);
    }

    public function test_last_week_counts_in_the_weekly_figure_but_not_in_today(): void
    {
        $student = $this->student($this->college());
        UserActivityDay::create([
            'user_id' => $student->id, 'college_id' => $student->college_id, 'role' => 'user', 'day' => '2026-11-01',
            'visits' => 1, 'page_views' => 3, 'active_seconds' => 120, 'first_seen_at' => now()->subDays(3), 'last_seen_at' => now()->subDays(3),
        ]);

        Sanctum::actingAs($this->superadmin());
        $pulse = $this->getJson('/api/superadmin/activity/pulse')->json('pulse');

        $this->assertSame(0, $pulse['active']['today']);
        $this->assertSame(1, $pulse['active']['last_7_days']);
        $this->assertSame(0, $pulse['active']['this_week'], 'Monday 2 Nov: the 1st was last week');
        $this->assertSame(1, $pulse['active']['last_30_days']);
    }

    public function test_only_a_superadmin_can_look(): void
    {
        $college = $this->college();
        Sanctum::actingAs($this->tpo($college));
        $this->getJson('/api/superadmin/activity/live')->assertForbidden();
        $this->getJson('/api/superadmin/activity/colleges')->assertForbidden();
        $this->getJson('/api/superadmin/attention')->assertForbidden();

        Sanctum::actingAs($this->student($college));
        $this->getJson('/api/superadmin/activity/sign-ins')->assertForbidden();
    }

    // -------------------------------------------------------------------------- the sign-in log

    public function test_the_sign_in_log_keeps_failed_attempts_and_the_one_time_password_step(): void
    {
        $college = $this->college();
        $demo = $this->tpo($college, ['email' => 'tpo@apex.test', 'must_change_password' => true, 'password' => Hash::make('Temp-Pass-1')]);

        $this->postJson('/api/login', ['email' => 'nobody@apex.test', 'password' => 'x'])->assertStatus(422);
        $this->postJson('/api/login', ['email' => 'tpo@apex.test', 'password' => 'wrong-one'])->assertStatus(422);
        $this->postJson('/api/login', ['email' => 'tpo@apex.test', 'password' => 'Temp-Pass-1'])->assertOk()->assertJsonPath('must_change_password', true);

        $events = AuthEvent::orderBy('id')->get();
        $this->assertSame(['login_failed', 'login_failed', 'temp_password'], $events->pluck('event')->all());
        $this->assertSame(['unknown_email', 'bad_password', null], $events->pluck('reason')->all());
        $this->assertNull($events[0]->user_id);
        $this->assertSame($demo->id, $events[1]->user_id);
        $this->assertSame($college->id, $events[2]->college_id);
        $this->assertSame(0, \App\Models\PasswordResetOtp::count(), 'trying the login does not by itself send a code');
    }

    public function test_choosing_a_first_password_and_signing_in_are_logged_as_such(): void
    {
        $college = $this->college();
        $demo = $this->tpo($college, ['email' => 'tpo@apex.test', 'must_change_password' => true]);

        app(PasswordResetService::class)->requestOtp($demo);
        $this->assertSame(1, AuthEvent::where('event', 'otp_requested')->count());

        // What PasswordResetService::resetPassword does once the code was verified.
        $otp = \App\Models\PasswordResetOtp::where('user_id', $demo->id)->firstOrFail();
        $otp->forceFill(['reset_token_hash' => Hash::make('raw-token')])->save();
        app(PasswordResetService::class)->resetPassword($demo, 'raw-token', 'My-Own-Password-9');

        $this->assertSame('password_set', AuthEvent::orderByDesc('id')->first()->event);

        $this->postJson('/api/login', ['email' => 'tpo@apex.test', 'password' => 'My-Own-Password-9'])->assertOk()->assertJsonStructure(['token']);
        $this->assertSame('login', AuthEvent::orderByDesc('id')->first()->event);
    }

    public function test_the_sign_in_log_can_be_read_and_filtered(): void
    {
        $college = $this->college();
        $this->tpo($college, ['email' => 'tpo@apex.test']);
        $this->postJson('/api/login', ['email' => 'tpo@apex.test', 'password' => 'password'])->assertOk();
        $this->postJson('/api/login', ['email' => 'tpo@apex.test', 'password' => 'nope'])->assertStatus(422);

        Sanctum::actingAs($this->superadmin());
        $all = $this->getJson('/api/superadmin/activity/sign-ins')->assertOk()->json();
        $this->assertSame(2, $all['total']);

        $failed = $this->getJson('/api/superadmin/activity/sign-ins?event=login_failed')->json();
        $this->assertSame(1, $failed['total']);
        $this->assertSame('bad_password', $failed['rows'][0]['reason']);
        $this->assertSame('Apex Institute', $failed['rows'][0]['college']);
    }

    // ------------------------------------------------------------------- colleges and people

    public function test_the_directory_tells_an_unopened_demo_login_from_an_active_college(): void
    {
        $unopened = $this->college('Quiet Demo College');
        $tried = $this->college('Halfway College');
        $active = $this->college('Busy College');
        $dormant = $this->college('Gone Quiet College');
        $this->tpo($unopened, ['must_change_password' => true, 'created_at' => now()->subDays(6)]);
        $half = $this->tpo($tried, ['must_change_password' => true, 'created_at' => now()->subDays(5)]);
        $busy = $this->tpo($active);
        $old = $this->tpo($dormant, ['last_seen_at' => now()->subDays(20)]);

        AuthEvent::create(['user_id' => $half->id, 'college_id' => $tried->id, 'role' => $half->role, 'email' => $half->email, 'event' => 'temp_password', 'created_at' => now()->subDays(4)]);
        $this->report($busy, [$this->page(1, '/admin')]);
        $this->student($active);

        Sanctum::actingAs($this->superadmin());
        $directory = $this->getJson('/api/superadmin/activity/colleges')->assertOk()->json();

        $status = collect($directory['rows'])->pluck('status', 'name')->all();
        $this->assertSame('not_opened', $status['Quiet Demo College']);
        $this->assertSame('tried', $status['Halfway College']);
        $this->assertSame('active', $status['Busy College']);
        $this->assertSame('dormant', $status['Gone Quiet College']);
        $this->assertSame(['not_opened', 'tried', 'dormant', 'active'], collect($directory['rows'])->pluck('status')->all(), 'colleges that need a call come first');
        $this->assertSame(1, $directory['counts']['not_opened']);

        $busyRow = collect($directory['rows'])->firstWhere('name', 'Busy College');
        $this->assertSame(1, $busyRow['online_now']);
        $this->assertSame(1, $busyRow['students']['total']);

        $only = $this->getJson('/api/superadmin/activity/colleges?status=tried')->json();
        $this->assertSame(['Halfway College'], collect($only['rows'])->pluck('name')->all());
        $this->assertSame(['Busy College'], collect($this->getJson('/api/superadmin/activity/colleges?q=busy')->json('rows'))->pluck('name')->all());
    }

    public function test_one_college_in_full(): void
    {
        $college = $this->college();
        $tpo = $this->tpo($college, ['name' => 'Dr. Rao', 'must_change_password' => true, 'created_at' => now()->subDays(2)]);
        AuthEvent::create(['user_id' => $tpo->id, 'college_id' => $college->id, 'role' => $tpo->role, 'email' => $tpo->email, 'event' => 'temp_password', 'created_at' => now()->subDay()]);
        AuthEvent::create(['user_id' => $tpo->id, 'college_id' => $college->id, 'role' => $tpo->role, 'email' => $tpo->email, 'event' => 'password_set', 'created_at' => now()->subHours(20)]);
        $tpo->forceFill(['must_change_password' => false])->save();
        $this->report($tpo, [$this->page(1, '/admin/students', 80, 90), $this->page(2, '/admin/drives', 40, 30)]);
        $student = $this->student($college, ['name' => 'Asha']);
        $this->report($student, [$this->page(1, '/dashboard/core', 120, 60)], 'visit-student-001');
        $this->student($college, ['must_change_password' => true]);

        Sanctum::actingAs($this->superadmin());
        $detail = $this->getJson("/api/superadmin/activity/colleges/{$college->id}")->assertOk()->json();

        $this->assertSame('active', $detail['status']);
        $account = $detail['accounts'][0];
        $this->assertSame('Dr. Rao', $account['user']['name']);
        $this->assertNotNull($account['first_tried_at']);
        $this->assertNotNull($account['password_set_at']);
        $this->assertNotNull($account['first_signin_at']);
        $this->assertSame(2, $account['page_views']);
        $this->assertSame(120, $account['active_seconds']);

        $this->assertSame(['total' => 2, 'activated' => 1, 'ever_seen' => 1, 'active_7d' => 1], $detail['students']);
        $this->assertSame('Core Prep', collect($detail['sections'])->firstWhere('section', 'Core Prep')['section']);
        $this->assertSame(90, collect($detail['sections'])->firstWhere('section', 'Students')['avg_scroll']);
        $this->assertSame(2, collect($detail['daily'])->last()['users']);
        $this->assertNotEmpty($detail['recent']);

        $onlyStudents = $this->getJson("/api/superadmin/activity/colleges/{$college->id}?role=user")->json();
        $this->assertSame(['Core Prep'], collect($onlyStudents['sections'])->pluck('section')->all());

        $people = $this->getJson("/api/superadmin/activity/colleges/{$college->id}/people")->assertOk()->json();
        $this->assertSame(3, $people['total']);
        $this->assertSame('admin_tpo', $people['rows'][0]['user']['role'], 'staff first');
    }

    public function test_one_person_with_every_visit_and_page(): void
    {
        $college = $this->college();
        $student = $this->student($college, ['name' => 'Asha']);
        $this->report($student, [$this->page(1, '/dashboard', 20, 10), $this->page(2, '/dashboard/core', 60, 95)]);

        Sanctum::actingAs($this->superadmin());
        $person = $this->getJson("/api/superadmin/activity/users/{$student->id}")->assertOk()->json();

        $this->assertSame('Asha', $person['user']['name']);
        $this->assertSame('Apex Institute', $person['user']['college']);
        $this->assertTrue($person['online_now']);
        $this->assertCount(1, $person['visits']);
        $this->assertSame(['Student Overview', 'Core Prep'], collect($person['visits'][0]['views'])->pluck('section')->all());
        $this->assertSame([10, 95], collect($person['visits'][0]['views'])->pluck('scroll')->all());
        $this->assertEqualsCanonicalizing(['Student Overview', 'Core Prep'], collect($person['sections'])->pluck('section')->all());

        $this->getJson("/api/superadmin/activity/users/{$this->superadmin()->id}")->assertNotFound();
    }

    // -------------------------------------------------------------------- attention and upkeep

    public function test_the_attention_list_names_what_needs_the_superadmin(): void
    {
        $college = $this->college('Silent College');
        $this->tpo($college, ['must_change_password' => true, 'created_at' => now()->subDays(9)]);

        Sanctum::actingAs($this->superadmin());
        $items = collect($this->getJson('/api/superadmin/attention')->assertOk()->json('items'))->keyBy('key');

        $this->assertSame(1, $items['logins_unused']['count']);
        $this->assertSame('Silent College', $items['logins_unused']['examples'][0]['label']);
        $this->assertSame('scheduler_stopped', $items['scheduler_stopped']['key'], 'no heartbeat yet: the scheduler has not ticked');
        $this->assertSame('critical', $items['scheduler_stopped']['severity']);
        $this->assertSame('daily_missing', $items['daily_missing']['key'], 'no Daily Challenge exists in this test database');

        Cache::put(AttentionService::HEARTBEAT_KEY, now()->toIso8601String());
        $again = collect($this->getJson('/api/superadmin/attention')->json('items'))->pluck('key')->all();
        $this->assertNotContains('scheduler_stopped', $again);
    }

    public function test_old_activity_is_pruned_and_recent_activity_kept(): void
    {
        $student = $this->student($this->college());
        $this->report($student, [$this->page(1)]);
        ActivityPageView::query()->update(['entered_at' => now()->subDays(120)]);

        Artisan::call('activity:prune');

        $this->assertSame(0, ActivityPageView::count(), 'page views past 90 days go');
        $this->assertSame(1, ActivityVisit::count(), 'the visit itself is kept longer');
        $this->assertSame(1, UserActivityDay::count());
    }

    public function test_deleting_a_student_removes_their_sign_in_log(): void
    {
        $student = $this->student($this->college(), ['email' => 'gone@apex.test']);
        $this->postJson('/api/login', ['email' => 'gone@apex.test', 'password' => 'password'])->assertOk();
        $this->report($student, [$this->page(1)]);
        $this->assertSame(1, AuthEvent::count());

        app(\App\Services\UserPurgeService::class)->purge($student);

        $this->assertSame(0, AuthEvent::count());
        $this->assertSame(0, ActivityVisit::count());
        $this->assertSame(0, UserActivityDay::count());
    }
}
