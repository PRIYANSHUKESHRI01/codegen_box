<?php

namespace App\Services\Integrity;

use App\Models\College;
use App\Models\GuardianLink;
use App\Models\IntegritySession;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The integrity layer's brain. The rule it is built on: NOTHING THE BROWSER SAYS IS TRUSTED, AND SILENCE IS NEVER "ALL CLEAR".
 *
 *   attach()        called by each surface's proctoring/start. Creates or resumes the attempt's integrity session, binds it to
 *                   the first browser instance, device and network address, and tells the page what the server requires.
 *   ingestWeb()     one telemetry batch from the page: replay-checked (batch id + rotating nonce), gap-accounted, address /
 *                   device / clock-checked, every event hash-chained into the log, every strike handed to the surface's own
 *                   service (which counts it and performs the lock).
 *   ingestGuardian() the same for the AptRun Guardian (the Windows agent): a separate, signed channel the page cannot touch.
 *   gate()          called by every answer / run / submit endpoint. No live signal → no service.
 *
 * Every public method is safe to call concurrently: the attempt's row is locked for the length of one batch, so the hash
 * chain has exactly one writer at a time.
 */
class IntegrityService
{
    public function __construct(private readonly GuardianService $guardians) {}

    // ── start / resume ──────────────────────────────────────────────────────────────────────────────────────────────

    /**
     * The checks that decide whether an attempt may begin at all: WHERE from (the exam network) and WHAT on (the Guardian,
     * when the profile wants it, must be running and must report a clean machine). Call it BEFORE the surface's own
     * startOrResume — that is what starts a timed test's clock, and a refusal here must not cost the student any time.
     * Throws a machine-readable refusal; returns quietly otherwise (also when the layer does not apply).
     */
    public function preflight(User $user, string $surface, Request $request): void
    {
        if (! Profiles::enabledFor($surface)) {
            return;
        }

        $profile = Profiles::forSurface($surface);

        $admit = NetworkIntel::admits($request->ip(), $this->collegeRanges($user->college_id));
        if (! $admit['ok']) {
            $this->refuse(403, 'network_not_allowed', $admit['reason'] === 'blocked_range'
                ? 'This network is not allowed for proctored attempts.'
                : 'Proctored attempts can only be taken from the exam network. Connect to your college network and try again.');
        }

        if ($profile['guardian'] === 'off') {
            return;
        }

        $link = $this->guardians->activeLinkFor($user);
        $fresh = $link?->isFresh() ?? false;

        if ($profile['guardian'] === 'required' && ! $fresh) {
            $this->refuse(428, 'guardian_required', 'Open the AptRun Guardian on this computer and keep it running to take this attempt.');
        }

        if ($fresh) {
            $blockers = $this->guardians->blockers($link);
            if ($blockers !== []) {
                $this->refuse(422, 'preflight_failed', 'Fix the items below, then start again.', ['blockers' => $blockers]);
            }
        }
    }

    /**
     * @param  array<string, mixed>  $input  the `integrity` object the page sent with proctoring/start
     * @return array<string, mixed>|null null when the layer does not apply to this surface (master switch off, campus without cameras)
     */
    public function attach(User $user, string $surface, Model $record, array $input, Request $request): ?array
    {
        if (! Profiles::enabledFor($surface)) {
            return null;
        }

        $adapter = Surface::for($surface);
        abort_unless($adapter->ownerId($record) === $user->id, 404);

        $profile = Profiles::forSurface($surface);
        $ip = $request->ip();
        $existing = IntegritySession::where('surface', $surface)->where('surface_id', $record->id)->first();

        // A refused resume (back on a network that is not allowed) is part of the attempt's story.
        if ($existing !== null) {
            $admit = NetworkIntel::admits($ip, $this->collegeRanges($user->college_id));
            if (! $admit['ok']) {
                $this->recordServerEvent($existing, 'network_not_allowed', ['ip' => $ip, 'reason' => $admit['reason'], 'at' => 'resume']);
            }
        }

        $this->preflight($user, $surface, $request);
        $link = $profile['guardian'] === 'off' ? null : $this->guardians->activeLinkFor($user);
        $guardianFresh = $link?->isFresh() ?? false;

        // Create or resume.
        $instance = $this->cleanToken($input['instance'] ?? null, 8, 64) ?? Str::random(24);
        $fp = $this->cleanToken($input['fp'] ?? null, 16, 64);
        $deviceId = $this->cleanToken($input['did'] ?? null, 16, 64);
        $now = now();
        $conflict = false;

        $session = DB::transaction(function () use (&$conflict, $user, $surface, $record, $profile, $request, $ip, $instance, $fp, $deviceId, $now, $guardianFresh, $link, $input, $adapter) {
            $session = IntegritySession::where('surface', $surface)->where('surface_id', $record->id)->lockForUpdate()->first();

            if ($session === null) {
                try {
                    $session = IntegritySession::create([
                        'uuid' => (string) Str::uuid(),
                        'user_id' => $user->id,
                        'surface' => $surface,
                        'surface_id' => $record->id,
                        'profile' => $profile['name'],
                        'status' => IntegritySession::STATUS_ACTIVE,
                        'assurance' => $guardianFresh ? IntegritySession::ASSURANCE_GUARDIAN : IntegritySession::ASSURANCE_WEB,
                        'context' => $this->cleanContext($input['context'] ?? []),
                        'client_instance' => $instance,
                        'device_fp' => $fp,
                        'device_id' => $deviceId,
                        'bound_ip' => $ip,
                        'last_ip' => $ip,
                        'bound_ua' => $this->uaFamily($request->userAgent()),
                        'ips' => [$ip => 1],
                        'nonce' => Str::random(32),
                        'started_at' => $now,
                        'last_beat_at' => $now,
                        'guardian_link_id' => $guardianFresh ? $link->id : null,
                        'guardian_first_at' => $guardianFresh ? $now : null,
                        'guardian_last_at' => $guardianFresh ? $now : null,
                        'page_state' => ['preflight' => $this->cleanPreflight($input['preflight'] ?? [])],
                    ]);
                } catch (QueryException) {
                    // Two tabs opened the same attempt in the same instant: the other one won the insert.
                    $session = IntegritySession::where('surface', $surface)->where('surface_id', $record->id)->lockForUpdate()->firstOrFail();

                    return $this->resume($session, $profile, $request, $ip, $instance, $fp, $deviceId, $now, $conflict, $adapter, $record);
                }

                $log = EventLog::open($session);
                $log->append('server', 'session_started', 'info', 0, 0, $now, null, array_filter([
                    'profile' => $profile['name'],
                    'assurance' => $session->assurance,
                    'ip' => $ip,
                    'ua' => $this->uaFamily($request->userAgent()),
                    'preflight' => $this->cleanPreflight($input['preflight'] ?? []),
                    'network_class' => NetworkIntel::classify($ip),
                ], fn ($v) => $v !== null && $v !== []));
                $this->commitLog($session, $log);

                $this->noteSharedDevice($session);

                return $session->fresh();
            }

            return $this->resume($session, $profile, $request, $ip, $instance, $fp, $deviceId, $now, $conflict, $adapter, $record);
        });

        if ($conflict) {
            $this->refuse(409, 'session_active_elsewhere', 'This attempt is already open on another device. Close it there first — if that device has stopped, wait about a minute and try again.');
        }

        return $this->bootstrap($session, $profile, $adapter, $record, $user);
    }

