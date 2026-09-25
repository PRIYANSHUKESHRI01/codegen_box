<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mirrors 2026_09_24_060000_add_talent_pool_fields_to_contests_table's
 * `audience_scope` addition to Contest — same all/college/direct targeting,
 * same reasoning, for Interview::INTERVIEW_TYPE_TALENT_POOL (the optional
 * "and interview" half of a Mellow-run talent-scouting assessment). No
 * qualifying_score_percent equivalent here: an AI interview is never
 * auto-scored (see Interview's own docblock — a human reviews it), so it
 * never gates Talent Pool membership itself, only the linked coding test does.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interviews', function (Blueprint $table) {
            $table->string('audience_scope')->nullable()->after('owning_college_id');
        });
    }

    public function down(): void
    {
        Schema::table('interviews', function (Blueprint $table) {
            $table->dropColumn('audience_scope');
        });
    }
};
