<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Raw storage path on the `public` disk (e.g. "avatars/72.jpg"),
            // never exposed directly — User::avatar_url() resolves it to a
            // real URL. Deliberately not in $fillable: only
            // AuthController::updateAvatar() sets this, via forceFill().
            $table->string('avatar_path')->nullable()->after('handle');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('avatar_path');
        });
    }
};