    /** @param  array<string, mixed>  $profile */
    private function resume(IntegritySession $session, array $profile, Request $request, ?string $ip, string $instance, ?string $fp, ?string $deviceId, CarbonInterface $now, bool &$conflict, Surface $adapter, Model $record): IntegritySession
    {
        $log = EventLog::open($session);
        $locked = $adapter->isLocked($record);
        $finished = $adapter->isFinished($record);

        if ($session->client_instance !== null && $session->client_instance !== $instance && ! $locked && ! $finished) {
            $sameDevice = $fp !== null && $session->device_fp !== null && hash_equals($session->device_fp, $fp);
            $stale = $session->last_beat_at === null || $session->last_beat_at->lt($now->copy()->subSeconds((int) $profile['stale_after']));

            if (! $sameDevice && ! $stale && ! $session->isEnded()) {
                // A second device reaching for an attempt whose first device is still reporting. Refuse the newcomer and say so in the log.
                $log->append('server', 'instance_conflict', 'high', 0, EventCatalog::weight('instance_conflict'), $now, null, ['ip' => $ip, 'ua' => $this->uaFamily($request->userAgent())]);
                $this->commitLog($session, $log, ['flags' => $this->bumpFlags($session, ['instance_conflict'])]);
                $conflict = true;

                return $session;
            }

            $log->append('server', $sameDevice ? 'instance_replaced' : 'device_changed', $sameDevice ? 'info' : 'high', 0, $sameDevice ? 0 : EventCatalog::weight('device_changed'), $now, null, ['ip' => $ip, 'ua' => $this->uaFamily($request->userAgent())]);
            $session->flags = $this->bumpFlags($session, [$sameDevice ? 'instance_replaced' : 'device_changed']);
            $session->last_batch_id = 0;
            $session->client_instance = $instance;
            if ($fp !== null) {
                $session->device_fp = $fp;
            }
            if ($deviceId !== null) {
                $session->device_id = $deviceId;
            }
        } else {
            $log->append('server', 'session_resumed', 'info', 0, 0, $now, null, ['ip' => $ip]);
            $session->client_instance = $instance;
            $session->device_fp ??= $fp;
            $session->device_id ??= $deviceId;
        }

        if ($session->isEnded() && ! $finished) {
            $session->ended_at = null;
        }

        if ($ip !== $session->last_ip) {
            $this->noteIpChange($session, $log, $ip, $now);
        }

        $session->status = $locked ? IntegritySession::STATUS_LOCKED : IntegritySession::STATUS_ACTIVE;
        $session->nonce_prev = $session->nonce;
        $session->nonce = Str::random(32);
        $session->last_beat_at = $now;
        $this->commitLog($session, $log);

        return $session->fresh();
    }

    /** @param  array<string, mixed>  $profile */
    private function bootstrap(IntegritySession $session, array $profile, Surface $adapter, Model $record, User $user): array
    {
        $link = $profile['guardian'] === 'off' ? null : $this->guardians->activeLinkFor($user);

        return [
            'id' => $session->uuid,
            'nonce' => $session->nonce,
            'next_batch_id' => $session->last_batch_id + 1,
            'status' => $session->status,
            'assurance' => $session->assurance,
            'marker' => self::markerFor($session),
            'policy' => Profiles::clientPolicy($profile),
            'guardian' => $this->guardians->summary($user, $profile, $link),
            'session' => $adapter->payload($record),
            'server_time_ms' => $this->nowMs(),
        ];
    }

    // ── a telemetry batch from the page ─────────────────────────────────────────────────────────────────────────────

