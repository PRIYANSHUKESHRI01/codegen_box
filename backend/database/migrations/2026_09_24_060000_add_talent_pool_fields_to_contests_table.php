<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Widens Contest with a 6th type, `talent_pool` (see
 * App\Models\Contest::CONTEST_TYPE_TALENT_POOL): a Mellow-staff-curated
 * assessment that is NOT tied to any company/drive at all — its whole point
 * is to source candidates for the shared Talent Pool marketplace rather than
 * one company's own pipeline. `contest_type` itself stays the plain string
 * this table already uses (no ALTER-ENUM needed to add the value).
 *
 * `audience_scope` is the new visibility axis this type needs that no
 * existing type has: `all` (platform-wide, like general), `college`
 * (specific colleges — reuses the existing `contest_colleges` pivot table
 * verbatim, just without a DriveCollegeMapping requirement behind it), or
 * `direct` (only users with no college — "Mellow Direct" users, see
 * User::isMellowDirectLead()). Nullable because it's meaningless for every
 * other contest_type.
 *
 * `qualifying_score_percent` is the per-assessment auto-qualify threshold
 * for the Talent Pool (see App\Services\TalentPoolQualificationService) —
 * configurable per assessment rather than a single global constant, since
 * Mellow may want a harder bar for one test than another. Nullable/unused
 * for every other contest_type; defaulted to 90.00 at creation time in
 * AdminContestController, not at the column level, so a blank value on an
 * unrelated contest type never reads as a meaningful "0%".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contests', function (Blueprint $table) {
            $table->string('audience_scope')->nullable()->after('owning_college_id');
            $table->decimal('qualifying_score_percent', 5, 2)->nullable()->after('audience_scope');
        });
    }

    public function down(): void
    {
        Schema::table('contests', function (Blueprint $table) {
            $table->dropColumn(['audience_scope', 'qualifying_score_percent']);
        });
    }
};
