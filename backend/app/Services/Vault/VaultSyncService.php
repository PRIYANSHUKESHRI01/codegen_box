<?php

namespace App\Services\Vault;

use App\Models\VaultProfile;
use App\Models\VaultSyncEvent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The hand-off to Mellow Vault: an outbox, so a profile is never lost to an
 * outage and — the case that matters more — a student who withdrew is never
 * left listed because a request failed.
 *
 * Writing: VaultService calls queueUpsert()/queueWithdraw() in the same step as
 * the change that caused it. Delivering: `php artisan vault:sync` (every minute
 * from the scheduler — no queue worker needed) POSTs each due event, signed, to
 * VAULT_SYNC_URL. Anything that fails is retried with backoff; after the last
 * attempt it is parked as `dead`, which the admin Vault page surfaces and can
 * retry. With no URL configured nothing is sent and nothing is lost: events wait.
 *
 * Guarantees Mellow Vault can rely on (docs/readiness-and-vault.md):
 *   • every request is signed (HMAC-SHA256 over "{timestamp}.{body}");
 *   • every event has a unique id, also sent as Idempotency-Key — a retry of the
 *     same event carries the same id, so it can be applied safely twice;
 *   • each profile's events carry a rising `sequence`, and are delivered strictly
 *     in order (an event waits behind an earlier unfinished one for the same
 *     profile), so "withdraw" can never be overtaken by an older "upsert".
 */
class VaultSyncService
{
    /** Client errors that mean "this payload is wrong", where a retry cannot help. */
    private const PERMANENT_FAILURES = [400, 404, 410, 413, 422];

    /** A claimed event that has not finished after this long belongs to a crashed run, and is released. */
    private const STALE_CLAIM_MINUTES = 5;

    public function __construct(private readonly VaultPayloadBuilder $payloads) {}

    /** URL and secret both set. Without a secret nothing is ever sent — never an unsigned request. */
    public function isConfigured(): bool
    {
        return filled(config('vault.sync_url')) && filled(config('vault.sync_secret'));
    }

    // ───────────────────────────── writing the outbox ─────────────────────────────

    /**
     * Tells Mellow Vault about a listed profile, or about a change to it.
     *
     * Merges into an upsert that is still waiting rather than stacking a second
     * one, and does nothing at all when the profile is exactly what Mellow Vault
     * was last sent — so a refresh that moved no number costs nothing.
     *
     * @param  bool  $immediate  a profile appearing for the first time goes out now; an edit to one already listed waits out the debounce so a burst of edits is one update
     */
    public function queueUpsert(VaultProfile $profile, bool $immediate = false): ?VaultSyncEvent
    {
        $profile->loadMissing('user.college');

        $listing = $this->payloads->build($profile);
        $fingerprint = $this->payloads->fingerprint($listing);

        $pending = VaultSyncEvent::where('profile_public_id', $profile->public_id)
            ->where('type', VaultSyncEvent::TYPE_UPSERT)
            ->whereIn('status', [VaultSyncEvent::STATUS_PENDING, VaultSyncEvent::STATUS_FAILED])
            ->latest('id')
            ->first();

        if ($pending === null && $profile->payload_hash === $fingerprint
            && ($profile->vault_listed_at !== null || $this->hasUpsertInFlight($profile))) {
            return null;
        }

        $availableAt = $immediate ? now() : now()->addMinutes((int) config('vault.sync_debounce_minutes', 30));

        if ($pending !== null) {
            $pending->update([
                'payload' => ['profile' => $listing],
                // Measured from the first change, so a continuous trickle of edits cannot postpone delivery forever.
                'available_at' => $pending->available_at->lt($availableAt) ? $pending->available_at : $availableAt,
            ]);
            $event = $pending;
        } else {
            $event = VaultSyncEvent::create([
                'vault_profile_id' => $profile->id,
                'profile_public_id' => $profile->public_id,
                'type' => VaultSyncEvent::TYPE_UPSERT,
                'sequence' => $this->nextSequence($profile),
                'payload' => ['profile' => $listing],
                'available_at' => $availableAt,
            ]);
        }

        $profile->forceFill(['payload_hash' => $fingerprint, 'sync_state' => VaultProfile::SYNC_PENDING])->save();

        return $event;
    }

