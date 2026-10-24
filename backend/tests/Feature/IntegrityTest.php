<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\GuardianInstall;
use App\Models\GuardianLink;
use App\Models\IntegrityEvent;
use App\Models\IntegrityEvidence;
use App\Models\IntegritySession;
use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillAssessmentQuestion;
use App\Models\SoftSkillProctoringSession;
use App\Models\SoftSkillQuestion;
use App\Models\SoftSkillSession;
use App\Models\User;
use App\Services\Integrity\EventCatalog;
use App\Services\Integrity\EventLog;
use App\Services\Integrity\NetworkIntel;
use App\Services\Integrity\StrikeMath;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The exam-integrity layer, end to end, through a Soft Skills attempt (the simplest surface: answers autosave, and a lock
 * grades what was saved). What is proven:
 *   - a script that never opens the page cannot answer (no proctoring session / no live signal → refused);
 *   - the heartbeat gate, replay and out-of-order protection, and that the page cannot forge server/Guardian events;
 *   - strikes land in the surface's own counter, one incident costs one strike, silence costs a strike;
 *   - a second device cannot take over a live attempt; the exam-network allowlist; evidence is encrypted and scoped;
 *   - the Guardian's signed channel, its cross-check against the page, and the tamper-evident hash chain.
 */
class IntegrityTest extends TestCase
{
    use RefreshDatabase;

    private const INSTANCE = 'instance-aaaa1111';

    /** @var array<string, array{nonce: string, next: int}> */
    private array $chains = [];

