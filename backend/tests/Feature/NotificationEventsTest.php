<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Company;
use App\Models\Contest;
use App\Models\DriveApplication;
use App\Models\DriveCollegeMapping;
use App\Models\Hackathon;
use App\Models\HackathonAnnouncement;
use App\Models\HackathonParticipant;
use App\Models\HackathonTeam;
use App\Models\PlacementDrive;
use App\Models\StudentImport;
use App\Models\Subscription;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\VaultInquiry;
use App\Models\VaultProfile;
use App\Services\DrivePipelineService;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\TestCase;

/**
 * "Something happened — the right people hear about it." Each test makes the event happen the way the product does
 * (a TPO's click, a model change, a service call) and then checks exactly who found a notification in their bell:
 * the people it is for, and nobody else.
 */
class NotificationEventsTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
    }

    private function college(string $code = 'APX'): College
    {
        return College::create(['name' => "College {$code}", 'short_code' => $code, 'tier' => 'Standard']);
    }

    private function studentAt(College $college, array $attributes = []): User
    {
        return User::factory()->create(array_merge(['role' => User::ROLE_USER, 'college_id' => $college->id], $attributes));
    }

    private function tpoAt(College $college): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
    }

    private function drive(array $attributes = []): PlacementDrive
    {
        $company = Company::create(['name' => 'Nimbus Co', 'slug' => 'nimbus-'.uniqid()]);

        return PlacementDrive::create(array_merge([
            'company_id' => $company->id,
            'title' => 'SDE Drive',
            'role_title' => 'Software Engineer',
            'drive_date' => now()->addWeek(),
            'status' => PlacementDrive::STATUS_PUBLISHED,
        ], $attributes));
    }

    /** @return list<string> */
    private function titlesFor(User $user, ?string $type = null): array
    {
        return UserNotification::where('user_id', $user->id)
            ->when($type, fn ($q) => $q->where('type', $type))
            ->orderBy('id')
            ->pluck('title')
            ->all();
    }

    /** Observers raise their fan-out after the response; in a test with no request, that moment is now. */
    private function afterResponse(): void
    {
        $this->app->terminate();
    }

    // ───────────────────────────── drives ─────────────────────────────

    public function test_a_drive_going_live_tells_the_students_it_is_open_to_and_nobody_else(): void
    {
        $college = $this->college();
        $other = $this->college('OTH');
        $eligible = $this->studentAt($college, ['cgpa' => 8.2, 'backlogs' => 0]);
        $unknown = $this->studentAt($college, ['cgpa' => null]);
        $notEligible = $this->studentAt($college, ['cgpa' => 5.1]);
        $blocked = $this->studentAt($college, ['cgpa' => 9.0, 'is_blocked' => true]);
        $elsewhere = $this->studentAt($other, ['cgpa' => 9.0]);
        $drive = $this->drive(['min_cgpa' => 7.0]);

        DriveCollegeMapping::create([
            'placement_drive_id' => $drive->id, 'college_id' => $college->id, 'status' => DriveCollegeMapping::STATUS_APPROVED, 'is_active' => true, 'mapped_at' => now(),
        ]);
        $this->afterResponse();

        $this->assertSame(['New drive: Nimbus Co — Software Engineer'], $this->titlesFor($eligible, 'drive.live'));
        $this->assertStringContainsString("You're eligible", UserNotification::where('user_id', $eligible->id)->value('body'));
        $this->assertStringContainsString('Check whether you meet', UserNotification::where('user_id', $unknown->id)->value('body'));
        $this->assertSame([], $this->titlesFor($notEligible), 'someone who definitely cannot apply is not told about it');
        $this->assertSame([], $this->titlesFor($blocked));
        $this->assertSame([], $this->titlesFor($elsewhere), 'another college is never told');
        $this->assertSame('/dashboard/drives', UserNotification::where('user_id', $eligible->id)->value('url'));
    }

    public function test_a_tpo_scheduling_their_own_drive_notifies_their_students_through_the_real_endpoint(): void
    {
        $college = $this->college();
        $tpo = $this->tpoAt($college);
        $student = $this->studentAt($college, ['cgpa' => 8.0]);
        $other = $this->studentAt($this->college('OTH'));

        Sanctum::actingAs($tpo);
        $this->postJson('/api/tpo/drives', [
            'company_name' => 'Acme Corp',
            'title' => 'Campus Hiring 2026',
            'role_title' => 'Graduate Engineer',
            'drive_date' => now()->addDays(10)->toDateString(),
        ])->assertCreated();

        $this->assertSame(['New drive: Acme Corp — Graduate Engineer'], $this->titlesFor($student));
        $this->assertSame([], $this->titlesFor($other));
        $this->assertSame([], $this->titlesFor($tpo), 'the TPO who did it is not told about their own action');
    }

    public function test_a_proposal_reaches_the_colleges_tpos_and_the_answer_reaches_the_proposer_and_opens_the_drive(): void
    {
        $college = $this->college();
        $tpo = $this->tpoAt($college);
        $student = $this->studentAt($college, ['cgpa' => 8.0]);
        $ops = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]);
        $drive = $this->drive();

        DriveCollegeMapping::create([
            'placement_drive_id' => $drive->id, 'college_id' => $college->id, 'status' => DriveCollegeMapping::STATUS_PENDING, 'is_active' => false,
            'mapped_by' => $ops->id, 'mapped_at' => now(),
        ]);

        $this->assertSame(['Mellow proposed a drive to your college'], $this->titlesFor($tpo, 'drive.proposal'));
        $this->assertSame([], $this->titlesFor($student), 'students are not told about a drive their TPO has not approved');

        Sanctum::actingAs($tpo);
        $this->postJson("/api/tpo/drives/{$drive->id}/respond", ['decision' => 'approve'])->assertOk();

        $this->assertSame(["{$college->name} approved your drive"], $this->titlesFor($ops, 'drive.proposal_response'));
        $this->assertCount(1, $this->titlesFor($student, 'drive.live'), 'approving makes it live for the students');
    }

    public function test_a_declined_proposal_tells_the_proposer_and_not_the_students(): void
    {
        $college = $this->college();
        $tpo = $this->tpoAt($college);
        $student = $this->studentAt($college);
        $ops = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]);
        $drive = $this->drive();
        DriveCollegeMapping::create(['placement_drive_id' => $drive->id, 'college_id' => $college->id, 'status' => DriveCollegeMapping::STATUS_PENDING, 'is_active' => false, 'mapped_by' => $ops->id, 'mapped_at' => now()]);

        Sanctum::actingAs($tpo);
        $this->postJson("/api/tpo/drives/{$drive->id}/respond", ['decision' => 'decline'])->assertOk();

        $this->assertSame(["{$college->name} declined your drive"], $this->titlesFor($ops, 'drive.proposal_response'));
        $this->assertSame([], $this->titlesFor($student));
    }

    public function test_closing_a_drive_or_moving_its_date_tells_the_students_who_had_it(): void
    {
        $college = $this->college();
        $student = $this->studentAt($college, ['cgpa' => 8.0]);
        $drive = $this->drive();
        DriveCollegeMapping::create(['placement_drive_id' => $drive->id, 'college_id' => $college->id, 'status' => DriveCollegeMapping::STATUS_APPROVED, 'is_active' => true, 'mapped_at' => now()]);
        $this->afterResponse();

        $drive->update(['drive_date' => now()->addDays(20)]);
        $this->afterResponse();
        $this->assertCount(1, $this->titlesFor($student, 'drive.stage'));
        $this->assertStringContainsString('is now on', UserNotification::where('user_id', $student->id)->where('type', 'drive.stage')->value('body'));

        $drive->update(['status' => PlacementDrive::STATUS_CANCELLED]);
        $this->afterResponse();
        $this->assertSame(['Drive closed: Nimbus Co'], $this->titlesFor($student, 'drive.unmapped'));
    }

    public function test_a_student_hears_when_their_application_moves_to_a_new_round_or_gets_an_offer(): void
    {
        $college = $this->college();
        $tpo = $this->tpoAt($college);
        $student = $this->studentAt($college);
        $drive = $this->drive();
        $application = DriveApplication::create([
            'placement_drive_id' => $drive->id, 'user_id' => $student->id, 'college_id' => $college->id, 'stage' => DriveApplication::STAGE_REGISTERED, 'stage_updated_at' => now(),
        ]);
        $pipeline = app(DrivePipelineService::class);

        $pipeline->transition($application, DriveApplication::STAGE_TECHNICAL_INTERVIEW, [], $tpo);
        $pipeline->transition($application->fresh(), DriveApplication::STAGE_OFFER_EXTENDED, ['ctc_offered' => 12], $tpo);

        $titles = $this->titlesFor($student, 'drive.stage');
        $this->assertSame(["You're through to the next round at Nimbus Co", 'You have an offer from Nimbus Co'], $titles);
        $this->assertSame('success', UserNotification::where('user_id', $student->id)->orderByDesc('id')->value('severity'));
    }

    public function test_registering_all_eligible_students_tells_exactly_those_who_were_registered(): void
    {
        $college = $this->college();
        $tpo = $this->tpoAt($college);
        $in = $this->studentAt($college, ['cgpa' => 8.5, 'backlogs' => 0]);
        $out = $this->studentAt($college, ['cgpa' => 4.0, 'backlogs' => 0]);
        $drive = $this->drive(['min_cgpa' => 7.0]);
        DriveCollegeMapping::create(['placement_drive_id' => $drive->id, 'college_id' => $college->id, 'status' => DriveCollegeMapping::STATUS_APPROVED, 'is_active' => true, 'mapped_at' => now()]);

        app(DrivePipelineService::class)->registerEligible($drive, $tpo);

        $this->assertSame(["You're registered for the Nimbus Co drive"], $this->titlesFor($in, 'drive.registered'));
        $this->assertSame([], $this->titlesFor($out, 'drive.registered'));
    }

    // ───────────────────────────── hackathons ─────────────────────────────

    private function hackathon(array $attributes = []): Hackathon
    {
        return Hackathon::create(array_merge([
            'slug' => 'hack-'.uniqid(),
            'title' => 'Campus Connect Hack',
            'tagline' => 'Build something in a weekend.',
            'description' => str_repeat('A long enough description for a real hackathon. ', 3),
            'accent' => 'indigo',
            'themes' => ['AI', 'Web'],
            'min_team_size' => 1,
            'max_team_size' => 4,
            'prize_pool_amount' => 100000,
            'currency' => 'INR',
            'prizes' => [['place' => 1, 'title' => 'Champion', 'reward' => '₹50,000', 'perks' => []]],
            'host_type' => Hackathon::HOST_PLATFORM,
            'audience' => Hackathon::AUDIENCE_ALL,
            'mode' => Hackathon::MODE_ONLINE,
            'status' => Hackathon::STATUS_DRAFT,
            'registration_opens_at' => now()->subDay(),
            'registration_closes_at' => now()->addDays(5),
            'starts_at' => now()->addDays(6),
            'ends_at' => now()->addDays(8),
        ], $attributes));
    }

    public function test_publishing_a_hackathon_open_to_all_tells_every_student_but_not_staff(): void
    {
        $a = $this->studentAt($this->college('AAA'));
        $b = $this->studentAt($this->college('BBB'));
        $tpo = $this->tpoAt($this->college('CCC'));
        $hackathon = $this->hackathon();

        $this->assertSame([], $this->titlesFor($a), 'a draft says nothing');

        $hackathon->update(['status' => Hackathon::STATUS_PUBLISHED, 'published_at' => now()]);
        $this->afterResponse();

        $this->assertSame(['New hackathon: Campus Connect Hack'], $this->titlesFor($a));
        $this->assertSame(['New hackathon: Campus Connect Hack'], $this->titlesFor($b));
        $this->assertSame([], $this->titlesFor($tpo));
        $this->assertStringContainsString('/arena/hackathon?slug='.$hackathon->slug, UserNotification::where('user_id', $a->id)->value('url'));
    }

    public function test_a_hackathon_for_chosen_colleges_only_reaches_those_colleges(): void
    {
        $in = $this->college('IN');
        $out = $this->college('OUT');
        $inside = $this->studentAt($in);
        $outside = $this->studentAt($out);
        $hackathon = $this->hackathon(['audience' => Hackathon::AUDIENCE_COLLEGES]);
        $hackathon->colleges()->attach($in->id);

        $hackathon->update(['status' => Hackathon::STATUS_PUBLISHED]);
        $this->afterResponse();

        $this->assertCount(1, $this->titlesFor($inside));
        $this->assertSame([], $this->titlesFor($outside));
    }

    public function test_announcements_cancellation_and_results_go_to_the_students_who_registered(): void
    {
        $college = $this->college();
        $joined = $this->studentAt($college);
        $notJoined = $this->studentAt($college);
        $hackathon = $this->hackathon(['status' => Hackathon::STATUS_PUBLISHED]);
        $this->afterResponse();
        UserNotification::query()->delete();
        $team = HackathonTeam::create(['hackathon_id' => $hackathon->id, 'name' => 'Team One', 'invite_code' => HackathonTeam::generateInviteCode($hackathon->id), 'leader_id' => $joined->id]);
        HackathonParticipant::create(['hackathon_id' => $hackathon->id, 'user_id' => $joined->id, 'hackathon_team_id' => $team->id, 'role' => HackathonParticipant::ROLE_LEADER, 'registered_at' => now()]);

        HackathonAnnouncement::create(['hackathon_id' => $hackathon->id, 'author_id' => null, 'title' => 'Kickoff moved', 'body' => 'Now at 10am.']);
        $this->assertSame(['Campus Connect Hack: Kickoff moved'], $this->titlesFor($joined, 'hackathon.announcement'));
        $this->assertSame([], $this->titlesFor($notJoined));

        $hackathon->update(['status' => Hackathon::STATUS_CANCELLED, 'cancelled_at' => now(), 'cancelled_reason' => 'Venue unavailable']);
        $this->assertSame(['Hackathon cancelled: Campus Connect Hack'], $this->titlesFor($joined, 'hackathon.cancelled'));
        $this->assertStringContainsString('Venue unavailable', UserNotification::where('type', 'hackathon.cancelled')->value('body'));
    }

    // ───────────────────────────── tests, contests, interviews ─────────────────────────────

    public function test_a_tpos_mock_contest_reaches_their_students_when_it_is_published_not_while_it_is_a_draft(): void
    {
        $college = $this->college();
        $student = $this->studentAt($college);
        $other = $this->studentAt($this->college('OTH'));

        $contest = Contest::create([
            'slug' => 'mock-'.uniqid(), 'title' => 'Mock Round 1', 'contest_type' => Contest::CONTEST_TYPE_TPO_MOCK, 'owning_college_id' => $college->id,
            'status' => Contest::STATUS_DRAFT, 'start_at' => now()->addDay(), 'end_at' => now()->addDays(2), 'is_rated' => false,
        ]);
        $this->assertSame([], $this->titlesFor($student));

        $contest->update(['status' => Contest::STATUS_PUBLISHED]);

        $this->assertSame(['New mock contest: Mock Round 1'], $this->titlesFor($student));
        $this->assertSame([], $this->titlesFor($other));
        $this->assertSame('/dashboard/contests', UserNotification::where('user_id', $student->id)->value('url'));

        // Editing it afterwards does not announce it again.
        $contest->update(['title' => 'Mock Round 1 (revised)']);
        $this->assertCount(1, $this->titlesFor($student));
    }

    public function test_a_platform_contest_reaches_every_student_but_a_daily_practice_one_stays_quiet(): void
    {
        $student = $this->studentAt($this->college());

        Contest::create(['slug' => 'weekly-'.uniqid(), 'title' => 'Weekly Rated', 'contest_type' => Contest::CONTEST_TYPE_GENERAL, 'status' => Contest::STATUS_PUBLISHED, 'start_at' => now()->addDay(), 'end_at' => now()->addDays(2), 'is_rated' => true]);
        Contest::create(['slug' => 'daily-'.uniqid(), 'title' => 'Daily', 'contest_type' => Contest::CONTEST_TYPE_DAILY, 'status' => Contest::STATUS_PUBLISHED, 'start_at' => now()->addDay(), 'end_at' => now()->addDays(2), 'is_rated' => false]);
        $this->afterResponse();

        $this->assertSame(['New contest: Weekly Rated'], $this->titlesFor($student));
    }

    // ───────────────────────────── plans and payments ─────────────────────────────

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN, 'password' => Hash::make('correct-horse-battery')]);
    }

    public function test_a_plan_given_by_a_superadmin_shows_up_in_the_students_bell_at_once(): void
    {
        $student = $this->student();

        Sanctum::actingAs($this->superadmin());
        $this->postJson("/api/superadmin/users/{$student->id}/subscription", ['plan_code' => 'grandmaster', 'days' => 90, 'kind' => 'complimentary', 'reason' => 'Scholarship — placement drive prep'])->assertCreated();

        $this->assertSame(["You're on the Grandmaster plan"], $this->titlesFor($student, 'plan.changed'));
        $row = UserNotification::where('user_id', $student->id)->first();
        $this->assertSame('success', $row->severity);
        $this->assertSame('/dashboard/billing', $row->url);
    }

    public function test_extending_and_ending_a_students_plan_tells_them(): void
    {
        $student = $this->student();
        $admin = $this->superadmin();
        Sanctum::actingAs($admin);
        $created = $this->postJson("/api/superadmin/users/{$student->id}/subscription", ['plan_code' => 'grandmaster', 'days' => 30, 'kind' => 'complimentary', 'reason' => 'Scholarship — placement drive prep'])->assertCreated();
        $id = $created->json('subscription.id');

        $this->postJson("/api/superadmin/subscriptions/{$id}/extend", ['days' => 15, 'reason' => 'Contest outage compensation'])->assertOk();
        $this->postJson("/api/superadmin/subscriptions/{$id}/cancel", ['reason' => 'Granted to the wrong account'])->assertOk();

        $titles = $this->titlesFor($student, 'plan.changed');
        $this->assertContains('Your Grandmaster plan was extended', $titles);
        $this->assertContains('Your Grandmaster plan has ended', $titles);
    }

    public function test_a_colleges_plan_changes_tell_its_tpos_and_ending_it_also_tells_its_students(): void
    {
        $college = $this->college();
        $tpo = $this->tpoAt($college);
        $student = $this->studentAt($college);
        $service = app(SubscriptionService::class);
        $plan = \App\Models\Plan::where('audience', \App\Models\Plan::AUDIENCE_INSTITUTION)->first()
            ?? \App\Models\Plan::create(['code' => 'inst-x', 'name' => 'Standard', 'audience' => \App\Models\Plan::AUDIENCE_INSTITUTION, 'kind' => \App\Models\Plan::KIND_BASE, 'annual_price' => 100000, 'duration_days' => 365, 'is_active' => true, 'sort_order' => 1, 'drive_access' => true, 'max_students' => 500]);
        $admin = $this->superadmin();

        $subscription = $service->assignInstitutionPlan($college, $plan, $admin);
        $this->assertSame(["Your plan is now {$plan->name}"], $this->titlesFor($tpo, 'plan.changed'));
        $this->assertSame([], $this->titlesFor($student), 'students are not told about a new plan');

        $service->cancel($subscription, $admin, 'Contract ended');
        $this->afterResponse();

        $this->assertContains("Your college's {$plan->name} plan has ended", $this->titlesFor($tpo, 'plan.changed'));
        $this->assertSame(["Your college's plan has ended"], $this->titlesFor($student, 'plan.changed'));
    }

    public function test_an_expired_college_plan_is_announced_by_the_daily_sweep(): void
    {
        $college = $this->college();
        $tpo = $this->tpoAt($college);
        $plan = \App\Models\Plan::create(['code' => 'inst-y', 'name' => 'Pro Campus', 'audience' => \App\Models\Plan::AUDIENCE_INSTITUTION, 'kind' => \App\Models\Plan::KIND_BASE, 'annual_price' => 100000, 'duration_days' => 365, 'is_active' => true, 'sort_order' => 2, 'drive_access' => true, 'max_students' => 500]);
        Subscription::create(['subscriber_type' => College::class, 'subscriber_id' => $college->id, 'plan_id' => $plan->id, 'status' => Subscription::STATUS_ACTIVE, 'started_at' => now()->subYear(), 'current_period_end' => now()->subDay(), 'auto_renew' => false]);

        app(SubscriptionService::class)->expireDue();

        $this->assertSame(["Your college's Pro Campus plan has expired"], $this->titlesFor($tpo, 'plan.changed'));
    }

    // ───────────────────────────── account, imports, the rest ─────────────────────────────

    public function test_a_superadmin_resetting_a_password_leaves_a_security_notice_for_its_owner(): void
    {
        $student = $this->student();

        Sanctum::actingAs($this->superadmin());
        $this->postJson("/api/superadmin/users/{$student->id}/reset-password", ['password' => 'correct-horse-battery'])->assertOk();

        $this->assertSame(['An administrator changed your password'], $this->titlesFor($student, 'account.password_changed'));
    }

    public function test_changing_your_own_password_leaves_a_security_notice(): void
    {
        $student = $this->student();
        $student->forceFill(['password' => Hash::make('old-password-1')])->save();

        Sanctum::actingAs($student);
        $this->putJson('/api/me/password', ['current_password' => 'old-password-1', 'password' => 'new-password-22', 'password_confirmation' => 'new-password-22'])->assertOk();

        $this->assertSame(['Your password was changed'], $this->titlesFor($student, 'account.password_changed'));
    }

    public function test_a_finished_import_tells_whoever_uploaded_it(): void
    {
        $college = $this->college();
        $tpo = $this->tpoAt($college);
        $import = StudentImport::create(['college_id' => $college->id, 'uploaded_by' => $tpo->id, 'original_filename' => 's.csv', 'file_path' => 'imports/s.csv', 'status' => StudentImport::STATUS_PROCESSING]);

        $import->update(['status' => StudentImport::STATUS_COMPLETED_WITH_ERRORS, 'successful_rows' => 40, 'failed_rows' => 2]);

        $this->assertSame(['Your student import is finished'], $this->titlesFor($tpo, 'import.completed'));
        $this->assertStringContainsString('40 students added, 2 skipped', UserNotification::where('user_id', $tpo->id)->value('body'));
    }

    public function test_a_tpo_can_send_an_in_app_announcement_that_lands_in_their_students_bells(): void
    {
        $college = $this->college();
        $tpo = $this->tpoAt($college);
        $mine = $this->studentAt($college);
        $theirs = $this->studentAt($this->college('OTH'));

        Sanctum::actingAs($tpo);
        $this->postJson('/api/tpo/students/bulk-notify', [
            'student_ids' => [$mine->id, $theirs->id],
            'channel' => 'in_app',
            'title' => 'Pre-placement talk tomorrow',
            'message' => 'Auditorium, 10am. Bring your ID card.',
        ])->assertOk()->assertJsonPath('queued_count', 1);

        $this->assertSame(['Pre-placement talk tomorrow'], $this->titlesFor($mine, 'announcement.message'));
        $this->assertSame([], $this->titlesFor($theirs), "another college's student id is dropped, never reached");
    }

    public function test_an_in_app_announcement_needs_a_title_and_a_message(): void
    {
        $college = $this->college();
        $tpo = $this->tpoAt($college);
        $student = $this->studentAt($college);

        Sanctum::actingAs($tpo);
        $this->postJson('/api/tpo/students/bulk-notify', ['student_ids' => [$student->id], 'channel' => 'in_app'])->assertStatus(422)->assertJsonValidationErrors(['title', 'message']);
    }

    public function test_an_email_bulk_notification_also_leaves_a_pointer_in_the_bell(): void
    {
        \Illuminate\Support\Facades\Bus::fake();
        $college = $this->college();
        $tpo = $this->tpoAt($college);
        $student = $this->studentAt($college);

        Sanctum::actingAs($tpo);
        $this->postJson('/api/tpo/students/bulk-notify', ['student_ids' => [$student->id], 'channel' => 'email', 'template' => 'generic', 'recipient' => 'student'])->assertOk();

        $this->assertSame(['A message from your placement cell'], $this->titlesFor($student, 'announcement.message'));
    }

    public function test_vault_interest_and_interview_invites_reach_the_student_and_the_answer_reaches_the_company(): void
    {
        $student = $this->student();
        $company = Company::create(['name' => 'Nimbus Co', 'slug' => 'nimbus-'.uniqid()]);
        $hr = User::factory()->create(['role' => User::ROLE_ADMIN_COMPANY, 'company_id' => $company->id]);
        $profile = VaultProfile::create(['user_id' => $student->id, 'readiness_score' => 70, 'readiness_tier' => 'Placement Ready', 'visibility_status' => VaultProfile::STATUS_VISIBLE, 'is_eligible' => true]);

        $inquiry = VaultInquiry::create(['vault_profile_id' => $profile->id, 'company_id' => $company->id, 'initiated_by' => $hr->id, 'status' => VaultInquiry::STATUS_INTERESTED]);
        $this->assertSame(['A hiring partner is interested in you'], $this->titlesFor($student, 'vault.activity'));

        $inquiry->update(['status' => VaultInquiry::STATUS_INTERVIEW_SCHEDULED, 'interview_scheduled_at' => now()->addDays(3), 'interview_mode' => 'online', 'interview_location' => 'meet.example/x']);
        $this->assertContains('You have an interview invitation', $this->titlesFor($student, 'vault.activity'));

        $inquiry->update(['status' => VaultInquiry::STATUS_DECLINED_BY_CANDIDATE, 'responded_at' => now()]);
        $this->assertSame(["{$student->name} declined your interview invite"], $this->titlesFor($hr, 'vault.activity'));
    }
}