    /**
     * @param  array<string, mixed>  $batch  already validated by IntegrityController
     * @return array{0: int, 1: array<string, mixed>} [http status, body]
     */
    public function ingestWeb(string $uuid, User $user, array $batch, Request $request): array
    {
        return DB::transaction(function () use ($uuid, $user, $batch, $request) {
            /** @var IntegritySession|null $s */
            $s = IntegritySession::where('uuid', $uuid)->lockForUpdate()->first();

            if ($s === null || $s->user_id !== $user->id) {
                return [404, ['message' => 'Unknown proctoring session.', 'code' => 'unknown_session']];
            }

            $adapter = Surface::for($s->surface);
            $record = $adapter->find($s->surface_id);
            if ($record === null) {
                return [404, ['message' => 'Unknown proctoring session.', 'code' => 'unknown_session']];
            }

            $profile = Profiles::named($s->profile);
            $now = now();

            if ($s->isEnded()) {
                return [200, $this->ack($s, $adapter, $record)];
            }

            // Only the newest page instance may report. The old tab is told to stand down.
            if (! hash_equals((string) $s->client_instance, (string) ($batch['instance'] ?? ''))) {
                return [409, ['message' => 'This attempt was opened in another tab or device.', 'code' => 'superseded']];
            }

            $batchId = (int) ($batch['batch_id'] ?? 0);
            if ($batchId <= $s->last_batch_id) {
                // A retry of a batch whose answer got lost: acknowledge it again, ingest nothing twice.
                return [200, $this->ack($s, $adapter, $record, duplicate: true)];
            }

            $log = EventLog::open($s);
            $nonce = (string) ($batch['nonce'] ?? '');
            if (! hash_equals((string) $s->nonce, $nonce) && ! hash_equals((string) $s->nonce_prev, $nonce)) {
                $log->append('server', 'replay_suspected', 'high', 0, EventCatalog::weight('replay_suspected'), $now, null, ['batch_id' => $batchId]);
                $this->commitLog($s, $log, ['flags' => $this->bumpFlags($s, ['replay_suspected'])]);

                return [409, ['message' => 'Proctoring session out of sync. Reconnecting…', 'code' => 'bad_nonce']];
            }

            $locked = $adapter->isLocked($record);
            $finished = $adapter->isFinished($record);
            $inactive = $locked || $finished;

            /** @var list<array<string, mixed>> $pending */
            $pending = [];

            // ── Server-derived findings first ────────────────────────────────────────────────────────────────────
            if ($s->last_batch_id > 0 && $batchId > $s->last_batch_id + 1) {
                $pending[] = $this->serverEvent('batch_gap', ['missing' => $batchId - $s->last_batch_id - 1], $now);
            }

            $gap = $s->last_beat_at ? max(0, $now->getTimestamp() - $s->last_beat_at->getTimestamp()) : 0;
            if (! $inactive && $gap > (int) config('integrity.gap.tolerance_seconds', 45)) {
                $before = (int) $s->gap_seconds;
                $s->gap_seconds = $before + $gap;
                $s->gap_count++;
                $budget = (int) config('integrity.gap.budget_seconds', 300);
                $overBudget = $before <= $budget && $s->gap_seconds > $budget;
                $strike = ($gap >= (int) config('integrity.gap.single_strike_seconds', 150) || $overBudget) ? 1 : 0;
                $pending[] = $this->serverEvent('telemetry_gap', ['seconds' => $gap, 'total_seconds' => $s->gap_seconds, 'count' => $s->gap_count], $now, strike: $strike);
            }

            $nowMs = $this->nowMs();
            $clientNow = (int) ($batch['t'] ?? 0);
            if ($clientNow > 0) {
                $offset = $nowMs - $clientNow;
                if ($s->clock_offset_ms === null) {
                    $s->clock_offset_ms = $offset;
                } elseif (abs($offset - $s->clock_offset_ms) > 30_000) {
                    $pending[] = $this->serverEvent('clock_tamper', ['jump_ms' => $offset - $s->clock_offset_ms], $now);
                    $s->clock_offset_ms = $offset;
                }
            }

            $ip = $request->ip();
            if ($ip !== $s->last_ip) {
                $change = $this->ipChangeEvents($s, $ip, $now);
                array_push($pending, ...$change);
            }

            $family = $this->uaFamily($request->userAgent());
            if ($s->bound_ua !== null && $family !== null && $family !== $s->bound_ua) {
                $pending[] = $this->serverEvent('ua_changed', ['from' => $s->bound_ua, 'to' => $family], $now);
                $s->bound_ua = $family;
            }

            $fp = $this->cleanToken($batch['fp'] ?? null, 16, 64);
            if ($fp !== null && $s->device_fp !== null && ! hash_equals($s->device_fp, $fp)) {
                $pending[] = $this->serverEvent('device_changed', ['from' => substr($s->device_fp, 0, 12), 'to' => substr($fp, 0, 12)], $now);
                $s->device_fp = $fp;
            }

            // The address the page can see for itself (WebRTC) against the one this request came from: a proxy or VPN in the
            // middle shows up as two different public addresses.
            $netEvent = $this->webrtcCheck($s, (array) ($batch['net'] ?? []), $ip, $now);
            if ($netEvent !== null) {
                $pending[] = $netEvent;
            }

            // ── What the page reported ───────────────────────────────────────────────────────────────────────────
            $forged = [];
            $unknown = 0;
            $lastWebAway = null;

            foreach (array_slice((array) ($batch['events'] ?? []), 0, 60) as $raw) {
                if (! is_array($raw)) {
                    continue;
                }
                $type = (string) ($raw['type'] ?? '');
                if (! EventCatalog::exists($type)) {
                    $unknown++;

                    continue;
                }
                if (! EventCatalog::allows($type, EventCatalog::SOURCE_WEB)) {
                    $forged[] = $type;

                    continue;
                }

                $clientAt = isset($raw['t']) && is_numeric($raw['t']) ? Carbon::createFromTimestampMs((int) $raw['t']) : null;
                $occurred = $this->occurredAt($clientAt, $s->clock_offset_ms, $now, $s->last_beat_at);
                $data = is_array($raw['data'] ?? null) ? $raw['data'] : [];

                $pending[] = [
                    'source' => EventCatalog::SOURCE_WEB,
                    'type' => $type,
                    'data' => $data,
                    'occurred' => $occurred,
                    'client_at' => $clientAt,
                    'strike' => null,
                ];

                if (in_array($type, ['tab_switch', 'fullscreen_exit', 'window_blur', 'focus_lost'], true)) {
                    $lastWebAway = $occurred;
                }
            }

            if ($forged !== [] || $unknown > 0) {
                // The page tried to send something only the server or the Guardian may say, or something that does not exist.
                $pending[] = $this->serverEvent('tamper_detected', ['forged_types' => array_values(array_unique($forged)), 'unknown_events' => $unknown], $now, strike: 1);
            }

            usort($pending, fn (array $a, array $b) => $a['occurred']->getTimestampMs() <=> $b['occurred']->getTimestampMs());

            $newStrikes = $this->process($s, $record, $adapter, $profile, $log, $pending, $inactive, $ip, (array) ($batch['ctx'] ?? []), $now, $locked);

            // ── The page's own state, and the cross-check against the operating system ───────────────────────────
            $state = $s->page_state ?? [];
            $state = array_merge($state, ['page' => $this->cleanState($batch['state'] ?? []), 'page_at' => $now->toIso8601String()]);
            if ($lastWebAway !== null) {
                $state['last_web_away'] = $lastWebAway->getTimestamp();
            }
            $s->page_state = $state;

            if (! $locked) {
                $locked = $this->guardianCrossCheck($s, $record, $adapter, $profile, $log, $now, $ip, (array) ($batch['ctx'] ?? []));
            }

            if (! $locked && ! $inactive) {
                $locked = $this->guardianGapCheck($s, $record, $adapter, $profile, $log, $now, $ip, (array) ($batch['ctx'] ?? []));
            }

            $record = $adapter->find($s->surface_id) ?? $record;
            if ($adapter->isLocked($record) && ! $locked) {
                $locked = true;
            }

            $s->last_batch_id = $batchId;
            $s->last_beat_at = $now;
            $s->nonce_prev = $s->nonce;
            $s->nonce = Str::random(32);
            $s->status = $locked ? IntegritySession::STATUS_LOCKED : IntegritySession::STATUS_ACTIVE;
            $this->commitLog($s, $log);

            return [200, $this->ack($s, $adapter, $record, strikes: $newStrikes)];
        });
    }

