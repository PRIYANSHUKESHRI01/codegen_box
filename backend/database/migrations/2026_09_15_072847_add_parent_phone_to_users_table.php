<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A parent/guardian contact number, separate from the student's own phone
 * — sourced from the same roster import as every other academic field
 * (never self-editable), so a TPO can reach a parent directly for
 * placement-readiness follow-up without hunting through paper records.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('parent_phone')->nullable()->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('parent_phone');
        });
    }
};
