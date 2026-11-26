<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('voice_verification_profiles', function (Blueprint $table) {
            $table->unsignedTinyInteger('enrollment_lock_count')->default(0)->after('proctoring_violation_count');
            $table->unsignedTinyInteger('max_enrollment_attempts')->default(3)->after('enrollment_lock_count');
        });
    }

    public function down(): void
    {
        Schema::table('voice_verification_profiles', function (Blueprint $table) {
            $table->dropColumn(['enrollment_lock_count', 'max_enrollment_attempts']);
        });
    }
};