    /**
     * Turns pending findings into log rows and strikes. Shared by the page and the Guardian paths.
     *
     * @param  array<string, mixed>  $profile
     * @param  list<array<string, mixed>>  $pending
     * @param  array<string, mixed>  $ctx
     * @return list<array{type: string, count: int}> the strikes that landed (for the page's warning toast)
     */
    private function process(IntegritySession $s, Model &$record, Surface $adapter, array $profile, EventLog $log, array $pending, bool $inactive, ?string $ip, array $ctx, CarbonInterface $now, bool &$locked): array
    {
        $flagsToBump = [];
        $strikeQueue = [];
        $window = (int) config('integrity.incident_window_seconds', 4);
        $kept = 0;

        foreach ($pending as $item) {
            $type = $item['type'];
            $data = $item['data'];
            $resolved = EventCatalog::resolve($type, $data, $profile);
            $strike = $item['strike'] ?? $resolved['strike'];
            $strike = (int) $strike;

            // A finished or locked attempt keeps a record of anything serious, but nothing more can cost a strike.
            if ($inactive) {
                $strike = 0;
                if (! in_array($resolved['severity'], ['high', 'critical'], true) || ++$kept > 5) {
                    continue;
                }
            }

            // One real-world incident costs one strike: fullscreen exit + tab switch + OS focus change are the same walk-away.
            if ($strike > 0 && EventCatalog::incidentClass($type) === EventCatalog::CLASS_AWAY) {
                $last = $s->last_incident_at;
                if ($last !== null && abs($item['occurred']->getTimestamp() - $last->getTimestamp()) < $window) {
                    $strike = 0;
                    $data['merged_into_incident'] = true;
                } else {
                    $s->last_incident_at = $item['occurred'];
                }
            }

            $log->append($item['source'], $type, $resolved['severity'], $strike, $resolved['weight'], $item['occurred'], $item['client_at'], $data);
            $flagsToBump[] = $type;

            if ($strike > 0) {
                $strikeQueue[] = ['type' => $type, 'data' => $data, 'strike' => $strike];
            } elseif (in_array($resolved['severity'], ['high', 'critical'], true) && ! $inactive) {
                // Mirrored (with 0 strikes) so the existing review screens, which read the surface's own table, show it too.
                $strikeQueue[] = ['type' => $type, 'data' => $data, 'strike' => 0];
            }
        }

        $landed = [];
        foreach ($strikeQueue as $q) {
            if ($locked) {
                break;
            }
            $meta = $q['data'] + ['via' => 'integrity'];
            if ($q['strike'] === 0) {
                $record = $adapter->note($record, $q['type'], $ip, $meta, $ctx);

                continue;
            }

            $result = $adapter->strike($record, $q['type'], $ip, $meta, $ctx, $q['strike']);
            $record = $result['record'];
            $landed[] = ['type' => $q['type'], 'count' => (int) $record->violation_count];

            if ($result['locked'] || $adapter->isLocked($record)) {
                $locked = true;
                $log->append('server', 'attempt_locked', 'critical', 0, 0, $now, null, ['cause' => $q['type'], 'strikes' => (int) $record->violation_count]);
                $flagsToBump[] = 'attempt_locked';
            }
        }

        if ($flagsToBump !== []) {
            $s->flags = $this->bumpFlags($s, $flagsToBump);
        }

        return $landed;
    }

    // ── gate ────────────────────────────────────────────────────────────────────────────────────────────────────────

    /**
     * Called by every endpoint that accepts an answer / run / submit. `$record` is the surface's own proctoring record
     * (null when the student never started proctoring — a curl script, a skipped consent screen).
     */
    public function gate(string $surface, ?Model $record, User $user): void
    {
        if (! Profiles::enabledFor($surface) || ! config('integrity.enforce', true)) {
            return;
        }

        $adapter = Surface::for($surface);

        // An attempt that is already locked or finished is handled by the surface's own checks.
        if ($record !== null && ($adapter->isLocked($record) || $adapter->isFinished($record))) {
            return;
        }

        if ($record === null) {
            $this->refuse(428, 'proctoring_required', 'Allow the camera and fullscreen to begin this proctored attempt.');
        }

        $s = IntegritySession::where('surface', $surface)->where('surface_id', $record->id)->first();
        if ($s === null || $s->isEnded()) {
            $this->refuse(428, 'integrity_required', 'Proctoring has not started for this attempt. Reload the page and allow the camera and fullscreen.');
        }

        $profile = Profiles::named($s->profile);
        $stale = $s->last_beat_at === null || $s->last_beat_at->lt(now()->subSeconds((int) $profile['stale_after']));
        if ($stale) {
            $this->refuse(423, 'integrity_signal_lost', 'We lost your proctoring signal. Keep this tab open and online — it reconnects on its own, then you can carry on.');
        }

        if (Profiles::guardianRequired($profile)) {
            $link = $this->guardians->activeLinkFor($user);
            if ($link === null || ! $link->isFresh()) {
                $this->refuse(423, 'guardian_signal_lost', 'The AptRun Guardian stopped reporting. Reopen it, then carry on.');
            }
        }
    }

