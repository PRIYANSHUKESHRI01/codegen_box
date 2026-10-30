<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The first NOT NULL TIMESTAMP column of a table that has no explicit default
 * silently becomes `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` on
 * MariaDB < 10.10 and on MySQL with explicit_defaults_for_timestamp=OFF. For
 * password_reset_otps that column is expires_at, so saving the reset token in
 * PasswordResetService::verifyOtp() rewrote the expiry to "now" and the very
 * next step ("set your new password") failed with "This reset link has
 * expired". Giving the column an explicit default removes the ON UPDATE part;
 * the type and existing values stay as they are.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        DB::statement('ALTER TABLE password_reset_otps MODIFY expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
    }

    public function down(): void
    {
        // Deliberately empty: restoring the auto-update would put the bug back.
    }
};
