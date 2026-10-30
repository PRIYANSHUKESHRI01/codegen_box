<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('password_reset_otps', function (Blueprint $table) {
            // The code itself (encrypted with APP_KEY, like the issued-credentials vault). A reset code now stays
            // valid for a week, and asking for another one re-sends THIS code instead of replacing it — which a
            // hash alone could not do. Rows from before this column simply have none and are never re-sent.
            $table->text('code_encrypted')->nullable()->after('code_hash');
        });
    }

    public function down(): void
    {
        Schema::table('password_reset_otps', function (Blueprint $table) {
            $table->dropColumn('code_encrypted');
        });
    }
};
