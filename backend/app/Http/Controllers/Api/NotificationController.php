<?php

namespace App\Http\Controllers\Api;

use App\Enums\NotificationCategory;
use App\Http\Controllers\Controller;
use App\Models\UserNotification;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * The signed-in person's own notifications — every role shares this, so there is no role middleware: every query
 * is scoped to `$request->user()->id` and a notification id that belongs to someone else is simply "not found"
 * (never "forbidden", which would confirm it exists). Nothing here can create a notification or read another
 * person's; the only writes are marking your own read, dismissing your own, and your own mute settings.
 *
 * "Real time" is a poll of `signal()`: one aggregate query that answers "how many unread, and what is the newest
 * id", every ~15 s per open tab. A change in either is the cue to fetch the list. (PHP can't hold open sockets
 * for thousands of students; a 100-byte answer from an index is the cheap way to get within seconds.)
 */
class NotificationController extends Controller
{
    public function __construct(private readonly NotificationService $notifications) {}

    /** Newest first, cursor-paged by id so a notification arriving mid-scroll can't shift the page. */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'before' => ['sometimes', 'integer', 'min:1'],
            'category' => ['sometimes', Rule::in(array_map(fn (NotificationCategory $c) => $c->value, NotificationCategory::cases()))],
            'unread' => ['sometimes', 'boolean'],
        ]);

        $limit = (int) ($validated['limit'] ?? 20);
        $query = $this->mine($request)->orderByDesc('id');

        if (isset($validated['before'])) {
            $query->where('id', '<', $validated['before']);
        }
        if (isset($validated['category'])) {
            $query->where('category', $validated['category']);
        }
        if ($request->boolean('unread')) {
            $query->whereNull('read_at');
        }

        $rows = $query->limit($limit + 1)->get();
        $more = $rows->count() > $limit;
        $page = $rows->take($limit);

        return $this->json([
            'data' => $page->map->toApi()->values(),
            'next_before' => $more ? $page->last()?->id : null,
            'unread_count' => $this->unread($request),
        ]);
    }

    /** What the poll asks: unread count + newest id, nothing else. */
    public function signal(Request $request): JsonResponse
    {
        $row = $this->mine($request)->selectRaw('COUNT(CASE WHEN read_at IS NULL THEN 1 END) AS unread, MAX(id) AS latest_id')->first();

        return $this->json([
            'unread_count' => (int) ($row->unread ?? 0),
            'latest_id' => (int) ($row->latest_id ?? 0),
        ]);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        $this->mine($request)->whereKey($id)->whereNull('read_at')->update(['read_at' => now()]);

        abort_unless($this->mine($request)->whereKey($id)->exists(), 404);

        return $this->json(['unread_count' => $this->unread($request)]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category' => ['sometimes', Rule::in(array_map(fn (NotificationCategory $c) => $c->value, NotificationCategory::cases()))],
        ]);

        $query = $this->mine($request)->whereNull('read_at');
        if (isset($validated['category'])) {
            $query->where('category', $validated['category']);
        }
        $query->update(['read_at' => now()]);

        return $this->json(['unread_count' => $this->unread($request)]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        abort_unless($this->mine($request)->whereKey($id)->delete() > 0, 404);

        return $this->json(['unread_count' => $this->unread($request)]);
    }

    public function clearRead(Request $request): JsonResponse
    {
        $this->mine($request)->whereNotNull('read_at')->delete();

        return $this->json(['unread_count' => $this->unread($request)]);
    }

    public function preferences(Request $request): JsonResponse
    {
        return $this->json(['categories' => $this->notifications->preferencesFor($request->user())]);
    }

    public function updatePreferences(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'categories' => ['required', 'array'],
            'categories.*' => ['boolean'],
        ]);

        $known = array_map(fn (NotificationCategory $c) => $c->value, NotificationCategory::cases());
        $changes = collect($validated['categories'])->filter(fn ($v, $k) => in_array($k, $known, true))->map(fn ($v) => (bool) $v)->all();

        $this->notifications->setPreferences($request->user(), $changes);

        return $this->json(['categories' => $this->notifications->preferencesFor($request->user()->fresh())]);
    }

    private function mine(Request $request)
    {
        return UserNotification::query()->where('user_id', $request->user()->id);
    }

    private function unread(Request $request): int
    {
        return $this->mine($request)->whereNull('read_at')->count();
    }

    /** Personal data: never cached by the browser or a proxy. */
    private function json(array $body): JsonResponse
    {
        return response()->json($body)->withHeaders(['Cache-Control' => 'private, no-store']);
    }
}
