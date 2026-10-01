<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Nullable; only populated for problems matched against real, sourced
     * per-company interview-question data (see CompanyTagSeeder for the
     * source and method) — never a guess.
     */
    public function up(): void
    {
        Schema::table('problems', function (Blueprint $table) {
            $table->json('companies')->nullable()->after('tags');
        });
    }

    public function down(): void
    {
        Schema::table('problems', function (Blueprint $table) {
            $table->dropColumn('companies');
        });
    }
};
