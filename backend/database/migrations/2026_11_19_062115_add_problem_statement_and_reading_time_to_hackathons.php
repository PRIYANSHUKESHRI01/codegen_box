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
        Schema::table('hackathons', function (Blueprint $table) {
            $table->longText('problem_statement')->nullable()->after('description');
            $table->unsignedSmallInteger('reading_time_minutes')->default(15)->after('problem_statement');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('hackathons', function (Blueprint $table) {
            $table->dropColumn(['problem_statement', 'reading_time_minutes']);
        });
    }
};
