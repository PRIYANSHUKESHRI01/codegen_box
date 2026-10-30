<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\PlatformModule;
use App\Services\Mock\MockInterviewCatalog;
use App\Services\PlatformModules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Superadmin → switch a whole section (today: Merchant Navy) on or off for EVERY student.
 *
 * The write is explicit ("enabled": true|false), never a blind flip, so a double click or a second open tab cannot undo what the
 * other just did. It lands in the database in this request; the next request any student makes is already answered from it, and
 * their open screens follow within one plan-signal beat (see SubscriptionController::signal()).
 *
 * Staff keep full access to a switched-off module's content (the Mock interview question bank), so it can be prepared while it is hidden.
 */
class SuperAdminPlatformModuleController extends Controller
{
    private const AUDIT_TARGET = 'Platform module';

    public function __construct(
        private readonly PlatformModules $modules,
        private readonly MockInterviewCatalog $catalog,
    ) {}

    public function index(): JsonResponse
    {
        return response()->json(['modules' => $this->payloads(), 'history' => $this->history()]);
    }

    public function update(Request $request, string $key): JsonResponse
    {
        abort_unless($this->modules->exists($key), 404, 'There is no such module.');

        $validated = $request->validate(['enabled' => ['required', 'boolean']]);
        $enabled = (bool) $validated['enabled'];

        $changed = $this->modules->set($key, $enabled, $request->user());

        if ($changed) {
            $label = (string) $this->modules->definitions()[$key]['label'];

            ActivityLog::record(
                $request->user(),
                $enabled ? "Activated {$label} for all students" : "Deactivated {$label} for all students",
                self::AUDIT_TARGET,
                $label,
                ['module' => $key, 'enabled' => $enabled]
            );
        }

        return response()->json(['module' => collect($this->payloads())->firstWhere('key', $key), 'changed' => $changed, 'history' => $this->history()]);
    }

    /** @return list<array<string, mixed>> */
    private function payloads(): array
    {
        $rows = PlatformModule::with('updatedBy:id,name')->get()->keyBy('key');
        $out = [];

        foreach ($this->modules->definitions() as $key => $definition) {
            $row = $rows->get($key);

            $out[] = [
                'key' => $key,
                'label' => $definition['label'],
                'description' => $definition['description'],
                'enabled' => $this->modules->enabled($key),
                'surfaces' => $definition['surfaces'] ?? [],
                'content' => $this->content((array) ($definition['mock_domains'] ?? [])),
                'updated_by_name' => $row?->updatedBy?->name,
                'updated_at' => $row?->exists ? $row->updated_at : null,
            ];
        }

        return $out;
    }

    /**
     * What a student would find if it were on: each exam with its sets and questions, so the superadmin never switches on an empty section.
     *
     * @param  list<string>  $domains
     * @return list<array{key: string, name: string, live: bool, sets: int, questions: int}>
     */
    private function content(array $domains): array
    {
        $out = [];

        foreach ($domains as $domain) {
            foreach ($this->catalog->roles()[$domain]['stacks'] ?? [] as $stack) {
                $questions = 0;

                foreach ($stack['rounds'] as $round) {
                    $questions += count($round['questions']);
                }

                $out[] = [
                    'key' => (string) $stack['key'],
                    'name' => (string) $stack['name'],
                    'live' => $this->catalog->progress($stack)['live'],
                    'sets' => count($stack['rounds']),
                    'questions' => $questions,
                ];
            }
        }

        return $out;
    }

    /** @return list<array<string, mixed>> */
    private function history(): array
    {
        return ActivityLog::where('target_type', self::AUDIT_TARGET)
            ->latest('id')
            ->limit(10)
            ->get()
            ->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'enabled' => (bool) ($log->meta['enabled'] ?? false),
                'actor_name' => $log->actor_name,
                'at' => $log->created_at,
            ])
            ->all();
    }
}