    // ── the Guardian's channel ──────────────────────────────────────────────────────────────────────────────────────

    /**
     * One beat from the Guardian (already authenticated and signature-checked by GuardianController). Updates the
     * student's link, and writes what it saw into every attempt of theirs that is open.
     *
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    public function ingestGuardian(GuardianLink $link, array $body, Request $request): array
    {
        $now = now();
        $ip = $request->ip();
        $state = $this->guardians->cleanState($body['state'] ?? []);
        $events = array_slice((array) ($body['events'] ?? []), 0, 80);

        $link->forceFill(['last_beat_at' => $now, 'last_seq' => (int) ($body['seq'] ?? $link->last_seq), 'state' => $state])->save();
        $link->install?->forceFill(['last_seen_at' => $now])->save();

        $sessions = IntegritySession::where('user_id', $link->user_id)->where('status', IntegritySession::STATUS_ACTIVE)->pluck('id');
        $marker = '';

        foreach ($sessions as $id) {
            DB::transaction(function () use ($id, $link, $state, $events, $body, $now, $ip, &$marker) {
                /** @var IntegritySession|null $s */
                $s = IntegritySession::whereKey($id)->lockForUpdate()->first();
                if ($s === null || ! $s->isActive()) {
                    return;
                }

                $adapter = Surface::for($s->surface);
                $record = $adapter->find($s->surface_id);
                if ($record === null) {
                    return;
                }

                $profile = Profiles::named($s->profile);
                if ($profile['guardian'] === 'off') {
                    return;
                }

                $locked = $adapter->isLocked($record);
                $inactive = $locked || $adapter->isFinished($record);
                $marker = $marker !== '' ? $marker : self::markerFor($s);
                $log = EventLog::open($s);
                $pending = [];

                // Coming back after silence: account for the gap and, when it is long enough, make it cost something.
                if ($s->guardian_last_at !== null && ! $inactive) {
                    $gap = $now->getTimestamp() - $s->guardian_last_at->getTimestamp();
                    if ($gap > (int) config('integrity.guardian.stale_after', 30) * 2) {
                        $s->guardian_gap_seconds += $gap;
                        $strike = $gap >= (int) config('integrity.gap.single_strike_seconds', 150) ? 1 : 0;
                        $pending[] = $this->serverEvent('guardian_gap', ['seconds' => $gap, 'total_seconds' => $s->guardian_gap_seconds], $now, strike: $strike);
                    }
                }

                if ($s->guardian_link_id !== $link->id) {
                    $s->guardian_link_id = $link->id;
                    $pending[] = $this->serverEvent('guardian_paired', ['version' => $state['version'] ?? null, 'build' => isset($state['exe_sha256']) ? substr((string) $state['exe_sha256'], 0, 12) : null], $now);
                }
                $s->guardian_first_at ??= $now;
                $s->guardian_last_at = $now;
                $s->assurance = IntegritySession::ASSURANCE_GUARDIAN;

                foreach ($events as $raw) {
                    if (! is_array($raw)) {
                        continue;
                    }
                    $type = (string) ($raw['type'] ?? '');
                    if (! EventCatalog::allows($type, EventCatalog::SOURCE_GUARDIAN)) {
                        continue;
                    }
                    $clientAt = isset($raw['t']) && is_numeric($raw['t']) ? Carbon::createFromTimestampMs((int) $raw['t']) : null;
                    $pending[] = [
                        'source' => EventCatalog::SOURCE_GUARDIAN,
                        'type' => $type,
                        'data' => is_array($raw['data'] ?? null) ? $raw['data'] : [],
                        'occurred' => $this->occurredAt($clientAt, null, $now, $now->copy()->subMinutes(2)),
                        'client_at' => $clientAt,
                        'strike' => null,
                    ];

                    // An away from the exam window the page has not (yet) confirmed: the cross-check settles it on a later page beat.
                    if (in_array($type, ['os_foreground_away', 'os_exam_window_missing'], true)) {
                        $page = $s->page_state ?? [];
                        $since = (int) (($raw['data']['since'] ?? null) ?: $now->getTimestamp());
                        $page['pending_away'] = ['since' => $since, 'expires' => $now->getTimestamp() + (int) $profile['beat_interval'] + 10];
                        $s->page_state = $page;
                    }
                }

                usort($pending, fn (array $a, array $b) => $a['occurred']->getTimestampMs() <=> $b['occurred']->getTimestampMs());

                $this->process($s, $record, $adapter, $profile, $log, $pending, $inactive, $ip, [], $now, $locked);

                if (! $locked) {
                    $locked = $this->guardianHostCheck($s, $record, $adapter, $profile, $log, $now, $ip, $state);
                }

