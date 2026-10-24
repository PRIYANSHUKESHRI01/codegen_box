<?php

namespace App\Services;

use App\Enums\NotificationCategory;
use App\Enums\NotificationType;
use App\Models\User;
use App\Models\UserNotification;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * The one way anything raises an in-app notification.
 *
 *   app(NotificationService::class)->notify($student, NotificationType::DriveLive, 'Infosys drive is live', 'Open to your branch.', ['url' => '/dashboard/drives']);
 *   app(NotificationService::class)->notifyMany(NotificationAudience::students($collegeId), …);
 *
 * Guarantees, because a notification is never worth breaking the thing that caused it:
 *
 *   • Fire-and-forget. Nothing here throws — a missing table (code deployed a moment before `migrate`), a full
 *     database or a bad argument is reported to the log and swallowed, exactly like LifecycleMailService.
 *   • Idempotent. With a `group_key`, the same person is told the same thing once however many times the event
 *     fires (a retried request, a job run twice, a webhook delivered twice).
 *   • Respectful. A person who muted a category (Settings → Notifications) is skipped — except for mandatory
 *     categories (plan, account), and blocked accounts are never written to at all.
 *   • Cheap at scale. A fan-out to a whole college, or every student, is chunked bulk INSERTs (one query per
 *     500 recipients), never one Eloquent save per person; past INLINE_LIMIT recipients use notifyManyAfterResponse().
 *   • Safe. `url` must be an in-app path (a leading "/" and no "//"), so a notification can never carry a
 *     `javascript:` or off-site link; title and body are length-capped.
 */
class NotificationService
{
    public const CHUNK = 500;

    /** Above this many recipients, callers should fan out after the response (notifyManyAfterResponse). */
    public const INLINE_LIMIT = 2000;

    /**
     * @param  array{url?: ?string, data?: array, severity?: string, group_key?: ?string, actor?: User|int|null, expires_at?: ?CarbonInterface}  $options
     */
    public function notify(User|int $to, NotificationType $type, string $title, ?string $body = null, array $options = []): bool
    {
        return $this->notifyMany([$to instanceof User ? $to->id : $to], $type, $title, $body, $options) > 0;
    }

    /**
     * @param  Builder|Collection|array<int, int|User>  $to  a users query, or ids / users
     * @return int how many notifications were actually written
     */
    public function notifyMany(Builder|Collection|array $to, NotificationType $type, string $title, ?string $body = null, array $options = []): int
    {
        try {
            $ids = $this->resolveIds($to);

            if ($ids === []) {
                return 0;
            }

            $row = $this->baseRow($type, $title, $body, $options);
            $written = 0;

            foreach (array_chunk($ids, self::CHUNK) as $chunk) {
                $written += $this->writeChunk($chunk, $type, $row, $options['group_key'] ?? null);
            }

            return $written;
        } catch (Throwable $e) {
            report($e);

            return 0;
        }
    }

    /** For an audience big enough to slow the response (a hackathon open to every student): fan out once it has been sent. */
    public function notifyManyAfterResponse(Builder|Collection|array $to, NotificationType $type, string $title, ?string $body = null, array $options = []): void
    {
        app()->terminating(fn () => $this->notifyMany($to, $type, $title, $body, $options));
    }

    /**
     * Run $work once the response has gone out — for a fan-out that has to look at every student first (who is eligible?)
     * and would otherwise hold the TPO's "Publish" click for seconds. Never throws; the work must re-check that the thing
     * it announces still stands (a request can roll back after its observers ran).
     */
    public function afterResponse(\Closure $work): void
    {
        app()->terminating(function () use ($work) {
            try {
                $work();
            } catch (Throwable $e) {
                report($e);
            }
        });
    }

    // ─────────────────────────────── preferences ───────────────────────────────

    /** Every category with whether it is on for this person, and whether they are allowed to switch it off. */
    public function preferencesFor(User $user): array
    {
        $muted = $this->mutedCategories($user);

        return collect(NotificationCategory::cases())->map(fn (NotificationCategory $c) => [
            'category' => $c->value,
            'label' => $c->label(),
            'description' => $c->description(),
            'mandatory' => $c->mandatory(),
            'enabled' => $c->mandatory() || ! in_array($c->value, $muted, true),
        ])->values()->all();
    }

