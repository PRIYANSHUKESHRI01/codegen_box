<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\User;
use App\Models\VaultProfile;
use App\Models\VaultSyncEvent;
use App\Services\UserPurgeService;
use App\Services\Vault\VaultPayloadBuilder;
use App\Services\Vault\VaultService;
use App\Services\Vault\VaultSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\CreatesReadinessFixtures;
use Tests\TestCase;

/**
 * The hand-off to Mellow Vault. What matters: nothing is ever lost to an outage,
 * a withdrawal can never be overtaken or skipped, every request is signed, and a
 * deleted student's data does not linger in the outbox.
 */
class VaultSyncTest extends TestCase
{
    use CreatesReadinessFixtures;
    use RefreshDatabase;

    private const URL = 'https://vault.example.test/hooks/aptrun';

    private const SECRET = 'a-shared-secret';

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        config(['vault.sync_url' => self::URL, 'vault.sync_secret' => self::SECRET, 'vault.sync_debounce_minutes' => 30]);
    }

    private function breakdown(int $score): array
    {
        return [
            'score' => $score,
            'tier' => 'In Progress',
            'components' => [['key' => 'interview_performance', 'label' => 'AI Interviews', 'score' => $score, 'weight_percent' => 20, 'contribution' => 0, 'detail' => 'x']],
        ];
    }

    /** A student who is ready and has consented — live, with one listing waiting in the outbox. */
    private function liveStudent(array $attributes = []): User
    {
        $student = $this->readinessStudent($attributes);
        app(VaultService::class)->applyReadiness($student, $this->breakdown(72));
        app(VaultService::class)->giveConsent($student);

        return $student;
    }

    private function sync(): VaultSyncService
    {
        return app(VaultSyncService::class);
    }

    private function profileOf(User $student): VaultProfile
    {
        return VaultProfile::where('user_id', $student->id)->firstOrFail();
    }

    // ───────────────────────────── what is written ─────────────────────────────

    public function test_going_live_queues_one_listing_for_immediate_delivery(): void
    {
        $student = $this->liveStudent();

        $event = VaultSyncEvent::firstOrFail();

        $this->assertSame(VaultSyncEvent::TYPE_UPSERT, $event->type);
        $this->assertSame($this->profileOf($student)->public_id, $event->profile_public_id);
        $this->assertLessThanOrEqual(now(), $event->available_at);
        $this->assertSame(1, $event->sequence);
        $this->assertSame(VaultProfile::SYNC_PENDING, $this->profileOf($student)->sync_state);
    }

    public function test_the_listing_carries_what_the_student_agreed_to_and_never_a_phone_number(): void
    {
        $college = College::create(['name' => 'Apex Institute', 'short_code' => 'APEX', 'city' => 'Pune', 'state' => 'MH', 'tier' => 'Academic Enterprise', 'placement_rate' => 80]);
        $student = $this->liveStudent([
            'name' => 'Asha Rao', 'email' => 'asha@example.test', 'college_id' => $college->id, 'branch' => 'CSE', 'cgpa' => 8.4, 'backlogs' => 0,
            'phone' => '9876543210', 'parent_phone' => '9123456789', 'roll_number' => 'R-77',
            'skills' => ['Laravel', 'React'], 'bio' => 'Builds things.', 'linkedin_url' => 'https://linkedin.com/in/asha', 'github_url' => 'https://github.com/asha',
        ]);

        $listing = app(VaultPayloadBuilder::class)->build($this->profileOf($student));

        $this->assertSame('Asha Rao', $listing['name']);
        $this->assertSame('asha@example.test', $listing['email']);
        $this->assertSame('Apex Institute', $listing['college']['name']);
        $this->assertSame('CSE', $listing['branch']);
        $this->assertSame(8.4, $listing['cgpa']);
        $this->assertSame(['Laravel', 'React'], $listing['skills']);
        $this->assertSame(72, $listing['readiness']['score']);
        $this->assertSame('interview_performance', $listing['readiness']['components'][0]['key']);

        $json = json_encode($listing);
        foreach (['9876543210', '9123456789', 'R-77', 'phone', 'roll_number'] as $secret) {
            $this->assertStringNotContainsString($secret, $json, "{$secret} must never leave AptRun");
        }
        $this->assertSame(26, strlen($listing['id']));
        $this->assertNotSame((string) $student->id, $listing['id']);
    }

    public function test_an_unchanged_listing_is_not_sent_again(): void
    {
        $student = $this->liveStudent();
        Http::fake(['*' => Http::response([], 200)]);
        $this->sync()->deliverDue();

        app(VaultService::class)->applyReadiness($student, $this->breakdown(72));
        app(VaultService::class)->profileChanged($student);

        $this->assertSame(1, VaultSyncEvent::count(), 'a refresh that changed nothing must queue nothing');
    }

    public function test_a_burst_of_edits_to_a_live_profile_is_merged_into_one_update(): void
    {
        $student = $this->liveStudent();
        Http::fake(['*' => Http::response([], 200)]);
        $this->sync()->deliverDue();

        foreach (['Laravel', 'React', 'MySQL'] as $skill) {
            $student->forceFill(['skills' => [...($student->skills ?? []), $skill]])->save();
            app(VaultService::class)->profileChanged($student);
        }

        $waiting = VaultSyncEvent::where('status', VaultSyncEvent::STATUS_PENDING)->get();
        $this->assertCount(1, $waiting, 'three edits, one pending update');
        $this->assertSame(['Laravel', 'React', 'MySQL'], $waiting->first()->payload['profile']['skills']);
        $this->assertGreaterThan(now()->addMinutes(20), $waiting->first()->available_at, 'edits wait out the debounce');
        $this->assertSame(0, $this->sync()->deliverDue()['attempted'], 'nothing is due yet');
    }

    public function test_withdrawing_before_delivery_cancels_the_listing_and_sends_nothing(): void
    {
        $student = $this->liveStudent();

        app(VaultService::class)->withdrawConsent($student);

        $this->assertSame(0, VaultSyncEvent::count(), 'Mellow Vault never heard of this student, so there is nothing to take down');
        $this->assertSame(VaultProfile::SYNC_IDLE, $this->profileOf($student)->sync_state);
    }

    public function test_withdrawing_after_delivery_queues_a_withdrawal_with_the_reason(): void
    {
        $student = $this->liveStudent();
        Http::fake(['*' => Http::response(['id' => 'mv-1'], 200)]);
        $this->sync()->deliverDue();

        app(VaultService::class)->withdrawConsent($student);

        $withdraw = VaultSyncEvent::where('type', VaultSyncEvent::TYPE_WITHDRAW)->firstOrFail();
        $this->assertSame('consent_withdrawn', $withdraw->reason);
        $this->assertSame(2, $withdraw->sequence);
        $this->assertSame(['profile' => ['id' => $this->profileOf($student)->public_id]], $withdraw->payload);
    }

    public function test_each_reason_for_leaving_is_told_to_mellow_vault(): void
    {
        $reasons = [];
        foreach (['staff' => fn (VaultService $v, User $s, VaultProfile $p) => $v->staffHide($p, User::factory()->create(['role' => User::ROLE_SUPERADMIN])),
            'score' => fn (VaultService $v, User $s, VaultProfile $p) => $v->applyReadiness($s, $this->breakdown(10)),
            'hired' => fn (VaultService $v, User $s, VaultProfile $p) => $v->markHired($p, VaultProfile::HIRED_VIA_PARTNER)] as $key => $act) {
            $student = $this->liveStudent();
            Http::fake(['*' => Http::response([], 200)]);
            $this->sync()->deliverDue();

            $act(app(VaultService::class), $student, $this->profileOf($student));

            $reasons[$key] = VaultSyncEvent::where('profile_public_id', $this->profileOf($student)->public_id)->where('type', VaultSyncEvent::TYPE_WITHDRAW)->value('reason');
        }

        $this->assertSame(['staff' => 'hidden_by_staff', 'score' => 'below_threshold', 'hired' => 'hired'], $reasons);
    }

    // ───────────────────────────── delivering ─────────────────────────────

    public function test_nothing_is_sent_and_nothing_is_lost_while_mellow_vault_is_not_connected(): void
    {
        config(['vault.sync_url' => null]);
        Http::fake();
        $this->liveStudent();

        $result = $this->sync()->deliverDue();

        $this->assertFalse($result['configured']);
        Http::assertNothingSent();
        $this->assertSame(1, VaultSyncEvent::where('status', VaultSyncEvent::STATUS_PENDING)->count());
    }

    public function test_an_unsigned_request_is_never_made_a_url_without_a_secret_sends_nothing(): void
    {
        config(['vault.sync_secret' => null]);
        Http::fake();
        $this->liveStudent();

        $this->assertFalse($this->sync()->isConfigured());
        $this->sync()->deliverDue();

        Http::assertNothingSent();
    }

    public function test_a_delivery_is_signed_idempotent_and_marks_the_student_as_listed(): void
    {
        $student = $this->liveStudent();
        Http::fake(['*' => Http::response(['id' => 'mv-student-9'], 200)]);

        $result = $this->sync()->deliverDue();

        $this->assertSame(1, $result['delivered']);

        Http::assertSent(function (Request $request) {
            $event = VaultSyncEvent::firstOrFail();
            $timestamp = $request->header('X-AptRun-Timestamp')[0];
            $expected = 'v1='.hash_hmac('sha256', $timestamp.'.'.$request->body(), self::SECRET);

            return $request->url() === self::URL
                && $request->header('X-AptRun-Signature')[0] === $expected
                && $request->header('Idempotency-Key')[0] === $event->uuid
                && $request->header('X-AptRun-Event-Id')[0] === $event->uuid
                && $request->header('X-AptRun-Event-Type')[0] === 'profile.upsert'
                && $request['id'] === $event->uuid
                && $request['type'] === 'profile.upsert'
                && $request['source'] === 'aptrun'
                && $request['sequence'] === 1
                && isset($request['profile']['readiness']['score']);
        });

        $profile = $this->profileOf($student);
        $this->assertSame(VaultSyncEvent::STATUS_DELIVERED, VaultSyncEvent::firstOrFail()->status);
        $this->assertNotNull($profile->vault_listed_at);
        $this->assertSame(VaultProfile::SYNC_DELIVERED, $profile->sync_state);
        $this->assertSame('mv-student-9', $profile->external_id);
    }

    public function test_a_withdrawal_clears_the_listed_marker_once_delivered(): void
    {
        $student = $this->liveStudent();
        Http::fake(['*' => Http::response([], 200)]);
        $this->sync()->deliverDue();
        app(VaultService::class)->withdrawConsent($student);

        $this->sync()->deliverDue();

        $this->assertNull($this->profileOf($student)->vault_listed_at);
        $this->assertSame(0, VaultSyncEvent::whereIn('status', [VaultSyncEvent::STATUS_PENDING, VaultSyncEvent::STATUS_FAILED])->count());
    }

    public function test_a_server_error_is_retried_later_with_backoff(): void
    {
        $student = $this->liveStudent();
        Http::fake(['*' => Http::response('boom', 503)]);

        $result = $this->sync()->deliverDue();

        $event = VaultSyncEvent::firstOrFail();
        $this->assertSame(1, $result['retrying']);
        $this->assertSame(VaultSyncEvent::STATUS_FAILED, $event->status);
        $this->assertSame(1, $event->attempts);
        $this->assertSame(503, $event->last_status_code);
        $this->assertStringContainsString('503', $event->last_error);
        $this->assertTrue($event->available_at->gt(now()->addSeconds(30)), 'first retry is about a minute away');
        $this->assertSame(VaultProfile::SYNC_FAILED, $this->profileOf($student)->sync_state);

        $this->assertSame(0, $this->sync()->deliverDue()['attempted'], 'not due again yet');
    }

    public function test_a_connection_failure_is_retried_too(): void
    {
        $this->liveStudent();
        Http::fake(fn () => throw new ConnectionException('timed out'));

        $this->sync()->deliverDue();

        $event = VaultSyncEvent::firstOrFail();
        $this->assertSame(VaultSyncEvent::STATUS_FAILED, $event->status);
        $this->assertNull($event->last_status_code);
        $this->assertStringContainsString('timed out', $event->last_error);
    }

    public function test_a_retry_that_succeeds_delivers_and_clears_the_failure(): void
    {
        $student = $this->liveStudent();
        Http::fake(['*' => Http::sequence()->push('boom', 500)->push([], 200)]);
        $this->sync()->deliverDue();
        VaultSyncEvent::query()->update(['available_at' => now()->subMinute()]);

        $this->sync()->deliverDue();

        $event = VaultSyncEvent::firstOrFail();
        $this->assertSame(VaultSyncEvent::STATUS_DELIVERED, $event->status);
        $this->assertSame(2, $event->attempts);
        $this->assertNull($event->last_error);
        $this->assertSame(VaultProfile::SYNC_DELIVERED, $this->profileOf($student)->sync_state);
    }

    public function test_after_the_last_attempt_an_event_is_parked_as_dead(): void
    {
        config(['vault.sync_max_attempts' => 3]);
        $this->liveStudent();
        Http::fake(['*' => Http::response('boom', 500)]);

        foreach (range(1, 3) as $_) {
            VaultSyncEvent::query()->update(['available_at' => now()->subMinute()]);
            $this->sync()->deliverDue();
        }

        $this->assertSame(VaultSyncEvent::STATUS_DEAD, VaultSyncEvent::firstOrFail()->status);
        $this->assertSame(3, VaultSyncEvent::firstOrFail()->attempts);
    }

    public function test_a_payload_the_receiver_rejects_is_parked_at_once(): void
    {
        $this->liveStudent();
        Http::fake(['*' => Http::response(['error' => 'bad profile'], 422)]);

        $result = $this->sync()->deliverDue();

        $this->assertSame(1, $result['dead']);
        $this->assertSame(1, VaultSyncEvent::firstOrFail()->attempts, 'a retry cannot fix a payload that is wrong');
    }

    public function test_parked_events_can_be_given_another_full_set_of_attempts(): void
    {
        $this->liveStudent();
        Http::fake(['*' => Http::sequence()->push('no', 422)->push([], 200)]);
        $this->sync()->deliverDue();

        $this->assertSame(1, $this->sync()->retryDead());

        $event = VaultSyncEvent::firstOrFail();
        $this->assertSame(VaultSyncEvent::STATUS_PENDING, $event->status);
        $this->assertSame(0, $event->attempts);

        $this->assertSame(1, $this->sync()->deliverDue()['delivered']);
    }

    public function test_a_profiles_events_are_delivered_strictly_in_order(): void
    {
        $student = $this->liveStudent();
        Http::fake(['*' => Http::sequence()->push([], 200)->push('boom', 500)->push([], 200)]);

        $this->sync()->deliverDue();                              // the listing is delivered
        app(VaultService::class)->withdrawConsent($student);      // so a withdrawal is queued ...
        $this->sync()->deliverDue();                              // ... and fails: it will be retried later
        app(VaultService::class)->giveConsent($student);          // the student changes their mind again: a new listing
        VaultSyncEvent::where('status', VaultSyncEvent::STATUS_PENDING)->update(['available_at' => now()->subMinute()]);

        $result = $this->sync()->deliverDue();

        $this->assertSame(0, $result['attempted'], 'the new listing must not overtake the unfinished withdrawal');
        Http::assertSentCount(2);

        $types = VaultSyncEvent::where('profile_public_id', $this->profileOf($student)->public_id)->orderBy('id')->get(['type', 'status'])
            ->map(fn ($e) => "{$e->type}:{$e->status}")->all();

        $this->assertSame(['profile.upsert:delivered', 'profile.withdraw:failed', 'profile.upsert:pending'], $types);
    }

    public function test_one_students_failure_does_not_hold_back_another(): void
    {
        $a = $this->liveStudent();
        $b = $this->liveStudent();
        $aId = $this->profileOf($a)->public_id;

        Http::fake(function (Request $request) use ($aId) {
            return $request['profile']['id'] === $aId ? Http::response('boom', 500) : Http::response([], 200);
        });

        $result = $this->sync()->deliverDue();

        $this->assertSame(1, $result['delivered']);
        $this->assertSame(1, $result['retrying']);
        $this->assertNotNull($this->profileOf($b)->vault_listed_at);
        $this->assertNull($this->profileOf($a)->vault_listed_at);
    }

    public function test_follow_ups_blocked_behind_a_failing_event_cannot_starve_other_students_out_of_the_batch(): void
    {
        config(['vault.sync_batch' => 2]);

        // Student A: an earlier event is waiting out its backoff, with a newer one queued behind it.
        $a = $this->liveStudent();
        $first = VaultSyncEvent::firstOrFail();
        $first->update(['status' => VaultSyncEvent::STATUS_FAILED, 'attempts' => 1, 'available_at' => now()->addHour()]);
        VaultSyncEvent::create([
            'vault_profile_id' => $this->profileOf($a)->id, 'profile_public_id' => $this->profileOf($a)->public_id,
            'type' => VaultSyncEvent::TYPE_UPSERT, 'sequence' => 2, 'payload' => ['profile' => ['id' => $this->profileOf($a)->public_id]],
            'available_at' => now()->subMinute(),
        ]);

        $b = $this->liveStudent();
        $c = $this->liveStudent();
        Http::fake(['*' => Http::response([], 200)]);

        $result = $this->sync()->deliverDue();

        $this->assertSame(2, $result['delivered'], 'the batch of two goes to B and C, not to the blocked follow-up of A');
        $this->assertNotNull($this->profileOf($b)->vault_listed_at);
        $this->assertNotNull($this->profileOf($c)->vault_listed_at);
        $this->assertNull($this->profileOf($a)->vault_listed_at);
    }

    public function test_an_event_claimed_by_a_crashed_run_is_released_and_retried(): void
    {
        $this->liveStudent();
        VaultSyncEvent::query()->update(['status' => VaultSyncEvent::STATUS_PROCESSING, 'processing_at' => now()->subMinutes(10)]);
        Http::fake(['*' => Http::response([], 200)]);

        $this->assertSame(1, $this->sync()->deliverDue()['delivered']);
    }

    public function test_the_sync_command_reports_and_delivers(): void
    {
        $this->liveStudent();
        Http::fake(['*' => Http::response([], 200)]);

        $this->artisan('vault:sync')->expectsOutputToContain('Delivered 1 of 1')->assertSuccessful();
    }

    public function test_the_sync_command_warns_when_events_are_waiting_with_no_connection(): void
    {
        config(['vault.sync_url' => null]);
        $this->liveStudent();

        $this->artisan('vault:sync')->expectsOutputToContain('not connected')->assertSuccessful();
    }

    // ───────────────────────────── account deletion, pruning, health ─────────────────────────────

    public function test_deleting_a_student_withdraws_them_and_scrubs_their_data_from_the_outbox(): void
    {
        $student = $this->liveStudent(['name' => 'Asha Rao', 'email' => 'asha@example.test']);
        $publicId = $this->profileOf($student)->public_id;
        Http::fake(['*' => Http::response([], 200)]);
        $this->sync()->deliverDue(); // Mellow Vault now holds her

        app(UserPurgeService::class)->purge($student);

        $this->assertNull(User::find($student->id));
        $this->assertSame(0, VaultProfile::where('public_id', $publicId)->count());

        $withdraw = VaultSyncEvent::where('profile_public_id', $publicId)->where('type', VaultSyncEvent::TYPE_WITHDRAW)->firstOrFail();
        $this->assertSame('account_closed', $withdraw->reason, 'the withdrawal outlives the account');

        $outbox = json_encode(VaultSyncEvent::all()->toArray());
        $this->assertStringNotContainsString('Asha Rao', $outbox);
        $this->assertStringNotContainsString('asha@example.test', $outbox);

        $this->assertSame(1, $this->sync()->deliverDue()['delivered'], 'and it is actually delivered');
    }

    public function test_a_student_who_was_never_listed_leaves_nothing_behind_when_deleted(): void
    {
        $student = $this->readinessStudent();
        app(VaultService::class)->applyReadiness($student, $this->breakdown(70)); // eligible, never consented

        app(UserPurgeService::class)->purge($student);

        $this->assertSame(0, VaultSyncEvent::where('type', VaultSyncEvent::TYPE_UPSERT)->count());
    }

    public function test_delivered_events_are_pruned_after_their_retention_but_waiting_and_parked_ones_never(): void
    {
        config(['vault.sync_retention_days' => 30]);
        $this->liveStudent();
        $this->liveStudent();
        $this->liveStudent();
        $events = VaultSyncEvent::orderBy('id')->get();
        $events[0]->update(['status' => VaultSyncEvent::STATUS_DELIVERED, 'delivered_at' => now()->subDays(40)]);
        $events[1]->update(['status' => VaultSyncEvent::STATUS_DEAD]);
        $events[1]->forceFill(['created_at' => now()->subDays(90)])->save();

        $this->assertSame(1, $this->sync()->prune());
        $this->assertSame(2, VaultSyncEvent::count());
    }

    public function test_health_summarises_the_connection_and_the_backlog(): void
    {
        $this->liveStudent();
        $this->liveStudent();
        VaultSyncEvent::orderBy('id')->first()->update(['status' => VaultSyncEvent::STATUS_DEAD]);
        config(['vault.api_key' => 'k']);

        $health = $this->sync()->health();

        $this->assertTrue($health['configured']);
        $this->assertTrue($health['api_key_set']);
        $this->assertSame(1, $health['pending']);
        $this->assertSame(1, $health['dead']);
        $this->assertNotNull($health['oldest_waiting_minutes']);
    }
}