                $record = $adapter->find($s->surface_id) ?? $record;
                $s->status = ($locked || $adapter->isLocked($record)) ? IntegritySession::STATUS_LOCKED : IntegritySession::STATUS_ACTIVE;
                $this->commitLog($s, $log);
            });
        }

        return [
            'ok' => true,
            'seq' => (int) ($body['seq'] ?? 0),
            'marker' => $marker,
            'exam_active' => $sessions->isNotEmpty(),
            'server_time_ms' => $this->nowMs(),
            'policy_version' => $this->guardians->policyVersion(),
        ];
    }

    /**
     * The Guardian reported the foreground window leaving the exam; the page must have noticed too. If the page stays
     * silent past the deadline, the page is lying or has been tampered with — the strongest signal there is.
     *
     * @param  array<string, mixed>  $profile
     * @param  array<string, mixed>  $ctx
     */
    private function guardianCrossCheck(IntegritySession $s, Model $record, Surface $adapter, array $profile, EventLog $log, CarbonInterface $now, ?string $ip, array $ctx): bool
    {
        $page = $s->page_state ?? [];
        $pending = $page['pending_away'] ?? null;
        if (! is_array($pending) || $now->getTimestamp() < (int) ($pending['expires'] ?? 0)) {
            return false;
        }

        unset($page['pending_away']);
        $s->page_state = $page;

        $seen = (int) ($page['last_web_away'] ?? 0);
        if ($seen >= (int) $pending['since'] - 5) {
            return false; // the page reported it too — both witnesses agree
        }

        $list = [$this->serverEvent('guardian_page_mismatch', ['guardian_saw_away_at' => (int) $pending['since'], 'page_reported' => $seen ?: null], $now)];
        $locked = false;
        $this->process($s, $record, $adapter, $profile, $log, $list, false, $ip, $ctx, $now, $locked);

        return $locked;
    }

    /**
     * The Guardian and the page must be on the SAME machine. Screen size, timezone and network address are compared;
     * agreement on any two of three differing is the signature of a clean helper machine standing in for the real one.
     *
     * @param  array<string, mixed>  $profile
     * @param  array<string, mixed>  $state  the guardian's cleaned state
     */
    private function guardianHostCheck(IntegritySession $s, Model $record, Surface $adapter, array $profile, EventLog $log, CarbonInterface $now, ?string $guardianIp, array $state): bool
    {
        $page = $s->page_state['page'] ?? null;
        if (! is_array($page)) {
            return false;
        }

        $signals = [];

        $sw = (float) ($page['sw'] ?? 0) * (float) ($page['dpr'] ?? 1);
        $sh = (float) ($page['sh'] ?? 0) * (float) ($page['dpr'] ?? 1);
        $mw = (float) ($state['monitors']['primary']['w'] ?? 0);
        $mh = (float) ($state['monitors']['primary']['h'] ?? 0);
        if ($sw > 0 && $mw > 0 && $mh > 0) {
            $close = fn (float $a, float $b) => abs($a - $b) / max($a, $b) <= 0.04;
            if (! (($close($sw, $mw) && $close($sh, $mh)) || ($close($sw, $mh) && $close($sh, $mw)))) {
                $signals[] = 'screen';
            }
        }

        $tzPage = (string) ($page['tz'] ?? '');
        $tzGuardian = (string) ($state['tz'] ?? '');
        if ($tzPage !== '' && $tzGuardian !== '' && $tzPage !== $tzGuardian && ! $this->sameOffset($tzPage, $tzGuardian)) {
            $signals[] = 'timezone';
        }

        $webIp = $s->last_ip;
        if ($webIp && $guardianIp && (str_contains($webIp, ':') === str_contains($guardianIp, ':')) && $webIp !== $guardianIp) {
            $signals[] = 'address';
        }

        if (count($signals) < 1) {
            return false;
        }

        // Debounce: report once per attempt per signature, so a long attempt does not fill the log.
        $page2 = $s->page_state ?? [];
        $signature = implode('+', $signals);
        if (($page2['host_mismatch_logged'] ?? null) === $signature) {
            return false;
        }
        $page2['host_mismatch_logged'] = $signature;
        $s->page_state = $page2;

        $strike = count($signals) >= 2 ? EventCatalog::STRIKE_LOCK : 0;
        $list = [$this->serverEvent('guardian_host_mismatch', ['signals' => $signals, 'guardian_ip' => $guardianIp, 'page_ip' => $webIp], $now, strike: $strike)];
        $locked = false;
        $this->process($s, $record, $adapter, $profile, $log, $list, false, $guardianIp, [], $now, $locked);

        return $locked;
    }

    /**
     * The page's beat is also the moment to notice that the Guardian — once present — has gone quiet.
     *
     * @param  array<string, mixed>  $profile
     * @param  array<string, mixed>  $ctx
     */
    private function guardianGapCheck(IntegritySession $s, Model $record, Surface $adapter, array $profile, EventLog $log, CarbonInterface $now, ?string $ip, array $ctx): bool
    {
        if ($s->guardian_last_at === null) {
            return false;
        }

        $quiet = $now->getTimestamp() - $s->guardian_last_at->getTimestamp();
        $page = $s->page_state ?? [];
        $open = ! empty($page['guardian_gap_open']);

        if ($quiet > (int) config('integrity.guardian.stale_after', 30) * 2 && ! $open) {
            $page['guardian_gap_open'] = true;
            $s->page_state = $page;
            $list = [$this->serverEvent('guardian_gap', ['seconds' => $quiet, 'state' => 'lost'], $now)];
            $locked = false;
            $this->process($s, $record, $adapter, $profile, $log, $list, false, $ip, $ctx, $now, $locked);

            return $locked;
        }

        if ($quiet <= (int) config('integrity.guardian.stale_after', 30) && $open) {
            $page['guardian_gap_open'] = false;
            $s->page_state = $page;
        }

        return false;
    }

    // ── evidence, ending, reading ───────────────────────────────────────────────────────────────────────────────────

    /** Ends the integrity session for an attempt the surface has finished (submitted, completed, closed). Idempotent. */
    public function endFor(string $surface, int $surfaceId, string $reason = 'completed'): void
    {
        $s = IntegritySession::where('surface', $surface)->where('surface_id', $surfaceId)->where('status', '!=', IntegritySession::STATUS_ENDED)->first();
        if ($s !== null) {
            $this->end($s, $reason);
        }
    }

    public function end(IntegritySession $s, string $reason = 'completed'): void
    {
        DB::transaction(function () use ($s, $reason) {
            $s = IntegritySession::whereKey($s->id)->lockForUpdate()->first();
            if ($s === null || $s->isEnded()) {
                return;
            }

            $log = EventLog::open($s);
            $log->append('server', 'session_ended', 'info', 0, 0, now(), null, ['reason' => $reason]);
            $s->status = IntegritySession::STATUS_ENDED;
            $s->ended_at = now();
            $this->commitLog($s, $log);
        });
    }

    /** Records one server-side finding outside of a batch (e.g. an address refused at resume). */
    public function recordServerEvent(IntegritySession $s, string $type, array $data = []): void
    {
        DB::transaction(function () use ($s, $type, $data) {
            $s = IntegritySession::whereKey($s->id)->lockForUpdate()->first();
            if ($s === null) {
                return;
            }

            $log = EventLog::open($s);
            $resolved = EventCatalog::resolve($type, $data, Profiles::named($s->profile));
            $log->append('server', $type, $resolved['severity'], 0, $resolved['weight'], now(), null, $data);
            $this->commitLog($s, $log, ['flags' => $this->bumpFlags($s, [$type])]);
        });
    }

    // ── risk ────────────────────────────────────────────────────────────────────────────────────────────────────────

    /**
     * @param  array<string, int>  $flags  type => how many times
     * @return array{score: int, level: string}
     */
    public static function risk(array $flags, bool $locked = false): array
    {
        $cap = (int) config('integrity.risk.type_cap_multiplier', 5);
        $score = 0;

        foreach ($flags as $type => $count) {
            $weight = EventCatalog::weight((string) $type);
            if ($weight > 0) {
                $score += min((int) $count * $weight, $weight * $cap);
            }
        }

        $levels = (array) config('integrity.risk.levels', []);
        $level = 'low';
        foreach (['medium', 'high', 'critical'] as $name) {
            if ($score >= (int) ($levels[$name] ?? PHP_INT_MAX)) {
                $level = $name;
            }
        }

        if ($locked && in_array($level, ['low', 'medium'], true)) {
            $level = 'high';
        }

        return ['score' => $score, 'level' => $level];
    }

    public static function markerFor(IntegritySession $s): string
    {
        return strtoupper(substr(str_replace('-', '', $s->uuid), 0, 6));
    }

    // ── internals ───────────────────────────────────────────────────────────────────────────────────────────────────

    /** @param  list<string>  $types */
    private function bumpFlags(IntegritySession $s, array $types): array
    {
        $flags = $s->flags ?? [];
        foreach ($types as $type) {
            $flags[$type] = (int) ($flags[$type] ?? 0) + 1;
        }

        return $flags;
    }

    /** Flushes the log and writes the session row (head, count, risk) in one go. @param  array<string, mixed>  $extra */
    private function commitLog(IntegritySession $s, EventLog $log, array $extra = []): void
    {
        $written = $log->flush();
        $s->fill($extra);
        $s->event_count = $written['count'];
        $s->chain_head = $written['head'];

        $risk = self::risk($s->flags ?? [], $s->status === IntegritySession::STATUS_LOCKED);
        $s->risk_score = $risk['score'];
        $s->risk_level = $risk['level'];
        $s->save();
    }

    /** @return array<string, mixed> */
    private function ack(IntegritySession $s, Surface $adapter, Model $record, array $strikes = [], bool $duplicate = false): array
    {
        $guardian = null;
        if ($s->guardian_last_at !== null) {
            $guardian = [
                'connected' => true,
                'fresh' => $s->guardian_last_at->gt(now()->subSeconds((int) config('integrity.guardian.stale_after', 30) * 2)),
            ];
        }

        return [
            'ack' => $s->last_batch_id,
            'nonce' => $s->nonce,
            'status' => $s->status,
            'locked' => $adapter->isLocked($record),
            'session' => $adapter->payload($record),
            'strikes' => $strikes,
            'guardian' => $guardian,
            'duplicate' => $duplicate,
            'server_time_ms' => $this->nowMs(),
        ];
    }

    /** @param  array<string, mixed>  $data */
    private function serverEvent(string $type, array $data, CarbonInterface $now, ?int $strike = null): array
    {
        return ['source' => EventCatalog::SOURCE_SERVER, 'type' => $type, 'data' => $data, 'occurred' => $now->copy(), 'client_at' => null, 'strike' => $strike];
    }

    /**
     * @param  array<string, mixed>  $net  what the page's WebRTC probe saw: srflx = public addresses a STUN server saw, host = local ones
     * @return array<string, mixed>|null a webrtc_ip_mismatch finding, once per distinct pair
     */
    private function webrtcCheck(IntegritySession $s, array $net, ?string $httpIp, CarbonInterface $now): ?array
    {
        $valid = fn (mixed $list) => collect(is_array($list) ? $list : [])
            ->filter(fn ($v) => is_string($v) && filter_var($v, FILTER_VALIDATE_IP) !== false)
            ->unique()->take(6)->values()->all();

        $srflx = $valid($net['srflx'] ?? []);
        $host = $valid($net['host'] ?? []);

        $page = $s->page_state ?? [];
        if ($srflx !== [] || $host !== []) {
            $page['net'] = ['srflx' => $srflx, 'host' => $host];
            $s->page_state = $page;
        }

        if ($httpIp === null || $srflx === []) {
            return null;
        }

        $sameFamily = array_values(array_filter($srflx, fn (string $a) => str_contains($a, ':') === str_contains($httpIp, ':')));
        if ($sameFamily === [] || in_array($httpIp, $sameFamily, true)) {
            return null;
        }

        $signature = md5(implode(',', $sameFamily).'|'.$httpIp);
        if (($page['net_logged'] ?? null) === $signature) {
            return null;
        }
        $page['net_logged'] = $signature;
        $s->page_state = $page;

        return $this->serverEvent('webrtc_ip_mismatch', ['http' => $httpIp, 'webrtc' => $sameFamily], $now);
    }

    /** Address changed mid-attempt: record it, and check the new address is still allowed. @return list<array<string, mixed>> */
    private function ipChangeEvents(IntegritySession $s, ?string $ip, CarbonInterface $now): array
    {
        $ips = $s->ips ?? [];
        $ips[$ip ?? 'unknown'] = (int) ($ips[$ip ?? 'unknown'] ?? 0) + 1;
        $events = [$this->serverEvent('ip_changed', ['from' => $s->last_ip, 'to' => $ip, 'class' => NetworkIntel::classify($ip), 'distinct_addresses' => count($ips)], $now)];

        $admit = NetworkIntel::admits($ip, $this->collegeRanges($s->user?->college_id));
        if (! $admit['ok']) {
            $events[] = $this->serverEvent('network_not_allowed', ['ip' => $ip, 'reason' => $admit['reason']], $now, strike: 1);
        }

        $s->ips = $ips;
        $s->last_ip = $ip;

        return $events;
    }

    private function noteIpChange(IntegritySession $s, EventLog $log, ?string $ip, CarbonInterface $now): void
    {
        foreach ($this->ipChangeEvents($s, $ip, $now) as $e) {
            $resolved = EventCatalog::resolve($e['type'], $e['data'], Profiles::named($s->profile));
            $log->append('server', $e['type'], $resolved['severity'], 0, $resolved['weight'], $now, null, $e['data']);
            $s->flags = $this->bumpFlags($s, [$e['type']]);
        }
    }

    /** Two accounts active on the SAME browser profile at the same time is one person taking two attempts (or lending a login). */
    private function noteSharedDevice(IntegritySession $s): void
    {
        if ($s->device_id === null) {
            return;
        }

        $other = IntegritySession::where('device_id', $s->device_id)
            ->where('user_id', '!=', $s->user_id)
            ->where('status', IntegritySession::STATUS_ACTIVE)
            ->where('last_beat_at', '>', now()->subSeconds(120))
            ->first();

        if ($other !== null) {
            $this->recordServerEvent($s->fresh(), 'shared_device', ['other_session' => substr($other->uuid, 0, 8)]);
            $this->recordServerEvent($other, 'shared_device', ['other_session' => substr($s->uuid, 0, 8)]);
        }
    }

    /** Client time → server time, never in the future and never before the previous beat (a page cannot back-date findings). */
    private function occurredAt(?CarbonInterface $clientAt, ?int $offsetMs, CarbonInterface $now, ?CarbonInterface $floor): Carbon
    {
        if ($clientAt === null) {
            return Carbon::instance($now)->copy();
        }

        $t = Carbon::instance($clientAt)->addMilliseconds((int) $offsetMs);
        $lo = $floor !== null ? Carbon::instance($floor)->subSeconds(5) : Carbon::instance($now)->subMinutes(5);

        if ($t->gt($now)) {
            $t = Carbon::instance($now);
        }

        return $t->lt($lo) ? $lo : $t;
    }

    private function nowMs(): int
    {
        $now = now();

        return $now->getTimestamp() * 1000 + (int) $now->format('v');
    }

    /** @return list<string> */
    private function collegeRanges(?int $collegeId): array
    {
        if ($collegeId === null) {
            return [];
        }

        return array_values(array_filter((array) (College::whereKey($collegeId)->value('exam_networks') ?? [])));
    }

    /** "Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/130.0.0.0" → the same string with every version number removed. */
    private function uaFamily(?string $ua): ?string
    {
        if ($ua === null || $ua === '') {
            return null;
        }

        return mb_substr((string) preg_replace('/\d+([._]\d+)*/', '', $ua), 0, 255);
    }

    private function cleanToken(mixed $value, int $min, int $max): ?string
    {
        if (! is_string($value)) {
            return null;
        }
        $value = preg_replace('/[^A-Za-z0-9_-]/', '', $value) ?? '';

        return strlen($value) >= $min && strlen($value) <= $max ? $value : null;
    }

    /** The page's snapshot of itself: scalars only, short strings, a fixed set of keys. @return array<string, mixed> */
    private function cleanState(mixed $state): array
    {
        if (! is_array($state)) {
            return [];
        }

        $allowed = ['visible', 'focused', 'fullscreen', 'online', 'cam', 'mic', 'share', 'ai', 'w', 'h', 'dpr', 'sw', 'sh', 'tz', 'lang', 'platform', 'cores', 'mem', 'monitors', 'share_surface', 'browser', 'secure'];
        $out = [];
        foreach ($allowed as $key) {
            if (! array_key_exists($key, $state)) {
                continue;
            }
            $v = $state[$key];
            $out[$key] = is_bool($v) || is_int($v) || is_float($v) ? $v : (is_string($v) ? mb_substr($v, 0, 64) : null);
        }

        return $out;
    }

    /** What the system check looked like when the student pressed Start: check id → pending|ok|warn|fail|skipped. @return array<string, string> */
    private function cleanPreflight(mixed $summary): array
    {
        if (! is_array($summary)) {
            return [];
        }

        $out = [];
        foreach (['browser', 'tamper', 'automation', 'camera', 'mic', 'display', 'screen', 'network', 'guardian'] as $id) {
            if (isset($summary[$id]) && is_string($summary[$id]) && in_array($summary[$id], ['pending', 'working', 'ok', 'warn', 'fail', 'skipped'], true)) {
                $out[$id] = $summary[$id];
            }
        }

        return $out;
    }

    /** @return array<string, mixed> */
    private function cleanContext(mixed $context): array
    {
        if (! is_array($context)) {
            return [];
        }

        $out = [];
        foreach (['contest_problem_id', 'contest_id', 'interview_id', 'assessment_id', 'test_id', 'kind'] as $key) {
            if (isset($context[$key]) && (is_scalar($context[$key]))) {
                $out[$key] = is_numeric($context[$key]) ? (int) $context[$key] : mb_substr((string) $context[$key], 0, 40);
            }
        }

        return $out;
    }

    /** Whether two time zones are the same UTC offset right now. Accepts IANA names (the browser) and "UTC+05:30" (the Guardian). */
    private function sameOffset(string $a, string $b): bool
    {
        $x = $this->utcOffset($a);
        $y = $this->utcOffset($b);

        return $x !== null && $y !== null && $x === $y;
    }

    private function utcOffset(string $zone): ?int
    {
        if (preg_match('/^UTC([+-])(\d{2}):(\d{2})$/', $zone, $m)) {
            return ($m[1] === '-' ? -1 : 1) * ((int) $m[2] * 3600 + (int) $m[3] * 60);
        }

        try {
            return (new \DateTimeZone($zone))->getOffset(new \DateTimeImmutable('now'));
        } catch (\Throwable) {
            return null;
        }
    }

    /** @param  array<string, mixed>  $extra */
    private function refuse(int $status, string $code, string $message, array $extra = []): never
    {
        throw new HttpResponseException(response()->json(['message' => $message, 'code' => $code] + $extra, $status));
    }
}
