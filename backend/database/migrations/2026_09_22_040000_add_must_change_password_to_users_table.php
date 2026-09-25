<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // True for every account provisioned with a server-generated
            // password (manual add, bulk import, TPO/staff/superadmin
            // onboarding) — false for a self-registered account, where the
            // user chose their own password from the start. AuthController::
            // login() refuses to issue a real session while this is true,
            // routing the user through the OTP-verified password-change flow
            // instead (see PasswordResetService, reused as-is).
            $table->boolean('must_change_password')->default(false)->after('password');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('must_change_password');
        });
    }
};
