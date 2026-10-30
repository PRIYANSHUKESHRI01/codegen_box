<?php

namespace App\Services;

use App\Models\Interview;
use App\Models\PlatformModule;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Throwable;

/**
 * Which whole sections of the product are switched on (config/platform_modules.php; the superadmin flips them).
 *
 * Bound as a scoped singleton, so the answer is read from the database ONCE per request — that is what makes a switch real time:
 * the very next request anyone makes sees it, with no cache to expire. A missing row (fresh install) or a missing table (a deploy
 * that has not migrated yet) means "the module's default", never an error: this runs for every student on every request.
 */
class PlatformModules
{
    /** @var array<string, bool>|null */
    private ?array $states = null;

    /** @return array<string, array<string, mixed>> */
    public function definitions(): array
    {
        return (array) config('platform_modules.modules', []);
    }

    public function exists(string $key): bool
    {
        return isset($this->definitions()[$key]);
    }

    /** @return array<string, bool> module key => switched on */
    public function states(): array
    {
        if ($this->states !== null) {
            return $this->states;
        }

        $states = [];

        foreach ($this->definitions() as $key => $definition) {
            $states[$key] = (bool) ($definition['default'] ?? true);
        }

        try {
            foreach (PlatformModule::query()->get(['key', 'enabled']) as $row) {
                if (array_key_exists($row->key, $states)) {
                    $states[$row->key] = (bool) $row->enabled;
                }
            }
        } catch (Throwable) {
            // Table not there yet: every module keeps its default.
        }

        return $this->states = $states;
    }

    public function enabled(string $key): bool
    {
        return $this->states()[$key] ?? true;
    }

    /** Short fingerprint of every module's state, for the plan-signal poll: it moves exactly when a student's screen has to change. */
    public function signature(): string
    {
        return substr(sha1(json_encode($this->states())), 0, 16);
    }

    /** Switches a module. Returns whether anything actually changed (a repeated click, or a second tab, is a no-op). */
    public function set(string $key, bool $enabled, User $actor): bool
    {
        $row = PlatformModule::firstOrNew(['key' => $key]);
        $was = $row->exists ? (bool) $row->enabled : (bool) ($this->definitions()[$key]['default'] ?? true);

        $row->enabled = $enabled;
        $row->updated_by = $actor->id;
        $row->save();

        $this->states = null;

        return $was !== $enabled;
    }

    /** Whether a Mock AI Interview domain belongs to a module that is currently off. */
    public function hidesMockDomain(string $domainKey): bool
    {
        foreach ($this->definitions() as $key => $definition) {
            if (in_array($domainKey, (array) ($definition['mock_domains'] ?? []), true) && ! $this->enabled($key)) {
                return true;
            }
        }

        return false;
    }

    /** The key of the switched-off module this sitting belongs to, or null when it belongs to none (or its module is on). */
    public function moduleBlocking(Interview $interview): ?string
    {
        foreach ($this->definitions() as $key => $definition) {
            if ($interview->discipline !== null && in_array($interview->discipline, (array) ($definition['disciplines'] ?? []), true) && ! $this->enabled($key)) {
                return (string) $key;
            }
        }

        return null;
    }

    /** The one answer a student gets for starting something that is switched off: 403 with a code the browser can word kindly. */
    public static function unavailable(string $module): HttpResponseException
    {
        $label = (string) config("platform_modules.modules.{$module}.label", 'This section');

        return new HttpResponseException(response()->json([
            'message' => "{$label} practice isn't available right now. Please check back soon.",
            'code' => 'module_unavailable',
            'module' => $module,
        ], 403));
    }

    /** The module (key) whose domain this is, if any — used to word the refusal. */
    public function moduleOfMockDomain(string $domainKey): ?string
    {
        foreach ($this->definitions() as $key => $definition) {
            if (in_array($domainKey, (array) ($definition['mock_domains'] ?? []), true)) {
                return $key;
            }
        }

        return null;
    }
}
