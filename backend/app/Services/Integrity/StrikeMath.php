<?php

namespace App\Services\Integrity;

/**
 * How many strikes a finding adds to a surface's own violation_count. The surfaces' services all call this so the
 * rule lives in one place:
 *
 *   null / 1   → one strike (the original behaviour; a normal finding)
 *   2…98       → that many
 *   99 (LOCK)  → exactly enough to reach the lock threshold, so a proven tamper ends the attempt at once WITHOUT showing
 *                "100/3 strikes" in the report.
 */
final class StrikeMath
{
    public static function toAdd(?int $requested, int $currentCount): int
    {
        if ($requested === null || $requested <= 1) {
            return 1;
        }

        if ($requested >= EventCatalog::STRIKE_LOCK) {
            $threshold = (int) config('proctoring.max_violations_before_lock', 3);

            return max(1, $threshold - $currentCount);
        }

        return $requested;
    }
}
