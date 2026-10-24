<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which weighting produced a Vault profile's readiness score (readiness v4): "software" for everyone today,
 * "core" or "balanced" for a non-CS student whose branch's Core Prep is live. Mellow Vault shows it beside the
 * components, which differ by profile. Null on rows written before v4 — read as "software", which they were.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vault_profiles', function (Blueprint $table) {
            if (! Schema::hasColumn('vault_profiles', 'readiness_profile')) {
                $table->string('readiness_profile', 16)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('vault_profiles', function (Blueprint $table) {
            if (Schema::hasColumn('vault_profiles', 'readiness_profile')) {
                $table->dropColumn('readiness_profile');
            }
        });
    }
};
