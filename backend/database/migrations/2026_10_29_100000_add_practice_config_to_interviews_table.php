<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Practice interviews: a student builds their own AI mock interview (a branch role, a kind of round, a difficulty). It is an
 * ordinary Interview row (type `practice`, `is_mock`, created_by = the student) so the voice flow, the proctoring hooks and the
 * AI scoring all run unchanged. `practice_config` remembers what they asked for, for the list and for analytics.
 * Additive: every existing row keeps a null here.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('interviews', 'practice_config')) {
            Schema::table('interviews', function (Blueprint $table) {
                $table->json('practice_config')->nullable()->after('discipline');
                // "My practice interviews" and the daily creation cap read by (type, creator).
                $table->index(['interview_type', 'created_by'], 'interviews_type_creator_index');
            });
        }
    }

    public function down(): void
    {
        Schema::table('interviews', function (Blueprint $table) {
            $table->dropIndex('interviews_type_creator_index');
            $table->dropColumn('practice_config');
        });
    }
};
