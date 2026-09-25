<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * `college_id` was required because every DriveApplication used to be a
 * campus-drive row (a student registered by their TPO always has one). A
 * company-direct job opening's candidate may have no college at all (a
 * "Mellow Direct"-style net-new candidate a company invited directly) —
 * see CompanyCandidateController/ProcessCandidateImportJob, which
 * deliberately snapshot the candidate's real college_id (null or not)
 * rather than fabricating one. Nullable, not dropped: every existing
 * campus-drive application still gets a real college_id exactly as before.
 *
 * Raw SQL rather than Schema::table()->change(), same reasoning as every
 * other column-modification migration in this codebase: Laravel's
 * Doctrine-DBAL-based ->change() isn't available here (dbal isn't installed).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! $this->isMySql()) {
            return;
        }

        DB::statement('ALTER TABLE drive_applications MODIFY COLUMN college_id BIGINT UNSIGNED NULL');
    }

    public function down(): void
    {
        if (! $this->isMySql()) {
            return;
        }

        DB::statement('ALTER TABLE drive_applications MODIFY COLUMN college_id BIGINT UNSIGNED NOT NULL');
    }

    private function isMySql(): bool
    {
        return in_array(DB::getDriverName(), ['mysql', 'mariadb'], true);
    }
};
