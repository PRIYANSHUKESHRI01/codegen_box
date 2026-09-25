<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Parallel to `owning_college_id` (a TPO's own tpo_mock contests) — set only
 * for the new `company_hiring` contest_type (a company hiring tenant's own
 * proctored assessment), scoping it to the tenant that created it. No schema
 * change needed on contest_type itself: it's a deliberately plain string
 * column (see 2026_09_22_090000's docblock), so the new type is added as a
 * PHP constant only.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contests', function (Blueprint $table) {
            $table->foreignId('owning_company_id')->nullable()->after('owning_college_id')
                ->constrained('companies')->nullOnDelete();
            $table->index('owning_company_id');
        });
    }

    public function down(): void
    {
        Schema::table('contests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('owning_company_id');
        });
    }
};