    /**
     * Tells Mellow Vault to take a profile down. If Mellow Vault was never told
     * about it (the listing is still waiting in the outbox), the waiting listing is
     * simply cancelled and nothing is sent.
     *
     * @param  string  $reason  consent_withdrawn | below_threshold | hidden_by_staff | hired | account_closed
     */
    public function queueWithdraw(VaultProfile $profile, string $reason): ?VaultSyncEvent
    {
        VaultSyncEvent::where('profile_public_id', $profile->public_id)
            ->where('type', VaultSyncEvent::TYPE_UPSERT)
            ->whereIn('status', [VaultSyncEvent::STATUS_PENDING, VaultSyncEvent::STATUS_FAILED])
            ->delete();

        $mayBeListed = $profile->vault_listed_at !== null || $this->hasUpsertInFlight($profile);

        $profile->forceFill(['payload_hash' => null])->save();

        if (! $mayBeListed) {
            $profile->forceFill(['sync_state' => VaultProfile::SYNC_IDLE])->save();

            return null;
        }

        $event = VaultSyncEvent::create([
            'vault_profile_id' => $profile->id,
            'profile_public_id' => $profile->public_id,
            'type' => VaultSyncEvent::TYPE_WITHDRAW,
            'reason' => $reason,
            'sequence' => $this->nextSequence($profile),
            'payload' => ['profile' => ['id' => $profile->public_id]],
            'available_at' => now(),
        ]);

        $profile->forceFill(['sync_state' => VaultProfile::SYNC_PENDING])->save();

        return $event;
    }

    /**
     * Account deletion. Call BEFORE the users are deleted (inside the same
     * transaction): the profile rows are about to cascade away, and the withdrawal
     * — and the scrubbing of every copy of their data still sitting in the outbox —
     * has to survive them.
     *
     * @param  array<int, int>  $userIds
     */
    public function withdrawForDeletedUsers(array $userIds): void
    {
        foreach (array_chunk($userIds, 500) as $chunk) {
            VaultProfile::whereIn('user_id', $chunk)->get()->each(function (VaultProfile $profile) {
                $this->queueWithdraw($profile, 'account_closed');

                // The outbox keeps delivered events for a while for diagnosis; a deleted person's data must not be among what it keeps.
                VaultSyncEvent::where('profile_public_id', $profile->public_id)
                    ->where('type', VaultSyncEvent::TYPE_UPSERT)
                    ->update(['payload' => ['profile' => ['id' => $profile->public_id], 'scrubbed' => true]]);
            });
        }
    }

    /** A listing that has been claimed for delivery but not yet acknowledged — Mellow Vault may already have it. */
    private function hasUpsertInFlight(VaultProfile $profile): bool
    {
        return VaultSyncEvent::where('profile_public_id', $profile->public_id)
            ->where('type', VaultSyncEvent::TYPE_UPSERT)
            ->where('status', VaultSyncEvent::STATUS_PROCESSING)
            ->exists();
    }

    private function nextSequence(VaultProfile $profile): int
    {
        // Atomic, so two writers racing on one profile can never be handed the same sequence.
        DB::table('vault_profiles')->where('id', $profile->id)->increment('sync_sequence');

        return (int) DB::table('vault_profiles')->where('id', $profile->id)->value('sync_sequence');
    }

    // ───────────────────────────── delivering ─────────────────────────────