    /** @param  array<string, bool>  $enabledByCategory  only the keys the person changed */
    public function setPreferences(User $user, array $enabledByCategory): void
    {
        $muted = $this->mutedCategories($user);

        foreach (NotificationCategory::cases() as $category) {
            if ($category->mandatory() || ! array_key_exists($category->value, $enabledByCategory)) {
                continue;
            }

            $muted = $enabledByCategory[$category->value]
                ? array_values(array_diff($muted, [$category->value]))
                : array_values(array_unique([...$muted, $category->value]));
        }

        $user->forceFill(['notification_prefs' => $muted === [] ? null : ['muted' => $muted]])->save();
    }

    /** @return list<string> */
    private function mutedCategories(User $user): array
    {
        $muted = $user->notification_prefs['muted'] ?? [];

        return is_array($muted) ? array_values(array_filter($muted, 'is_string')) : [];
    }

    // ─────────────────────────────── housekeeping ───────────────────────────────

    /** Read notifications after 60 days, unread after 180, and anything past its own expiry. Returns rows deleted. */
    public function prune(): int
    {
        $deleted = 0;

        foreach ([
            fn () => UserNotification::whereNotNull('read_at')->where('created_at', '<', now()->subDays(60)),
            fn () => UserNotification::whereNull('read_at')->where('created_at', '<', now()->subDays(180)),
            fn () => UserNotification::whereNotNull('expires_at')->where('expires_at', '<', now()),
        ] as $scope) {
            do {
                $n = $scope()->limit(2000)->delete();
                $deleted += $n;
            } while ($n > 0);
        }

        return $deleted;
    }

    // ─────────────────────────────── internals ───────────────────────────────

    /** @return list<int> */
    private function resolveIds(Builder|Collection|array $to): array
    {
        $raw = $to instanceof Builder ? $to->pluck('users.id')->all() : collect($to)->map(fn ($u) => $u instanceof User ? $u->id : $u)->all();

        return array_values(array_unique(array_filter(array_map('intval', $raw))));
    }

    /** The columns every recipient's row shares. */
    private function baseRow(NotificationType $type, string $title, ?string $body, array $options): array
    {
        $severity = $options['severity'] ?? $type->severity();
        $actor = $options['actor'] ?? null;

        return [
            'type' => $type->value,
            'category' => $type->category()->value,
            'severity' => in_array($severity, ['info', 'success', 'warning', 'critical'], true) ? $severity : 'info',
            'title' => Str::limit(trim($title), 159, '…'),
            'body' => $body !== null && trim($body) !== '' ? Str::limit(trim($body), 499, '…') : null,
            'url' => $this->safeUrl($options['url'] ?? null),
            'data' => isset($options['data']) && $options['data'] !== [] ? json_encode($options['data']) : null,
            'actor_id' => $actor instanceof User ? $actor->id : $actor,
            'expires_at' => isset($options['expires_at']) ? $options['expires_at']->toDateTimeString() : null,
        ];
    }

    /** In-app paths only: "/dashboard/drives" yes; "https://…", "//evil", "javascript:…" no. */
    private function safeUrl(?string $url): ?string
    {
        if ($url === null || $url === '') {
            return null;
        }

        return str_starts_with($url, '/') && ! str_starts_with($url, '//') && ! str_contains($url, '\\') && strlen($url) <= 255 ? $url : null;
    }

    /** @param  list<int>  $ids */
    private function writeChunk(array $ids, NotificationType $type, array $row, ?string $groupKey): int
    {
        // One query both drops blocked/deleted accounts and brings back who has muted what.
        $people = User::query()->whereIn('id', $ids)->where('is_blocked', false)->get(['id', 'notification_prefs']);

        if (! $type->mandatory()) {
            $category = $type->category()->value;
            $people = $people->reject(fn (User $u) => in_array($category, $this->mutedCategories($u), true));
        }

        if ($people->isEmpty()) {
            return 0;
        }

        $now = now()->toDateTimeString();
        $key = $groupKey !== null ? Str::limit($groupKey, 120, '') : null;

        $rows = $people->map(fn (User $u) => [...$row, 'user_id' => $u->id, 'group_key' => $key, 'created_at' => $now])->all();

        return (int) DB::table('user_notifications')->insertOrIgnore($rows);
    }
}
