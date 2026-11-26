<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('voice_verification_profiles', 'proctoring_status')) {
            Schema::table('voice_verification_profiles', function (Blueprint $table) {
                $table->string('proctoring_status', 30)->default('inactive')->after('status');
                $table->timestamp('proctoring_consented_at')->nullable()->after('proctoring_status');
                $table->unsignedTinyInteger('proctoring_violation_count')->default(0)->after('proctoring_consented_at');
                $table->timestamp('proctoring_locked_at')->nullable()->after('proctoring_violation_count');
                $table->json('proctoring_device_info')->nullable()->after('proctoring_locked_at');
            });
        }

        if (! Schema::hasTable('voice_verification_proctoring_violations')) {
            Schema::create('voice_verification_proctoring_violations', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('voice_verification_profile_id');
                $table->foreign('voice_verification_profile_id', 'vv_proc_violations_profile_fk')
                    ->references('id')
                    ->on('voice_verification_profiles')
                    ->cascadeOnDelete();
                $table->string('type', 60);
                $table->boolean('counted_toward_lock')->default(false);
                $table->string('ip_address', 45)->nullable();
                $table->json('meta')->nullable();
                $table->timestamp('occurred_at');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('voice_verification_proctoring_violations');

        if (Schema::hasColumn('voice_verification_profiles', 'proctoring_status')) {
            Schema::table('voice_verification_profiles', function (Blueprint $table) {
                $table->dropColumn([
                    'proctoring_status',
                    'proctoring_consented_at',
                    'proctoring_violation_count',
                    'proctoring_locked_at',
                    'proctoring_device_info',
                ]);
            });
        }
    }
};