    protected function setUp(): void
    {
        parent::setUp();

        // phpunit.xml switches the integrity layer off for the rest of the suite (as it does study proctoring); these tests switch it on.
        config(['integrity.enabled' => true, 'proctoring.study_enabled' => true]);
        Storage::fake('local');
        config(['integrity.evidence.disk' => 'local']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    // ── helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────

    private function student(?College $college = null): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $college?->id]);
    }

    private function assessment(): SoftSkillAssessment
    {
        $assessment = SoftSkillAssessment::create([
            'title' => 'Integrity Check',
            'slug' => SoftSkillAssessment::uniqueSlug('Integrity Check'),
            'status' => SoftSkillAssessment::STATUS_PUBLISHED,
            'assessment_type' => SoftSkillAssessment::TYPE_GENERAL,
            'duration_minutes' => 30,
            'pass_percentage' => 60,
        ]);

        foreach ([0, 1, 2] as $i => $correct) {
            $q = SoftSkillQuestion::create(['category' => 'aptitude', 'question_text' => 'Q'.($i + 1), 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => $correct]);
            SoftSkillAssessmentQuestion::create(['soft_skill_assessment_id' => $assessment->id, 'soft_skill_question_id' => $q->id, 'display_order' => $i]);
        }

        return $assessment;
    }

    /** @return array{0: int, 1: array<int, array<string, mixed>>} [session id, questions] — started, NOT yet proctored */
    private function startAttempt(): array
    {
        $start = $this->postJson("/api/soft-skills/{$this->assessment()->slug}/start")->assertOk()->json();

        return [$start['session']['id'], $start['questions']];
    }

    /** @param  array<string, mixed>  $integrity */
    private function proctorStart(int $sessionId, array $integrity = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start", [
            'device_info' => ['platform' => 'Win32'],
            'integrity' => $integrity + ['instance' => self::INSTANCE, 'fp' => str_repeat('a', 32), 'did' => str_repeat('d', 32)],
        ]);
    }

    /** @return array{0: int, 1: array<int, array<string, mixed>>, 2: string} [session id, questions, integrity uuid] a fully proctored attempt */
    private function proctoredAttempt(): array
    {
        [$sessionId, $questions] = $this->startAttempt();
        $res = $this->proctorStart($sessionId)->assertOk();
        $uuid = $res->json('integrity.id');
        $this->chains[$uuid] = ['nonce' => $res->json('integrity.nonce'), 'next' => $res->json('integrity.next_batch_id')];

        return [$sessionId, $questions, $uuid];
    }

    /**
     * One telemetry batch, the way the page sends it: the next batch id, the last nonce it was given.
     *
     * @param  list<array<string, mixed>>  $events
     * @param  array<string, mixed>  $override
     */
    private function beat(string $uuid, array $events = [], array $override = []): \Illuminate\Testing\TestResponse
    {
        $chain = $this->chains[$uuid];
        $res = $this->postJson("/api/integrity/{$uuid}/events", $override + [
            'batch_id' => $chain['next'],
            'nonce' => $chain['nonce'],
            'instance' => self::INSTANCE,
            't' => (int) round(microtime(true) * 1000),
            'events' => $events,
            'state' => ['visible' => true, 'focused' => true, 'fullscreen' => true, 'sw' => 1920, 'sh' => 1080, 'dpr' => 1, 'tz' => 'Asia/Kolkata'],
        ]);

        if ($res->status() === 200 && $res->json('nonce')) {
            $this->chains[$uuid] = ['nonce' => $res->json('nonce'), 'next' => ($override['batch_id'] ?? $chain['next']) + 1];
        }

        return $res;
    }

    /** @return array<string, mixed> */
    private function ev(string $type, array $data = []): array
    {
        return ['type' => $type, 't' => (int) round(microtime(true) * 1000), 'data' => $data];
    }

    private function strikes(int $sessionId): int
    {
        return (int) SoftSkillProctoringSession::where('soft_skill_session_id', $sessionId)->value('violation_count');
    }

    private function answer(int $sessionId, array $questions, int $i = 0)
    {
        return $this->postJson("/api/soft-skills/sessions/{$sessionId}/answer", ['response_id' => $questions[$i]['response_id'], 'selected_index' => 1]);
    }

    // ── the gate: no proof, no service ──────────────────────────────────────────────────────────────────────────────

    public function test_a_script_that_never_started_proctoring_cannot_answer_or_submit(): void
    {
        Sanctum::actingAs($this->student());
        [$sessionId, $questions] = $this->startAttempt();

        // No camera, no page, no consent — straight to the API.
        $this->answer($sessionId, $questions)->assertStatus(428)->assertJsonPath('code', 'proctoring_required');
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/submit")->assertStatus(428);
    }

    public function test_proctoring_started_but_integrity_never_attached_is_refused(): void
    {
        Sanctum::actingAs($this->student());
        [$sessionId, $questions] = $this->startAttempt();

        // The surface's own record exists (the old consent endpoint was called) but the client skipped the integrity channel.
        config(['integrity.enabled' => false]);
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start")->assertOk();
        config(['integrity.enabled' => true]);

        $this->answer($sessionId, $questions)->assertStatus(428)->assertJsonPath('code', 'integrity_required');
    }

    public function test_a_live_attempt_can_answer_and_a_silent_one_cannot(): void
    {
        Sanctum::actingAs($this->student());
        [$sessionId, $questions, $uuid] = $this->proctoredAttempt();

        $this->answer($sessionId, $questions)->assertOk();

        // Blocking the telemetry endpoint buys nothing: once the signal is stale, answers stop.
        IntegritySession::where('uuid', $uuid)->update(['last_beat_at' => now()->subMinutes(5)]);
        $this->answer($sessionId, $questions)->assertStatus(423)->assertJsonPath('code', 'integrity_signal_lost');
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/submit")->assertStatus(423);

        // The page's next beat revives it.
        $this->beat($uuid)->assertOk();
        $this->answer($sessionId, $questions)->assertOk();
    }

    public function test_observe_mode_records_but_does_not_refuse(): void
    {
        config(['integrity.enforce' => false]);
        Sanctum::actingAs($this->student());
        [$sessionId, $questions] = $this->startAttempt();

        $this->answer($sessionId, $questions)->assertOk();
    }

    public function test_the_kill_switch_restores_the_old_behaviour(): void
    {
        config(['integrity.enabled' => false]);
        Sanctum::actingAs($this->student());
        [$sessionId, $questions] = $this->startAttempt();

        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start")->assertOk()->assertJsonPath('integrity', null);
        $this->answer($sessionId, $questions)->assertOk();
        $this->assertSame(0, IntegritySession::count());
    }

    // ── start ───────────────────────────────────────────────────────────────────────────────────────────────────────

    public function test_start_returns_the_policy_a_nonce_and_a_marker_and_is_idempotent(): void
    {
        Sanctum::actingAs($this->student());
        [$sessionId] = $this->startAttempt();

        $first = $this->proctorStart($sessionId)->assertOk();
        $first->assertJsonPath('integrity.policy.profile', 'standard')
            ->assertJsonPath('integrity.policy.beat_interval', 12)
            ->assertJsonPath('integrity.status', 'active')
            ->assertJsonPath('integrity.next_batch_id', 1);
        $this->assertNotEmpty($first->json('integrity.nonce'));
        $this->assertSame(6, strlen($first->json('integrity.marker')));

        $again = $this->proctorStart($sessionId)->assertOk();
        $this->assertSame($first->json('integrity.id'), $again->json('integrity.id'));
        $this->assertSame(1, IntegritySession::count());

        // The page never learns another session's secrets, and the nonce is never in a list response.
        $this->assertArrayNotHasKey('nonce', IntegritySession::first()->toArray());
    }

    // ── batches: ordering, replay, forgery ──────────────────────────────────────────────────────────────────────────

    public function test_a_resent_batch_is_acknowledged_but_not_ingested_twice(): void
    {
        Sanctum::actingAs($this->student());
        [, , $uuid] = $this->proctoredAttempt();

        $payload = ['batch_id' => 1, 'nonce' => $this->chains[$uuid]['nonce'], 'instance' => self::INSTANCE, 'events' => [$this->ev('paste_attempt')]];
        $this->postJson("/api/integrity/{$uuid}/events", $payload)->assertOk()->assertJsonPath('duplicate', false);
        $count = IntegrityEvent::count();

        // The answer got lost, so the page resends the very same batch.
        $this->postJson("/api/integrity/{$uuid}/events", $payload)->assertOk()->assertJsonPath('duplicate', true);
        $this->assertSame($count, IntegrityEvent::count());
    }

    public function test_a_wrong_nonce_is_rejected_and_logged_as_a_replay(): void
    {
        Sanctum::actingAs($this->student());
        [, , $uuid] = $this->proctoredAttempt();

        $this->postJson("/api/integrity/{$uuid}/events", ['batch_id' => 1, 'nonce' => 'not-the-nonce', 'instance' => self::INSTANCE])
            ->assertStatus(409)->assertJsonPath('code', 'bad_nonce');

        $this->assertTrue(IntegrityEvent::where('type', 'replay_suspected')->exists());
    }

    public function test_the_page_cannot_forge_server_or_guardian_events(): void
    {
        Sanctum::actingAs($this->student());
        [$sessionId, , $uuid] = $this->proctoredAttempt();

        $res = $this->beat($uuid, [$this->ev('guardian_started'), $this->ev('session_ended'), $this->ev('os_foreground_away')])->assertOk();

        // None of the forged events was recorded as itself — only the finding that the page tried.
        $this->assertFalse(IntegrityEvent::whereIn('type', ['guardian_started', 'session_ended', 'os_foreground_away'])->where('source', 'web')->exists());
        $tamper = IntegrityEvent::where('type', 'tamper_detected')->first();
        $this->assertNotNull($tamper);
        $this->assertEqualsCanonicalizing(['guardian_started', 'session_ended', 'os_foreground_away'], $tamper->data()['forged_types']);
        $this->assertSame(1, $this->strikes($sessionId));
        $this->assertSame('tamper_detected', $res->json('strikes.0.type'));
    }

    public function test_an_old_tab_is_told_to_stand_down_when_the_attempt_is_reopened_in_the_same_browser(): void
    {
        Sanctum::actingAs($this->student());
        [$sessionId, , $uuid] = $this->proctoredAttempt();

        // A reload / second tab of the SAME browser (same device fingerprint): the newer instance takes over.
        $second = $this->proctorStart($sessionId, ['instance' => 'instance-bbbb2222'])->assertOk();
        $this->assertSame($uuid, $second->json('integrity.id'));
        $this->assertTrue(IntegrityEvent::where('type', 'instance_replaced')->exists());

        $this->beat($uuid)->assertStatus(409)->assertJsonPath('code', 'superseded');
    }

    public function test_a_second_device_cannot_take_over_a_live_attempt(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);
        [$sessionId, $questions, $uuid] = $this->proctoredAttempt();
        $this->beat($uuid)->assertOk();

        // Someone logs in as the student on another machine (different fingerprint) while the first is reporting.
        $this->proctorStart($sessionId, ['instance' => 'instance-cccc3333', 'fp' => str_repeat('b', 32), 'did' => str_repeat('e', 32)])
            ->assertStatus(409)->assertJsonPath('code', 'session_active_elsewhere');

        $this->assertTrue(IntegrityEvent::where('type', 'instance_conflict')->exists());
        $this->assertGreaterThan(0, IntegritySession::where('uuid', $uuid)->value('risk_score')); // the attempt to take it over counts against the attempt

        // The original keeps working.
        $this->beat($uuid)->assertOk();
        $this->answer($sessionId, $questions)->assertOk();
    }

    public function test_a_second_device_may_continue_once_the_first_has_gone_quiet(): void
    {
        Sanctum::actingAs($this->student());
        [$sessionId, , $uuid] = $this->proctoredAttempt();

        IntegritySession::where('uuid', $uuid)->update(['last_beat_at' => now()->subMinutes(10)]);

        $this->proctorStart($sessionId, ['instance' => 'instance-dddd4444', 'fp' => str_repeat('c', 32)])->assertOk();
        $this->assertTrue(IntegrityEvent::where('type', 'device_changed')->exists());
    }

    // ── strikes ─────────────────────────────────────────────────────────────────────────────────────────────────────

    public function test_a_strike_lands_in_the_surfaces_own_counter_and_three_end_the_attempt(): void
    {
        Sanctum::actingAs($this->student());
        [$sessionId, $questions, $uuid] = $this->proctoredAttempt();

        $this->beat($uuid, [$this->ev('devtools_detected')])->assertOk()->assertJsonPath('session.violation_count', 1)->assertJsonPath('locked', false);
        $this->beat($uuid, [$this->ev('devtools_detected')])->assertOk()->assertJsonPath('session.violation_count', 2);
        $res = $this->beat($uuid, [$this->ev('devtools_detected')])->assertOk();

        $res->assertJsonPath('locked', true)->assertJsonPath('session.status', 'locked');
        $this->assertSame(3, $this->strikes($sessionId));
        $this->assertSame('completed', SoftSkillSession::find($sessionId)->status); // a lock grades what was saved
        $this->assertTrue(IntegrityEvent::where('type', 'attempt_locked')->exists());
        // three devtools openings + a lock: the attempt reads as high risk to a reviewer
        $this->assertContains(IntegritySession::where('uuid', $uuid)->value('risk_level'), ['high', 'critical']);
    }

    public function test_one_walk_away_costs_one_strike_even_when_three_detectors_notice(): void
    {
        Sanctum::actingAs($this->student());
        [$sessionId, , $uuid] = $this->proctoredAttempt();

        $this->beat($uuid, [$this->ev('fullscreen_exit'), $this->ev('tab_switch'), $this->ev('focus_lost', ['duration_ms' => 5000])])->assertOk();

        $this->assertSame(1, $this->strikes($sessionId));
        // …and the extras are in the log, marked as part of the same incident.
        $merged = IntegrityEvent::whereIn('type', ['tab_switch', 'focus_lost'])->get()->filter(fn ($e) => ($e->data()['merged_into_incident'] ?? false) === true);
        $this->assertCount(2, $merged);
    }

    public function test_a_short_focus_blip_is_not_a_strike_but_a_long_one_is(): void
    {
        Sanctum::actingAs($this->student());
        [$sessionId, , $uuid] = $this->proctoredAttempt();

        $this->beat($uuid, [$this->ev('focus_lost', ['duration_ms' => 1200])])->assertOk();
        $this->assertSame(0, $this->strikes($sessionId));

        $this->beat($uuid, [$this->ev('focus_lost', ['duration_ms' => 9000])])->assertOk();
        $this->assertSame(1, $this->strikes($sessionId));
    }

    public function test_ai_findings_never_cost_a_strike_in_the_standard_profile(): void
    {
        Sanctum::actingAs($this->student());
        [$sessionId, , $uuid] = $this->proctoredAttempt();

        $this->beat($uuid, [$this->ev('multiple_faces'), $this->ev('phone_detected'), $this->ev('no_face')])->assertOk();

        $this->assertSame(0, $this->strikes($sessionId));
        $this->assertSame(3, IntegrityEvent::whereIn('type', ['multiple_faces', 'phone_detected', 'no_face'])->count());
        $this->assertGreaterThan(0, IntegritySession::where('uuid', $uuid)->value('risk_score'));
    }

    public function test_a_long_silence_costs_a_strike_when_the_page_comes_back(): void
    {
        Sanctum::actingAs($this->student());
        [$sessionId, , $uuid] = $this->proctoredAttempt();

        Carbon::setTestNow(now()->addSeconds(200));
        $this->beat($uuid)->assertOk();

        $this->assertSame(1, $this->strikes($sessionId));
        $gap = IntegrityEvent::where('type', 'telemetry_gap')->first();
        $this->assertGreaterThanOrEqual(190, $gap->data()['seconds']);
    }

    public function test_a_short_pause_is_forgiven(): void
    {
        Sanctum::actingAs($this->student());
        [$sessionId, , $uuid] = $this->proctoredAttempt();

        Carbon::setTestNow(now()->addSeconds(20));
        $this->beat($uuid)->assertOk();

        $this->assertSame(0, $this->strikes($sessionId));
        $this->assertFalse(IntegrityEvent::where('type', 'telemetry_gap')->exists());
    }

    public function test_an_address_change_is_recorded_and_flagged(): void
    {
        Sanctum::actingAs($this->student());
        [, , $uuid] = $this->proctoredAttempt();

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.9'])->beat($uuid)->assertOk();

        $event = IntegrityEvent::where('type', 'ip_changed')->first();
        $this->assertNotNull($event);
        $this->assertSame('203.0.113.9', $event->data()['to']);
        $this->assertSame(['127.0.0.1', '203.0.113.9'], array_keys(IntegritySession::where('uuid', $uuid)->first()->ips));
    }

    // ── network ─────────────────────────────────────────────────────────────────────────────────────────────────────

    public function test_an_attempt_cannot_start_outside_the_exam_network_and_costs_the_student_no_time(): void
    {
        config(['integrity.network.allowed_ranges' => ['203.0.113.0/24']]);
        Sanctum::actingAs($this->student());
        [$sessionId] = $this->startAttempt();

        $this->proctorStart($sessionId)->assertStatus(403)->assertJsonPath('code', 'network_not_allowed');

        // The refusal came BEFORE the surface's own start, so the attempt's clock was not restarted and nothing was consented.
        $this->assertSame(0, SoftSkillProctoringSession::count());
        $this->assertSame(0, IntegritySession::count());

        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.50'])->proctorStart($sessionId)->assertOk();
    }

    public function test_a_college_can_declare_its_own_exam_network(): void
    {
        $college = College::create(['name' => 'Net College', 'short_code' => 'NC', 'exam_networks' => ['198.51.100.0/24']]);
        config(['integrity.network.allowed_ranges' => []]);
        Sanctum::actingAs($this->student($college));
        [$sessionId] = $this->startAttempt();

        $this->proctorStart($sessionId)->assertStatus(403);
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.7'])->proctorStart($sessionId)->assertOk();
    }

    public function test_cidr_matching(): void
    {
        $this->assertTrue(NetworkIntel::inCidr('10.1.2.3', '10.0.0.0/8'));
        $this->assertFalse(NetworkIntel::inCidr('11.1.2.3', '10.0.0.0/8'));
        $this->assertTrue(NetworkIntel::inCidr('192.168.1.130', '192.168.1.128/25'));
        $this->assertFalse(NetworkIntel::inCidr('192.168.1.5', '192.168.1.128/25'));
        $this->assertTrue(NetworkIntel::inCidr('203.0.113.7', '203.0.113.7'));
        $this->assertTrue(NetworkIntel::inCidr('2001:db8::1', '2001:db8::/32'));
        $this->assertFalse(NetworkIntel::inCidr('2001:db9::1', '2001:db8::/32'));
        $this->assertTrue(NetworkIntel::inCidr('::ffff:10.0.0.1', '10.0.0.0/8'));
        $this->assertFalse(NetworkIntel::inCidr('not-an-ip', '10.0.0.0/8'));
        $this->assertFalse(NetworkIntel::inCidr('10.0.0.1', 'garbage'));
        $this->assertSame('private', NetworkIntel::classify('192.168.0.4'));
        $this->assertSame('cgnat', NetworkIntel::classify('100.72.1.1'));
        $this->assertSame('public', NetworkIntel::classify('8.8.8.8'));
        [$clean, $bad] = NetworkIntel::parseRanges("10.0.0.0/8, 203.0.113.0/24 nope 1.2.3.4/99");
        $this->assertSame(['10.0.0.0/8', '203.0.113.0/24'], $clean);
        $this->assertSame(['nope', '1.2.3.4/99'], $bad);
    }

    public function test_strike_math(): void
    {
        $this->assertSame(1, StrikeMath::toAdd(null, 0));
        $this->assertSame(1, StrikeMath::toAdd(1, 2));
        $this->assertSame(2, StrikeMath::toAdd(2, 0));
        $this->assertSame(3, StrikeMath::toAdd(EventCatalog::STRIKE_LOCK, 0));
        $this->assertSame(1, StrikeMath::toAdd(EventCatalog::STRIKE_LOCK, 2)); // exactly enough to reach the limit — never "100/3"
    }

    public function test_the_catalog_keeps_each_source_to_its_own_events(): void
    {
        $this->assertTrue(EventCatalog::allows('tab_switch', 'web'));
        $this->assertFalse(EventCatalog::allows('tab_switch', 'guardian'));
        $this->assertTrue(EventCatalog::allows('vm_detected', 'guardian'));
        $this->assertFalse(EventCatalog::allows('vm_detected', 'web'));
        $this->assertFalse(EventCatalog::allows('telemetry_gap', 'web'));
        $this->assertFalse(EventCatalog::allows('nonsense', 'web'));
    }

    // ── evidence ────────────────────────────────────────────────────────────────────────────────────────────────────

    private function jpeg(): string
    {
        if (! function_exists('imagecreatetruecolor')) {
            $this->markTestSkipped('GD is not available.');
        }
        $im = imagecreatetruecolor(32, 24);
        imagefilledrectangle($im, 0, 0, 31, 23, imagecolorallocate($im, 30, 90, 200));
        ob_start();
        imagejpeg($im, null, 70);

        return (string) ob_get_clean();
    }

    public function test_evidence_is_stored_encrypted_and_read_back_by_an_authorised_reviewer_only(): void
    {
        $college = College::create(['name' => 'Evidence College', 'short_code' => 'EC']);
        $other = College::create(['name' => 'Other College', 'short_code' => 'OT']);
        $student = $this->student($college);
        Sanctum::actingAs($student);
        [, , $uuid] = $this->proctoredAttempt();

        $bytes = $this->jpeg();
        $file = \Illuminate\Http\UploadedFile::fake()->createWithContent('shot.jpg', $bytes);
        $this->post("/api/integrity/{$uuid}/evidence", ['image' => $file, 'kind' => 'webcam', 'flagged' => true, 'reason' => 'no_face', 'meta' => json_encode(['faces' => 0])], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('stored', true);

        $row = IntegrityEvidence::first();
        $this->assertTrue($row->flagged);
        $this->assertSame('no_face', $row->reason);
        $onDisk = Storage::disk('local')->get($row->path);
        $this->assertNotSame($bytes, $onDisk);              // encrypted at rest
        $this->assertStringNotContainsString("\xFF\xD8\xFF", $onDisk);
        $this->assertSame(hash('sha256', $bytes), $row->sha256);

        // A TPO of the student's own college can see it, decrypted…
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
        Sanctum::actingAs($tpo);
        $this->get("/api/tpo/integrity/{$uuid}/evidence/{$row->id}")->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->assertSame($bytes, $this->get("/api/tpo/integrity/{$uuid}/evidence/{$row->id}")->getContent());
        $this->getJson("/api/tpo/integrity/{$uuid}")->assertOk()->assertJsonPath('integrity.chain_ok', true)->assertJsonPath('evidence.0.reason', 'no_face');

        // …a TPO of another college gets a 404 (not a 403), as does a student.
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $other->id]));
        $this->getJson("/api/tpo/integrity/{$uuid}")->assertNotFound();
        $this->get("/api/tpo/integrity/{$uuid}/evidence/{$row->id}")->assertNotFound();
        Sanctum::actingAs($student);
        $this->getJson("/api/tpo/integrity/{$uuid}")->assertForbidden();
    }

    public function test_evidence_must_be_a_real_small_jpeg(): void
    {
        Sanctum::actingAs($this->student());
        [, , $uuid] = $this->proctoredAttempt();

        $notAnImage = \Illuminate\Http\UploadedFile::fake()->createWithContent('x.jpg', '<?php echo 1; ?>');
        $this->post("/api/integrity/{$uuid}/evidence", ['image' => $notAnImage, 'kind' => 'webcam'], ['Accept' => 'application/json'])->assertStatus(422);
        $this->assertSame(0, IntegrityEvidence::count());
    }

    public function test_another_student_cannot_post_into_my_attempt(): void
    {
        Sanctum::actingAs($this->student());
        [, , $uuid] = $this->proctoredAttempt();

        Sanctum::actingAs($this->student());
        $this->postJson("/api/integrity/{$uuid}/events", ['batch_id' => 1, 'nonce' => 'x', 'instance' => self::INSTANCE])->assertNotFound();
        $this->postJson("/api/integrity/{$uuid}/end")->assertNotFound();
    }

    // ── the tamper-evident log ──────────────────────────────────────────────────────────────────────────────────────

    public function test_the_hash_chain_verifies_and_detects_edits_deletions_and_truncation(): void
    {
        Sanctum::actingAs($this->student());
        [, , $uuid] = $this->proctoredAttempt();
        $this->beat($uuid, [$this->ev('paste_attempt'), $this->ev('window_blur')])->assertOk();
        $this->beat($uuid, [$this->ev('devtools_detected', ['size' => 'docked'])])->assertOk();

        $session = IntegritySession::where('uuid', $uuid)->first();
        $this->assertNull(EventLog::verify($session));
        $this->artisan('integrity:verify', ['uuid' => $uuid])->assertSuccessful();

        // 1. someone edits a row's content
        $victim = IntegrityEvent::where('integrity_session_id', $session->id)->where('type', 'devtools_detected')->first();
        DB::table('integrity_events')->where('id', $victim->id)->update(['payload' => '{"size":"harmless"}']);
        $this->assertSame($victim->seq, EventLog::verify($session)['seq']);
        $this->artisan('integrity:verify', ['uuid' => $uuid])->assertFailed();
        DB::table('integrity_events')->where('id', $victim->id)->update(['payload' => $victim->payload]);
        $this->assertNull(EventLog::verify($session));

        // 2. a row in the middle is deleted
        $middle = IntegrityEvent::where('integrity_session_id', $session->id)->where('type', 'paste_attempt')->first();
        DB::table('integrity_events')->where('id', $middle->id)->delete();
        $this->assertNotNull(EventLog::verify($session));
    }

    public function test_trimming_the_end_of_the_log_is_detected(): void
    {
        Sanctum::actingAs($this->student());
        [, , $uuid] = $this->proctoredAttempt();
        $this->beat($uuid, [$this->ev('devtools_detected')])->assertOk();

        $session = IntegritySession::where('uuid', $uuid)->first();
        DB::table('integrity_events')->where('integrity_session_id', $session->id)->where('seq', $session->event_count)->delete();

        $this->assertStringContainsString('removed', EventLog::verify($session)['reason']);
    }

    // ── the Guardian ────────────────────────────────────────────────────────────────────────────────────────────────

    /** @return array{sk: string, pk: string} */
    private function keypair(): array
    {
        $pair = sodium_crypto_sign_keypair();

        return ['sk' => sodium_crypto_sign_secretkey($pair), 'pk' => sodium_crypto_sign_publickey($pair)];
    }

    /** @return array{token: string, link_id: int, keys: array{sk: string, pk: string}, seq: int} */
    private function pairGuardian(User $student, ?array $keys = null, string $install = '11111111-1111-4111-8111-111111111111'): array
    {
        $keys ??= $this->keypair();
        Sanctum::actingAs($student);
        $code = $this->postJson('/api/integrity/guardian/code')->assertOk()->json('code');

        $res = $this->postJson('/api/guardian/pair', [
            'code' => $code,
            'public_key' => base64_encode($keys['pk']),
            'install_id' => $install,
            'version' => '1.0.0',
            'exe_sha256' => str_repeat('a', 64),
            'platform' => 'windows',
        ])->assertOk();

        return ['token' => $res->json('token'), 'link_id' => $res->json('link_id'), 'keys' => $keys, 'seq' => 0];
    }

    /**
     * A signed Guardian report, exactly as the Go agent sends it.
     *
     * @param  array<string, mixed>  $g  from pairGuardian() (updated in place)
     * @param  array<string, mixed>  $body
     */
    private function guardianBeat(array &$g, array $body = [], ?string $tamperSignatureWith = null): \Illuminate\Testing\TestResponse
    {
        $g['seq']++;
        $body += ['seq' => $g['seq'], 'state' => ['version' => '1.0.0', 'tz' => 'Asia/Kolkata', 'monitors' => ['count' => 1, 'primary' => ['w' => 1920, 'h' => 1080]]], 'events' => []];
        $raw = json_encode($body);
        $sig = base64_encode(sodium_crypto_sign_detached($g['link_id'].'|'.$body['seq'].'|'.hash('sha256', $raw), $g['keys']['sk']));

        return $this->call('POST', '/api/guardian/beat', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer '.$g['token'],
            'HTTP_X_GUARDIAN_SIGNATURE' => $tamperSignatureWith ?? $sig,
        ], $raw);
    }

    public function test_the_guardian_pairs_with_a_one_time_code_and_its_reports_must_be_signed(): void
    {
        $student = $this->student();
        $g = $this->pairGuardian($student);
        $this->assertSame(1, GuardianLink::count());

        $this->guardianBeat($g)->assertOk()->assertJsonPath('ok', true);

        // A forged signature is refused…
        $this->guardianBeat($g, [], base64_encode(random_bytes(64)))->assertStatus(401)->assertJsonPath('code', 'bad_signature');
        // …a signature from another key is too…
        $other = $this->keypair();
        $g2 = $g;
        $g2['keys'] = $other;
        $this->guardianBeat($g2)->assertStatus(401);
        // …and so is a replay of an old sequence number.
        $g['seq'] = 0;
        $this->guardianBeat($g)->assertStatus(409)->assertJsonPath('code', 'replayed');

        // The code was single-use.
        $this->postJson('/api/guardian/pair', ['code' => 'AAAA-AAAA', 'public_key' => base64_encode($this->keypair()['pk']), 'install_id' => '22222222-2222-4222-8222-222222222222', 'version' => '1.0.0'])
            ->assertStatus(422)->assertJsonPath('code', 'invalid_code');
    }

    public function test_an_install_id_cannot_be_reused_with_a_different_key(): void
    {
        $student = $this->student();
        $this->pairGuardian($student);

        Sanctum::actingAs($student);
        $code = $this->postJson('/api/integrity/guardian/code')->json('code');
        $this->postJson('/api/guardian/pair', ['code' => $code, 'public_key' => base64_encode($this->keypair()['pk']), 'install_id' => '11111111-1111-4111-8111-111111111111', 'version' => '1.0.0'])
            ->assertStatus(409)->assertJsonPath('code', 'key_mismatch');
    }

    public function test_only_released_guardian_builds_may_pair_when_a_list_is_configured(): void
    {
        config(['integrity.guardian.allowed_builds' => [str_repeat('b', 64)]]);
        $student = $this->student();
        Sanctum::actingAs($student);
        $code = $this->postJson('/api/integrity/guardian/code')->json('code');

        $this->postJson('/api/guardian/pair', ['code' => $code, 'public_key' => base64_encode($this->keypair()['pk']), 'install_id' => '33333333-3333-4333-8333-333333333333', 'version' => '1.0.0', 'exe_sha256' => str_repeat('a', 64)])
            ->assertStatus(403)->assertJsonPath('code', 'guardian_build_not_allowed');
    }

    /** Puts a stand-in installer where the server looks for one, with the optional version file beside it. */
    private function installerOnServer(string $bytes = 'MZ-not-really-a-program', ?string $version = '1.2.3'): string
    {
        $dir = sys_get_temp_dir().DIRECTORY_SEPARATOR.'guardian-'.bin2hex(random_bytes(4));
        mkdir($dir);
        $path = $dir.DIRECTORY_SEPARATOR.'aptrun-guardian.exe';
        file_put_contents($path, $bytes);
        if ($version !== null) {
            file_put_contents($dir.DIRECTORY_SEPARATOR.'aptrun-guardian.json', json_encode(['version' => $version]));
        }
        config(['integrity.guardian.package_path' => $path, 'integrity.guardian.download_url' => '']);

        return $path;
    }

    public function test_with_no_installer_on_the_server_the_page_offers_no_download_and_the_link_says_why(): void
    {
        config(['integrity.guardian.package_path' => sys_get_temp_dir().'/no-such-guardian.exe', 'integrity.guardian.download_url' => '']);
        Sanctum::actingAs($this->student());

        $this->getJson('/api/integrity/guardian?surface=contest')->assertOk()->assertJsonPath('guardian.download_url', '')->assertJsonPath('guardian.download', null);
        $this->postJson('/api/integrity/guardian/code')->assertOk()->assertJsonPath('download_url', '');
        $this->getJson('/api/guardian/download')->assertStatus(404)->assertJsonPath('code', 'guardian_package_missing');
    }

    public function test_the_server_hands_students_the_installer_it_holds_and_tells_the_page_what_it_is(): void
    {
        $path = $this->installerOnServer('MZ-not-really-a-program', '1.2.3');
        Sanctum::actingAs($this->student());

        $status = $this->getJson('/api/integrity/guardian?surface=contest')->assertOk();
        $status->assertJsonPath('guardian.download_url', url('/api/guardian/download'));
        $status->assertJsonPath('guardian.download.version', '1.2.3');
        $status->assertJsonPath('guardian.download.size', strlen('MZ-not-really-a-program'));
        $status->assertJsonPath('guardian.download.sha256', hash('sha256', 'MZ-not-really-a-program'));
        $this->postJson('/api/integrity/guardian/code')->assertOk()->assertJsonPath('download_url', url('/api/guardian/download'));

        // A plain link on the page cannot carry the student's login, so the file itself needs none — and says what it is.
        $this->app['auth']->forgetGuards();
        $res = $this->get('/api/guardian/download')->assertOk();
        $this->assertSame('MZ-not-really-a-program', file_get_contents($res->baseResponse->getFile()->getPathname()));
        $this->assertSame(hash('sha256', 'MZ-not-really-a-program'), $res->headers->get('X-Guardian-SHA256'));
        $this->assertStringContainsString('attachment; filename=aptrun-guardian.exe', (string) $res->headers->get('Content-Disposition'));
        $this->assertSame('nosniff', $res->headers->get('X-Content-Type-Options'));

        @unlink($path);
    }

    public function test_the_hash_shown_follows_the_file_when_a_new_build_is_dropped_in(): void
    {
        $path = $this->installerOnServer('first build', null);
        Sanctum::actingAs($this->student());
        $this->getJson('/api/integrity/guardian?surface=contest')->assertJsonPath('guardian.download.sha256', hash('sha256', 'first build'))->assertJsonPath('guardian.download.version', null);

        file_put_contents($path, 'second build, longer');
        clearstatcache();
        $this->getJson('/api/integrity/guardian?surface=contest')->assertJsonPath('guardian.download.sha256', hash('sha256', 'second build, longer'));

        @unlink($path);
    }

    public function test_an_address_set_by_the_operator_wins_and_nothing_is_claimed_about_a_file_hosted_elsewhere(): void
    {
        $this->installerOnServer();
        config(['integrity.guardian.download_url' => 'https://downloads.example.com/aptrun-guardian.exe']);
        Sanctum::actingAs($this->student());

        $this->getJson('/api/integrity/guardian?surface=contest')->assertOk()
            ->assertJsonPath('guardian.download_url', 'https://downloads.example.com/aptrun-guardian.exe')
            ->assertJsonPath('guardian.download', null);
    }

    public function test_a_required_guardian_blocks_the_start_until_it_is_running_and_clean(): void
    {
        config(['integrity.profiles.standard.guardian' => 'required']);
        $student = $this->student();
        Sanctum::actingAs($student);
        [$sessionId] = $this->startAttempt();

        $this->proctorStart($sessionId)->assertStatus(428)->assertJsonPath('code', 'guardian_required');
        $this->assertSame(0, SoftSkillProctoringSession::count()); // before consent, before the clock

        $g = $this->pairGuardian($student);
        // Running but reporting a virtual machine → pre-flight blocker, nothing held against the student.
        $this->guardianBeat($g, ['state' => ['version' => '1.0.0', 'blockers' => [['type' => 'vm_detected', 'name' => 'VirtualBox']]]])->assertOk();
        Sanctum::actingAs($student);
        $this->proctorStart($sessionId)->assertStatus(422)->assertJsonPath('code', 'preflight_failed')->assertJsonPath('blockers.0.type', 'vm_detected');

        // Fixed: the next report is clean.
        $this->guardianBeat($g)->assertOk();
        Sanctum::actingAs($student);
        $this->proctorStart($sessionId)->assertOk()->assertJsonPath('integrity.assurance', 'guardian');
    }

    public function test_a_guardian_sighting_of_remote_control_software_ends_the_attempt(): void
    {
        $student = $this->student();
        $g = $this->pairGuardian($student);
        $this->guardianBeat($g)->assertOk();
        Sanctum::actingAs($student);
        [$sessionId, $questions, $uuid] = $this->proctoredAttempt();

        $this->guardianBeat($g, ['events' => [['type' => 'forbidden_process', 't' => (int) round(microtime(true) * 1000), 'data' => ['category' => 'remote_control', 'name' => 'anydesk.exe']]]])->assertOk();

        $this->assertSame(3, $this->strikes($sessionId));
        $this->assertSame('locked', SoftSkillProctoringSession::where('soft_skill_session_id', $sessionId)->value('status'));
        $this->assertSame('guardian', IntegrityEvent::where('type', 'forbidden_process')->value('source'));

        Sanctum::actingAs($student);
        $this->answer($sessionId, $questions)->assertForbidden();
    }

    public function test_a_messaging_app_costs_one_strike_not_the_attempt(): void
    {
        $student = $this->student();
        $g = $this->pairGuardian($student);
        $this->guardianBeat($g)->assertOk();
        Sanctum::actingAs($student);
        [$sessionId] = $this->proctoredAttempt();

        $this->guardianBeat($g, ['events' => [['type' => 'forbidden_process', 'data' => ['category' => 'messaging', 'name' => 'whatsapp.exe']]]])->assertOk();

        $this->assertSame(1, $this->strikes($sessionId));
    }

    public function test_the_page_cannot_speak_for_the_guardian_nor_the_guardian_for_the_page(): void
    {
        $student = $this->student();
        $g = $this->pairGuardian($student);
        $this->guardianBeat($g)->assertOk();
        Sanctum::actingAs($student);
        [$sessionId, , $uuid] = $this->proctoredAttempt();

        // The Guardian cannot send a browser-only event (it would be ignored, not recorded)…
        $this->guardianBeat($g, ['events' => [['type' => 'tab_switch', 'data' => []]]])->assertOk();
        $this->assertFalse(IntegrityEvent::where('type', 'tab_switch')->exists());
        $this->assertSame(0, $this->strikes($sessionId));
    }

    public function test_the_page_staying_silent_about_an_away_the_guardian_saw_is_caught(): void
    {
        $student = $this->student();
        $g = $this->pairGuardian($student);
        $this->guardianBeat($g)->assertOk();
        Sanctum::actingAs($student);
        [$sessionId, , $uuid] = $this->proctoredAttempt();

        // The OS says Discord took the foreground. A patched page claims it never lost focus.
        $this->guardianBeat($g, ['events' => [['type' => 'os_foreground_away', 'data' => ['since' => now()->getTimestamp(), 'process' => 'chrome.exe', 'to_process' => 'notepad.exe']]]])->assertOk();
        $this->assertSame(1, $this->strikes($sessionId)); // the OS-level strike itself

        // Before the deadline the page still has time to confirm it.
        $this->beat($uuid)->assertOk();
        $this->assertFalse(IntegrityEvent::where('type', 'guardian_page_mismatch')->exists());

        // After the deadline with no confirmation: the two witnesses disagree → the attempt ends.
        Carbon::setTestNow(now()->addSeconds(40));
        IntegritySession::where('uuid', $uuid)->update(['last_beat_at' => now()->subSeconds(5)]);
        $this->guardianBeat($g)->assertOk();
        $res = $this->beat($uuid);
        $res->assertOk();

        $this->assertTrue(IntegrityEvent::where('type', 'guardian_page_mismatch')->exists());
        $this->assertSame(3, $this->strikes($sessionId));
        $res->assertJsonPath('locked', true);
    }

    public function test_an_away_the_page_also_reported_is_not_a_mismatch(): void
    {
        $student = $this->student();
        $g = $this->pairGuardian($student);
        $this->guardianBeat($g)->assertOk();
        Sanctum::actingAs($student);
        [$sessionId, , $uuid] = $this->proctoredAttempt();

        $this->guardianBeat($g, ['events' => [['type' => 'os_foreground_away', 'data' => ['since' => now()->getTimestamp()]]]])->assertOk();
        $this->beat($uuid, [$this->ev('tab_switch')])->assertOk();

        Carbon::setTestNow(now()->addSeconds(40));
        IntegritySession::where('uuid', $uuid)->update(['last_beat_at' => now()->subSeconds(5)]);
        $this->beat($uuid)->assertOk();

        $this->assertFalse(IntegrityEvent::where('type', 'guardian_page_mismatch')->exists());
        $this->assertSame(1, $this->strikes($sessionId)); // one incident, one strike — both witnesses saw the same walk-away
    }

    public function test_a_guardian_on_a_different_machine_is_caught_by_the_host_check(): void
    {
        $student = $this->student();
        $g = $this->pairGuardian($student);
        $this->guardianBeat($g)->assertOk();
        Sanctum::actingAs($student);
        [$sessionId, , $uuid] = $this->proctoredAttempt();
        $this->beat($uuid)->assertOk(); // the page says 1920x1080, Asia/Kolkata, from 127.0.0.1

        // A helper's clean machine: different screen AND different timezone.
        $this->guardianBeat($g, ['state' => ['version' => '1.0.0', 'tz' => 'America/New_York', 'monitors' => ['count' => 1, 'primary' => ['w' => 1366, 'h' => 768]]]])->assertOk();

        $mismatch = IntegrityEvent::where('type', 'guardian_host_mismatch')->first();
        $this->assertNotNull($mismatch);
        $this->assertEqualsCanonicalizing(['screen', 'timezone'], $mismatch->data()['signals']);
        $this->assertSame(3, $this->strikes($sessionId));
    }

    // ── housekeeping ────────────────────────────────────────────────────────────────────────────────────────────────

    public function test_the_sweeper_ends_finished_attempts_and_prune_keeps_flagged_evidence_longer(): void
    {
        Sanctum::actingAs($this->student());
        [$sessionId, , $uuid] = $this->proctoredAttempt();
        $session = IntegritySession::where('uuid', $uuid)->first();

        $bytes = $this->jpeg();
        $store = app(\App\Services\Integrity\EvidenceVault::class);
        $clean = $store->store($session, 'webcam', $bytes, now());
        $flagged = $store->store($session, 'webcam', $bytes, now(), [], true, 'phone_detected');
        IntegrityEvidence::query()->update(['created_at' => now()->subDays(60)]);

        $this->artisan('integrity:prune')->assertSuccessful();
        $this->assertNull(IntegrityEvidence::find($clean->id));      // 60 days: past the 45-day clean retention
        $this->assertNotNull(IntegrityEvidence::find($flagged->id));  // flagged: kept for a year
        $this->assertFalse(Storage::disk('local')->exists($clean->path));
        $this->assertTrue(Storage::disk('local')->exists($flagged->path));

        // The attempt is submitted → the sweeper closes the integrity session with a closing entry.
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/submit")->assertOk();
        $this->artisan('integrity:sweep')->assertSuccessful();
        $this->assertSame('ended', IntegritySession::where('uuid', $uuid)->value('status'));
        $this->assertTrue(IntegrityEvent::where('type', 'session_ended')->exists());
        $this->assertNull(EventLog::verify(IntegritySession::where('uuid', $uuid)->first()));
    }

    // ── things found while running it for real ─────────────────────────────────────────────────────────────────────

    public function test_a_public_address_the_page_sees_that_differs_from_the_request_is_recorded_once(): void
    {
        Sanctum::actingAs($this->student());
        [, , $uuid] = $this->proctoredAttempt();

        $this->beat($uuid, [], ['net' => ['srflx' => ['203.0.113.77'], 'host' => ['192.168.1.5']]])->assertOk();
        $this->beat($uuid, [], ['net' => ['srflx' => ['203.0.113.77'], 'host' => ['192.168.1.5']]])->assertOk();

        $found = IntegrityEvent::where('type', 'webrtc_ip_mismatch')->get();
        $this->assertCount(1, $found);
        $this->assertSame(['203.0.113.77'], $found->first()->data()['webrtc']);
        $this->assertSame('server', $found->first()->source);

        // The same address the request came from is NOT a mismatch.
        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.4'])->beat($uuid, [], ['net' => ['srflx' => ['198.51.100.4'], 'host' => []]])->assertOk();
        $this->assertSame(1, IntegrityEvent::where('type', 'webrtc_ip_mismatch')->count());
    }

    public function test_the_page_cannot_claim_a_webrtc_mismatch_for_itself(): void
    {
        Sanctum::actingAs($this->student());
        [, , $uuid] = $this->proctoredAttempt();

        $this->beat($uuid, [$this->ev('webrtc_ip_mismatch')])->assertOk();

        $this->assertFalse(IntegrityEvent::where('type', 'webrtc_ip_mismatch')->where('source', 'web')->exists());
        $this->assertTrue(IntegrityEvent::where('type', 'tamper_detected')->exists()); // only the server may say it
    }

    public function test_the_preflight_summary_is_kept_cleanly_in_the_log(): void
    {
        Sanctum::actingAs($this->student());
        [$sessionId] = $this->startAttempt();

        $this->proctorStart($sessionId, ['preflight' => ['browser' => 'ok', 'camera' => 'ok', 'screen' => 'warn', 'evil' => 'ok', 'automation' => '<script>']])->assertOk();

        $started = IntegrityEvent::where('type', 'session_started')->first()->data();
        $this->assertSame(['browser' => 'ok', 'camera' => 'ok', 'screen' => 'warn'], $started['preflight']);
    }

    public function test_a_window_title_alone_costs_one_strike_never_the_attempt(): void
    {
        $student = $this->student();
        $g = $this->pairGuardian($student);
        $this->guardianBeat($g)->assertOk();
        Sanctum::actingAs($student);
        [$sessionId] = $this->proctoredAttempt();

        // A second browser window titled "ChatGPT" — weaker evidence than the program itself running.
        $this->guardianBeat($g, ['events' => [['type' => 'forbidden_process', 'data' => ['category' => 'ai_assistant', 'name' => 'ChatGPT - Google Chrome', 'via' => 'title']]]])->assertOk();

        $this->assertSame(1, $this->strikes($sessionId));
        $this->assertNotSame('locked', SoftSkillProctoringSession::where('soft_skill_session_id', $sessionId)->value('status'));
    }

    public function test_the_guardians_utc_offset_is_compared_with_the_pages_zone_name(): void
    {
        $student = $this->student();
        $g = $this->pairGuardian($student);
        $this->guardianBeat($g)->assertOk();
        Sanctum::actingAs($student);
        [$sessionId, , $uuid] = $this->proctoredAttempt();
        $this->beat($uuid)->assertOk(); // page: 1920x1080, Asia/Kolkata (UTC+05:30)

        // Same machine: the Guardian says "UTC+05:30" — that IS Asia/Kolkata, so nothing is wrong.
        $this->guardianBeat($g, ['state' => ['version' => '1.0.0', 'tz' => 'UTC+05:30', 'monitors' => ['count' => 1, 'primary' => ['w' => 1920, 'h' => 1080]]]])->assertOk();
        $this->assertFalse(IntegrityEvent::where('type', 'guardian_host_mismatch')->exists());
        $this->assertSame(0, $this->strikes($sessionId));
    }

    public function test_a_browser_started_for_remote_control_blocks_the_start_with_a_fix_and_a_new_keyboard_is_only_a_flag(): void
    {
        config(['integrity.profiles.standard.guardian' => 'required']);
        $student = $this->student();
        $g = $this->pairGuardian($student);
        $this->guardianBeat($g, ['state' => ['version' => '1.0.0', 'blockers' => [['type' => 'browser_flag', 'name' => 'msedge.exe --remote-debugging-port']]]])->assertOk();

        Sanctum::actingAs($student);
        [$sessionId] = $this->startAttempt();
        $this->proctorStart($sessionId)->assertStatus(422)->assertJsonPath('code', 'preflight_failed')->assertJsonPath('blockers.0.type', 'browser_flag');

        // fixed
        $this->guardianBeat($g)->assertOk();
        Sanctum::actingAs($student);
        $this->proctorStart($sessionId)->assertOk();

        // A keyboard plugged in mid-attempt is recorded for a reviewer, never a strike on its own.
        $this->guardianBeat($g, ['events' => [['type' => 'input_device_added', 'data' => ['name' => '3 keyboards, 1 mice (was 2/1)']]]])->assertOk();
        $this->assertTrue(IntegrityEvent::where('type', 'input_device_added')->where('source', 'guardian')->exists());
        $this->assertSame(0, $this->strikes($sessionId));
    }

    public function test_the_policy_handed_to_the_guardian_carries_the_tls_pins_and_the_denylist(): void
    {
        config(['integrity.guardian.tls_pins' => ['AAAA=', 'BBBB=']]);
        $student = $this->student();
        $g = $this->pairGuardian($student);

        $policy = $this->guardianBeat($g, ['policy_version' => 'stale'])->assertOk()->json('policy');
        $this->assertSame(['AAAA=', 'BBBB='], $policy['tls_pins']);
        $this->assertNotEmpty($policy['processes']);
        $this->assertSame(5000, $policy['beat_ms']);
    }

    public function test_a_tpo_sets_the_exam_network_and_the_change_is_audited(): void
    {
        $college = College::create(['name' => 'Lab College', 'short_code' => 'LC']);
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
        Sanctum::actingAs($tpo);

        $this->getJson('/api/tpo/exam-network')->assertOk()->assertJsonPath('ranges', [])->assertJsonPath('your_address', '127.0.0.1');

        $this->putJson('/api/tpo/exam-network', ['ranges' => ['203.0.113.0/24', '198.51.100.7']])->assertOk()->assertJsonPath('ranges', ['203.0.113.0/24', '198.51.100.7']);
        $this->assertSame(['203.0.113.0/24', '198.51.100.7'], $college->fresh()->exam_networks);

        // a typo must not be able to lock a class out
        $this->putJson('/api/tpo/exam-network', ['ranges' => ['203.0.113.0/24', '10.0.0.0/99', 'lab']])->assertStatus(422)->assertJsonValidationErrors('ranges');
        $this->assertSame(['203.0.113.0/24', '198.51.100.7'], $college->fresh()->exam_networks);

        $log = \App\Models\ActivityLog::where('action', 'college.exam_network.updated')->first();
        $this->assertNotNull($log);
        $this->assertSame(['203.0.113.0/24', '198.51.100.7'], $log->meta['after']);

        // emptying it removes the restriction
        $this->putJson('/api/tpo/exam-network', ['ranges' => []])->assertOk();
        $this->assertNull($college->fresh()->exam_networks);

        // a student cannot touch it
        Sanctum::actingAs($this->student($college));
        $this->putJson('/api/tpo/exam-network', ['ranges' => ['0.0.0.0/0']])->assertForbidden();
    }

    // ── the other surfaces ──────────────────────────────────────────────────────────────────────────────────────────

    public function test_a_contest_run_or_submit_needs_a_live_proctoring_signal(): void
    {
        \Illuminate\Support\Facades\Queue::fake();
        $student = $this->student();
        Sanctum::actingAs($student);

        $problem = \App\Models\Problem::create([
            'slug' => 'gate-problem', 'title' => 'Gate', 'difficulty' => 'easy', 'tags' => ['arrays'], 'description' => 'x', 'function_name' => 'solve',
            'params' => [['name' => 'nums', 'type' => 'integer[]']], 'return_type' => 'integer', 'comparison_mode' => \App\Models\Problem::COMPARISON_EXACT, 'display_order' => 1,
        ]);
        $contest = \App\Models\Contest::create(['title' => 'C', 'slug' => 'c-gate', 'start_at' => now()->subHour(), 'end_at' => now()->addHour(), 'is_rated' => false, 'status' => \App\Models\Contest::STATUS_PUBLISHED]);
        $cp = \App\Models\ContestProblem::create(['contest_id' => $contest->id, 'problem_id' => $problem->id, 'points' => 100, 'display_order' => 1]);
        \App\Models\ContestParticipant::create(['contest_id' => $contest->id, 'user_id' => $student->id, 'registered_at' => now()]);
        $base = "/api/contests/{$contest->getRouteKey()}/problems/{$cp->id}";
        $body = ['language' => 'python', 'code' => 'print(1)'];

        // A script straight at the judge: no camera, no page, no consent.
        $this->postJson("{$base}/run", $body)->assertStatus(428)->assertJsonPath('code', 'proctoring_required');
        $this->postJson("{$base}/submit", $body)->assertStatus(428);
        // The problem statement is still readable (the page loads it before the consent screen).
        $this->getJson($base)->assertOk();

        // Proctoring started through the page → run/submit work …
        $start = $this->postJson("{$base}/proctoring/start", ['integrity' => ['instance' => self::INSTANCE, 'fp' => str_repeat('a', 32), 'did' => str_repeat('d', 32)]])->assertOk();
        $this->assertSame('strict', $start->json('integrity.policy.profile'));
        $this->postJson("{$base}/run", $body)->assertStatus(202);

        // … until the signal goes quiet.
        IntegritySession::where('surface', 'contest')->update(['last_beat_at' => now()->subMinutes(3)]);
        $this->postJson("{$base}/submit", $body)->assertStatus(423)->assertJsonPath('code', 'integrity_signal_lost');
    }

    public function test_a_study_sitting_cannot_be_answered_without_a_live_signal(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'ECE']);
        Sanctum::actingAs($student);
        $attempts = fn (int $id) => $this->postJson('/api/me/drills/attempts', ['sitting_id' => $id, 'attempts' => [['pack' => 'digital', 'skill' => 'gray_code', 'difficulty' => 1, 'correct' => true, 'seconds' => 5]]]);

        $id = $this->postJson('/api/me/sittings', ['kind' => 'drill', 'subject' => 'gray_code'])->assertCreated()->json('sitting.id');

        // Consent recorded through the old endpoint only (the client skipped the integrity channel).
        config(['integrity.enabled' => false]);
        $this->postJson("/api/me/sittings/{$id}/proctoring/start")->assertOk();
        config(['integrity.enabled' => true]);
        $attempts($id)->assertStatus(428)->assertJsonPath('code', 'integrity_required');

        $res = $this->postJson("/api/me/sittings/{$id}/proctoring/start", ['integrity' => ['instance' => self::INSTANCE, 'fp' => str_repeat('a', 32)]])->assertOk();
        $this->assertSame('practice', $res->json('integrity.policy.profile'));
        $attempts($id)->assertCreated();

        IntegritySession::where('surface', 'study')->update(['last_beat_at' => now()->subMinutes(3)]);
        $attempts($id)->assertStatus(423)->assertJsonPath('code', 'integrity_signal_lost');
    }

    public function test_review_lists_are_scoped_to_the_viewer(): void
    {
        $a = College::create(['name' => 'A College', 'short_code' => 'AC']);
        $b = College::create(['name' => 'B College', 'short_code' => 'BC']);

        Sanctum::actingAs($this->student($a));
        [, , $mine] = $this->proctoredAttempt();
        Sanctum::actingAs($this->student($b));
        [, , $theirs] = $this->proctoredAttempt();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $a->id]));
        $listed = collect($this->getJson('/api/tpo/integrity')->assertOk()->json('data'))->pluck('uuid')->all();
        $this->assertSame([$mine], $listed);
        $this->getJson("/api/tpo/integrity/{$theirs}")->assertNotFound();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));
        $this->assertCount(2, $this->getJson('/api/admin/integrity')->assertOk()->json('data'));
    }
}