    /**
     * Delivers what is due. Safe to run concurrently with itself (each event is
     * claimed atomically) and to run when nothing is configured (it does nothing).
     *
     * @return array{configured: bool, attempted: int, delivered: int, retrying: int, dead: int}
     */
    public function deliverDue(?int $limit = null): array
    {
        $result = ['configured' => $this->isConfigured(), 'attempted' => 0, 'delivered' => 0, 'retrying' => 0, 'dead' => 0];

        if (! $result['configured']) {
            return $result;
        }

        VaultSyncEvent::where('status', VaultSyncEvent::STATUS_PROCESSING)
            ->where('processing_at', '<', now()->subMinutes(self::STALE_CLAIM_MINUTES))
            ->update(['status' => VaultSyncEvent::STATUS_PENDING, 'processing_at' => null]);

        // At most one event per profile is ever due: a profile's later events wait behind its earlier unfinished
        // one. That rule is in the query, not applied row by row afterwards, so a pile of failing profiles
        // cannot fill the batch with events that are only going to be skipped and starve everyone else.
        $due = VaultSyncEvent::whereIn('status', [VaultSyncEvent::STATUS_PENDING, VaultSyncEvent::STATUS_FAILED])
            ->where('available_at', '<=', now())
            ->whereNotExists(fn ($earlier) => $earlier->select(DB::raw(1))
                ->from('vault_sync_events as earlier')
                ->whereColumn('earlier.profile_public_id', 'vault_sync_events.profile_public_id')
                ->whereColumn('earlier.id', '<', 'vault_sync_events.id')
                ->whereIn('earlier.status', [VaultSyncEvent::STATUS_PENDING, VaultSyncEvent::STATUS_FAILED, VaultSyncEvent::STATUS_PROCESSING]))
            ->orderBy('id')
            ->limit($limit ?? (int) config('vault.sync_batch', 50))
            ->get();

        foreach ($due as $event) {
            // Atomic claim: if another run got there first, 0 rows change and we move on.
            $claimed = VaultSyncEvent::whereKey($event->id)
                ->whereIn('status', [VaultSyncEvent::STATUS_PENDING, VaultSyncEvent::STATUS_FAILED])
                ->update(['status' => VaultSyncEvent::STATUS_PROCESSING, 'processing_at' => now()]);

            if ($claimed !== 1) {
                continue;
            }

            $result['attempted']++;

            switch ($this->deliver($event->fresh())) {
                case VaultSyncEvent::STATUS_DELIVERED:
                    $result['delivered']++;
                    break;
                case VaultSyncEvent::STATUS_DEAD:
                    $result['dead']++;
                    break;
                default:
                    $result['retrying']++;
            }
        }

        return $result;
    }

