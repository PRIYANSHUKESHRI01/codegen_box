<?php

namespace App\Services\Workspaces;

use App\Models\ProjectTopic;
use App\Models\ProjectWorkspace;
use App\Models\ProjectWorkspaceIntegrityEvent;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Receives what the editor's authorship guard reports and keeps it, safely.
 *
 * The guard runs in the student's browser, so everything it says is a CLAIM from a place the student
 * controls. That shapes every rule here:
 *  - A report can only ADD evidence about the student's own workspace; nothing it says can clear or hide
 *    anything, and a guard that stops reporting shows up as low coverage.
 *  - Only allow-listed kinds, targets and meta keys are stored, with bounded sizes and a clamped time, so
 *    nothing odd (and no text) can ride along, and a flood cannot fill the table.
 *  - Each event has a client id, unique per workspace: a retried upload is not counted twice.
 */
class WorkspaceIntegrity
{
    public const MODE_ENFORCE = 'enforce';

    public const MODE_REPORT = 'report';

    public const MODE_OPEN = 'open';

    /**
     * What the editor's guard should do for this project. The server decides; the dashboard only relays it.
     */
    public static function modeFor(ProjectTopic $topic): string
    {
        $configured = (string) config('authorship.guard_mode', self::MODE_ENFORCE);

        if ($topic->authorship_mode === ProjectTopic::AUTHORSHIP_OPEN || $configured === 'off') {
            return self::MODE_OPEN;
        }

        return $configured === self::MODE_REPORT ? self::MODE_REPORT : self::MODE_ENFORCE;
    }

    /**
     * @param  array{v?: mixed, active?: mixed, events?: mixed}  $payload
     * @return array{accepted: int, duplicates: int, dropped: int}
     */
    public function record(ProjectWorkspace $workspace, User $user, array $payload): array
    {
        $version = $this->version($payload['v'] ?? null);
        $incoming = is_array($payload['events'] ?? null) ? array_slice($payload['events'], 0, (int) config('authorship.max_events_per_call', 50)) : [];

        $room = max(0, (int) config('authorship.max_events_per_workspace', 5000) - $workspace->integrityEvents()->count());

        $rows = [];
        foreach ($incoming as $event) {
            $row = is_array($event) ? $this->sanitize($event, $workspace, $user, $version) : null;

            if ($row !== null && count($rows) < $room) {
                $rows[$row['client_event_id']] = $row;
            }
        }

        $accepted = $rows === [] ? 0 : (int) ProjectWorkspaceIntegrityEvent::query()->insertOrIgnore(array_values($rows));

        if (! empty($payload['active'])) {
            $this->creditGuard($workspace, $version);
        }

        return [
            'accepted' => $accepted,
            'duplicates' => count($rows) - $accepted,
            'dropped' => count($incoming) - count($rows),
        ];
    }

    /**
     * The guard confirmed itself running: remember when, and credit the open session with the time since the last
     * confirmation (capped, so a long silence is not backfilled). Coverage is these seconds over the session's.
     */
    private function creditGuard(ProjectWorkspace $workspace, ?string $version): void
    {
        $now = now();
        $previous = $workspace->guard_last_seen_at;

        $credit = $previous === null
            ? (int) config('authorship.first_credit_seconds', 30)
            : min((int) config('authorship.max_credit_seconds', 90), max(0, $now->getTimestamp() - $previous->getTimestamp()));

        DB::transaction(function () use ($workspace, $now, $version, $credit) {
            $session = $workspace->sessions()->whereNull('ended_at')->latest('id')->lockForUpdate()->first();

            if ($session !== null && $credit > 0) {
                $session->increment('guard_active_seconds', $credit);
            }

            $workspace->forceFill(['guard_last_seen_at' => $now, 'guard_version' => $version])->save();
        });
    }

    /** @return array<string, mixed>|null a row ready for insert, or null when the event is not acceptable */
    private function sanitize(array $event, ProjectWorkspace $workspace, User $user, ?string $version): ?array
    {
        $id = $event['id'] ?? null;
        $kind = $event['kind'] ?? null;

        if (! is_string($id) || ! preg_match('/^[A-Za-z0-9_-]{6,40}$/', $id)) {
            return null;
        }

        if (! is_string($kind) || ! in_array($kind, (array) config('authorship.event_kinds'), true)) {
            return null;
        }

        $target = $event['target'] ?? null;
        $target = is_string($target) && in_array($target, (array) config('authorship.event_targets'), true) ? $target : null;

        $size = $event['size'] ?? null;
        $size = is_int($size) || (is_numeric($size) && ! is_string($size)) ? max(0, min(100_000_000, (int) $size)) : null;

        $meta = $this->meta($event['meta'] ?? null);

        return [
            'project_workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'client_event_id' => $id,
            'kind' => $kind,
            'size' => $size,
            'target' => $target,
            'guard_version' => $version,
            'meta' => $meta === null ? null : json_encode($meta),
            'occurred_at' => $this->time($event['t'] ?? null)->format('Y-m-d H:i:s'),
        ];
    }

    /** Only allow-listed keys, only short scalars (or a short list of short words): no free text gets in. */
    private function meta(mixed $meta): ?array
    {
        if (! is_array($meta)) {
            return null;
        }

        $allowed = (array) config('authorship.meta_keys');
        $clean = [];

        foreach ($meta as $key => $value) {
            if (! in_array($key, $allowed, true)) {
                continue;
            }

            if (is_bool($value) || is_int($value) || is_float($value)) {
                $clean[$key] = $value;
            } elseif (is_string($value) && mb_strlen($value) <= 40) {
                $clean[$key] = $value;
            } elseif (is_array($value) && array_is_list($value)) {
                $clean[$key] = array_values(array_map(
                    fn ($v) => mb_substr((string) $v, 0, 24),
                    array_slice(array_filter($value, 'is_string'), 0, 5)
                ));
            }
        }

        return $clean === [] ? null : $clean;
    }

    /** The guard's clock is the student's clock: believe it only within the last day or two, and never the future. */
    private function time(mixed $milliseconds): Carbon
    {
        $now = now();
        $oldest = $now->copy()->subHours((int) config('authorship.max_event_age_hours', 48));

        if (! is_int($milliseconds) && ! is_float($milliseconds)) {
            return $now;
        }

        $at = Carbon::createFromTimestampMs((int) $milliseconds);

        return $at->greaterThan($now) ? $now : ($at->lessThan($oldest) ? $oldest : $at);
    }

    private function version(mixed $version): ?string
    {
        return is_string($version) && preg_match('/^[0-9A-Za-z._-]{1,16}$/', $version) ? $version : null;
    }
}
