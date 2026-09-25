<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mirrors `email_verified_at`'s exact shape/convention — see
 * App\Services\FirebasePhoneVerificationService for the only writer.
 * `phone` itself already existed (staff can set it directly for a student,
 * e.g. via roster import/parent contact); this column is the separate,
 * much stronger claim "a real SMS OTP round-trip proved this number
 * belongs to this account" — set only via PhoneVerificationController,
 * never mass-assignable (see User::$fillable, which deliberately excludes
 * it, same as is_blocked/credentials_email_sent_at).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('phone_verified_at')->nullable()->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('phone_verified_at');
        });
    }
};