    /** @return string the event's resulting status */
    private function deliver(VaultSyncEvent $event): string
    {
        $body = json_encode($this->envelope($event), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $timestamp = (string) time();

        $statusCode = null;
        $error = null;
        $responseJson = null;

        try {
            $response = Http::timeout((int) config('vault.sync_timeout', 10))
                ->withHeaders([
                    'X-AptRun-Event-Id' => $event->uuid,
                    'X-AptRun-Event-Type' => $event->type,
                    'X-AptRun-Timestamp' => $timestamp,
                    'X-AptRun-Signature' => 'v1='.hash_hmac('sha256', $timestamp.'.'.$body, (string) config('vault.sync_secret')),
                    'Idempotency-Key' => $event->uuid,
                    'User-Agent' => 'AptRun-Vault/1',
                    'Accept' => 'application/json',
                ])
                ->withBody($body, 'application/json')
                ->post((string) config('vault.sync_url'));

            $statusCode = $response->status();

            if ($response->successful()) {
                $responseJson = $response->json();

                return $this->markDelivered($event, $statusCode, is_array($responseJson) ? $responseJson : []);
            }

            $error = 'HTTP '.$statusCode.': '.mb_substr(trim((string) $response->body()), 0, 300);
        } catch (Throwable $e) {
            $error = mb_substr($e->getMessage(), 0, 400);
        }

        return $this->markFailed($event, $statusCode, $error);
    }

    /** What Mellow Vault receives. `profile` is the whole listing for an upsert, just the id for a withdrawal. */
    private function envelope(VaultSyncEvent $event): array
    {
        return array_filter([
            'id' => $event->uuid,
            'type' => $event->type,
            'sequence' => $event->sequence,
            'occurred_at' => $event->created_at?->toIso8601String(),
            'source' => 'aptrun',
            'reason' => $event->reason,
            'profile' => $event->payload['profile'] ?? ['id' => $event->profile_public_id],
        ], fn ($v) => $v !== null);
    }

    private function markDelivered(VaultSyncEvent $event, int $statusCode, array $response): string
    {
        $event->update([
            'status' => VaultSyncEvent::STATUS_DELIVERED,
            'attempts' => $event->attempts + 1,
            'delivered_at' => now(),
            'processing_at' => null,
            'last_status_code' => $statusCode,
            'last_error' => null,
        ]);

        $profile = VaultProfile::where('public_id', $event->profile_public_id)->first();

        if ($profile !== null) {
            $stillWaiting = VaultSyncEvent::where('profile_public_id', $profile->public_id)
                ->whereIn('status', [VaultSyncEvent::STATUS_PENDING, VaultSyncEvent::STATUS_FAILED, VaultSyncEvent::STATUS_PROCESSING])
                ->exists();

            $updates = [
                'last_synced_at' => now(),
                'sync_state' => $stillWaiting ? VaultProfile::SYNC_PENDING : VaultProfile::SYNC_DELIVERED,
            ];

            if ($event->type === VaultSyncEvent::TYPE_UPSERT) {
                $updates['vault_listed_at'] = $profile->vault_listed_at ?? now();

                if (isset($response['id']) && is_scalar($response['id'])) {
                    $updates['external_id'] = mb_substr((string) $response['id'], 0, 100);
                }
            } else {
                $updates['vault_listed_at'] = null;
            }

            $profile->forceFill($updates)->save();
        }

        return VaultSyncEvent::STATUS_DELIVERED;
    }

    private function markFailed(VaultSyncEvent $event, ?int $statusCode, ?string $error): string
    {
        $attempts = $event->attempts + 1;
        $permanent = $statusCode !== null && in_array($statusCode, self::PERMANENT_FAILURES, true);
        $exhausted = $attempts >= (int) config('vault.sync_max_attempts', 8);
        $dead = $permanent || $exhausted;

        $backoff = (array) config('vault.sync_backoff_minutes', [1, 5, 15, 60]);
        $wait = (int) ($backoff[min($attempts - 1, count($backoff) - 1)] ?? 60);

        $event->update([
            'status' => $dead ? VaultSyncEvent::STATUS_DEAD : VaultSyncEvent::STATUS_FAILED,
            'attempts' => $attempts,
            'processing_at' => null,
            'available_at' => $dead ? $event->available_at : now()->addMinutes($wait),
            'last_status_code' => $statusCode,
            'last_error' => $error,
        ]);

        VaultProfile::where('public_id', $event->profile_public_id)->update(['sync_state' => VaultProfile::SYNC_FAILED]);

        if ($dead) {
            Log::error('Vault sync event gave up', [
                'event' => $event->uuid,
                'type' => $event->type,
                'attempts' => $attempts,
                'status' => $statusCode,
                'error' => $error,
            ]);
        }

        return $dead ? VaultSyncEvent::STATUS_DEAD : VaultSyncEvent::STATUS_FAILED;
    }

    // ───────────────────────────── operating it ─────────────────────────────

    /** Gives parked events another full set of attempts — after the receiving end has been fixed. */
    public function retryDead(?int $eventId = null): int
    {
        return VaultSyncEvent::where('status', VaultSyncEvent::STATUS_DEAD)
            ->when($eventId !== null, fn ($q) => $q->whereKey($eventId))
            ->update([
                'status' => VaultSyncEvent::STATUS_PENDING,
                'attempts' => 0,
                'available_at' => now(),
                'processing_at' => null,
                'last_error' => null,
            ]);
    }

    /** Removes delivered events past their retention. */
    public function prune(): int
    {
        return VaultSyncEvent::where('status', VaultSyncEvent::STATUS_DELIVERED)
            ->where('delivered_at', '<', now()->subDays((int) config('vault.sync_retention_days', 30)))
            ->delete();
    }

    /**
     * The picture the admin Vault page shows: is Mellow Vault connected, and is
     * anything stuck.
     *
     * @return array{configured: bool, url_set: bool, secret_set: bool, api_key_set: bool, pending: int, retrying: int, dead: int, delivered_24h: int, oldest_waiting_minutes: ?int}
     */
    public function health(): array
    {
        $counts = VaultSyncEvent::query()
            ->select('status')->selectRaw('COUNT(*) as n')
            ->groupBy('status')
            ->pluck('n', 'status');

        $oldest = VaultSyncEvent::whereIn('status', [VaultSyncEvent::STATUS_PENDING, VaultSyncEvent::STATUS_FAILED])->min('created_at');

        return [
            'configured' => $this->isConfigured(),
            'url_set' => filled(config('vault.sync_url')),
            'secret_set' => filled(config('vault.sync_secret')),
            'api_key_set' => filled(config('vault.api_key')),
            'pending' => (int) ($counts[VaultSyncEvent::STATUS_PENDING] ?? 0),
            'retrying' => (int) ($counts[VaultSyncEvent::STATUS_FAILED] ?? 0),
            'dead' => (int) ($counts[VaultSyncEvent::STATUS_DEAD] ?? 0),
            'delivered_24h' => VaultSyncEvent::where('status', VaultSyncEvent::STATUS_DELIVERED)->where('delivered_at', '>=', now()->subDay())->count(),
            'oldest_waiting_minutes' => $oldest !== null ? (int) now()->diffInMinutes($oldest, true) : null,
        ];
    }
}
