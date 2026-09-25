<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('problems', function (Blueprint $table) {
            // Per-language "main"/driver snippet appended after the student's
            // code — calls their function/method once per example and prints
            // one result per line. No per-problem prelude (imports/includes)
            // is stored here; CodeExecutionService prepends a fixed,
            // language-level prelude before compiling/running.
            $table->json('test_harness')->nullable()->after('starter_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('problems', function (Blueprint $table) {
            $table->dropColumn('test_harness');
        });
    }
};
