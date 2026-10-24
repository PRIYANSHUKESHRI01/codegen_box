<?php

namespace App\Services\Core;

use App\Models\CoreQuestion;
use App\Models\User;
use App\Support\BranchCatalog;
use App\Support\DepartmentCapabilities;

/**
 * Whether Domain Prep (Core Prep for engineering, Management Prep, Commerce Prep, Subject Prep …) exists for a student right
 * now: their programme has it (the `domain_prep` capability), staff have switched that discipline live (or their college is a
 * pilot), and there is published material to practise. Until all three hold the module is simply absent — never an empty screen.
 *
 * Plan limits are a separate question (PlanGate); this is "does the feature exist for them at all".
 */
class CoreAccess
{
    /**
     * The disciplines that have Domain Prep at all: every discipline whose department / discipline capabilities switch
     * `domain_prep` on. Engineering's ECE / EEE / Mech / Civil were hard-wired here before departments existed; that is now data
     * (database/data/department_taxonomy.php), and every discipline of the other departments is included. Branch-level overrides
     * do not widen this list — a family is what questions, tests and the live switch are keyed by.
     *
     * @return list<string>
     */
    public static function families(): array
    {
        $out = [];

        foreach (BranchCatalog::instance()->disciplines() as $discipline) {
            if (DepartmentCapabilities::resolve($discipline['department_code'], $discipline['code'])['domain_prep'] ?? false) {
                $out[] = $discipline['code'];
            }
        }

        return $out;
    }

    public static function isFamily(?string $discipline): bool
    {
        return $discipline !== null && in_array($discipline, self::families(), true);
    }

    /**
     * `live` = switched on for everyone; `pilot` = on only because the student's college is a pilot for the discipline
     * (staged rollout). Either makes Domain Prep exist for them, provided there is published material.
     *
     * @return array{available: bool, discipline: ?string, family: bool, live: bool, pilot: bool, has_content: bool}
     */
    public function state(User $user): array
    {
        $discipline = $user->discipline;
        $family = $discipline !== null && $user->hasDomainPrepFamily();
        $catalog = BranchCatalog::instance();
        $live = $family && (bool) ($catalog->discipline($discipline)['is_live'] ?? false);
        $enabled = $family && $catalog->coreEnabledFor($discipline, $user->college_id);
        $hasContent = $enabled && $this->publishedExists($discipline);

        return [
            'available' => $hasContent, 'discipline' => $discipline, 'family' => $family,
            'live' => $live, 'pilot' => $enabled && ! $live, 'has_content' => $hasContent,
        ];
    }

    /**
     * Whether this discipline has Domain Prep switched on — nothing more (no query, no look at content). For code that
     * decides whom to look up core activity FOR; whether there is anything to see is then the data's own answer.
     */
    public function liveFamily(?string $discipline): bool
    {
        return self::isFamily($discipline) && (bool) (BranchCatalog::instance()->discipline($discipline)['is_live'] ?? false);
    }

    public function available(User $user): bool
    {
        return $this->state($user)['available'];
    }

    private function publishedExists(string $discipline): bool
    {
        // One indexed exists(); deliberately not memoised — a controller instance can outlive a request (tests, Octane).
        return CoreQuestion::query()->where('discipline_code', $discipline)->where('status', CoreQuestion::STATUS_PUBLISHED)->exists();
    }
}
